import * as THREE from "three";
import { collideXZ, groundHeight, type World } from "./world";
import { addBotSlot, claimSlot, plantingTeam, slotById, vacateSlot, type Match, type Team } from "./match";
import { despawnBot, spawnBot, type Bot } from "./bots";
import type { NetHandle, Pawn, PlayerInput, Snapshot, Weapon } from "./net";
import { activeClouds, activeNades, drainPops } from "./smoke";

import { line, swapLines } from "./stats";
import { tuning } from "./tuning";
import { emptyQueue, type FireQueue } from "./fireQueue";
import { buildPawn, parseSkin, poseStance, stepWalk, stepWalkFromPos, type PawnSkin } from "./pawn";
import { fullNades, type NadeBag } from "./smoke";

const RADIUS = 0.32;

export type Remote = {
  peerId: number;
  slotId: number;
  homeId: number;
  name: string;
  team: Team;
  x: number;
  y: number;
  z: number;
  vy: number;
  yaw: number;
  pitch: number;
  hp: number;
  alive: boolean;
  weapon: Weapon;
  ads: boolean;
  crouch: boolean;
  prone: boolean;
  input: PlayerInput;
  lastFire: number;
  lastMelee: number;
  lastThrow: number;
  jumpHeld: boolean;
  ping: number;
  fireQ: FireQueue;
  nades: NadeBag;
  root: THREE.Group;
  skin: PawnSkin;
};

function standIn(team: Team, name: string, id?: number, skin?: PawnSkin) {
  const root = new THREE.Group();
  const fig = buildPawn(root, team, id, skin);
  root.userData.name = name;
  root.userData.team = team;
  root.userData.id = id;
  root.userData.body = fig.body;
  root.userData.cloth = fig.cloth;
  return root;
}

export function makeRemote(scene: THREE.Scene, peerId: number, slotId: number, team: Team, name: string, spawn: THREE.Vector3, skin?: PawnSkin): Remote {
  const look = parseSkin(skin) ?? "rifle";
  const root = standIn(team, name, slotId, look);
  root.position.copy(spawn);
  scene.add(root);
  return {
    peerId,
    slotId,
    homeId: slotId,
    name,
    team,
    x: spawn.x,
    y: spawn.y,
    z: spawn.z,
    vy: 0,
    yaw: team === "ember" ? -Math.PI / 2 : Math.PI / 2,
    pitch: 0,
    hp: 100,
    alive: true,
    weapon: "kar",
    ads: false,
    crouch: false,
    prone: false,
    input: emptyInput(),
    lastFire: -10,
    lastMelee: -10,
    lastThrow: -10,
    jumpHeld: false,
    ping: 0,
    fireQ: emptyQueue(),
    nades: fullNades(),
    root,
    skin: look,
  };
}

export function emptyInput(): PlayerInput {
  return {
    keys: [],
    yaw: 0,
    pitch: 0,
    fire: false,
    ads: false,
    lean: 0,
    weapon: "kar",
    crouch: false,
    prone: false,
    jump: false,
    use: false,
    mx: 0,
    my: 0,
    ping: 0,
  };
}

export function seatPeer(
  scene: THREE.Scene,
  world: World,
  match: Match,
  bots: Bot[],
  remotes: Map<number, Remote>,
  peerId: number,
  name: string,
  teamHint?: Team,
  skin?: PawnSkin,
) {
  if (remotes.has(peerId)) return remotes.get(peerId)!;
  const emberH = match.slots.filter((s) => s.kind === "human" && s.team === "ember").length;
  const stoneH = match.slots.filter((s) => s.kind === "human" && s.team === "stone").length;
  const team: Team = teamHint ?? (emberH <= stoneH ? "ember" : "stone");
  let slot = claimSlot(match, team, name);
  if (!slot) {
    const extra = addBotSlot(match, team);
    extra.kind = "human";
    extra.name = name;
    extra.occupant = undefined;
    slot = extra;
  }
  despawnBot(scene, bots, slot.id);
  const planter = plantingTeam(match);
  const list = slot.team === planter ? world.plantSpawns : world.watchSpawns;
  const spawn = list[slot.id % list.length]!.clone();
  const r = makeRemote(scene, peerId, slot.id, slot.team, name, spawn, skin);
  remotes.set(peerId, r);
  match.lastJoin = `${name} joined ${team === "ember" ? "Ember" : "Stone"}`;
  return r;
}

