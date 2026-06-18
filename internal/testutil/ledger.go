package testutil

import (
	"database/sql"
	"path/filepath"
	"testing"

	"github.com/minibill/minibill/internal/domain"
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
		bg, fg := domain.RandomTagColors()
		_, _ = db.Exec(`INSERT OR IGNORE INTO tags (name, is_system, enabled, color_bg, color_fg, preset_key) VALUES (?,1,1,?,?,?)`, name, bg, fg, domain.DailyExpensePresetKey)
	}
	_, _ = db.Exec(`INSERT OR IGNORE INTO settings (id, locale, default_currency, default_date_mode, amount_color_scheme) VALUES (1,'zh-Hans','CNY','today','red_up')`)
	return db
}

func InsertTag(t *testing.T, db *sql.DB, name string) int64 {
	t.Helper()
	bg, fg := domain.RandomTagColors()
	res, err := db.Exec(
		`INSERT INTO tags (name, is_system, enabled, color_bg, color_fg) VALUES (?, 0, 1, ?, ?)`,
		name, bg, fg,
	)
	if err != nil {
		t.Fatal(err)
	}
	id, _ := res.LastInsertId()
	return id
}
