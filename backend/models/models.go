package models

import "time"

type Player struct {
	ID         string    `json:"id"`
	Username   string    `json:"username"`
	Email      string    `json:"email,omitempty"`
	GemBalance int       `json:"gem_balance"`
	LastSyncAt time.Time `json:"last_sync_at"`
	CreatedAt  time.Time `json:"created_at"`
}

type GameState struct {
	PlayerID           string  `json:"player_id"`
	CurrentDepth       int     `json:"current_depth"`
	TotalIronMined     float64 `json:"total_iron_mined"`
	StorageCapacityKg  float64 `json:"storage_capacity_kg"`
	PassiveMiningRate  float64 `json:"passive_mining_rate"`
	DepthPerClickPower float64 `json:"depth_per_click_power"`
}

type StoreItem struct {
	SKU               string   `json:"sku"`
	Name              string   `json:"name"`
	Category          string   `json:"category"`
	CurrencyType      string   `json:"currency_type"`
	BasePrice         float64  `json:"base_price"`
	PowerMultiplier   float64  `json:"power_multiplier"`
	GemsGranted       int      `json:"gems_granted"`
	EffectType        *string  `json:"effect_type,omitempty"`
	EffectValue       *float64 `json:"effect_value,omitempty"`
	EffectDurationSec int      `json:"effect_duration_sec"`
	OneTimePurchase   bool     `json:"one_time_purchase"`
	Featured          bool     `json:"featured"`
}

type PlayerInventoryItem struct {
	PlayerID   string    `json:"player_id"`
	ItemSKU    string    `json:"item_sku"`
	AcquiredAt time.Time `json:"acquired_at"`
}

type ActiveBoost struct {
	ID          int       `json:"id"`
	PlayerID    string    `json:"player_id"`
	ItemSKU     string    `json:"item_sku"`
	ExpiresAt   time.Time `json:"expires_at"`
	EffectType  string    `json:"effect_type"`
	EffectValue float64   `json:"effect_value"`
}

type Robot struct {
	ID          int       `json:"id"`
	PlayerID    string    `json:"player_id"`
	RobotType   string    `json:"robot_type"`
	Level       int       `json:"level"`
	PurchasedAt time.Time `json:"purchased_at"`
}

type FullGameState struct {
	Player       Player                `json:"player"`
	GameState    GameState             `json:"game_state"`
	Inventory    []PlayerInventoryItem `json:"inventory"`
	Robots       []Robot               `json:"robots"`
	ActiveBoosts []ActiveBoost         `json:"active_boosts"`
}

type SyncPayload struct {
	Clicks    int `json:"clicks"`
	DepthGain int `json:"depth_gain"`
}

type ItemSummary struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}
