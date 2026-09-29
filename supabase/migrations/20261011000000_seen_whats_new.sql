/*
# "What's new" seen marker

profiles.seen_whats_new: the id of the last "What's new" announcement the
player dismissed (src/components/vsb/WhatsNew.tsx). Stored on the profile, not
in the browser, so each person sees an announcement once across devices.
Players update their own row (existing profiles_update_own policy; the role
guard is unaffected). Additive: V1 ignores it.
*/

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS seen_whats_new text;
