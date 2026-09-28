import type { Pose } from '@/lib/playerPose';

// Simple pose outline for the pose picker: a neutral chibi figure (big head,
// small body) drawn in code. Not generated art: it only shows how the arms,
// legs and ball are placed. Decorative; the label next to it names the pose.

interface Figure { arms: string; legs: string; ball?: [number, number] }

const LEGS_STAND = 'M26 66 L25 92 M34 66 L35 92';
const LEGS_READY = 'M26 66 L19 79 L22 92 M34 66 L41 79 L38 92';

const FIGURES: Record<Pose, Figure> = {
  ball_hold: { arms: 'M21 40 L15 54 M39 40 L47 48 L40 57', legs: LEGS_STAND, ball: [13, 58] },
  front_hold: { arms: 'M21 40 L22 53 L27 57 M39 40 L38 53 L33 57', legs: LEGS_STAND, ball: [30, 55] },
  shoulder: { arms: 'M21 40 L16 62 M39 40 L48 36 L48 30', legs: LEGS_STAND, ball: [50, 24] },
  ready: { arms: 'M21 40 L16 51 L23 56 M39 40 L44 51 L37 56', legs: LEGS_READY },
  relaxed: { arms: 'M21 40 L15 64 M39 40 L44 63', legs: LEGS_STAND, ball: [14, 70] },
  confident: { arms: 'M21 40 L13 49 L19 58 M39 40 L44 63', legs: LEGS_STAND, ball: [14, 45] },
};

export function PoseIcon({ pose, className = '' }: { pose: Pose; className?: string }) {
  const f = FIGURES[pose];
  return (
    <svg viewBox="0 0 60 100" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="30" cy="20" r="13" />
      <path d="M21 38 Q30 34 39 38 L37 66 L23 66 Z" />
      <path d={f.arms} />
      <path d={f.legs} />
      {f.ball && <circle cx={f.ball[0]} cy={f.ball[1]} r="8" className="fill-vsb-500 stroke-vsb-200" strokeWidth="2" />}
    </svg>
  );
}
