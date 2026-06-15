package sqliteutil

import (
	"database/sql"

	_ "modernc.org/sqlite"
)

// 常用 SQLite 连接参数：外键、WAL、锁等待重试（毫秒）
const dsnParams = "_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)"

// Open 打开 SQLite 并配置适合单文件库的 connection pool。
func Open(path string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", path+"?"+dsnParams)
	if err != nil {
		return nil, err
	}
	ConfigurePool(db)
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}

// ConfigurePool WAL 模式下允许多读并发；写仍由 SQLite 串行化。
func ConfigurePool(db *sql.DB) {
	db.SetMaxOpenConns(4)
	db.SetMaxIdleConns(4)
}
