ALTER TABLE tags ADD COLUMN preset_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_preset_key ON tags(preset_key) WHERE preset_key IS NOT NULL;
UPDATE tags SET preset_key = 'daily_expense' WHERE is_system = 1 AND name = '日常支出';
