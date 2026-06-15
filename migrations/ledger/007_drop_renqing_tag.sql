-- 删除「人情」标签及关联
DELETE FROM transaction_tags WHERE tag_id IN (SELECT id FROM tags WHERE name = '人情');
DELETE FROM tags WHERE name = '人情';

-- 标签配色字段（深色背景 + 白字）
ALTER TABLE tags ADD COLUMN color_bg TEXT NOT NULL DEFAULT '#3B6FA8';
ALTER TABLE tags ADD COLUMN color_fg TEXT NOT NULL DEFAULT '#ffffff';

-- 系统标签仅保留「日常支出」
UPDATE tags SET is_system = 0 WHERE is_system = 1 AND name != '日常支出';
INSERT OR IGNORE INTO tags (name, is_system, enabled, color_bg, color_fg)
VALUES ('日常支出', 1, 1, '#5A7A3C', '#ffffff');
UPDATE tags SET is_system = 1, enabled = 1, color_bg = '#5A7A3C', color_fg = '#ffffff'
WHERE name = '日常支出';

UPDATE stat_monthly SET social_income = 0, social_expense = 0;
