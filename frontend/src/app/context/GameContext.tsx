import React, { createContext, useContext, useReducer, useEffect, useRef, useCallback } from 'react';
import { syncGameProgress } from '../lib/backendApi';

export interface Resources {
  iron: number;
  copper: number;
  silver: number;
  diamonds: number;
  gold: number;
  gems: number;
}

export interface TotalMined {
  iron: number;
  copper: number;
  silver: number;
  diamonds: number;
}

export interface UpgradeLevels {
  batteryEfficiency: number;
  serratedDrillBits: number;
  hoverEngines: number;
  droneFactory: number;
  storageExpansion: number;
}

export interface AchievementState {
  completed: boolean;
  claimed: boolean;
  progress: number;
}

export interface GameState {
  isAuthenticated: boolean;
  playerName: string;
  resources: Resources;
  totalMined: TotalMined;
  totalGoldEarned: number;
  storageUsed: number;
  storageMax: number;
  depth: number;
  clickPower: number;
  passiveRate: number;
  droneSpeed: number;
  upgrades: UpgradeLevels;
  achievements: Record<string, AchievementState>;
  purchases: string[];
  gemPurchases: string[];
  activeBoosts: { id: string; endsAt: number }[];
  hasNeonFrame: boolean;
  lastSynced: string;
  purchasedItems: PurchasedItem[];
}

export interface PurchasedItem {
  name: string;
  count: number;
}

export type GameAction =
  | { type: 'LOGIN'; playerName: string }
  | { type: 'LOGOUT' }
  | { type: 'SET_PURCHASED_ITEMS'; items: PurchasedItem[] }
  | { type: 'MINE'; resource: keyof TotalMined; amount: number; depthGain: number }
  | { type: 'AUTO_MINE' }
  | { type: 'UPGRADE'; upgradeId: keyof UpgradeLevels }
  | { type: 'SELL_ALL' }
  | { type: 'SELL_ALL_DOUBLE' }
  | { type: 'CLAIM_ACHIEVEMENT'; id: string; reward: number }
  | { type: 'PURCHASE'; itemId: string; gems?: number }
  | { type: 'SPEND_GEMS'; itemId: string; gemCost: number; effect: string; effectValue?: number; effectDuration?: number }
  | { type: 'SYNCED' }
  | { type: 'LOAD_STATE'; state: GameState }
  | { type: 'MERGE_BACKEND_STATE'; depth: number; gems: number; storageMax?: number };

export const UPGRADES_CONFIG = [
  {
    id: 'batteryEfficiency' as keyof UpgradeLevels,
    name: 'Battery Efficiency',
    description: 'Increases passive mining rate by 25% per level.',
    icon: '🔋',
    maxLevel: 10,
    baseCost: 100,
    costResource: 'iron' as const,
    costMultiplier: 1.8,
    effect: 'Passive Rate +25%',
  },
  {
    id: 'serratedDrillBits' as keyof UpgradeLevels,
    name: 'Serrated Drill Bits',
    description: 'Increases manual click power by 50% per level.',
    icon: '⚙️',
    maxLevel: 10,
    baseCost: 150,
    costResource: 'iron' as const,
    costMultiplier: 2.0,
    effect: 'Click Power +50%',
  },
  {
    id: 'hoverEngines' as keyof UpgradeLevels,
    name: 'Hover Engines',
    description: 'Allows drones to move between layers faster.',
    icon: '🚀',
    maxLevel: 5,
    baseCost: 200,
    costResource: 'copper' as const,
    costMultiplier: 2.5,
    effect: 'Drone Speed +30%',
  },
  {
    id: 'droneFactory' as keyof UpgradeLevels,
    name: 'Drone Factory',
    description: 'Deploys one additional auto-drone per level.',
    icon: '🤖',
    maxLevel: 8,
    baseCost: 300,
    costResource: 'iron' as const,
    costMultiplier: 2.2,
    effect: 'Drones +1',
  },
  {
    id: 'storageExpansion' as keyof UpgradeLevels,
    name: 'Cargo Hold Expansion',
    description: 'Increases storage capacity by 2,000 kg per level.',
    icon: '📦',
    maxLevel: 10,
    baseCost: 80,
    costResource: 'copper' as const,
    costMultiplier: 1.6,
    effect: 'Storage +2,000 kg',
  },
];

