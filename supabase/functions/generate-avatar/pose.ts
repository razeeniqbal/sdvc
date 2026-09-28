// Player pose: presentation only (never derived from volleyball position).
// Six calm identity poses. The style master (Player #10) is drawn in
// ball_hold; every other pose asks the model to change ONLY the pose while
// keeping the master's camera angle, framing, scale and proportions, so the
// result still fits the player card, avatars and Who's Playing.
// Keep POSES + defaultPose in sync with src/lib/playerPose.ts.

export const POSES = ["ball_hold", "front_hold", "shoulder", "ready", "relaxed", "confident"] as const;
export type Pose = (typeof POSES)[number];

export function isPose(v: unknown): v is Pose {
  return typeof v === "string" && (POSES as readonly string[]).includes(v);
}

// Stable for a player (never random): FNV-1a of the user id.
export function defaultPose(userId: string): Pose {
  let h = 2166136261;
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return POSES[(h >>> 0) % POSES.length];
}

const POSE_INSTRUCTIONS: Record<Exclude<Pose, "ball_hold">, string> = {
  front_hold: "standing upright facing forward, holding the volleyball with both hands in front of the body at waist height, elbows relaxed",
  shoulder: "standing upright, one hand holding the volleyball resting on or just above the same shoulder, the other arm relaxed at the side",
  ready: "a relaxed volleyball ready stance: feet about shoulder-width apart, knees slightly bent, both hands loose in front at waist height, no volleyball",
  relaxed: "standing relaxed, the volleyball held low at the side in one hand with that arm hanging naturally, the other arm relaxed at the side",
  confident: "standing upright and confident, the volleyball tucked under one arm against the side of the body, the other arm relaxed at the side",
};

const CALM =
  "A calm standing identity pose, not an action shot: no jumping, spiking, diving, blocking, serving, running, falling, dramatic movement or foreshortening. " +
  "Both feet on the ground; the whole figure from the top of the head to the shoes, nothing cropped.";

export function poseBlock(pose: Pose): string {
  if (pose === "ball_hold") {
    return `POSE AND FRAMING: keep IMAGE 1's pose, camera angle and framing exactly (full body, volleyball held at the hip in one hand, other hand on the hip), adjusting only as the new body needs. ${CALM}`;
  }
  return `POSE: change ONLY the pose, to ${POSE_INSTRUCTIONS[pose]}. ` +
    "Keep IMAGE 1's camera angle, full-body framing, character size in the image, head-to-body proportion and illustration style exactly. " +
    CALM;
}
