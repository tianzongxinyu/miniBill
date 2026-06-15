CREATE INDEX IF NOT EXISTS idx_tx_tags_tag ON transaction_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_tx_date_system_id ON transactions(transaction_date, is_system, id);
