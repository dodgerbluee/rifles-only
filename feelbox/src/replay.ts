import type { Match } from "./match";
import { displayName, slotById } from "./match";

export type Pose = {
  id: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  eye: number;
  alive: boolean;
  weapon: "kar" | "karscope" | "mosin" | "knife" | "smoke" | "frag" | "stun" | "flash";
  ads: boolean;
  bash: number;
  /** 0 idle, 0–1 toss. Killcam/recap replay the throw instead of a rest hold. */
  throw?: number;
  throwDrop?: boolean;
  fov: number;
  kick: number;
  punchP: number;
  punchY: number;
  flash: boolean;
};

export type TapeNade = { x: number; y: number; z: number; kind: "smoke" | "frag" | "stun" | "flash" };
export type TapeCloud = { x: number; y: number; z: number; radius: number; opacity: number };

export type TapeFx = {
  nades: TapeNade[];
  clouds: TapeCloud[];
};

export type TapeFrame = {
  t: number;
  poses: Pose[];
  nades: TapeNade[];
  clouds: TapeCloud[];
};

export type KillClip = {
  t: number;
  killerId: number;
  victimId: number;
  victimName: string;
};

export type RoundTape = {
  frames: TapeFrame[];
  kills: KillClip[];
};

export const PRE_SLOW = 1.55;
export const POST_SLOW = 0.8;
/** Extra hang after the MVP's last kill so the reel does not cut on the shot. */
export const LAST_POST = 2.2;
export const REEL_LEAD = 3.2;
export const PLAY_RATE = 1;
/** Skip between kill windows. Multiplier, not a tick rate. */
export const FAST_RATE = 10;
/** Keep 60 Hz poses. 0.02 was half a 30 Hz tick and collapsed every 60 Hz frame. */
export const TAPE_MIN_DT = 0.5 / 60;
export const KILLCAM_PRE = 3.4;
export const KILLCAM_POST = 1.15;
export const KILLCAM_MIN = 3;
export const KILLCAM_MAX = 5;

export function createTape(): RoundTape {
  return { frames: [], kills: [] };
}

export function clearTape(tape: RoundTape) {
  tape.frames.length = 0;
  tape.kills.length = 0;
}

export function pushFrame(tape: RoundTape, t: number, poses: Pose[], fx?: Partial<TapeFx>) {
  const nades = fx?.nades ? fx.nades.map(copyNade) : [];
  const clouds = fx?.clouds ? fx.clouds.map(copyCloud) : [];
  const last = tape.frames[tape.frames.length - 1];
  if (last && t - last.t < TAPE_MIN_DT) {
    last.t = t;
    last.poses = poses;
    last.nades = nades;
    last.clouds = clouds;
    return;
  }
  tape.frames.push({ t, poses, nades, clouds });
}

export function pushKill(tape: RoundTape, kill: KillClip) {
  tape.kills.push(kill);
}

export function watchLabel(_viewId: number, _youId: number, name?: string | null) {
  return displayName(name);
}

/** Recap / killcam camera already has a first-person viewmodel. Hide the subject's world pawn/rifle. */
export function reelWorldPawnVisible(id: number, viewId: number) {
  return id !== viewId;
}

/** Offline and host own bot meshes. Dedicated clients replay other people via clientPawns. */
export function reelDrivesBotMeshes(role: "host" | "client" | "offline") {
  return role !== "client";
}

export function pickMvp(tape: RoundTape, match: Match, preferId: number) {
  if (tape.kills.length === 0) return null;
  const counts = new Map<number, number>();
  for (const k of tape.kills) counts.set(k.killerId, (counts.get(k.killerId) ?? 0) + 1);
  let bestId = -1;
  let bestN = 0;
  for (const [id, n] of counts) {
    if (n > bestN || (n === bestN && id === preferId)) {
      bestN = n;
      bestId = id;
    }
  }
  if (bestN <= 0) return null;
  const clips = tape.kills.filter((k) => k.killerId === bestId).sort((a, b) => a.t - b.t);
  const slot = slotById(match, bestId);
  const name = displayName(slot?.name);
  return { id: bestId, name, kills: bestN, clips };
}

export function samplePoses(tape: RoundTape, t: number): Map<number, Pose> {
  return sampleTape(tape, t).poses;
}

