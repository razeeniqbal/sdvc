# UI Design Conventions

This app (volleyball session booking — Tailwind + React) drifted into generic
"AI slop" visual patterns during earlier iterations. These were deliberately
cleaned up. Follow these rules on any new UI work so it doesn't drift back.

## VSB V2 (on `vsb-v2-revamp`)

Player-facing screens are being moved onto the VSB V2 brand (dark, athletic,
community-first). Source of truth: `VSB_V2_Revamp_PRD.md` (kept outside the repo).
Two experiences, one design system:
- **VSB Play** (`PlayShell` in App.tsx): public + player screens — navbar,
  footer, mobile tab bar. Primary nav is only SESSIONS (+ COMMUNITY once it
  exists); everything personal (My Games = /bookings, profile, card, account)
  lives under **My VSB** (/profile) via the avatar menu. Routes ≠ navigation.
- **VSB Admin** (`AdminShell`, src/components/admin): its own full-height
  console — sidebar on desktop, header + drawer below lg, no consumer
  navbar/footer. The waiting list lives inside the session workspace
  (/admin/sessions/:id/…), never in global admin nav. Admin uses
  `.adm-*` primitives and `AdminUI` (Stat, OpsBadge, SectionTitle); don't reuse
  player components like SessionCard there. Booking/payment actions live once
  in `lib/adminBookings.ts` and the shared `BookingDetailSheet` — Bookings,
  Payments and the session workspace all use them; never re-implement them.
- **Player stats** come from `playerActivity` in `lib/myGames.ts` (see Player
  identity below). Game states are booking status + date only.
- Player session details is one scrollable page (no tabs); tabs are for
  operational context switching (admin session workspace).

