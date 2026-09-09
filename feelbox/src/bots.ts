import * as THREE from "three";
import { collideXZ, groundHeight, inSite, rayShot, spawnYaw, type Aabb, type World } from "./world";
import {
  plantingTeam,
  pickupWire,
  plantWire,
  slotById,
  watchingTeam,
  type Match,
  type Slot,
  type Team,
} from "./match";
import { teamCloth, setPawnCloth, buildPawn, stepWalkFromPos } from "./pawn";
import { tuning } from "./tuning";

export type Bot = {
  id: number;
  team: Team;
  root: THREE.Group;
  body: THREE.Mesh;
  head: THREE.Mesh;
  helm: THREE.Mesh;
  rifle: THREE.Mesh;
  cloth: THREE.Mesh[];
  hits: THREE.Mesh[];
  hp: number;
  deadAt: number;
  stayUp: boolean;
  spawn: THREE.Vector3;
  path: THREE.Vector3[];
  wp: number;
  yaw: number;
  x: number;
  y: number;
  z: number;
  lastShot: number;
  flash: number;
  aim: boolean;
  lookPitch: number;
  site: "loft" | "well";
  style: number;
  strafe: number;
  pauseUntil: number;
  lastX: number;
  lastZ: number;
};

export const HEAD_POP_RATE = 1;
const HP = 100;
const RADIUS = 0.32;

export function createBots(scene: THREE.Scene, world: World, match: Match): Bot[] {
  const bots: Bot[] = [];
  for (const slot of match.slots) {
    if (slot.kind === "human") continue;
    bots.push(makeBot(scene, world, match, slot));
  }
  return bots;
}

export function spawnBot(scene: THREE.Scene, world: World, match: Match, slot: Slot): Bot {
  return makeBot(scene, world, match, slot);
}

export function despawnBot(scene: THREE.Scene, bots: Bot[], id: number): Bot | undefined {
  const i = bots.findIndex((b) => b.id === id);
  if (i < 0) return undefined;
  const b = bots[i]!;
  scene.remove(b.root);
  bots.splice(i, 1);
  return b;
}

function spawnOf(world: World, match: Match, slot: Slot) {
  const planter = plantingTeam(match);
  const list = slot.team === planter ? world.plantSpawns : world.watchSpawns;
  const mates = match.slots.filter((s) => s.team === slot.team);
  const idx = Math.max(0, mates.findIndex((s) => s.id === slot.id));
  return list[idx % list.length]!.clone();
}

function makeBot(scene: THREE.Scene, world: World, match: Match, slot: Slot): Bot {
  const spawn = spawnOf(world, match, slot);
  const site: "loft" | "well" = slot.id % 2 === 0 ? "loft" : "well";
  const style = slot.id % 3;
  const path = pathFor(slot.team, site, world, slot.id, match);
  const root = new THREE.Group();
  root.position.copy(spawn);
  const fig = buildPawn(root, slot.team, slot.id);
  scene.add(root);
  return {
    id: slot.id,
    team: slot.team,
    root,
    body: fig.body,
    head: fig.head,
    helm: fig.helm,
    rifle: fig.rifle,
    cloth: fig.cloth,
    hits: fig.hits,
    hp: HP,
    deadAt: 0,
    stayUp: false,
    spawn: spawn.clone(),
    path,
    wp: 0,
    yaw: spawnYaw(spawn, world),
    x: spawn.x,
    y: spawn.y,
    z: spawn.z,
    lastShot: -10,
    flash: 0,
    aim: false,
    lookPitch: 0.04,
    site,
    style,
    strafe: (slot.id % 2 === 0 ? 1 : -1) * (0.7 + (slot.id % 3) * 0.15),
    pauseUntil: 0,
    lastX: spawn.x,
    lastZ: spawn.z,
  };
}

