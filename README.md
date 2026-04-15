# Space Colony Miner

Space Colony Miner is a sci-fi incremental mining game with a React frontend and a Go backend.  
Players mine resources, upgrade drills and drones, push deeper underground, and buy boosts through an in-game store with Xsolla-ready payment flows.

## Game Overview

- Mine resources manually by tapping/clicking in the mining area.
- Earn passive mining through drone systems and upgrade progression.
- Sell mined resources for gold, then invest in upgrades.
- Use premium gems for boosts (depth jumps, overclock, burst mining, and more).
- Unlock achievements tied to depth, total mined, drones, and economy milestones.

## Core Features

- **Layered mining progression**: iron, copper, silver, and diamond-rich depths.
- **Upgrade system**: battery efficiency, drill bits, hover engines, drone factory, storage expansion.
- **Inventory and economy**: storage limits, sell-all loop, and resource-to-gold conversion.
- **Store and boosts**: equipment, gem packs, and timed/permanent gem items.
- **Backend sync**: authenticated sessions can sync mining progress to server.
- **Anti-cheat guardrails**: backend validates sync payload against expected gain limits.

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Go (Chi router, pgx PostgreSQL driver)
- **Database**: PostgreSQL
- **Payments/Auth integration points**: Xsolla catalog, webhook, JWKS/JWT validation

## Project Structure

```text
SpaceColonyMiner/
├─ backend/      # Go API, business logic, PostgreSQL access, migrations
├─ frontend/     # React game client (UI, state, store, gameplay loop)
└─ README.md     # You are here
```

## Quick Start

## 1) Clone and enter the project

```bash
git clone git@school-gitlab.xsolla.dev:kl-xsolla-school/xsolla-school-kl-batch-1-team-7/nina/space_miner.git
cd space_miner
```

## 2) Backend setup

### Prerequisites

- Go 1.22+
- PostgreSQL 14+

### Configure environment

Copy and edit:

```bash
cp backend/.env.example backend/.env
```

Minimum values:

- `PORT` (default `8080`)
- `DATABASE_URL` (Postgres connection string)

Optional Xsolla values:

- `XSOLLA_JWKS_URL`
- `XSOLLA_ISSUER`
- `XSOLLA_AUDIENCE`
- `XSOLLA_CATALOG_URL`
- `XSOLLA_WEBHOOK_SECRET`

### Create database schema

Run the migration SQL in `backend/migrations/init.up.sql` against your database (for example via `psql`).

### Run backend API

```bash
cd backend
go mod tidy
go run .
```

Server default: `http://localhost:8080`

## 3) Frontend setup

### Prerequisites

- Node.js 18+
- pnpm (recommended)

### Configure environment

```bash
cp frontend/.env.example frontend/.env
```

Set `VITE_API_BASE_URL` to your backend URL (default: `http://localhost:8080`).

### Install and run

```bash
cd frontend
pnpm install
pnpm dev
```

Frontend default: `http://localhost:5173`

## API Endpoints (Backend)

- `GET /healthz` - health check
- `POST /auth/login` - login/register player
- `POST /auth/register` - register player
- `GET /store/catalog` - catalog data
- `POST /store/webhook/xsolla` - Xsolla webhook
- `GET /game/state` - authenticated full game state
- `POST /game/sync` - authenticated progress sync
- `POST /store/buy-gem-item` - authenticated gem purchase

## Gameplay Loop

1. Sign in and start mining.
2. Collect ore and push to deeper layers.
3. Sell inventory for gold.
4. Upgrade drill/drone/storage systems.
5. Use gems for temporary boosts or permanent unlocks.
6. Reach deeper milestones and complete achievements.

## Notes

- On Windows, do not commit `node_modules` (long paths can break Git staging).
- The root `.gitignore` already excludes dependency and build folders.
- Additional UI/design notes are available in `frontend/README.md`.
