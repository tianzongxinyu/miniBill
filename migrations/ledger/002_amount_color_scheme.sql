ALTER TABLE settings ADD COLUMN amount_color_scheme TEXT NOT NULL DEFAULT 'red_up'
  CHECK (amount_color_scheme IN ('red_up', 'green_up'));
