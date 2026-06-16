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
