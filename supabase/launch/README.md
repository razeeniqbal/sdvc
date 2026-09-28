# V2 launch checklist

The live V1 app shares this database, so anything that changes behaviour for V1
users waits until V2 goes live on `vsb.madebyrazeen.com`. Do these in order on
launch day.

1. **Domain**: point `vsb.madebyrazeen.com` at the V2 Vercel deployment and set
   `VITE_SITE_URL=https://vsb.madebyrazeen.com` in Vercel (optional; it's the default).
2. **Function secret**: add `SITE_URL=https://vsb.madebyrazeen.com` under Supabase →
   Edge Functions → Secrets (optional; it's the default).
3. **Redeploy `telegram-webhook`**: new domain in links, 12-hour hold wording, booking
   link in WhatsApp reminders.
4. **Redeploy `telegram-notify`**: now needs a signed-in member. V1 sends the public
   anon key, so V1 receipt/booking alerts stop working after this step. Only do it
   once V1 is retired.
5. **Run `v2_launch_rules.sql`**: 1-friend-per-booking trigger, 12-hour hold trigger,
   and the cron job that releases expired holds and promotes the waiting list.
6. Update the live link in the repo `README.md`.
