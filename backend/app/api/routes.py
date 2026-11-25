import asyncio
from typing import List
from urllib.parse import unquote
import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.user import User
from app.models.game import GameCatalog
from app.models.library import UserLibrary
from app.schemas.steam import (
    SteamGame,
    GameAchievement,
    GameAchievementGuide,
    AchievementGuideRequest,
)
from app.schemas.overview import LibraryOverview, SyncResponse
from app.schemas.squad import (
    SquadMember,
    SteamFriendItem,
    CoopIntersectionRequest,
    CoopIntersectionResponse,
)
from app.schemas.persona import AIPersonaData, PersonaRequest
from app.services.steam_service import (
    sync_user_library,
    calculate_overview,
    fetch_player_summaries,
    fetch_user_friends,
    resolve_steam_identifier,
)
from app.services.achievement_service import fetch_game_achievements
from app.services.gemini_service import (
    get_or_generate_achievement_guide,
    get_or_generate_persona,
)

router = APIRouter(prefix="/api", tags=["Valvix API"])


@router.post("/sync/{identifier:path}", response_model=SyncResponse)
async def sync_profile(identifier: str, db: AsyncSession = Depends(get_db)):
    """
    Syncs Steam profile, owned games, and store metadata for the given SteamID64, profile URL, or vanity name.
    """
    clean_identifier = unquote(identifier).strip()
    if not clean_identifier:
        raise HTTPException(status_code=400, detail="Steam identifier cannot be empty.")

    try:
        return await sync_user_library(clean_identifier, db)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to sync Steam library: {str(exc)}")


def _to_steam_game(lib: UserLibrary, game: GameCatalog) -> SteamGame:
    """Maps a (UserLibrary, GameCatalog) ORM pair to the SteamGame response schema."""
    return SteamGame(
        app_id=game.app_id,
        name=game.name,
        header_image=game.header_image,
        capsule_image=game.capsule_image,
        poster_image=game.poster_image,
        price_initial_idr=game.price_initial_idr,
        price_final_idr=game.price_final_idr,
        discount_percent=game.discount_percent,
        playtime_forever=lib.playtime_forever,
        playtime_2weeks=lib.playtime_2weeks,
        genres=game.genres or [],
        is_multiplayer=game.is_multiplayer,
        is_coop=game.is_coop,
        is_split_screen=game.is_splitscreen,
        has_controller_support=game.has_controller_support,
        achievements_total=game.achievements_total,
        achievements_unlocked=lib.achievements_unlocked,
        last_played=lib.rtime_last_played.isoformat() if lib.rtime_last_played else None,
        estimated_completion_hours=game.estimated_completion_hours,
    )


async def _load_user_games(steam_id64: str, db: AsyncSession) -> List[SteamGame]:
    """Loads a user's library from DB, triggering a Steam sync if not yet cached."""
    async with httpx.AsyncClient() as client:
        resolved_id = await resolve_steam_identifier(steam_id64, client)

    stmt = (
        select(UserLibrary, GameCatalog)
        .join(GameCatalog, UserLibrary.app_id == GameCatalog.app_id)
        .where(UserLibrary.steam_id64 == resolved_id)
    )
    result = await db.execute(stmt)
    rows = result.all()

    if not rows:
        sync_result = await sync_user_library(resolved_id, db)
        return sync_result.games

    return [_to_steam_game(lib, game) for lib, game in rows]


@router.get("/users/{steam_id64}/overview", response_model=LibraryOverview)
async def get_user_overview(steam_id64: str, db: AsyncSession = Depends(get_db)):
    """
    Returns aggregated library overview KPIs and highlights for a user.
    """
    games = await _load_user_games(steam_id64, db)
    return calculate_overview(games)


@router.get("/users/{steam_id64}/games", response_model=List[SteamGame])
async def get_user_games(steam_id64: str, db: AsyncSession = Depends(get_db)):
    """
    Returns full list of games owned by the user with catalog metadata and playtimes.
    """
    return await _load_user_games(steam_id64, db)


@router.get("/users/{steam_id64}/friends", response_model=List[SteamFriendItem])
async def get_user_friends(steam_id64: str):
    """
    Returns the real list of Steam friends for a user with their persona name, avatar,
    online/in-game status, and currently playing game.
    """
    async with httpx.AsyncClient() as client:
        resolved_id = await resolve_steam_identifier(steam_id64, client)
        friends = await fetch_user_friends(resolved_id, client)
    return friends


# ---------------------------------------------------------------------------
# 2. Co-op Squad Matcher (Dual Endpoint: /coop/intersect & /squad/intersect)
# ---------------------------------------------------------------------------