function pathFor(team: Team, site: "loft" | "well", world: World, seed = 0, match?: Match): THREE.Vector3[] {
  const loft = world.sites.find((s) => s.id === "loft")!;
  const well = world.sites.find((s) => s.id === "well")!;
  const j = (x: number, z: number, y?: number) =>
    v(x + ((seed * 13) % 7) - 3, z + ((seed * 9) % 5) - 2, y);
  const variant = seed % 3;
  const plantWest = world.plantSpawns[0]!.x <= world.watchSpawns[0]!.x;
  const isPlant = match ? team === plantingTeam(match) : team === "ember";
  const fromWest = isPlant === plantWest;
  if (site === "loft") {
    if (fromWest) {
      if (variant === 1) return [j(-28, 8), j(-20, 10), j(-14, 16), v(-10.6, 16.5, 3.35), new THREE.Vector3(loft.x, loft.y, loft.z)];
      if (variant === 2) return [j(-30, 4), j(-18, 6), j(-12, 14), v(-10.6, 16.5, 3.35), new THREE.Vector3(loft.x, loft.y, loft.z)];
      return [j(-28, 13.4), j(-20, 13), j(-12, 13.2), v(-10.6, 16.5, 3.35), new THREE.Vector3(loft.x, loft.y, loft.z)];
    }
    if (variant === 1) return [j(28, 8), j(16, 10), j(6, 14), j(-4, 16), v(-10.6, 16.5, 3.35), new THREE.Vector3(loft.x, loft.y, loft.z)];
    if (variant === 2) return [j(26, 2), j(12, 6), j(4, 12), j(-8, 14), v(-10.6, 16.5, 3.35), new THREE.Vector3(loft.x, loft.y, loft.z)];
    return [j(28, 4.7), j(18, 5), j(12, 8), j(12, 13), j(-2, 13), v(-10.6, 16.5, 3.35), new THREE.Vector3(loft.x, loft.y, loft.z)];
  }
  if (fromWest) {
    if (variant === 1) return [j(-28, 6), j(-16, -2), j(-4, -10), new THREE.Vector3(well.x, well.y, well.z)];
    if (variant === 2) return [j(-26, 12), j(-18, 2), j(-6, -8), j(6, -14), new THREE.Vector3(well.x, well.y, well.z)];
    return [j(-28, 13.4), j(-24, 6), j(-20, -4), j(-8, -8), j(4, -12), new THREE.Vector3(well.x, well.y, well.z)];
  }
  if (variant === 1) return [j(28, 8), j(18, -2), j(12, -10), new THREE.Vector3(well.x, well.y, well.z)];
  if (variant === 2) return [j(30, 2), j(20, -8), j(14, -16), new THREE.Vector3(well.x, well.y, well.z)];
  return [j(28, 4.7), j(20, 2), j(14, -6), j(10, -14), new THREE.Vector3(well.x, well.y, well.z)];
}

function v(x: number, z: number, y = 0) {
  return new THREE.Vector3(x, y, z);
}

export function botTargets(bots: Bot[], enemyOf?: Team, skipIds: number[] = []) {
  const out: THREE.Object3D[] = [];
  for (const b of bots) {
    if (b.hp <= 0) continue;
    if (skipIds.includes(b.id)) continue;
    if (enemyOf && b.team === enemyOf) continue;
    out.push(b.body, b.head, b.helm, ...b.hits);
  }
  return out;
}

export type Fighter = {
  id: number;
  team: Team;
  x: number;
  y: number;
  z: number;
  alive: boolean;
};

