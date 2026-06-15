CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contacts (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT NOT NULL,
    nickname       TEXT NOT NULL DEFAULT '',
    relation_group TEXT NOT NULL DEFAULT '',
    note           TEXT NOT NULL DEFAULT '',
    phone          TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS transactions (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    amount           INTEGER NOT NULL,
    type             TEXT NOT NULL CHECK(type IN ('income','expense')),
    transaction_date TEXT NOT NULL,
    note             TEXT NOT NULL DEFAULT '',
    contact_id       INTEGER REFERENCES contacts(id),
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_tx_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_tx_contact ON transactions(contact_id);

CREATE TABLE IF NOT EXISTS tags (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT NOT NULL UNIQUE,
    is_system INTEGER NOT NULL DEFAULT 0,
    enabled   INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS transaction_tags (
    transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    tag_id         INTEGER NOT NULL REFERENCES tags(id),
    PRIMARY KEY (transaction_id, tag_id)
);

CREATE TABLE IF NOT EXISTS transaction_links (
    transaction_id_a INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    transaction_id_b INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    PRIMARY KEY (transaction_id_a, transaction_id_b),
    CHECK (transaction_id_a < transaction_id_b)
);

CREATE TABLE IF NOT EXISTS monthly_balances (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    year       INTEGER NOT NULL,
    month      INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12),
    balance    INTEGER NOT NULL,
    note       TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (year, month)
);

CREATE TABLE IF NOT EXISTS settings (
    id                INTEGER PRIMARY KEY CHECK (id = 1),
    amount_threshold  INTEGER NOT NULL DEFAULT 10000,
    default_currency  TEXT NOT NULL DEFAULT 'CNY',
    default_date_mode TEXT NOT NULL DEFAULT 'today'
);

CREATE TABLE IF NOT EXISTS stat_monthly (
    year               INTEGER NOT NULL,
    month              INTEGER NOT NULL,
    total_income       INTEGER NOT NULL DEFAULT 0,
    total_expense      INTEGER NOT NULL DEFAULT 0,
    social_income      INTEGER NOT NULL DEFAULT 0,
    social_expense     INTEGER NOT NULL DEFAULT 0,
    registered_balance INTEGER,
    daily_expense      INTEGER,
    PRIMARY KEY (year, month)
);
