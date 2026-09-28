/*
# V2 booking rules (run on launch day, see README.md)

NOT a migration: these change behaviour for everyone on the shared database, so
they only go live together with V2.

1. 12-hour hold. Every new unpaid booking gets `reserved_until`:
     now + 12h, but never later than 2h before the game starts,
     and never less than 30 minutes (late bookings still get a fair chance).
   Uploading a receipt stops the clock (the admin still has to verify it).
2. Expired holds are released every 5 minutes: the booking is cancelled with a
   reason and the player gets an in-app notification.
3. Free places go to the waiting list automatically, in queue order. The
   promoted player gets a normal unpaid booking (with its own hold) and a
   notification.
4. A player may bring at most 1 friend per booking (admins are exempt).
   Keep in sync with MAX_COMPANIONS in src/lib/bookingRules.ts.

The functions themselves are in
migrations/20261001000000_v2_booking_rule_functions.sql (already applied).

Safe to re-run.
*/

-- ---------------------------------------------------------------- hold ---

DROP TRIGGER IF EXISTS bookings_set_hold ON public.bookings;
CREATE TRIGGER bookings_set_hold
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_booking_hold();

-- ------------------------------------------------------ friend limit ---

DROP TRIGGER IF EXISTS bookings_companion_limit ON public.bookings;
CREATE TRIGGER bookings_companion_limit
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_companion_limit();

-- --------------------------------------- release holds + waiting list ---


-- Existing unpaid bookings: give them a fresh hold from launch time instead of
-- releasing them on the first run.
UPDATE public.bookings b
SET reserved_until = public.booking_hold_deadline(b.session_id)
FROM public.sessions se
WHERE se.id = b.session_id
  AND ((se.session_date + se.start_time) AT TIME ZONE 'Asia/Kuala_Lumpur') > now()
  AND b.booking_status = 'Pending Payment' AND b.payment_status <> 'Paid' AND b.receipt_path IS NULL;

-- Every 5 minutes.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'vsb-booking-holds';
SELECT cron.schedule('vsb-booking-holds', '*/5 * * * *', 'SELECT public.process_booking_holds()');
