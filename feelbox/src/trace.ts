import * as THREE from "three";

export type RampCol = { axis: "x" | "z"; y0: number; y1: number };

export type Aabb = {
  min: THREE.Vector3;
  max: THREE.Vector3;
  walk?: boolean;
  shot?: boolean;
  /** Walk top is a slope. y0 at min of `axis`, y1 at max. */
  ramp?: RampCol;
};

/** Walk height of a ramp (or AABB top) at XZ. */
export function aabbRampY(b: Aabb, x: number, z: number) {
  const r = b.ramp;
  if (!r) return b.max.y;
  if (r.axis === "x") {
    const span = b.max.x - b.min.x;
    const t = span <= 1e-6 ? 0 : (x - b.min.x) / span;
    return r.y0 + Math.max(0, Math.min(1, t)) * (r.y1 - r.y0);
  }
  const span = b.max.z - b.min.z;
  const t = span <= 1e-6 ? 0 : (z - b.min.z) / span;
  return r.y0 + Math.max(0, Math.min(1, t)) * (r.y1 - r.y0);
}

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
    if (skipFloors && b.walk && !b.ramp && b.max.y - b.min.y < 0.35 && b.max.y < origin.y - 0.4) continue;
    if (b.ramp) {
      const r = b.ramp;
      const span = r.axis === "x" ? b.max.x - b.min.x : b.max.z - b.min.z;
      const k = span <= 1e-6 ? 0 : (r.y1 - r.y0) / span;
      const denom = r.axis === "x" ? dir.y - k * dir.x : dir.y - k * dir.z;
      if (Math.abs(denom) > 1e-8) {
        const plane = r.axis === "x" ? r.y0 - k * b.min.x : r.y0 - k * b.min.z;
        const orig = r.axis === "x" ? origin.y - k * origin.x : origin.y - k * origin.z;
        const t = (plane - orig) / denom;
        if (t >= 0.04 && t < best) {
          const hx = origin.x + dir.x * t;
          const hy = origin.y + dir.y * t;
          const hz = origin.z + dir.z * t;
          if (hx >= b.min.x - 0.02 && hx <= b.max.x + 0.02 && hz >= b.min.z - 0.02 && hz <= b.max.z + 0.02) {
            best = t;
            hit = true;
            px = hx;
            py = hy;
            pz = hz;
            if (r.axis === "x") {
              const len = Math.hypot(k, 1) || 1;
              nx = -k / len;
              ny = 1 / len;
              nz = 0;
            } else {
              const len = Math.hypot(k, 1) || 1;
              nx = 0;
              ny = 1 / len;
              nz = -k / len;
            }
            continue;
          }
        }
      }
    }
    const tx1 = (b.min.x - origin.x) * invX;
    const tx2 = (b.max.x - origin.x) * invX;
    const ty1 = (b.min.y - origin.y) * invY;
    const ty2 = (b.max.y - origin.y) * invY;
    const tz1 = (b.min.z - origin.z) * invZ;
    const tz2 = (b.max.z - origin.z) * invZ;
    const tmin = Math.max(Math.min(tx1, tx2), Math.min(ty1, ty2), Math.min(tz1, tz2));
    const tmax = Math.min(Math.max(tx1, tx2), Math.max(ty1, ty2), Math.max(tz1, tz2));
    if (tmax < 0 || tmin > tmax || tmin > best || tmin < 0.04) continue;
    const hx = origin.x + dir.x * tmin;
    const hy = origin.y + dir.y * tmin;
    const hz = origin.z + dir.z * tmin;
    if (b.ramp && hy > aabbRampY(b, hx, hz) + 0.04) continue;
    best = tmin;
    hit = true;
    px = hx;
    py = hy;
    pz = hz;
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
