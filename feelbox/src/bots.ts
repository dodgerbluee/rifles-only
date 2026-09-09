import * as THREE from "three";
import { collideXZ, groundHeight, hasLos, inSite, spawnYaw, type Aabb, type World } from "./world";
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
import { fullNades, type NadeBag } from "./smoke";

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
  seeT: number;
  stuckT: number;
  nades: NadeBag;
};

export type BotSkill = "easy" | "normal" | "hard";

const BOT_AIM: Record<BotSkill, { turn: number; see: number; spread: number; fireMul: number; err: number }> = {
  easy: { turn: 1.55, see: 1.05, spread: 0.32, fireMul: 1.45, err: 0.32 },
  normal: { turn: 3.2, see: 0.55, spread: 0.16, fireMul: 1, err: 0.2 },
  hard: { turn: 6.4, see: 0.28, spread: 0.07, fireMul: 0.72, err: 0.12 },
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
    seeT: 0,
    stuckT: 0,
    nades: fullNades(),
  };
}

function pathFor(team: Team, site: "loft" | "well", world: World, seed = 0, match?: Match): THREE.Vector3[] {
  const dest = world.sites.find((s) => s.id === site)!;
  const plantWest = world.plantSpawns[0]!.x <= world.watchSpawns[0]!.x;
  const isPlant = match ? team === plantingTeam(match) : team === "ember";
  const fromWest = isPlant === plantWest;
  const routes = world.waypoints.filter((r) => r.length >= 2);
  const side = routes.filter((r) => (fromWest ? r[0]!.x < 4 : r[0]!.x > -4));
  const pool = side.length ? side : routes;
  const ranked = pool
    .map((r) => {
      const end = r[r.length - 1]!;
      return { r, d: Math.hypot(end.x - dest.x, end.z - dest.z) };
    })
    .sort((a, b) => a.d - b.d);
  const top = ranked.slice(0, Math.min(3, ranked.length));
  const picked = top.length ? top[seed % top.length]!.r : null;
  const jx = ((seed * 13) % 5) * 0.35 - 0.7;
  const jz = ((seed * 9) % 3) * 0.35 - 0.35;
  const raw = picked
    ? picked.map((p, i) => {
        if (i === picked.length - 1) return new THREE.Vector3(dest.x, dest.y, dest.z);
        return new THREE.Vector3(p.x + jx, p.y, p.z + jz);
      })
    : [new THREE.Vector3(dest.x, dest.y, dest.z)];
  if (Math.hypot(raw[raw.length - 1]!.x - dest.x, raw[raw.length - 1]!.z - dest.z) > 2) {
    raw.push(new THREE.Vector3(dest.x, dest.y, dest.z));
  }
  return raw.map((p) => {
    const c = collideXZ(world.colliders, p.x, p.z, RADIUS, p.y + 0.08, p.y + 1.7);
    return new THREE.Vector3(c.x, p.y, c.z);
  });
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
  skill: BotSkill = "normal",
): { cutting: boolean } {
  const plant = plantingTeam(match);
  const watch = watchingTeam(match);
  const aim = BOT_AIM[skill] ?? BOT_AIM.normal;
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
    const closeThreat = !!enemy && enemyDist < (onCutDuty || onPlantDuty ? 5.5 : 16);
    if (closeThreat) b.seeT += dt;
    else b.seeT = 0;

    b.aim = closeThreat;
    if (closeThreat && enemy) {
      const dx = enemy.x - b.x;
      const dy = enemy.y - (b.y + 1.45);
      const dz = enemy.z - b.z;
      const horiz = Math.hypot(dx, dz) || 1;
      b.lookPitch = -Math.atan2(dy, horiz);
      const want = Math.atan2(-dx, -dz);
      b.yaw = dampAngle(b.yaw, want, dt * aim.turn);
      const interval = (1.05 + (b.id % 5) * 0.18) * aim.fireMul;
      const err = angleErr(b.yaw, want);
      if (b.seeT > aim.see && err < aim.err && time - b.lastShot > interval) {
        b.lastShot = time;
        const dir = new THREE.Vector3(
          -Math.sin(b.yaw) * Math.cos(b.lookPitch),
          -Math.sin(b.lookPitch),
          -Math.cos(b.yaw) * Math.cos(b.lookPitch),
        );
        dir.x += (Math.random() - 0.5) * aim.spread;
        dir.y += (Math.random() - 0.5) * aim.spread * 0.62;
        dir.z += (Math.random() - 0.5) * aim.spread;
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
    const moved = Math.hypot(b.x - b.lastX, b.z - b.lastZ);
    if (b.aim || time < b.pauseUntil) b.stuckT = 0;
    else if (moved < 0.03) b.stuckT += dt;
    else b.stuckT = Math.max(0, b.stuckT - dt * 2);
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
  slideToward(b, target.x, target.z, dt, colliders, time);
}

function roam(b: Bot, dt: number, colliders: Aabb[], time: number) {
  if (time < b.pauseUntil) {
    b.stuckT = 0;
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
  } else if (b.stuckT > 0.55 && b.wp < b.path.length - 1) {
    b.wp += 1;
    b.stuckT = 0;
    target = b.path[b.wp] ?? target;
  }
  seek(b, target, dt, colliders, time);
}

function strafeMove(b: Bot, dt: number, colliders: Aabb[], time: number) {
  const side = Math.sin(time * (1.2 + (b.id % 3) * 0.2) + b.id) * b.strafe;
  const fx = -Math.sin(b.yaw);
  const fz = -Math.cos(b.yaw);
  slideToward(b, b.x - fz * side * 4, b.z + fx * side * 4, dt, colliders, time);
}

function slideToward(b: Bot, tx: number, tz: number, dt: number, colliders: Aabb[], time: number) {
  const dx = tx - b.x;
  const dz = tz - b.z;
  const dist = Math.hypot(dx, dz) || 1;
  const stepLen = tuning.walk * 0.52 * dt;
  const base = Math.atan2(dz, dx);
  const sway = Math.sin(time * 1.1 + b.id) * 0.16;
  const spreads = [0, 0.32, -0.32, 0.7, -0.7, 1.15, -1.15, 1.65, -1.65];
  let bestX = b.x;
  let bestZ = b.z;
  let bestScore = -1e9;
  for (const a of spreads) {
    const ang = base + a + sway * (a === 0 ? 1 : 0.2);
    const c = collideXZ(
      colliders,
      b.x + Math.cos(ang) * stepLen,
      b.z + Math.sin(ang) * stepLen,
      RADIUS,
      b.y + 0.08,
      b.y + 1.7,
    );
    const moved = Math.hypot(c.x - b.x, c.z - b.z);
    if (moved < stepLen * 0.12) continue;
    const remain = Math.hypot(tx - c.x, tz - c.z);
    const score = (dist - remain) * 6 + moved * 0.4 - Math.abs(a) * 0.14;
    if (score > bestScore) {
      bestScore = score;
      bestX = c.x;
      bestZ = c.z;
    }
  }
  b.x = bestX;
  b.z = bestZ;
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
    restorePawnHead(b.root);
    b.pauseUntil = 0;
    b.lastX = spawn.x;
    b.lastZ = spawn.z;
    b.seeT = 0;
    b.stuckT = 0;
    setPawnCloth(b.cloth, teamCloth(b.team));
    b.nades = fullNades();
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

export function restorePawnHead(root: THREE.Object3D) {
  root.userData.headPopped = false;
  root.traverse((o) => {
    if (o instanceof THREE.Mesh && o.userData?.part === "head") o.visible = true;
  });
}

export function restoreHead(b: Bot) {
  restorePawnHead(b.root);
}

export function popPawnHead(root: THREE.Object3D, scene: THREE.Scene) {
  if (root.userData.headPopped) return false;
  root.userData.headPopped = true;
  root.traverse((o) => {
    if (o instanceof THREE.Mesh && o.userData?.part === "head") o.visible = false;
  });
  const origin = new THREE.Vector3();
  const head = root.userData.head as THREE.Object3D | undefined;
  if (head) head.getWorldPosition(origin);
  else {
    origin.copy(root.position);
    origin.y += 1.68;
  }
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
  return true;
}

export function popHead(b: Bot, scene: THREE.Scene) {
  b.stayUp = true;
  popPawnHead(b.root, scene);
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
  let bestD = 16;
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

function angleErr(cur: number, want: number) {
  let d = want - cur;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

function dampAngle(cur: number, want: number, k: number) {
  let d = want - cur;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return cur + d * Math.min(1, k);
}
