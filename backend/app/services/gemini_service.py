import asyncio
import uuid
import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.core.config import settings
from app.models.user import User
from app.models.game import GameCatalog
from app.models.library import UserLibrary
from app.models.achievement import AchievementGuide
from app.models.persona import AIPersona
from app.schemas.steam import GameAchievementGuide
from app.schemas.persona import AIPersonaData, AIPersonaLLMOutput, GenreDominance, TelemetrySnapshot

logger = logging.getLogger(__name__)

CURRENCY_CONFIG: Dict[str, Dict[str, Any]] = {
    "USD": {"symbol": "$", "rate": 1 / 16000.0, "decimals": 2},
    "IDR": {"symbol": "Rp ", "rate": 1.0, "decimals": 0},
    "EUR": {"symbol": "€", "rate": 1 / 17200.0, "decimals": 2},
    "GBP": {"symbol": "£", "rate": 1 / 20200.0, "decimals": 2},
    "SGD": {"symbol": "S$", "rate": 1 / 11900.0, "decimals": 2},
    "JPY": {"symbol": "¥", "rate": 1 / 105.0, "decimals": 0},
}


def _format_currency(amount_idr: int, currency: str = "USD") -> str:
    code = currency.upper() if currency and currency.upper() in CURRENCY_CONFIG else "USD"
    cfg = CURRENCY_CONFIG[code]
    if not amount_idr or amount_idr <= 0:
        return "Free"
    converted = amount_idr * cfg["rate"]
    if cfg["decimals"] == 0 or converted >= 100:
        return f"{cfg['symbol']}{round(converted):,}"
    return f"{cfg['symbol']}{converted:,.2f}"


# ---------------------------------------------------------------------------
# 1. AI Achievement Unlock Guide Generator
# ---------------------------------------------------------------------------

async def get_or_generate_achievement_guide(
    app_id: int,
    achievement_api_name: str,
    name: str,
    description: str,
    session: AsyncSession,
) -> GameAchievementGuide:
    """
    Checks DB cache for an existing AI unlock guide. On cache miss, calls Google Gemini API
    to generate structured steps and difficulty rating, persisting it in achievement_guides.
    """
    # 1. Check database cache
    stmt = select(AchievementGuide).where(
        AchievementGuide.app_id == app_id,
        AchievementGuide.achievement_api_name == achievement_api_name,
    )
    res = await session.execute(stmt)
    cached = res.scalar_one_or_none()

    if cached and cached.guide_summary and cached.guide_steps:
        return GameAchievementGuide(
            summary=cached.guide_summary,
            steps=cached.guide_steps,
            difficulty=cached.difficulty or "Medium",
        )

    guide_result: Optional[GameAchievementGuide] = None
    is_ai_generated = False

    # Look up game name for much better LLM context
    cat_stmt = select(GameCatalog.name).where(GameCatalog.app_id == app_id)
    cat_res = await session.execute(cat_stmt)
    game_name = cat_res.scalar_one_or_none() or f"App {app_id}"

    # 2. Call Google Gemini if API Key is configured (offloaded to thread so event loop stays responsive)
    if settings.GEMINI_API_KEY:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            prompt = (
                f"Generate a clear, high-level tactical unlock guide for this Steam achievement:\n"
                f"Game: {game_name} (Steam AppID: {app_id})\n"
                f"Achievement Name: {name} (API ID: {achievement_api_name})\n"
                f"Description: {description or 'Secret/Hidden Achievement'}\n"
            )

            system_instruction = (
                "You are an expert PC gaming guide author and speedrunner. "
                "Provide a concise 1-sentence summary, 2 to 4 actionable bullet-point steps, "
                "and a difficulty rating strictly chosen from: 'Easy', 'Medium', or 'Hard'."
            )

            response = await asyncio.to_thread(
                client.models.generate_content,
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=GameAchievementGuide,
                    system_instruction=system_instruction,
                ),
            )

            if response.text:
                guide_result = GameAchievementGuide.model_validate_json(response.text)
                is_ai_generated = True
        except Exception as exc:
            logger.warning(f"Gemini API call failed for achievement guide: {exc}")

    # 3. High-quality contextual fallback if offline or no API key
    if not guide_result:
        # Determine fallback difficulty based on description clues
        desc_lower = (description or "").lower()
        if any(w in desc_lower for w in ["honour", "tactician", "all", "100%", "without dying", "insane", "hard"]):
            diff = "Hard"
        elif any(w in desc_lower for w in ["find", "complete", "craft", "level"]):
            diff = "Medium"
        else:
            diff = "Easy"

        summary = (
            f"Requires completing specific objectives for '{name}'."
            if not description
            else f"Focus on satisfying: {description}."
        )

        steps = [
            f"Ensure relevant quest or prerequisite story trigger is active for '{name}'.",
            "Prepare appropriate inventory, build attributes, or save-state backup.",
            f"Execute the core requirement: {description or 'Follow in-game prompts to trigger the event.'}",
        ]

        guide_result = GameAchievementGuide(
            summary=summary,
            steps=steps,
            difficulty=diff,
        )

    # 4. Save to achievement_guides database table only when AI generated (or no API key configured)
    if is_ai_generated or not settings.GEMINI_API_KEY:
        now = datetime.now(timezone.utc)
        if cached:
            cached.name = name
            cached.description = description
            cached.guide_summary = guide_result.summary
            cached.guide_steps = guide_result.steps
            cached.difficulty = guide_result.difficulty
            cached.updated_at = now
        else:
            new_guide = AchievementGuide(
                app_id=app_id,
                achievement_api_name=achievement_api_name,
                name=name,
                description=description,
                icon_url="",
                is_hidden=False,
                guide_summary=guide_result.summary,
                guide_steps=guide_result.steps,
                difficulty=guide_result.difficulty,
                updated_at=now,
            )
            session.add(new_guide)

        await session.commit()
    return guide_result


