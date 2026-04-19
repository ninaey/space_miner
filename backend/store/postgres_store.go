package store

import (
	"context"
	"errors"
	"time"

	"spacecolonyminer/backend/models"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("not found")

// ErrDuplicateTransaction is returned by RecordTransaction when the transaction
// has already been processed. Callers should treat this as a no-op (idempotent).
var ErrDuplicateTransaction = errors.New("transaction already processed")

type Repository interface {
	UpsertPlayerWithInitialState(ctx context.Context, playerID, username, email string) error
	GetPlayerByID(ctx context.Context, playerID string) (models.Player, error)
	GetGameState(ctx context.Context, playerID string) (models.GameState, error)
	UpdateGameStateAndSyncTime(ctx context.Context, playerID string, depthDelta int, ironDelta float64, syncAt time.Time) error
	GetFullGameState(ctx context.Context, playerID string) (models.FullGameState, error)
	GetStoreCatalog(ctx context.Context) ([]models.StoreItem, error)
	GetStoreItem(ctx context.Context, sku string) (models.StoreItem, error)
	PurchaseWithGems(ctx context.Context, playerID string, item models.StoreItem) error
	ApplyOfflineEarnings(ctx context.Context, playerID string, depthDelta int, syncAt time.Time) error
	RecordTransaction(ctx context.Context, transactionID int64, playerID, sku string, amount float64) error
	GrantGems(ctx context.Context, playerID string, amount int) error
	GrantItem(ctx context.Context, playerID, sku string) error
}

type PostgresStore struct {
	db *pgxpool.Pool
}

func NewPostgresStore(db *pgxpool.Pool) *PostgresStore {
	return &PostgresStore{db: db}
}

func (s *PostgresStore) UpsertPlayerWithInitialState(ctx context.Context, playerID, username, email string) error {
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
		INSERT INTO players (id, username, email)
		VALUES ($1, $2, $3)
		ON CONFLICT (id) DO UPDATE
		SET username = EXCLUDED.username,
		    email = COALESCE(EXCLUDED.email, players.email)
	`, playerID, username, nullableString(email))
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO game_state (player_id)
		VALUES ($1)
		ON CONFLICT (player_id) DO NOTHING
	`, playerID)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (s *PostgresStore) GetPlayerByID(ctx context.Context, playerID string) (models.Player, error) {
	var p models.Player
	err := s.db.QueryRow(ctx, `
		SELECT id, username, COALESCE(email, ''), gem_balance, last_sync_at, created_at
		FROM players
		WHERE id = $1
	`, playerID).Scan(&p.ID, &p.Username, &p.Email, &p.GemBalance, &p.LastSyncAt, &p.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Player{}, ErrNotFound
	}
	return p, err
}

func (s *PostgresStore) GetGameState(ctx context.Context, playerID string) (models.GameState, error) {
	var gs models.GameState
	err := s.db.QueryRow(ctx, `
		SELECT player_id, current_depth, total_iron_mined, storage_capacity_kg
		FROM game_state
		WHERE player_id = $1
	`, playerID).Scan(&gs.PlayerID, &gs.CurrentDepth, &gs.TotalIronMined, &gs.StorageCapacityKg)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.GameState{}, ErrNotFound
	}
	return gs, err
}

func (s *PostgresStore) UpdateGameStateAndSyncTime(ctx context.Context, playerID string, depthDelta int, ironDelta float64, syncAt time.Time) error {
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
		UPDATE game_state
		SET current_depth = current_depth + $2,
		    total_iron_mined = total_iron_mined + $3
		WHERE player_id = $1
	`, playerID, depthDelta, ironDelta)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, `
		UPDATE players
		SET last_sync_at = $2
		WHERE id = $1
	`, playerID, syncAt)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (s *PostgresStore) GetFullGameState(ctx context.Context, playerID string) (models.FullGameState, error) {
	player, err := s.GetPlayerByID(ctx, playerID)
	if err != nil {
		return models.FullGameState{}, err
	}
	gs, err := s.GetGameState(ctx, playerID)
	if err != nil {
		return models.FullGameState{}, err
	}

	inventory := make([]models.PlayerInventoryItem, 0)
	invRows, err := s.db.Query(ctx, `
		SELECT player_id, item_sku, acquired_at
		FROM player_inventory
		WHERE player_id = $1
		ORDER BY acquired_at DESC
	`, playerID)
	if err != nil {
		return models.FullGameState{}, err
	}
	defer invRows.Close()
	for invRows.Next() {
		var item models.PlayerInventoryItem
		if scanErr := invRows.Scan(&item.PlayerID, &item.ItemSKU, &item.AcquiredAt); scanErr != nil {
			return models.FullGameState{}, scanErr
		}
		inventory = append(inventory, item)
	}

	robots := make([]models.Robot, 0)
	robotRows, err := s.db.Query(ctx, `
		SELECT id, player_id, robot_type, level, purchased_at
		FROM robots
		WHERE player_id = $1
		ORDER BY id ASC
	`, playerID)
	if err != nil {
		return models.FullGameState{}, err
	}
	defer robotRows.Close()
	for robotRows.Next() {
		var robot models.Robot
		if scanErr := robotRows.Scan(&robot.ID, &robot.PlayerID, &robot.RobotType, &robot.Level, &robot.PurchasedAt); scanErr != nil {
			return models.FullGameState{}, scanErr
		}
		robots = append(robots, robot)
	}

	boosts := make([]models.ActiveBoost, 0)
	boostRows, err := s.db.Query(ctx, `
		SELECT id, player_id, item_sku, expires_at, COALESCE(effect_type, ''), COALESCE(effect_value, 0)
		FROM player_active_boosts
		WHERE player_id = $1 AND expires_at > NOW()
		ORDER BY expires_at ASC
	`, playerID)
	if err != nil {
		return models.FullGameState{}, err
	}
	defer boostRows.Close()
	for boostRows.Next() {
		var boost models.ActiveBoost
		if scanErr := boostRows.Scan(&boost.ID, &boost.PlayerID, &boost.ItemSKU, &boost.ExpiresAt, &boost.EffectType, &boost.EffectValue); scanErr != nil {
			return models.FullGameState{}, scanErr
		}
		boosts = append(boosts, boost)
	}

	return models.FullGameState{
		Player:       player,
		GameState:    gs,
		Inventory:    inventory,
		Robots:       robots,
		ActiveBoosts: boosts,
	}, nil
}

func (s *PostgresStore) GetStoreCatalog(ctx context.Context) ([]models.StoreItem, error) {
	rows, err := s.db.Query(ctx, `
		SELECT sku, name, category, currency_type, base_price, power_multiplier, gems_granted,
		       effect_type, effect_value, effect_duration_sec, one_time_purchase, featured
		FROM store_catalog
		ORDER BY featured DESC, base_price ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.StoreItem, 0)
	for rows.Next() {
		var item models.StoreItem
		if scanErr := rows.Scan(
			&item.SKU, &item.Name, &item.Category, &item.CurrencyType, &item.BasePrice,
			&item.PowerMultiplier, &item.GemsGranted, &item.EffectType, &item.EffectValue,
			&item.EffectDurationSec, &item.OneTimePurchase, &item.Featured,
		); scanErr != nil {
			return nil, scanErr
		}
		items = append(items, item)
	}

	return items, nil
}

