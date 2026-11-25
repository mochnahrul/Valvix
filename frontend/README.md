# Valvix Frontend Documentation

The client application for Valvix, built with **React 18**, **TypeScript**, **Vite**, and **Tailwind CSS**. It delivers a clean, dark-mode obsidian Steam lounge interface featuring high-contrast typography, interactive bento grids, and fluid motion.

---

## Architecture Overview

```
                          ┌────────────────────────┐
                          │        App.tsx         │
                          └───────────┬────────────┘
                                      │
                          ┌───────────▼────────────┐
                          │      AppShell.tsx      │
                          │(Auth, Session, Nav Mod)│
                          └───────────┬────────────┘
                                      │
     ┌──────────────────┬─────────────┼─────────────────┬──────────────────┐
     ▼                  ▼             ▼                 ▼                  ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│OverviewBento │ │BacklogPicker │ │CoopMatcher   │ │AiPersonaView │ │Achievement   │
│(Dashboard)   │ │(Decision Eng)│ │(Squad Match) │ │(Passport/DNA)│ │Drawer        │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

---

## Key Modules & Features

### 1. Overview Bento Grid (`OverviewBento.tsx`)
- **Cinematic Spotlight**: Features the user's primary or currently targeted title with ambient backdrops and quick achievement tracking.
- **Library Telemetry Bento**: Real-time KPI cards calculating total library valuation (multi-currency: `USD` default, `IDR`, `EUR`, `GBP`, `SGD`, `JPY`), cost-per-hour efficiency, and unplayed game ratios.
- **Curated Highlights Shelf**: Asymmetric grid displaying Most Played titles, Value Champions, Trophy Targets, and Pile of Shame highlights.

### 2. Backlog Decision Engine (`BacklogPickerView.tsx`)
- **Bucket Categorization**:
  - `All Backlog`: Complete unplayed library.
  - `Pile of Shame`: Games with 0 hours logged.
  - `Quick Wins`: Bite-sized titles under 15 hours or >50% completed.
  - `Unfinished Business`: High-investment titles with remaining trophies.
  - `High Value`: Best cost-per-hour efficiency titles.
- **Smart Sorters**: Sort by Cost/Hour, Playtime, Price, or Achievement Progress.
- **Random Backlog Roulette**: Instant mechanical selection for indecisive players.

### 3. Co-op Squad Matcher (`CoopMatcherView.tsx`)
- **Friend Roster with Live Search & Pagination**: Search friends by Steam persona name with responsive "Load More" controls.
- **Multi-Player Squad Assembler**: Toggle friends in and out of the squad to compute mathematical library intersections in real time.
- **Hardware & Game-Night Filters**: Filter shared titles by `All`, `Online Co-op`, `Split-screen`, `Controller Support`, and `PvE`.
- **Physical Squad Roulette Modal**: Casino-style mechanical slot reel with deceleration physics to decide the squad's game for the night.

### 4. AI Gaming Persona Passport (`AiPersonaView.tsx` & `GamerDnaChart.tsx`)
- **Psychological Telemetry Archetype**: Synthesizes playstyles into titles (e.g., *The Tactical Completionist*, *The Dedicated Backlogger*).
- **Interactive Gamer DNA Radar Chart**: Pure SVG radar visualization measuring Exploration, Reflexes, Strategy, Narrative, Completionism, and Squad Synergy with **zero-glitch hover targets**.
- **Adjustable Comedy Roast**: Switch between `Friendly Banter`, `Playful Roast`, and `Brutal Reality Check` modes.
- **Dominant Category Weights**: Dynamic genre dominance calculated from playtime telemetry.

### 5. Collectible Trophy & Collection Showcase Card (`ShareShowcaseModal.tsx`)
- **Holographic Collectible Passport**: A collectible card exportable as high-resolution PNG (`pixelRatio: 2`).
- **Mode Toggle**:
  - `100% Trophies`: Hall of Fame shelf celebrating perfect games with gold crown badges.
  - `Full Collection`: Iconic collection titans with playtime rankings.
- **Social Sharing**: Copy ready-to-paste Discord/Markdown summary directly to clipboard.

### 6. Slide-Over Achievement Drawer (`GameAchievementDrawer.tsx`)
- Slide-out panel presenting all achievements, unlock state, unlock timestamp, and global rarity percentages.
- **AI Unlock Guide Generator**: Calls Google Gemini to provide a 3-step walkthrough and difficulty rating.

---

## Directory Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   └── SteamLoginView.tsx       # Steam login & vanity URL resolver
│   │   ├── backlog/
│   │   │   └── BacklogPickerView.tsx    # Backlog decision engine & filter buckets
│   │   ├── common/
│   │   │   ├── GameAchievementDrawer.tsx # Slide-out achievement inspector
│   │   │   ├── GameCard.tsx             # Universal responsive game card
│   │   │   ├── GamerAvatar.tsx          # Steam avatar with status ring
│   │   │   ├── LoadingSpinner.tsx       # Consistent luminous spinner & states
│   │   │   ├── Navbar.tsx               # Header navigation, currency switcher & quick sync
│   │   │   ├── ShareShowcaseModal.tsx   # Collectible trophy & collection card
│   │   │   ├── SteamConsoleGraphic.tsx  # Product preview card on login screen
│   │   │   └── ValvixLogo.tsx           # Custom geometric Valvix brand mark
│   │   ├── dashboard/
│   │   │   └── OverviewBento.tsx        # Main bento dashboard & spotlight
│   │   ├── layout/
│   │   │   └── AppShell.tsx             # Root application shell & routing
│   │   ├── persona/
│   │   │   ├── AiPersonaView.tsx        # AI gaming passport & roast view
│   │   │   └── GamerDnaChart.tsx        # Pure SVG glitch-free radar chart
│   │   ├── squad/
│   │   │   └── CoopMatcherView.tsx      # Squad matcher & mechanical roulette
│   │   └── ui/
│   │       ├── badge.tsx                # Luminous pill badges
│   │       └── button.tsx               # Primary & secondary action buttons
│   ├── contexts/
│   │   └── CurrencyContext.tsx          # Global multi-currency state (USD default)
│   ├── lib/
│   │   └── utils.ts                     # Multi-currency & hours formatters, image fallbacks
│   ├── services/
│   │   └── api.ts                       # Typed API client with 2-min in-memory cache
│   ├── types/
│   │   └── steam.ts                     # Central TypeScript domain interfaces
│   ├── App.tsx                          # Base React root
│   ├── index.css                        # Tailwind directives & holographic styles
│   └── main.tsx                         # DOM mounting point
├── index.html                           # Single page application HTML entry
├── package.json                         # Dependencies and build scripts
├── tailwind.config.ts                   # Custom palette, signals, fonts, shadows
└── vite.config.ts                       # Vite bundler configuration & @ alias
```

