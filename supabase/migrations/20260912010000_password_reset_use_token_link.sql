-- Switches password reset from a typed 6-digit code to a clickable link. The admin
-- sends the link straight to the player's own WhatsApp (one tap, addressed to the
-- player's number and pre-filled), instead of the player copying a code by hand.
-- The token itself is what proves the request came from the admin's relay, same
-- security property as before, just less friction. No real requests exist yet
-- (feature was only just added), so a plain rename is safe.
ALTER TABLE password_reset_requests RENAME COLUMN code TO token;