export function reseatPeer(
  scene: THREE.Scene,
  world: World,
  match: Match,
  bots: Bot[],
  remotes: Map<number, Remote>,
  peerId: number,
  name: string,
  team: Team,
  skin?: PawnSkin,
) {
  const cur = remotes.get(peerId);
  if (cur?.team === team) {
    if (skin) dressRemote(cur, skin);
    return cur;
  }
  const oldId = cur?.homeId ?? cur?.slotId;
  if (cur) dropPeer(scene, world, match, bots, remotes, peerId);
  const seated = seatPeer(scene, world, match, bots, remotes, peerId, name, team, skin ?? cur?.skin);
  if (oldId != null && oldId !== seated.slotId) swapLines(oldId, seated.slotId);
  return seated;
}

export function dressRemote(r: Remote, skin: PawnSkin) {
  const look = parseSkin(skin) ?? r.skin;
  if (look === r.skin && r.root.userData.skin === look) return;
  r.skin = look;
  const fig = buildPawn(r.root, r.team, r.slotId, look);
  r.root.userData.body = fig.body;
  r.root.userData.cloth = fig.cloth;
}

/** Credit the body that did the work. Takeover kills stay on the bot. */
export function creditId(_remotes: Map<number, Remote> | Iterable<Remote>, slotId: number) {
  return slotId;
}

export function restoreHomeSeat(match: Match, r: Remote) {
  if (r.slotId === r.homeId) return;
  const taken = slotById(match, r.slotId);
  if (taken) {
    taken.kind = "bot";
    taken.occupant = undefined;
    taken.alive = true;
  }
  const home = slotById(match, r.homeId);
  if (home) {
    home.kind = "human";
    home.name = r.name;
    home.occupant = undefined;
    home.alive = true;
  }
  r.slotId = r.homeId;
}

export function restoreHomeSeats(match: Match, remotes: Map<number, Remote>) {
  for (const r of remotes.values()) restoreHomeSeat(match, r);
}

export function dropPeer(
  scene: THREE.Scene,
  world: World,
  match: Match,
  bots: Bot[],
  remotes: Map<number, Remote>,
  peerId: number,
) {
  const r = remotes.get(peerId);
  if (!r) return;
  const takenId = r.slotId !== r.homeId ? r.slotId : null;
  restoreHomeSeat(match, r);
  scene.remove(r.root);
  remotes.delete(peerId);
  const home = match.slots.find((s) => s.id === r.homeId);
  if (home) {
    vacateSlot(match, home);
    bots.push(spawnBot(scene, world, match, home));
  }
  if (takenId != null) {
    const taken = match.slots.find((s) => s.id === takenId);
    if (taken && !bots.some((b) => b.id === takenId)) bots.push(spawnBot(scene, world, match, taken));
  }
}

export function takeoverPeer(
  scene: THREE.Scene,
  match: Match,
  bots: Bot[],
  remotes: Map<number, Remote>,
  peerId: number,
  slotId: number,
) {
  const r = remotes.get(peerId);
  if (!r || r.alive) return false;
  const bot = bots.find((b) => b.id === slotId);
  if (!bot || bot.hp <= 0 || bot.team !== r.team) return false;
  const newSlot = match.slots.find((s) => s.id === bot.id);
  if (!newSlot) return false;
  despawnBot(scene, bots, bot.id);
  if (r.slotId !== r.homeId && r.slotId !== bot.id) {
    const prev = slotById(match, r.slotId);
    if (prev) {
      prev.kind = "bot";
      prev.occupant = undefined;
    }
  }
  const home = slotById(match, r.homeId);
  if (home) {
    home.kind = "human";
    home.name = r.name;
    home.occupant = undefined;
    home.alive = true;
  }
  newSlot.kind = "bot";
  newSlot.alive = true;
  newSlot.occupant = r.name;
  r.slotId = bot.id;
  r.x = bot.x;
  r.y = bot.y;
  r.z = bot.z;
  r.vy = 0;
  r.hp = Math.max(1, bot.hp);
  r.alive = true;
  r.yaw = bot.yaw;
  r.pitch = bot.lookPitch;
  r.nades = { ...bot.nades };
  r.root.position.set(bot.x, bot.y, bot.z);
  r.root.rotation.set(0, bot.yaw, 0);
  r.root.visible = true;
  match.lastJoin = `${r.name} took over ${bot.id}`;
  return true;
}

