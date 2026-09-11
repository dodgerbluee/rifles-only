/**
 * Dedicated Last Wire simulation. No renderer, no DOM. Every human is a remote.
 */
import * as THREE from "three";
import {
  addBotSlot,
  combatBodies,
  concludeBestPlay,
  countLiving,
  createMatch,
  dropWire,
  giveWireToPlanter,
  humanCount,
  interruptPlant,
  isPlanting,
  livingSeatIds,
  markDead,
  markSeatsFromBodies,
  pickupWire,
  plantWire,
  plantingTeam,
  removeBotSlot,
  restartMatch,
  roundCombatOpen,
  roundFrozen,
  slotById,
  slotTag,
  tickMatch,
  trySkipBestPlay,
  type SiteId,
  type Team,
} from "./match";
import { COW_SECS, type ClientEvent, type KillFeedItem, type KillWay, type Pawn, type PlayerInput, type Snapshot } from "./net";
import { inSite, rayShot, spawnYaw, hasLos } from "./world";
import { buildMap, MAPS, compileLayout, type MapId } from "./maps";
import { asLayoutSpec, type LayoutSpec } from "./maps/layout";
import { playableSpec } from "./maps/studio";
import {
  botTargets,
  createBots,
  despawnBot,
  hurtBot,
  resetBots,
  restorePawnHead,
  spawnBot,
  updateBots,
  type Bot,
  type BotSkill,
} from "./bots";
import { pickBodyVictim, meleeTarget, remoteTargets, type LiveBody } from "./combat";
import { parseLook, parseSkin, type PawnSkin } from "./pawn";
import {
  dropPeer,
  reseatPeer,
  seatPeer,
  takeoverPeer,
  tickRemote,
  fillAbsentSlots,
  creditId,
  restoreHomeSeats,
  type Remote,
} from "./peers";
import {
  activeClouds,
  activeNades,
  clearNades,
  drainPops,
  dropSmoke,
  fullNades,
  smokeBlocksLos,
  spendNade,
  stunDuration,
  STUN_R,
  throwSmoke,
  updateSmoke,
  type NadeKind,
} from "./smoke";
import { line, noteHit, noteKill, resetStats } from "./stats";
import { meleeReach, tuning } from "./tuning";
import { RIFLES, rifleFromWeapon, type RifleId } from "./weapons";
import { PRIMARY_IDS } from "./loadout";

const FRAG_R = 6.5;
const HP = 100;

export type SimStatus = {
  id: string;
  name: string;
  map: string;
  mapTitle: string;
  phase: string;
  players: number;
  max: number;
  online: true;
};

export type Sim = {
  tick: (dt: number) => void;
  join: (peerId: number, name: string, team?: Team, skin?: PawnSkin, look?: string) => void;
  leave: (peerId: number) => void;
  setInput: (peerId: number, input: PlayerInput) => void;
  event: (peerId: number, event: ClientEvent) => void;
  snapshot: () => Snapshot;
  status: () => SimStatus;
  mapState: () => { mapId: string; spec?: LayoutSpec };
  /** Scripted tests: sit the Wire without walking to a pad. */
  armWire: (site?: SiteId) => boolean;
  /** Scripted tests: drop a body through the same hurt/frag path as a fight. */
  slay: (id: number) => boolean;
};

