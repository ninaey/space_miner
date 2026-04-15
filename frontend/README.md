# Space Colony Miner 🚀⛏️

> A futuristic idle clicker game built with React, TypeScript, and Tailwind CSS v4.
> Mine rare minerals, deploy drones, upgrade your rig, and dominate the depths of space.

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Getting Started](#getting-started)
5. [Screens & Features](#screens--features)
   - [Auth Gateway](#1-auth-gateway)
   - [Main Mining Hub](#2-main-mining-hub)
   - [Upgrades Workshop](#3-upgrades-workshop)
   - [Achievements & Milestones](#4-achievements--milestones)
   - [Store](#5-store)
   - [Settings](#6-settings)
6. [Game State & Context](#game-state--context)
   - [Resources](#resources)
   - [Upgrades](#upgrades)
   - [Drone Fleet](#drone-fleet)
   - [Game Actions](#game-actions)
7. [Store Catalog](#store-catalog)
   - [USD Items (Xsolla)](#usd-items-xsolla)
   - [Gem Shop Items](#gem-shop-items)
8. [CSS Architecture (BEM)](#css-architecture-bem)
9. [Design System](#design-system)
10. [Routing](#routing)
11. [Backend Integration Guide](#backend-integration-guide)
12. [Environment Variables](#environment-variables)
13. [Scripts](#scripts)

---

## Overview

**Space Colony Miner** is a mobile-first idle clicker game where the player takes on the role of a space colony commander. You tap to mine minerals from increasingly deep geological layers, spend resources on upgrades, deploy autonomous drones, and purchase power-ups via real money (Xsolla) or the in-game Gem currency.

### Core Game Loop

```
Tap to Mine  →  Collect Minerals  →  Sell for Gold
     ↓                                     ↓
Buy Upgrades  ←  Earn Gems / Gold  ←  Spend in Store
     ↓
Deploy More Drones  →  Passive Mining  →  Deeper Layers
```

### Depth Layers & Ore Table

| Depth Range | Primary Ore | Secondary Ore | Rare Ore   |
|-------------|-------------|---------------|------------|
| 0 – 199 m   | Iron        | —             | —          |
| 200 – 499 m | Iron (70%)  | Copper (30%)  | —          |
| 500 – 999 m | Iron (50%)  | Copper (35%)  | Silver (15%) |
| 1,000+ m    | Iron (30%)  | Copper (30%)  | Silver (25%) / Diamond (15%) |

Max depth cap: **5,000 m**

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Routing | React Router v7 (Data Mode) |
| Styling | Tailwind CSS v4 + Custom BEM CSS |
| Animation | Motion (Framer Motion successor) |
| State Management | React Context + `useReducer` |
| Persistence | `localStorage` (frontend) |
| Payments | Xsolla Pay Station (real money) |
| Fonts | Orbitron (headers) + Inter (data) |
| Build Tool | Vite |
| Package Manager | pnpm |

---

## Project Structure

```
space-colony-miner/
│
├── public/
│
├── src/
│   ├── app/
│   │   ├── App.tsx                         # Root — mounts RouterProvider
│   │   ├── routes.tsx                      # createBrowserRouter config
│   │   │
│   │   ├── context/
│   │   │   └── GameContext.tsx             # Central state, reducer, all config arrays
│   │   │
│   │   └── components/
│   │       ├── figma/
│   │       │   └── ImageWithFallback.tsx   # Safe image component (system)
│   │       │
│   │       └── game/
│   │           ├── AuthScreen.tsx          # /           Login / Register
│   │           ├── GameLayout.tsx          # /game       Shell + nav
│   │           ├── MainHub.tsx             # /game/mine  Mining + drones
│   │           ├── Upgrades.tsx            # /game/upgrades
│   │           ├── Achievements.tsx        # /game/achievements
│   │           ├── Store.tsx               # /game/store
│   │           └── Settings.tsx            # /game/settings
│   │
│   └── styles/
│       ├── fonts.css      # BEM keyframes, design tokens, utility classes
│       ├── index.css      # Entry — imports fonts + tailwind + theme
│       ├── tailwind.css   # Tailwind v4 directives
│       └── theme.css      # CSS custom properties (colors, radii, etc.)
│
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js >= 18
- pnpm >= 8 (`npm install -g pnpm`)

### Install & Run

```bash
# 1. Clone the repo
git clone https://github.com/your-org/space-colony-miner.git
cd space-colony-miner

# 2. Install dependencies
pnpm install

# 3. Start dev server
pnpm dev

# 4. Open in browser
# http://localhost:5173
```

### Build for Production

```bash
pnpm build
pnpm preview   # preview the production build locally
```

---

## Screens & Features

### 1. Auth Gateway

**Route:** `/`  
**File:** `src/app/components/game/AuthScreen.tsx`

- Animated starfield background with scan-line overlay
- Toggle between **Sign In** and **Create Account** forms
- Username + Password fields with validation
- Loading spinner on submit (glow-orange animation)
- On success → dispatches `LOGIN` action → redirected to `/game/mine`
- On logout → `localStorage` cleared, redirected back to `/`

> Backend hook: `POST /auth/login` and `POST /auth/register`. Store the JWT in `localStorage` alongside the game save key.

---

### 2. Main Mining Hub

**Route:** `/game/mine`  
**File:** `src/app/components/game/MainHub.tsx`

The core gameplay screen. Contains:

#### Mining Robot
- Animated SVG-style robot built from `div` elements
- Eyes pulse with `scm__pulse--cyan`
- Chest core glows with `scm__glow--orange`
- On tap: `scm-robot__body--drilling` bounce animation fires
- Drill impact flash on each tap

#### Ore Float Text
- `+{amount} {ORE}` text floats upward on each tap
- `scm-text__float--up` animation, fades out in 1.4s

#### Drone Fleet
Six drone types are unlocked progressively via `droneFactory` upgrade level. All drones are rendered with Framer Motion paths:

| # | Name | Shape | Motion | Unlocks At |
|---|------|-------|--------|-----------|
| 1 | Scout α | Slim arrowhead | Fast diagonal zigzag | Level 1 (default) |
| 2 | Excavator | Round + spinning drill bit | Orbital loop around robot | Level 2 |
| 3 | Hauler | Boxy freighter + cargo pod | Vertical shuttle with pause | Level 3 |
| 4 | Scout β | Mirror arrowhead | Opposite sweep to Scout α | Level 4 |
| 5 | Patrol | Long flat sentinel | Slow left-to-right sweep | Level 5 |
| 6 | Deep Probe | Sensor sphere + antenna | Gentle micro-hover | Level 6 |

Each drone has a unique color, label badge, and engine animation class.

#### HUD Elements
- **Depth Gauge** — vertical progress bar on the right rail, depth cursor with `scm__glow--orange`
- **Resource Chips** — Iron / Copper / Silver / Diamond counts at the top
- **Storage Bar** — fills from 0 to `storageMax`
- **Sell All** button — converts all ore to Gold at market rates
- **Passive rate** chip — shows current ore/sec from drones

#### Sell Rates (Gold per unit)
| Ore | Gold per Unit |
|---|---|
| Iron | 0.1 |
| Copper | 0.5 |
| Silver | 2.0 |
| Diamond | 50.0 |

---

### 3. Upgrades Workshop

**Route:** `/game/upgrades`  
**File:** `src/app/components/game/Upgrades.tsx`

Five upgrades, each with configurable max levels and exponential cost scaling:

| Upgrade | Effect | Cost Resource | Max Level | Base Cost | Multiplier |
|---|---|---|---|---|---|
| Battery Efficiency | Passive Rate +25% / level | Iron | 10 | 100 | 1.8× |
| Serrated Drill Bits | Click Power +50% / level | Iron | 10 | 150 | 2.0× |
| Hover Engines | Drone Speed +30% / level | Copper | 5 | 200 | 2.5× |
| Drone Factory | Drones +1 / level | Iron | 8 | 300 | 2.2× |
| Cargo Hold Expansion | Storage +2,000 kg / level | Copper | 10 | 80 | 1.6× |

**Cost formula:** `floor(baseCost × multiplier^currentLevel)`

Cards show:
- Current level / max level badge
- Level bar fill (cyan → gold when maxed)
- Next level cost with affordability check
- Greyed-out state when maxed

---

### 4. Achievements & Milestones

**Route:** `/game/achievements`  
**File:** `src/app/components/game/Achievements.tsx`

Eight tracked achievements with Gold rewards:

| ID | Name | Requirement | Reward |
|---|---|---|---|
| `depth_500` | Surface Breaker | Reach 500 m | 50 Gold |
| `depth_1000` | Kilometer Deep | Reach 1,000 m | 150 Gold |
| `depth_2000` | Discovered Diamond Layer | Reach 2,000 m | 500 Gold |
| `iron_10000` | Iron Collector | Mine 10,000 iron total | 100 Gold |
| `iron_100000` | Iron Magnate | Mine 100,000 iron total | 500 Gold |
| `iron_1000000` | Iron Empire | Mine 1,000,000 iron total | 2,000 Gold |
| `gold_1000` | Gold Rush | Earn 1,000 gold from selling | 200 Gold |
| `drones_5` | Drone Squad | Have 5 drones active | 300 Gold |

Progress bars auto-update every game tick. Claimed achievements show a gold border and lock the claim button.

---

### 5. Store

**Route:** `/game/store`  
**File:** `src/app/components/game/Store.tsx`

#### Tabs

| Tab | Contents |
|---|---|
| FEATURED | Curated selection of best-value items |
| EQUIPMENT | USD permanent upgrades (Xsolla) |
| GEM SHOP | Gem-currency boosts and cosmetics |
| GEM PACKS | Buy gems with real money (Xsolla) |

> The PASSES tab has been removed. Subscription items (`vip`) remain in the catalog for backend reference but are hidden from the UI.

#### Active Boosts Panel
Shown at the top of the store when any timed boost is running. Displays boost name + live countdown timer via `BoostTimer` component.

#### Purchase Flows
- **USD items** → Xsolla Pay Station (external)
- **Gem items** → Dispatches `SPEND_GEMS` action instantly; deducts gems, applies effect
- **One-time purchases** → Checked against `state.gemPurchases` array; button disabled if already owned

---

### 6. Settings

**Route:** `/game/settings`  
**File:** `src/app/components/game/Settings.tsx`

- Sound FX toggle
- Music toggle
- Notification toggle
- Graphics quality selector (Low / Medium / High)
- **Sync Save** button (manual backend save trigger)
- **Sign Out** button → `LOGOUT` dispatch → clears state → redirect to `/`
- Game version display
- Player UUID display (for support)

---

## Game State & Context

**File:** `src/app/context/GameContext.tsx`

The entire game state lives in a single `GameState` object managed by `useReducer`. It is:
- Initialized from `localStorage` on first render
- Auto-saved to `localStorage` on every state change
- Exposed via `useGame()` hook

### Resources

```ts
interface Resources {
  iron:     number;   // base ore, 0–200m
  copper:   number;   // unlocks at 200m
  silver:   number;   // unlocks at 500m
  diamonds: number;   // unlocks at 1,000m
  gold:     number;   // currency (from selling ore)
  gems:     number;   // premium soft currency
}
```

### Upgrades

```ts
interface UpgradeLevels {
  batteryEfficiency: number;  // 0–10
  serratedDrillBits: number;  // 0–10
  hoverEngines:      number;  // 0–5
  droneFactory:      number;  // 1–8  (starts at 1)
  storageExpansion:  number;  // 0–10
}
```

### Drone Fleet

Drone count = `upgrades.droneFactory + 2`  
(default `droneFactory = 1` → 3 drones on first login)

```
droneFactory level → active drones
  1  →  Scout α, Excavator, Hauler           (3 drones)
  2  →  + Scout α                            (4 drones — Scout α duped or β added)
  3  →  + Scout β                            (5 drones)
  4  →  + Patrol                             (6 drones)
  5  →  + Deep Probe                         (7 drones)
  ...up to level 8 (10 drones)
```

### Game Actions

| Action Type | Payload | Effect |
|---|---|---|
| `LOGIN` | `playerName: string` | Sets `isAuthenticated`, stores player name |
| `LOGOUT` | — | Resets to `initialState` |
| `LOAD_STATE` | `state: GameState` | Replaces state with backend-loaded save |
| `MINE` | `resource, amount, depthGain` | Adds ore, increases depth, checks storage |
| `AUTO_MINE` | — | Passive drone tick every 1 second |
| `UPGRADE` | `upgradeId` | Deducts cost resource, increments level |
| `SELL_ALL` | — | Converts all ore to gold at market rates |
| `SELL_ALL_DOUBLE` | — | Same but 2× (used by Storage Purge Protocol) |
| `CLAIM_ACHIEVEMENT` | `id, reward` | Marks claimed, adds gold reward |
| `PURCHASE` | `itemId, gems?` | Records USD purchase, optionally adds gems |
| `SPEND_GEMS` | `itemId, gemCost, effect, effectValue?, effectDuration?` | Deducts gems, applies effect |

### LocalStorage Key

```
space_colony_miner_save
```

---

## Store Catalog

### USD Items (Xsolla)

| SKU | Name | Price | Category | Effect |
|---|---|---|---|---|
| `super_drill` | Super Drill Mk. II | $4.99 | equipment | 3× mining speed (permanent) |
| `inventory_expander` | Inventory Expander | $2.99 | equipment | 2× storage capacity (permanent) |
| `gem_pack_s` | Gem Pack — Rookie | $0.99 | gems | +100 Gems |
| `gem_pack_m` | Gem Pack — Commander | $4.99 | gems | +550 Gems (+50 bonus) |
| `gem_pack_l` | Gem Pack — Admiral | $9.99 | gems | +1,500 Gems (+300 bonus) ⭐ Best Value |
| `vip` | Commander's VIP Pass | $14.99 | subscription | 2× Gold for 30 days + Neon frame |

### Gem Shop Items

| ID | Name | Gem Cost | Type | Effect | Duration |
|---|---|---|---|---|---|
| `turbo_drill_boost` | Turbo Drill Boost | 50 | boost | 3× click power | 100 taps |
| `depth_dive` | Depth Dive | 75 | boost | +250m depth instantly | instant |
| `drone_overclock` | Drone Overclock | 80 | boost | 4× drone speed | 60 sec |
| `mega_mine_burst` | Mega Mine Burst | 30 | boost | 500× click power burst | instant |
| `auto_sell_module` | Auto-Sell Module | 120 | boost | Auto-sell every 30s | 5 min |
| `storage_purge` | Storage Purge Protocol | 100 | boost | Sell all at 2× value | instant |
| `neon_commander_frame` | Neon Commander Frame | 200 | cosmetic | Avatar frame unlock | permanent |

---

## CSS Architecture (BEM)

All game-specific styles live in `src/styles/fonts.css` and follow strict **BEM naming** with the `scm` namespace:

```
Block:    .scm-[block]
Element:  .scm-[block]__[element]
Modifier: .scm-[block]__[element]--[modifier]
```

### Keyframe Naming Convention

All `@keyframes` follow `scm__[effect]--[variant]` or `scm-[block]__[element]--[state]`:

| Keyframe Name | Category | Used On |
|---|---|---|
| `scm__glow--cyan` | Global effect | Cyan borders, buttons |
| `scm__glow--orange` | Global effect | Robot chest, depth cursor |
| `scm__pulse--cyan` | Global effect | Robot eyes, engine dots |
| `scm__pulse--orange` | Global effect | Drone indicators |
| `scm__pulse--purple` | Global effect | Deep Probe hull, antenna |
| `scm-star__dot--twinkle` | Block: star | Starfield dots |
| `scm-robot__body--drilling` | Block: robot | Robot on-tap bounce |
| `scm-drone__rotor--spin` | Block: drone | Excavator rotor blur |
| `scm-drone__bit--spin-raw` | Block: drone | Excavator/Auth drill |
| `scm-drone__cargo--glow` | Block: drone | Hauler cargo pod |
| `scm-text__float--up` | Block: text | Ore amount popups |
| `scm-scan__line--move` | Block: scan | Auth screen scan overlay |
| `scm-nav__item--glow` | Block: nav | Active nav tab |
| `scm-drone--scout-a/b` | Reference | CSS fallback (unused) |
| `scm-drone--excavator` | Reference | CSS fallback (unused) |
| `scm-drone--hauler` | Reference | CSS fallback (unused) |
| `scm-drone--patrol` | Reference | CSS fallback (unused) |
| `scm-drone--deepprobe` | Reference | CSS fallback (unused) |

> Drone motion paths are handled by **Framer Motion** (now rebranded Motion) in the React components. The CSS `@keyframes` drone paths are kept as reference/fallback documentation.

### Utility Class Blocks

| Block | Purpose |
|---|---|
| `.scm-layout` | Root game container |
| `.scm-nav__item` | Navigation links |
| `.scm-card` | Generic content cards |
| `.scm-badge` | Status / category badges |
| `.scm-btn` | Game action buttons |
| `.scm-hud__chip` | HUD overlay data chips |
| `.scm-resource__row` | Currency display rows |
| `.scm-store__tab` | Store tab buttons |
| `.scm-upgrade__card` | Upgrade item cards |
| `.scm-achievement__card` | Achievement list items |
| `.scm-robot` | Mining robot container |
| `.scm-drone__*` | All drone sub-elements |
| `.scm-star__dot` | Starfield background dots |
| `.scm-depth__*` | Depth gauge elements |
| `.scm-auth__*` | Auth screen elements |
| `.scm-settings__*` | Settings toggles |
| `.scm-flash` | Flash notification bar |
| `.scm-text--*` | Typography helpers |

---

## Design System

### Color Palette

| Token | Hex | Usage |
|---|---|---|
| `--scm-color--bg-deep` | `#0B0E14` | Page backgrounds |
| `--scm-color--bg-surface` | `#0D1420` | Card / panel backgrounds |
| `--scm-color--bg-panel` | `#090C14` | Sidebar, header |
| `--scm-color--cyan` | `#00F2FF` | UI highlights, active states |
| `--scm-color--orange` | `#FF8C00` | Mechanical / robot actions |
| `--scm-color--gold` | `#FFD700` | Gold currency |
| `--scm-color--amber` | `#FFB347` | Cargo / hauler |
| `--scm-color--purple` | `#9B59B6` | Deep Probe / cosmetic |
| `--scm-color--white` | `#FFFFFF` | Primary data text |
| `--scm-color--white-muted` | `#FFFFFF55` | Secondary text |

### Typography

| Token | Font | Usage |
|---|---|---|
| `--scm-font--display` | Orbitron | All headers, labels, nav, badges |
| `--scm-font--data` | Inter | Numbers, descriptions, body text |

### Motion Tokens

| Token | Value | Usage |
|---|---|---|
| `--scm-duration--fast` | `0.15s` | Drill bounce |
| `--scm-duration--normal` | `0.3s` | UI transitions |
| `--scm-duration--slow` | `0.6s` | Page fade-ins |
| `--scm-duration--pulse` | `1.5s` | Default pulse cycle |

---

## Routing

Built with **React Router v7 Data Mode** (`createBrowserRouter`).

```
/                     → AuthScreen       (public)
/game                 → GameLayout       (protected shell)
  /game/mine          → MainHub
  /game/upgrades      → Upgrades
  /game/achievements  → Achievements
  /game/store         → Store
  /game/settings      → Settings
/*                    → redirect to /
```

**Auth guard:** `GameLayout` checks `state.isAuthenticated` on mount. If false, redirects to `/` via `useNavigate`.

**Context:** `GameProvider` wraps all routes at the root level via the `Root` component in `routes.tsx`.

---

## Backend Integration Guide

For a full backend breakdown including SQL schema, REST API endpoints, anti-cheat logic, Xsolla webhook flow, and active boost expiry, see the **Backend Blueprint** in the project wiki or refer to the inline comments in `GameContext.tsx`.

### Quick Integration Checklist

- [ ] Replace `localStorage` save with `POST /game/save` (keep localStorage as offline cache)
- [ ] Call `GET /game/state` on login and dispatch `LOAD_STATE`
- [ ] Implement `POST /auth/login` + `POST /auth/register`, store JWT
- [ ] Add `Authorization: Bearer <token>` header to all API calls
- [ ] Wire `POST /store/purchase/gem-item` before dispatching `SPEND_GEMS` locally
- [ ] Handle Xsolla webhook `POST /store/webhook/xsolla` for real-money purchases
- [ ] Implement `GET /store/active-boosts` on login to restore boost timers
- [ ] Set up `DELETE FROM active_boosts WHERE ends_at < NOW()` cron (60s interval)
- [ ] Add `LOAD_STATE` dispatch after every successful backend sync

---

## Environment Variables

Create a `.env` file at the project root:

```env
# Xsolla
VITE_XSOLLA_PROJECT_ID=your_xsolla_project_id
VITE_XSOLLA_MERCHANT_ID=your_merchant_id

# Backend API
VITE_API_BASE_URL=https://api.your-domain.com

# Optional: Feature flags
VITE_ENABLE_LEADERBOARD=true
VITE_ENABLE_ANALYTICS=false
```

> All Vite env variables must be prefixed with `VITE_` to be accessible in the browser bundle.

---

## Scripts

```bash
pnpm dev          # Start development server (http://localhost:5173)
pnpm build        # Type-check + production build → dist/
pnpm preview      # Preview production build locally
pnpm type-check   # Run tsc --noEmit
pnpm lint         # ESLint check
```

---

## License

MIT © Space Colony Miner — UI by Figma Make. Game design, backend, and deployment by your team.

---

*Built with React + TypeScript + Tailwind CSS v4 + Motion + React Router v7*