export function tickRemote(r: Remote, dt: number, time: number, world: World, froze: boolean) {
  const inp = r.input;
  r.yaw = inp.yaw;
  r.pitch = inp.pitch;
  r.ads = inp.ads;
  r.crouch = inp.crouch && !inp.prone;
  r.prone = !!inp.prone;
  r.weapon = inp.weapon;
  r.ping = inp.ping ?? r.ping;
  const stance = !r.alive ? "down" : r.prone ? "prone" : r.crouch ? "crouch" : "stand";
  if (!r.alive || froze) {
    r.root.position.set(r.x, r.y, r.z);
    r.root.rotation.y = r.yaw;
    stepWalkFromPos(r.root, r.x, r.z, false);
    poseStance(r.root, stance);
    return;
  }
  const height = r.prone ? 0.55 : r.crouch ? 1.2 : 1.78;
  const knife = r.weapon === "knife" && !r.ads ? 1.25 : 1;
  const speed = tuning.walk * (r.prone ? 0.36 : r.crouch ? 0.55 : 1) * (r.ads ? tuning.adsSlow : 1) * knife;
  const keys = new Set(inp.keys);
  const fx = -Math.sin(r.yaw);
  const fz = -Math.cos(r.yaw);
  const rx = Math.cos(r.yaw);
  const rz = -Math.sin(r.yaw);
  let wx = 0;
  let wz = 0;
  if (keys.has("KeyW")) {
    wx += fx;
    wz += fz;
  }
  if (keys.has("KeyS")) {
    wx -= fx;
    wz -= fz;
  }
  if (keys.has("KeyD")) {
    wx += rx;
    wz += rz;
  }
  if (keys.has("KeyA")) {
    wx -= rx;
    wz -= rz;
  }
  const len = Math.hypot(wx, wz);
  const gh = groundHeight(world.colliders, r.x, r.z, RADIUS, r.y);
  const grounded = r.y <= gh + 0.06 && r.vy <= 0.2;
  if (len > 0) {
    const n = collideXZ(world.colliders, r.x + (wx / len) * speed * dt, r.z + (wz / len) * speed * dt, RADIUS, r.y + 0.08, r.y + height);
    r.x = n.x;
    r.z = n.z;
  }
  if (grounded && inp.jump && !r.jumpHeld) r.vy = Math.sqrt(2 * tuning.jumpH * tuning.gravity);
  r.jumpHeld = !!inp.jump;
  if (grounded && r.vy <= 0) {
    r.y = gh;
    r.vy = 0;
  } else {
    r.vy += -tuning.gravity * dt;
    r.y += r.vy * dt;
    const g2 = groundHeight(world.colliders, r.x, r.z, RADIUS, r.y);
    if (r.y < g2) {
      r.y = g2;
      r.vy = 0;
    }
  }
  r.root.position.set(r.x, r.y, r.z);
  r.root.rotation.y = r.yaw;
  stepWalkFromPos(r.root, r.x, r.z, grounded && len > 0);
  poseStance(r.root, stance);
}

export function fillAbsentSlots(match: Match, pawns: Pawn[], remotes?: Map<number, Remote>) {
  const have = new Set(pawns.map((p) => p.id));
  const body = remotes
    ? [...remotes.values()].reduce((m, r) => {
        if (r.slotId !== r.homeId) m.set(r.slotId, r);
        return m;
      }, new Map<number, Remote>())
    : new Map<number, Remote>();
  for (const s of match.slots) {
    if (have.has(s.id)) continue;
    const occ = body.get(s.id);
    pawns.push({
      id: s.id,
      netId: 0,
      name: s.name,
      occupant: s.occupant ?? occ?.name,
      team: s.team,
      x: occ?.x ?? 0,
      y: occ?.y ?? 0,
      z: occ?.z ?? 0,
      yaw: occ?.yaw ?? 0,
      pitch: occ?.pitch ?? 0,
      hp: occ ? occ.hp : 0,
      alive: occ ? occ.alive : false,
      weapon: occ?.weapon ?? "kar",
      ads: occ?.ads ?? false,
      crouch: occ?.crouch ?? false,
      prone: occ?.prone ?? false,
      absent: true,
      nades: occ ? { ...occ.nades } : { smoke: 0, frag: 0, stun: 0, flash: 0 },
      kills: line(s.id).kills,
      assists: line(s.id).assists,
      deaths: line(s.id).deaths,
      skin: occ?.skin,
    });
  }
}