export const ACHIEVEMENTS_CONFIG = [
  { id: 'depth_500', name: 'Surface Breaker', description: 'Reach 500m depth', icon: '📏', target: 500, type: 'depth', reward: 50 },
  { id: 'depth_1000', name: 'Kilometer Deep', description: 'Reach 1,000m depth', icon: '🌑', target: 1000, type: 'depth', reward: 150 },
  { id: 'depth_2000', name: 'Discovered Diamond Layer', description: 'Reach the diamond layer at 2,000m', icon: '💎', target: 2000, type: 'depth', reward: 500 },
  { id: 'iron_10000', name: 'Iron Collector', description: 'Mine 10,000 iron ore total', icon: '⛏️', target: 10000, type: 'total_iron', reward: 100 },
  { id: 'iron_100000', name: 'Iron Magnate', description: 'Mine 100,000 iron ore total', icon: '🏭', target: 100000, type: 'total_iron', reward: 500 },
  { id: 'iron_1000000', name: 'Iron Empire', description: 'Mine 1,000,000 iron ore total', icon: '⭐', target: 1000000, type: 'total_iron', reward: 2000 },
  { id: 'gold_1000', name: 'Gold Rush', description: 'Earn 1,000 gold from selling', icon: '💰', target: 1000, type: 'gold', reward: 200 },
  { id: 'drones_5', name: 'Drone Squad', description: 'Have 5 drones active', icon: '🛸', target: 5, type: 'drones', reward: 300 },
];

export const STORE_ITEMS = [
  { id: 'super_drill', name: 'Super Drill Mk. II', description: 'Increases mining speed by 3x forever.', icon: '🔩', price: 4.99, currency: 'usd', category: 'equipment', featured: true },
  { id: 'inventory_expander', name: 'Inventory Expander', description: 'Double your mineral storage capacity.', icon: '📦', price: 2.99, currency: 'usd', category: 'equipment', featured: true },
  { id: 'gem_pack_s', name: 'Gem Pack — Rookie', description: '100 Gems for your colony.', icon: '💎', price: 0.99, currency: 'usd', category: 'gems', gems: 100, featured: false },
  { id: 'gem_pack_m', name: 'Gem Pack — Commander', description: '500 Gems + 50 bonus gems!', icon: '💎', price: 4.99, currency: 'usd', category: 'gems', gems: 550, featured: false },
  { id: 'gem_pack_l', name: 'Gem Pack — Admiral', description: '1,200 Gems + 300 bonus. Best Value!', icon: '💎', price: 9.99, currency: 'usd', category: 'gems', gems: 1500, featured: false, bestValue: true },
  { id: 'vip', name: "Commander's VIP Pass", description: '2× gold for 30 days + exclusive avatar frame.', icon: '⭐', price: 14.99, currency: 'usd', category: 'subscription', featured: false },
];

