ALTER TABLE settings ADD COLUMN theme TEXT NOT NULL DEFAULT 'light'
  CHECK (theme IN ('light', 'dark', 'system'));
