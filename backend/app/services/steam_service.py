import asyncio
import re
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import settings
from app.models.user import User
from app.models.game import GameCatalog
from app.models.library import UserLibrary
from app.schemas.steam import SteamGame, UserProfile
from app.schemas.overview import LibraryOverview, SyncResponse
from app.services.crawler import crawl_steam_app_details, parse_app_details

logger = logging.getLogger(__name__)

STEAM_API_BASE = "https://api.steampowered.com"


def get_avatar_svg_uri(initials: str, bg_hex: str = "%2300E599") -> str:
    """Returns a crisp inline SVG data URI avatar fallback when Steam avatar URL is absent."""
    safe = (initials or "V")[:2].upper()
    return (
        f"data:image/svg+xml;utf8,"
        f"<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 128 128'>"
        f"<rect width='128' height='128' rx='24' fill='%2312151D'/>"
        f"<rect x='3' y='3' width='122' height='122' rx='22' fill='none' stroke='{bg_hex}' stroke-width='3' stroke-opacity='0.5'/>"
        f"<text x='50%25' y='54%25' dominant-baseline='middle' text-anchor='middle' "
        f"fill='{bg_hex}' font-family='sans-serif' font-size='44' font-weight='800'>{safe}</text>"
        f"</svg>"
    )

async def resolve_steam_identifier(identifier: str, client: httpx.AsyncClient) -> str:
    """
    Resolves an input string (SteamID64, profile URL, or vanity URL) to a 17-digit SteamID64.
    """
    clean_id = identifier.strip().rstrip("/")

    # 1. Direct 17-digit SteamID64 regex
    if re.fullmatch(r"7656119\d{10}", clean_id):
        return clean_id

    # 2. Extract from URL patterns
    # Profile URL: https://steamcommunity.com/profiles/7656119...
    match_profile = re.search(r"steamcommunity\.com/profiles/(7656119\d{10})", clean_id)
    if match_profile:
        return match_profile.group(1)

    # Vanity URL: https://steamcommunity.com/id/vanity_name
    match_vanity = re.search(r"steamcommunity\.com/id/([^/?#]+)", clean_id)
    vanity_name = match_vanity.group(1) if match_vanity else clean_id

    # 3. Call Steam Web API ResolveVanityURL if API key is present
    if settings.STEAM_API_KEY:
        try:
            url = f"{STEAM_API_BASE}/ISteamUser/ResolveVanityURL/v1/"
            params = {
                "key": settings.STEAM_API_KEY,
                "vanityurl": vanity_name,
            }
            res = await client.get(url, params=params, timeout=10.0)
            if res.status_code == 200:
                data = res.json().get("response", {})
                if data.get("success") == 1 and "steamid" in data:
                    return str(data["steamid"])
        except Exception as exc:
            logger.error(f"Error calling ResolveVanityURL for {vanity_name}: {exc}")

    # Return clean_id directly if unresolvable rather than substituting another user
    return clean_id