// ── Items purchasable with Gems (soft premium currency) ──────────────────
export const GEM_ITEMS = [
  {
    id: 'turbo_drill_boost',
    name: 'Turbo Drill Boost',
    description: 'Instantly triples your click power for the next 100 manual taps. Great for breaking into a new layer fast.',
    icon: '⚡',
    gemCost: 50,
    category: 'boost',
    effect: 'clickBoost',
    effectValue: 3,
    effectDuration: 100, // taps
  },
  {
    id: 'depth_dive',
    name: 'Depth Dive',
    description: 'Skip ahead +250m instantly. Jump straight into the next geological layer without grinding.',
    icon: '🌀',
    gemCost: 75,
    category: 'boost',
    effect: 'depthBoost',
    effectValue: 250,
  },
  {
    id: 'drone_overclock',
    name: 'Drone Overclock',
    description: 'All drones mine at 4× speed for 60 seconds. Passive income surge.',
    icon: '🚀',
    gemCost: 80,
    category: 'boost',
    effect: 'droneBoost',
    effectValue: 4,
    effectDuration: 60, // seconds
  },
  {
    id: 'mega_mine_burst',
    name: 'Mega Mine Burst',
    description: 'Instantly mine 500× your current click power in one explosion. One-time use per purchase.',
    icon: '💥',
    gemCost: 30,
    category: 'boost',
    effect: 'mineBurst',
    effectValue: 500,
  },
  {
    id: 'auto_sell_module',
    name: 'Auto-Sell Module',
    description: 'Automatically sells all minerals every 30 seconds for 5 minutes. Sit back and watch gold roll in.',
    icon: '🤖',
    gemCost: 120,
    category: 'boost',
    effect: 'autoSell',
    effectDuration: 300, // seconds
  },
  {
    id: 'storage_purge',
    name: 'Storage Purge Protocol',
    description: 'Sell everything in your cargo hold instantly at 2× market value. One-time emergency cash-out.',
    icon: '💰',
    gemCost: 100,
    category: 'boost',
    effect: 'doubleSell',
    effectValue: 2,
  },
  {
    id: 'neon_commander_frame',
    name: 'Neon Commander Frame',
    description: 'Unlock the exclusive Neon Commander avatar frame. Purely cosmetic — flex on other colonists.',
    icon: '🎖️',
    gemCost: 200,
    category: 'cosmetic',
    effect: 'cosmetic',
    effectValue: 0,
    oneTime: true,
  },
];

const getUpgradeCost = (config: typeof UPGRADES_CONFIG[0], level: number): number => {
  return Math.floor(config.baseCost * Math.pow(config.costMultiplier, level));
};

const calculateStorageUsed = (resources: Resources): number => {
  return Math.floor(resources.iron + resources.copper * 2 + resources.silver * 5 + resources.diamonds * 20);
};

const getResourceForDepth = (depth: number): keyof TotalMined => {
  if (depth < 200) return 'iron';
  if (depth < 500) return Math.random() < 0.7 ? 'iron' : 'copper';
  if (depth < 1000) {
    const r = Math.random();
    if (r < 0.5) return 'iron';
    if (r < 0.85) return 'copper';
    return 'silver';
  }
  const r = Math.random();
  if (r < 0.3) return 'iron';
  if (r < 0.6) return 'copper';
  if (r < 0.85) return 'silver';
  return 'diamonds';
};

const initialAchievements: Record<string, AchievementState> = Object.fromEntries(
  ACHIEVEMENTS_CONFIG.map(a => [a.id, { completed: false, claimed: false, progress: 0 }])
);

const initialState: GameState = {
  isAuthenticated: false,
  playerName: '',
  resources: { iron: 0, copper: 0, silver: 0, diamonds: 0, gold: 0, gems: 0 },
  totalMined: { iron: 0, copper: 0, silver: 0, diamonds: 0 },
  totalGoldEarned: 0,
  storageUsed: 0,
  storageMax: 10000,
  depth: 0,
  clickPower: 10,
  passiveRate: 5,
  droneSpeed: 1,
  upgrades: { batteryEfficiency: 0, serratedDrillBits: 0, hoverEngines: 0, droneFactory: 1, storageExpansion: 0 },
  achievements: initialAchievements,
  purchases: [],
  gemPurchases: [],
  activeBoosts: [],
  hasNeonFrame: false,
  lastSynced: new Date().toISOString(),
  purchasedItems: [],
};

