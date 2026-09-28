// Checks the Create Player pose prompts without spending real generations:
// six distinct instructions, calm-pose + full-body rules, framing lock, a
// stable default spread across poses, and client/server defaults in sync.
// Run: npm run test:pose
import { POSES, poseBlock, defaultPose, isPose } from '../supabase/functions/generate-avatar/pose.ts';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const blocks = POSES.map((p) => poseBlock(p));
assert.equal(new Set(blocks).size, 6, 'each pose has its own instruction');
for (const [i, p] of POSES.entries()) {
  const b = blocks[i];
  assert.match(b, /no jumping, spiking, diving, blocking, serving/, `${p}: calm rules`);
  assert.match(b, /nothing cropped/, `${p}: full body`);
  if (p !== 'ball_hold') assert.match(b, /change ONLY the pose/, `${p}: only pose changes`), assert.match(b, /framing, character size/, `${p}: framing lock`);
  console.log(`${p.padEnd(11)} ${b.slice(0, 150)}...`);
}
const ids = ['72e27023-a858-4983-9802-8a7af6c0d3e5', '00000000-0000-4000-8000-000000000001', 'a1b2c3d4-0000-4000-8000-123456789abc'];
for (const id of ids) assert.equal(defaultPose(id), defaultPose(id), 'stable');
console.log('defaults:', ids.map((id) => defaultPose(id)).join(', '));
const counts = Object.fromEntries(POSES.map((p) => [p, 0]));
for (let i = 0; i < 6000; i++) counts[defaultPose(crypto.randomUUID())]++;
console.log('spread over 6000 ids:', JSON.stringify(counts));
assert.ok(!isPose('jumping') && isPose('ready'));
// client and server default must be identical code
const body = (f) => readFileSync(f, 'utf8').match(/function defaultPose[\s\S]*?\n\}/)[0].replace(/["']/g, "'");
assert.equal(body('src/lib/playerPose.ts'), body('supabase/functions/generate-avatar/pose.ts'), 'client/server defaultPose in sync');
console.log('ALL POSE CHECKS PASSED');
