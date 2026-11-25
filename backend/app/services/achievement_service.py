import asyncio
import logging
from datetime import datetime, timezone
from typing import List
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import settings
from app.models.achievement import AchievementGuide
from app.models.library import UserLibrary
from app.models.game import GameCatalog
from app.schemas.steam import GameAchievement, GameAchievementGuide

logger = logging.getLogger(__name__)

STEAM_API_BASE = "https://api.steampowered.com"

# Prominent mock achievement data for offline or demo testing
BG3_ACHIEVEMENTS_MOCK = [
    {
        "id": "bg3_1",
        "name": "Descent From Avernus",
        "description": "Take control of the Nautiloid and escape the fiery hells of Avernus.",
        "iconUrl": "https://cdn.akamai.steamstatic.com/steamcommunity/public/images/apps/1086940/3e954efb5ef664a780b68636b0f209633e9d40a0.jpg",
        "unlocked": True,
        "unlockTime": "2024-01-12",
        "isHidden": False,
        "rarityPercent": 92.4,
    },
    {
        "id": "bg3_2",
        "name": "Leave No One Behind",
        "description": "Save all the Tiefling refugees throughout the entire game in a single playthrough.",
        "iconUrl": "https://cdn.akamai.steamstatic.com/steamcommunity/public/images/apps/1086940/737cf6c3eecadba86d22fc0b471feecab3eec34b.jpg",
        "unlocked": False,
        "isHidden": False,
        "rarityPercent": 6.8,
        "aiGuide": {
            "summary": "Requires meticulous side-quest completion across Acts 1, 2, and 3 without letting any Tiefling NPC perish.",
            "difficulty": "Hard",
            "steps": [
                "Act 1: Kill the 3 Goblin leaders without triggering a raid on Emerald Grove. Save Arabella from Kagha and Mirkon from the Harpies.",
                "Act 2: Protect Isobel at Last Light Inn so no refugees turn undead. Free the Tieflings from Moonrise Towers prison before dealing with Nightsong.",
                "Act 3: In the Lower City, rescue Bex and Danis, and speak to Rolan in Sorcerous Sundries after defeating Lorroakan."
            ]
        }
    },
    {
        "id": "bg3_3",
        "name": "Critical Hit",
        "description": "Complete the game on Tactician or Honour difficulty mode.",
        "iconUrl": "https://cdn.akamai.steamstatic.com/steamcommunity/public/images/apps/1086940/2db1e2e1e35fae16d0046fc610c3b879ecaa26db.jpg",
        "unlocked": False,
        "isHidden": False,
        "rarityPercent": 4.1,
        "aiGuide": {
            "summary": "High difficulty challenge requiring optimized party composition, barrelmancy or crowd-control synergies, and long rest buffs.",
            "difficulty": "Hard",
            "steps": [
                "Run an Open Hand Monk + Tavern Brawler or a Paladin/Sorcerer multiclass for supreme single-target burst.",
                "Always trigger surprise rounds by initiating combat from stealth or using Shovel / Imp summons.",
                "Stockpile potions of Speed and Hill Giant Strength to dominate initiative rolls."
            ]
        }
    },
    {
        "id": "bg3_4",
        "name": "Mind Blown",
        "description": "Romance the Emperor and fulfill his illithid desires.",
        "iconUrl": "https://cdn.akamai.steamstatic.com/steamcommunity/public/images/apps/1086940/2e8790bcfc704780517830b5035f8fc35c6ad978.jpg",
        "unlocked": True,
        "unlockTime": "2024-02-18",
        "isHidden": True,
        "rarityPercent": 18.2,
    },
    {
        "id": "bg3_5",
        "name": "Sins of the Father",
        "description": "Claim the Netherbrain in the name of Bhaal and conquer Toril.",
        "iconUrl": "https://cdn.akamai.steamstatic.com/steamcommunity/public/images/apps/1086940/d4508eec9b1c7abfcb5ae59685040fbc387063ae.jpg",
        "unlocked": False,
        "isHidden": True,
        "rarityPercent": 3.5,
        "aiGuide": {
            "summary": "Dark Urge origin exclusive ending where you embrace your Bhaalist destiny.",
            "difficulty": "Medium",
            "steps": [
                "Play as the Dark Urge origin character.",
                "Defeat Orin the Red in the Temple of Bhaal and accept Bhaal's gift when Father prompts you.",
                "After defeating the Netherbrain at the final summit, choose to betray your companions and claim the Crown."
            ]
        }
    },
    {
        "id": "bg3_6",
        "name": "Busker",
        "description": "Earn 100 gold playing music across your adventure.",
        "iconUrl": "https://cdn.akamai.steamstatic.com/steamcommunity/public/images/apps/1086940/3e954efb5ef664a780b68636b0f209633e9d40a0.jpg",
        "unlocked": True,
        "unlockTime": "2024-01-20",
        "isHidden": False,
        "rarityPercent": 24.8,
    }
]

