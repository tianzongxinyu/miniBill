package fnosapi

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestPatchBackupDirEnv(t *testing.T) {
	dir := t.TempDir()
	dataDir := filepath.Join(dir, "data")
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		t.Fatal(err)
	}
	envPath := filepath.Join(dir, "minibill.env")
	if err := os.WriteFile(envPath, []byte("PORT=18080\nBACKUP_DIR=\nALLOW_REGISTRATION=true\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	backup := "/vol1/1000/backups"
	if err := PatchBackupDirEnv(dataDir, backup); err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile(envPath)
	if err != nil {
		t.Fatal(err)
	}
	want := "BACKUP_DIR='" + backup + "'"
	if !strings.Contains(string(raw), want) {
		t.Fatalf("env missing %q\n%s", want, raw)
	}

	if err := PatchBackupDirEnv(dataDir, ""); err != nil {
		t.Fatal(err)
	}
	raw, err = os.ReadFile(envPath)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(raw), "BACKUP_DIR=\n") && !strings.HasSuffix(strings.TrimSpace(string(raw)), "BACKUP_DIR=") {
		// Accept BACKUP_DIR= as a full line
		found := false
		for _, line := range strings.Split(string(raw), "\n") {
			if line == "BACKUP_DIR=" {
				found = true
				break
			}
		}
		if !found {
			t.Fatalf("expected empty BACKUP_DIR, got:\n%s", raw)
		}
	}
}

func TestEnvFilePath(t *testing.T) {
	got := EnvFilePath("/vol1/@appdata/minibill/data")
	want := filepath.Join("/vol1/@appdata/minibill", "minibill.env")
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}
