# Valvix — Frontend Technical Documentation

## 1. Tech Stack & Tooling
- **Framework**: React 18 (`react`, `react-dom`) + TypeScript (`~5.6.2`)
- **Bundler**: Vite 5 (`vite`, `@vitejs/plugin-react`)
- **Styling**: Tailwind CSS (`tailwindcss ^3.4.15`, `tailwindcss-animate`)
- **Motion & Icons**: `framer-motion`, `lucide-react`
- **Image Export**: `html-to-image` (`toPng` at `pixelRatio: 2`)

---

## 2. Directory & Module Breakdown

```text
frontend/
├── public/
│   └── favicon.svg                 # 32x32 geometric Valvix "V" mark
└── src/
    ├── App.tsx                     # Root wrapper with <CurrencyProvider>
    ├── main.tsx                    # ReactDOM entry point
    ├── index.css                   # Base typography, ambient glow, custom scrollbars
    ├── contexts/
    │   └── CurrencyContext.tsx     # Global currency state (USD default) + formatPrice helpers
    ├── lib/
    │   └── utils.ts                # Currency conversion/formatting, hours, release year lookup, image error handler
    ├── services/
    │   └── api.ts                  # Typed REST client, 2-min in-memory TTL cache, localStorage persistence
    ├── types/
    │   └── steam.ts                # Domain interfaces (SteamGame, UserProfile, AIPersonaData, etc.)
    └── components/
        ├── auth/
        │   └── SteamLoginView.tsx  # Landing & Steam profile connect gate
        ├── layout/
        │   └── AppShell.tsx        # Top-level state (profile, games, activeModule, drawer/modal)
        ├── common/
        │   ├── ValvixLogo.tsx      # Reusable SVG ValvixMark
        │   ├── Navbar.tsx          # Sticky header, module tabs, currency selector, profile switcher
        │   ├── GameCard.tsx        # 2:3 poster card with isolated hover zoom & overflow-safe metadata
        │   ├── GamerAvatar.tsx     # Avatar with initials fallback
        │   ├── LoadingSpinner.tsx  # Spinner & LoadingState components
        │   ├── GameAchievementDrawer.tsx # Slide-over achievement & AI guide inspector
        │   ├── ShareShowcaseModal.tsx    # Collectible Trophy / Library Passport PNG & Markdown exporter
        │   └── SteamConsoleGraphic.tsx   # Product preview card on login screen
        ├── dashboard/
        │   └── OverviewBento.tsx   # Spotlight card, 2x2 KPI stats, curated 5-card shelf, Persona/Co-op widgets
        ├── backlog/
        │   └── BacklogPickerView.tsx # Bucket filters, search, sort, & random game picker
        ├── squad/
        │   └── CoopMatcherView.tsx # Friend roster, squad intersection grid, & roulette modal
        ├── persona/
        │   ├── AiPersonaView.tsx   # Tone switcher, Gamer DNA radar, telemetry cards, & PNG export
        │   └── GamerDnaChart.tsx   # Pure SVG 6-axis radar chart with hit-target decoupling
        └── ui/
            ├── badge.tsx           # Variant pill badges
            └── button.tsx          # Button primitives
```

---

## 3. Core Systems

### A. Currency System (`CurrencyContext.tsx` & `lib/utils.ts`)
- **Provider**: `CurrencyProvider` wraps `<AppShell />` in `App.tsx`.
- **Persistence**: Selected currency (`USD`, `IDR`, `EUR`, `GBP`, `SGD`, `JPY`) is stored in `localStorage` under `valvix_currency`. Default is `"USD"`.
- **API**: `useCurrency()` exposes:
  - `currency`: Active `SupportedCurrency` code.
  - `setCurrency(next)`: Updates state and `localStorage`.
  - `formatPrice(amountIDR)`: Converts IDR base value using `CURRENCY_CONFIG[currency].rateFromIDR` and formats via `Intl.NumberFormat` (2 decimals for amounts `< 100`, 0 decimals for `>= 100`). Returns `"Free"` for `0`.
  - `formatPriceCompact(amountIDR)`: Compact notation (`$1.2k`, `Rp 19.6M`) for showcase cards.

### B. State & Data Fetching (`AppShell.tsx` & `services/api.ts`)
- **Authentication**: `AppShell` initializes `currentProfile` from `localStorage` (`valvix_auth_user`) and checks URL query params (`?steamId=...`) on return from Steam OpenID.
- **Caching Strategy**:
  - `api.ts` maintains `memoryCache` (`Map<string, CacheEntry>`) with `CACHE_TTL_MS = 120_000` (2 minutes).
  - Owned games are also cached in `localStorage` (`valvix_cached_games_<steamId64>`) for instant initial render before background refresh completes.
  - `fetchWithTimeout` enforces a `25s` `AbortController` timeout on all requests to `http://localhost:8000/api`.

### C. UI Craft & Overflow Prevention Rules
- **No `backdrop-blur` inside transforming `overflow-hidden` cards**: `GameCard.tsx` uses `isolate` on the poster container and static `-inset-px` vignette overlays so `group-hover:scale-[1.03]` never tears or shifts composite layers in Chromium.
- **Flex/Grid Truncation**: All cards and stat tiles apply `min-w-0` on flex/grid children and `truncate` / `line-clamp-*` on dynamic text (game titles, persona names, IDR/USD totals) so narrow mobile viewports (`360px`) never overflow horizontally.
- **Rules of Hooks Compliance**: `GameAchievementDrawer.tsx` declares all `useState` and `useEffect` hooks unconditionally before `if (!game) return null;`, and resets local filter/search state whenever `game?.appId` changes.

---

## 4. Design Tokens (`tailwind.config.ts` & `index.css`)
- **Canvas**: `#0A0C10` (`bg-canvas`)
- **Surfaces**: `#12151D` (`bg-surface`), `#191D28` (`bg-surface-elevated`), `#0E1118` (`bg-surface-subtle`)
- **Borders**: `rgba(255, 255, 255, 0.07)` (`border-border`), `rgba(255, 255, 255, 0.16)` (`border-border-focus`)
- **Accents**: Emerald `#00E599`, Flame Orange `#FF5500`, Sky Blue `#38BDF8`, Trophy Purple `#A855F7`
- **Fonts**: `Plus Jakarta Sans` / `Space Grotesk` (headings), `Inter` (body), `JetBrains Mono` (tabular numbers & telemetry)

---

## 5. Build & Verification
```powershell
cd frontend
npm run build   # Runs `tsc -b && vite build`
```