CYBERPUNK_ACHIEVEMENTS_MOCK = [
    {
        "id": "cp_1",
        "name": "The Fool",
        "description": "Become a mercenary and survive the Konpeki Plaza heist.",
        "iconUrl": "https://cdn.akamai.steamstatic.com/steamcommunity/public/images/apps/1091500/b02c8e3bf5d4750a9fcce89626e25dc9e05f6ce8.jpg",
        "unlocked": True,
        "unlockTime": "2023-10-04",
        "isHidden": False,
        "rarityPercent": 78.5,
    },
    {
        "id": "cp_2",
        "name": "Ten out of Ten",
        "description": "Reach the maximum level in any single skill attribute.",
        "iconUrl": "https://cdn.akamai.steamstatic.com/steamcommunity/public/images/apps/1091500/d5fceca113e73dbd636ee1dbe599e67d26ef6df0.jpg",
        "unlocked": True,
        "unlockTime": "2023-11-15",
        "isHidden": False,
        "rarityPercent": 22.1,
    },
    {
        "id": "cp_3",
        "name": "Rough Landing",
        "description": "While Berserk cyberware is active, perform a Superhero Landing to eliminate or incapacitate 2 enemies.",
        "iconUrl": "https://cdn.akamai.steamstatic.com/steamcommunity/public/images/apps/1091500/94b4cf5eb9ea580ef1d22227d825c786ef7ee0df.jpg",
        "unlocked": False,
        "isHidden": False,
        "rarityPercent": 11.4,
        "aiGuide": {
            "summary": "Requires Militech Berserk cyberware and a double jump over clustered street thugs.",
            "difficulty": "Easy",
            "steps": [
                "Visit any Ripperdoc and equip Tier 4+ Berserk operating system.",
                "Locate a tight cluster of 2-3 gangers in Pacifica or Watson.",
                "Activate Berserk (E), jump from a crate or fire escape, and hit primary attack mid-air above them."
            ]
        }
    }
]