@router.post("/coop/intersect", response_model=CoopIntersectionResponse)
@router.post("/squad/intersect", response_model=CoopIntersectionResponse)
async def calculate_coop_intersection(
    payload: CoopIntersectionRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Calculates the exact SQL intersection of shared games owned by all provided squad members.
    Supports tag filtering (coop_only, local_coop, controller_support).
    """
    raw_ids = payload.steam_ids
    if not raw_ids:
        raise HTTPException(status_code=400, detail="Must provide at least one steamId.")

    # 1. Resolve all identifiers concurrently
    resolved_ids: List[str] = []
    async with httpx.AsyncClient() as client:
        resolved_batch = await asyncio.gather(
            *(resolve_steam_identifier(rid, client) for rid in raw_ids)
        )
        for sid in resolved_batch:
            if sid not in resolved_ids:
                resolved_ids.append(sid)

    members: List[SquadMember] = []
    member_game_sets: List[set] = []
    member_playtime_maps: List[dict] = []
    member_achievements_maps: List[dict] = []

    # 2. Collect library data for each resolved member
    for sid in resolved_ids:
        stmt = (
            select(UserLibrary, GameCatalog)
            .join(GameCatalog, UserLibrary.app_id == GameCatalog.app_id)
            .where(UserLibrary.steam_id64 == sid)
        )
        res = await db.execute(stmt)
        rows = res.all()

        if not rows:
            # Sync user if missing in DB
            sync_res = await sync_user_library(sid, db)
            owned_ids = [g.app_id for g in sync_res.games]
            playtimes = {g.app_id: g.playtime_forever for g in sync_res.games}
            achievements = {g.app_id: g.achievements_unlocked for g in sync_res.games}
            user_name = sync_res.profile.persona_name
            user_avatar = sync_res.profile.avatar_url
        else:
            u_stmt = select(User).where(User.steam_id64 == sid)
            u_res = await db.execute(u_stmt)
            u = u_res.scalar_one_or_none()
            user_name = u.persona_name if u else f"Player_{sid[-4:]}"
            user_avatar = u.avatar_url if u else ""
            owned_ids = [lib.app_id for lib, _ in rows]
            playtimes = {lib.app_id: lib.playtime_forever for lib, _ in rows}
            achievements = {lib.app_id: lib.achievements_unlocked for lib, _ in rows}

        members.append(
            SquadMember(
                steam_id64=sid,
                persona_name=user_name,
                avatar_url=user_avatar,
                owned_app_ids=owned_ids,
                playtimes=playtimes,
            )
        )
        member_game_sets.append(set(owned_ids))
        member_playtime_maps.append(playtimes)
        member_achievements_maps.append(achievements)

    # 3. Intersect owned AppIDs
    if not member_game_sets:
        common_app_ids = set()
    else:
        common_app_ids = set.intersection(*member_game_sets)

    if not common_app_ids:
        return CoopIntersectionResponse(members=members, intersected_games=[], total_shared_games=0)

    # 4. Fetch catalog details for intersected games
    stmt_games = select(GameCatalog).where(GameCatalog.app_id.in_(list(common_app_ids)))
    res_games = await db.execute(stmt_games)
    catalog_games = res_games.scalars().all()

    # 5. Filter by tag
    tag = (payload.filter_tag or "all").lower()
    intersected_list: List[SteamGame] = []

    for cg in catalog_games:
        # Squad game-night filter: only include multiplayer or co-op eligible titles
        if not (cg.is_coop or cg.is_multiplayer):
            continue

        if tag in ["coop", "coop_only", "online_coop"] and not cg.is_coop:
            continue
        if tag in ["splitscreen", "local_coop", "split_screen"] and not cg.is_splitscreen:
            continue
        if tag in ["controller", "controller_support"] and not cg.has_controller_support:
            continue
        if tag in ["pve"] and not (cg.is_coop or any(g.lower() in ["action", "shooter", "rpg", "survival", "adventure"] for g in (cg.genres or []))):
            continue

        p_forever = member_playtime_maps[0].get(cg.app_id, 0) if member_playtime_maps else 0
        p_ach_unlocked = member_achievements_maps[0].get(cg.app_id, 0) if member_achievements_maps else 0

        intersected_list.append(
            SteamGame(
                app_id=cg.app_id,
                name=cg.name,
                header_image=cg.header_image,
                capsule_image=cg.capsule_image,
                poster_image=cg.poster_image,
                price_initial_idr=cg.price_initial_idr,
                price_final_idr=cg.price_final_idr,
                discount_percent=cg.discount_percent,
                playtime_forever=p_forever,
                playtime_2weeks=0,
                genres=cg.genres or [],
                is_multiplayer=cg.is_multiplayer,
                is_coop=cg.is_coop,
                is_split_screen=cg.is_splitscreen,
                has_controller_support=cg.has_controller_support,
                achievements_total=cg.achievements_total,
                achievements_unlocked=p_ach_unlocked,
                estimated_completion_hours=cg.estimated_completion_hours,
            )
        )

    return CoopIntersectionResponse(
        members=members,
        intersected_games=intersected_list,
        total_shared_games=len(intersected_list),
    )


# ---------------------------------------------------------------------------
# 3. Achievement Tracker & AI Guides
# ---------------------------------------------------------------------------

@router.get("/games/{app_id}/achievements/{steam_id64}", response_model=List[GameAchievement])
async def get_game_achievements(
    app_id: int,
    steam_id64: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Fetches full game achievement list with player unlock progress, global rarity percent,
    and attached AI unlock guides.
    """
    async with httpx.AsyncClient() as client:
        resolved_id = await resolve_steam_identifier(steam_id64, client)
        achievements = await fetch_game_achievements(app_id, resolved_id, db, client)
    return achievements


@router.post("/achievements/guide", response_model=GameAchievementGuide)
async def get_achievement_guide(
    payload: AchievementGuideRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Returns AI-generated unlock guide for an achievement (checks database cache first).
    """
    guide = await get_or_generate_achievement_guide(
        app_id=payload.app_id,
        achievement_api_name=payload.achievement_api_name,
        name=payload.name,
        description=payload.description or "",
        session=db,
    )
    return guide


# ---------------------------------------------------------------------------
# 4. AI Gaming Persona & Roast Generator
# ---------------------------------------------------------------------------

@router.post("/users/{steam_id64}/persona", response_model=AIPersonaData)
async def generate_user_persona(
    steam_id64: str,
    payload: PersonaRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Generates or retrieves cached AI persona archetype and comedy roast tailored to requested tone.
    """
    async with httpx.AsyncClient() as client:
        resolved_id = await resolve_steam_identifier(steam_id64, client)

    persona = await get_or_generate_persona(
        steam_id64=resolved_id,
        tone=payload.tone,
        force_refresh=payload.force_refresh,
        session=db,
        currency=payload.currency,
    )
    return persona
