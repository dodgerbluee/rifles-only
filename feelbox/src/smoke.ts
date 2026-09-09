import * as THREE from "three";
import { rayWorld, type Aabb } from "./world";

export type NadeKind = "smoke" | "frag" | "stun" | "flash";

export const NADE_ORDER: NadeKind[] = ["smoke", "frag", "stun", "flash"];

export const NADE_COLOR: Record<NadeKind, number> = {
  smoke: 0x3a4a32,
  frag: 0x5c3a22,
  stun: 0x3a4a62,
  flash: 0xc4b896,
};

export type SmokeCloud = {
  x: number;
  y: number;
  z: number;
  radius: number;
  opacity: number;
};

export type NadePop = {
  kind: NadeKind;
  x: number;
  y: number;
  z: number;
};

type Nade = {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  fuse: number;
  kind: NadeKind;
  settled: boolean;
  air: number;
};

type Cloud = {
  root: THREE.Group;
  puffs: { mesh: THREE.Mesh; base: THREE.Vector3; phase: number; size: number }[];
  pos: THREE.Vector3;
  age: number;
  radius: number;
};

const LAND_FUSE: Record<NadeKind, number> = {
  smoke: 0.42,
  frag: 0.16,
  stun: 0.22,
  flash: 0.2,
};

const GROW = 1.35;
const LIFE = 14;
const FADE = 3.2;
const MAX_R = 6.9;
const MAX_AIR = 8;
const PUFF_MAT = new THREE.MeshLambertMaterial({
  color: 0xc4bba6,
  transparent: true,
  opacity: 0.32,
  depthWrite: false,
  side: THREE.DoubleSide,
});

const nades: Nade[] = [];
const clouds: Cloud[] = [];
const pendingPops: NadePop[] = [];
const puffGeo = new THREE.SphereGeometry(1, 14, 10);

export function nadeColor(kind: NadeKind) {
  return NADE_COLOR[kind];
}

export function activeClouds(): SmokeCloud[] {
  return clouds.map((c) => ({
    x: c.pos.x,
    y: c.pos.y,
    z: c.pos.z,
    radius: c.radius,
    opacity: puffOpacity(c.age),
  }));
}

export type AirNade = { x: number; y: number; z: number; kind: NadeKind };

export function activeNades(): AirNade[] {
  return nades.map((n) => ({ x: n.pos.x, y: n.pos.y, z: n.pos.z, kind: n.kind }));
}

export function drainPops(): NadePop[] {
  return pendingPops.splice(0);
}

export function smokeBlocksLos(
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
) {
  for (const c of clouds) {
    if (c.radius < 0.8 || puffOpacity(c.age) < 0.12) continue;
    if (segHitsSphere(x0, y0, z0, x1, y1, z1, c.pos.x, c.pos.y + 1.1, c.pos.z, c.radius * 0.88))
      return true;
  }
  return false;
}

export function smokeCoverage(x: number, y: number, z: number) {
  let best = 0;
  for (const c of clouds) {
    const d = Math.hypot(x - c.pos.x, y - (c.pos.y + 1.0), z - c.pos.z);
    const op = puffOpacity(c.age);
    if (c.radius < 0.4 || op < 0.08) continue;
    best = Math.max(best, (1 - d / c.radius) * op);
  }
  return Math.max(0, Math.min(1, best));
}

export function throwSmoke(
  scene: THREE.Scene,
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  power = 0.55,
  kind: NadeKind = "smoke",
) {
  const mesh = makeNadeMesh(kind);
  mesh.position.copy(origin);
  scene.add(mesh);
  const p = Math.max(0, Math.min(1, power));
  const vel = dir.clone().normalize();
  vel.multiplyScalar(7.5 + p * 16);
  vel.y += 1.8 + p * 4.4;
  nades.push({ mesh, pos: origin.clone(), vel, fuse: 99, kind, settled: false, air: 0 });
}

