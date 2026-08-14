CREATE TABLE IF NOT EXISTS recurring_rules (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    amount              INTEGER NOT NULL,
    type                TEXT NOT NULL CHECK(type IN ('income','expense')),
    day_of_month        INTEGER NOT NULL CHECK(day_of_month BETWEEN 1 AND 28),
    note                TEXT NOT NULL DEFAULT '',
    contact_id          INTEGER REFERENCES contacts(id),
    enabled             INTEGER NOT NULL DEFAULT 1,
    last_run_year_month TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_recurring_rules_enabled ON recurring_rules(enabled);

CREATE TABLE IF NOT EXISTS recurring_rule_tags (
    rule_id INTEGER NOT NULL REFERENCES recurring_rules(id) ON DELETE CASCADE,
    tag_id  INTEGER NOT NULL REFERENCES tags(id),
    PRIMARY KEY (rule_id, tag_id)
);
