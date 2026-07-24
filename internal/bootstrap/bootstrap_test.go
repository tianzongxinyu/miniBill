package bootstrap_test

import (
	"path/filepath"
	"testing"

	"github.com/minibill/minibill/internal/bootstrap"
	"github.com/minibill/minibill/internal/config"

	_ "modernc.org/sqlite"
)

func TestResetUserPassword(t *testing.T) {
	dir := t.TempDir()
	cfg := config.Config{
		DataDir:           dir,
		AllowRegistration: true,
		JWTExpireDays:     7,
		MigrationsSystem:  filepath.Join("..", "..", "migrations", "system"),
		MigrationsLedger:  filepath.Join("..", "..", "migrations", "ledger"),
	}
	sys, err := bootstrap.OpenSystem(cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer sys.Close()

	user, err := bootstrap.ProvisionUser(sys, "alice", "secret1")
	if err != nil {
		t.Fatal(err)
	}
	if user.TokenVersion != 0 {
		t.Fatalf("initial token_version = %d, want 0", user.TokenVersion)
	}

	updated, err := bootstrap.ResetUserPassword(sys, "alice", "secret2")
	if err != nil {
		t.Fatal(err)
	}
	if updated.TokenVersion != 1 {
		t.Fatalf("after reset token_version = %d, want 1", updated.TokenVersion)
	}

	if _, err := bootstrap.ResetUserPassword(sys, "nobody", "secret2"); err == nil {
		t.Fatal("expected error for missing user")
	}
}