export function updateBots(
  bots: Bot[],
  dt: number,
  time: number,
  colliders: Aabb[],
  world: World,
  match: Match,
  fighters: Fighter[],
  frozen: boolean,
  onShoot: (from: THREE.Vector3, dir: THREE.Vector3, target: Fighter, shooterId: number) => void,
  smokeBlocks: (
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
  ) => boolean,
  frozenIds: number[] = [],
): { cutting: boolean } {
  const plant = plantingTeam(match);
  const watch = watchingTeam(match);
  let cutting = false;

  for (const b of bots) {
    if (b.hp <= 0) {
      if (!b.stayUp) b.root.rotation.x = Math.min(1.25, b.root.rotation.x + dt * 2.6);
      stepWalkFromPos(b.root, b.x, b.z, false);
      continue;
    }
    if (!slotById(match, b.id)?.alive) continue;

    b.flash = Math.max(0, b.flash - dt * 5);
    setPawnCloth(b.cloth, b.flash > 0 ? 0xdeece0 : teamCloth(b.team));

    if (frozen || frozenIds.includes(b.id)) {
      b.root.position.set(b.x, b.y, b.z);
      stepWalkFromPos(b.root, b.x, b.z, false);
      continue;
    }

    if (match.wire.mode === "ground" && b.team === plant) {
      const d = Math.hypot(b.x - match.wire.x, b.z - match.wire.z);
      if (d < 1.2 && Math.abs(b.y - match.wire.y) < 1.8) pickupWire(match, b.id, b.team);
    }

    const enemy = nearestVisible(b, fighters, colliders, smokeBlocks);
    const enemyDist = enemy ? Math.hypot(enemy.x - b.x, enemy.z - b.z) : 99;
    const wirePos = wireAim(match, world, b);
    const onCutDuty = match.wire.mode === "planted" && b.team === watch;
    const onPlantDuty = match.wire.mode === "carried" && match.wire.carrierId === b.id;
    const closeThreat = !!enemy && enemyDist < (onCutDuty || onPlantDuty ? 6.5 : 26);

    b.aim = closeThreat;
    if (closeThreat && enemy) {
      const dx = enemy.x - b.x;
      const dy = enemy.y - (b.y + 1.45);
      const dz = enemy.z - b.z;
      const horiz = Math.hypot(dx, dz) || 1;
      b.lookPitch = -Math.atan2(dy, horiz);
      const want = Math.atan2(-dx, -dz);
      b.yaw = dampAngle(b.yaw, want, dt * 6);
      const interval = 0.62 + (b.id % 5) * 0.11;
      if (time - b.lastShot > interval) {
        b.lastShot = time;
        const dir = new THREE.Vector3(enemy.x - b.x, enemy.y - 1.45, enemy.z - b.z).normalize();
        dir.x += (Math.random() - 0.5) * 0.055;
        dir.y += (Math.random() - 0.5) * 0.04;
        dir.z += (Math.random() - 0.5) * 0.055;
        dir.normalize();
        onShoot(new THREE.Vector3(b.x, b.y + 1.45, b.z), dir, enemy, b.id);
      }
      strafeMove(b, dt, colliders, time);
    } else if (onCutDuty && wirePos) {
      b.lookPitch = 0.12;
      const d = Math.hypot(b.x - wirePos.x, b.z - wirePos.z);
      const near = d < 1.35 && Math.abs(b.y - wirePos.y) < 1.7;
      if (near) {
        cutting = true;
        b.yaw = dampAngle(b.yaw, b.yaw + Math.sin(time * 0.8 + b.id) * 0.2, dt);
      } else {
        seek(b, wirePos, dt, colliders, time);
      }
    } else if (onPlantDuty) {
      const prefer = world.sites.find((s) => s.id === b.site)!;
      if (inSite(world, b.site, b.x, b.z, b.y)) {
        match.wire.plantHold += dt;
        if (match.wire.plantHold >= tuning.plant) plantWire(match, b.site, b.x, b.y, b.z);
      } else {
        seek(b, new THREE.Vector3(prefer.x, prefer.y, prefer.z), dt, colliders, time);
      }
    } else if (match.wire.mode === "ground" && b.team === plant) {
      seek(b, new THREE.Vector3(match.wire.x, match.wire.y, match.wire.z), dt, colliders, time);
    } else {
      b.lookPitch = 0.04;
      roam(b, dt, colliders, time);
    }

    const gh = groundHeight(colliders, b.x, b.z, RADIUS, b.y);
    if (b.y > gh + 0.1) b.y = Math.max(gh, b.y - 12 * dt);
    else b.y = gh;

    b.root.position.set(b.x, b.y, b.z);
    b.root.rotation.y = b.yaw;
    b.rifle.rotation.x = b.aim ? -0.12 : 0.08;
    stepWalkFromPos(b.root, b.x, b.z, true);
    b.lastX = b.x;
    b.lastZ = b.z;
  }

  if (cutting) match.wire.cutHold += dt;
  return { cutting };
}