async def fetch_game_achievements(
    app_id: int,
    steam_id64: str,
    session: AsyncSession,
    client: httpx.AsyncClient,
) -> List[GameAchievement]:
    """
    Fetches full achievement list for a game, merging schema names, icons, player unlock state,
    global rarity percentages, and cached AI unlock guides.
    """
    achievements: List[GameAchievement] = []

    # If Steam API Key is available, query real Steam Web APIs concurrently
    if settings.STEAM_API_KEY:
        try:
            schema_url = f"{STEAM_API_BASE}/ISteamUserStats/GetSchemaForGame/v2/"
            schema_params = {"key": settings.STEAM_API_KEY, "appid": app_id, "l": "english"}

            player_url = f"{STEAM_API_BASE}/ISteamUserStats/GetPlayerAchievements/v1/"
            player_params = {"key": settings.STEAM_API_KEY, "steamid": steam_id64, "appid": app_id, "l": "english"}

            global_url = f"{STEAM_API_BASE}/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/"
            global_params = {"gameid": app_id}

            schema_res, player_res, global_res = await asyncio.gather(
                client.get(schema_url, params=schema_params, timeout=8.0),
                client.get(player_url, params=player_params, timeout=8.0),
                client.get(global_url, params=global_params, timeout=8.0),
                return_exceptions=True,
            )

            if not isinstance(schema_res, Exception) and schema_res.status_code == 200:
                schema_data = (schema_res.json() or {}).get("game", {}).get("availableGameStats", {}).get("achievements") or []

                player_map = {}
                unlocked_count = 0
                if not isinstance(player_res, Exception) and player_res.status_code == 200:
                    player_data = (player_res.json() or {}).get("playerstats", {}).get("achievements") or []
                    player_map = {p.get("apiname"): p for p in player_data}
                    unlocked_count = sum(1 for p in player_data if p.get("achieved") == 1)

                    # Persist actual unlocked achievement counts to user_libraries and catalog
                    try:
                        stmt_lib = select(UserLibrary).where(
                            UserLibrary.steam_id64 == steam_id64,
                            UserLibrary.app_id == app_id
                        )
                        lib_res = await session.execute(stmt_lib)
                        lib_entry = lib_res.scalar_one_or_none()
                        if lib_entry:
                            lib_entry.achievements_unlocked = unlocked_count

                        stmt_cat = select(GameCatalog).where(GameCatalog.app_id == app_id)
                        cat_res = await session.execute(stmt_cat)
                        cat_entry = cat_res.scalar_one_or_none()
                        if cat_entry and len(schema_data) > 0:
                            cat_entry.achievements_total = len(schema_data)

                        await session.commit()
                    except Exception as db_exc:
                        logger.warning(f"Could not persist achievement counts to DB: {db_exc}")

                rarity_map = {}
                if not isinstance(global_res, Exception) and global_res.status_code == 200:
                    pct_data = global_res.json().get("achievementpercentages", {}).get("achievements", [])
                    rarity_map = {pct.get("name"): round(float(pct.get("percent", 0.0)), 1) for pct in pct_data}

                for s_ach in schema_data:
                    api_name = s_ach.get("name")
                    p_info = player_map.get(api_name, {})
                    is_unlocked = p_info.get("achieved") == 1
                    unlock_ts = p_info.get("unlocktime", 0)
                    unlock_time = (
                        datetime.fromtimestamp(unlock_ts, tz=timezone.utc).strftime("%Y-%m-%d")
                        if is_unlocked and unlock_ts > 0
                        else None
                    )

                    icon_url = s_ach.get("icon") if is_unlocked else (s_ach.get("icongray") or s_ach.get("icon"))

                    achievements.append(
                        GameAchievement(
                            id=api_name,
                            name=s_ach.get("displayName") or api_name,
                            description=s_ach.get("description") or "",
                            icon_url=icon_url or f"https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{app_id}/header.jpg",
                            unlocked=is_unlocked,
                            unlock_time=unlock_time,
                            is_hidden=s_ach.get("hidden") == 1,
                            rarity_percent=rarity_map.get(api_name, 15.0),
                            ai_guide=None,
                        )
                    )
        except Exception as exc:
            logger.warning(f"Error fetching live achievements for app {app_id}: {exc}")

    # Fallback to authentic mock achievements ONLY if live fetch returned empty and no API key or total failure
    if not achievements and not settings.STEAM_API_KEY:
        if app_id == 1086940:
            achievements = [GameAchievement.model_validate(a) for a in BG3_ACHIEVEMENTS_MOCK]
        elif app_id == 1091500:
            achievements = [GameAchievement.model_validate(a) for a in CYBERPUNK_ACHIEVEMENTS_MOCK]
        else:
            # Generate generic achievements for other games
            achievements = [
                GameAchievement(
                    id=f"ach_{app_id}_{i}",
                    name=f"Trophy #{i + 1}",
                    description=f"Complete quest milestone or challenge #{i + 1}.",
                    icon_url=f"https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{app_id}/header.jpg",
                    unlocked=(i % 2 == 0),
                    unlock_time="2024-03-15" if (i % 2 == 0) else None,
                    is_hidden=(i == 3),
                    rarity_percent=round(100.0 / (i + 2), 1),
                    ai_guide=None,
                )
                for i in range(5)
            ]

    # Query DB for cached AI Guides for these achievements
    stmt = select(AchievementGuide).where(AchievementGuide.app_id == app_id)
    res = await session.execute(stmt)
    db_guides = {g.achievement_api_name: g for g in res.scalars().all()}

    for ach in achievements:
        if ach.id in db_guides:
            g = db_guides[ach.id]
            ach.ai_guide = GameAchievementGuide(
                summary=g.guide_summary or "Community verified guide.",
                steps=g.guide_steps or [],
                difficulty=g.difficulty or "Medium",
            )

    return achievements
