# Space Colony Miner

Sci‑fi incremental mining game with a **React + TypeScript** frontend and a **Go** backend backed by **PostgreSQL**.

Players mine resources, upgrade drills and drones, push deeper underground, and buy boosts through an in‑game store (Xsolla integration points included).

## Contents
- [Game Overview](#game-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Quick Start (Local Dev)](#quick-start-local-dev)
- [Environment Variables](#environment-variables)
- [Backend API Endpoints](#backend-api-endpoints)
- [Notes](#notes)

## Game Overview
- Mine resources manually by tapping/clicking in the mining area
- Earn passive mining through drone systems and upgrades
- Sell mined resources for gold and invest in progression
- Use premium gems for boosts (depth jumps, overclock, burst mining, etc.)
- Unlock achievements tied to depth, total mined, drones, and economy milestones

## Tech Stack
- **Frontend:** React + TypeScript + Vite
- **Backend:** Go (Chi router, pgx PostgreSQL driver)
- **Database:** PostgreSQL
- **Payments/Auth integration points:** Xsolla catalog + webhook, JWKS/JWT validation

## Project Structure
```text
space_miner/
├─ backend/      # Go API, business logic, PostgreSQL access, migrations
├─ frontend/     # React game client (UI, state, store, gameplay loop)
└─ README.md
```

## Quick Start (Local Dev)

### Prerequisites
- Go 1.22+
- PostgreSQL 14+
- Node.js 18+
- pnpm (recommended)

### 1) Clone
```bash
git clone https://github.com/ninaey/space_miner.git
cd space_miner
```

### 2) Backend
```bash
cp backend/.env.example backend/.env
cd backend
go mod tidy
go run .
```

Backend default: http://localhost:8080

> Create the DB schema by running `backend/migrations/init.up.sql` against your Postgres database.

### 3) Frontend
```bash
cp frontend/.env.example frontend/.env
cd frontend
pnpm install
pnpm dev
```

Frontend default: http://localhost:5173

For UI/gameplay documentation, see `frontend/README.md`.

## Environment Variables

### Backend (`backend/.env`)
Minimum:
- `PORT` (default `8080`)
- `DATABASE_URL` (Postgres connection string)

Optional Xsolla values:
- `XSOLLA_PROJECT_ID`, `XSOLLA_MERCHANT_ID`, `XSOLLA_API_KEY` (required for Pay Station checkout; catalog can still load from the public Store API without the key)
- `XSOLLA_PAYSTATION_SANDBOX` — `true` or `false`; must match whether Pay Station is used in **sandbox** or **live** mode in [Publisher Account](https://publisher.xsolla.com/) for that project (mismatch often yields HTTP 422 / `[0401-2000]` from token creation)
- `XSOLLA_PAYSTATION_CURRENCY`, `XSOLLA_PAYSTATION_LANGUAGE`, `XSOLLA_PAYSTATION_COUNTRY` (optional; country or a public client IP is required by Xsolla for currency selection — the backend sets a safe default when needed)
- `XSOLLA_JWKS_URL`
- `XSOLLA_ISSUER`
- `XSOLLA_AUDIENCE`
- `XSOLLA_CATALOG_URL`
- `XSOLLA_WEBHOOK_SECRET`

**Pay Station checklist:** same merchant and numeric project ID as in Publisher Account; API key from **Company settings → API keys** with **Store** and **Pay Station** access; Pay Station module turned on for the project; sandbox flag in env matches sandbox vs live; virtual item SKUs in the purchase request exist and are sellable in that project.

### Frontend (`frontend/.env`)
- `VITE_API_BASE_URL` (default `http://localhost:8080`)

## Backend API Endpoints
- `GET /healthz` - health check
- `POST /auth/login` - login player
- `POST /auth/register` - register player
- `GET /store/catalog` - catalog data
- `POST /store/webhook/xsolla` - Xsolla webhook
- `GET /game/state` - authenticated full game state
- `POST /game/sync` - authenticated progress sync
- `POST /store/buy-gem-item` - authenticated gem purchase

## Notes
- On Windows, avoid committing `node_modules` (long paths can break Git staging)
- Root `.gitignore` already excludes dependency and build folders
