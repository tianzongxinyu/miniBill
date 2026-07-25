package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestEnsureJWTSecretGeneratesAndReuses(t *testing.T) {
	dir := t.TempDir()

	secret1, err := EnsureJWTSecret(dir)
	if err != nil {
		t.Fatalf("first ensure: %v", err)
	}
	if len(secret1) < minJWTSecretLen {
		t.Fatalf("secret too short: %d", len(secret1))
	}

	path := filepath.Join(dir, jwtSecretFile)
	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("stat secret file: %v", err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("expected mode 0600, got %o", info.Mode().Perm())
	}

	secret2, err := EnsureJWTSecret(dir)
	if err != nil {
		t.Fatalf("second ensure: %v", err)
	}
	if secret1 != secret2 {
		t.Fatalf("expected same secret on reuse")
	}
}

func TestEnsureJWTSecretMigratesEnv(t *testing.T) {
	dir := t.TempDir()
	const legacy = "legacy-jwt-secret-at-least-32-chars-long"
	t.Setenv("JWT_SECRET", legacy)

	secret, err := EnsureJWTSecret(dir)
	if err != nil {
		t.Fatalf("ensure from env: %v", err)
	}
	if secret != legacy {
		t.Fatalf("expected legacy secret, got %q", secret)
	}

	t.Setenv("JWT_SECRET", "other-jwt-secret-at-least-32-chars-long")
	secret2, err := EnsureJWTSecret(dir)
	if err != nil {
		t.Fatalf("reuse file: %v", err)
	}
	if secret2 != legacy {
		t.Fatalf("expected file secret to win over env")
	}
}

func TestEnsureJWTSecretRejectsShortEnv(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("JWT_SECRET", "short")
	if _, err := EnsureJWTSecret(dir); err == nil {
		t.Fatal("expected error for short JWT_SECRET env")
	}
}

func TestResolvePathsFromExeLayout(t *testing.T) {
	root := t.TempDir()
	binDir := filepath.Join(root, "bin")
	sysDir := filepath.Join(root, "migrations", "system")
	ledDir := filepath.Join(root, "migrations", "ledger")
	if err := os.MkdirAll(binDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(sysDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(ledDir, 0o755); err != nil {
		t.Fatal(err)
	}

	cfg := Config{
		MigrationsSystem: "./migrations/system",
		MigrationsLedger: "./migrations/ledger",
	}
	cfg.resolvePathsFrom(binDir)
	if cfg.MigrationsSystem != sysDir {
		t.Fatalf("MigrationsSystem = %q, want %q", cfg.MigrationsSystem, sysDir)
	}
	if cfg.MigrationsLedger != ledDir {
		t.Fatalf("MigrationsLedger = %q, want %q", cfg.MigrationsLedger, ledDir)
	}
}

func TestResolvePathsKeepsExisting(t *testing.T) {
	root := t.TempDir()
	sysDir := filepath.Join(root, "already", "system")
	ledDir := filepath.Join(root, "already", "ledger")
	if err := os.MkdirAll(sysDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(ledDir, 0o755); err != nil {
		t.Fatal(err)
	}
	cfg := Config{MigrationsSystem: sysDir, MigrationsLedger: ledDir}
	cfg.resolvePathsFrom(filepath.Join(root, "bin"))
	if cfg.MigrationsSystem != sysDir || cfg.MigrationsLedger != ledDir {
		t.Fatalf("expected existing paths kept, got %#v", cfg)
	}
}

func TestResolveDataDirPrefersSystemDB(t *testing.T) {
	root := t.TempDir()
	empty := filepath.Join(root, "empty")
	good := filepath.Join(root, "good")
	if err := os.MkdirAll(empty, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(good, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(good, "system.db"), []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}

	cfg := Config{DataDir: "./data"}
	cfg.resolveDataDir([]string{empty, good})
	if cfg.DataDir != good {
		t.Fatalf("DataDir = %q, want %q", cfg.DataDir, good)
	}
}

func TestResolveDataDirKeepsWhenPresent(t *testing.T) {
	root := t.TempDir()
	current := filepath.Join(root, "current")
	other := filepath.Join(root, "other")
	if err := os.MkdirAll(current, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(other, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(current, "system.db"), []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(other, "system.db"), []byte("y"), 0o600); err != nil {
		t.Fatal(err)
	}

	cfg := Config{DataDir: current}
	cfg.resolveDataDir([]string{other})
	if cfg.DataDir != current {
		t.Fatalf("DataDir = %q, want keep %q", cfg.DataDir, current)
	}
}
