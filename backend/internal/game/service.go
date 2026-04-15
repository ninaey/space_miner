package game

import (
	"context"
	"errors"
	"math"
	"time"

	"spacecolonyminer/backend/models"
	"spacecolonyminer/backend/store"
)

var ErrAntiCheat = errors.New("sync rejected by anti-cheat")

type Service struct {
	repo store.Repository
}

func NewService(repo store.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) LoginOrRegister(ctx context.Context, playerID, username, email string) error {
	return s.repo.UpsertPlayerWithInitialState(ctx, playerID, username, email)
}

func (s *Service) ApplyOfflineEarnings(ctx context.Context, playerID string) (int, error) {
	fullState, err := s.repo.GetFullGameState(ctx, playerID)
	if err != nil {
		return 0, err
	}

	elapsedSec := time.Since(fullState.Player.LastSyncAt).Seconds()
	if elapsedSec <= 0 {
		return 0, nil
	}

	passiveRate := computePassiveRate(fullState.Robots, fullState.ActiveBoosts)
	if passiveRate <= 0 {
		return 0, nil
	}

	depthGain := int(math.Floor(elapsedSec * passiveRate))
	if depthGain <= 0 {
		return 0, nil
	}

	err = s.repo.ApplyOfflineEarnings(ctx, playerID, depthGain, time.Now().UTC())
	if err != nil {
		return 0, err
	}

	return depthGain, nil
}

func (s *Service) GetFullState(ctx context.Context, playerID string) (models.FullGameState, error) {
	fullState, err := s.repo.GetFullGameState(ctx, playerID)
	if err != nil {
		return models.FullGameState{}, err
	}

	fullState.GameState.PassiveMiningRate = computePassiveRate(fullState.Robots, fullState.ActiveBoosts)
	fullState.GameState.DepthPerClickPower = computeDepthPerClick(fullState.Inventory, fullState.ActiveBoosts)
	return fullState, nil
}

func (s *Service) SyncProgress(ctx context.Context, playerID string, payload models.SyncPayload) error {
	if payload.Clicks < 0 || payload.DepthGain < 0 {
		return errors.New("clicks and depth_gain must be non-negative")
	}

	state, err := s.GetFullState(ctx, playerID)
	if err != nil {
		return err
	}

	maxAllowedGain := int(math.Ceil(float64(payload.Clicks)*state.GameState.DepthPerClickPower + state.GameState.PassiveMiningRate*10))
	if payload.DepthGain > maxAllowedGain {
		return ErrAntiCheat
	}

	return s.repo.UpdateGameStateAndSyncTime(
		ctx,
		playerID,
		payload.DepthGain,
		float64(payload.DepthGain),
		time.Now().UTC(),
	)
}

func (s *Service) GetCatalog(ctx context.Context) ([]models.StoreItem, error) {
	return s.repo.GetStoreCatalog(ctx)
}

func (s *Service) BuyGemItem(ctx context.Context, playerID, sku string) error {
	item, err := s.repo.GetStoreItem(ctx, sku)
	if err != nil {
		return err
	}
	if item.CurrencyType != "gem" {
		return errors.New("item is not purchasable with gems")
	}
	return s.repo.PurchaseWithGems(ctx, playerID, item)
}

func computePassiveRate(robots []models.Robot, boosts []models.ActiveBoost) float64 {
	baseRate := 0.2
	for _, robot := range robots {
		baseRate += float64(robot.Level) * 0.3
	}
	for _, boost := range boosts {
		if boost.EffectType == "droneBoost" {
			baseRate *= boost.EffectValue
		}
	}
	return baseRate
}

func computeDepthPerClick(inventory []models.PlayerInventoryItem, boosts []models.ActiveBoost) float64 {
	power := 1.0
	for _, item := range inventory {
		if item.ItemSKU == "super_drill" {
			power *= 3
		}
	}
	for _, boost := range boosts {
		if boost.EffectType == "clickBoost" {
			power *= boost.EffectValue
		}
		if boost.EffectType == "mineBurst" {
			power += boost.EffectValue
		}
		if boost.EffectType == "depthBoost" {
			power += boost.EffectValue / 100
		}
	}
	return power
}