export function buildSnapshot(
  match: Match,
  local: Pawn,
  bots: Bot[],
  remotes: Map<number, Remote>,
  mapId?: string,
  now = 0,
): Snapshot {
  const pawns: Pawn[] = [
    local,
    ...[...remotes.values()].map(
      (r): Pawn => ({
        id: r.homeId,
        netId: r.peerId,
        name: r.name,
        occupant: undefined,
        team: r.team,
        x: r.x,
        y: r.y,
        z: r.z,
        yaw: r.yaw,
        pitch: r.pitch,
        hp: r.hp,
        alive: r.alive,
        weapon: r.weapon,
        ads: r.ads,
        crouch: r.crouch,
        prone: r.prone,
        nades: { ...r.nades },
        kills: line(r.homeId).kills,
        assists: line(r.homeId).assists,
        deaths: line(r.homeId).deaths,
        ping: r.ping,
        skin: r.skin,
      }),
    ),
    ...bots.map(
      (b): Pawn => ({
        id: b.id,
        netId: 0,
        name: match.slots.find((s) => s.id === b.id)?.name ?? "bot",
        occupant: match.slots.find((s) => s.id === b.id)?.occupant,
        team: b.team,
        x: b.x,
        y: b.y,
        z: b.z,
        yaw: b.yaw,
        pitch: b.lookPitch,
        hp: b.hp,
        alive: b.hp > 0,
        weapon: "kar",
        ads: b.aim && b.stunUntil <= now,
        crouch: false,
        prone: false,
        stun: b.stunUntil > now,
        nades: { ...b.nades },
        kills: line(b.id).kills,
        assists: line(b.id).assists,
        deaths: line(b.id).deaths,
        ping: undefined,
      }),
    ),
  ];
  fillAbsentSlots(match, pawns, remotes);
  return {
    phase: match.phase,
    round: match.round,
    emberScore: match.emberScore,
    stoneScore: match.stoneScore,
    swapped: match.swapped,
    clock: match.phase === "planted" ? match.bombTime : match.timeLeft,
    time: 0,
    wireTime: match.bombTime,
    wire: {
      mode: match.wire.mode,
      carrierId: match.wire.carrierId,
      site: match.wire.site === "loft" ? "ice" : match.wire.site === "well" ? "slip" : null,
      x: match.wire.x,
      y: match.wire.y,
      z: match.wire.z,
      plantHold: match.wire.plantHold,
      cutHold: match.wire.cutHold,
    },
    pawns,
    feed: [],
    events: [],
    clouds: activeClouds(),
    nades: activeNades(),
    pops: drainPops(),
    headPops: [],
    endText: match.endText,
    lastWinner: match.lastWinner,
    mapId,
  };
}

export function applyMatchSnap(match: Match, snap: Snapshot) {
  match.phase = snap.phase;
  match.round = snap.round;
  match.emberScore = snap.emberScore;
  match.stoneScore = snap.stoneScore;
  match.swapped = snap.swapped;
  match.timeLeft = snap.clock;
  match.bombTime = snap.wireTime;
  match.wire.mode = snap.wire.mode;
  match.wire.carrierId = snap.wire.carrierId;
  match.wire.site = snap.wire.site === "ice" ? "loft" : snap.wire.site === "slip" ? "well" : null;
  match.wire.x = snap.wire.x;
  match.wire.y = snap.wire.y;
  match.wire.z = snap.wire.z;
  match.wire.plantHold = snap.wire.plantHold;
  match.wire.cutHold = snap.wire.cutHold;
  if (snap.endText != null) match.endText = snap.endText;
  if (snap.lastWinner !== undefined) match.lastWinner = snap.lastWinner;
  if (snap.endT != null) match.endT = snap.endT;
  if (snap.pawns.length) {
    match.slots = snap.pawns.map((p) => ({
      id: p.id,
      team: p.team,
      kind: (p.netId ?? 0) > 0 ? "human" : "bot",
      name: p.name,
      occupant: p.occupant,
      alive: p.alive,
    }));
  }
}

export function collectInput(opts: {
  keys: Set<string>;
  yaw: number;
  pitch: number;
  fire: boolean;
  ads: boolean;
  lean: number;
  weapon: Weapon;
  crouch: boolean;
  prone?: boolean;
  jump: boolean;
  use: boolean;
  ping?: number;
}): PlayerInput {
  return {
    keys: [...opts.keys],
    yaw: opts.yaw,
    pitch: opts.pitch,
    fire: opts.fire,
    ads: opts.ads,
    lean: opts.lean,
    weapon: opts.weapon,
    crouch: opts.crouch,
    prone: opts.prone ?? false,
    jump: opts.jump,
    use: opts.use,
    mx: 0,
    my: 0,
    ping: opts.ping ?? 0,
  };
}

