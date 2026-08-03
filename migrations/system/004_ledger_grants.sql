CREATE TABLE IF NOT EXISTS ledger_grants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_user_id INTEGER NOT NULL REFERENCES users(id),
    grantee_user_id INTEGER NOT NULL REFERENCES users(id),
    permission TEXT NOT NULL CHECK(permission IN ('read','edit')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(owner_user_id, grantee_user_id)
);

CREATE INDEX IF NOT EXISTS idx_ledger_grants_grantee ON ledger_grants(grantee_user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_grants_owner ON ledger_grants(owner_user_id);
