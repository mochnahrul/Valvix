# Valvix — Backend Technical Documentation

## 1. Tech Stack & Runtime
- **Framework**: FastAPI (`app/main.py`)
- **ORM & DB**: SQLAlchemy 2.0 Async + `aiosqlite` (SQLite WAL mode) / `asyncpg` (PostgreSQL)
- **Validation**: Pydantic v2 (`CamelModel` base class for automatic `snake_case` ↔ `camelCase` JSON aliasing)
- **HTTP Client**: `httpx.AsyncClient`
- **AI SDK**: `google-genai` (`gemini-2.5-flash`)

---

## 2. Directory & Module Breakdown

```text
backend/app/
├── main.py                     # FastAPI app, CORS middleware, lifespan DB init, /health
├── core/
│   ├── config.py               # Pydantic BaseSettings (.env loader & DB URL normalizer)
│   └── database.py             # AsyncEngine, SQLite WAL PRAGMA listener, get_db dependency
├── models/
│   ├── user.py                 # User (steam_id64 PK, persona_name, avatar_url, country_code, etc.)
│   ├── game.py                 # GameCatalog (app_id PK, prices, genres, is_coop, is_multiplayer, etc.)
│   ├── library.py              # UserLibrary (steam_id64 + app_id, playtime_forever, achievements_unlocked)
│   ├── persona.py              # AIPersona (steam_id64, tone, library_hash, persona_json)
│   └── achievement.py          # AchievementGuide (app_id, achievement_api_name, summary, steps, difficulty)
├── schemas/
│   ├── steam.py                # CamelModel, SteamGame, UserProfile, GameAchievement, GameAchievementGuide
│   ├── overview.py             # LibraryOverview, SyncResponse
│   ├── squad.py                # SquadMember, SteamFriendItem, CoopIntersectionRequest/Response
│   └── persona.py              # PersonaRequest, AIPersonaLLMOutput, AIPersonaData, TelemetrySnapshot
├── api/
│   ├── auth.py                 # Steam OpenID 2.0 login/callback & /api/auth/connect
│   └── routes.py               # Core REST endpoints (/sync, /users/*, /coop/intersect, /games/*, /achievements/*)
└── services/
    ├── steam_service.py        # Identifier resolution, Steam Web API client, batch sync, overview calculator
    ├── crawler.py              # Steam Storefront appdetails crawler with Semaphore(4) & 429 backoff
    ├── achievement_service.py  # Concurrent 3-way achievement fetch (Schema + Player + Global Rarity)
    └── gemini_service.py       # Gemini 2.5 Flash persona & achievement guide generators + DB caching
```

---

## 3. Database & Latency Optimizations

### A. SQLite WAL Tuning (`core/database.py`)
Every SQLite connection executes:
- `PRAGMA journal_mode=WAL` — Allows concurrent reads while writing.
- `PRAGMA synchronous=NORMAL` — Reduces disk fsync overhead safely in WAL mode.
- `PRAGMA cache_size=-64000` — Allocates a 64MB in-memory page cache.
- `PRAGMA foreign_keys=ON` — Enforces referential integrity.

### B. Batch Sync Pipeline (`services/steam_service.py`)
`sync_user_library` avoids N+1 query patterns:
1. Resolves identifier (`SteamID64`, profile URL, or vanity name via `ISteamUser/ResolveVanityURL/v1`).
2. Fetches profile summary and owned games (`IPlayerService/GetOwnedGames/v1`).
3. Fetches achievement counts for played games concurrently (`Semaphore(10)`).
4. Executes **1 batch `SELECT`** on `GameCatalog` (`app_id IN (...)`) and **1 batch `SELECT`** on `UserLibrary`.
5. Crawls only missing or stale (`>= 7 days`) Storefront entries **concurrently** via `asyncio.gather` + `STORE_SEMAPHORE = asyncio.Semaphore(4)`.
6. Upserts all `GameCatalog` and `UserLibrary` records in memory and issues **1 `session.commit()`**.

### C. Concurrent Achievement Fetching (`services/achievement_service.py`)
`fetch_game_achievements` fires `GetSchemaForGame/v2`, `GetPlayerAchievements/v1`, and `GetGlobalAchievementPercentagesForApp/v2` in parallel with `asyncio.gather(..., return_exceptions=True)`, cutting drawer load latency ~3x.

### D. Overview & Valuation Consistency (`calculate_overview`)
- Uses `price_initial_idr or price_final_idr or 0` for library valuation, matching the frontend's retail valuation logic.
- Computes `average_cost_per_hour_idr` using exact `total_minutes / 60.0` (avoiding rounding small playtimes to `0.0`).

---

## 4. AI Services (`services/gemini_service.py`)

### A. AI Persona & Roast (`get_or_generate_persona`)
- **Currency-Aware Prompting**: Converts monetary metrics into the requested `currency` (`USD`, `IDR`, `EUR`, `GBP`, `SGD`, `JPY`) via `_format_currency` before building the prompt and fallback strings.
- **Telemetry Hash**: `SHA-256(steam_id64:tone:currency:total_games:total_hours:unplayed_count:top_games)`.
- **Lean LLM Schema**: Requests `AIPersonaLLMOutput` (`archetypeTitle`, `playstyleSummary`, `strengths`, `comedyRoast`) from `gemini-2.5-flash` via `asyncio.to_thread(...)` so the FastAPI event loop is never blocked.
- **Safe Caching**: Only writes to `ai_personas` when live AI generation succeeds (or when `GEMINI_API_KEY` is intentionally unset), preventing temporary API errors from poisoning the cache.

### B. Achievement Unlock Guides (`get_or_generate_achievement_guide`)
- Looks up `GameCatalog.name` by `app_id` so the prompt includes the game's actual title alongside `app_id`.
- Offloads `client.models.generate_content` to `asyncio.to_thread(...)` with `response_schema=GameAchievementGuide`.
- Caches results in `achievement_guides`.

---

## 5. API Endpoints Summary

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service & DB health check |
| `GET` | `/api/auth/steam/login` | Redirect to Steam OpenID 2.0 |
| `GET` | `/api/auth/steam/callback` | Verify OpenID signature & sync user |
| `POST` | `/api/auth/connect` | Direct Steam identifier connect |
| `POST` | `/api/sync/{identifier}` | Full profile & library sync |
| `GET` | `/api/users/{steam_id64}/overview` | Aggregated `LibraryOverview` KPIs |
| `GET` | `/api/users/{steam_id64}/games` | User's enriched `List[SteamGame]` |
| `GET` | `/api/users/{steam_id64}/friends` | Public Steam friends list |
| `POST` | `/api/coop/intersect` | Shared multiplayer games across squad |
| `GET` | `/api/games/{app_id}/achievements/{steam_id64}` | Achievement list, rarity, & progress |
| `POST` | `/api/achievements/guide` | Cached or Gemini-generated unlock guide |
| `POST` | `/api/users/{steam_id64}/persona` | AI persona & roast (`tone`, `currency`, `forceRefresh`) |

---

## 6. Verification
```powershell
cd backend
.\.venv\Scripts\python.exe -m py_compile app\main.py app\api\routes.py app\services\steam_service.py app\services\achievement_service.py app\services\gemini_service.py app\services\crawler.py
.\.venv\Scripts\python.exe test_api.py
```