export function dropSmoke(scene: THREE.Scene, origin: THREE.Vector3, kind: NadeKind = "smoke") {
  const mesh = makeNadeMesh(kind);
  mesh.position.copy(origin);
  scene.add(mesh);
  nades.push({
    mesh,
    pos: origin.clone(),
    vel: new THREE.Vector3(0, -0.4, 0),
    fuse: 99,
    kind,
    settled: false,
    air: 0,
  });
}

export function updateSmoke(
  scene: THREE.Scene,
  dt: number,
  colliders: Aabb[],
  onPop?: (pop: NadePop) => void,
) {
  for (let i = nades.length - 1; i >= 0; i--) {
    const n = nades[i]!;
    stepNade(n, dt, colliders);
    if (n.settled) n.fuse -= dt;
    n.mesh.position.copy(n.pos);
    if (!n.settled) {
      n.mesh.rotation.x += dt * 8;
      n.mesh.rotation.z += dt * 5;
    }
    if (n.settled && n.fuse <= 0) {
      const pos = n.pos.clone();
      const kind = n.kind;
      scene.remove(n.mesh);
      n.mesh.geometry.dispose();
      (n.mesh.material as THREE.Material).dispose();
      nades.splice(i, 1);
      if (kind === "smoke") spawnCloud(scene, pos);
      const pop: NadePop = { kind, x: pos.x, y: pos.y, z: pos.z };
      pendingPops.push(pop);
      onPop?.(pop);
    }
  }

  for (let i = clouds.length - 1; i >= 0; i--) {
    const c = clouds[i]!;
    c.age += dt;
    const growT = Math.min(1, c.age / GROW);
    c.radius = THREE.MathUtils.lerp(0.5, MAX_R, 1 - Math.pow(1 - growT, 2));
    const op = puffOpacity(c.age);
    for (const p of c.puffs) {
      const s = p.size * c.radius * (0.22 + 0.08 * Math.sin(c.age * 0.7 + p.phase));
      p.mesh.scale.setScalar(Math.max(0.05, s));
      p.mesh.position.set(
        p.base.x * c.radius * 0.28,
        p.base.y * c.radius * 0.16 + Math.sin(c.age * 0.9 + p.phase) * 0.22,
        p.base.z * c.radius * 0.28,
      );
      (p.mesh.material as THREE.MeshLambertMaterial).opacity = op * 0.38;
    }
    if (c.age > LIFE) {
      scene.remove(c.root);
      clouds.splice(i, 1);
    }
  }
}

