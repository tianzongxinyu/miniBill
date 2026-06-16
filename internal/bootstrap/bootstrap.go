package bootstrap

import (
	"fmt"

	"github.com/minibill/minibill/internal/auth"
	"github.com/minibill/minibill/internal/config"
	"github.com/minibill/minibill/internal/migrate"
	"github.com/minibill/minibill/internal/systemdb"
	"github.com/minibill/minibill/internal/userdb"
)

type System struct {
	Store   *systemdb.Store
	Cfg     config.Config
	Factory *userdb.Factory
}

func OpenSystem(cfg config.Config) (*System, error) {
	secret, err := config.EnsureJWTSecret(cfg.DataDir)
	if err != nil {
		return nil, err
	}
	cfg.JWTSecret = secret

	store, err := systemdb.Open(cfg.DataDir)
	if err != nil {
		return nil, err
	}
	if err := migrate.Run(store.DB(), cfg.MigrationsSystem); err != nil {
		store.Close()
		return nil, fmt.Errorf("system migrate: %w", err)
	}
	return &System{
		Store:   store,
		Cfg:     cfg,
		Factory: userdb.NewFactory(cfg.DataDir, cfg.MigrationsLedger),
	}, nil
}

func (s *System) Close() {
	if s.Factory != nil {
		s.Factory.CloseAll()
	}
	s.Store.Close()
}

func ProvisionUser(sys *System, username, password string) (*systemdb.User, error) {
	if err := auth.ValidateUsername(username); err != nil {
		return nil, err
	}
	if err := auth.ValidatePassword(password); err != nil {
		return nil, err
	}
	if existing, _ := sys.Store.GetByUsername(username); existing != nil {
		return nil, fmt.Errorf("username exists")
	}
	hash, err := auth.HashPassword(password)
	if err != nil {
		return nil, err
	}
	user, err := sys.Store.CreateUser(username, hash)
	if err != nil {
		return nil, err
	}
	if err := sys.Factory.InitLedger(user.ID, user.DataPath); err != nil {
		return nil, err
	}
	return user, nil
}