function wireAim(match: Match, world: World, b: Bot) {
  if (match.wire.mode === "planted") {
    return new THREE.Vector3(match.wire.x, match.wire.y, match.wire.z);
  }
  const s = world.sites.find((s) => s.id === b.site);
  return s ? new THREE.Vector3(s.x, s.y, s.z) : null;
}

function seek(b: Bot, target: THREE.Vector3, dt: number, colliders: Aabb[], time: number) {
  const dx = target.x - b.x;
  const dz = target.z - b.z;
  const len = Math.hypot(dx, dz);
  if (len < 0.45) return;
  const want = Math.atan2(-dx, -dz);
  b.yaw = dampAngle(b.yaw, want, dt * 5);
  const wobble = Math.sin(time * 1.1 + b.id) * 0.35;
  const fx = dx / len;
  const fz = dz / len;
  const px = -fz;
  const pz = fx;
  step(b, fx + px * wobble, fz + pz * wobble, dt, colliders);
}

function roam(b: Bot, dt: number, colliders: Aabb[], time: number) {
  if (time < b.pauseUntil) {
    b.yaw += Math.sin(time * 0.9 + b.id) * dt * 0.8;
    return;
  }
  const last = b.path[b.path.length - 1];
  let target = b.path[b.wp] ?? last ?? b.spawn;
  const dx = target.x - b.x;
  const dz = target.z - b.z;
  const len = Math.hypot(dx, dz);
  if (len < 0.6) {
    if (b.wp < b.path.length - 1) b.wp += 1;
    else if (b.style === 2) {
      b.pauseUntil = time + 0.8 + (b.id % 4) * 0.35;
      b.wp = Math.max(0, b.path.length - 2);
    } else {
      const orbit = 1.4 + (b.id % 3) * 0.5;
      const a = time * (0.35 + (b.id % 3) * 0.08) + b.id;
      target = new THREE.Vector3(
        (last?.x ?? b.x) + Math.cos(a) * orbit,
        last?.y ?? b.y,
        (last?.z ?? b.z) + Math.sin(a) * orbit,
      );
      seek(b, target, dt, colliders, time);
      return;
    }
  }
  seek(b, target, dt, colliders, time);
}

function strafeMove(b: Bot, dt: number, colliders: Aabb[], time: number) {
  const side = Math.sin(time * (1.2 + (b.id % 3) * 0.2) + b.id) * b.strafe;
  const fx = -Math.sin(b.yaw);
  const fz = -Math.cos(b.yaw);
  step(b, -fz * side * 0.55, fx * side * 0.55, dt, colliders);
}

function step(b: Bot, mx: number, mz: number, dt: number, colliders: Aabb[]) {
  const len = Math.hypot(mx, mz) || 1;
  const stepLen = tuning.walk * 0.5 * dt;
  const nx = b.x + (mx / len) * stepLen;
  const nz = b.z + (mz / len) * stepLen;
  const c = collideXZ(colliders, nx, nz, RADIUS, b.y + 0.08, b.y + 1.7);
  const moved = Math.hypot(c.x - b.x, c.z - b.z);
  if (moved < stepLen * 0.2) {
    const px = -mz / len;
    const pz = mx / len;
    const s = collideXZ(colliders, b.x + px * stepLen, b.z + pz * stepLen, RADIUS, b.y + 0.08, b.y + 1.7);
    b.x = s.x;
    b.z = s.z;
  } else {
    b.x = c.x;
    b.z = c.z;
  }
}