---

## In-Memory Caching & Performance Architecture

To eliminate navigation latency when switching between modules, `src/services/api.ts` implements a 2-minute in-memory cache:

```typescript
const memoryCache = new Map<string, CacheEntry<any>>();
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

function getCached<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
    return entry.data as T;
  }
  return null;
}
```

- `fetchUserGames`: Checks cache first, falls back to API, and persists in `localStorage`.
- `fetchUserFriends`: Avoids repeating friend list lookups across squad operations.
- `syncUserProfile`: Automatically invalidates and updates cache on fresh syncs.

---

## HD PNG Export Engine

The export engine in `AiPersonaView.tsx` and `ShareShowcaseModal.tsx` leverages `html-to-image`:

1. **Retina Clarity**: Captures DOM nodes at `pixelRatio: 2` with background color `#0D0F14`.
2. **SVG Presentation Attributes**: Radar charts and icons specify explicit presentation attributes (`fill="#cbd5e1"`, `fontSize="10"`, `fontFamily="monospace"`) alongside CSS to prevent canvas rasterization darkening bugs.
3. **Glitch-Free Pointer Events**: Visual circles have `pointer-events-none` with fixed hit-targets (`r={15}`) to prevent hover flicker loops during export cloning.

---

## Setup & Development

### 1. Prerequisites
- Node.js 18+
- npm or pnpm

### 2. Installation & Environment
```powershell
cd frontend
npm install
copy .env.example .env
```
Set `VITE_API_BASE_URL` in `frontend/.env` (defaults to `http://localhost:8000/api` for local dev; set your HTTPS backend URL on Vercel).

### 3. Development Server
```powershell
npm run dev -- --host 127.0.0.1 --port 5173
```
Open [http://127.0.0.1:5173/](http://127.0.0.1:5173/) in your browser.

### 4. Production Build
```powershell
npm run build
```
Type checks via `tsc -b` and bundles into `dist/` with gzipped JS bundle size around **132 kB**.

> For deep implementation details (state, currency context, and UI rules), see [Frontend Technical Guide](../docs/FRONTEND_TECH.md).