# ---------------------------------------------------------------------------
# 2. AI Gaming Persona & Roast Generator
# ---------------------------------------------------------------------------

async def get_or_generate_persona(
    steam_id64: str,
    tone: str,
    force_refresh: bool,
    session: AsyncSession,
    currency: str = "USD",
) -> AIPersonaData:
    """
    Computes a SHA-256 telemetry hash. Checks DB cache. On miss or force_refresh,
    generates a structured persona & roast via Google Gemini (gemini-2.5-flash).
    """
    valid_tone = tone.lower() if tone.lower() in ["friendly", "playful", "brutal"] else "playful"
    valid_currency = currency.upper() if currency and currency.upper() in CURRENCY_CONFIG else "USD"

    # Fetch user
    u_stmt = select(User).where(User.steam_id64 == steam_id64)
    u_res = await session.execute(u_stmt)
    user = u_res.scalar_one_or_none()
    user_name = user.persona_name if user else f"Player_{steam_id64[-4:]}"

    # Fetch user's library and games
    lib_stmt = (
        select(UserLibrary, GameCatalog)
        .join(GameCatalog, UserLibrary.app_id == GameCatalog.app_id)
        .where(UserLibrary.steam_id64 == steam_id64)
    )
    lib_res = await session.execute(lib_stmt)
    rows = lib_res.all()

    total_games = len(rows)
    total_minutes = sum(lib.playtime_forever for lib, _ in rows)
    exact_hours = total_minutes / 60.0
    total_hours = round(exact_hours, 1)

    unplayed_games = [g for lib, g in rows if lib.playtime_forever == 0]
    unplayed_count = len(unplayed_games)
    unplayed_pct = round((unplayed_count / total_games * 100.0), 1) if total_games > 0 else 0.0

    total_value_idr = sum((g.price_initial_idr or g.price_final_idr or 0) for _, g in rows)
    unplayed_value_idr = sum((g.price_initial_idr or g.price_final_idr or 0) for g in unplayed_games)
    avg_cost_per_hour = int(total_value_idr / exact_hours) if exact_hours > 0 else 0

    if unplayed_games:
        most_expensive_unplayed = max(unplayed_games, key=lambda g: (g.price_initial_idr or g.price_final_idr or 0))
        most_exp_price = most_expensive_unplayed.price_initial_idr or most_expensive_unplayed.price_final_idr or 0
        most_expensive_unplayed_str = f"{most_expensive_unplayed.name} ({_format_currency(most_exp_price, valid_currency)})"
    else:
        most_expensive_unplayed = None
        most_expensive_unplayed_str = "None (All games launched!)"

    # Genre calculation
    genre_counts: Dict[str, int] = {}
    for lib, g in rows:
        if lib.playtime_forever > 0 and g.genres:
            for gn in g.genres:
                genre_counts[gn] = genre_counts.get(gn, 0) + 1

    total_genre_hits = sum(genre_counts.values()) or 1
    sorted_genres = sorted(genre_counts.items(), key=lambda x: x[1], reverse=True)[:4]
    dominant_genres = [
        GenreDominance(genre=gn, percentage=round(count / total_genre_hits * 100.0, 1))
        for gn, count in sorted_genres
    ]
    if not dominant_genres:
        dominant_genres = [
            GenreDominance(genre="Action RPG", percentage=50.0),
            GenreDominance(genre="Co-op / Multiplayer", percentage=50.0),
        ]

    # Top played games
    played_rows = sorted(rows, key=lambda pair: pair[0].playtime_forever, reverse=True)[:4]
    top_games_str = ", ".join(f"{g.name} ({round(lib.playtime_forever / 60.0, 1)}h)" for lib, g in played_rows)

    # Compute SHA-256 telemetry hash (includes currency so prose matches active display currency)
    hash_payload = f"{steam_id64}:{valid_tone}:{valid_currency}:{total_games}:{total_hours}:{unplayed_count}:{top_games_str}"
    telemetry_hash = hashlib.sha256(hash_payload.encode()).hexdigest()

    # Check cache if not forcing refresh
    if not force_refresh:
        cached_stmt = select(AIPersona).where(
            AIPersona.steam_id64 == steam_id64,
            AIPersona.tone == valid_tone,
            AIPersona.library_hash == telemetry_hash,
        )
        cached_res = await session.execute(cached_stmt)
        cached_persona = cached_res.scalar_one_or_none()
        if cached_persona and cached_persona.persona_json:
            return AIPersonaData.model_validate(cached_persona.persona_json)

    telemetry_snapshot = TelemetrySnapshot(
        total_games=total_games,
        total_playtime_hours=total_hours,
        unplayed_count=unplayed_count,
        unplayed_percentage=unplayed_pct,
        total_library_value_idr=total_value_idr,
        unplayed_value_idr=unplayed_value_idr,
        average_cost_per_hour_idr=avg_cost_per_hour,
        most_expensive_unplayed=most_expensive_unplayed_str,
    )

    persona_output: Optional[AIPersonaData] = None
    is_ai_generated = False

    total_value_fmt = _format_currency(total_value_idr, valid_currency)
    unplayed_value_fmt = _format_currency(unplayed_value_idr, valid_currency)
    avg_cph_fmt = _format_currency(avg_cost_per_hour, valid_currency)

    # Call Gemini API if configured (offloaded to thread with lean AIPersonaLLMOutput schema)
    if settings.GEMINI_API_KEY:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=settings.GEMINI_API_KEY)

            system_prompts = {
                "friendly": (
                    "You are a warm, encouraging gaming companion and library archivist. "
                    "Analyze the gamer's telemetry, highlight their thoughtful appreciation of narrative and art, "
                    "and deliver a gentle, humorous ribbing about their backlog."
                ),
                "playful": (
                    "You are a witty, hilarious gaming community commentator. "
                    "Tease the player about their impulse sale purchases, hoarding unplayed Game of the Year titles, "
                    "and logging endless hours in familiar comfort games."
                ),
                "brutal": (
                    "You are a scathing, cynical gaming critic delivering a savage, scorched-earth roast of this player's Steam library. "
                    "Mercilessly roast their unplayed pile of shame, hard drive space squandering, and digital Stockholm syndrome."
                ),
            }

            user_prompt = (
                f"Analyze this Steam gamer's library telemetry and return the structured JSON gaming persona.\n"
                f"IMPORTANT: When mentioning prices or monetary values, strictly use {valid_currency} formatting as provided below.\n"
                f"Gamer Name: {user_name}\n"
                f"Tone Mode: {valid_tone.upper()}\n"
                f"Display Currency: {valid_currency}\n"
                f"Total Games Owned: {total_games}\n"
                f"Total Playtime Hours: {total_hours}h\n"
                f"Unplayed Pile of Shame: {unplayed_count} games ({unplayed_pct}%)\n"
                f"Total Library Value ({valid_currency}): {total_value_fmt}\n"
                f"Money Sitting in Unplayed Games ({valid_currency}): {unplayed_value_fmt}\n"
                f"Average Cost Per Hour ({valid_currency}): {avg_cph_fmt}/h\n"
                f"Most Expensive Unplayed Game: {most_expensive_unplayed_str}\n"
                f"Top Played Titles: {top_games_str}\n"
                f"Dominant Genres: {', '.join(f'{g.genre} ({g.percentage}%)' for g in dominant_genres)}\n"
            )

            response = await asyncio.to_thread(
                client.models.generate_content,
                model="gemini-2.5-flash",
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=AIPersonaLLMOutput,
                    system_instruction=system_prompts[valid_tone],
                ),
            )

            if response.text:
                llm_out = AIPersonaLLMOutput.model_validate_json(response.text)
                persona_output = AIPersonaData(
                    steam_id64=steam_id64,
                    telemetry_hash=telemetry_hash,
                    archetype_title=llm_out.archetype_title,
                    playstyle_summary=llm_out.playstyle_summary,
                    strengths=llm_out.strengths,
                    comedy_roast=llm_out.comedy_roast,
                    dominant_genres=dominant_genres,
                    telemetry_snapshot=telemetry_snapshot,
                    generated_at=datetime.now(timezone.utc).isoformat(),
                )
                is_ai_generated = True
        except Exception as exc:
            logger.warning(f"Gemini API call failed for persona generation: {exc}")

    # Fallback to authentic tone variations if offline or no API key / quota exhausted
    if not persona_output:
        top_played_game = played_rows[0][1].name if played_rows else "your favorite game"
        top_played_hours = round(played_rows[0][0].playtime_forever / 60.0, 1) if played_rows else 0
        second_played_game = played_rows[1][1].name if len(played_rows) > 1 else ""
        second_played_hours = round(played_rows[1][0].playtime_forever / 60.0, 1) if len(played_rows) > 1 else 0
        unplayed_game_name = most_expensive_unplayed.name if most_expensive_unplayed else "titles"
        unplayed_raw_price = (most_expensive_unplayed.price_initial_idr or most_expensive_unplayed.price_final_idr or 0) if most_expensive_unplayed else 0
        unplayed_game_price = _format_currency(unplayed_raw_price, valid_currency) if most_expensive_unplayed else _format_currency(0, valid_currency)

        fallback_titles = {
            "friendly": (
                "The Dedicated Sports & Action Loyalist"
                if any(g.genre in ["Sports", "Simulation"] for g in dominant_genres)
                else "The Thoughtful Backlog Curator"
            ),
            "playful": "The Seasonal Sale Hoarder",
            "brutal": "The High-Yield Digital Hostage Crisis",
        }
        fallback_summaries = {
            "friendly": (
                f"With over {total_hours:,.0f} hours logged and unwavering loyalty to {top_played_game} ({top_played_hours}h), "
                f"you know exactly what you love. Your {unplayed_count} untouched titles represent an ambitious future roadmap "
                f"of adventures waiting for the perfect holiday season."
            ),
            "playful": (
                f"You bought {unplayed_game_name} for {unplayed_game_price} during an emotional sale, only to log 0 minutes "
                f"and immediately retreat to the comforting embrace of {top_played_game} for {top_played_hours} hours. "
                f"Classic Steam syndrome."
            ),
            "brutal": (
                f"You have {unplayed_value_fmt} trapped in {unplayed_count} games you haven't touched for even 60 seconds. "
                f"Your library isn't a backlog—it's an active hostage crisis for your hard drive while you sink {top_played_hours} hours "
                f"into {top_played_game}."
            ),
        }
        fallback_strengths = {
            "friendly": [
                f"{top_played_game.split('™')[0].split('®')[0][:18]} Loyalist",
                f"{total_hours:,.0f}h Logged",
                "Patient Collector",
            ],
            "playful": [
                "Seasonal Sale Radar",
                "0-Minute Refund Avoider",
                f"{top_played_hours}h Comfort Pick",
            ],
            "brutal": [
                f"{unplayed_value_fmt} Backlog Tax",
                "SSD Space Squanderer",
                "Immunity to New Games",
            ],
        }
        second_game_clause = (
            f" and {second_played_hours} hours in {second_played_game}"
            if second_played_game
            else ""
        )
        fallback_roasts = {
            "friendly": (
                f"You have logged an impressive {total_hours:,.0f} hours—with {top_played_hours} hours dedicated to {top_played_game}! "
                f"However, those {unplayed_count} unplayed games worth {unplayed_value_fmt} (especially {unplayed_game_name} at {unplayed_game_price}) "
                f"are patiently wondering if you'll ever visit before your pension."
            ),
            "playful": (
                f"You spent over {unplayed_value_fmt} on {unplayed_count} games you haven't launched for 60 seconds. "
                f"You bought {unplayed_game_name} ({unplayed_game_price}) with grand ambitions, but ended up spending {top_played_hours} hours "
                f"playing {top_played_game}{second_game_clause} instead."
            ),
            "brutal": (
                f"Your Steam library isn't a collection—it's an interest-free donation to Valve Corporation. "
                f"You have {unplayed_value_fmt} across {unplayed_count} untouched titles rotting on your account, "
                f"yet you treat your PC like a {top_played_game} console machine ({top_played_hours}h logged). "
                f"{unplayed_game_name} ({unplayed_game_price}) is practically crying in the corner."
            ),
        }

        persona_output = AIPersonaData(
            steam_id64=steam_id64,
            telemetry_hash=telemetry_hash,
            archetype_title=fallback_titles[valid_tone],
            playstyle_summary=fallback_summaries[valid_tone],
            strengths=fallback_strengths[valid_tone],
            comedy_roast=fallback_roasts[valid_tone],
            dominant_genres=dominant_genres,
            telemetry_snapshot=telemetry_snapshot,
            generated_at=datetime.now(timezone.utc).isoformat(),
        )

    # Persist or update in ai_personas DB table ONLY if AI generated (or no API key configured)
    if is_ai_generated or not settings.GEMINI_API_KEY:
        now = datetime.now(timezone.utc)
        del_stmt = delete(AIPersona).where(
            AIPersona.steam_id64 == steam_id64,
            AIPersona.tone == valid_tone,
        )
        await session.execute(del_stmt)

        persona_row = AIPersona(
            id=str(uuid.uuid4()),
            steam_id64=steam_id64,
            tone=valid_tone,
            library_hash=telemetry_hash,
            persona_json=persona_output.model_dump(by_alias=True),
            created_at=now,
        )
        session.add(persona_row)
        await session.commit()

    return persona_output

    return persona_output