export function resetBots(bots: Bot[], world: World, match: Match) {
  for (const b of bots) {
    const slot = slotById(match, b.id);
    if (!slot) continue;
    const spawn = spawnOf(world, match, slot);
    b.hp = HP;
    b.deadAt = 0;
    b.x = spawn.x;
    b.y = spawn.y;
    b.z = spawn.z;
    b.spawn.copy(spawn);
    b.wp = 0;
    b.path = pathFor(b.team, b.site, world, b.id + match.round * 3, match);
    b.root.position.copy(spawn);
    b.root.rotation.x = 0;
    b.root.userData.gait = 0;
    b.root.userData.walkX = spawn.x;
    b.root.userData.walkZ = spawn.z;
    stepWalkFromPos(b.root, spawn.x, spawn.z, false);
    b.yaw = spawnYaw(spawn, world);
    b.stayUp = false;
    b.head.visible = true;
    b.helm.visible = true;
    b.pauseUntil = 0;
    b.lastX = spawn.x;
    b.lastZ = spawn.z;
    setPawnCloth(b.cloth, teamCloth(b.team));
  }
}

export function refillBotPawn(b: Bot) {
  const fig = buildPawn(b.root, b.team, b.id);
  b.body = fig.body;
  b.head = fig.head;
  b.helm = fig.helm;
  b.rifle = fig.rifle;
  b.cloth = fig.cloth;
  b.hits = fig.hits;
}

export function restoreHead(b: Bot) {
  b.head.visible = true;
  b.helm.visible = true;
}

export function popHead(b: Bot, scene: THREE.Scene) {
  b.head.visible = false;
  b.helm.visible = false;
  b.stayUp = true;
  const origin = b.root.position.clone();
  origin.y += 1.68;
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(0.04 + Math.random() * 0.05, 6, 5),
      new THREE.MeshBasicMaterial({ color: i < 3 ? 0x2a1810 : 0x8a1a12 }),
    );
    s.position.copy(origin);
    scene.add(s);
    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 5.5,
      2.2 + Math.random() * 3.4,
      (Math.random() - 0.5) * 5.5,
    );
    goreBits.push({ mesh: s, vel, life: 0.55 + Math.random() * 0.35 });
  }
}

const goreBits: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[] = [];

export function updateGore(scene: THREE.Scene, dt: number) {
  for (let i = goreBits.length - 1; i >= 0; i--) {
    const g = goreBits[i]!;
    g.life -= dt;
    g.vel.y -= 18 * dt;
    g.mesh.position.addScaledVector(g.vel, dt);
    g.mesh.scale.setScalar(Math.max(0.02, g.life * 1.6));
    if (g.life <= 0) {
      scene.remove(g.mesh);
      g.mesh.geometry.dispose();
      goreBits.splice(i, 1);
    }
  }
}

export function hurtBot(b: Bot, dmg: number, time: number) {
  if (b.hp <= 0) return false;
  b.hp = Math.max(0, b.hp - dmg);
  b.flash = 1;
  if (b.hp <= 0) {
    b.deadAt = time;
    setPawnCloth(b.cloth, 0x2a3224);
    return true;
  }
  return false;
}

function nearestVisible(
  b: Bot,
  fighters: Fighter[],
  colliders: Aabb[],
  smokeBlocks: (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => boolean,
): Fighter | null {
  let best: Fighter | null = null;
  let bestD = 26;
  for (const f of fighters) {
    if (!f.alive || f.team === b.team || f.id === b.id) continue;
    const d = Math.hypot(f.x - b.x, f.z - b.z);
    if (d > bestD) continue;
    if (!hasLos(b.x, b.y + 1.5, b.z, f.x, f.y, f.z, colliders)) continue;
    if (smokeBlocks(b.x, b.y + 1.5, b.z, f.x, f.y, f.z)) continue;
    bestD = d;
    best = f;
  }
  return best;
}

function hasLos(
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
  const hit = rayShot(origin, dir, dist - 0.4, colliders);
  return !hit;
}

function dampAngle(cur: number, want: number, k: number) {
  let d = want - cur;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return cur + d * Math.min(1, k);
}
