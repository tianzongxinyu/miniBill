package userdb_test

import (
	"database/sql"
	"os"
	"path/filepath"
	"testing"

	"github.com/minibill/minibill/internal/userdb"

	_ "modernc.org/sqlite"
)

func TestFactoryOpenCachesPerUser(t *testing.T) {
	dir := t.TempDir()
	f := userdb.NewFactory(dir, filepath.Join("..", "..", "migrations", "ledger"))

	const dataPath = "users/1/ledger.db"
	if err := f.InitLedger(1, dataPath); err != nil {
		t.Fatal(err)
	}
	defer f.CloseAll()

	db1, err := f.Open(1, dataPath)
	if err != nil {
		t.Fatal(err)
	}
	db2, err := f.Open(1, dataPath)
	if err != nil {
		t.Fatal(err)
	}
	if db1 != db2 {
		t.Fatal("expected cached *sql.DB instance for same user")
	}

	f.CloseUser(1)
	db3, err := f.Open(1, dataPath)
	if err != nil {
		t.Fatal(err)
	}
	if db3 == db1 {
		t.Fatal("expected new *sql.DB after CloseUser")
	}
}

func TestFactoryOpenMigratesExistingLedger(t *testing.T) {
	dir := t.TempDir()
	migrations := filepath.Join("..", "..", "migrations", "ledger")
	f := userdb.NewFactory(dir, migrations)

	const dataPath = "users/1/ledger.db"
	path, err := f.LedgerPath(1, dataPath)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}

	body, err := os.ReadFile(filepath.Join(migrations, "001_schema.sql"))
	if err != nil {
		t.Fatal(err)
	}
	db, err := sql.Open("sqlite", path+"?_pragma=foreign_keys(1)")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(string(body)); err != nil {
		t.Fatal(err)
	}
	_, _ = db.Exec(`INSERT OR IGNORE INTO settings (id) VALUES (1)`)
	_ = db.Close()

	opened, err := f.Open(1, dataPath)
	if err != nil {
		t.Fatal(err)
	}
	defer f.CloseAll()

	var scheme string
	if err := opened.QueryRow(`SELECT amount_color_scheme FROM settings WHERE id=1`).Scan(&scheme); err != nil {
		t.Fatalf("amount_color_scheme missing after Open migrate: %v", err)
	}
	if scheme != "red_up" {
		t.Fatalf("amount_color_scheme = %q, want red_up", scheme)
	}
}