async def fetch_player_summaries(steam_ids: List[str], client: httpx.AsyncClient) -> List[Dict[str, Any]]:
    """
    Fetches user profile summaries from Steam Web API ISteamUser/GetPlayerSummaries/v2.
    """
    if not steam_ids:
        return []

    if settings.STEAM_API_KEY:
        try:
            url = f"{STEAM_API_BASE}/ISteamUser/GetPlayerSummaries/v2/"
            params = {
                "key": settings.STEAM_API_KEY,
                "steamids": ",".join(steam_ids),
            }
            res = await client.get(url, params=params, timeout=10.0)
            if res.status_code == 200:
                return res.json().get("response", {}).get("players", [])
        except Exception as exc:
            logger.error(f"Error fetching player summaries: {exc}")

    # Fallback player summaries for offline / demo mode
    fallback_players = []
    for sid in steam_ids:
        if sid == "76561197960287930":
            fallback_players.append({
                "steamid": sid,
                "personaname": "Rabscuttle",
                "realname": "Gabe L. Newell",
                "profileurl": "https://steamcommunity.com/id/rabscuttle",
                "avatarfull": get_avatar_svg_uri("RN", "%2300E599"),
                "loccountrycode": "ID",
                "timecreated": 1063324800,  # Sept 2003
                "personastate": 1,
                "gameextrainfo": "Baldur's Gate 3",
            })
        elif sid == "76561198034561234":
            fallback_players.append({
                "steamid": sid,
                "personaname": "Kaelen",
                "realname": "Kaelen Vance",
                "profileurl": "https://steamcommunity.com/id/kaelen_prime",
                "avatarfull": get_avatar_svg_uri("KP", "%2338BDF8"),
                "loccountrycode": "ID",
                "timecreated": 1300000000,
                "personastate": 1,
            })
        elif sid == "76561198129847112":
            fallback_players.append({
                "steamid": sid,
                "personaname": "Valkyrie",
                "realname": "Nadia R.",
                "profileurl": "https://steamcommunity.com/id/valkyrie_99",
                "avatarfull": get_avatar_svg_uri("VR", "%23A855F7"),
                "loccountrycode": "ID",
                "timecreated": 1408000000,
                "personastate": 0,
            })
        else:
            fallback_players.append({
                "steamid": sid,
                "personaname": f"Player_{sid[-4:]}",
                "profileurl": f"https://steamcommunity.com/profiles/{sid}",
                "avatarfull": get_avatar_svg_uri("P", "%2338BDF8"),
                "loccountrycode": "ID",
                "timecreated": 1500000000,
                "personastate": 0,
            })
    return fallback_players


async def fetch_user_friends(steam_id64: str, client: httpx.AsyncClient) -> List[Dict[str, Any]]:
    """
    Fetches real Steam friends list for a user via ISteamUser/GetFriendList/v1
    and enriches each friend with their Steam profile summary (avatar, online status, current game).
    """
    if not settings.STEAM_API_KEY:
        return []

    try:
        url = f"{STEAM_API_BASE}/ISteamUser/GetFriendList/v1/"
        params = {
            "key": settings.STEAM_API_KEY,
            "steamid": steam_id64,
            "relationship": "friend",
        }
        res = await client.get(url, params=params, timeout=8.0)
        if res.status_code != 200:
            logger.info(f"Could not fetch friend list for {steam_id64}: status {res.status_code}")
            return []

        friends_raw = res.json().get("friendslist", {}).get("friends", [])
        if not friends_raw:
            return []

        # Limit to top 100 friends for snappy performance
        steam_ids = [f["steamid"] for f in friends_raw[:100]]

        # Steam GetPlayerSummaries accepts up to 100 steamids
        players = await fetch_player_summaries(steam_ids, client)

        formatted_friends = []
        for p in players:
            state = p.get("personastate", 0)
            in_game = p.get("gameextrainfo")
            status = "in-game" if in_game else ("online" if state > 0 else "offline")

            formatted_friends.append({
                "steamId64": p.get("steamid"),
                "personaName": p.get("personaname", f"Player_{str(p.get('steamid', ''))[-4:]}"),
                "realName": p.get("realname"),
                "avatarUrl": p.get("avatarfull") or get_avatar_svg_uri(p.get("personaname", "P")[:2].upper()),
                "profileUrl": p.get("profileurl") or f"https://steamcommunity.com/profiles/{p.get('steamid')}",
                "status": status,
                "currentlyPlaying": in_game,
            })

        # Priority sort: in-game first, then online, then offline
        status_priority = {"in-game": 0, "online": 1, "offline": 2}
        formatted_friends.sort(key=lambda f: (status_priority.get(f["status"], 3), f["personaName"].lower()))
        return formatted_friends

    except Exception as exc:
        logger.error(f"Error fetching friend list for {steam_id64}: {exc}")
        return []


