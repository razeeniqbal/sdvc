/*
# Add short_name column and update defaults

1. Adds `short_name` column to profiles (a nickname/short display name).
   `full_name` remains for records, but `short_name` is used in the UI.
2. Copies existing full_name values to short_name as a default.
3. Updates the auto-profile trigger to use short_name from metadata.
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS short_name text;

-- Backfill from full_name
UPDATE profiles SET short_name = split_part(full_name, ' ', 1) WHERE short_name IS NULL;

-- Update the trigger to use short_name
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email, short_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New Player'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'short_name', COALESCE(NEW.raw_user_meta_data->>'full_name', 'Player'))
  );
  RETURN NEW;
END;
$$;