func (s *PostgresStore) GetStoreItem(ctx context.Context, sku string) (models.StoreItem, error) {
	var item models.StoreItem
	err := s.db.QueryRow(ctx, `
		SELECT sku, name, category, currency_type, base_price, power_multiplier, gems_granted,
		       effect_type, effect_value, effect_duration_sec, one_time_purchase, featured
		FROM store_catalog
		WHERE sku = $1
	`, sku).Scan(
		&item.SKU, &item.Name, &item.Category, &item.CurrencyType, &item.BasePrice,
		&item.PowerMultiplier, &item.GemsGranted, &item.EffectType, &item.EffectValue,
		&item.EffectDurationSec, &item.OneTimePurchase, &item.Featured,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.StoreItem{}, ErrNotFound
	}
	return item, err
}

func (s *PostgresStore) PurchaseWithGems(ctx context.Context, playerID string, item models.StoreItem) error {
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx, `
		UPDATE players
		SET gem_balance = gem_balance - $2
		WHERE id = $1 AND gem_balance >= $2
	`, playerID, int(item.BasePrice))
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errors.New("insufficient gems")
	}

	if item.EffectDurationSec > 0 {
		_, err = tx.Exec(ctx, `
			INSERT INTO player_active_boosts (player_id, item_sku, expires_at, effect_type, effect_value)
			VALUES ($1, $2, NOW() + make_interval(secs => $3), $4, $5)
		`, playerID, item.SKU, item.EffectDurationSec, item.EffectType, item.EffectValue)
		if err != nil {
			return err
		}
	} else {
		_, err = tx.Exec(ctx, `
			INSERT INTO player_inventory (player_id, item_sku)
			VALUES ($1, $2)
			ON CONFLICT (player_id, item_sku) DO NOTHING
		`, playerID, item.SKU)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (s *PostgresStore) ApplyOfflineEarnings(ctx context.Context, playerID string, depthDelta int, syncAt time.Time) error {
	return s.UpdateGameStateAndSyncTime(ctx, playerID, depthDelta, float64(depthDelta), syncAt)
}

func (s *PostgresStore) RecordTransaction(ctx context.Context, transactionID int64, playerID, sku string, amount float64) error {
	tag, err := s.db.Exec(ctx, `
		INSERT INTO xsolla_transactions (transaction_id, player_id, sku, amount, status)
		VALUES ($1, $2, $3, $4, 'completed')
		ON CONFLICT (transaction_id) DO NOTHING
	`, transactionID, playerID, sku, amount)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrDuplicateTransaction
	}
	return nil
}

func (s *PostgresStore) GrantGems(ctx context.Context, playerID string, amount int) error {
	_, err := s.db.Exec(ctx, `
		UPDATE players
		SET gem_balance = gem_balance + $2
		WHERE id = $1
	`, playerID, amount)
	return err
}

func (s *PostgresStore) GrantItem(ctx context.Context, playerID, sku string) error {
	_, err := s.db.Exec(ctx, `
		INSERT INTO player_inventory (player_id, item_sku)
		VALUES ($1, $2)
		ON CONFLICT (player_id, item_sku) DO NOTHING
	`, playerID, sku)
	return err
}

func nullableString(value string) any {
	if value == "" {
		return nil
	}
	return value
}
