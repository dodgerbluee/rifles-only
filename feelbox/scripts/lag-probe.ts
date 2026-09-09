/**
 * Measures dedicated-sim cost and the client staircase that snapshots
 * produce when the browser does not predict movement.
 */
import { createSim } from "../src/sim.ts";
import { emptyInput, reconcilePos } from "../src/peers.ts";

const TICK_HZ = 30;
const SNAP_HZ = 18;
const FRAME_HZ = 60;
const TICKS = 180;

const sim = createSim({ name: "Last Wire" });
sim.join(1, "probe");
sim.setInput(1, { ...emptyInput(), keys: ["KeyW"], yaw: 0 });

const t0 = performance.now();
for (let i = 0; i < TICKS; i++) sim.tick(1 / TICK_HZ);
const tickMs = (performance.now() - t0) / TICKS;

const snap = sim.snapshot();
const bytes = JSON.stringify({ type: "snapshot", snapshot: snap }).length;
const me = snap.pawns.find((p) => p.netId === 1);
if (!me) {
  console.error("no seated pawn");
  process.exit(1);
}

const speed = Math.hypot(me.x, me.z) / (TICKS / TICK_HZ);
let freezeFrames = 0;
let movingFrames = 0;
let x = 0;
const snapEvery = FRAME_HZ / SNAP_HZ;
for (let f = 0; f < FRAME_HZ; f++) {
  const nx = ((f / snapEvery) | 0) * (speed / SNAP_HZ);
  if (f > 0 && Math.abs(nx - x) < 1e-9) freezeFrames += 1;
  else if (f > 0) movingFrames += 1;
  x = nx;
}
const freezeRatio = freezeFrames / (freezeFrames + movingFrames);

let predX = 0;
let predFreeze = 0;
let snapX = 0;
const walk = 5.85;
const dt = 1 / FRAME_HZ;
for (let f = 1; f <= FRAME_HZ; f++) {
  const before = predX;
  predX += walk * dt;
  if (f % Math.round(FRAME_HZ / SNAP_HZ) === 0) {
    snapX += walk * (1 / SNAP_HZ);
    predX = reconcilePos(predX, 0, 0, snapX, 0, 0).x;
  }
  if (Math.abs(predX - before) < 1e-9) predFreeze += 1;
}
const predFreezeRatio = predFreeze / FRAME_HZ;

const hard = reconcilePos(0, 0, 0, 8, 0, 0);
const blend = reconcilePos(0, 0, 0, 0.4, 0, 0);

console.log(
  JSON.stringify(
    {
      tickMs: Number(tickMs.toFixed(3)),
      snapBytes: bytes,
      pawns: snap.pawns.length,
      walkSpeed: Number(speed.toFixed(3)),
      snapHz: SNAP_HZ,
      freezeRatio: Number(freezeRatio.toFixed(3)),
      predFreezeRatio: Number(predFreezeRatio.toFixed(3)),
      hardSnap: hard.x === 8,
      blendToward: blend.x > 0 && blend.x < 0.4,
    },
    null,
    2,
  ),
);

if (tickMs > 12) {
  console.error("sim tick is slow");
  process.exit(2);
}
if (freezeRatio < 0.6) {
  console.error("expected a staircase freeze at 18 Hz");
  process.exit(3);
}
if (predFreezeRatio > 0.05) {
  console.error("predicted walk should not freeze");
  process.exit(4);
}
if (hard.x !== 8 || !(blend.x > 0 && blend.x < 0.4)) {
  console.error("reconcilePos misfired");
  process.exit(5);
}
console.log("probe: sim is cheap; prediction removes the staircase");
