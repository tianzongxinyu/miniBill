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

// ConfigurePool 限制同一 DB 文件的并发连接，降低 SQLITE_BUSY 风险。
func ConfigurePool(db *sql.DB) {
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
}
