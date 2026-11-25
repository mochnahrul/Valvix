# Valvix — Steam Library & Squad Lounge

**Valvix** is a full-stack web platform built to analyze your Steam library, tame your unplayed backlog, match co-op games with friends, and generate an AI-powered gamer persona & achievement guide from your real Steam playtime telemetry.

Designed with a calm, high-craft dark obsidian interface, Valvix supports **global multi-currency valuation** (`USD` default, `IDR`, `EUR`, `GBP`, `SGD`, `JPY`) and zero-password public Steam profile syncing.

---

## Key Features

- **Overview Dashboard**: Library valuation in your chosen currency, cost-per-hour efficiency, spotlight game tracker, and curated highlights (*Best Value*, *Most Played*, *Pile of Shame*, *Trophy Target*, *Squad Ready*).
- **Backlog Decision Engine**: Smart buckets (*All Games*, *Pile of Shame*, *Quick Wins*, *Unfinished Business*, *Best Value*), full-text search, sorting, and a random game picker.
- **Co-op Squad Matcher & Roulette**: Real-time library intersection across selected Steam friends with mode filters (*Online Co-op*, *Local / Split-Screen*, *Full Controller Support*) and an animated squad roulette wheel.
- **AI Gaming Persona & DNA Radar**: Powered by **Google Gemini 2.5 Flash** with deterministic SHA-256 telemetry hashing, 6-axis SVG Gamer DNA radar chart, and 3 roast intensities (*Friendly Banter*, *Playful Roast*, *Brutal Reality Check*) tailored to your active currency.
- **Shareable Showcase & Passport Cards**: High-resolution PNG export (`html-to-image`) and Discord-ready Markdown copy for *100% Trophy Room* and *Library Passport*.
- **Slide-Over Achievement Inspector**: Concurrent achievement fetching with global rarity percentages, secret achievement spoiler toggle, and cached AI unlock walkthroughs.
- **Global Multi-Currency Switcher**: Instant currency switching (`USD`, `IDR`, `EUR`, `GBP`, `SGD`, `JPY`) persisted in `localStorage`.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Backend** | Python 3.11+, FastAPI, SQLAlchemy 2.0 (Async), `aiosqlite`, SQLite (WAL Mode), `httpx`, Pydantic v2 |
| **Frontend** | React 18, TypeScript, Vite 5, Tailwind CSS, Framer Motion, Lucide React, `html-to-image` |
| **AI & External APIs** | Google Gemini 2.5 Flash (`google-genai`), Steam Web API, Steam Storefront API |

---

## Project Structure

```text
Valvix/
├── backend/
│   ├── app/
│   │   ├── api/                 # FastAPI routers (routes.py, auth.py)
│   │   ├── core/                # Settings & async SQLite WAL engine
│   │   ├── models/              # SQLAlchemy ORM models (User, GameCatalog, UserLibrary, AIPersona, AchievementGuide)
│   │   ├── schemas/             # Pydantic v2 camelCase schemas
│   │   └── services/            # Steam sync, Storefront crawler, Achievement & Gemini AI services
│   ├── alembic/                 # Database migrations
│   ├── requirements.txt         # Python dependencies
│   ├── test_api.py              # End-to-end backend API verification script
│   └── README.md                # Backend quick reference
├── frontend/
│   ├── public/
│   │   └── favicon.svg          # Custom geometric Valvix brand mark
│   ├── src/
│   │   ├── components/          # UI & feature modules (auth, backlog, common, dashboard, layout, persona, squad, ui)
│   │   ├── contexts/            # Global React contexts (CurrencyContext)
│   │   ├── lib/                 # Currency formatters, image fallback, release year helpers
│   │   ├── services/            # Typed API client with 2-min in-memory TTL cache & localStorage fallback
│   │   └── types/               # Core TypeScript domain types
│   ├── package.json
│   ├── tailwind.config.ts
│   └── README.md                # Frontend quick reference
├── docs/
│   ├── HIGH_LEVEL_ARCHITECTURE.md  # System architecture, data flows, & design decisions
│   ├── FRONTEND_TECH.md            # Frontend developer technical documentation
│   └── BACKEND_TECH.md             # Backend developer technical documentation
└── README.md
```

---

## Quickstart

### 1. Prerequisites
- **Python 3.11+**
- **Node.js 18+**
- **Steam Web API Key**: [https://steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey)
- **Google Gemini API Key** *(optional, falls back to local deterministic templates if omitted)*: [https://aistudio.google.com/](https://aistudio.google.com/)

### 2. Backend Setup
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Configure `backend/.env`:
```env
DATABASE_URL=sqlite+aiosqlite:///./valvix.db
STEAM_API_KEY=your_steam_web_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
FRONTEND_URL=http://localhost:5173
ENVIRONMENT=development
```

Start the API server:
```powershell
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
Swagger UI: `http://127.0.0.1:8000/docs`

### 3. Frontend Setup
```powershell
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```
Open `http://127.0.0.1:5173/` in your browser.

---

## Documentation

- [High-Level Architecture](docs/HIGH_LEVEL_ARCHITECTURE.md) — System overview, architecture diagrams, data flows, caching & latency strategy.
- [Deployment Guide](docs/DEPLOYMENT.md) — Production setup for Vercel (Frontend) + GCP VM / Nginx + Certbot + SQLite (Backend).
- [Frontend Technical Guide](docs/FRONTEND_TECH.md) — Component tree, state & currency context, API client caching, styling tokens.
- [Backend Technical Guide](docs/BACKEND_TECH.md) — FastAPI services, batch DB queries, concurrent Steam crawling, Gemini AI pipeline, and endpoints.
- [Backend Quick Reference](backend/README.md) & [Frontend Quick Reference](frontend/README.md).
