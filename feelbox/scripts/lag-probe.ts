/**
 * Measures dedicated-sim cost and the client staircase that snapshots
 * produce when the browser does not predict movement. Also checks the
 * 50-ping feel path: history reconcile and 2-snapshot interpolation.
 */
import { createSim } from "../src/sim.ts";
import {
  INTERP_DELAY_MS,
  SNAP_HZ,
  TICK_HZ,
  lookbackMs,
  predAt,
  pushPose,
  pushPred,
  reconcilePredicted,
  sampleInterp,
} from "../src/netFeel.ts";
import { emptyInput, reconcilePos } from "../src/peers.ts";

const STAIR_SNAP_HZ = 18;
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
const snapEvery = FRAME_HZ / STAIR_SNAP_HZ;
for (let f = 0; f < FRAME_HZ; f++) {
  const nx = ((f / snapEvery) | 0) * (speed / STAIR_SNAP_HZ);
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
  if (f % Math.round(FRAME_HZ / STAIR_SNAP_HZ) === 0) {
    snapX += walk * (1 / STAIR_SNAP_HZ);
    predX = reconcilePos(predX, 0, 0, snapX, 0, 0).x;
  }
  if (Math.abs(predX - before) < 1e-9) predFreeze += 1;
}
const predFreezeRatio = predFreeze / FRAME_HZ;

const hard = reconcilePos(0, 0, 0, 8, 0, 0);
const blend = reconcilePos(0, 0, 0, 0.4, 0, 0);

const ping = 50;
const stale = [];
let liveX = 0;
for (let f = 1; f <= 90; f++) {
  liveX += walk * dt;
  pushPred(stale, { t: f * (1000 / FRAME_HZ), x: liveX, y: 0, z: 0 });
}
const now50 = 90 * (1000 / FRAME_HZ);
const ack = now50 - lookbackMs(ping);
const then = predAt(stale, ack);
if (!then) {
  console.error("missing pred sample for 50ms lookback");
  process.exit(6);
}
const naive = reconcilePos(liveX, 0, 0, then.x, 0, 0);
const smart = reconcilePredicted(liveX, 0, 0, then.x, 0, 0, stale, ack);
const naivePull = liveX - naive.x;
const smartPull = liveX - smart.x;

const poses = [];
const snapMs = 1000 / SNAP_HZ;
pushPose(poses, { t: 1000, x: 0, y: 0, z: 0, yaw: 0 });
pushPose(poses, { t: 1000 + snapMs, x: 1, y: 0, z: 0, yaw: 0 });
pushPose(poses, { t: 1000 + snapMs * 2, x: 2, y: 0, z: 0, yaw: 0 });
const newest = 1000 + snapMs * 2;
const delayed = sampleInterp(poses, newest - INTERP_DELAY_MS);
const halfway = sampleInterp(poses, 1000 + snapMs * 0.5);
const late = sampleInterp(poses, newest);
const tooOld = sampleInterp(poses, newest - 200);

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
}

console.log(
  JSON.stringify(
    {
      tickHz: TICK_HZ,
      snapHz: SNAP_HZ,
      interpDelayMs: INTERP_DELAY_MS,
      tickMs: Number(tickMs.toFixed(3)),
      snapBytes: bytes,
      pawns: snap.pawns.length,
      walkSpeed: Number(speed.toFixed(3)),
      stairSnapHz: STAIR_SNAP_HZ,
      freezeRatio: Number(freezeRatio.toFixed(3)),
      predFreezeRatio: Number(predFreezeRatio.toFixed(3)),
      hardSnap: hard.x === 8,
      blendToward: blend.x > 0 && blend.x < 0.4,
      naivePullAt50: Number(naivePull.toFixed(3)),
      smartPullAt50: Number(smartPull.toFixed(3)),
      interpBehind: delayed ? Number(delayed.x.toFixed(3)) : null,
      interpHalf: halfway ? Number(halfway.x.toFixed(3)) : null,
    },
    null,
    2,
  ),
);

check("sim tick is cheap", tickMs <= 12, `tickMs=${tickMs.toFixed(3)}`);
check("18 Hz snapshots freeze without prediction", freezeRatio >= 0.6, `freeze=${freezeRatio.toFixed(3)}`);
check("predicted walk does not freeze", predFreezeRatio <= 0.05, `predFreeze=${predFreezeRatio.toFixed(3)}`);
check("hard snap still teleports", hard.x === 8);
check("tiny error still blends", blend.x > 0 && blend.x < 0.4);
check("lookback at 50 ping is RTT plus one tick", Math.abs(lookbackMs(50) - (50 + 1000 / TICK_HZ)) < 1e-6);
check("naive reconcile tugs toward a 50ms-stale pose", naivePull > 0.04, `pull=${naivePull.toFixed(3)}`);
check("history reconcile ignores a matching 50ms-stale pose", smartPull < 0.02, `pull=${smartPull.toFixed(3)}`);
check("interp delay is 1–2 snapshots", INTERP_DELAY_MS >= 16 && INTERP_DELAY_MS <= 80, `delay=${INTERP_DELAY_MS}`);
check("interp delay is not 200ms+", INTERP_DELAY_MS < 200);
check(
  "2-snapshot delay is behind the newest pose",
  !!delayed && delayed.x < 1.2,
  `x=${delayed?.x.toFixed(3)}`,
);
check("lerp sits between two snapshots", !!halfway && halfway.x > 0.4 && halfway.x < 0.6, `x=${halfway?.x.toFixed(3)}`);
check("no extrapolate past the newest snapshot", !!late && Math.abs(late.x - 2) < 1e-6);
check("200ms lookback holds the oldest pose, not a fake lead", !!tooOld && Math.abs(tooOld.x) < 1e-6);

if (failed) {
  console.error(`${failed} lag-probe checks failed`);
  process.exit(10);
}
console.log("probe: 60 Hz sim; prediction + 33ms interp hide 50ms RTT");
