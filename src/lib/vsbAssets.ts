// The one place VSB production artwork is referenced. Files live in
// public/assets/vsb/ and were generated from the locked production PNGs
// (resized / cropped / re-encoded only — never altered). Import from here
// instead of hardcoding paths.

const BASE = '/assets/vsb';

export interface Img {
  src: string;
  width: number;
  height: number;
}

const img = (path: string, width: number, height: number): Img => ({ src: `${BASE}/${path}`, width, height });

// A character in two sizes: full figure (large placements) and small figure
// (cards, lineups). Characters are illustration only; they never stand in
// for a real member's avatar.
export interface CharacterArt {
  full: Img;
  sm: Img;
}

const character = (folder: string, name: string, [w, h]: [number, number], [sw, sh]: [number, number]): CharacterArt => ({
  full: img(`${folder}/${name}.webp`, w, h),
  sm: img(`${folder}/${name}-sm.webp`, sw, sh),
});

export type StateArt = CharacterArt;
const state = (name: string, [w, h]: [number, number], [sw, sh]: [number, number]): StateArt => ({
  full: img(`states/${name}.webp`, w, h),
  sm: img(`states/${name}-sm.webp`, sw, sh),
});

const PLAYERS = [
  character('players', 'player-01', [528, 1100], [250, 520]),
  character('players', 'player-02', [549, 1100], [260, 520]),
  character('players', 'player-03', [558, 1100], [264, 520]),
  character('players', 'player-04', [523, 1100], [247, 520]),
  character('players', 'player-05', [536, 1100], [254, 520]),
  character('players', 'player-06', [544, 1100], [257, 520]),
  character('players', 'player-07', [568, 1100], [269, 520]),
] as const;

export const vsbAssets = {
  brand: {
    lockup: img('brand/vsb-lockup.webp', 1200, 411),
    lockupSm: img('brand/vsb-lockup-sm.webp', 600, 205),
    mark: img('brand/vsb-mark.webp', 800, 194),
    markSm: img('brand/vsb-mark-sm.webp', 320, 77),
  },
  hero: {
    desktop: img('hero/community-desktop.webp', 1852, 849),
    desktop1280: img('hero/community-desktop-1280.webp', 1280, 587),
    mobile: img('hero/community-mobile.webp', 1086, 1448),
    mobile750: img('hero/community-mobile-750.webp', 750, 1000),
    // arena sky + lights cropped from the mobile hero (no characters): player card backdrop
    cardArena: img('hero/card-arena.webp', 726, 516),
  },
  court: {
    horizontal: img('court/court-horizontal.webp', 2128, 739),
    horizontal1024: img('court/court-horizontal-1024.webp', 1024, 356),
    vertical: img('court/court-vertical.webp', 1122, 1402),
    vertical640: img('court/court-vertical-640.webp', 640, 800),
  },
  // Who's Playing backgrounds: the production courts cropped closer, with the
  // playing area measured from the artwork (percent of the image).
  // Players are placed inside `court`; `net` is the net line.
  roster: {
    horizontal: { image: img('court/court-roster-horizontal.webp', 1528, 739), court: { x0: 7.85, x1: 92.15, y0: 19.2, y1: 77.8 }, net: 50 },
    vertical: { image: img('court/court-roster-vertical.webp', 738, 1155), court: { x0: 12.9, x1: 87.1, y0: 6.7, y1: 93.1 }, net: 46.9 },
  },
  players: PLAYERS,
  // Character states — use purposefully, not decoratively:
  //   welcome   → onboarding / first visit
  //   celebrate → booking confirmed, payment verified, player created
  //   waiting   → waiting list, payment being verified
  //   neutral   → general identity / empty states (no dedicated art; player 01)
  states: {
    welcome: state('welcome', [546, 1100], [258, 520]),
    celebrate: state('celebrate', [539, 1100], [255, 520]),
    waiting: state('waiting', [569, 1100], [269, 520]),
    neutral: PLAYERS[0],
  },
} as const;

export type CharacterState = keyof typeof vsbAssets.states;

// `srcset` string for images with a smaller variant.
export const srcSet = (...imgs: Img[]) => imgs.map((i) => `${i.src} ${i.width}w`).join(', ');
