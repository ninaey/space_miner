-- ══════════════════════════════════════════════════════════════════
-- 1. CORE PLAYER TABLES
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE players (
    id UUID PRIMARY KEY,                   -- From Xsolla JWT (sub)
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE,
    gem_balance INT DEFAULT 0,             -- Hard currency from Xsolla packs
    last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE game_state (
    player_id UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
    current_depth INT DEFAULT 0,
    total_iron_mined NUMERIC(20, 2) DEFAULT 0,
    storage_capacity_kg NUMERIC(20, 2) DEFAULT 10000.0 -- Default capacity
);

-- ══════════════════════════════════════════════════════════════════
-- 2. CATALOG & INVENTORY (The "Store Engine")
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE store_catalog (
    sku                  VARCHAR(50)     PRIMARY KEY,
    name                 VARCHAR(100)    NOT NULL,
    category             VARCHAR(20)     NOT NULL, -- drill, storage, booster, etc.
    currency_type        VARCHAR(10)     NOT NULL DEFAULT 'real', -- 'real' or 'gem'
    base_price           NUMERIC(15, 2)  NOT NULL DEFAULT 0,
    power_multiplier     FLOAT           NOT NULL DEFAULT 1.0,
    gems_granted         INT             NOT NULL DEFAULT 0,
    effect_type          VARCHAR(30)     NULL,
    effect_value         FLOAT           NULL,
    effect_duration_sec  INT             NOT NULL DEFAULT 0,
    one_time_purchase    BOOLEAN         NOT NULL DEFAULT FALSE,
    featured             BOOLEAN         NOT NULL DEFAULT FALSE
);

-- Tracks permanent unlocks (e.g., Super Drill, Cosmetic Frames)
CREATE TABLE player_inventory (
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    item_sku VARCHAR(50) REFERENCES store_catalog(sku),
    acquired_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (player_id, item_sku)
);

-- Tracks active timed boosts (e.g., Overclock, Auto-Sell)
CREATE TABLE player_active_boosts (
    id SERIAL PRIMARY KEY,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    item_sku VARCHAR(50) REFERENCES store_catalog(sku),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    effect_type VARCHAR(30),
    effect_value FLOAT
);

-- ══════════════════════════════════════════════════════════════════
-- 3. ROBOTS & TRANSACTIONS
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE robots (
    id SERIAL PRIMARY KEY,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    robot_type VARCHAR(30),
    level INT DEFAULT 1,
    purchased_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE xsolla_transactions (
    transaction_id BIGINT PRIMARY KEY,
    player_id UUID REFERENCES players(id),
    sku VARCHAR(50) REFERENCES store_catalog(sku),
    amount NUMERIC(10, 2),
    status VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ══════════════════════════════════════════════════════════════════
-- 4. DATA SEEDING (Your provided items)
-- ══════════════════════════════════════════════════════════════════

INSERT INTO store_catalog 
(sku, name, category, currency_type, base_price, power_multiplier, gems_granted, effect_type, effect_value, effect_duration_sec, one_time_purchase, featured)
VALUES
('super_drill', 'Super Drill Mk. II', 'drill', 'real', 4.99, 3.0, 0, 'clickBoost', 3.0, 0, TRUE, TRUE),
('inventory_expander', 'Inventory Expander', 'storage', 'real', 2.99, 2.0, 0, NULL, 2.0, 0, TRUE, TRUE),
('gem_pack_s', 'Gem Pack — Rookie', 'gems', 'real', 0.99, 1.0, 100, NULL, NULL, 0, FALSE, FALSE),
('gem_pack_m', 'Gem Pack — Commander', 'gems', 'real', 4.99, 1.1, 550, NULL, NULL, 0, FALSE, FALSE),
('gem_pack_l', 'Gem Pack — Admiral', 'gems', 'real', 9.99, 1.5, 1500, NULL, NULL, 0, FALSE, FALSE),
('turbo_drill_boost', 'Turbo Drill Boost', 'booster', 'gem', 50, 3.0, 0, 'clickBoost', 3.0, 0, FALSE, FALSE),
('depth_dive', 'Depth Dive', 'booster', 'gem', 75, 1.0, 0, 'depthBoost', 250.0, 0, FALSE, FALSE),
('drone_overclock', 'Drone Overclock', 'booster', 'gem', 80, 4.0, 0, 'droneBoost', 4.0, 60, FALSE, FALSE),
('mega_mine_burst', 'Mega Mine Burst', 'booster', 'gem', 30, 500.0, 0, 'mineBurst', 500.0, 0, FALSE, FALSE),
('auto_sell_module', 'Auto-Sell Module', 'booster', 'gem', 120, 1.0, 0, 'autoSell', 1.0, 300, FALSE, FALSE),
('storage_purge', 'Storage Purge Protocol', 'booster', 'gem', 100, 2.0, 0, 'doubleSell', 2.0, 0, FALSE, FALSE),
('neon_commander_frame', 'Neon Commander Frame', 'cosmetic', 'gem', 200, 1.0, 0, 'cosmetic', NULL, 0, TRUE, FALSE);