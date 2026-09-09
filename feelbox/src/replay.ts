import type { Match } from "./match";
import { slotById } from "./match";

export type Pose = {
  id: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  eye: number;
  alive: boolean;
  weapon: "kar" | "mosin" | "knife" | "smoke" | "frag" | "stun" | "flash";
  ads: boolean;
  bash: number;
  fov: number;
  kick: number;
  punchP: number;
  punchY: number;
  flash: boolean;
};

export type KillClip = {
  t: number;
  killerId: number;
  victimId: number;
  victimName: string;
};

export type RoundTape = {
  frames: { t: number; poses: Pose[] }[];
  kills: KillClip[];
};

export const PRE_SLOW = 1.55;
export const POST_SLOW = 0.8;
export const REEL_LEAD = 3.2;
export const PLAY_RATE = 1;
export const FAST_RATE = 10;

export function createTape(): RoundTape {
  return { frames: [], kills: [] };
}

export function clearTape(tape: RoundTape) {
  tape.frames.length = 0;
  tape.kills.length = 0;
}

export function pushFrame(tape: RoundTape, t: number, poses: Pose[]) {
  const last = tape.frames[tape.frames.length - 1];
  if (last && t - last.t < 0.02) {
    last.t = t;
    last.poses = poses;
    return;
  }
  tape.frames.push({ t, poses });
}

export function pushKill(tape: RoundTape, kill: KillClip) {
  tape.kills.push(kill);
}

export function watchLabel(viewId: number, youId: number, name?: string | null) {
  if (viewId === youId) return "You";
  const n = name?.trim();
  return n || "Rifle";
}

/** Recap camera already has a first-person viewmodel. Hide the subject's world pawn/rifle. */
export function reelWorldPawnVisible(id: number, mvpId: number) {
  return id !== mvpId;
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
  const name = bestId === preferId ? "You" : (slot?.name ?? "Rifle");
  return { id: bestId, name, kills: bestN, clips };
}

export function samplePoses(tape: RoundTape, t: number): Map<number, Pose> {
  const frames = tape.frames;
  const out = new Map<number, Pose>();
  if (frames.length === 0) return out;
  if (t <= frames[0]!.t) {
    for (const p of frames[0]!.poses) out.set(p.id, { ...p });
    return out;
  }
  const last = frames[frames.length - 1]!;
  if (t >= last.t) {
    for (const p of last.poses) out.set(p.id, { ...p });
    return out;
  }
  let i = 1;
  while (i < frames.length && frames[i]!.t < t) i += 1;
  const a = frames[i - 1]!;
  const b = frames[i]!;
  const span = b.t - a.t || 1;
  const u = Math.max(0, Math.min(1, (t - a.t) / span));
  const bMap = new Map(b.poses.map((p) => [p.id, p]));
  for (const pa of a.poses) {
    const pb = bMap.get(pa.id);
    if (!pb) {
      out.set(pa.id, { ...pa });
      continue;
    }
    out.set(pa.id, {
      id: pa.id,
      x: pa.x + (pb.x - pa.x) * u,
      y: pa.y + (pb.y - pa.y) * u,
      z: pa.z + (pb.z - pa.z) * u,
      yaw: lerpAngle(pa.yaw, pb.yaw, u),
      pitch: pa.pitch + (pb.pitch - pa.pitch) * u,
      eye: pa.eye + (pb.eye - pa.eye) * u,
      alive: u < 0.5 ? pa.alive : pb.alive,
      weapon: u < 0.5 ? pa.weapon : pb.weapon,
      ads: u < 0.5 ? pa.ads : pb.ads,
      bash: pa.bash + (pb.bash - pa.bash) * u,
      fov: pa.fov + (pb.fov - pa.fov) * u,
      kick: pa.kick + (pb.kick - pa.kick) * u,
      punchP: pa.punchP + (pb.punchP - pa.punchP) * u,
      punchY: pa.punchY + (pb.punchY - pa.punchY) * u,
      flash: u < 0.5 ? pa.flash : pb.flash,
    });
  }
  return out;
}

export function inSlowWindow(t: number, clips: KillClip[]) {
  return clips.some((k) => t >= k.t - PRE_SLOW && t <= k.t + POST_SLOW);
}

export function nextWindowStart(t: number, clips: KillClip[]) {
  let best = Infinity;
  for (const k of clips) {
    const s = k.t - PRE_SLOW;
    const e = k.t + POST_SLOW;
    if (t < s) best = Math.min(best, s);
    else if (t <= e) return null;
  }
  return best === Infinity ? null : best;
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
  return { start: Math.max(t0, first.t - REEL_LEAD), end: last.t + POST_SLOW + 0.45 };
}

export function killsReached(t: number, clips: KillClip[]) {
  let n = 0;
  for (const k of clips) if (t >= k.t) n += 1;
  return n;
}

function lerpAngle(a: number, b: number, u: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * u;
}
