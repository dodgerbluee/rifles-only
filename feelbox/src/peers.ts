import * as THREE from "three";
import { collideXZ, groundHeight, type World } from "./world";
import { addBotSlot, claimSlot, plantingTeam, type Match, type Team } from "./match";
import { despawnBot, spawnBot, type Bot } from "./bots";
import type { NetHandle, Pawn, PlayerInput, Snapshot, Weapon } from "./net";
import { activeClouds } from "./smoke";

import { line } from "./stats";
import { tuning } from "./tuning";
import { emptyQueue, type FireQueue } from "./fireQueue";
import { buildPawn, stepWalkFromPos } from "./pawn";

const RADIUS = 0.32;

export type Remote = {
  peerId: number;
  slotId: number;
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
  input: PlayerInput;
  lastFire: number;
  ping: number;
  fireQ: FireQueue;
  root: THREE.Group;
};

function standIn(team: Team, name: string, id?: number) {
  const root = new THREE.Group();
  const fig = buildPawn(root, team, id);
  root.userData.name = name;
  root.userData.team = team;
  root.userData.id = id;
  root.userData.body = fig.body;
  root.userData.cloth = fig.cloth;
  return root;
}

export function makeRemote(scene: THREE.Scene, peerId: number, slotId: number, team: Team, name: string, spawn: THREE.Vector3): Remote {
  const root = standIn(team, name, slotId);
  root.position.copy(spawn);
  scene.add(root);
  return {
    peerId,
    slotId,
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
    input: emptyInput(),
    lastFire: -10,
    ping: 0,
    fireQ: emptyQueue(),
    root,
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
    slot = extra;
  }
  despawnBot(scene, bots, slot.id);
  const planter = plantingTeam(match);
  const list = slot.team === planter ? world.plantSpawns : world.watchSpawns;
  const spawn = list[slot.id % list.length]!.clone();
  const r = makeRemote(scene, peerId, slot.id, slot.team, name, spawn);
  remotes.set(peerId, r);
  match.lastJoin = `${name} joined ${team === "ember" ? "Ember" : "Stone"}`;
  return r;
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
  scene.remove(r.root);
  remotes.delete(peerId);
  const slot = match.slots.find((s) => s.id === r.slotId);
  if (slot) {
    slot.kind = "bot";
    slot.name = r.name;
    bots.push(spawnBot(scene, world, match, slot));
  }
}

export function tickRemote(r: Remote, dt: number, time: number, world: World, froze: boolean) {
  const inp = r.input;
  r.yaw = inp.yaw;
  r.pitch = inp.pitch;
  r.ads = inp.ads;
  r.crouch = inp.crouch;
  r.weapon = inp.weapon;
  r.ping = inp.ping ?? r.ping;
  if (!r.alive || froze) {
    r.root.position.set(r.x, r.y, r.z);
    r.root.rotation.y = r.yaw;
    stepWalkFromPos(r.root, r.x, r.z, false);
    return;
  }
  const height = r.crouch ? 1.2 : 1.78;
  const speed = tuning.walk * (r.crouch ? 0.55 : 1) * (r.ads ? tuning.adsSlow : 1);
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
  if (grounded && inp.jump) r.vy = Math.sqrt(2 * tuning.jumpH * tuning.gravity);
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
  r.root.rotation.x = r.alive ? 0 : 1.25;
  stepWalkFromPos(r.root, r.x, r.z, grounded && len > 0);
}

export function buildSnapshot(
  match: Match,
  local: Pawn,
  bots: Bot[],
  remotes: Map<number, Remote>,
): Snapshot {
  const pawns: Pawn[] = [
    local,
    ...[...remotes.values()].map(
      (r): Pawn => ({
        id: r.slotId,
        netId: r.peerId,
        name: r.name,
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
        kills: line(r.slotId).kills,
        assists: line(r.slotId).assists,
        deaths: line(r.slotId).deaths,
        ping: r.ping,
      }),
    ),
    ...bots.map(
      (b): Pawn => ({
        id: b.id,
        netId: 0,
        name: match.slots.find((s) => s.id === b.id)?.name ?? "bot",
        team: b.team,
        x: b.x,
        y: b.y,
        z: b.z,
        yaw: b.yaw,
        pitch: b.lookPitch,
        hp: b.hp,
        alive: b.hp > 0,
        weapon: "kar",
        ads: b.aim,
        kills: line(b.id).kills,
        assists: line(b.id).assists,
        deaths: line(b.id).deaths,
        ping: undefined,
      }),
    ),
  ];
  return {
    phase: match.phase,
    round: match.round,
    emberScore: match.emberScore,
    stoneScore: match.stoneScore,
    swapped: match.swapped,
    clock: match.phase === "planted" ? match.bombTime : match.timeLeft,
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
  if (snap.pawns.length) {
    match.slots = snap.pawns.map((p) => ({
      id: p.id,
      team: p.team,
      kind: (p.netId ?? 0) > 0 ? "human" : "bot",
      name: p.name,
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
    jump: opts.jump,
    use: opts.use,
    mx: 0,
    my: 0,
    ping: opts.ping ?? 0,
  };
}

export function syncClientPawns(
  scene: THREE.Scene,
  pawns: Pawn[],
  selfNetId: number,
  store: Map<number, THREE.Group>,
) {
  const seen = new Set<number>();
  for (const p of pawns) {
    if ((p.netId ?? 0) === selfNetId) continue;
    seen.add(p.id);
    let g = store.get(p.id);
    if (!g) {
      g = standIn(p.team, p.name, p.id);
      scene.add(g);
      store.set(p.id, g);
    }
    g.visible = true;
    g.position.set(p.x, p.y, p.z);
    g.rotation.y = p.yaw;
    g.rotation.x = p.alive ? 0 : 1.25;
    stepWalkFromPos(g, p.x, p.z, p.alive);
  }
  for (const [id, g] of store) {
    if (seen.has(id)) continue;
    scene.remove(g);
    store.delete(id);
  }
}

export function statusLine(net: NetHandle) {
  if (net.role === "host") return "Host · others join this IP";
  if (net.role === "client") return "Joined · live with the host";
  return "";
}