- **Palette** (tailwind.config.js): `ink` (Deep Ink #0A0D12 background, plus
  800/700/600 raised surfaces), `vsb` (VSB Blue #168BFF — primary action,
  selected state), `chalk` (Court White #F4F1EA foreground), `ball`
  (Volleyball Orange #FF6B2C — restrained, special accent only), `muted`
  (secondary text, #838D9C — brand Slate #687280 lifted to pass WCAG AA on ink;
  brand value kept as `slate-brand` for non-text use). Filled buttons and
  selected states use `vsb-600` so white text passes AA; `vsb-500` is for
  accents, borders and text on ink.
- **Schema changes are additive and deliberate.** Player-identity migration
  (`20260929000000_vsb_player_avatars.sql`) added `player_avatars`,
  `player_avatar_generations`, `player_avatar_grants`, the
  `session_player_roster` RPC and the `player-sources` (private) /
  `player-avatars` (public) buckets. Players still can only read their own
  profile — other players' data comes only through SECURITY DEFINER RPCs.
- **RLS says *which rows*, triggers say *what may change*.** Own-row policies
  on `profiles`, `bookings` and `waiting_list` are backed by guard triggers
  (`guard_profile_role`, `guard_player_booking`, `guard_player_waitlist`) that
  only allow the writes the app offers players: sign up as 'player', book as
  'Pending Payment' at the session price, upload a receipt, link a friend
  group once, cancel, join/leave the queue. Status, payment, price, hold and
  role changes go through admins or SECURITY DEFINER RPCs. Payments are
  admin-only. A new player-side write needs the guard updated in the same
  migration.
- **Behaviour changes wait for launch.** V1 on `main` shares this database.
  Anything that changes what V1 users experience lives in
  `supabase/launch/` (see its README) instead of `migrations/`.
- **Player identity = profile facts + Your Game + real activity**, never
  mixed up and never a rating. Profile facts: name, position, level, member
  since. Your Game (`src/lib/yourGame.ts`, profiles.game_vibe / playstyle /
  experience_range / play_reasons, CHECK-validated machine values): the
  player's own description, optional, never gates booking. Real activity
  (`playerActivity`): games = past sessions with a Confirmed/Completed booking,
  venues = distinct venues of those, upcoming. No attendance anywhere in V2
  (the table stays for V1, which shares the database), no ratings,
  no invented jersey numbers.
- **Player card composition** follows the approved V2 concept: the generated
  character dominates the top and fades into the identity panel; position
  abbreviation + VSB mark top-left; name, then position | level; then
  "N GAMES" and at most two Your Game tags. No gender. Sized in card-width
  units (cqw) so phone cards scale, not shrink.
- **Player pose** (`profiles.player_pose`: ball_hold | front_hold | shoulder |
  ready | relaxed | confident) is presentation only, never derived from
  position. Chosen in Create Player or, if skipped, a stable default from the
  user id (never random), saved and kept for regenerations. Prompt text lives
  in `supabase/functions/generate-avatar/pose.ts`; keep `POSES`/`defaultPose`
  in sync with `src/lib/playerPose.ts` (`npm run test:pose` checks both).
- **Glasses** (`profiles.wears_glasses`) are the player's own Yes/No answer
  in Create Player's pose step (required to continue), never the model's
  guess from the photo: yes = match their frames, no = no eyewear at all,
  unanswered = only if clearly worn. `VSB_PLAYER_V6`; each attempt records
  `glasses` on `player_avatar_generations`.
- **Avatar generation** runs in the `generate-avatar` edge function, which
  owns the entitlement (1 free + admin grants, admins unlimited by DB role,
  idempotent, failed attempts don't count) and deletes source photos. Never
  decide entitlement in the client. `VSB_PLAYER_V4` (V3 + no jersey number: VSB has no real numbers, so none is
  ever invented) is an image EDIT
  (`/v1/images/edits`, `input_fidelity: high`, default model
  `gpt-image-1.5` with a recorded fallback to `gpt-image-1`): image 1 is the
  lossless production Player #10 on the 1024x1536 output canvas
  (`public/brand/avatar-style-v3.png`, pinned by SHA-256), image 2 the photo
  (identity only). The task is "keep image 1's system, swap the identity",
  not "draw a character in this style". Change the file, `STYLE_SHA256`,
  `STYLE_VERSION` and `PROMPT_VERSION` together. Attempts record prompt
  version, model and provider request id; earlier results are kept. Review
  results at the dev-only `/__avatar-compare`. Name, stats and frame are drawn
  by `PlayerCard`. The OpenAI key lives only in Supabase Edge Function
  secrets (`OPENAI_API_KEY`).
- **Full-width layout.** Player screens run edge to edge: sections use
  `.vsb-gutter` / `.vsb-section` (`padding-inline: clamp(20px, 3vw, 64px)`) and
  `FullWidthSection` / `SectionHeader` (src/components/layout/Section.tsx) —
  not a centred `max-w-* mx-auto` page container. Readable widths go on text
  blocks inside sections. Cards only for real objects (session, ticket, player
  card); otherwise thin `border-ink-600` rules and typography.
- **One dominant idea per route**, not one template: Home = the community
  (hero fills the first viewport, then real sessions, community, identity,
  good to know); Sessions = fixtures grouped This week / Next week / Later;
  Session details = this game (court | facts, price, action) then a
  full-width Who's Playing; My VSB = identity, then next on court | your
  game, recent games, and settings in one quieter band; My Games = one
  timeline (upcoming, then history by year and month; no tabs); Booking
  details = a game ticket (game | perforated stub with holder, reference,
  status); Checkout = your game | your slot; Confirmation = "You're on
  court." with the player's own generated player; Auth = `AuthLayout`
  (brand art | form, form only on phones).
- **Environmental language** (index.css): `.vsb-index` ("01 / PEOPLE") and
  `.vsb-watermark` (one very faint word behind a composition). Watermarks
  are rare: Home's closing CTA and the My VSB identity (the player's
  position) only. Never decorate empty space; fix the composition instead.
- **What's new** (`components/vsb/WhatsNew.tsx`): a one-time announcement per
  person, dismissed state on `profiles.seen_whats_new` (not the browser).
  Bump `ANNOUNCEMENT` for the next one. Never shown on auth, admin or
  Create Player routes.
- **Signed-in Home** starts with `MemberShortcuts`: next game (Pay now while
  unpaid, links to `/bookings/:id#pay`) and four shortcuts. Login lands on `/`.
- **Starting players** (`add_session_starters`, `lib/starters.ts`,
  `components/admin/StarterPicker.tsx`): admins (any session) and organizers
  (their own) book members straight in as Confirmed, RM0, marked Paid, so
  they never owe and are never released. From Create session (repeats for
  recurring weeks) and from a session's Overview (+ Add players).
- **Organizers**: players apply in My VSB (hidden for admins); admins approve
  in Admin -> Players, or use Make/Remove organizer on a player
  (`set_organizer`, never touches admins).
- **Loading states** use the skeletons in `components/vsb/Skeletons.tsx`
  shaped like the real content (fixture, list, roster, ticket, session,
  identity). No full-page spinners on player routes; spinners only inside
  buttons or for in-progress generation.
- **Dev review routes** (DEV only, never in production bundles):
  `/__v2-preview` (components + session details with sample data),
  `/__player-preview/myvsb|games|community|sessions|home` (add `?whatsnew` to show the announcement; real pages for a sample profile
  via `PreviewAuthProvider`, signed out, nothing written),
  `/__avatar-compare`, `/__admin-preview`.
- **Type scale.** 16px root everywhere. Display type uses `.vsb-display` /
  `.vsb-meta` (player) and `.adm-title` / `.adm-label` / `.adm-num` (admin).
- **Primitives** (src/index.css): `.v2-surface`, `.v2-btn-primary`,
  `.v2-btn-secondary`, `.v2-chip`, `.v2-input`, `.v2-heading`, `.vsb-tab`
  (underline tabs/filters — not pills). Court geometry: `<CourtLines />`. Headings use
  the condensed display face (`font-display`, Barlow Condensed), uppercase.
- **Production artwork is locked** and lives in `public/assets/vsb/`
  (brand, hero, court, players, states), generated from the supplied PNGs by
  resizing/cropping/re-encoding only. Reference it **only through
  `src/lib/vsbAssets.ts`** — never hardcode a path. `public/brand/` now only
  holds the hash-pinned avatar style master.
- **Logo**: `<VsbLogo variant="lockup|mark" />` only. Never redraw, stretch,
  box or recolour it.
- **Characters** are illustration for marketing surfaces only. A member's
  avatar is either their own generated player or their initial; never a
  stand-in character (it reads as if they generated it). State art
  (welcome / celebrate / waiting / neutral) is for those moments only; keep
  it out of Admin.
- **Gender** shows as blue ♂ / pink ♀ (`src/lib/gender.ts`), always with the
  symbol and a spoken label, only from profile data.
- **Copy**: no em dashes in UI text; time ranges use `v2.session.timeRange`.
- **Who's Playing** places players on the production wood court
  (`vsbAssets.roster`, playing area measured from the art) via `CourtRoster`:
  up to 24 on court on desktop, 18 on phones, the rest on a row underneath.
- **Artwork carries no data.** Names, positions, counts, prices, dates are
  always rendered by React over/next to images, never baked into them.
- **No fabricated numbers.** No invented ratings, player counts, or stats —
  only what can be derived from real data.
- **Gender is explicit profile data only.** Never inferred from name, avatar,
  or photo. Always show it as text/label, not colour alone.
- **Admin stays operational.** No chibi/collectible styling or marketing
  typography in `/admin/*` — compact, data-dense, uses the full width beside
  the sidebar. Player avatars are fine where they identify people.
- **i18n**: all new player copy goes through `t()` with keys in both
  `en.json` and `ms.json`.

## Rules

1. **One gradient per screen, max** — and only when it's earning its place
   (e.g. a scrim so text stays legible over the hero image). Primary actions
   are solid VSB Blue, not gradients. Repeated elements never get gradients.

2. **No glassmorphism on flat backgrounds.** `backdrop-blur` only makes
   sense over an image or another element with real detail behind it. Cards
   on the ink background are `.v2-surface` (solid ink-800 + ink-600 border).

3. **No decorative icon glued to every heading.** An icon before an `<h2>`
   needs to carry information (a status, a category) — not just be there
   because a heading "felt bare." If removing the icon loses no meaning,
   remove it.

4. **Ground chrome in the actual brand, not a generic icon.** Auth screens,
   loading states, nav and footer use `<VsbLogo />`, not a Lucide icon in a
   gradient badge standing in for a logo.

5. **No decorative motion.** No pulsing glow, floating blobs, or animated
   backgrounds unless they communicate real state (e.g. a spinner during a
   loading state is fine — `animate-spin` on `Loader2`). Respect
   `prefers-reduced-motion`.

6. **Color communicates status, not "which one hasn't been used yet."**
   Green = success/paid/confirmed, amber = pending/warning, red =
   cancelled/error, slate = neutral/inactive. Keep this consistent with
   `src/components/StatusBadge.tsx`, which is the source of truth for
   status colors — don't invent new status-color mappings elsewhere.

7. **Solid backgrounds, not pastel gradient washes.** Player pages are
   `bg-ink`; the admin workspace is `bg-ink-850` beside an `bg-ink` sidebar.

## When reviewing your own UI output

Before considering a component done, check it against the list above. If
you're about to write `backdrop-blur`, a second gradient on the same screen,
or an icon in front of a heading purely for "polish," stop and ask whether
it's earning its place.
