# UI Design Conventions

This app (volleyball session booking — Tailwind + React) drifted into generic
"AI slop" visual patterns during earlier iterations. These were deliberately
cleaned up. Follow these rules on any new UI work so it doesn't drift back.

## Rules

1. **One gradient per screen, reserved for the single true primary action.**
   `bg-gradient-to-r from-rose-500 to-orange-500` is the brand accent — it
   means "the one thing I want you to click here." Do not apply it to nav
   active-states, badges, avatars, or anything that repeats more than once
   on screen (e.g. a pill inside every card in a grid). Repeated elements
   get a solid color (`bg-rose-500`/`bg-rose-600`) instead.

2. **No glassmorphism on flat backgrounds.** `backdrop-blur` only makes
   sense over an image or another element with real detail behind it. Cards
   sitting on `bg-white` or `bg-slate-50` should just be
   `bg-white border border-slate-200` — that's what this app uses
   everywhere now. (The `.glass-card` CSS class was removed for this reason
   — don't re-add it for a flat-background card.)

3. **No decorative icon glued to every heading.** An icon before an `<h2>`
   needs to carry information (a status, a category) — not just be there
   because a heading "felt bare." If removing the icon loses no meaning,
   remove it.

4. **Ground chrome in the actual brand, not a generic icon.** Auth screens,
   loading states, etc. use `/logo.jpg` (the real club logo), not a
   Lucide icon (e.g. `Zap`) in a gradient badge standing in for a logo.

5. **No decorative motion.** No pulsing glow, floating blobs, or animated
   backgrounds unless they communicate real state (e.g. a spinner during a
   loading state is fine — `animate-spin` on `Loader2`).

6. **Color communicates status, not "which one hasn't been used yet."**
   Green = success/paid/confirmed, amber = pending/warning, red = 
   cancelled/error, slate = neutral/inactive. Keep this consistent with
   `src/components/StatusBadge.tsx`, which is the source of truth for
   status colors — don't invent new status-color mappings elsewhere.

7. **Solid backgrounds, not pastel gradient washes.** Page backgrounds are
   `bg-slate-50` or `bg-white`, not a three-stop pastel gradient
   (`from-rose-50 via-white to-orange-50`) — that reads as generic
   AI-template filler rather than an intentional design choice. The one
   exception is the navbar/footer's dark brand gradient
   (`from-slate-900 via-rose-950 to-slate-900`), which is used exactly
   twice as bookend chrome, not scattered throughout.

## When reviewing your own UI output

Before considering a component done, check it against the list above. If
you're about to write `backdrop-blur`, a second/third gradient on the same
screen, or an icon in front of a heading purely for "polish," stop and ask
whether it's earning its place.