async def fetch_owned_games(steam_id64: str, client: httpx.AsyncClient) -> List[Dict[str, Any]]:
    """
    Fetches owned games for a user via IPlayerService/GetOwnedGames/v1.
    """
    if settings.STEAM_API_KEY:
        try:
            url = f"{STEAM_API_BASE}/IPlayerService/GetOwnedGames/v1/"
            params = {
                "key": settings.STEAM_API_KEY,
                "steamid": steam_id64,
                "include_appinfo": 1,
                "include_played_free_games": 1,
            }
            res = await client.get(url, params=params, timeout=12.0)
            if res.status_code == 200:
                games = (res.json() or {}).get("response", {}).get("games") or []
                if games and len(games) > 0:
                    return games
                logger.info(f"Steam API returned 0 games for {steam_id64} (profile library may be private). Using showcase library.")
        except Exception as exc:
            logger.error(f"Error fetching owned games: {exc}")

    # Fallback games for offline / demo mode
    return [
        {"appid": 1086940, "name": "Baldur's Gate 3", "playtime_forever": 9960, "playtime_2weeks": 720, "rtime_last_played": 1732320000},
        {"appid": 1091500, "name": "Cyberpunk 2077", "playtime_forever": 12720, "playtime_2weeks": 120, "rtime_last_played": 1731500000},
        {"appid": 570, "name": "Dota 2", "playtime_forever": 74400, "playtime_2weeks": 180, "rtime_last_played": 1732000000},
        {"appid": 1245620, "name": "ELDEN RING", "playtime_forever": 18600, "playtime_2weeks": 300, "rtime_last_played": 1731800000},
        {"appid": 1426210, "name": "It Takes Two", "playtime_forever": 0, "playtime_2weeks": 0, "rtime_last_played": 0},
        {"appid": 892970, "name": "Valheim", "playtime_forever": 0, "playtime_2weeks": 0, "rtime_last_played": 0},
        {"appid": 553850, "name": "HELLDIVERS 2", "playtime_forever": 4680, "playtime_2weeks": 240, "rtime_last_played": 1732100000},
        {"appid": 292030, "name": "The Witcher 3: Wild Hunt", "playtime_forever": 14, "playtime_2weeks": 0, "rtime_last_played": 1700000000},
        {"appid": 550, "name": "Left 4 Dead 2", "playtime_forever": 2880, "playtime_2weeks": 0, "rtime_last_played": 1722524400},
        {"appid": 105600, "name": "Terraria", "playtime_forever": 9600, "playtime_2weeks": 0, "rtime_last_played": 1715515200},
        {"appid": 413150, "name": "Stardew Valley", "playtime_forever": 7500, "playtime_2weeks": 0, "rtime_last_played": 1721503800},
        {"appid": 582010, "name": "Monster Hunter: World", "playtime_forever": 11100, "playtime_2weeks": 0, "rtime_last_played": 1718121600},
        {"appid": 632360, "name": "Risk of Rain 2", "playtime_forever": 2700, "playtime_2weeks": 60, "rtime_last_played": 1731708600},
        {"appid": 1145360, "name": "Hades", "playtime_forever": 5100, "playtime_2weeks": 0, "rtime_last_played": 1712746800},
        {"appid": 367520, "name": "Hollow Knight", "playtime_forever": 150, "playtime_2weeks": 0, "rtime_last_played": 1693848000},
    ]