const updateAchievements = (state: GameState): Record<string, AchievementState> => {
  const updated = { ...state.achievements };
  ACHIEVEMENTS_CONFIG.forEach(cfg => {
    let progress = 0;
    if (cfg.type === 'depth') progress = Math.min(state.depth, cfg.target);
    else if (cfg.type === 'total_iron') progress = Math.min(state.totalMined.iron, cfg.target);
    else if (cfg.type === 'gold') progress = Math.min(state.totalGoldEarned, cfg.target);
    else if (cfg.type === 'drones') progress = Math.min(state.upgrades.droneFactory + 2, cfg.target);
    const completed = progress >= cfg.target;
    updated[cfg.id] = { ...updated[cfg.id], progress, completed: completed || updated[cfg.id].completed };
  });
  return updated;
};

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'LOGIN':
      return { ...state, isAuthenticated: true, playerName: action.playerName, lastSynced: new Date().toISOString() };
    case 'LOGOUT':
      return { ...initialState };
    case 'LOAD_STATE':
      return action.state;
    case 'SET_PURCHASED_ITEMS':
      return { ...state, purchasedItems: action.items };
    case 'MINE': {
      const newResources = { ...state.resources, [action.resource]: state.resources[action.resource] + action.amount };
      const newTotalMined = { ...state.totalMined, [action.resource]: state.totalMined[action.resource] + action.amount };
      const newDepth = Math.min(state.depth + action.depthGain, 5000);
      const storageUsed = calculateStorageUsed(newResources);
      if (storageUsed > state.storageMax) return state;
      const newState = { ...state, resources: newResources, totalMined: newTotalMined, depth: newDepth, storageUsed };
      return { ...newState, achievements: updateAchievements(newState) };
    }
    case 'AUTO_MINE': {
      const droneCount = state.upgrades.droneFactory + 2;
      const passiveAmt = Math.floor(state.passiveRate * (1 + state.upgrades.batteryEfficiency * 0.25) * droneCount);
      const resource = getResourceForDepth(state.depth);
      const newResources = { ...state.resources, [resource]: state.resources[resource] + passiveAmt };
      const newTotalMined = { ...state.totalMined, [resource]: state.totalMined[resource] + passiveAmt };
      const storageUsed = calculateStorageUsed(newResources);
      if (storageUsed > state.storageMax) return state;
      const newDepth = Math.min(state.depth + 0.05 * droneCount, 5000);
      const newState = { ...state, resources: newResources, totalMined: newTotalMined, depth: newDepth, storageUsed };
      return { ...newState, achievements: updateAchievements(newState) };
    }
    case 'UPGRADE': {
      const cfg = UPGRADES_CONFIG.find(u => u.id === action.upgradeId);
      if (!cfg) return state;
      const level = state.upgrades[action.upgradeId];
      if (level >= cfg.maxLevel) return state;
      const cost = getUpgradeCost(cfg, level);
      const resource = cfg.costResource as keyof Resources;
      if (state.resources[resource] < cost) return state;
      const newResources = { ...state.resources, [resource]: state.resources[resource] - cost };
      const newUpgrades = { ...state.upgrades, [action.upgradeId]: level + 1 };
      let clickPower = state.clickPower;
      let passiveRate = state.passiveRate;
      let storageMax = state.storageMax;
      let droneSpeed = state.droneSpeed;
      if (action.upgradeId === 'serratedDrillBits') clickPower = 10 * Math.pow(1.5, newUpgrades.serratedDrillBits);
      if (action.upgradeId === 'batteryEfficiency') passiveRate = 5 * (1 + newUpgrades.batteryEfficiency * 0.25);
      if (action.upgradeId === 'storageExpansion') storageMax = 10000 + newUpgrades.storageExpansion * 2000;
      if (action.upgradeId === 'hoverEngines') droneSpeed = 1 + newUpgrades.hoverEngines * 0.3;
      return { ...state, resources: newResources, upgrades: newUpgrades, clickPower, passiveRate, storageMax, droneSpeed };
    }
    case 'SELL_ALL': {
      const goldGained = Math.floor(
        state.resources.iron * 0.1 +
        state.resources.copper * 0.5 +
        state.resources.silver * 2 +
        state.resources.diamonds * 50
      );
      const newGold = state.resources.gold + goldGained;
      const newTotalGoldEarned = state.totalGoldEarned + goldGained;
      const newResources = { ...state.resources, iron: 0, copper: 0, silver: 0, diamonds: 0, gold: newGold };
      const newState = { ...state, resources: newResources, storageUsed: 0, totalGoldEarned: newTotalGoldEarned };
      return { ...newState, achievements: updateAchievements(newState) };
    }
    case 'SELL_ALL_DOUBLE': {
      const goldGained = Math.floor(
        (state.resources.iron * 0.1 +
        state.resources.copper * 0.5 +
        state.resources.silver * 2 +
        state.resources.diamonds * 50) * 2
      );
      const newGold = state.resources.gold + goldGained;
      const newTotalGoldEarned = state.totalGoldEarned + goldGained;
      const newResources = { ...state.resources, iron: 0, copper: 0, silver: 0, diamonds: 0, gold: newGold };
      const newState = { ...state, resources: newResources, storageUsed: 0, totalGoldEarned: newTotalGoldEarned };
      return { ...newState, achievements: updateAchievements(newState) };
    }
    case 'CLAIM_ACHIEVEMENT': {
      const newAchievements = { ...state.achievements, [action.id]: { ...state.achievements[action.id], claimed: true } };
      const newGold = state.resources.gold + action.reward;
      return { ...state, achievements: newAchievements, resources: { ...state.resources, gold: newGold } };
    }
    case 'PURCHASE': {
      const purchases = [...state.purchases, action.itemId];
      let resources = state.resources;
      if (action.gems) resources = { ...resources, gems: resources.gems + action.gems };
      return { ...state, purchases, resources, lastSynced: new Date().toISOString() };
    }
    case 'SPEND_GEMS': {
      if (state.resources.gems < action.gemCost) return state;
      const newGems = state.resources.gems - action.gemCost;
      let newState = { ...state, resources: { ...state.resources, gems: newGems } };

      // Track one-time gem purchases
      const gemItem = GEM_ITEMS.find(g => g.id === action.itemId);
      if (gemItem?.oneTime) {
        newState = { ...newState, gemPurchases: [...(state.gemPurchases || []), action.itemId] };
      }

      switch (action.effect) {
        case 'depthBoost':
          newState = { ...newState, depth: Math.min(state.depth + (action.effectValue || 250), 5000) };
          break;
        case 'mineBurst': {
          const burstAmt = state.clickPower * (action.effectValue || 500);
          const resource = getResourceForDepth(state.depth);
          const burstResources = { ...newState.resources, [resource]: newState.resources[resource] + burstAmt };
          const burstTotalMined = { ...state.totalMined, [resource]: state.totalMined[resource] + burstAmt };
          const storageUsed = calculateStorageUsed(burstResources);
          newState = { ...newState, resources: burstResources, totalMined: burstTotalMined, storageUsed };
          break;
        }
        case 'doubleSell':
          // Trigger double sell immediately
          return gameReducer(newState, { type: 'SELL_ALL_DOUBLE' });
        case 'cosmetic':
          newState = { ...newState, hasNeonFrame: true };
          break;
        case 'clickBoost':
        case 'droneBoost':
        case 'autoSell': {
          const endsAt = Date.now() + (action.effectDuration || 60) * 1000;
          const existingBoosts = (state.activeBoosts || []).filter(b => b.id !== action.itemId);
          newState = { ...newState, activeBoosts: [...existingBoosts, { id: action.itemId, endsAt }] };
          break;
        }
      }

      return { ...newState, achievements: updateAchievements(newState) };
    }
    case 'MERGE_BACKEND_STATE': {
      const mergedState = {
        ...state,
        depth: action.depth,
        resources: { ...state.resources, gems: action.gems },
        storageMax: action.storageMax ?? state.storageMax,
      };
      return { ...mergedState, achievements: updateAchievements(mergedState) };
    }
    case 'SYNCED':
      return { ...state, lastSynced: new Date().toISOString() };
    default:
      return state;
  }
}

