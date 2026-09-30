# VSB — Volleyball Sdn Bhd

The booking app and community for a Malaysian social volleyball club. Players find a game, see who's playing, book (with a friend), pay by QR, and build their own VSB player identity. Admins and organizers run sessions, payments and waiting lists from a separate console.

Live: [vsb.madebyrazeen.com](https://vsb.madebyrazeen.com)

## Tech stack

- [Vite](https://vitejs.dev/) + [React 18](https://react.dev/) + TypeScript
- [Tailwind CSS](https://tailwindcss.com/) (VSB V2 design system in `src/index.css` and `tailwind.config.js`)
- [React Router v6](https://reactrouter.com/)
- [react-i18next](https://react.i18next.com/): English + Bahasa Melayu
- [Supabase](https://supabase.com/): Postgres (RLS + guard triggers), Auth, Storage, Edge Functions, pg_cron
- [OpenAI Images](https://platform.openai.com/docs/guides/images) (image edits) for generated player art
- Hosted on [Vercel](https://vercel.com/), auto-deployed from `main`

## Features

### Players (VSB Play)
- **Home**: signed in, starts with your next game (**Pay now** while unpaid) and shortcuts; signed out, the club's public page
- **Sessions**: fixtures grouped This week / Next week / Later, with open-game count and public/private filter
- **Session details**: facts, price, capacity and booking in one panel; **Who's Playing** on the production court (gender, position, open slots, list view) and the **waiting list** in queue order
- **Booking**: book yourself plus **1 friend** (a typed-in guest or a registered VSB member), private sessions behind a passkey
- **Payment**: organizer's or club's DuitNow QR, receipt upload (alerts admins on Telegram with Approve / Reject buttons)
- **Holds**: unpaid places are held 12 hours (never past 2 hours before the game, at least 30 minutes); uploading a receipt stops the clock; expired places go to the waiting list automatically
- **My VSB**: player card, real activity (games, venues, upcoming), next on court, **Your Game** (self-described playstyle, vibe, experience, reasons), recent games, profile and account settings, community visibility, how to become an organizer (message an admin)
- **Create Player**: one photo becomes a personal VSB player in the house style, with a chosen pose and a glasses answer (1 free generation; admins can grant more)
- **My Games**: one timeline of upcoming and past games; **Booking details** is a game ticket
- **Community**: club roster grouped by position (members can hide themselves)
- **What's new**: one-time announcement per person, reopenable from the player menu

### Admin and organizer console (VSB Admin)
- Overview with "needs attention" items (receipts to verify, waiting lists, TBC prices)
- Sessions: create (optionally **recurring**, optionally with **starting players**), edit, per-session workspace (overview, bookings, waiting list, **+ Add players**)
- Bookings and Payments: search, filters, CSV export, receipt review, confirm / reject / refund
- Players: activity, profile, **give another avatar generation**, **make / remove organizer**, organizer applications
- Club settings: club QR, contact details, password resets, admins
- **Organizers** see only their own sessions, bookings and payments, and set their own payment QR (enforced in the database, not just the UI)

## Getting started

```bash
npm install
npm run dev
```

Create `.env` in the project root (never commit it):

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
# optional; defaults to https://vsb.madebyrazeen.com
VITE_SITE_URL=https://vsb.madebyrazeen.com
```

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test:pose` | Checks the pose list and default pose match between app and edge function |
| `npm run preview` | Preview the production build |

### Dev-only review routes

Only registered in `npm run dev`, never in production builds:

- `/__v2-preview`: components and session details with sample data
- `/__player-preview/myvsb|games|community|sessions|home` (add `?whatsnew` for the announcement): real pages for a sample profile, signed out
- `/__avatar-compare`: generated player review
- `/__admin-preview`: admin console layout without signing in

## Backend (Supabase)

- `supabase/migrations`: schema, RLS policies, guard triggers and database functions, applied in order. Changes are additive.
- `supabase/launch`: one-off launch scripts (V2 booking rules, done 30 Sep 2026) and the launch checklist.
- Scheduled job `vsb-booking-holds` (pg_cron, every 5 minutes): releases expired holds and fills free places from the waiting list.

### Edge Functions

| Function | Purpose |
| --- | --- |
| `phone-signup` | Creates an account from a phone number |
| `password-reset` | Player "forgot password" request |
| `reset-password` | Admin sets a temporary password |
| `delete-user` | Admin deletes an account |
| `generate-avatar` | Photo to VSB player art (entitlement, pose, glasses; deletes the source photo) |
| `telegram-notify` | Booking and receipt alerts to the club's Telegram chat (signed-in members only) |
| `telegram-webhook` | Telegram bot: Approve / Reject buttons and `/pending`, `/list`, `/reminder`, `/notify`, `/slotopen` |
| `whatsapp-notify` | WhatsApp notification integration |
| `cleanup-old-data` | Data retention: old receipt images and notifications after 30 days, sessions after a year (meant for a daily scheduled run) |

Secrets (Supabase → Edge Functions → Secrets): `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET`, `OPENAI_API_KEY`; optional `SITE_URL`, `OPENAI_IMAGE_MODEL`, `OPENAI_IMAGE_QUALITY`.

### Storage buckets

- `club-assets` (public read): club and organizer payment QR codes, session cover images
- `payment-receipts` (private, per-user folder): uploaded receipts
- `player-sources` (private): photos uploaded for player generation, deleted after each attempt
- `player-avatars` (public read): generated player art and thumbnails

## Deployment

Vercel builds and deploys `main` automatically. `vercel.json` rewrites all paths to `index.html` so direct links and refreshes work with client-side routing. The previous production deployment stays available as a one-click rollback in Vercel.

## Project conventions

Design and data rules (palette, full-width layout, player identity, no fabricated stats, RLS + guard triggers, i18n) are documented in [`CLAUDE.md`](CLAUDE.md).