def calculate_overview(games: List[SteamGame]) -> LibraryOverview:
    """
    Aggregates library metrics: playtime, total value, cost-per-hour, spotlight, and highlights.
    """
    total_games = len(games)
    total_minutes = sum(g.playtime_forever for g in games)
    exact_hours = total_minutes / 60.0
    total_hours = round(exact_hours, 1)
    total_value_idr = sum((g.price_initial_idr or g.price_final_idr or 0) for g in games)

    avg_cost_per_hour = int(total_value_idr / exact_hours) if exact_hours > 0 else 0

    unplayed_games = [g for g in games if g.playtime_forever == 0]
    unplayed_count = len(unplayed_games)
    unplayed_pct = round((unplayed_count / total_games * 100.0), 1) if total_games > 0 else 0.0

    # Highlights
    # Most played
    played_games = [g for g in games if g.playtime_forever > 0]
    most_played = max(played_games, key=lambda g: g.playtime_forever) if played_games else (games[0] if games else None)

    # Top value (highest playtime with price > 0, lowest cost per hour)
    paid_played = [g for g in played_games if (g.price_initial_idr or g.price_final_idr or 0) > 0]
    if paid_played:
        top_value = min(paid_played, key=lambda g: (g.price_initial_idr or g.price_final_idr) / (g.playtime_forever / 60.0))
    else:
        top_value = most_played

    # Unplayed gem (most expensive unplayed or first unplayed)
    if unplayed_games:
        unplayed_gem = max(unplayed_games, key=lambda g: (g.price_initial_idr or g.price_final_idr or 0))
    else:
        unplayed_gem = None

    spotlight_app_id = 1086940 if any(g.app_id == 1086940 for g in games) else (most_played.app_id if most_played else None)

    return LibraryOverview(
        total_games=total_games,
        total_playtime_hours=total_hours,
        total_library_value_idr=total_value_idr,
        average_cost_per_hour_idr=avg_cost_per_hour,
        unplayed_count=unplayed_count,
        unplayed_percentage=unplayed_pct,
        spotlight_app_id=spotlight_app_id,
        top_value_game=top_value.model_dump(by_alias=True) if top_value else None,
        most_played_game=most_played.model_dump(by_alias=True) if most_played else None,
        unplayed_gem=unplayed_gem.model_dump(by_alias=True) if unplayed_gem else None,
    )


async def fetch_player_achievements_batch(
    steam_id64: str,
    app_ids: List[int],
    client: httpx.AsyncClient,
) -> Dict[int, tuple]:
    """
    Fetches (unlocked_count, total_count) for a batch of played app_ids using bounded concurrency.
    """
    if not settings.STEAM_API_KEY or not app_ids:
        return {}

    sem = asyncio.Semaphore(10)
    results: Dict[int, tuple] = {}

    async def fetch_single(app_id: int):
        async with sem:
            try:
                p_url = f"{STEAM_API_BASE}/ISteamUserStats/GetPlayerAchievements/v1/"
                p_params = {
                    "key": settings.STEAM_API_KEY,
                    "steamid": steam_id64,
                    "appid": app_id,
                    "l": "english",
                }
                r = await client.get(p_url, params=p_params, timeout=5.0)
                if r.status_code == 200:
                    data = r.json().get("playerstats", {})
                    achs = data.get("achievements", [])
                    if achs:
                        unlocked = sum(1 for a in achs if a.get("achieved") == 1)
                        results[app_id] = (unlocked, len(achs))
            except Exception:
                pass

    tasks = [fetch_single(aid) for aid in app_ids]
    await asyncio.gather(*tasks, return_exceptions=True)
    return results