function makeNadeMesh(kind: NadeKind) {
  const geo = new THREE.CylinderGeometry(0.045, 0.05, 0.13, 8);
  const mat = new THREE.MeshStandardMaterial({
    color: NADE_COLOR[kind],
    roughness: 0.55,
    metalness: kind === "flash" ? 0.45 : 0.2,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return mesh;
}

function spawnCloud(scene: THREE.Scene, pos: THREE.Vector3) {
  const root = new THREE.Group();
  root.position.copy(pos);
  const puffs: Cloud["puffs"] = [];
  for (let i = 0; i < 16; i++) {
    const mat = PUFF_MAT.clone();
    const mesh = new THREE.Mesh(puffGeo, mat);
    mesh.renderOrder = 2;
    const base = new THREE.Vector3(
      (Math.random() - 0.5) * 2.4,
      0.35 + Math.random() * 1.5,
      (Math.random() - 0.5) * 2.4,
    );
    const size = 0.95 + Math.random() * 0.85;
    mesh.scale.setScalar(0.2);
    root.add(mesh);
    puffs.push({ mesh, base, phase: Math.random() * Math.PI * 2, size });
  }
  scene.add(root);
  clouds.push({ root, puffs, pos: pos.clone(), age: 0, radius: 0.5 });
}

export function applyCloudSnap(scene: THREE.Scene, snaps: SmokeCloud[]) {
  while (clouds.length > snaps.length) {
    const c = clouds.pop()!;
    scene.remove(c.root);
  }
  while (clouds.length < snaps.length) spawnCloud(scene, new THREE.Vector3());
  for (let i = 0; i < snaps.length; i++) {
    const s = snaps[i]!;
    const c = clouds[i]!;
    c.pos.set(s.x, s.y, s.z);
    c.root.position.copy(c.pos);
    c.radius = s.radius;
    c.age = s.opacity < 0.2 ? LIFE - FADE + 0.2 : GROW + 1;
  }
}

export function applyNadeSnap(scene: THREE.Scene, snaps: AirNade[]) {
  while (nades.length > snaps.length) {
    const n = nades.pop()!;
    scene.remove(n.mesh);
    n.mesh.geometry.dispose();
    (n.mesh.material as THREE.Material).dispose();
  }
  while (nades.length < snaps.length) {
    const mesh = makeNadeMesh("smoke");
    scene.add(mesh);
    nades.push({
      mesh,
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      fuse: 99,
      kind: "smoke",
      settled: false,
      air: 0,
    });
  }
  for (let i = 0; i < snaps.length; i++) {
    const s = snaps[i]!;
    const n = nades[i]!;
    if (n.kind !== s.kind) {
      (n.mesh.material as THREE.MeshStandardMaterial).color.set(NADE_COLOR[s.kind]);
      n.kind = s.kind;
    }
    n.pos.set(s.x, s.y, s.z);
    n.mesh.position.copy(n.pos);
    n.mesh.rotation.x += 0.12;
    n.mesh.rotation.z += 0.08;
  }
}

function puffOpacity(age: number) {
  if (age < 0.25) return age / 0.25;
  if (age > LIFE - FADE) return Math.max(0, (LIFE - age) / FADE);
  return 1;
}

function markSettled(n: Nade) {
  if (n.settled) return;
  n.settled = true;
  n.fuse = LAND_FUSE[n.kind];
  n.vel.set(0, 0, 0);
}

function stepNade(n: Nade, dt: number, colliders: Aabb[]) {
  n.air += dt;
  if (n.air > MAX_AIR) {
    n.pos.y = Math.max(n.pos.y, 0.07);
    markSettled(n);
    return;
  }
  n.vel.y -= 16.5 * dt;
  const step = n.vel.length() * dt;
  if (step < 0.0001) {
    if (n.pos.y < 0.12) markSettled(n);
    return;
  }
  const dir = n.vel.clone().normalize();
  const hit = rayWorld(n.pos, dir, step + 0.08, colliders);
  if (hit && hit.dist <= step + 0.08) {
    n.pos.copy(hit.point).addScaledVector(hit.normal, 0.08);
    const vn = n.vel.dot(hit.normal);
    n.vel.addScaledVector(hit.normal, -1.75 * vn);
    n.vel.multiplyScalar(0.52);
    if (hit.normal.y > 0.55) {
      n.vel.y = 0;
      n.vel.x *= 0.55;
      n.vel.z *= 0.55;
      if (n.vel.length() < 1.35) markSettled(n);
    }
  } else {
    n.pos.addScaledVector(n.vel, dt);
  }
  if (n.pos.y < 0.07) {
    n.pos.y = 0.07;
    n.vel.y = 0;
    n.vel.x *= 0.55;
    n.vel.z *= 0.55;
    if (n.vel.length() < 1.2) markSettled(n);
  }
}

function segHitsSphere(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number,
  r: number,
) {
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const acx = cx - ax;
  const acy = cy - ay;
  const acz = cz - az;
  const ab2 = abx * abx + aby * aby + abz * abz;
  let t = ab2 > 0.0001 ? (acx * abx + acy * aby + acz * abz) / ab2 : 0;
  t = Math.max(0, Math.min(1, t));
  const dx = ax + abx * t - cx;
  const dy = ay + aby * t - cy;
  const dz = az + abz * t - cz;
  return dx * dx + dy * dy + dz * dz < r * r;
}

export function clearNades(scene: THREE.Scene) {
  for (const n of nades) scene.remove(n.mesh);
  nades.length = 0;
  for (const c of clouds) scene.remove(c.root);
  clouds.length = 0;
  pendingPops.length = 0;
}
