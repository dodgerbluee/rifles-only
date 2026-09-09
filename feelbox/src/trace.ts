import * as THREE from "three";

export type Aabb = {
  min: THREE.Vector3;
  max: THREE.Vector3;
  walk?: boolean;
  shot?: boolean;
};

export function rayShot(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  maxDist: number,
  colliders: Aabb[],
) {
  return rayWorld(origin, dir, maxDist, colliders, true);
}

/** True if nothing solid sits between two points. Does not skip walk floors. */
export function hasLos(
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  colliders: Aabb[],
) {
  const origin = new THREE.Vector3(x0, y0, z0);
  const dest = new THREE.Vector3(x1, y1, z1);
  const dir = dest.clone().sub(origin);
  const dist = dir.length();
  if (dist < 0.2) return true;
  dir.multiplyScalar(1 / dist);
  const hit = rayWorld(origin, dir, Math.max(0.05, dist - 0.08), colliders, false);
  return !hit;
}

export function rayWorld(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  maxDist: number,
  colliders: Aabb[],
  skipFloors = false,
) {
  let best = maxDist;
  let hit = false;
  let nx = 0;
  let ny = 1;
  let nz = 0;
  let px = 0;
  let py = 0;
  let pz = 0;
  const invX = dir.x !== 0 ? 1 / dir.x : 1e12;
  const invY = dir.y !== 0 ? 1 / dir.y : 1e12;
  const invZ = dir.z !== 0 ? 1 / dir.z : 1e12;
  for (const b of colliders) {
    if (b.shot === false) continue;
    if (skipFloors && b.walk && b.max.y - b.min.y < 0.35 && b.max.y < origin.y - 0.4) continue;
    const tx1 = (b.min.x - origin.x) * invX;
    const tx2 = (b.max.x - origin.x) * invX;
    const ty1 = (b.min.y - origin.y) * invY;
    const ty2 = (b.max.y - origin.y) * invY;
    const tz1 = (b.min.z - origin.z) * invZ;
    const tz2 = (b.max.z - origin.z) * invZ;
    const tmin = Math.max(Math.min(tx1, tx2), Math.min(ty1, ty2), Math.min(tz1, tz2));
    const tmax = Math.min(Math.max(tx1, tx2), Math.max(ty1, ty2), Math.max(tz1, tz2));
    if (tmax < 0 || tmin > tmax || tmin > best || tmin < 0.04) continue;
    best = tmin;
    hit = true;
    px = origin.x + dir.x * tmin;
    py = origin.y + dir.y * tmin;
    pz = origin.z + dir.z * tmin;
    const eps = 0.002;
    if (Math.abs(px - b.min.x) < eps) {
      nx = -1;
      ny = 0;
      nz = 0;
    } else if (Math.abs(px - b.max.x) < eps) {
      nx = 1;
      ny = 0;
      nz = 0;
    } else if (Math.abs(py - b.min.y) < eps) {
      nx = 0;
      ny = -1;
      nz = 0;
    } else if (Math.abs(py - b.max.y) < eps) {
      nx = 0;
      ny = 1;
      nz = 0;
    } else if (Math.abs(pz - b.min.z) < eps) {
      nx = 0;
      ny = 0;
      nz = -1;
    } else {
      nx = 0;
      ny = 0;
      nz = 1;
    }
  }
  if (!hit) return null;
  return { dist: best, point: new THREE.Vector3(px, py, pz), normal: new THREE.Vector3(nx, ny, nz) };
}