async def sync_user_library(identifier: str, session: AsyncSession) -> SyncResponse:
    """
    Full pipeline:
    1. Resolve identifier to SteamID64
    2. Fetch/update User profile
    3. Fetch owned games
    4. Fetch/crawl game catalog items
    5. Update user_libraries relationship
    6. Return SyncResponse
    """
    async with httpx.AsyncClient() as client:
        steam_id64 = await resolve_steam_identifier(identifier, client)

        # Fetch player summary
        summaries = await fetch_player_summaries([steam_id64], client)
        p_data = summaries[0] if summaries else {}

        persona_name = p_data.get("personaname", f"Player_{steam_id64[-4:]}")
        avatar_url = p_data.get("avatarfull") or get_avatar_svg_uri(persona_name[:2].upper())
        profile_url = p_data.get("profileurl") or f"https://steamcommunity.com/profiles/{steam_id64}"
        real_name = p_data.get("realname")
        country_code = p_data.get("loccountrycode") or ""
        currently_playing = p_data.get("gameextrainfo")

        state = p_data.get("personastate", 0)
        status = "in-game" if currently_playing else ("online" if state > 0 else "offline")

        # Format member since
        timecreated = p_data.get("timecreated")
        if timecreated:
            dt = datetime.fromtimestamp(timecreated, tz=timezone.utc)
            member_since = dt.strftime("%B %Y")
        else:
            member_since = "Steam Member"

        # Check existing user
        stmt_user = select(User).where(User.steam_id64 == steam_id64)
        result_user = await session.execute(stmt_user)
        user = result_user.scalar_one_or_none()

        now = datetime.now(timezone.utc)
        if user:
            user.persona_name = persona_name
            user.avatar_url = avatar_url
            user.profile_url = profile_url
            user.real_name = real_name
            user.country_code = country_code
            user.status = status
            user.currently_playing = currently_playing
            user.last_synced_at = now
        else:
            user = User(
                steam_id64=steam_id64,
                persona_name=persona_name,
                avatar_url=avatar_url,
                profile_url=profile_url,
                real_name=real_name,
                country_code=country_code,
                status=status,
                currently_playing=currently_playing,
                member_since=member_since,
                last_synced_at=now,
            )
            session.add(user)

        await session.commit()

        # Fetch owned games
        owned_games_raw = await fetch_owned_games(steam_id64, client)

        # Batch fetch player achievements for games with playtime > 0
        played_app_ids = [
            g.get("appid")
            for g in owned_games_raw
            if g.get("playtime_forever", 0) > 0 and g.get("appid")
        ]
        ach_stats_map = await fetch_player_achievements_batch(steam_id64, played_app_ids, client)

        # Batch process games: 1 SELECT for catalog + concurrent crawl for missing/stale + 1 SELECT for user_libraries
        valid_raw_games = [g for g in owned_games_raw if g.get("appid")]
        all_app_ids = [g["appid"] for g in valid_raw_games]

        catalog_map: Dict[int, GameCatalog] = {}
        existing_lib_map: Dict[int, UserLibrary] = {}

        if all_app_ids:
            cat_res = await session.execute(
                select(GameCatalog).where(GameCatalog.app_id.in_(all_app_ids))
            )
            catalog_map = {c.app_id: c for c in cat_res.scalars().all()}

            lib_res = await session.execute(
                select(UserLibrary).where(
                    UserLibrary.steam_id64 == steam_id64,
                    UserLibrary.app_id.in_(all_app_ids),
                )
            )
            existing_lib_map = {l.app_id: l for l in lib_res.scalars().all()}

        # Determine which games need fresh storefront metadata
        stale_or_missing: List[Dict[str, Any]] = []
        for g_raw in valid_raw_games:
            aid = g_raw["appid"]
            existing = catalog_map.get(aid)
            if existing and existing.metadata_fetched_at:
                fetched_at = existing.metadata_fetched_at
                if fetched_at.tzinfo is None:
                    fetched_at = fetched_at.replace(tzinfo=timezone.utc)
                if (now - fetched_at).days < 7:
                    continue
            stale_or_missing.append(g_raw)

        # Crawl missing/stale games concurrently instead of sequentially
        if stale_or_missing:
            async def _crawl_one(g_raw: Dict[str, Any]):
                aid = g_raw["appid"]
                details = await crawl_steam_app_details(aid, client)
                return aid, parse_app_details(aid, g_raw.get("name", ""), details)

            crawled_results = await asyncio.gather(
                *(_crawl_one(g) for g in stale_or_missing),
                return_exceptions=True,
            )
            for item in crawled_results:
                if isinstance(item, Exception):
                    logger.warning(f"Concurrent crawl failed: {item}")
                    continue
                aid, parsed = item
                existing = catalog_map.get(aid)
                if existing:
                    for key, value in parsed.items():
                        setattr(existing, key, value)
                else:
                    new_cat = GameCatalog(**parsed)
                    session.add(new_cat)
                    catalog_map[aid] = new_cat

        steam_games: List[SteamGame] = []
        for g_raw in valid_raw_games:
            app_id = g_raw["appid"]
            game_entity = catalog_map.get(app_id)
            if not game_entity:
                continue

            playtime_forever = g_raw.get("playtime_forever", 0)
            playtime_2weeks = g_raw.get("playtime_2weeks", 0)
            rtime = g_raw.get("rtime_last_played", 0)
            last_played_iso = datetime.fromtimestamp(rtime, tz=timezone.utc).isoformat() if rtime > 0 else None

            ach_unlocked, ach_total = ach_stats_map.get(app_id, (0, 0))

            lib_entry = existing_lib_map.get(app_id)
            if lib_entry:
                lib_entry.playtime_forever = playtime_forever
                lib_entry.playtime_2weeks = playtime_2weeks
                if ach_total > 0:
                    lib_entry.achievements_unlocked = ach_unlocked
                if rtime > 0:
                    lib_entry.rtime_last_played = datetime.fromtimestamp(rtime, tz=timezone.utc)
            else:
                lib_entry = UserLibrary(
                    steam_id64=steam_id64,
                    app_id=app_id,
                    playtime_forever=playtime_forever,
                    playtime_2weeks=playtime_2weeks,
                    achievements_unlocked=ach_unlocked if ach_total > 0 else 0,
                    rtime_last_played=datetime.fromtimestamp(rtime, tz=timezone.utc) if rtime > 0 else None,
                )
                session.add(lib_entry)
                existing_lib_map[app_id] = lib_entry

            if ach_total > 0 and (game_entity.achievements_total == 0 or game_entity.achievements_total != ach_total):
                game_entity.achievements_total = ach_total

            steam_games.append(
                SteamGame(
                    app_id=game_entity.app_id,
                    name=game_entity.name,
                    header_image=game_entity.header_image,
                    capsule_image=game_entity.capsule_image,
                    poster_image=game_entity.poster_image,
                    price_initial_idr=game_entity.price_initial_idr,
                    price_final_idr=game_entity.price_final_idr,
                    discount_percent=game_entity.discount_percent,
                    playtime_forever=playtime_forever,
                    playtime_2weeks=playtime_2weeks,
                    genres=game_entity.genres or ["Game"],
                    is_multiplayer=game_entity.is_multiplayer,
                    is_coop=game_entity.is_coop,
                    is_split_screen=game_entity.is_splitscreen,
                    has_controller_support=game_entity.has_controller_support,
                    achievements_total=ach_total if ach_total > 0 else game_entity.achievements_total,
                    achievements_unlocked=ach_unlocked if ach_total > 0 else (lib_entry.achievements_unlocked if lib_entry else 0),
                    last_played=last_played_iso,
                    estimated_completion_hours=game_entity.estimated_completion_hours,
                )
            )

        await session.commit()

        # Compute Overview
        overview = calculate_overview(steam_games)

        profile_schema = UserProfile(
            steam_id64=user.steam_id64,
            vanity_url=identifier if not identifier.isdigit() else "",
            persona_name=user.persona_name,
            real_name=user.real_name,
            avatar_url=user.avatar_url,
            profile_url=user.profile_url,
            status=user.status,
            currently_playing=user.currently_playing,
            member_since=user.member_since or "Steam Member",
            country_code=user.country_code,
        )

        return SyncResponse(
            profile=profile_schema,
            games=steam_games,
            overview=overview,
            synced_at=now.isoformat(),
            is_cached=False,
        )
