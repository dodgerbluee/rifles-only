import * as THREE from "three";
import { collideXZ, groundHeight, type Aabb } from "./world";

const R = 0.32;
const CELL = 1.2;
const DIRS: [number, number, number][] = [
  [1, 0, 10],
  [-1, 0, 10],
  [0, 1, 10],
  [0, -1, 10],
  [1, 1, 14],
  [1, -1, 14],
  [-1, 1, 14],
  [-1, -1, 14],
];

export type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number };

type Grid = {
  originX: number;
  originZ: number;
  cols: number;
  rows: number;
  y: Float32Array;
};

const grids = new WeakMap<Aabb[], Grid>();

function occupy(colliders: Aabb[], x: number, z: number, yFrom: number, bounds: Bounds) {
  if (x < bounds.minX + 0.55 || x > bounds.maxX - 0.55 || z < bounds.minZ + 0.55 || z > bounds.maxZ - 0.55) {
    return null;
  }
  const y = groundHeight(colliders, x, z, R, yFrom);
  const c = collideXZ(colliders, x, z, R + 0.08, y + 0.08, y + 1.7);
  if (Math.hypot(c.x - x, c.z - z) > 0.1) return null;
  return { x, y, z };
}

export function clearWalk(colliders: Aabb[], ax: number, az: number, ay: number, bx: number, bz: number) {
  const dist = Math.hypot(bx - ax, bz - az);
  if (dist < 0.5) return true;
  const steps = Math.max(1, Math.ceil(dist / 0.32));
  let x = ax;
  let z = az;
  let y = ay;
  for (let i = 1; i <= steps; i++) {
    const tx = ax + (bx - ax) * (i / steps);
    const tz = az + (bz - az) * (i / steps);
    const n = collideXZ(colliders, tx, tz, R, y + 0.08, y + 1.7);
    if (Math.hypot(n.x - x, n.z - z) < 0.02 && Math.hypot(tx - x, tz - z) > 0.12) return false;
    if (Math.hypot(n.x - tx, n.z - tz) > 0.16) return false;
    x = n.x;
    z = n.z;
    y = groundHeight(colliders, x, z, R, y);
  }
  return Math.hypot(bx - x, bz - z) < 0.7;
}

function gridOf(colliders: Aabb[], bounds: Bounds): Grid {
  const hit = grids.get(colliders);
  if (hit) return hit;
  const cols = Math.ceil((bounds.maxX - bounds.minX) / CELL) + 1;
  const rows = Math.ceil((bounds.maxZ - bounds.minZ) / CELL) + 1;
  const y = new Float32Array(cols * rows);
  y.fill(Number.NaN);
  for (let iz = 0; iz < rows; iz++) {
    for (let ix = 0; ix < cols; ix++) {
      const occ = occupy(colliders, bounds.minX + ix * CELL, bounds.minZ + iz * CELL, 0.15, bounds);
      if (occ && occ.y < 1.4) y[iz * cols + ix] = occ.y;
    }
  }
  const grid = { originX: bounds.minX, originZ: bounds.minZ, cols, rows, y };
  grids.set(colliders, grid);
  return grid;
}

function openY(g: Grid, ix: number, iz: number) {
  if (ix < 0 || iz < 0 || ix >= g.cols || iz >= g.rows) return Number.NaN;
  return g.y[iz * g.cols + ix]!;
}

function toCell(g: Grid, x: number, z: number) {
  return {
    ix: Math.max(0, Math.min(g.cols - 1, Math.round((x - g.originX) / CELL))),
    iz: Math.max(0, Math.min(g.rows - 1, Math.round((z - g.originZ) / CELL))),
  };
}

function atCell(g: Grid, ix: number, iz: number) {
  return { x: g.originX + ix * CELL, z: g.originZ + iz * CELL };
}

export function snapWalk(colliders: Aabb[], p: THREE.Vector3, bounds: Bounds) {
  const g = gridOf(colliders, bounds);
  const c = toCell(g, p.x, p.z);
  let best: THREE.Vector3 | null = null;
  let bestD = 1e9;
  for (let dz = -3; dz <= 3; dz++) {
    for (let dx = -3; dx <= 3; dx++) {
      const y = openY(g, c.ix + dx, c.iz + dz);
      if (!Number.isFinite(y)) continue;
      const pos = atCell(g, c.ix + dx, c.iz + dz);
      const d = Math.hypot(pos.x - p.x, pos.z - p.z);
      if (d < bestD) {
        bestD = d;
        best = new THREE.Vector3(pos.x, y, pos.z);
      }
    }
  }
  return best;
}

