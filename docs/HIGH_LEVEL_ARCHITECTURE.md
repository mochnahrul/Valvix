# Valvix — High-Level Architecture

## 1. System Purpose & Vision
**Valvix** is a Steam companion web application that turns raw Steam Web API and Storefront telemetry into:
1. **Financial & Time Valuation** — Understand total library value and cost-per-hour efficiency in any supported global currency (`USD`, `IDR`, `EUR`, `GBP`, `SGD`, `JPY`).
2. **Backlog Decisioning** — Categorize unplayed and partially played titles into actionable buckets.
3. **Multiplayer Squad Coordination** — Compute exact game intersections across multiple Steam friends.
4. **AI Telemetry Storytelling** — Generate shareable gamer archetypes, roasts, and achievement walkthroughs via Google Gemini.

---

## 2. System Architecture Diagram

```mermaid
flowchart LR
    User["Player Browser\n(React 18 + Vite)"] -->|HTTP / JSON| API["FastAPI Backend\n(app/main.py)"]
    User -->|OpenID 2.0 Redirect| SteamAuth["Steam Community\nOpenID"]
    SteamAuth -->|Callback + SteamID64| API

    subgraph Backend Services
        API --> SteamSvc["steam_service.py\n(Sync & Overview)"]
        API --> AchSvc["achievement_service.py\n(Trophy Progress)"]
        API --> GeminiSvc["gemini_service.py\n(Persona & Guides)"]
        SteamSvc --> Crawler["crawler.py\n(Storefront Metadata)"]
    end

    SteamSvc -->|GetPlayerSummaries\nGetOwnedGames\nGetFriendList| SteamWebAPI["Steam Web API"]
    AchSvc -->|GetSchemaForGame\nGetPlayerAchievements\nGetGlobalPercentages| SteamWebAPI
    Crawler -->|appdetails| SteamStore["Steam Storefront API"]
    GeminiSvc -->|generate_content\ngemini-2.5-flash| Gemini["Google Gemini API"]

    Backend Services --> DB[("SQLite WAL / PostgreSQL\nvalvix.db")]
```

---

## 3. Core Data Flows

### A. Profile & Library Sync (`POST /api/sync/{identifier}`)
1. Resolves a `SteamID64`, full Steam profile URL, or custom vanity name to a 17-digit `SteamID64`.
2. Fetches profile summary and owned games from Steam Web API.
3. Batch-queries `GameCatalog` and `UserLibrary` in 2 SQL queries (avoiding N+1 roundtrips).
4. Crawls only missing or stale (`>= 7 days`) Storefront metadata concurrently with bounded semaphore (`STORE_SEMAPHORE = 4`).
5. Fetches achievement unlock counts for played games concurrently (`Semaphore(10)`).
6. Computes `LibraryOverview` KPIs using `price_initial_idr` (falling back to `price_final_idr`) and exact playtime hours.

### B. Co-op Squad Intersection (`POST /api/coop/intersect`)
1. Resolves all selected squad `steamIds` concurrently.
2. Loads each member's `UserLibrary` from DB (auto-syncing if missing).
3. Computes the set intersection (`set.intersection`) of owned `app_id`s.
4. Filters to multiplayer/co-op titles and applies optional mode tags (`online_coop`, `local_coop`, `controller`, `pve`).

### C. AI Persona & Roast (`POST /api/users/{steam_id64}/persona`)
1. Aggregates user library telemetry (`totalGames`, `totalHours`, `unplayedCount`, `topGames`, `dominantGenres`) and formats monetary values in the user's selected display currency (`USD`, `IDR`, etc.).
2. Computes a deterministic SHA-256 `telemetry_hash` including `steamId64`, `tone`, `currency`, and library stats.
3. Returns cached `AIPersona` on hash hit; on miss (or `forceRefresh`), calls `gemini-2.5-flash` in a background thread (`asyncio.to_thread`) using a lean `AIPersonaLLMOutput` schema.
4. Persists to DB only when live AI generation succeeds (preventing temporary API outages from poisoning the cache).

### D. Multi-Currency Valuation Strategy
- **Canonical Storage**: Storefront prices are stored in `GameCatalog` as `price_initial_idr` and `price_final_idr`.
- **Display Layer**: `CurrencyContext` on the frontend defaults to `USD` (`$`) for global accessibility and converts values on the fly to `USD`, `IDR`, `EUR`, `GBP`, `SGD`, or `JPY` using `CURRENCY_CONFIG`.
- **AI Alignment**: The active `currency` code is passed to `/api/users/{steam_id64}/persona` so AI-generated roasts and summaries reference the same currency shown on screen.

---

## 4. Performance & Resilience Design
- **Frontend In-Memory TTL Cache**: `api.ts` caches `games`, `friends`, `achievements`, and `guides` for 2 minutes in memory and persists user profiles/games in `localStorage` for instant tab switching and offline resilience.
- **SQLite WAL Mode**: `database.py` enables `PRAGMA journal_mode=WAL`, `synchronous=NORMAL`, and a 64MB page cache (`cache_size=-64000`) for concurrent async reads/writes.
- **Concurrent External Fetches**: Steam achievement endpoints (schema, player stats, global rarity) and Storefront crawls run concurrently via `asyncio.gather` rather than sequentially.
- **Graceful Degradation**: Missing `STEAM_API_KEY` or `GEMINI_API_KEY` triggers deterministic local fallbacks so the app remains functional in offline/demo environments.
