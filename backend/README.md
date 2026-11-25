# Valvix Backend Documentation

A high-performance asynchronous REST API powered by **FastAPI**, **SQLAlchemy (Async)**, and **SQLite (WAL Mode)**. Valvix analyzes Steam library telemetry, computes co-op multiplayer squad intersections, and synthesizes gamer psychological archetypes and achievement guides using **Google Gemini AI**.

---

## Architecture Overview

```
                      ┌──────────────────────────────────────┐
                      │             FastAPI App              │
                      │           (app/main.py)              │
                      └──────────────────┬───────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
      ┌─────────────────────┐                         ┌─────────────────────┐
      │   Auth & OpenID     │                         │   Core API Router   │
      │ (app/api/auth.py)   │                         │(app/api/routes.py)  │
      └──────────┬──────────┘                         └──────────┬──────────┘
                 │                                               │
                 ├───────────────────────┬───────────────────────┤
                 ▼                       ▼                       ▼
      ┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
      │    Steam Service    │ │ Achievement Service │ │   Gemini AI Service │
      │(app/services/steam) │ │(app/services/achieve│ │(app/services/gemini)│
      └──────────┬──────────┘ └──────────┬──────────┘ └──────────┬──────────┘
                 │                       │                       │
                 └───────────────────────┼───────────────────────┘
                                         ▼
                            ┌────────────────────────┐
                            │ SQLAlchemy AsyncEngine │
                            │ (SQLite WAL + 64MB Cache)
                            └────────────┬───────────┘
                                         ▼
                            ┌────────────────────────┐
                            │       valvix.db        │
                            └────────────────────────┘
```

---

## Key Capabilities

1. **Steam OpenID 2.0 Authentication**: Official cryptographic handshake redirecting to `steamcommunity.com` and validating return signatures.
2. **Library Synchronization & Store Enrichment**: Pulls owned games, playtime, and store metadata (Indonesian Rupiah pricing, tags, multiplayer modes, achievements).
3. **SQLite Write-Ahead Logging (WAL)**: Zero-cost local database deployment configured with `PRAGMA journal_mode=WAL`, `synchronous=NORMAL`, and a 64MB in-memory cache for ultra-low latency.
4. **Co-op Squad Intersection**: Computes mathematical game-set intersections between multiple Steam friends, filtering by tags (`coop`, `splitscreen`, `controller`, `pve`).
5. **Gemini AI Persona & Roast Engine**: Computes deterministic playtime hashes to synthesize psychological gaming archetypes and comedy roasts with adjustable tones (`friendly`, `playful`, `brutal`).
6. **AI Achievement Guides**: Generates structured step-by-step unlock walkthroughs with difficulty ratings and caches them in the database.

---

## Directory Structure

```
backend/
├── app/
│   ├── api/
│   │   ├── auth.py              # Steam OpenID 2.0 login & callback handlers
│   │   └── routes.py            # Core application endpoints (sync, games, coop, persona)
│   ├── core/
│   │   ├── config.py            # Pydantic v2 application settings
│   │   └── database.py          # SQLAlchemy async engine & SQLite PRAGMA hook
│   ├── models/
│   │   ├── achievement.py       # Achievement guide cache table
│   │   ├── game.py              # Master game catalog & store pricing
│   │   ├── library.py           # User-game relation, playtimes, unlock counts
│   │   ├── persona.py           # Cached AI gaming personas & roast verdicts
│   │   └── user.py              # User profiles, avatar URLs, SteamID64
│   ├── schemas/
│   │   ├── overview.py          # Library KPIs & sync response models
│   │   ├── persona.py           # AI persona & roast request/response schemas
│   │   ├── squad.py             # Squad members & co-op intersection schemas
│   │   └── steam.py             # Steam game & achievement representations
│   ├── services/
│   │   ├── achievement_service.py # Steam Community XML & API achievement parser
│   │   ├── crawler.py           # Steam Storefront JSON crawler for IDR pricing & tags
│   │   ├── gemini_service.py    # Google Gemini AI prompt generation & caching
│   │   └── steam_service.py     # Steam Web API client & overview calculator
│   └── main.py                  # FastAPI initialization, CORS, and lifespan hooks
├── .env                         # Local runtime environment variables
├── .env.example                 # Environment template
├── alembic.ini                  # Alembic migration configuration
├── requirements.txt             # Python production dependencies
└── valvix.db                    # Active SQLite database file
```

---

## Database Architecture & PRAGMA Tuning

Valvix uses **SQLite** through `aiosqlite` and `SQLAlchemy 2.0 Async`. When the application initializes, connection listeners automatically execute performance PRAGMAs:

```python
@event.listens_for(engine.sync_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")       # Concurrent readers + writers
    cursor.execute("PRAGMA synchronous=NORMAL")      # Optimal fsync balance
    cursor.execute("PRAGMA cache_size=-64000")       # 64MB in-memory cache
    cursor.execute("PRAGMA foreign_keys=ON")         # Referential integrity
    cursor.close()
```

### Entity Relationship Model

