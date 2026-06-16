-- Remove unused social stats columns (「人情」 tag feature removed in 007).
ALTER TABLE stat_monthly DROP COLUMN social_income;
ALTER TABLE stat_monthly DROP COLUMN social_expense;
