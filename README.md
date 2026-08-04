# Volleyball Sdn Bhd

A session booking web app for a Malaysia-based volleyball club. Players sign up, browse and book sessions (solo or with companions), pay via DuitNow/CIMB QR, and upload their payment receipt. Admins manage sessions, bookings, attendance, waiting lists, and club settings.

Live app: [vsb-play.vercel.app](https://vsb-play.vercel.app)

## Tech stack

- [Vite](https://vitejs.dev/) + [React](https://react.dev/) + TypeScript
- [Tailwind CSS](https://tailwindcss.com/)
- [React Router v6](https://reactrouter.com/)
- [react-i18next](https://react.i18next.com/) — English + Bahasa Melayu (player-facing pages)
- [Supabase](https://supabase.com/) — Postgres, Auth, Storage, Edge Functions
- Deployed on [Vercel](https://vercel.com/)

## Features

- Phone or email sign-up/login, profile management
- Browse sessions, book a slot, and bring companions in the same checkout (shared `booking_group_id`)
- DuitNow/CIMB QR payment display with a tap-to-enlarge lightbox
- Payment receipt upload, relayed to the club owner via a Telegram bot
- Booking confirmation and booking history/details, including party members for group bookings
- Admin dashboard: sessions CRUD, bookings management (search, filters, CSV export, receipt viewing), attendance check-in, waiting list, and club settings (including QR code upload)
- Row Level Security on every table; admins and players see only what they're allowed to

## Getting started

```bash
npm install
npm run dev
```

### Environment variables

Create a `.env` file in the project root:

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check-free production build |
| `npm run typecheck` | Run `tsc --noEmit` |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview the production build locally |

## Backend (Supabase)

- `supabase/migrations` — schema, RLS policies, and DB functions, applied in order
- `supabase/functions` — Edge Functions:
  - `phone-signup` — creates an auth user from a phone number
  - `reset-password` — admin-triggered password reset
  - `delete-user` — admin-triggered account deletion
  - `telegram-notify` — sends booking/receipt notifications (text or photo) to the club's Telegram chat
  - `whatsapp-notify` — WhatsApp notification integration

Edge Functions that message Telegram require a `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` secret configured in the Supabase project (Dashboard → Edge Functions → Secrets).

Storage buckets:

- `club-assets` (public read) — club payment QR code
- `payment-receipts` (private, per-user folder) — uploaded payment receipts

## Deployment

Hosted on Vercel, auto-deployed from the `main` branch. `vercel.json` rewrites all paths to `index.html` so client-side routing (React Router) works on direct links and page refreshes.
