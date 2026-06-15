package userdb

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/minibill/minibill/internal/domain"
	"github.com/minibill/minibill/internal/migrate"
	"github.com/minibill/minibill/internal/sqliteutil"
)

var PresetTags = []string{"日常支出"}

type Factory struct {
	dataDir          string
	migrationsLedger string

	mu      sync.Mutex
	ledgers map[int64]*sql.DB
}

func NewFactory(dataDir, migrationsLedger string) *Factory {
	return &Factory{
		dataDir:          dataDir,
		migrationsLedger: migrationsLedger,
		ledgers:          make(map[int64]*sql.DB),
	}
}

func (f *Factory) LedgerPath(userID int64, dataPath string) (string, error) {
	clean := filepath.Clean(dataPath)
	if strings.Contains(clean, "..") {
		return "", fmt.Errorf("invalid data path")
	}
	expected := fmt.Sprintf("users/%d/ledger.db", userID)
	if clean != expected {
		return "", fmt.Errorf("data path mismatch")
	}
	return filepath.Join(f.dataDir, clean), nil
}

// Open 返回按 userID 缓存的长驻 *sql.DB，跨请求复用连接。
func (f *Factory) Open(userID int64, dataPath string) (*sql.DB, error) {
	f.mu.Lock()
	cached := f.ledgers[userID]
	f.mu.Unlock()

	if cached != nil {
		if err := cached.Ping(); err == nil {
			return cached, nil
		}
		f.mu.Lock()
		if f.ledgers[userID] == cached {
			_ = cached.Close()
			delete(f.ledgers, userID)
		}
		f.mu.Unlock()
	}

	path, err := f.LedgerPath(userID, dataPath)
	if err != nil {
		return nil, err
	}
	db, err := sqliteutil.Open(path)
	if err != nil {
		return nil, err
	}
	if err := f.prepareLedger(db); err != nil {
		_ = db.Close()
		return nil, err
	}

	f.mu.Lock()
	defer f.mu.Unlock()
	if existing := f.ledgers[userID]; existing != nil {
		_ = db.Close()
		if err := existing.Ping(); err == nil {
			return existing, nil
		}
		_ = existing.Close()
	}
	f.ledgers[userID] = db
	return db, nil
}

// CloseUser 关闭并移除指定用户的缓存连接。
func (f *Factory) CloseUser(userID int64) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if db := f.ledgers[userID]; db != nil {
		_ = db.Close()
		delete(f.ledgers, userID)
	}
}

// CloseAll 关闭全部用户账本连接，进程退出时调用。
func (f *Factory) CloseAll() {
	f.mu.Lock()
	defer f.mu.Unlock()
	for id, db := range f.ledgers {
		_ = db.Close()
		delete(f.ledgers, id)
	}
}

func (f *Factory) InitLedger(userID int64, dataPath string) error {
	path, err := f.LedgerPath(userID, dataPath)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	db, err := sqliteutil.Open(path)
	if err != nil {
		return err
	}
	defer db.Close()
	return f.prepareLedger(db)
}

func (f *Factory) prepareLedger(db *sql.DB) error {
	if err := migrate.Run(db, f.migrationsLedger); err != nil {
		return err
	}
	for _, name := range PresetTags {
		bg, fg := domain.RandomTagColors()
		if _, err := db.Exec(
			`INSERT OR IGNORE INTO tags (name, is_system, enabled, color_bg, color_fg) VALUES (?, 1, 1, ?, ?)`,
			name, bg, fg,
		); err != nil {
			return err
		}
	}
	_, err := db.Exec(`INSERT OR IGNORE INTO settings (id, default_currency, default_date_mode, amount_color_scheme) VALUES (1, 'CNY', 'today', 'red_up')`)
	return err
}
