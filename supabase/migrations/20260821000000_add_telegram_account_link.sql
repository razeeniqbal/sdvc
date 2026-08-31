-- Lets an admin link their personal Telegram account to their profile, so the bot can
-- recognize a private DM as coming from a specific admin (as opposed to the group chat,
-- which is trusted wholesale today since it's a single known chat id).
--
-- Flow: admin clicks "Generate Link Code" on the website, which writes a short-lived
-- code to their own profile row (already permitted by the existing profiles_update_own
-- policy). They DM the bot "/link <code>"; the bot (service role, bypasses RLS) looks
-- the code up and — only if it matches and hasn't expired — stamps telegram_user_id
-- with the DM sender's real Telegram user id. The website never writes
-- telegram_user_id directly; only the bot does, after that verification.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS telegram_user_id bigint UNIQUE,
  ADD COLUMN IF NOT EXISTS telegram_link_code text,
  ADD COLUMN IF NOT EXISTS telegram_link_code_expires_at timestamptz;
