/**
 * Client prediction + remote interpolation. Dedicated tick/snap used to be 30 Hz;
 * remotes chased the latest pose with exp(-16·dt) (~62 ms extra lag); local
 * reconcile blended 22% toward a snapshot that was a full RTT stale.
 *
 * Now: 60 Hz tick + 60 Hz snapshots, remotes rendered ~2 snapshots behind
 * (delay grows a little on underrun), local walk compared to the predicted
 * pose at ack time. Tiny ack errors stay put; 1.6 m is no longer a teleport.
 */
export const TICK_HZ = 60;
export const SNAP_HZ = 60;
/** Render remotes this far behind the newest received snapshot. 2 snaps at 60 Hz. */
export const INTERP_DELAY_MS = Math.round(2000 / SNAP_HZ);
/** Cap grown delay so a hitch does not add a 200 ms+ rubber band. */
export const INTERP_DELAY_MAX_MS = Math.round(5000 / SNAP_HZ);
export const INTERP_KEEP_MS = 400;
export const PRED_KEEP_MS = 400;
/** Ignore ~1 tick of walk error so 60 Hz snaps do not tug every packet. */
export const PRED_SLACK_XZ = 0.12;
export const PRED_SLACK_Y = 0.12;
/** Half the old 30 Hz blend so 60 Hz snaps correct at the same rate. */
export const SNAP_BLEND = 0.12;
/** Walk ~0.4 s. 1.6 m was firing on interp delay + ordinary jitter. */
export const HARD_SNAP_XZ = 2.5;
export const HARD_SNAP_Y = 1.2;

export type PredSample = { t: number; x: number; y: number; z: number };
export type PoseSample = { t: number; x: number; y: number; z: number; yaw: number };

export function lookbackMs(pingMs: number) {
  return Math.max(0, pingMs) + 1000 / TICK_HZ;
}

export function pushPred(hist: PredSample[], sample: PredSample, keepMs = PRED_KEEP_MS) {
  hist.push(sample);
  const cut = sample.t - keepMs;
  while (hist.length && hist[0]!.t < cut) hist.shift();
}

export function predAt(hist: PredSample[], t: number): PredSample | null {
  if (!hist.length) return null;
  if (t <= hist[0]!.t) return hist[0]!;
  const last = hist[hist.length - 1]!;
  if (t >= last.t) return last;
  for (let i = 1; i < hist.length; i++) {
    const b = hist[i]!;
    const a = hist[i - 1]!;
    if (t <= b.t) {
      const u = (t - a.t) / Math.max(1e-4, b.t - a.t);
      return {
        t,
        x: a.x + (b.x - a.x) * u,
        y: a.y + (b.y - a.y) * u,
        z: a.z + (b.z - a.z) * u,
      };
    }
  }
  return last;
}

/** Blend current pose by (server − predicted-at-ack), not toward the stale snapshot. */
export function reconcilePredicted(
  curX: number,
  curY: number,
  curZ: number,
  srvX: number,
  srvY: number,
  srvZ: number,
  hist: PredSample[],
  ackTime: number,
): { x: number; y: number; z: number } {
  const pred = predAt(hist, ackTime);
  const bx = pred?.x ?? curX;
  const by = pred?.y ?? curY;
  const bz = pred?.z ?? curZ;
  const errX = srvX - bx;
  const errY = srvY - by;
  const errZ = srvZ - bz;
  const err = Math.hypot(errX, errZ);
  if (err > HARD_SNAP_XZ || Math.abs(errY) > HARD_SNAP_Y) return { x: srvX, y: srvY, z: srvZ };
  if (err < PRED_SLACK_XZ && Math.abs(errY) < PRED_SLACK_Y) return { x: curX, y: curY, z: curZ };
  return {
    x: curX + errX * SNAP_BLEND,
    y: curY + errY * SNAP_BLEND,
    z: curZ + errZ * SNAP_BLEND,
  };
}

export function lerpAngle(a: number, b: number, u: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * u;
}

export function pushPose(buf: PoseSample[], sample: PoseSample, keepMs = INTERP_KEEP_MS) {
  const last = buf[buf.length - 1];
  if (last && Math.abs(sample.t - last.t) < 0.2) {
    buf[buf.length - 1] = sample;
    return;
  }
  buf.push(sample);
  const cut = sample.t - keepMs;
  while (buf.length && buf[0]!.t < cut) buf.shift();
}

/**
 * If render time is past the newest pose, grow delay by the underrun plus one
 * snapshot so the next sample sits inside the buffer instead of hitch-holding.
 */
export function nextInterpDelay(delayMs: number, newestT: number, now: number, dt = 1 / SNAP_HZ): number {
  if (!(newestT > 0) || !Number.isFinite(now)) return Math.max(INTERP_DELAY_MS, delayMs);
  const renderAt = now - delayMs;
  if (renderAt > newestT) {
    const pad = 1000 / SNAP_HZ;
    return Math.min(INTERP_DELAY_MAX_MS, delayMs + (renderAt - newestT) + pad);
  }
  if (delayMs > INTERP_DELAY_MS) {
    const spare = newestT - renderAt;
    if (spare > 1000 / SNAP_HZ) {
      return Math.max(INTERP_DELAY_MS, delayMs - Math.min(40, dt * 1000) * 0.35);
    }
  }
  return Math.max(INTERP_DELAY_MS, delayMs);
}

/** Sample a pose at renderTime. Holds the latest sample — no extrapolation. */
export function sampleInterp(buf: PoseSample[], renderTime: number): PoseSample | null {
  if (!buf.length) return null;
  if (buf.length === 1 || renderTime <= buf[0]!.t) return buf[0]!;
  const last = buf[buf.length - 1]!;
  if (renderTime >= last.t) return last;
  for (let i = 1; i < buf.length; i++) {
    const b = buf[i]!;
    const a = buf[i - 1]!;
    if (renderTime <= b.t) {
      const u = (renderTime - a.t) / Math.max(1e-4, b.t - a.t);
      return {
        t: renderTime,
        x: a.x + (b.x - a.x) * u,
        y: a.y + (b.y - a.y) * u,
        z: a.z + (b.z - a.z) * u,
        yaw: lerpAngle(a.yaw, b.yaw, u),
      };
    }
  }
  return last;
}