export function sampleTape(tape: RoundTape, t: number): { poses: Map<number, Pose> } & TapeFx {
  const frames = tape.frames;
  const empty = { poses: new Map<number, Pose>(), nades: [] as TapeNade[], clouds: [] as TapeCloud[] };
  if (frames.length === 0) return empty;
  if (t <= frames[0]!.t) {
    return {
      poses: poseMap(frames[0]!.poses),
      nades: frames[0]!.nades.map(copyNade),
      clouds: frames[0]!.clouds.map(copyCloud),
    };
  }
  const last = frames[frames.length - 1]!;
  if (t >= last.t) {
    return {
      poses: poseMap(last.poses),
      nades: last.nades.map(copyNade),
      clouds: last.clouds.map(copyCloud),
    };
  }
  let i = 1;
  while (i < frames.length && frames[i]!.t < t) i += 1;
  const a = frames[i - 1]!;
  const b = frames[i]!;
  const span = b.t - a.t || 1;
  const u = Math.max(0, Math.min(1, (t - a.t) / span));
  const bMap = new Map(b.poses.map((p) => [p.id, p]));
  const poses = new Map<number, Pose>();
  for (const pa of a.poses) {
    const pb = bMap.get(pa.id);
    if (!pb) {
      poses.set(pa.id, { ...pa });
      continue;
    }
    poses.set(pa.id, {
      id: pa.id,
      x: pa.x + (pb.x - pa.x) * u,
      y: pa.y + (pb.y - pa.y) * u,
      z: pa.z + (pb.z - pa.z) * u,
      yaw: lerpAngle(pa.yaw, pb.yaw, u),
      pitch: pa.pitch + (pb.pitch - pa.pitch) * u,
      eye: pa.eye + (pb.eye - pa.eye) * u,
      alive: u < 0.5 ? pa.alive : pb.alive,
      weapon: lerpTapeWeapon(pa, pb, u),
      ads: u < 0.5 ? pa.ads : pb.ads,
      bash: pa.bash + (pb.bash - pa.bash) * u,
      throw: (pa.throw ?? 0) + ((pb.throw ?? 0) - (pa.throw ?? 0)) * u,
      throwDrop: (pa.throw ?? 0) >= (pb.throw ?? 0) ? !!pa.throwDrop : !!pb.throwDrop,
      fov: pa.fov + (pb.fov - pa.fov) * u,
      kick: pa.kick + (pb.kick - pa.kick) * u,
      punchP: pa.punchP + (pb.punchP - pa.punchP) * u,
      punchY: pa.punchY + (pb.punchY - pa.punchY) * u,
      flash: u < 0.5 ? pa.flash : pb.flash,
    });
  }
  return {
    poses,
    nades: lerpNades(a.nades, b.nades, u),
    clouds: lerpClouds(a.clouds, b.clouds, u),
  };
}

export function clipPost(clips: KillClip[], i: number) {
  return i === clips.length - 1 ? LAST_POST : POST_SLOW;
}

export function inSlowWindow(t: number, clips: KillClip[]) {
  return clips.some((k, i) => t >= k.t - PRE_SLOW && t <= k.t + clipPost(clips, i));
}

export function nextWindowStart(t: number, clips: KillClip[]) {
  let best = Infinity;
  for (let i = 0; i < clips.length; i++) {
    const k = clips[i]!;
    const s = k.t - PRE_SLOW;
    const e = k.t + clipPost(clips, i);
    if (t < s) best = Math.min(best, s);
    else if (t <= e) return null;
  }
  return best === Infinity ? null : best;
}

/** Advance tape time, without skipping past the next kill window. */
export function advancePlayT(playT: number, dt: number, clips: KillClip[]) {
  const live = inSlowWindow(playT, clips);
  const next = playT + dt * (live ? PLAY_RATE : FAST_RATE);
  if (live) return next;
  const start = nextWindowStart(playT, clips);
  if (start != null && next > start) return start;
  return next;
}

export function recapWindow(tape: RoundTape) {
  if (tape.frames.length < 2) return null;
  const t0 = tape.frames[0]!.t;
  const t1 = tape.frames[tape.frames.length - 1]!.t;
  return { start: Math.max(t0, t1 - 10), end: t1 + 0.25 };
}

