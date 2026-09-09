import * as THREE from "three";
import type { Team } from "./match";

export const CHEST_OFF = 1.05;
export const CHEST_R = 0.42;
export const BODY_R = 0.36;
export const BODY_SAMPLES = [0.42, 0.95, 1.45, 1.64];

export type LiveBody = {
  id: number;
  team: Team;
  x: number;
  y: number;
  z: number;
  alive: boolean;
};

export type RemoteTarget = {
  alive: boolean;
  team: Team;
  slotId: number;
  root: THREE.Object3D;
};

export function pickChestVictim(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  bodies: LiveBody[],
  worldDist: number,
  shooterTeam: Team | undefined,
  friendlyFire: boolean,
  skipIds: number[] = [],
): { body: LiveBody; point: THREE.Vector3; t: number } | null {
  let best: { body: LiveBody; point: THREE.Vector3; t: number } | null = null;
  for (const b of bodies) {
    if (!b.alive || skipIds.includes(b.id)) continue;
    if (!friendlyFire && shooterTeam && b.team === shooterTeam) continue;
    const chest = new THREE.Vector3(b.x, b.y + CHEST_OFF, b.z);
    const t = Math.max(0, chest.clone().sub(origin).dot(dir));
    if (t < 0.2) continue;
    const closest = origin.clone().addScaledVector(dir, t);
    if (closest.distanceTo(chest) >= CHEST_R) continue;
    if (Number.isFinite(worldDist) && t >= worldDist - 0.1) continue;
    if (!best || t < best.t) best = { body: b, point: closest, t };
  }
  return best;
}

export function pickBodyVictim(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  bodies: LiveBody[],
  worldDist: number,
  shooterTeam: Team | undefined,
  friendlyFire: boolean,
  skipIds: number[] = [],
  crouchIds: number[] = [],
): { body: LiveBody; point: THREE.Vector3; t: number } | null {
  let best: { body: LiveBody; point: THREE.Vector3; t: number } | null = null;
  for (const b of bodies) {
    if (!b.alive || skipIds.includes(b.id)) continue;
    if (!friendlyFire && shooterTeam && b.team === shooterTeam) continue;
    const samples = crouchIds.includes(b.id) ? [0.35, 0.7, 1.05] : BODY_SAMPLES;
    for (const off of samples) {
      const chest = new THREE.Vector3(b.x, b.y + off, b.z);
      const t = Math.max(0, chest.clone().sub(origin).dot(dir));
      if (t < 0.2) continue;
      const closest = origin.clone().addScaledVector(dir, t);
      if (closest.distanceTo(chest) >= BODY_R) continue;
      if (Number.isFinite(worldDist) && t >= worldDist - 0.1) continue;
      if (!best || t < best.t) best = { body: b, point: closest, t };
    }
  }
  return best;
}

export function meleeTarget(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  bodies: LiveBody[],
  reach: number,
  shooterTeam: Team | undefined,
  friendlyFire: boolean,
  skipIds: number[] = [],
): LiveBody | null {
  let best: { body: LiveBody; score: number } | null = null;
  for (const b of bodies) {
    if (!b.alive || skipIds.includes(b.id)) continue;
    if (!friendlyFire && shooterTeam && b.team === shooterTeam) continue;
    const dx = b.x - origin.x;
    const dy = b.y + 1.05 - origin.y;
    const dz = b.z - origin.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist > reach + 0.5) continue;
    const inv = dist > 1e-4 ? 1 / dist : 1;
    const facing = dir.x * dx * inv + dir.y * dy * inv + dir.z * dz * inv;
    if (dist > 0.85 && facing < 0.12) continue;
    const score = dist - facing * 0.35;
    if (!best || score < best.score) best = { body: b, score };
  }
  return best?.body ?? null;
}

export function pawnHitMeshes(root: THREE.Object3D): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (o instanceof THREE.Mesh && o.userData?.botId != null) out.push(o);
  });
  return out;
}

export function remoteTargets(
  remotes: Iterable<RemoteTarget>,
  enemyOf?: Team,
  skipIds: number[] = [],
): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  for (const r of remotes) {
    if (!r.alive || skipIds.includes(r.slotId)) continue;
    if (enemyOf && r.team === enemyOf) continue;
    out.push(...pawnHitMeshes(r.root));
  }
  return out;
}