| Table | Primary Key | Key Columns | Purpose |
|---|---|---|---|
| `users` | `steam_id64` (VARCHAR) | `persona_name`, `avatar_url`, `profile_url`, `last_synced` | Stores authenticated and friend Steam profiles |
| `games_catalog` | `app_id` (INT) | `name`, `header_image`, `price_initial_idr`, `is_coop`, `genres` | Master catalog of games with regional pricing & metadata |
| `user_libraries` | Composite (`steam_id64`, `app_id`) | `playtime_forever`, `playtime_2weeks`, `achievements_unlocked` | User ownership, hours played, achievement progress |
| `ai_personas` | `id` (INT) | `steam_id64`, `telemetry_hash`, `tone`, `archetype_title`, `roast` | Caches Gemini AI personas by telemetry fingerprint |
| `achievement_guides` | `id` (INT) | `app_id`, `achievement_api_name`, `summary`, `steps`, `difficulty` | Caches Gemini AI achievement walkthroughs |

---

## API Reference

### 1. Authentication (`/api/auth`)

#### `GET /api/auth/steam/login`
Redirects the client to the official Steam OpenID 2.0 authentication portal.
- **Query Params**: None.
- **Response**: `307 Temporary Redirect` to `https://steamcommunity.com/openid/login`.

#### `GET /api/auth/steam/callback`
Validates the cryptographic return signature from Valve, resolves the SteamID64, syncs profile data, and redirects back to the frontend with session tokens.
- **Response**: `307 Temporary Redirect` to `${FRONTEND_URL}/?steamId={steamId64}&auth=success`.

---

### 2. Core Endpoints (`/api`)

#### `POST /api/sync/{identifier}`
Synchronizes the user's Steam profile, owned games list, playtime history, and storefront metadata.
- **Path Parameter**: `identifier` (SteamID64, Custom Vanity URL, or Full Profile URL).
- **Response Model**: `SyncResponse`
```json
{
  "profile": {
    "steamId64": "76561198000000001",
    "personaName": "DemoPlayer",
    "avatarUrl": "https://avatars.steamstatic.com/...",
    "profileUrl": "https://steamcommunity.com/profiles/76561198000000001",
    "status": "online"
  },
  "games": [ ... ],
  "overview": {
    "totalGames": 92,
    "totalPlaytimeHours": 2491,
    "totalLibraryValueIDR": 13115888,
    "averageCostPerHourIDR": 5265,
    "unplayedCount": 42,
    "unplayedPercentage": 45.7
  },
  "syncedAt": "2026-11-23T20:30:00Z",
  "isCached": false
}
```

#### `GET /api/users/{steam_id64}/games`
Fetches all owned games for the user enriched with catalog metadata.
- **Response**: `List[SteamGame]`

#### `GET /api/users/{steam_id64}/overview`
Returns high-level library analytics:
- Total library valuation (stored in base IDR; converted dynamically on the frontend to `USD`, `IDR`, `EUR`, `GBP`, `SGD`, `JPY`).
- Total played hours and average cost per hour.
- Unplayed "Pile of Shame" count and percentage.
- Spotlight game, Top Value game, Most Played game, and Unplayed Gem.
- **Response**: `LibraryOverview`

#### `GET /api/users/{steam_id64}/friends`
Retrieves public friends of the specified user with online status and currently playing games.
- **Response**: `List[SteamFriendItem]`

#### `POST /api/coop/intersect`
Calculates shared multiplayer games across selected squad members.
- **Request Body**:
```json
{
  "steamIds": ["76561198000000001", "76561198000000002"],
  "filterTag": "coop"
}
```
- **Supported `filterTag` options**: `"all"`, `"coop"`, `"splitscreen"`, `"controller"`, `"pve"`.
- **Response**: `CoopIntersectionResponse`

#### `GET /api/games/{app_id}/achievements/{steam_id64}`
Retrieves player unlock progress, unlock timestamps, and global rarity percentages for a game.
- **Response**: `List[GameAchievement]`

#### `POST /api/achievements/guide`
Generates or fetches cached AI walkthroughs for unlocking a specific achievement.
- **Request Body**:
```json
{
  "appId": 307690,
  "achievementApiName": "CHIEF_INSPECTOR",
  "name": "Chief Inspector",
  "description": "Complete 100% of all missions, cases, favors, events, jobs and races."
}
```
- **Response**: `GameAchievementGuide`

#### `POST /api/users/{steam_id64}/persona`
Generates or retrieves a cached AI psychological archetype and comedy roast tailored to the requested tone.
- **Request Body**:
```json
{
  "tone": "playful",
  "currency": "USD",
  "forceRefresh": false
}
```
- **Supported `tone` options**: `"friendly"`, `"playful"`, `"brutal"`.
- **Supported `currency` options**: `"USD"` (default), `"IDR"`, `"EUR"`, `"GBP"`, `"SGD"`, `"JPY"`.
- **Response**: `AIPersonaData`

> For deep implementation details (batch DB sync, concurrent Steam crawling, and Gemini pipeline), see [Backend Technical Guide](../docs/BACKEND_TECH.md).

---

## Setup & Execution

### 1. Prerequisites
- Python 3.11+
- Steam Web API Key ([Get one here](https://steamcommunity.com/dev/apikey))
- Google Gemini API Key ([Google AI Studio](https://aistudio.google.com/))

### 2. Environment Configuration
Create a `.env` file in the `backend/` directory:
```env
DATABASE_URL=sqlite+aiosqlite:///./valvix.db
STEAM_API_KEY=your_steam_web_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
FRONTEND_URL=http://localhost:5173
ENVIRONMENT=development
```

### 3. Installation
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

### 4. Running the Server
```powershell
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
Interactive Swagger documentation is available at: `http://127.0.0.1:8000/docs`
