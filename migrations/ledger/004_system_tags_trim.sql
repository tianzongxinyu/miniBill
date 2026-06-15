-- 默认系统标签仅保留「人情」「日常支出」，其余原预设标签改为普通标签（未使用时可删除）
UPDATE tags SET is_system = 0 WHERE is_system = 1 AND name NOT IN ('人情', '日常支出');

INSERT OR IGNORE INTO tags (name, is_system, enabled) VALUES ('人情', 1, 1);
INSERT OR IGNORE INTO tags (name, is_system, enabled) VALUES ('日常支出', 1, 1);

UPDATE tags SET is_system = 1, enabled = 1 WHERE name IN ('人情', '日常支出');
