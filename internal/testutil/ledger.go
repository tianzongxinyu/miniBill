package testutil

import (
	"database/sql"
	"path/filepath"
	"testing"

	"github.com/minibill/minibill/internal/migrate"
	"github.com/minibill/minibill/internal/userdb"

	_ "modernc.org/sqlite"
)

func OpenLedgerDB(t *testing.T) *sql.DB {
	t.Helper()
	dir := t.TempDir()
	path := filepath.Join(dir, "ledger.db")
	db, err := sql.Open("sqlite", path+"?_pragma=foreign_keys(1)")
	if err != nil {
		t.Fatal(err)
	}
	if err := migrate.Run(db, filepath.Join("..", "..", "migrations", "ledger")); err != nil {
		t.Fatal(err)
	}
	for _, name := range userdb.PresetTags {
		_, _ = db.Exec(`INSERT OR IGNORE INTO tags (name, is_system, enabled) VALUES (?,1,1)`, name)
	}
	_, _ = db.Exec(`INSERT OR IGNORE INTO settings (id) VALUES (1)`)
	return db
}
