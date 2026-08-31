-- Reverts 20260821000000_add_telegram_account_link.sql — the DM-linking feature was
-- decided to be unnecessary shortly after being built (group-only bot access is
-- enough). Safe to drop outright: the columns were added and dropped within the same
-- session, before any admin actually linked an account, so there's no real data here.
ALTER TABLE profiles
  DROP COLUMN IF EXISTS telegram_user_id,
  DROP COLUMN IF EXISTS telegram_link_code,
  DROP COLUMN IF EXISTS telegram_link_code_expires_at;