const GameContext = createContext<{
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  getUpgradeCost: (upgradeId: keyof UpgradeLevels) => number;
  getResourceForDepth: (depth: number) => keyof TotalMined;
  canAfford: (upgradeId: keyof UpgradeLevels) => boolean;
} | null>(null);

const SAVE_KEY = 'space_colony_miner_save';
export const BACKEND_TOKEN_KEY = 'space_colony_miner_backend_token';
export const BACKEND_PLAYER_ID_KEY = 'space_colony_miner_backend_player_id';

export function saveBackendSession(token: string, playerId: string) {
  localStorage.setItem(BACKEND_TOKEN_KEY, token);
  localStorage.setItem(BACKEND_PLAYER_ID_KEY, playerId);
}

export function clearBackendSession() {
  localStorage.removeItem(BACKEND_TOKEN_KEY);
  localStorage.removeItem(BACKEND_PLAYER_ID_KEY);
}

export function getBackendSession() {
  const token = localStorage.getItem(BACKEND_TOKEN_KEY);
  const playerId = localStorage.getItem(BACKEND_PLAYER_ID_KEY);
  if (!token || !playerId) return null;
  return { token, playerId };
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, baseDispatch] = useReducer(gameReducer, initialState, (init) => {
    try {
      const saved = localStorage.getItem(SAVE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...init, ...parsed, achievements: { ...init.achievements, ...parsed.achievements } };
      }
    } catch { /* ignore */ }
    return init;
  });
  const pendingSyncRef = useRef({ clicks: 0, depthGain: 0 });
  const syncingRef = useRef(false);

  const dispatch = useCallback((action: GameAction) => {
    if (action.type === 'MINE') {
      pendingSyncRef.current.clicks += 1;
      pendingSyncRef.current.depthGain += action.depthGain;
    }

    if (action.type === 'LOGOUT') {
      pendingSyncRef.current = { clicks: 0, depthGain: 0 };
      clearBackendSession();
    }

    baseDispatch(action);
  }, []);

  // Passive mining interval
  useEffect(() => {
    const interval = setInterval(() => {
      if (state.isAuthenticated) dispatch({ type: 'AUTO_MINE' });
    }, 1000);
    return () => clearInterval(interval);
  }, [state.isAuthenticated]);

  // Auto-save
  useEffect(() => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  }, [state]);

  // Sync local progress to backend when authenticated with a backend token.
  useEffect(() => {
    if (!state.isAuthenticated) return;

    const interval = setInterval(async () => {
      if (syncingRef.current) return;

      const session = getBackendSession();
      if (!session?.token) return;

      const clicks = pendingSyncRef.current.clicks;
      const depthGain = Math.max(0, Math.floor(pendingSyncRef.current.depthGain));
      if (clicks <= 0 && depthGain <= 0) return;

      syncingRef.current = true;
      try {
        await syncGameProgress(session.token, { clicks, depth_gain: depthGain });
        pendingSyncRef.current.clicks = Math.max(0, pendingSyncRef.current.clicks - clicks);
        pendingSyncRef.current.depthGain = Math.max(0, pendingSyncRef.current.depthGain - depthGain);
        baseDispatch({ type: 'SYNCED' });
      } catch (error) {
        console.error('Backend sync failed:', error);
      } finally {
        syncingRef.current = false;
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [state.isAuthenticated]);

  const getCostForUpgrade = (upgradeId: keyof UpgradeLevels) => {
    const cfg = UPGRADES_CONFIG.find(u => u.id === upgradeId);
    if (!cfg) return 0;
    return getUpgradeCost(cfg, state.upgrades[upgradeId]);
  };

  const canAfford = (upgradeId: keyof UpgradeLevels) => {
    const cfg = UPGRADES_CONFIG.find(u => u.id === upgradeId);
    if (!cfg) return false;
    const cost = getUpgradeCost(cfg, state.upgrades[upgradeId]);
    return state.resources[cfg.costResource as keyof Resources] >= cost;
  };

  return (
    <GameContext.Provider value={{ state, dispatch, getUpgradeCost: getCostForUpgrade, getResourceForDepth, canAfford }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}

export { getUpgradeCost };