export function walkPath(
  colliders: Aabb[],
  bounds: Bounds,
  from: THREE.Vector3,
  to: THREE.Vector3,
): THREE.Vector3[] | null {
  const startV = snapWalk(colliders, from, bounds) ?? from;
  const goalV = snapWalk(colliders, to, bounds) ?? to;
  const dist = Math.hypot(goalV.x - startV.x, goalV.z - startV.z);
  if (dist < 2.4 && clearWalk(colliders, startV.x, startV.z, startV.y, goalV.x, goalV.z)) {
    return [startV.clone(), goalV.clone()];
  }

  const g = gridOf(colliders, bounds);
  const s = toCell(g, startV.x, startV.z);
  const goal = toCell(g, goalV.x, goalV.z);
  if (!Number.isFinite(openY(g, s.ix, s.iz)) || !Number.isFinite(openY(g, goal.ix, goal.iz))) return null;

  const idx = (ix: number, iz: number) => iz * g.cols + ix;
  const total = g.cols * g.rows;
  const came = new Int32Array(total);
  const cost = new Int32Array(total);
  const closed = new Uint8Array(total);
  came.fill(-1);
  cost.fill(1_000_000_000);
  const startI = idx(s.ix, s.iz);
  cost[startI] = 0;
  const open: number[] = [startI];
  const heur = (ix: number, iz: number) => {
    const dx = Math.abs(ix - goal.ix);
    const dz = Math.abs(iz - goal.iz);
    return (dx + dz) * 10 + Math.min(dx, dz) * 4;
  };

  let found = -1;
  let steps = 0;
  while (open.length && steps < 6000) {
    steps += 1;
    let bestI = 0;
    let bestF = 1e15;
    for (let i = 0; i < open.length; i++) {
      const n = open[i]!;
      const iz = Math.floor(n / g.cols);
      const ix = n - iz * g.cols;
      const f = cost[n]! + heur(ix, iz);
      if (f < bestF) {
        bestF = f;
        bestI = i;
      }
    }
    const cur = open[bestI]!;
    open[bestI] = open[open.length - 1]!;
    open.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    const iz = Math.floor(cur / g.cols);
    const ix = cur - iz * g.cols;
    if (ix === goal.ix && iz === goal.iz) {
      found = cur;
      break;
    }
    for (const [dx, dz, w] of DIRS) {
      const nx = ix + dx;
      const nz = iz + dz;
      const ni = idx(nx, nz);
      if (!Number.isFinite(openY(g, nx, nz)) || closed[ni]) continue;
      if (dx !== 0 && dz !== 0 && (!Number.isFinite(openY(g, ix + dx, iz)) || !Number.isFinite(openY(g, ix, iz + dz)))) {
        continue;
      }
      const ng = cost[cur]! + w;
      if (ng >= cost[ni]!) continue;
      cost[ni] = ng;
      came[ni] = cur;
      open.push(ni);
    }
  }

  if (found < 0) return null;
  const raw: THREE.Vector3[] = [];
  for (let i = found; i >= 0; i = came[i]!) {
    const iz = Math.floor(i / g.cols);
    const ix = i - iz * g.cols;
    const p = atCell(g, ix, iz);
    raw.push(new THREE.Vector3(p.x, openY(g, ix, iz), p.z));
    if (i === startI) break;
  }
  raw.reverse();
  const last = raw[raw.length - 1]!;
  if (Math.hypot(last.x - goalV.x, last.z - goalV.z) > 0.55) raw.push(goalV.clone());
  if (Math.hypot(raw[0]!.x - startV.x, raw[0]!.z - startV.z) > 0.55) raw.unshift(startV.clone());
  return simplify(colliders, raw);
}

function simplify(colliders: Aabb[], pts: THREE.Vector3[]) {
  if (pts.length <= 2) return pts;
  const out = [pts[0]!];
  let i = 0;
  while (i < pts.length - 1) {
    let best = i + 1;
    for (let j = pts.length - 1; j > i + 1; j--) {
      const a = pts[i]!;
      const b = pts[j]!;
      if (Math.hypot(b.x - a.x, b.z - a.z) > 2.6) continue;
      if (clearWalk(colliders, a.x, a.z, a.y, b.x, b.z)) {
        best = j;
        break;
      }
    }
    out.push(pts[best]!);
    i = best;
  }
  return out;
}

export function stitchPath(colliders: Aabb[], bounds: Bounds, pts: THREE.Vector3[]) {
  if (!pts.length) return [];
  const out: THREE.Vector3[] = [pts[0]!.clone()];
  for (let i = 1; i < pts.length; i++) {
    const a = out[out.length - 1]!;
    const b = pts[i]!;
    const hop = Math.hypot(b.x - a.x, b.z - a.z);
    if (hop <= 2.6 && clearWalk(colliders, a.x, a.z, a.y, b.x, b.z)) {
      if (hop > 0.7) out.push(b.clone());
      continue;
    }
    const via = walkPath(colliders, bounds, a, b);
    if (via && via.length >= 2) {
      for (const p of via.slice(1)) {
        const last = out[out.length - 1]!;
        if (Math.hypot(p.x - last.x, p.z - last.z) > 0.7) out.push(p);
      }
      continue;
    }
    if (i === pts.length - 1) out.push(b.clone());
  }
  return out;
}