const HARD_SNAP_XZ = 1.6;
const HARD_SNAP_Y = 0.85;
const SNAP_BLEND = 0.22;

export function snapWalkSpeed(px: number, pz: number, x: number, z: number, interval: number) {
  if (!(interval > 0) || interval > 0.4) return 0;
  const d = Math.hypot(x - px, z - pz);
  if (d < 0.03 || d > 1.2) return 0;
  return Math.min(8, d / interval);
}

export function reconcilePos(
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
): { x: number; y: number; z: number } {
  const err = Math.hypot(sx - x, sz - z);
  if (err > HARD_SNAP_XZ || Math.abs(sy - y) > HARD_SNAP_Y) return { x: sx, y: sy, z: sz };
  return {
    x: x + (sx - x) * SNAP_BLEND,
    y: y + (sy - y) * SNAP_BLEND,
    z: z + (sz - z) * SNAP_BLEND,
  };
}

function lerpAngle(a: number, b: number, u: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * u;
}

export function syncClientPawns(
  scene: THREE.Scene,
  pawns: Pawn[],
  selfNetId: number,
  store: Map<number, THREE.Group>,
  dt: number,
  opts?: { forceSnap?: boolean },
) {
  const seen = new Set<number>();
  const a = 1 - Math.exp(-16 * dt);
  const force = !!opts?.forceSnap;
  for (const p of pawns) {
    if ((p.netId ?? 0) === selfNetId) continue;
    seen.add(p.id);
    const dummy = !!p.absent || (!p.alive && p.hp <= 0 && p.x === 0 && p.z === 0 && p.yaw === 0);
    if (dummy) {
      const hidden = store.get(p.id);
      if (hidden) hidden.visible = false;
      continue;
    }
    let g = store.get(p.id);
    const look = parseSkin(p.skin) ?? parseSkin(g?.userData.skin);
    if (!g) {
      g = standIn(p.team, p.name, p.id, look);
      g.position.set(p.x, p.y, p.z);
      g.rotation.y = p.yaw;
      g.userData.tx = p.x;
      g.userData.tz = p.z;
      g.userData.walkX = p.x;
      g.userData.walkZ = p.z;
      g.userData.walkSpeed = 0;
      scene.add(g);
      store.set(p.id, g);
    } else if (g.userData.team !== p.team || (look && g.userData.skin !== look)) {
      const fig = buildPawn(g, p.team, p.id, look);
      g.userData.body = fig.body;
      g.userData.cloth = fig.cloth;
      g.userData.team = p.team;
      g.userData.name = p.name;
    }
    g.visible = !p.cow;
    const err = Math.hypot(p.x - g.position.x, p.z - g.position.z);
    if (force || err > HARD_SNAP_XZ || Math.abs(p.y - g.position.y) > HARD_SNAP_Y) {
      g.position.set(p.x, p.y, p.z);
      g.rotation.y = p.yaw;
      g.userData.walkX = p.x;
      g.userData.walkZ = p.z;
      g.userData.tx = p.x;
      g.userData.tz = p.z;
    } else {
      g.position.x += (p.x - g.position.x) * a;
      g.position.y += (p.y - g.position.y) * a;
      g.position.z += (p.z - g.position.z) * a;
      g.rotation.y = lerpAngle(g.rotation.y, p.yaw, a);
    }
    const stance = !p.alive ? "down" : p.prone ? "prone" : p.crouch ? "crouch" : "stand";
    const tx = typeof g.userData.tx === "number" ? g.userData.tx : p.x;
    const tz = typeof g.userData.tz === "number" ? g.userData.tz : p.z;
    if (Math.abs(p.x - tx) > 1e-4 || Math.abs(p.z - tz) > 1e-4) {
      g.userData.walkSpeed = snapWalkSpeed(tx, tz, p.x, p.z, 1 / 30);
      g.userData.tx = p.x;
      g.userData.tz = p.z;
    }
    const speed = Number(g.userData.walkSpeed) || 0;
    stepWalk(g, speed * dt, p.alive && speed > 0.4 && stance === "stand");
    poseStance(g, stance);
  }
  for (const [id, g] of store) {
    if (seen.has(id)) continue;
    scene.remove(g);
    store.delete(id);
  }
}

export function statusLine(net: NetHandle) {
  if (net.status === "connecting") return "Connecting to the match";
  if (net.role === "client") return "Joined · dedicated match";
  return "Lobby · pick a server";
}
