ALTER TABLE transactions ADD COLUMN is_system INTEGER NOT NULL DEFAULT 0;

INSERT OR IGNORE INTO tags (name, is_system, enabled) VALUES ('日常支出', 1, 1);

-- Backfill system daily-expense transactions from cached stat_monthly.
INSERT INTO transactions (amount, type, transaction_date, note, is_system, updated_at)
SELECT sm.daily_expense,
       'expense',
       date(printf('%04d-%02d-01', sm.year, sm.month), '+1 month', '-1 day'),
       '',
       1,
       datetime('now')
FROM stat_monthly sm
WHERE sm.daily_expense IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM transactions t
    WHERE t.is_system = 1
      AND t.transaction_date >= printf('%04d-%02d-01', sm.year, sm.month)
      AND t.transaction_date < date(printf('%04d-%02d-01', sm.year, sm.month), '+1 month')
  );

INSERT OR IGNORE INTO transaction_tags (transaction_id, tag_id)
SELECT t.id, (SELECT id FROM tags WHERE name = '日常支出')
FROM transactions t
WHERE t.is_system = 1;

CREATE INDEX IF NOT EXISTS idx_tx_system ON transactions(is_system);
