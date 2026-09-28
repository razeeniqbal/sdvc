/*
# Session court photo

Optional photo of the venue/court per session, stored in the public
`club-assets` bucket (admins can already write there; organizers get their own
folder in the organizer migration). NULL = the app shows the VSB court artwork.
Additive: the V1 app ignores this column.
*/
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS cover_image_path text;