export function playBounds(clips: KillClip[], tape?: RoundTape) {
  const first = clips[0]!;
  const last = clips[clips.length - 1]!;
  const t0 = tape?.frames[0]?.t ?? 0;
  const t1 = tape?.frames[tape.frames.length - 1]?.t;
  const end = last.t + LAST_POST + 0.65;
  return { start: Math.max(t0, first.t - REEL_LEAD), end: t1 != null ? Math.max(end, Math.min(t1 + 0.35, end + 1)) : end };
}

export function reelWallTime(clips: KillClip[], tape: RoundTape, dt = 1 / 60) {
  if (clips.length === 0) {
    const recap = recapWindow(tape);
    if (!recap) return 2.4;
    return Math.max(0.2, recap.end - recap.start);
  }
  const bounds = playBounds(clips, tape);
  let playT = bounds.start;
  let wall = 0;
  let steps = 0;
  while (playT < bounds.end - 1e-9 && steps < 30_000) {
    playT = advancePlayT(playT, dt, clips);
    wall += dt;
    steps += 1;
  }
  return wall;
}

export function lastKillOf(tape: RoundTape, victimId: number) {
  for (let i = tape.kills.length - 1; i >= 0; i--) {
    const k = tape.kills[i]!;
    if (k.victimId === victimId) return k;
  }
  return null;
}

export function killcamWindow(tape: RoundTape, victimId: number, now: number) {
  const clip = lastKillOf(tape, victimId);
  const killT = clip?.t ?? now;
  const t0 = tape.frames[0]?.t ?? killT - KILLCAM_PRE;
  const t1 = tape.frames[tape.frames.length - 1]?.t ?? killT;
  let start = Math.max(t0, killT - KILLCAM_PRE);
  let end = Math.min(Math.max(t1, killT), killT + KILLCAM_POST);
  if (end < start + KILLCAM_MIN) end = start + KILLCAM_MIN;
  if (end > start + KILLCAM_MAX) start = end - KILLCAM_MAX;
  if (end < start + KILLCAM_MIN) end = start + KILLCAM_MIN;
  return {
    killerId: clip?.killerId ?? victimId,
    start,
    end,
  };
}

export function killsReached(t: number, clips: KillClip[]) {
  let n = 0;
  for (const k of clips) if (t >= k.t) n += 1;
  return n;
}

function isTapeNade(w: Pose["weapon"]) {
  return w === "smoke" || w === "frag" || w === "stun" || w === "flash";
}

/** Keep the thrown nade while the toss is in flight, even if the next pose already swapped guns. */
export function lerpTapeWeapon(pa: Pose, pb: Pose, u: number): Pose["weapon"] {
  const ta = pa.throw ?? 0;
  const tb = pb.throw ?? 0;
  if (ta > 0.02 && isTapeNade(pa.weapon)) return pa.weapon;
  if (tb > 0.02 && isTapeNade(pb.weapon)) return pb.weapon;
  return u < 0.5 ? pa.weapon : pb.weapon;
}

function poseMap(poses: Pose[]) {
  const out = new Map<number, Pose>();
  for (const p of poses) out.set(p.id, { ...p });
  return out;
}

function copyNade(n: TapeNade): TapeNade {
  return { x: n.x, y: n.y, z: n.z, kind: n.kind };
}

function copyCloud(c: TapeCloud): TapeCloud {
  return { x: c.x, y: c.y, z: c.z, radius: c.radius, opacity: c.opacity };
}

function lerpNades(a: TapeNade[], b: TapeNade[], u: number): TapeNade[] {
  if (a.length === b.length && a.every((n, i) => n.kind === b[i]?.kind)) {
    return a.map((n, i) => {
      const p = b[i]!;
      return {
        x: n.x + (p.x - n.x) * u,
        y: n.y + (p.y - n.y) * u,
        z: n.z + (p.z - n.z) * u,
        kind: n.kind,
      };
    });
  }
  return (u < 0.5 ? a : b).map(copyNade);
}

function lerpClouds(a: TapeCloud[], b: TapeCloud[], u: number): TapeCloud[] {
  if (a.length === b.length) {
    return a.map((c, i) => {
      const p = b[i]!;
      return {
        x: c.x + (p.x - c.x) * u,
        y: c.y + (p.y - c.y) * u,
        z: c.z + (p.z - c.z) * u,
        radius: c.radius + (p.radius - c.radius) * u,
        opacity: c.opacity + (p.opacity - c.opacity) * u,
      };
    });
  }
  return (u < 0.5 ? a : b).map(copyCloud);
}

function lerpAngle(a: number, b: number, u: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * u;
}
