# UI Design Conventions

This app (volleyball session booking — Tailwind + React) drifted into generic
"AI slop" visual patterns during earlier iterations. These were deliberately
cleaned up. Follow these rules on any new UI work so it doesn't drift back.

## VSB V2 (in progress on `vsb-v2-revamp`)

Player-facing screens are being moved onto the VSB V2 brand (dark, athletic,
community-first). Source of truth: `VSB_V2_Revamp_PRD.md` (kept outside the repo).
Screens not yet migrated still use the V1 light/navy styling below — that's
expected mid-migration, don't "fix" them piecemeal.

- **Palette** (tailwind.config.js): `ink` (Deep Ink #0A0D12 background, plus
  800/700/600 raised surfaces), `vsb` (VSB Blue #168BFF — primary action,
  selected state), `chalk` (Court White #F4F1EA foreground), `ball`
  (Volleyball Orange #FF6B2C — restrained, special accent only), `muted`
  (Slate #687280 secondary text).
- **Primitives** (src/index.css): `.v2-surface`, `.v2-btn-primary`,
  `.v2-btn-secondary`, `.v2-chip`, `.v2-input`, `.v2-heading`. Headings use
  the condensed display face (`font-display`, Barlow Condensed), uppercase.
- **Logo**: `<VsbLogo />` only — sliced from the approved artwork in
  `public/brand/`. Never redraw the logo in CSS/SVG or reuse `/logo.jpg`.
- **Artwork carries no data.** Names, positions, counts, prices, dates are
  always rendered by React over/next to images, never baked into them.
- **No fabricated numbers.** No invented ratings, player counts, or stats —
  only what can be derived from real data.
- **Gender is explicit profile data only.** Never inferred from name, avatar,
  or photo. Always show it as text/label, not colour alone.
- **Admin stays operational.** Don't apply chibi/collectible styling to
  `/admin/*` — compact and data-dense.
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

7. **Solid backgrounds, not pastel gradient washes.** V2 pages are `bg-ink`;
   V1 pages not yet migrated are `bg-slate-50` / `bg-white`.

## When reviewing your own UI output

Before considering a component done, check it against the list above. If
you're about to write `backdrop-blur`, a second gradient on the same screen,
or an icon in front of a heading purely for "polish," stop and ask whether
it's earning its place.