export function createSim(opts?: {
  mapId?: MapId;
  name?: string;
  id?: string;
  perTeam?: number;
  rotation?: MapId[];
  firstTo?: number;
  swapAfter?: number;
  freezeTime?: number;
  championsHold?: number;
  botSkill?: BotSkill;
  highlights?: boolean;
  friendlyFire?: boolean;
  oneShot?: boolean;
}): Sim {
  const id = opts?.id ?? "default";
  const name = opts?.name ?? "Last Wire";
  const scene = new THREE.Scene();
  const rotation = (opts?.rotation?.filter((m) => MAPS.some((x) => x.id === m)) ?? MAPS.map((m) => m.id)) as MapId[];
  let mapId: string = opts?.mapId && MAPS.some((m) => m.id === opts.mapId) ? opts.mapId : (rotation[0] ?? "wharf");
  let rotAt = Math.max(0, rotation.indexOf(mapId as MapId));
  let customSpec: LayoutSpec | null = null;
  let world = buildMap(scene, mapId as MapId);
  const match = createMatch({
    claimLocal: false,
    perTeam: opts?.perTeam,
    firstTo: opts?.firstTo,
    swapAfter: opts?.swapAfter,
    freezeTime: opts?.freezeTime,
    championsHold: opts?.championsHold,
    mapTitle: world.title ?? MAPS.find((m) => m.id === mapId)?.title,
  });
  const bots: Bot[] = createBots(scene, world, match);
  const remotes = new Map<number, Remote>();
  const raycaster = new THREE.Raycaster();
  let time = 0;
  let seenRound = match.round;
  let friendlyFire = !!opts?.friendlyFire;
  let oneShot = !!opts?.oneShot;
  let skipRecap = opts?.highlights === false;
  let botSkill: BotSkill = opts?.botSkill ?? "normal";
  let vacant = humanCount(match) === 0;
  const roundKills: KillFeedItem[] = [];
  const pendingHeads: number[] = [];
  const cows: { id: number; until: number }[] = [];

  function nextMapId() {
    if (!rotation.length) return mapId;
    return rotation[(rotAt + 1) % rotation.length]!;
  }

  function spawnList(team: Team) {
    const planter = plantingTeam(match);
    return team === planter ? world.plantSpawns : world.watchSpawns;
  }

  function roundSpawnHumans() {
    for (const r of remotes.values()) {
      const list = spawnList(r.team);
      const spawnAt = list[r.slotId % list.length]!;
      r.x = spawnAt.x;
      r.y = spawnAt.y;
      r.z = spawnAt.z;
      r.vy = 0;
      r.hp = HP;
      r.alive = true;
      r.root.position.copy(spawnAt);
      r.root.rotation.set(0, spawnYaw(spawnAt, world), 0);
      r.root.visible = true;
      r.nades = fullNades();
      restorePawnHead(r.root);
    }
  }

  function restartRoom() {
    resetStats();
    roundKills.length = 0;
    pendingHeads.length = 0;
    restartMatch(match, world.plantSpawns[2]!);
    restoreHomeSeats(match, remotes);
    resetBots(bots, world, match);
    roundSpawnHumans();
    seenRound = match.round;
  }

  function loadMap(next: string, spec?: LayoutSpec | null) {
    const parsed = spec ? asLayoutSpec(spec) : null;
    clearNades(scene);
    for (const b of [...bots]) despawnBot(scene, bots, b.id);
    const keep = new Set<THREE.Object3D>([...remotes.values()].map((r) => r.root));
    for (const c of [...scene.children]) {
      if (!keep.has(c)) scene.remove(c);
    }
    if (parsed) {
      const play = playableSpec(parsed);
      customSpec = play;
      mapId = play.id || next;
      world = compileLayout(scene, play);
    } else {
      if (!MAPS.some((m) => m.id === next)) return;
      customSpec = null;
      mapId = next;
      rotAt = Math.max(0, rotation.indexOf(next as MapId));
      world = buildMap(scene, next as MapId);
    }
    match.mapTitle = world.title ?? MAPS.find((m) => m.id === mapId)?.title ?? mapId;
    for (const r of remotes.values()) {
      if (!r.root.parent) scene.add(r.root);
    }
    bots.push(...createBots(scene, world, match));
    restartRoom();
  }

  function liveBodies(): LiveBody[] {
    return [
      ...bots.map((b) => ({
        id: b.id,
        team: b.team,
        x: b.x,
        y: b.y,
        z: b.z,
        alive: b.hp > 0,
      })),
      ...[...remotes.values()].map((r) => ({
        id: r.slotId,
        team: r.team,
        x: r.x,
        y: r.y,
        z: r.z,
        alive: r.alive,
      })),
    ];
  }

  function crouchIds() {
    return [...remotes.values()].filter((r) => r.crouch).map((r) => r.slotId);
  }

  function gunDmg(head: boolean) {
    return oneShot ? 200 : head ? 100 : 50;
  }

  function credit(id: number) {
    return creditId(remotes, id);
  }

  function actorName(id: number, fallback = "Rifle") {
    const slot = slotById(match, id);
    const remote = [...remotes.values()].find((x) => x.slotId === id || x.homeId === id);
    return slotTag(slot, slot?.occupant ?? (remote && remote.slotId === id ? remote.name : undefined)) || fallback;
  }

  function frag(
    killerId: number,
    victimId: number,
    victimName: string,
    x: number,
    y: number,
    z: number,
    way: KillWay = "noscope",
    head = false,
  ) {
    const killer = credit(killerId);
    const victim = credit(victimId);
    if (killerId >= 0) noteKill(killer, victim, time);
    else line(victim).deaths += 1;
    markDead(match, victimId, x, y, z);
    if (victim !== victimId) markDead(match, victim, x, y, z);
    const remote = [...remotes.values()].find((x) => x.slotId === victimId || x.homeId === victimId);
    if (remote) {
      markDead(match, remote.homeId, x, y, z);
      markDead(match, remote.slotId, x, y, z);
    }
    const bomb = way === "bomb";
    const cowed = way === "cow";
    roundKills.push({
      t: time,
      killerId: killer,
      killerName: bomb ? "Bomb" : cowed ? "Cow" : actorName(killerId),
      killerTeam: bomb || cowed ? undefined : slotById(match, killerId)?.team ?? slotById(match, killer)?.team,
      victimId: victim,
      victimName: actorName(victimId, victimName),
      victimTeam: slotById(match, victimId)?.team ?? slotById(match, victim)?.team,
      way,
      head,
      rifle: way === "aimed" || way === "noscope" ? rifleOf(killerId) : undefined,
    });
  }

  function shotWay(shooterId: number): KillWay {
    const r = [...remotes.values()].find((x) => x.slotId === shooterId);
    if (r) {
      if (r.weapon === "knife") return "knife";
      return r.ads ? "aimed" : "noscope";
    }
    const bot = bots.find((b) => b.id === shooterId);
    if (bot?.aim) return "aimed";
    return "noscope";
  }

  function rifleOf(id: number): RifleId | undefined {
    const r = [...remotes.values()].find((x) => x.slotId === id || x.homeId === id);
    if (r) {
      if (r.weapon === "mosin") return "mosin";
      if (r.weapon === "karscope") return "karscope";
      if (r.weapon === "kar" || r.weapon === "rifle") return "kar";
      return undefined;
    }
    const bot = bots.find((b) => b.id === id);
    if (bot) return PRIMARY_IDS[Math.abs(bot.id) % PRIMARY_IDS.length];
    return undefined;
  }

  function hurtRemote(r: Remote, dmg: number, killerId: number, way?: KillWay, head = false) {
    if (!r.alive) return false;
    const amount = oneShot ? Math.max(dmg, 200) : dmg;
    if (killerId >= 0) noteHit(credit(killerId), credit(r.slotId), time);
    r.hp = Math.max(0, r.hp - amount);
    if (r.hp <= 0) {
      r.alive = false;
      r.root.rotation.x = 1.25;
      frag(killerId, r.slotId, r.name, r.x, r.y, r.z, way ?? shotWay(killerId), head);
      return true;
    }
    return false;
  }

  function shotPeople(origin: THREE.Vector3, dir: THREE.Vector3, worldHit: ReturnType<typeof rayShot>, shooterId: number) {
    const youTeam = slotById(match, shooterId)?.team;
    const skip = friendlyFire ? undefined : youTeam;
    const skipIds = [shooterId, credit(shooterId)];
    for (const b of bots) b.root.updateMatrixWorld(true);
    for (const r of remotes.values()) r.root.updateMatrixWorld(true);
    raycaster.set(origin, dir);
    const meshHit = raycaster.intersectObjects(
      [...botTargets(bots, skip, skipIds), ...remoteTargets(remotes.values(), skip, skipIds)],
      false,
    )[0];
    let meshDist = meshHit ? meshHit.distance : Infinity;
    if (worldHit && worldHit.dist < meshDist - 0.02) meshDist = Infinity;

    if (meshHit && meshDist < Infinity) {
      const hid = meshHit.object.userData.botId as number;
      const head = meshHit.object.userData.part === "head";
      const dmg = gunDmg(head);
      const bot = bots.find((b) => b.id === hid);
      if (bot && bot.hp > 0 && (friendlyFire || bot.team !== youTeam)) {
        noteHit(credit(shooterId), bot.id, time);
        const killed = hurtBot(bot, dmg, time);
        if (head && killed) pendingHeads.push(bot.id);
        if (killed) frag(shooterId, bot.id, slotById(match, bot.id)?.name ?? "Rifle", bot.x, bot.y, bot.z, shotWay(shooterId), head);
        return true;
      }
      const remote = [...remotes.values()].find((x) => x.slotId === hid || x.homeId === hid);
      if (remote && remote.alive && (friendlyFire || remote.team !== youTeam)) {
        const killed = hurtRemote(remote, dmg, shooterId, shotWay(shooterId), head);
        if (head && killed) pendingHeads.push(remote.homeId);
        return true;
      }
    }

    const worldDist = worldHit?.dist ?? Infinity;
    const bodyHit = pickBodyVictim(origin, dir, liveBodies(), worldDist, youTeam, friendlyFire, skipIds, crouchIds());
    if (!bodyHit) return false;
    const bot = bots.find((b) => b.id === bodyHit.body.id);
    if (bot && bot.hp > 0) {
      noteHit(credit(shooterId), bot.id, time);
      if (hurtBot(bot, gunDmg(false), time)) frag(shooterId, bot.id, slotById(match, bot.id)?.name ?? "Rifle", bot.x, bot.y, bot.z, shotWay(shooterId));
      return true;
    }
    const remote = [...remotes.values()].find((x) => x.slotId === bodyHit.body.id);
    if (!remote || !remote.alive) return false;
    hurtRemote(remote, gunDmg(false), shooterId);
    return true;
  }

  function botShoot(from: THREE.Vector3, dir: THREE.Vector3, _target: { id: number; team: string }, shooterId: number) {
    if (isCowed(shooterId)) return;
    interruptPlant(match, shooterId);
    const worldHit = rayShot(from, dir, 80, world.colliders);
    shotPeople(from, dir, worldHit, shooterId);
  }

  function remoteMeleeAt(r: Remote, origin: THREE.Vector3, dir: THREE.Vector3): boolean {
    if (time - r.lastMelee < 0.48) return false;
    r.lastMelee = time;
    const reach = meleeReach();
    const youTeam = slotById(match, r.slotId)?.team;
    const body = meleeTarget(origin, dir, liveBodies(), reach, youTeam, friendlyFire, [r.slotId, r.homeId]);
    if (!body) return false;
    const bot = bots.find((b) => b.id === body.id);
    if (bot && bot.hp > 0) {
      noteHit(credit(r.slotId), bot.id, time);
      if (hurtBot(bot, 100, time)) frag(r.slotId, bot.id, slotById(match, bot.id)?.name ?? "Rifle", bot.x, bot.y, bot.z, "knife");
      return true;
    }
    const remote = [...remotes.values()].find((x) => x.slotId === body.id);
    if (remote && remote.alive) {
      hurtRemote(remote, 100, r.slotId, "knife");
      return true;
    }
    return false;
  }

  function remoteFireAt(r: Remote, origin: THREE.Vector3, dir: THREE.Vector3): boolean {
    const kind: RifleId = rifleFromWeapon(r.weapon);
    if (time - r.lastFire < RIFLES[kind].cycle) return false;
    if (r.weapon === "knife" || r.weapon === "smoke" || r.weapon === "frag" || r.weapon === "stun" || r.weapon === "flash") {
      return false;
    }
    r.lastFire = time;
    interruptPlant(match, r.slotId);
    const worldHit = rayShot(origin, dir, 120, world.colliders);
    shotPeople(origin, dir, worldHit, r.slotId);
    return true;
  }

  function applyNadePop(pop: { kind: NadeKind; x: number; y: number; z: number; throwerId?: number }) {
    if (pop.kind === "stun") {
      for (const b of bots) {
        if (b.hp <= 0) continue;
        const d = Math.hypot(b.x - pop.x, b.y - pop.y, b.z - pop.z);
        if (d > STUN_R) continue;
        if (!hasLos(pop.x, pop.y + 0.3, pop.z, b.x, b.y + 1.45, b.z, world.colliders)) continue;
        const hold = stunDuration(d);
        if (hold <= 0) continue;
        b.stunUntil = Math.max(b.stunUntil, time + hold);
        b.aim = false;
        b.seeT = 0;
      }
      return;
    }
    if (pop.kind !== "frag") return;
    const killer = pop.throwerId ?? -1;
    for (const b of bots) {
      if (b.hp <= 0) continue;
      const d = Math.hypot(b.x - pop.x, b.y - pop.y, b.z - pop.z);
      if (d < FRAG_R) {
        const fall = 1 - d / FRAG_R;
        if (hurtBot(b, Math.round(30 + 90 * fall), time)) {
          if (killer >= 0) frag(killer, b.id, slotById(match, b.id)?.name ?? "Rifle", b.x, b.y, b.z, "nade");
          else markDead(match, b.id, b.x, b.y, b.z);
        }
      }
    }
    for (const r of remotes.values()) {
      if (!r.alive) continue;
      const d = Math.hypot(r.x - pop.x, r.y - pop.y, r.z - pop.z);
      if (d < FRAG_R) {
        const fall = 1 - d / FRAG_R;
        hurtRemote(r, Math.round(20 + 80 * fall), killer >= 0 ? killer : r.slotId, "nade");
      }
    }
  }

  function detonateWire(x: number, y: number, z: number) {
    const plant = plantingTeam(match);
    for (const b of bots) {
      if (b.hp <= 0 || b.team === plant) continue;
      if (Math.hypot(b.x - x, b.y - y, b.z - z) < tuning.blastR && hurtBot(b, 200, time)) {
        frag(-1, b.id, slotById(match, b.id)?.name ?? "Rifle", b.x, b.y, b.z, "bomb");
      }
    }
    for (const r of remotes.values()) {
      if (!r.alive || r.team === plant) continue;
      if (Math.hypot(r.x - x, r.y - y, r.z - z) < tuning.blastR) hurtRemote(r, 200, -1, "bomb");
    }
  }

  function isCowed(id: number) {
    return cows.some((c) => c.id === id && time < c.until);
  }

  function explodeCow(id: number) {
    const bot = bots.find((b) => b.id === id);
    const remote = [...remotes.values()].find((x) => x.slotId === id || x.homeId === id);
    const x = bot?.x ?? remote?.x ?? 0;
    const y = bot?.y ?? remote?.y ?? 0;
    const z = bot?.z ?? remote?.z ?? 0;
    for (const b of bots) {
      if (b.hp <= 0) continue;
      if (Math.hypot(b.x - x, b.y - y, b.z - z) < FRAG_R && hurtBot(b, 400, time)) {
        frag(-1, b.id, slotById(match, b.id)?.name ?? "Rifle", b.x, b.y, b.z, "cow");
      }
    }
    for (const r of remotes.values()) {
      if (!r.alive) continue;
      if (Math.hypot(r.x - x, r.y - y, r.z - z) < FRAG_R) hurtRemote(r, 400, -1, "cow");
    }
    if (bot && bot.hp > 0 && hurtBot(bot, 400, time)) {
      frag(-1, bot.id, slotById(match, bot.id)?.name ?? "Rifle", bot.x, bot.y, bot.z, "cow");
    }
    if (remote && remote.alive) hurtRemote(remote, 400, -1, "cow");
  }

  function syncWireCarry() {
    if (match.wire.mode !== "carried" || match.wire.carrierId == null) return;
    const bot = bots.find((b) => b.id === match.wire.carrierId);
    if (bot) {
      match.wire.x = bot.x;
      match.wire.y = bot.y;
      match.wire.z = bot.z;
      return;
    }
    const r = [...remotes.values()].find((x) => x.slotId === match.wire.carrierId);
    if (r) {
      match.wire.x = r.x;
      match.wire.y = r.y;
      match.wire.z = r.z;
    }
  }

  function reseat(peerId: number, playerName: string, team: Team, skin?: PawnSkin, look?: string) {
    reseatPeer(scene, world, match, bots, remotes, peerId, playerName, team, parseLook(look) ?? skin);
  }

  return {
    tick(dt) {
      dt = Math.min(0.05, dt);
      time += dt;
      const froze = roundFrozen(match.phase);
      const combatLock = !roundCombatOpen(match.phase);

      const fighters = [
        ...bots.map((b) => ({
          id: b.id,
          team: b.team,
          x: b.x,
          y: b.y + 1.5,
          z: b.z,
          alive: b.hp > 0,
        })),
        ...[...remotes.values()].map((r) => ({
          id: r.slotId,
          team: r.team,
          x: r.x,
          y: r.y + 1.5,
          z: r.z,
          alive: r.alive,
        })),
      ];

      const botCutting = updateBots(
        bots,
        dt,
        time,
        world.colliders,
        world,
        match,
        fighters,
        combatLock,
        botShoot,
        smokeBlocksLos,
        [],
        botSkill,
      ).cutting;

      for (const r of remotes.values()) {
        tickRemote(
          r,
          dt,
          time,
          world,
          froze,
          isPlanting(
            match,
            { id: r.slotId, x: r.x, y: r.y, z: r.z, holdingUse: !!r.input.use && !r.input.fire },
            (site, x, z, y) => inSite(world, site, x, z, y),
          ),
        );
        if (bots.some((b) => b.id === r.slotId)) despawnBot(scene, bots, r.slotId);
      }

      markSeatsFromBodies(
        match,
        livingSeatIds({
          bots,
          remotes: remotes.values(),
        }),
      );

      tickMatch(match, dt, {
        living: (team) =>
          countLiving(
            team,
            combatBodies({
              bots,
              remotes: remotes.values(),
            }),
          ),
        inSite: (site, x, z, y) => inSite(world, site, x, z, y),
        holdingUse: false,
        actor: { id: -1, team: "ember", x: 0, y: 0, z: 0, alive: false },
        actors: [...remotes.values()].map((r) => ({
          id: r.slotId,
          team: r.team,
          x: r.x,
          y: r.y,
          z: r.z,
          alive: r.alive,
          holdingUse: r.input.use,
          fired: r.input.fire,
        })),
        spawnPlant: world.plantSpawns[2]!,
        onDetonate: detonateWire,
        botCutting,
        skipRecap,
        onRotate: () => {
          const nxt = nextMapId();
          if (nxt === mapId) restartRoom();
          else loadMap(nxt);
        },
      });

      const empty = humanCount(match) === 0;
      if (empty && !vacant) {
        restoreHomeSeats(match, remotes);
        resetBots(bots, world, match);
        roundSpawnHumans();
        for (const s of match.slots) s.alive = true;
      }
      vacant = empty;

      for (let i = cows.length - 1; i >= 0; i--) {
        if (time < cows[i]!.until) continue;
        explodeCow(cows[i]!.id);
        cows.splice(i, 1);
      }

      if (match.round !== seenRound) {
        seenRound = match.round;
        cows.length = 0;
        roundKills.length = 0;
        pendingHeads.length = 0;
        restoreHomeSeats(match, remotes);
        resetBots(bots, world, match);
        roundSpawnHumans();
        for (const s of match.slots) s.alive = true;
        for (const s of match.slots) {
          if (s.kind !== "bot") continue;
          if (bots.some((b) => b.id === s.id)) continue;
          bots.push(spawnBot(scene, world, match, s));
        }
      }

      updateSmoke(scene, dt, world.colliders, applyNadePop);
      syncWireCarry();
    },

    join(peerId, playerName, team, skin, look) {
      seatPeer(scene, world, match, bots, remotes, peerId, playerName, team, parseLook(look) ?? parseSkin(skin));
    },

    leave(peerId) {
      dropPeer(scene, world, match, bots, remotes, peerId);
    },

    setInput(peerId, input) {
      const r = remotes.get(peerId);
      if (r) r.input = input;
    },

    event(peerId, event) {
      const r = remotes.get(peerId);
      if (event.kind === "joinTeam") {
        reseat(peerId, event.name, event.team, parseSkin(event.skin), event.look);
        return;
      }
      if (event.kind === "throwSmoke") {
        if (!r?.alive || isCowed(r.slotId)) return;
        if (time - r.lastThrow < 0.45) return;
        const kind = event.nade ?? "smoke";
        if (!spendNade(r.nades, kind)) return;
        r.lastThrow = time;
        const origin = new THREE.Vector3(event.ox, event.oy, event.oz);
        if ((event.power ?? 0.55) <= 0) dropSmoke(scene, origin, kind, r.slotId);
        else throwSmoke(scene, origin, new THREE.Vector3(event.dx, event.dy, event.dz), event.power, kind, r.slotId);
        return;
      }
      if (event.kind === "changeMap") {
        loadMap(event.mapId, event.spec);
        return;
      }
      if (event.kind === "restart") {
        restartRoom();
        return;
      }
      if (event.kind === "addBot") {
        const slot = addBotSlot(match, event.team);
        bots.push(spawnBot(scene, world, match, slot));
        return;
      }
      if (event.kind === "removeBot") {
        const slot = removeBotSlot(match, event.team);
        if (slot) despawnBot(scene, bots, slot.id);
        return;
      }
      if (event.kind === "kick") {
        const remote = [...remotes.values()].find((x) => x.slotId === event.slotId || x.homeId === event.slotId);
        if (remote) dropPeer(scene, world, match, bots, remotes, remote.peerId);
        return;
      }
      if (event.kind === "takeover") {
        takeoverPeer(scene, match, bots, remotes, peerId, event.slotId);
        return;
      }
      if (event.kind === "cow") {
        const slot = slotById(match, event.slotId);
        if (slot && !slot.alive) return;
        if (!cows.some((c) => c.id === event.slotId)) cows.push({ id: event.slotId, until: time + COW_SECS });
        return;
      }
      if (event.kind === "rules") {
        if (event.highlights != null) skipRecap = !event.highlights;
        if (event.friendlyFire != null) friendlyFire = event.friendlyFire;
        if (event.oneShot != null) oneShot = event.oneShot;
        if (event.botSkill) botSkill = event.botSkill;
        if (skipRecap && match.phase === "bestplay") concludeBestPlay(match);
        return;
      }
      if (event.kind === "skipRecap") {
        trySkipBestPlay(match);
        return;
      }
      if (event.kind === "shot") {
        if (!r?.alive || isCowed(r.slotId)) return;
        if (!roundCombatOpen(match.phase)) return;
        const dir = new THREE.Vector3(event.dx, event.dy, event.dz);
        if (dir.lengthSq() < 1e-6) return;
        dir.normalize();
        const eye = new THREE.Vector3(r.x, r.y + (r.prone ? 0.42 : r.crouch ? 1.1 : 1.64), r.z);
        const origin = new THREE.Vector3(event.ox, event.oy, event.oz);
        if (!Number.isFinite(origin.x) || origin.distanceTo(eye) > 3) origin.copy(eye);
        remoteFireAt(r, origin, dir);
        return;
      }
      if (event.kind === "melee") {
        if (!r?.alive || isCowed(r.slotId)) return;
        if (!roundCombatOpen(match.phase)) return;
        const dir = new THREE.Vector3(event.dx, event.dy, event.dz);
        if (dir.lengthSq() < 1e-6) return;
        dir.normalize();
        const eye = new THREE.Vector3(r.x, r.y + (r.prone ? 0.42 : r.crouch ? 1.1 : 1.64), r.z);
        const origin = new THREE.Vector3(event.ox, event.oy, event.oz);
        if (!Number.isFinite(origin.x) || origin.distanceTo(eye) > 3) origin.copy(eye);
        remoteMeleeAt(r, origin, dir);
        return;
      }
      if (!r) return;
      if (event.kind === "dropWire" && match.wire.carrierId === r.slotId) dropWire(match, r.x, r.y, r.z);
      if (event.kind === "pickupWire") pickupWire(match, r.slotId, r.team);
      if (event.kind === "plant" && match.wire.carrierId === r.slotId) {
        const site = inSite(world, "loft", r.x, r.z, r.y) ? "loft" : inSite(world, "well", r.x, r.z, r.y) ? "well" : null;
        if (site) plantWire(match, site, r.x, r.y, r.z);
      }
    },

    snapshot() {
      const pawns: Pawn[] = [
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
            cow: isCowed(r.slotId) || isCowed(r.homeId),
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
            weapon: PRIMARY_IDS[Math.abs(b.id) % PRIMARY_IDS.length]!,
            ads: b.aim && b.stunUntil <= time && !isCowed(b.id),
            crouch: false,
            prone: false,
            stun: b.stunUntil > time,
            cow: isCowed(b.id),
            nades: { ...b.nades },
            kills: line(b.id).kills,
            assists: line(b.id).assists,
            deaths: line(b.id).deaths,
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
        clock:
          match.phase === "planted"
            ? match.bombTime
            : match.phase === "matchover" ||
                match.phase === "ending" ||
                match.phase === "settle" ||
                match.phase === "bestplay"
              ? match.endT
              : match.timeLeft,
        time,
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
        feed: roundKills.slice(),
        events: [],
        clouds: activeClouds(),
        nades: activeNades(),
        pops: drainPops(),
        headPops: pendingHeads.splice(0),
        endText: match.endText,
        lastWinner: match.lastWinner,
        mapId,
        nextMap: nextMapId(),
        mapCustom: !!customSpec,
        endT: match.endT,
      };
    },

    status() {
      return {
        id,
        name,
        map: mapId,
        mapTitle: world.title ?? MAPS.find((m) => m.id === mapId)?.title ?? mapId,
        phase: match.phase,
        players: remotes.size,
        max: match.perTeam * 2,
        online: true as const,
      };
    },

    mapState() {
      return { mapId, spec: customSpec ?? undefined };
    },

    armWire(site: SiteId = "loft") {
      if (humanCount(match) === 0) return false;
      if (match.phase === "freeze") {
        match.phase = "live";
        match.timeLeft = tuning.round;
      }
      if (match.phase !== "live" && match.phase !== "planted") return false;
      if (match.wire.mode === "planted" && match.phase === "planted") return true;
      if (match.wire.mode !== "carried") giveWireToPlanter(match);
      const pad = world.sites.find((s) => s.id === site);
      if (!pad) return false;
      plantWire(match, site, pad.x, pad.y, pad.z);
      return match.phase === "planted" && match.wire.mode === "planted";
    },

    slay(id) {
      const bot = bots.find((b) => b.id === id);
      if (bot && bot.hp > 0) {
        if (hurtBot(bot, 400, time)) frag(-1, bot.id, slotById(match, bot.id)?.name ?? "Rifle", bot.x, bot.y, bot.z, "cow");
        return true;
      }
      const remote = [...remotes.values()].find((x) => x.slotId === id || x.homeId === id);
      if (remote && remote.alive) {
        hurtRemote(remote, 400, -1, "cow");
        return true;
      }
      markDead(match, id, 0, 0, 0);
      return false;
    },
  };
}
