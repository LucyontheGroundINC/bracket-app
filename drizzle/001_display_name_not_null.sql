-- 1) Backfill display_name for any existing users
UPDATE users
SET display_name = split_part(email, '@', 1)
WHERE display_name IS NULL;

-- 2) Enforce NOT NULL constraint
ALTER TABLE users
ALTER COLUMN display_name SET NOT NULL;
