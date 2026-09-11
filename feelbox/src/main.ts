/**
 * Rifles Only — Last Wire on Wharf. 5v5, bots fill seats, a join takes a bot's slot.
 */
import "./style.css";
import * as THREE from "three";
import { collideXZ, groundHeight, inSite, rayShot, rayWorld, spawnYaw } from "./world";
import { buildMap, MAPS, LAYOUT_SPECS, compileLayout, specForMap, type MapId } from "./maps";
import { asLayoutSpec, buildingFloors, buildingInterior, type LayoutSpec } from "./maps/layout";
import { botTargets, createBots, despawnBot, HEAD_POP_RATE, hurtBot, popHead, popPawnHead, refillBotPawn, resetBots, restoreHead, restorePawnHead, spawnBot, updateBots, updateGore, type Bot } from "./bots";
import {
  hideDeath,
  hidePodium,
  holdScoreboard,
  paintNetMeter,
  placeName,
  renderScoreboard,
  setCook,
  setRoundResult,
  setSpec,
  showDeath,
  showPodium,
  showSpawn,
  syncKillFeed,
  tickBanners,
  updateHud,
  updateMatchHud,
} from "./hud";
import {
  activeClouds,
  activeNades,
  applyCloudSnap,
  applyNadeSnap,
  billowClouds,
  dropSmoke,
  fullNades,
  nadeColor,
  NADE_MAX,
  NADE_ORDER,
  smokeBlocksLos,
  smokeCoverage,
  stunDuration,
  STUN_R,
  throwSmoke,
  updateSmoke,
  type NadeKind,
  type NadePop,
} from "./smoke";
import {
  claimSlot,
  concludeBestPlay,
  combatBodies,
  countLiving,
  createMatch,
  displayName,
  interruptPlant,
  isPlanting,
  livingSeatIds,
  markSeatsFromBodies,
  dropWire,
  restartMatch,
  humanCount,
  humanSlot,
  markDead,
  plantingTeam,
  roundCombatOpen,
  roundFrozen,
  slotById,
  tickMatch,
  trySkipBestPlay,
  vacateSlot,
  waitingForPlayers,
  watchingTeam,
  type Slot,
  type Team,
} from "./match";
import { bindAdmin, rules } from "./admin";
import {
  BUILD_IDS,
  KIT_IDS,
  addOpening,
  aimGround,
  applyOrbit,
  blankSpec,
  bumpBuildingStoreys,
  canvasNdc,
  cellKey,
  callName,
  defaultOrbit,
  cloneSpec,
  deleteItems,
  downloadSpec,
  eraseNear,
  ghostSize,
  inSelection,
  isAccessoryTool,
  isOpeningTool,
  isRectTool,
  GRID,
  STAMP,
  snap,
  snapCell,
  itemsInRect,
  allItems,
  ladderPose,
  makePegMesh,
  makeStudioGizmos,
  makeStudioGrid,
  moveItems,
  nearestBuildingWall,
  openingPose,
  orbitDrag,
  panDrag,
  paletteOf,
  pickBuildingWall,
  pickGround,
  pickStudioHit,
  place,
  placeBuildingRect,
  playableSpec,
  postDraft,
  rectSurfaceY,
  resizeItem,
  itemBox,
  sameItem,
  saveStored,
  setLotHandle,
  SLAB_Y,
  setAreaName,
  setBuildingInterior,
  snapFloor,
  studioAreaIndex,
  studioBuildingIndex,
  surfaceAt,
  interiorYAt,
  wallHeightAt,
  wallFootprint,
  toolFromCode,
  toolsFor,
  turnYaw,
  walkKeepsTool,
  zoomOrbit,
  type Handle,
  type PaletteId,
  type StudioItem,
  type ToolId,
} from "./maps/studio";
import {
  activeDoc,
  addDoc,
  addVersion,
  newDocId,
  readBrowserLibrary,
  revertVersion,
  selectDoc,
  seedCatalog,
  writeActive,
  writeBrowserLibrary,
  type StudioLibrary,
} from "./maps/studio-lib";
import { buildPawn, pawnStyle, poseStance, setPawnCloth, stepWalkFromPos, teamCloth, packLook } from "./pawn";
import { clearPodium, mountPodium, podiumLookAt } from "./podium";
import { pickBodyVictim, pawnHitMeshes, remoteTargets, meleeTarget, type LiveBody } from "./combat";
import {
  clearTape,
  createTape,
  FAST_RATE,
  inSlowWindow,
  killsReached,
  pickMvp,
  playBounds,
  pushFrame,
  pushKill,
  recapWindow,
  reelDrivesBotMeshes,
  reelWorldPawnVisible,
  samplePoses,
  PLAY_RATE,
  watchLabel,
  type KillClip,
  type Pose,
} from "./replay";
import {
  makeKar98,
  makeMosin,
  makeRightArm,
  poseKnifeRest,
  poseKnifeSlash,
  applyReloadPose,
  poseAmmo,
  poseBolt,
  poseThrow,
  poseArm,
  reloadBoltK,
  rifleWrist,
  knifeWrist,
  nadeWrist,
  RIFLES,
  type RifleId,
} from "./weapons";
import { makeBomb } from "./bomb";
import {
  clearFire,
  consumeFire,
  emptyQueue,
  fireWantsShot,
  pressFire,
  releaseFire,
} from "./fireQueue";
import { accountKey, accountLook, bindIdentity, isRegistered, paintIdentity } from "./account";
import { COW_SECS, connectNet, fetchServers, playWsUrl, serverGone, setNetName, setNetSkin, setNetLook, setNetPlayerKey, type NetHandle, type Snapshot } from "./net";
import {
  applyMatchSnap,
  buildSnapshot,
  collectInput,
  dropPeer,
  lookbackMs,
  pushPred,
  reconcilePredicted,
  restoreHomeSeats,
  seatPeer,
  statusLine,
  syncClientPawns,
  tickRemote,
  type PredSample,
  type Remote,
} from "./peers";
import { prefs, savePrefs } from "./prefs";
import { bindCrosshairSettings } from "./crosshair";
import { LOOK_SLOTS, applyLookChoice, lookView, type LookSlot } from "./look";
import { setStepVolume, tickSteps } from "./steps";
import { createHoldSound, isActivelyCutting, tickHoldSound } from "./holdSound";
import { applyLine, noteHit, noteKill, line, resetStats, swapLines } from "./stats";
import { jumpSpeed, meleeReach, tuning } from "./tuning";
import { makeMelee } from "./knife-variants";

const RADIUS = 0.32;
const RELOAD = 1.45;
const MOUSE = 0.0036;
const HP_MAX = 100;
const FRAG_R = 6.5;

const canvas = document.querySelector<HTMLCanvasElement>("#view")!;
const startEl = document.querySelector<HTMLElement>("#start")!;
const hitmark = document.querySelector<HTMLElement>("#hitmark")!;
const hurtEl = document.querySelector<HTMLElement>("#hurt")!;
const blastEl = document.querySelector<HTMLElement>("#blast")!;
const veilEl = document.querySelector<HTMLElement>("#smoke-veil")!;
const flashVeil = document.querySelector<HTMLElement>("#flash-veil");
const stunVeil = document.querySelector<HTMLElement>("#stun-veil");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.98;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
let mapId: string = "wharf";
let customSpec: LayoutSpec | null = null;
let lobbyStudioMaps: { id: string; title: string }[] = [];
let world = buildMap(scene, mapId as MapId);

function calloutAt(x: number, z: number, y = 0) {
  return world.placeName?.(x, z, y) ?? placeName(x, z, y);
}
const studioGhost = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshBasicMaterial({ color: 0xc8c4bc, transparent: true, opacity: 0.38, depthWrite: false }),
);
studioGhost.visible = false;
studioGhost.frustumCulled = false;
scene.add(studioGhost);
const studioPeg = makePegMesh();
scene.add(studioPeg);
const studioSel = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshBasicMaterial({ color: 0xe8d9a8, transparent: true, opacity: 0.22, depthWrite: false }),
);
studioSel.visible = false;
studioSel.frustumCulled = false;
scene.add(studioSel);
const studioAim = new THREE.Vector3();
const studio = {
  on: false,
  playing: false,
  spec: blankSpec(),
  tool: "select" as ToolId,
  palette: "hand" as PaletteId,
  lastKit: "crate" as ToolId,
  sels: [] as StudioItem[],
  lib: seedCatalog(readBrowserLibrary(blankSpec()), LAYOUT_SPECS) as StudioLibrary,
  undo: [] as LayoutSpec[],
  redo: [] as LayoutSpec[],
  base: null as LayoutSpec | null,
  bw: STAMP,
  bd: STAMP,
  cam: defaultOrbit(blankSpec().bounds),
  faceYaw: 0,
  mx: innerWidth / 2,
  my: innerHeight / 2,
  painting: false,
  orbiting: false,
  panning: false,
  walk: false,
  drag: null as null | {
    mode: "rect" | "move" | "lot" | "resize" | "marquee" | "peg";
    x0: number;
    z0: number;
    x1: number;
    z1: number;
    y: number;
    handle?: Handle;
    item?: StudioItem;
    ox?: number;
    oz?: number;
  },
  lastCell: "",
};
const lockerPawn = new THREE.Group();
lockerPawn.visible = false;
scene.add(lockerPawn);
const locker = {
  on: false,
  dragging: false,
  team: (prefs.team ?? "ember") as "ember" | "stone",
  zoom: 1,
  dist: 1.62,
  theta: 1.02,
  phi: Math.PI,
  aimY: 1.52,
  fov: 34,
  slot: "face" as LookSlot,
};
const match = createMatch();
{
  const you = humanSlot(match);
  if (you) you.name = displayName(prefs.name);
  setNetName(prefs.name);
  setNetSkin(prefs.skin);
  setNetLook(accountLook() || packLook(prefs.look));
  setNetPlayerKey(accountKey() || prefs.playerKey);
}
const bots = createBots(scene, world, match);
let playerId = humanSlot(match)?.id ?? 0;
let possessId: number | null = null;
let specId: number | null = null;

function actorId() {
  return possessId ?? playerId;
}
const tape = createTape();
const ghost = makeStandIn();
scene.add(ghost);

function idleNet(): NetHandle {
  return {
    role: "offline",
    status: "offline",
    attempt: 0,
    peerId: null,
    pingMs: 0,
    inKbps: 0,
    snapHz: 0,
    sendInput() {},
    sendSnapshot() {},
    sendEvent() {},
    rejectReason: "",
    onRole() {},
    onStatus() {},
    onInput() {},
    onSnapshot() {},
    onEvent() {},
    onPeerJoin() {},
    onPeerLeave() {},
    onMap() {},
    destroy() {},
  };
}

let net: NetHandle = idleNet();
const remotes = new Map<number, Remote>();
const clientPawns = new Map<number, THREE.Group>();
let lastSnap: Snapshot | null = null;
let snapSeq = 0;
let appliedSeq = -1;
const predHist: PredSample[] = [];

let lastBeat = 0;
let refreshServers: () => Promise<void> = async () => {};

function bindNet(handle: NetHandle) {
  handle.onSnapshot((snap) => {
    lastSnap = snap;
    snapSeq += 1;
    lastBeat = performance.now();
  });
  handle.onMap((info) => {
    if (studio.on || locker.on) return;
    applyServerMap(info.mapId, info.spec);
  });
  handle.onRole((role) => {
    if (role === "client") lastBeat = performance.now();
    if (role === "client" && prefs.team && document.body.classList.contains("started")) {
      handle.sendEvent({ kind: "joinTeam", team: prefs.team, name: prefs.name, skin: prefs.skin, look: accountLook() || packLook(prefs.look), playerKey: accountKey() || prefs.playerKey });
    }
    paintJoin();
  });
  handle.onStatus(() => {
    paintJoin();
  });
}

let joiningName = "";

function joinPanel() {
  return document.querySelector<HTMLElement>("#join-team");
}

function hideJoinTeam() {
  const panel = joinPanel();
  if (panel) {
    panel.hidden = true;
    panel.classList.remove("pick");
  }
  const pick = document.querySelector<HTMLElement>("#join-team-pick");
  if (pick) pick.hidden = true;
  const list = document.querySelector<HTMLElement>("#server-list");
  if (list) list.hidden = false;
}

function awaitingTeamPick() {
  return net.role === "client" && !document.body.classList.contains("started");
}

function joinGame(name?: string) {
  if (!isRegistered()) {
    paintIdentity();
    return;
  }
  if (net.status === "connecting") {
    paintJoin();
    return;
  }
  if (net.role === "client") {
    if (document.body.classList.contains("started")) enterPlay();
    else paintJoin();
    return;
  }
  if (name) joiningName = name;
  lastBeat = performance.now();
  net.destroy();
  net = connectNet(playWsUrl());
  bindNet(net);
  paintJoin();
}

function enterPlay() {
  lastBeat = lastBeat || performance.now();
  document.body.classList.add("started");
  lock();
}

function leaveToLobby() {
  if (studio.on) {
    studio.on = false;
    studio.walk = false;
    studio.drag = null;
    studio.painting = false;
    studio.orbiting = false;
    studio.panning = false;
    studioGhost.visible = false;
    document.body.classList.remove("studio", "studio-nav", "studio-walk", "studio-hand", "studio-grab", "locker", "locker-drag");
    locker.on = false;
    lockerPawn.visible = false;
  }
  net.destroy();
  net = idleNet();
  bindNet(net);
  lastSnap = null;
  lastBeat = 0;
  predHist.length = 0;
  joiningName = "";
  hideJoinTeam();
  studio.playing = false;
  stopReel();
  document.body.classList.remove("started", "playing", "admin", "settings", "dead", "ads", "bestplay", "podium", "studio-play");
  document.exitPointerLock();
  paintJoin();
  void refreshServers();
}

function paintJoin() {
  const el = document.querySelector<HTMLElement>("#join-status");
  const list = document.querySelector<HTMLElement>("#server-list");
  const pick = document.querySelector<HTMLElement>("#join-team-pick");
  const panel = joinPanel();
  const who = joiningName || "the game";
  const whoEl = document.querySelector("#join-who");
  if (whoEl) whoEl.textContent = who;
  if (el) {
    el.classList.remove("busy", "ok");
    if (net.status === "connecting") {
      const tryN = net.attempt > 1 ? ` · try ${net.attempt}` : "";
      el.textContent = `Connecting to ${who}${tryN}`;
      el.classList.add("busy");
      el.hidden = false;
    } else if (net.status === "rejected") {
      el.textContent = net.rejectReason === "banned" ? "This key is banned." : "Could not join. Register first.";
      el.hidden = false;
    } else {
      el.textContent = "";
      el.hidden = true;
    }
  }
  const connecting = net.status === "connecting";
  const rejected = net.status === "rejected";
  const picking = awaitingTeamPick();
  if (list) list.hidden = connecting || picking || rejected;
  if (pick) pick.hidden = !picking;
  if (panel) {
    panel.hidden = !connecting && !picking && !rejected;
    panel.classList.toggle("pick", picking);
  }
  if (!list) return;
  for (const row of list.querySelectorAll<HTMLButtonElement>(".server-row")) {
    row.classList.toggle("busy", connecting);
    row.disabled = connecting || row.dataset.offline === "1";
  }
}

addEventListener("pagehide", () => net.destroy());

const bestplayKicker = document.querySelector("#bestplay-kicker")!;
const bestplayName = document.querySelector("#bestplay-name")!;
const bestplayStat = document.querySelector("#bestplay-stat")!;
const bestplayKill = document.querySelector("#bestplay-kill")!;
const bestplayPace = document.querySelector("#bestplay-pace")!;

type Reel = {
  mvpId: number;
  clips: KillClip[];
  playT: number;
  endT: number;
  shown: number;
  recap: boolean;
  skipAt: number;
};
let reel: Reel | null = null;
let reelPlayed = false;
let lastRecord = -1;
let seenPhase = match.phase;
let cowUntil = 0;
let cowId: number | null = null;
const cowMeshes = new Map<number, THREE.Group>();
const cowed = new Set<number>();
let podiumOn = false;

function isCow(id: number) {
  return cowed.has(id) || (cowId === id && time < cowUntil);
}

function hideCowPawn(id: number, hide: boolean) {
  if (net.role !== "client") {
    const b = bots.find((x) => x.id === id);
    if (b && b.hp > 0) b.root.visible = !hide;
    const r = [...remotes.values()].find((x) => x.slotId === id || x.homeId === id);
    if (r) r.root.visible = !hide;
  }
  const g = clientPawns.get(id);
  if (g) g.visible = !hide;
}

function ensureCowMesh(id: number) {
  if (cowMeshes.has(id)) return;
  const mesh = makeCowMesh();
  scene.add(mesh);
  cowMeshes.set(id, mesh);
  hideCowPawn(id, true);
}

function dropCowMesh(id: number, blast: boolean) {
  const mesh = cowMeshes.get(id);
  if (!mesh) return;
  if (blast) playBlast(mesh.position.x, mesh.position.y, mesh.position.z);
  scene.remove(mesh);
  cowMeshes.delete(id);
  hideCowPawn(id, false);
}

function clearCow() {
  cowUntil = 0;
  cowId = null;
  cowed.clear();
  for (const id of [...cowMeshes.keys()]) dropCowMesh(id, false);
  if (net.role !== "client") {
    for (const b of bots) if (b.hp > 0) b.root.visible = true;
    for (const r of remotes.values()) r.root.visible = true;
  }
}

function refreshCows() {
  const want = new Set<number>();
  if (cowId != null && time < cowUntil) want.add(cowId);
  if (lastSnap) {
    for (const p of lastSnap.pawns) {
      if (p.cow && p.alive) want.add(p.id);
    }
  }
  cowed.clear();
  for (const id of want) cowed.add(id);
  for (const id of [...cowMeshes.keys()]) {
    if (!want.has(id)) dropCowMesh(id, true);
  }
  for (const id of want) ensureCowMesh(id);
}

function makeCowMesh() {
  const g = new THREE.Group();
  const hide = new THREE.MeshStandardMaterial({ color: 0x3a2210, roughness: 0.9 });
  const fire = new THREE.MeshStandardMaterial({ color: 0xff6a18, emissive: 0xff5010, emissiveIntensity: 1.4, roughness: 0.5 });
  const box = (x: number, y: number, z: number, sx: number, sy: number, sz: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    m.position.set(x, y, z);
    g.add(m);
  };
  box(0, 0.55, 0, 0.55, 0.42, 0.9, hide);
  box(0, 0.72, 0.52, 0.28, 0.28, 0.28, hide);
  box(0.18, 0.88, 0.55, 0.06, 0.16, 0.06, hide);
  box(-0.18, 0.88, 0.55, 0.06, 0.16, 0.06, hide);
  box(0.18, 0.18, 0.28, 0.1, 0.36, 0.1, hide);
  box(-0.18, 0.18, 0.28, 0.1, 0.36, 0.1, hide);
  box(0.18, 0.18, -0.28, 0.1, 0.36, 0.1, hide);
  box(-0.18, 0.18, -0.28, 0.1, 0.36, 0.1, hide);
  box(0, 0.62, -0.52, 0.08, 0.08, 0.22, hide);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), fire);
  flame.position.set(0, 0.7, 0);
  g.add(flame);
  const light = new THREE.PointLight(0xff6a18, 8, 8);
  light.position.set(0, 1.1, 0);
  g.add(light);
  return g;
}

function applyCow(slot: Slot) {
  cowId = slot.id;
  cowUntil = time + COW_SECS;
  ensureCowMesh(slot.id);
  cowed.add(slot.id);
}

function explodeCow() {
  const id = cowId;
  let x = px;
  let y = py;
  let z = pz;
  const b = bots.find((t) => t.id === id);
  const r = [...remotes.values()].find((t) => t.slotId === id);
  const p = lastSnap?.pawns.find((t) => t.id === id);
  if (b) {
    x = b.x;
    y = b.y;
    z = b.z;
  } else if (r) {
    x = r.x;
    y = r.y;
    z = r.z;
  } else if (p) {
    x = p.x;
    y = p.y;
    z = p.z;
  }
  playBlast(x, y, z);
  if (net.role !== "client") {
    if (id === playerId || id === possessId) hurtPlayer(400, "a flaming cow", undefined, true);
    else if (b && hurtBot(b, 400, time)) markDead(match, b.id, b.x, b.y, b.z);
    else if (r) {
      r.hp = 0;
      r.alive = false;
      markDead(match, r.slotId, r.x, r.y, r.z);
    }
  }
  cowUntil = 0;
  cowId = null;
  if (id != null) dropCowMesh(id, false);
}

function restartRoom() {
  hidePodium();
  clearPodium(scene);
  podiumOn = false;
  clearCow();
  resetStats();
  kills = 0;
  deaths = 0;
  restartMatch(match, world.plantSpawns[2]!);
  roundSpawn();
}

function paintMapPick() {
  const key = document.querySelector(".map-key");
  if (key && world.sites[0] && world.sites[1]) {
    key.textContent = `you · ember · stone · A / B`;
  }
  const mapTitle = document.querySelector(".map-head span");
  if (mapTitle && world.title) mapTitle.textContent = world.title;
  document.querySelectorAll("#map-pick button").forEach((b) => {
    b.classList.toggle("on", (b as HTMLButtonElement).dataset.id === mapId);
  });
  fillAdminMaps();
  paintTeamPick();
}

function fillAdminMaps() {
  const sel = document.querySelector<HTMLSelectElement>("#admin-map");
  if (!sel || sel === document.activeElement) return;
  const cur = sel.value;
  sel.replaceChildren();
  const stock = document.createElement("optgroup");
  stock.label = "Rotation";
  for (const m of MAPS) {
    const o = document.createElement("option");
    o.value = m.id;
    o.textContent = m.title;
    stock.append(o);
  }
  sel.append(stock);
  const mine = document.createElement("optgroup");
  mine.label = "Studio";
  const seen = new Set<string>();
  for (const d of studio.lib.docs) {
    const o = document.createElement("option");
    o.value = `studio:${d.id}`;
    o.textContent = MAPS.some((m) => m.id === d.id) ? `${d.title} · studio` : d.title || "Untitled";
    mine.append(o);
    seen.add(d.id);
  }
  for (const d of lobbyStudioMaps) {
    if (seen.has(d.id)) continue;
    const o = document.createElement("option");
    o.value = `studio:${d.id}`;
    o.textContent = d.title || d.id;
    mine.append(o);
  }
  if (mine.childElementCount) sel.append(mine);
  const want = customSpec ? `studio:${customSpec.id}` : mapId;
  if ([...sel.options].some((o) => o.value === want)) sel.value = want;
  else if ([...sel.options].some((o) => o.value === cur)) sel.value = cur;
}

function paintTeamPick() {
  let team: Team = prefs.team ?? "ember";
  if (net.role === "client") {
    const me =
      lastSnap && net.peerId != null
        ? lastSnap.pawns.find((p) => (p.netId ?? 0) === net.peerId)
        : undefined;
    team = prefs.team ?? me?.team ?? "ember";
  } else {
    team = slotById(match, playerId)?.team ?? prefs.team ?? "ember";
  }
  document.querySelectorAll("#join-team-pick button, #set-team button").forEach((b) => {
    b.classList.toggle("on", (b as HTMLButtonElement).dataset.team === team);
  });
}

function pickTeam(team: Team) {
  prefs.team = team;
  savePrefs();
  if (net.role === "client") {
    net.sendEvent({ kind: "joinTeam", team, name: prefs.name, skin: prefs.skin, look: accountLook() || packLook(prefs.look), playerKey: accountKey() || prefs.playerKey });
  }
  paintTeamPick();
}

function switchLocalTeam(team: Team) {
  const you = slotById(match, playerId);
  if (!you || you.team === team) {
    paintTeamPick();
    return;
  }
  const oldId = you.id;
  const oldName = you.name;
  vacateSlot(match, you);
  bots.push(spawnBot(scene, world, match, you));
  const seat = claimSlot(match, team, displayName(prefs.name));
  if (!seat) {
    despawnBot(scene, bots, oldId);
    you.kind = "human";
    you.name = oldName;
    you.occupant = undefined;
    paintTeamPick();
    return;
  }
  swapLines(oldId, seat.id);
  despawnBot(scene, bots, seat.id);
  playerId = seat.id;
  const gfig = buildPawn(ghost, team, playerId, prefs.look);
  ghost.userData.body = gfig.body;
  ghost.userData.cloth = gfig.cloth;
  roundSpawn();
  paintTeamPick();
}

function loadMap(id: string, force = false, spec?: LayoutSpec | null) {
  const parsed = spec ? asLayoutSpec(spec) : null;
  if (!force && id === mapId && !parsed && !customSpec && net.role !== "client") {
    paintMapPick();
    return;
  }
  if (parsed) {
    const play = playableSpec(parsed);
    mapId = play.id || id;
    customSpec = play;
    clearCow();
    if (net.role !== "client") {
      for (const b of [...bots]) despawnBot(scene, bots, b.id);
    }
    wipeMapMeshes();
    world = compileLayout(scene, play);
    afterMapLoad();
    if (net.role === "client") {
      for (const b of bots) b.root.visible = false;
      paintMapPick();
      return;
    }
    bots.push(...createBots(scene, world, match));
    restartRoom();
    paintMapPick();
    return;
  }
  if (!MAPS.some((m) => m.id === id)) {
    paintMapPick();
    return;
  }
  customSpec = null;
  mapId = id;
  clearCow();
  if (net.role !== "client") {
    for (const b of [...bots]) despawnBot(scene, bots, b.id);
  }
  wipeMapMeshes();
  world = buildMap(scene, id as MapId);
  afterMapLoad();
  if (net.role === "client") {
    for (const b of bots) b.root.visible = false;
    paintMapPick();
    return;
  }
  bots.push(...createBots(scene, world, match));
  restartRoom();
  paintMapPick();
}

function applyServerMap(id: string, spec?: LayoutSpec) {
  const parsed = spec ? asLayoutSpec(spec) : null;
  if (parsed) loadMap(id, true, parsed);
  else if (id !== mapId || customSpec) loadMap(id, true);
}

function wipeMapMeshes() {
  const keep = new Set<THREE.Object3D>([
    camera,
    ghost,
    wirePack,
    studioGhost,
    studioSel,
    studioPeg,
    lockerPawn,
    ...[...remotes.values()].map((r) => r.root),
    ...clientPawns.values(),
  ]);
  for (const c of [...scene.children]) {
    if (!keep.has(c)) scene.remove(c);
  }
  tracers.length = 0;
  decals.length = 0;
  sparks.length = 0;
  for (const b of blasts) scene.remove(b.mesh, b.light);
  blasts.length = 0;
}

function afterMapLoad() {
  if (!studioGhost.parent) scene.add(studioGhost);
  if (!studioSel.parent) scene.add(studioSel);
  if (!studioPeg.parent) scene.add(studioPeg);
  if (!lockerPawn.parent) scene.add(lockerPawn);
  lockerPawn.visible = locker.on;
  for (const r of remotes.values()) {
    if (!r.root.parent) scene.add(r.root);
    r.root.visible = true;
  }
  for (const g of clientPawns.values()) {
    if (!g.parent) scene.add(g);
    g.visible = true;
  }
}

function specForStudioId(id: string): LayoutSpec | null {
  const doc = studio.lib.docs.find((d) => d.id === id);
  return doc ? cloneSpec(doc.spec) : specForMap(id) ?? null;
}

async function fetchStudioSpec(id: string): Promise<LayoutSpec | null> {
  const local = specForStudioId(id);
  if (local) return local;
  try {
    const res = await fetch(`/api/studio-maps/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return asLayoutSpec(await res.json());
  } catch {
    return null;
  }
}

async function refreshLobbyStudioMaps() {
  try {
    const res = await fetch("/api/studio-maps");
    if (!res.ok) return;
    const list = (await res.json()) as { id: string; title: string }[];
    if (Array.isArray(list)) {
      lobbyStudioMaps = list.filter((d) => d?.id);
      fillAdminMaps();
    }
  } catch {
    /* lobby optional */
  }
}

async function postStudioMap(spec: LayoutSpec) {
  try {
    await fetch("/api/studio-maps", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(spec),
    });
    if (!lobbyStudioMaps.some((d) => d.id === spec.id)) {
      lobbyStudioMaps = [...lobbyStudioMaps, { id: spec.id, title: spec.title || spec.id }];
      fillAdminMaps();
    }
  } catch {
    /* lobby optional */
  }
}

async function sendAdminMap(value: string) {
  if (value.startsWith("studio:")) {
    const id = value.slice("studio:".length);
    const spec = await fetchStudioSpec(id);
    if (!spec) return;
    const play = playableSpec(spec);
    await postStudioMap(play);
    net.sendEvent({ kind: "changeMap", mapId: play.id, spec: play });
    return;
  }
  net.sendEvent({ kind: "changeMap", mapId: value });
}

async function sendStudioToServer() {
  persistSpec(studio.spec, true);
  const play = playableSpec(studio.spec);
  const status = document.querySelector("#studio-status");
  if (net.role !== "client") {
    if (status) status.textContent = "join a server, then Server";
    return;
  }
  await postStudioMap(play);
  net.sendEvent({ kind: "changeMap", mapId: play.id, spec: play });
  if (status) status.textContent = `sent ${play.title} to server`;
}

function persistSpec(spec: LayoutSpec, checkpoint = false) {
  studio.spec = spec;
  studio.lib = checkpoint ? addVersion(studio.lib, spec) : writeActive(studio.lib, spec);
  writeBrowserLibrary(studio.lib);
  saveStored(spec);
}

function studioCallName() {
  const el = document.querySelector<HTMLInputElement>("#studio-area-name");
  return callName(el?.value ?? "");
}

function studioRecord() {
  studio.undo.push(cloneSpec(studio.spec));
  if (studio.undo.length > 80) studio.undo.shift();
  studio.redo = [];
}

function studioApply(next: LayoutSpec, opts?: { record?: boolean; checkpoint?: boolean }) {
  if (next === studio.spec) return false;
  if (opts?.record !== false) studioRecord();
  persistSpec(next, opts?.checkpoint);
  rebuildStudio();
  paintStudio();
  return true;
}

function studioUndo() {
  const prev = studio.undo.pop();
  if (!prev) return;
  studio.redo.push(cloneSpec(studio.spec));
  persistSpec(prev);
  studio.sels = [];
  rebuildStudio();
  paintStudio();
}

function studioRedo() {
  const next = studio.redo.pop();
  if (!next) return;
  studio.undo.push(cloneSpec(studio.spec));
  persistSpec(next);
  studio.sels = [];
  rebuildStudio();
  paintStudio();
}

function studioSave() {
  persistSpec(studio.spec, true);
  paintStudio();
  const status = document.querySelector("#studio-status");
  if (status) status.textContent = `saved ${studio.spec.title}`;
}

function studioNewMap() {
  persistSpec(studio.spec, true);
  const spec = blankSpec();
  spec.title = "Untitled";
  spec.id = newDocId(spec.title);
  studio.lib = addDoc(studio.lib, spec);
  studio.spec = spec;
  studio.sels = [];
  studio.undo = [];
  studio.redo = [];
  studio.cam = defaultOrbit(spec.bounds);
  writeBrowserLibrary(studio.lib);
  saveStored(spec);
  rebuildStudio();
  paintStudio();
}

function studioSwitchMap(id: string) {
  persistSpec(studio.spec, true);
  const nextLib = selectDoc(studio.lib, id);
  const doc = nextLib ? activeDoc(nextLib) : null;
  if (!nextLib || !doc) return;
  studio.lib = nextLib;
  studio.spec = cloneSpec(doc.spec);
  studio.sels = [];
  studio.undo = [];
  studio.redo = [];
  studio.cam = defaultOrbit(studio.spec.bounds);
  writeBrowserLibrary(studio.lib);
  saveStored(studio.spec);
  rebuildStudio();
  paintStudio();
}

function studioRevert(index: number) {
  const hit = revertVersion(studio.lib, index);
  if (!hit) return;
  studioRecord();
  studio.lib = hit.lib;
  studio.spec = hit.spec;
  studio.sels = [];
  writeBrowserLibrary(studio.lib);
  saveStored(studio.spec);
  rebuildStudio();
  paintStudio();
}

function fillStudioLists() {
  const maps = document.querySelector<HTMLSelectElement>("#studio-map");
  const vers = document.querySelector<HTMLSelectElement>("#studio-versions");
  if (maps && maps !== document.activeElement) {
    maps.replaceChildren();
    for (const d of studio.lib.docs) {
      const o = document.createElement("option");
      o.value = d.id;
      o.textContent = d.title || "Untitled";
      if (d.id === studio.lib.activeId) o.selected = true;
      maps.append(o);
    }
  }
  if (vers && vers !== document.activeElement) {
    vers.replaceChildren();
    const doc = activeDoc(studio.lib);
    const ph = document.createElement("option");
    ph.value = "";
    ph.textContent = doc?.versions.length ? "Versions" : "No versions";
    vers.append(ph);
    (doc?.versions ?? []).forEach((v, i) => {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent = `v${(doc?.versions.length ?? 0) - i} · ${new Date(v.at).toLocaleTimeString()}`;
      vers.append(o);
    });
  }
  fillAdminMaps();
}

function setStudioTool(id: ToolId) {
  studio.tool = id;
  studio.palette = paletteOf(id);
  if (isAccessoryTool(id)) studio.lastKit = id;
  if (studio.walk && !walkKeepsTool(id)) leaveWalk();
  paintStudio();
}

function paintStudio() {
  document.body.classList.toggle("studio", studio.on);
  document.body.classList.toggle("studio-walk", studio.on && studio.walk);
  document.body.classList.toggle("studio-hand", studio.on && studio.tool === "select" && !studio.walk);
  document.body.classList.toggle("studio-grab", studio.on && studio.tool === "select" && (studio.drag?.mode === "move" || studio.drag?.mode === "resize"));
  document.body.classList.toggle("studio-peg", studio.on && studio.drag?.mode === "peg");
  document.body.classList.toggle("studio-pan", studio.on && studio.panning);
  document.querySelector("#studio-pal-hand")?.classList.toggle("on", studio.palette === "hand");
  document.querySelector("#studio-pal-build")?.classList.toggle("on", studio.palette === "build");
  document.querySelector("#studio-pal-kit")?.classList.toggle("on", studio.palette === "kit");
  const tools = document.querySelector("#studio-tools")!;
  tools.replaceChildren();
  for (const t of toolsFor(studio.palette)) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.tool = t.id;
    b.textContent = `${t.key} ${t.label}`;
    b.classList.toggle("on", t.id === studio.tool);
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      setStudioTool(t.id);
    });
    tools.append(b);
  }
  const walkBtn = document.querySelector("#studio-walk");
  if (walkBtn) {
    walkBtn.classList.toggle("on", studio.walk);
    walkBtn.textContent = studio.walk ? "Orbit" : "Walk";
  }
  const del = document.querySelector<HTMLButtonElement>("#studio-delete");
  if (del) del.disabled = studio.sels.length === 0;
  const undoBtn = document.querySelector<HTMLButtonElement>("#studio-undo");
  const redoBtn = document.querySelector<HTMLButtonElement>("#studio-redo");
  if (undoBtn) undoBtn.disabled = studio.undo.length === 0;
  if (redoBtn) redoBtn.disabled = studio.redo.length === 0;
  const titleEl = document.querySelector<HTMLInputElement>("#studio-title");
  if (titleEl && titleEl !== document.activeElement) titleEl.value = studio.spec.title;
  const themeEl = document.querySelector<HTMLSelectElement>("#studio-theme");
  if (themeEl && themeEl !== document.activeElement) themeEl.value = studio.spec.theme;
  fillStudioLists();
  const build = document.querySelector<HTMLElement>("#studio-building");
  const bi = studioBuildingIndex(studio.sels);
  const b = bi >= 0 ? studio.spec.buildings?.[bi] : undefined;
  if (build) build.hidden = !b;
  if (b) {
    const floors = buildingFloors(b);
    const n = document.querySelector("#studio-storeys");
    if (n) n.textContent = String(floors);
    const sub = document.querySelector<HTMLButtonElement>("#studio-storeys-sub");
    const add = document.querySelector<HTMLButtonElement>("#studio-storeys-add");
    if (sub) sub.disabled = floors <= 1;
    if (add) add.disabled = floors >= 10;
    const interior = buildingInterior(b);
    document.querySelector("#studio-interior-floors")?.classList.toggle("on", interior === "floors");
    document.querySelector("#studio-interior-empty")?.classList.toggle("on", interior === "empty");
  }
  const areaPanel = document.querySelector<HTMLElement>("#studio-area");
  const ai = studioAreaIndex(studio.sels);
  const area = ai >= 0 ? studio.spec.areas?.[ai] : undefined;
  if (areaPanel) areaPanel.hidden = studio.tool !== "area" && !area;
  const areaName = document.querySelector<HTMLInputElement>("#studio-area-name");
  if (areaName && areaName !== document.activeElement && area) areaName.value = area.name;
  const hint = document.querySelector("#studio-hint");
  if (hint) {
    hint.textContent = studio.walk
      ? "WASD move · click to place any tool except Building · U cuts one square · Esc orbit"
      : "Drag the yellow peg to walk there · Middle-drag pans · Shift-click or drag-box to multi-select · Knobs resize · Ctrl+Z undo";
  }
  const status = document.querySelector("#studio-status");
  const lot = studio.spec.bounds;
  if (status) {
    const sel = studio.sels.length ? ` · ${studio.sels.length} selected` : "";
    status.textContent = `${studio.spec.title} · lot ${lot.maxX - lot.minX}×${lot.maxZ - lot.minZ}${sel}`;
  }
}

function rebuildStudio() {
  wipeMapMeshes();
  world = compileLayout(scene, studio.spec, { clay: !studio.walk });
  afterMapLoad();
  if (!studio.walk) {
    scene.add(makeStudioGrid(studio.spec.bounds));
    scene.add(makeStudioGizmos(studio.spec, studio.sels));
  }
  studioGhost.visible = true;
  const mapTitle = document.querySelector(".map-head span");
  if (mapTitle) mapTitle.textContent = studio.spec.title || "Studio";
  if (studio.walk) {
    const { minX, maxX, minZ, maxZ } = studio.spec.bounds;
    camera.near = 0.05;
    camera.far = Math.max(140, Math.hypot(maxX - minX, maxZ - minZ) * 1.4);
    camera.fov = 90;
    camera.updateProjectionMatrix();
  }
}

function refreshStudioGizmos(grid = false) {
  const gizmo = scene.getObjectByName("studio-gizmos");
  if (gizmo) scene.remove(gizmo);
  if (grid) {
    const old = scene.getObjectByName("studio-grid");
    if (old) scene.remove(old);
    if (!studio.walk) scene.add(makeStudioGrid(studio.spec.bounds));
  }
  if (!studio.walk) scene.add(makeStudioGizmos(studio.spec, studio.sels));
}

function enterStudio() {
  if (locker.on) leaveLocker(false);
  stopReel();
  document.body.classList.remove("bestplay", "studio-play");
  studio.playing = false;
  studio.on = true;
  studio.walk = false;
  studio.drag = null;
  studio.sels = [];
  studio.undo = [];
  studio.redo = [];
  studio.tool = "select";
  studio.palette = "hand";
  studio.lib = seedCatalog(readBrowserLibrary(blankSpec()), LAYOUT_SPECS);
  writeBrowserLibrary(studio.lib);
  void refreshLobbyStudioMaps();
  const doc = activeDoc(studio.lib);
  studio.spec = cloneSpec(doc?.spec ?? blankSpec());
  studio.cam = defaultOrbit(studio.spec.bounds);
  studio.faceYaw = 0;
  studio.painting = false;
  studio.orbiting = false;
  studio.panning = false;
  studio.lastCell = "";
  rebuildStudio();
  paintStudio();
  hideJoinTeam();
  document.body.classList.add("studio");
  document.body.classList.remove("studio-walk");
  applyOrbit(camera, studio.cam);
  document.exitPointerLock();
}

function leaveStudio() {
  persistSpec(studio.spec, true);
  studio.playing = false;
  studio.on = false;
  studio.walk = false;
  studio.drag = null;
  studio.sels = [];
  studio.painting = false;
  studio.orbiting = false;
  studio.panning = false;
  studio.lastCell = "";
  studioGhost.visible = false;
  studioSel.visible = false;
  studioPeg.visible = false;
  document.body.classList.remove("studio", "studio-nav", "studio-walk", "studio-hand", "studio-grab", "studio-pan", "studio-play");
  camera.near = 0.05;
  camera.far = 85;
  camera.fov = 90;
  camera.updateProjectionMatrix();
  loadMap(mapId, true);
}

function commitLook() {
  savePrefs();
  setNetSkin(prefs.skin);
  setNetLook(packLook(prefs.look));
  refreshMeleeView();
}

function paintLocker() {
  const panel = document.querySelector<HTMLElement>("#locker");
  if (panel) panel.hidden = !locker.on;
  const nameEl = document.querySelector<HTMLInputElement>("#locker-name");
  if (nameEl && nameEl !== document.activeElement) nameEl.value = prefs.name;
  const secs = document.querySelector("#locker-secs");
  if (secs && !secs.childElementCount) {
    for (const slot of LOOK_SLOTS) {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.slot = slot.key;
      b.textContent = slot.label;
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        locker.slot = slot.key;
        paintLocker();
      });
      secs.append(b);
    }
  }
  secs?.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
    b.classList.toggle("on", b.dataset.slot === locker.slot);
  });
  const slot = LOOK_SLOTS.find((s) => s.key === locker.slot) ?? LOOK_SLOTS[0]!;
  const hint = document.querySelector("#locker-slot-hint");
  if (hint) {
    const cam = slot.view === "melee" ? "Held melee" : slot.view === "body" ? "Full body" : "Head and shoulders";
    const rule =
      slot.key === "hair" || slot.key === "hat"
        ? " · Only buzz fits under a hat"
        : slot.key === "melee"
          ? " · Same hit range on every option"
          : "";
    hint.textContent = `${slot.label} · ${cam}${rule}`;
  }
  const opts = document.querySelector("#locker-opts");
  if (opts) {
    opts.replaceChildren();
    for (const opt of slot.options) {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.slot = slot.key;
      b.dataset.id = opt.id;
      b.title = opt.blurb;
      b.textContent = opt.label;
      b.classList.toggle("on", opt.id === prefs.look[slot.key]);
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        locker.slot = slot.key;
        prefs.look = applyLookChoice(prefs.look, slot.key, opt.id);
        commitLook();
        dressLockerPawn();
        paintLocker();
      });
      opts.append(b);
    }
  }
  document.querySelectorAll<HTMLButtonElement>("#locker-sides button").forEach((b) => {
    b.classList.toggle("on", b.dataset.side === locker.team);
  });
  paintIdentity();
  if (document.body.classList.contains("register")) return;
  const title = document.querySelector("#start-title");
  const blurb = document.querySelector("#start-blurb");
  if (title) title.textContent = locker.on ? "Player" : "Servers";
  if (blurb) {
    blurb.textContent = locker.on
      ? "Pick a slot. Close-up for the head, full body for kit. Ember and Stone colors apply when you join."
      : "Pick a match. Ember plants the Wire. First to six.";
  }
}

function dressLockerPawn() {
  pawnStyle.current = "limbs";
  buildPawn(lockerPawn, locker.team, 0, prefs.look);
  const held = makeMelee(prefs.look.melee);
  held.scale.setScalar(4.2);
  held.position.set(0.4, 1.02, 0.1);
  held.rotation.set(0.2, 0.35, -0.2);
  lockerPawn.add(held);
  lockerPawn.visible = true;
}

function lockerCamTarget() {
  const view = lookView(locker.slot);
  if (view === "melee") {
    return { dist: 2.05 * locker.zoom, aimY: 1.08, fov: 38 };
  }
  const portrait = view === "portrait";
  const base = portrait ? 1.62 : 3.55;
  return {
    dist: base * locker.zoom,
    aimY: portrait ? 1.52 : 0.92,
    fov: portrait ? 34 : 42,
  };
}

function applyLockerCam() {
  const { dist, theta, phi, aimY, fov } = locker;
  camera.position.set(
    dist * Math.sin(theta) * Math.sin(phi),
    aimY + dist * Math.cos(theta),
    dist * Math.sin(theta) * Math.cos(phi),
  );
  camera.lookAt(0, aimY, 0);
  camera.fov = fov;
  camera.near = 0.12;
  camera.far = 80;
  camera.updateProjectionMatrix();
}

function rebuildLocker() {
  wipeMapMeshes();
  scene.background = new THREE.Color(0x121410);
  scene.fog = null;
  scene.add(new THREE.HemisphereLight(0xc8c0b4, 0x2a2824, 1));
  const sun = new THREE.DirectionalLight(0xe8e0d4, 0.9);
  sun.position.set(3.4, 9, 5);
  sun.castShadow = true;
  scene.add(sun);
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(7, 40),
    new THREE.MeshStandardMaterial({ color: 0x1a1c16, roughness: 0.92, metalness: 0.04 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  if (!lockerPawn.parent) scene.add(lockerPawn);
  dressLockerPawn();
  const want = lockerCamTarget();
  locker.dist = want.dist;
  locker.aimY = want.aimY;
  locker.fov = want.fov;
  applyLockerCam();
}

function enterLocker() {
  if (studio.on) leaveStudio();
  stopReel();
  document.body.classList.remove("bestplay");
  locker.on = true;
  locker.dragging = false;
  locker.team = prefs.team ?? "ember";
  hideJoinTeam();
  document.body.classList.add("locker");
  document.body.classList.remove("settings");
  rebuildLocker();
  paintLocker();
  document.exitPointerLock();
}

function leaveLocker(reload = true) {
  locker.on = false;
  locker.dragging = false;
  lockerPawn.visible = false;
  document.body.classList.remove("locker", "locker-drag");
  paintLocker();
  camera.near = 0.05;
  camera.far = 85;
  camera.fov = 90;
  camera.updateProjectionMatrix();
  if (reload && !studio.on) loadMap(mapId, true);
}

function walkSpawn() {
  const spec = studio.spec;
  const { minX, maxX, minZ, maxZ } = spec.bounds;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const boxed = (spec.buildings ?? []).some(
    (b) => Math.abs(cx - b.x) < b.w / 2 - 0.6 && Math.abs(cz - b.z) < b.d / 2 - 0.6,
  );
  if (!boxed) return { x: cx, z: cz };
  const p = spec.plantSpawns[2] ?? spec.plantSpawns[0];
  if (p) return { x: p[0], z: p[1] };
  return { x: minX + 4, z: cz };
}

function enterWalkAt(x: number, z: number) {
  studio.walk = true;
  studio.painting = false;
  studio.orbiting = false;
  studio.panning = false;
  studio.drag = null;
  studio.sels = [];
  studioPeg.visible = false;
  if (!walkKeepsTool(studio.tool)) setStudioTool(studio.lastKit);
  px = x;
  pz = z;
  py = interiorYAt(studio.spec, x, z) + 0.08;
  vy = 0;
  yaw = 0;
  pitch = 0;
  rebuildStudio();
  paintStudio();
  canvas.requestPointerLock();
}

function enterWalk() {
  const spawn = walkSpawn();
  enterWalkAt(spawn.x, spawn.z);
}

function leaveWalk() {
  studio.walk = false;
  studio.drag = null;
  document.exitPointerLock();
  rebuildStudio();
  paintStudio();
  applyOrbit(camera, studio.cam);
}

function deleteStudioSel() {
  if (!studio.sels.length) return;
  studioApply(deleteItems(studio.spec, studio.sels));
  studio.sels = [];
  paintStudio();
}

function stampOpeningAt(x: number, z: number, y?: number) {
  if (!isOpeningTool(studio.tool)) return;
  const hit = nearestBuildingWall(studio.spec, x, z, y ?? surfaceAt(studio.spec, x, z));
  const status = document.querySelector("#studio-status");
  if (!hit) {
    if (status) status.textContent = "aim a building wall";
    return;
  }
  studioApply(addOpening(studio.spec, studio.tool, hit));
  if (status) status.textContent = `placed ${studio.tool}`;
}

function stampOpening() {
  const ground = studioHit();
  if (ground) stampOpeningAt(ground.x, ground.z);
}

function finishStudioDrag() {
  const drag = studio.drag;
  const base = studio.base;
  studio.drag = null;
  studio.painting = false;
  studio.lastCell = "";
  if (drag?.mode === "peg") {
    studioPeg.visible = false;
    const hit = studioHit();
    if (hit) enterWalkAt(hit.x, hit.z);
    else paintStudio();
    return;
  }
  if (drag?.mode === "marquee") {
    const picked = itemsInRect(studio.spec, drag.x0, drag.z0, drag.x1, drag.z1);
    const add = keys.has("ShiftLeft") || keys.has("ShiftRight");
    studio.sels = add ? [...studio.sels, ...picked.filter((p) => !inSelection(studio.sels, p))] : picked;
    studio.base = null;
    rebuildStudio();
    paintStudio();
    return;
  }
  if (drag?.mode === "rect") {
    const w = Math.abs(drag.x1 - drag.x0);
    const d = Math.abs(drag.z1 - drag.z0);
    let next = studio.spec;
    const dragged = w >= GRID || d >= GRID;
    if (studio.tool === "wall" || studio.tool === "floor" || studio.tool === "building" || studio.tool === "area") {
      if (dragged) next = placeBuildingRect(studio.spec, drag.x0, drag.z0, drag.x1, drag.z1, studio.tool, studio.faceYaw, drag.y, studioCallName());
      else next = place(studio.spec, studio.tool, drag.x0, drag.z0, { yaw: studio.faceYaw, y: drag.y, name: studioCallName() });
    } else {
      next = place(studio.spec, studio.tool, drag.x0, drag.z0, {
        yaw: studio.faceYaw,
        y: rectSurfaceY(studio.spec, drag.x0, drag.z0, drag.x1, drag.z1),
      });
    }
    if (base) {
      studio.spec = base;
      studio.base = null;
    }
    studioApply(next);
    const status = document.querySelector("#studio-status");
    if (status) status.textContent = `placed ${studio.tool}`;
    return;
  }
  if (drag && base && JSON.stringify(base) !== JSON.stringify(studio.spec)) {
    const next = studio.spec;
    studio.spec = base;
    studioApply(next);
  } else persistSpec(studio.spec);
  studio.base = null;
  rebuildStudio();
  paintStudio();
}

function studioHit() {
  const ndc = canvasNdc(canvas, studio.mx, studio.my);
  return pickGround(camera, ndc.x, ndc.y);
}

function stampEraseAt(x: number, z: number) {
  const gx = snap(x);
  const gz = snap(z);
  const key = cellKey("erase", gx, gz);
  if (key === studio.lastCell) return;
  const next = eraseNear(studio.spec, gx, gz);
  if (next === studio.spec) return;
  studio.lastCell = key;
  studio.sels = [];
  studioApply(next);
  const status = document.querySelector("#studio-status");
  if (status) status.textContent = "erased";
}

function stampStudio() {
  if (studio.tool === "select" || isRectTool(studio.tool) || isOpeningTool(studio.tool)) return;
  const hit = studioHit();
  if (!hit) return;
  if (studio.tool === "erase") {
    stampEraseAt(hit.x, hit.z);
    return;
  }
  const gx = snap(hit.x);
  const gz = snap(hit.z);
  const key = cellKey(studio.tool, gx, gz);
  if (key === studio.lastCell) return;
  studio.lastCell = key;
  studioApply(
    place(studio.spec, studio.tool, gx, gz, {
      yaw: studio.faceYaw,
      y: surfaceAt(studio.spec, gx, gz),
    }),
  );
  const status = document.querySelector("#studio-status");
  if (status) status.textContent = `placed ${studio.tool}`;
}

function stampWalkAccessory() {
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  if (isOpeningTool(studio.tool)) {
    const wall = pickBuildingWall(studio.spec, camera.position, dir);
    const status = document.querySelector("#studio-status");
    if (!wall) {
      if (status) status.textContent = "aim a building wall";
      return;
    }
    studioApply(addOpening(studio.spec, studio.tool, wall));
    if (status) status.textContent = `placed ${studio.tool}`;
    return;
  }
  const hit = aimGround(camera.position, dir);
  if (!hit) return;
  if (studio.tool === "erase") {
    stampEraseAt(hit.x, hit.z);
    return;
  }
  if (studio.tool === "select" || studio.tool === "building") return;
  const gx = snap(hit.x);
  const gz = snap(hit.z);
  const y = surfaceAt(studio.spec, gx, gz);
  const status = document.querySelector("#studio-status");
  if (studio.tool === "cut") {
    studioApply(place(studio.spec, "cut", gx, gz));
    if (status) status.textContent = "placed cut";
    return;
  }
  if (studio.tool === "floor") {
    const fit = snapFloor(studio.spec, gx, gz, gx, gz, y);
    studioApply(place(studio.spec, "floor", fit.x, fit.z, { bw: fit.w, bd: fit.d, y: fit.y }));
    if (status) status.textContent = "placed floor";
    return;
  }
  if (studio.tool === "wall") {
    studioApply(
      place(studio.spec, "wall", gx, gz, {
        yaw,
        y: interiorYAt(studio.spec, gx, gz, py),
      }),
    );
    if (status) status.textContent = "placed wall";
    return;
  }
  if (!isAccessoryTool(studio.tool)) return;
  studioApply(
    place(studio.spec, studio.tool, gx, gz, {
      yaw: studio.faceYaw,
      y,
      name: studioCallName(),
    }),
  );
  if (status) status.textContent = `placed ${studio.tool}`;
}

async function saveStudio() {
  saveStored(studio.spec);
  downloadSpec(studio.spec);
  const status = document.querySelector("#studio-status")!;
  try {
    await postDraft(studio.spec);
    status.textContent = "Saved studio-draft.json — ask the agent to finalize";
  } catch {
    status.textContent = "Downloaded spec · lobby save failed, paste the JSON if needed";
  }
}

function playStudio() {
  persistSpec(studio.spec, true);
  const spec = playableSpec(studio.spec);
  if (net.role === "client") {
    net.destroy();
    net = idleNet();
    bindNet(net);
    lastSnap = null;
    predHist.length = 0;
  }
  studio.playing = true;
  studio.on = false;
  studio.walk = false;
  studio.drag = null;
  studio.sels = [];
  studio.painting = false;
  studio.orbiting = false;
  studio.panning = false;
  studioGhost.visible = false;
  studioSel.visible = false;
  studioPeg.visible = false;
  document.body.classList.remove("studio", "studio-nav", "studio-walk", "studio-hand", "studio-grab", "studio-pan", "studio-peg");
  document.body.classList.add("studio-play");
  const { minX, maxX, minZ, maxZ } = spec.bounds;
  camera.far = Math.max(140, Math.hypot(maxX - minX, maxZ - minZ) * 1.4);
  camera.fov = 90;
  camera.updateProjectionMatrix();
  for (const b of [...bots]) despawnBot(scene, bots, b.id);
  wipeMapMeshes();
  world = compileLayout(scene, spec);
  afterMapLoad();
  match.mapTitle = spec.title;
  bots.push(...createBots(scene, world, match));
  restartRoom();
  hideJoinTeam();
  document.body.classList.add("started");
  paintMapPick();
  lock();
}

function returnToStudio() {
  if (!studio.playing && !studio.on) return;
  studio.playing = false;
  stopReel();
  hideDeath();
  hidePodium();
  clearPodium(scene);
  document.body.classList.remove("studio-play", "started", "playing", "dead", "ads", "bestplay", "podium", "settings");
  document.exitPointerLock();
  for (const b of [...bots]) despawnBot(scene, bots, b.id);
  studio.on = true;
  studio.walk = false;
  studio.drag = null;
  studio.sels = [];
  studio.painting = false;
  studio.orbiting = false;
  studio.panning = false;
  studio.lastCell = "";
  studio.tool = "select";
  studio.palette = "hand";
  hideJoinTeam();
  rebuildStudio();
  paintStudio();
  document.body.classList.add("studio");
  document.body.classList.remove("studio-walk");
  applyOrbit(camera, studio.cam);
}

function rebuildPawns() {
  pawnStyle.current = rules.classicPawn ? "classic" : "limbs";
  for (const b of bots) refillBotPawn(b);
  const youTeam = slotById(match, playerId)?.team ?? "ember";
  const gfig = buildPawn(ghost, youTeam, playerId, prefs.look);
  ghost.userData.body = gfig.body;
  ghost.userData.cloth = gfig.cloth;
  for (const r of remotes.values()) {
    const fig = buildPawn(r.root, r.team, r.slotId, r.look);
    r.root.userData.body = fig.body;
    r.root.userData.cloth = fig.cloth;
  }
  for (const g of clientPawns.values()) {
    const team = (g.userData.team as "ember" | "stone") ?? "ember";
    const id = typeof g.userData.id === "number" ? g.userData.id : undefined;
    const fig = buildPawn(g, team, id, g.userData.look ?? g.userData.lookId ?? g.userData.skin);
    g.userData.body = fig.body;
    g.userData.cloth = fig.cloth;
  }
}

bindAdmin({
  match,
  onAdd: (team) => {
    net.sendEvent({ kind: "addBot", team });
  },
  onRemove: (team) => {
    net.sendEvent({ kind: "removeBot", team });
  },
  onRestart: () => net.sendEvent({ kind: "restart" }),
  onKick: (slot) => {
    if (slot.id === playerId) return;
    net.sendEvent({ kind: "kick", slotId: slot.id, playerKey: slot.playerKey });
  },
  onBan: (slot) => {
    if (slot.id === playerId) return;
    net.sendEvent({ kind: "ban", slotId: slot.id, playerKey: slot.playerKey });
  },
  onCow: (slot) => {
    if (net.role !== "client") applyCow(slot);
    net.sendEvent({ kind: "cow", slotId: slot.id });
  },
  onPawnStyle: (classic) => {
    rules.classicPawn = classic;
    pawnStyle.current = classic ? "classic" : "limbs";
    rebuildPawns();
  },
  onRules: () => {
    net.sendEvent({
      kind: "rules",
      highlights: rules.highlights,
      friendlyFire: rules.friendlyFire,
      oneShot: rules.oneShot,
      botSkill: rules.botSkill,
    });
  },
});

bindIdentity({
  onChange() {
    setNetName(prefs.name);
    setNetSkin(prefs.skin);
    setNetLook(accountLook() || packLook(prefs.look));
    setNetPlayerKey(accountKey() || prefs.playerKey);
    paintLocker();
  },
  onRegistered() {
    enterLocker();
  },
});

{
  const titleEl = document.querySelector<HTMLInputElement>("#studio-title")!;
  const themeEl = document.querySelector<HTMLSelectElement>("#studio-theme")!;
  titleEl.addEventListener("input", () => {
    studio.spec.title = titleEl.value.slice(0, 24) || "Draft";
    persistSpec(studio.spec);
    fillStudioLists();
  });
  themeEl.addEventListener("change", () => {
    studio.spec.theme = themeEl.value as typeof studio.spec.theme;
    persistSpec(studio.spec);
    if (studio.on) rebuildStudio();
  });
  document.querySelector("#studio-map")?.addEventListener("change", (e) => {
    const id = (e.currentTarget as HTMLSelectElement).value;
    if (id) studioSwitchMap(id);
  });
  document.querySelector("#studio-versions")?.addEventListener("change", (e) => {
    const v = (e.currentTarget as HTMLSelectElement).value;
    if (v === "") return;
    studioRevert(Number(v));
  });
  document.querySelector("#studio-new")?.addEventListener("click", (e) => {
    e.stopPropagation();
    studioNewMap();
  });
  document.querySelector("#studio-undo")?.addEventListener("click", (e) => {
    e.stopPropagation();
    studioUndo();
  });
  document.querySelector("#studio-redo")?.addEventListener("click", (e) => {
    e.stopPropagation();
    studioRedo();
  });
  document.querySelector("#home-studio")?.addEventListener("click", (e) => {
    e.stopPropagation();
    enterStudio();
  });
  document.querySelector("#home-locker")?.addEventListener("click", (e) => {
    e.stopPropagation();
    enterLocker();
  });
  document.querySelector("#locker-back")?.addEventListener("click", (e) => {
    e.stopPropagation();
    leaveLocker();
  });
  document.querySelector("#locker-name")?.addEventListener("input", (e) => {
    const el = e.currentTarget as HTMLInputElement;
    prefs.name = el.value.slice(0, 18);
    const you = humanSlot(match);
    if (you) you.name = displayName(prefs.name);
    setNetName(prefs.name);
    savePrefs();
    const setName = document.querySelector<HTMLInputElement>("#set-name");
    if (setName) setName.value = prefs.name;
  });
  document.querySelector("#locker-sides")?.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement | null)?.closest("button");
    const side = b?.dataset.side;
    if (side !== "ember" && side !== "stone") return;
    e.stopPropagation();
    locker.team = side;
    dressLockerPawn();
    paintLocker();
  });
  document.querySelector("#locker")?.addEventListener("mousedown", (e) => e.stopPropagation());
  document.querySelector("#studio-turn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    studio.faceYaw = turnYaw(studio.faceYaw);
    const status = document.querySelector("#studio-status");
    if (status) status.textContent = "turned";
  });
  document.querySelector("#studio-save")?.addEventListener("click", (e) => {
    e.stopPropagation();
    studioSave();
  });
  document.querySelector("#studio-export")?.addEventListener("click", (e) => {
    e.stopPropagation();
    void saveStudio();
  });
  document.querySelector("#studio-play")?.addEventListener("click", (e) => {
    e.stopPropagation();
    playStudio();
  });
  document.querySelector("#studio-return")?.addEventListener("click", (e) => {
    e.stopPropagation();
    returnToStudio();
  });
  document.querySelector("#studio-storeys-sub")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const i = studioBuildingIndex(studio.sels);
    if (i >= 0) studioApply(bumpBuildingStoreys(studio.spec, i, -1));
  });
  document.querySelector("#studio-storeys-add")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const i = studioBuildingIndex(studio.sels);
    if (i >= 0) studioApply(bumpBuildingStoreys(studio.spec, i, 1));
  });
  document.querySelector("#studio-interior-floors")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const i = studioBuildingIndex(studio.sels);
    if (i >= 0) studioApply(setBuildingInterior(studio.spec, i, "floors"));
  });
  document.querySelector("#studio-interior-empty")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const i = studioBuildingIndex(studio.sels);
    if (i >= 0) studioApply(setBuildingInterior(studio.spec, i, "empty"));
  });
  document.querySelector("#studio-area-name")?.addEventListener("input", (e) => {
    const el = e.currentTarget as HTMLInputElement;
    const i = studioAreaIndex(studio.sels);
    if (i < 0) return;
    persistSpec(setAreaName(studio.spec, i, el.value));
    refreshStudioGizmos();
  });
  document.querySelector("#studio-leave")?.addEventListener("click", (e) => {
    e.stopPropagation();
    leaveStudio();
  });
  document.querySelector("#studio-walk")?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (studio.walk) leaveWalk();
    else enterWalk();
  });
  document.querySelector<HTMLButtonElement>("#studio-peg")?.addEventListener("mousedown", (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (studio.walk) return;
    studio.mx = e.clientX;
    studio.my = e.clientY;
    studio.drag = { mode: "peg", x0: 0, z0: 0, x1: 0, z1: 0, y: 0 };
    studio.painting = true;
    document.body.classList.add("studio-peg");
    const hit = studioHit();
    if (hit) {
      studioPeg.visible = true;
      studioPeg.position.set(hit.x, interiorYAt(studio.spec, hit.x, hit.z) + 0.02, hit.z);
    }
  });
  document.querySelector("#studio-server")?.addEventListener("click", (e) => {
    e.stopPropagation();
    void sendStudioToServer();
  });
  document.querySelector("#studio-delete")?.addEventListener("click", (e) => {
    e.stopPropagation();
    deleteStudioSel();
  });
  document.querySelector("#studio-pal-hand")?.addEventListener("click", (e) => {
    e.stopPropagation();
    setStudioTool("select");
  });
  document.querySelector("#studio-pal-build")?.addEventListener("click", (e) => {
    e.stopPropagation();
    setStudioTool(BUILD_IDS.includes(studio.tool) ? studio.tool : studio.walk ? "floor" : "building");
  });
  document.querySelector("#studio-pal-kit")?.addEventListener("click", (e) => {
    e.stopPropagation();
    setStudioTool(KIT_IDS.includes(studio.tool) ? studio.tool : studio.lastKit);
  });
  document.querySelector("#studio")?.addEventListener("mousedown", (e) => {
    if ((e.target as HTMLElement | null)?.closest("#studio-peg")) return;
    e.stopPropagation();
  });
}

const camera = new THREE.PerspectiveCamera(90, innerWidth / innerHeight, 0.05, 85);
camera.rotation.order = "YXZ";
scene.add(camera);

const kar = makeKar98();
const mosin = makeMosin();
camera.add(kar.root, mosin.root);
mosin.root.visible = false;

function liveRifle() {
  return rifleKind === "mosin" ? mosin : kar;
}

function showRifle(kind: RifleId, on: boolean) {
  kar.root.visible = on && kind === "kar";
  mosin.root.visible = on && kind === "mosin";
}

const karGlassEl = document.querySelector<HTMLElement>("#kar-glass");

function adsZoomK(kind: RifleId, currentFov: number) {
  const z = RIFLES[kind].adsFov;
  return THREE.MathUtils.clamp((90 - currentFov) / Math.max(1, 90 - z), 0, 1);
}

function setKarGlass(kind: RifleId, aiming: boolean, zoom: number) {
  if (!karGlassEl) return;
  const on = aiming && RIFLES[kind].glass && zoom > 0.04;
  karGlassEl.style.opacity = on ? String(Math.min(1, (zoom - 0.04) / 0.7)) : "0";
}

function glassHidesRifle(kind: RifleId, aiming: boolean, zoom: number) {
  return aiming && RIFLES[kind].glass && zoom > 0.7;
}

let knife = makeMelee(prefs.look.melee);
knife.visible = false;
poseKnifeRest(knife);
camera.add(knife);

function refreshMeleeView() {
  const on = knife.visible;
  const parent = knife.parent;
  parent?.remove(knife);
  knife.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    obj.geometry.dispose();
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) m.dispose();
  });
  knife = makeMelee(prefs.look.melee);
  knife.visible = on;
  (parent ?? camera).add(knife);
  if (knife.visible) poseKnifeRest(knife);
}

const nadeView = new THREE.Group();
const nadeBody = new THREE.Mesh(
  new THREE.CylinderGeometry(0.045, 0.05, 0.13, 8),
  new THREE.MeshStandardMaterial({ color: 0x3a4a32, roughness: 0.55, metalness: 0.2 }),
);
nadeView.add(nadeBody);
nadeView.position.set(0.18, -0.2, -0.2);
nadeView.visible = false;
camera.add(nadeView);

const arm = makeRightArm();
camera.add(arm.root);

const bomb = makeBomb();
const wirePack = bomb.root;
scene.add(wirePack);

let seenRound = 1;

const decals: THREE.Mesh[] = [];
const tracers: { line: THREE.Line; t: number }[] = [];
const sparks: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[] = [];

const keys = new Set<string>();
let locked = false;
let yaw = -Math.PI / 2;
let pitch = 0;
let px = world.playerSpawn.x;
let py = 0;
let pz = world.playerSpawn.z;
let vy = 0;
let grounded = true;
let crouch = false;
let prone = false;
let diveT = 0;
let diveVx = 0;
let diveVz = 0;
let ads = false;
let leanInput = 0;
let lean = 0;
let mag = 5;
let reloading = 0;
let lastFire = -10;
let hp = HP_MAX;
let alive = true;
let deadAt = 0;
let kills = 0;
let deaths = 0;
let lastDamage = "No damage taken";
let killedBy = "";
let spawnProtectUntil = 0;
let fov = 90;
let punchP = 0;
let punchY = 0;
let punchR = 0;
let gunKickZ = 0;
let flashUntil = 0;
let lastHit = "—";
let time = 0;
let mouseDown = false;
const fireQ = emptyQueue();
let jumpHeld = false;
let plantBroke = false;
let nadeBag: Record<NadeKind, number> = { ...NADE_MAX };
let nadeKind: NadeKind = "smoke";
let lastThrow = -10;
type Weapon = "rifle" | "knife" | NadeKind;
let weapon: Weapon = "rifle";
let rifleKind: RifleId = "kar";
let bashT = 0;
let boltT = 0;
let boltDur = RIFLES.kar.cycle;
let throwT = 0;
let throwDur = 0.4;
let throwDrop = false;
let flashT = 0;
let stunT = 0;
let lastMelee = -10;
let walking = false;
let hipSpread = 0;
let lastLeanM = 0;
let lastReelAds = false;
let blastFlash = 0;
let smokeHeld = false;
let smokeCharge = 0;
let botCutting = false;
const blasts: { mesh: THREE.Mesh; light: THREE.PointLight; t: number }[] = [];

const raycaster = new THREE.Raycaster();
let audio: AudioContext | null = null;

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

function overlayOpen() {
  return (
    document.body.classList.contains("admin") ||
    document.body.classList.contains("settings") ||
    document.body.classList.contains("podium") ||
    document.body.classList.contains("studio") ||
    document.body.classList.contains("locker")
  );
}

function inMatch() {
  return document.body.classList.contains("started") && !studio.on && !locker.on;
}

function lock() {
  if (overlayOpen()) return;
  canvas.requestPointerLock();
}
document.querySelector("#join-status")?.addEventListener("click", (e) => {
  if (net.status === "connecting") e.stopPropagation();
});
{
  const list = document.querySelector("#server-list")!;
  list.addEventListener("click", (e) => e.stopPropagation());
  const paintServers = async () => {
    if (net.status === "connecting") {
      paintJoin();
      return;
    }
    const servers = await fetchServers();
    list.replaceChildren();
    if (!servers.length) {
      const p = document.createElement("p");
      p.className = "server-empty";
      p.textContent = "No servers · start the game process";
      list.append(p);
      return;
    }
    for (const s of servers) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "server-row";
      if (!s.online) {
        row.disabled = true;
        row.dataset.offline = "1";
      }
      const name = document.createElement("span");
      name.className = "s-name";
      name.textContent = s.name;
      const map = document.createElement("span");
      map.className = "s-map";
      map.textContent = s.mapTitle;
      const pop = document.createElement("span");
      pop.className = "s-pop";
      pop.textContent = `${s.players}/${s.max}`;
      const phase = document.createElement("span");
      phase.className = "s-phase";
      phase.textContent = s.online ? s.phase : "offline";
      const join = document.createElement("span");
      join.className = "s-join";
      join.textContent = s.online ? "Join" : "Offline";
      row.append(name, map, pop, phase, join);
      row.addEventListener("click", (ev) => {
        ev.stopPropagation();
        joinGame(s.name);
      });
      list.append(row);
    }
    paintJoin();
  };
  void paintServers();
  refreshServers = paintServers;
  window.setInterval(() => {
    void paintServers();
  }, 2000);

  const fillTeams = (root: Element, onPick?: (team: Team) => void) => {
    root.addEventListener("click", (e) => e.stopPropagation());
    const sides = root.id === "join-team-pick";
    for (const [id, label] of [
      ["ember", "Ember"],
      ["stone", "Stone"],
    ] as const) {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.team = id;
      if (sides) {
        b.className = "team-side";
        const fig = document.createElement("span");
        fig.className = "team-fig";
        fig.setAttribute("aria-hidden", "true");
        const name = document.createElement("span");
        name.className = "team-name";
        name.textContent = label;
        b.append(fig, name);
      } else {
        b.textContent = label;
      }
      b.addEventListener("click", () => (onPick ? onPick(id) : pickTeam(id)));
      root.append(b);
    }
  };
  fillTeams(document.querySelector("#join-team-pick")!, (team) => {
    pickTeam(team);
    enterPlay();
    hideJoinTeam();
  });
  const setTeam = document.querySelector("#set-team");
  if (setTeam) fillTeams(setTeam);
  document.querySelector("#join-cancel")?.addEventListener("click", (e) => {
    e.stopPropagation();
    leaveToLobby();
  });
  const adminMap = document.querySelector<HTMLSelectElement>("#admin-map")!;
  adminMap.addEventListener("change", () => {
    void sendAdminMap(adminMap.value);
  });
  fillAdminMaps();
  paintMapPick();
}
canvas.addEventListener("click", () => {
  if (match.phase === "bestplay") return;
  if (overlayOpen()) return;
  if (!locked) lock();
});
document.querySelector("#open-settings")!.addEventListener("click", (e) => {
  e.stopPropagation();
  document.body.classList.add("settings");
  document.exitPointerLock();
});
{
  const panel = document.querySelector<HTMLElement>("#settings")!;
  const nameEl = document.querySelector<HTMLInputElement>("#set-name")!;
  const sensEl = document.querySelector<HTMLInputElement>("#set-sens")!;
  const sensV = document.querySelector("#set-sens-v")!;
  const volEl = document.querySelector<HTMLInputElement>("#set-vol")!;
  const volV = document.querySelector("#set-vol-v")!;
  const paint = () => {
    nameEl.value = prefs.name;
    sensEl.value = String(prefs.sens);
    sensV.textContent = prefs.sens.toFixed(2);
    volEl.value = String(prefs.volume);
    volV.textContent = `${Math.round(prefs.volume * 100)}%`;
  };
  paint();
  nameEl.addEventListener("input", () => {
    prefs.name = nameEl.value.slice(0, 18);
    const you = humanSlot(match);
    if (you) you.name = displayName(prefs.name);
    setNetName(prefs.name);
    savePrefs();
    const lockerName = document.querySelector<HTMLInputElement>("#locker-name");
    if (lockerName) lockerName.value = prefs.name;
  });
  sensEl.addEventListener("input", () => {
    prefs.sens = Number(sensEl.value);
    savePrefs();
    paint();
  });
  volEl.addEventListener("input", () => {
    prefs.volume = Number(volEl.value);
    setStepVolume(prefs.volume);
    savePrefs();
    paint();
  });
  setStepVolume(prefs.volume);
  bindCrosshairSettings(prefs, savePrefs);
  panel.addEventListener("mousedown", (e) => e.stopPropagation());
}
addEventListener("contextmenu", (e) => {
  if (studio.on || locker.on) e.preventDefault();
});
document.addEventListener("pointerlockchange", () => {
  locked = document.pointerLockElement === canvas;
  document.body.classList.toggle("started", locked || document.body.classList.contains("started"));
  document.body.classList.toggle("playing", locked);
  if (locked) document.body.classList.add("started");
  if (!locked) {
    ads = false;
    leanInput = 0;
    mouseDown = false;
    clearFire(fireQ);
    smokeHeld = false;
    smokeCharge = 0;
    keys.clear();
  }
});

addEventListener("keydown", (e) => {
  if ((e.target as HTMLElement | null)?.closest("input, textarea, select")) {
    if (e.code === "Escape") {
      document.body.classList.remove("settings");
      (e.target as HTMLElement).blur();
    }
    return;
  }
  if (["Space", "KeyW", "KeyA", "KeyS", "KeyD"].includes(e.code)) e.preventDefault();
  if (e.code === "Tab" || e.key === "Tab") {
    const inMatch =
      document.body.classList.contains("started") &&
      !locker.on &&
      !studio.on &&
      !document.body.classList.contains("settings");
    if (inMatch) e.preventDefault();
  }
  if (e.code === "Space" && match.phase === "bestplay") {
    trySkipReel();
    return;
  }
  keys.add(e.code);
  if (locker.on) {
    if (e.code === "Escape") leaveLocker();
    const slot = LOOK_SLOTS.find((s) => s.key === locker.slot) ?? LOOK_SLOTS[0]!;
    const n = e.code === "Digit0" || e.code === "Numpad0" ? 9
      : e.code === "Digit1" || e.code === "Numpad1" ? 0
      : e.code === "Digit2" || e.code === "Numpad2" ? 1
      : e.code === "Digit3" || e.code === "Numpad3" ? 2
      : e.code === "Digit4" || e.code === "Numpad4" ? 3
      : e.code === "Digit5" || e.code === "Numpad5" ? 4
      : e.code === "Digit6" || e.code === "Numpad6" ? 5
      : e.code === "Digit7" || e.code === "Numpad7" ? 6
      : e.code === "Digit8" || e.code === "Numpad8" ? 7
      : e.code === "Digit9" || e.code === "Numpad9" ? 8
      : locker.slot === "melee" && e.code === "KeyB" ? 10
      : -1;
    const pick = n >= 0 ? slot.options[n] : undefined;
    if (pick) {
      prefs.look = applyLookChoice(prefs.look, slot.key, pick.id);
      commitLook();
      dressLockerPawn();
      paintLocker();
    }
    return;
  }
  if (studio.on) {
    if ((e.metaKey || e.ctrlKey) && e.code === "KeyZ") {
      e.preventDefault();
      if (e.shiftKey) studioRedo();
      else studioUndo();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.code === "KeyY") {
      e.preventDefault();
      studioRedo();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.code === "KeyS") {
      e.preventDefault();
      studioSave();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.code === "KeyA") {
      e.preventDefault();
      studio.sels = allItems(studio.spec);
      rebuildStudio();
      paintStudio();
      return;
    }
    const moveKeys = studio.walk && ["KeyW", "KeyA", "KeyS", "KeyD", "KeyC", "Space", "KeyF"].includes(e.code);
    const tool = moveKeys || e.metaKey || e.ctrlKey ? null : toolFromCode(e.code, studio.palette);
    if (tool) setStudioTool(tool);
    if (e.code === "KeyR" && !e.repeat) {
      studio.faceYaw = turnYaw(studio.faceYaw);
      const status = document.querySelector("#studio-status");
      if (status) status.textContent = "turned";
    }
    if (e.code === "KeyP" && !e.repeat) {
      if (studio.walk) leaveWalk();
      else enterWalk();
    }
    if (e.code === "Delete" || e.code === "Backspace") {
      deleteStudioSel();
    }
    if (e.code === "Escape") {
      if (studio.sels.length) {
        studio.sels = [];
        rebuildStudio();
        paintStudio();
      } else if (studio.walk) leaveWalk();
      else leaveStudio();
    }
    return;
  }
  if (e.code === "KeyR" && locked) startReload();
  if (e.code === "KeyG" && locked && !e.repeat) tryThrowSmoke();
  if (e.code === "KeyJ" && locked && !e.repeat) tryJoin();
  if (e.code === "Digit1" || e.code === "Numpad1") {
    weapon = "rifle";
    rifleKind = "kar";
  }
  if (e.code === "Digit2" || e.code === "Numpad2") {
    weapon = "rifle";
    rifleKind = "mosin";
  }
  if (e.code === "Digit3" || e.code === "Numpad3") weapon = "knife";
  if (e.code === "Digit4" || e.code === "Numpad4") selectNade();
  if (e.code === "KeyV" && locked && !e.repeat) tryBash();
  if ((e.code === "ControlLeft" || e.code === "ControlRight") && locked && !e.repeat) tryProne();
  if (e.code === "KeyE" && locked && !e.repeat && !alive) {
    tryTakeover();
    return;
  }
  if (e.code === "Escape") {
    if (studio.playing) {
      returnToStudio();
      return;
    }
    if (document.body.classList.contains("settings")) {
      document.body.classList.remove("settings");
      return;
    }
    if (locked) document.exitPointerLock();
    else if (!document.body.classList.contains("admin")) document.body.classList.add("settings");
  }
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("auxclick", (e) => {
  if (studio.on && e.button === 1) e.preventDefault();
});
addEventListener("mousedown", (e) => {
  if ((e.target as HTMLElement | null)?.closest("#studio-return")) return;
  if (locker.on) {
    if ((e.target as HTMLElement | null)?.closest("#start, #settings, #open-settings")) return;
    e.preventDefault();
    locker.dragging = true;
    document.body.classList.add("locker-drag");
    return;
  }
  if (studio.on) {
    if ((e.target as HTMLElement | null)?.closest("#studio")) return;
    e.preventDefault();
    studio.mx = e.clientX;
    studio.my = e.clientY;
    if (studio.walk) {
      if (!locked) {
        canvas.requestPointerLock();
        return;
      }
      if (e.button === 0 && walkKeepsTool(studio.tool)) stampWalkAccessory();
      return;
    }
    if (e.button === 0) {
      studio.lastCell = "";
      const hit = studioHit();
      if (!hit) return;
      const gx = snap(hit.x);
      const gz = snap(hit.z);
      const shift = e.shiftKey;
      const ptr = pickStudioHit(studio.spec, hit.x, hit.z, studio.sels);
      const grabHandles = studio.tool === "select" && (ptr.type === "lot" || ptr.type === "resize");
      if (grabHandles) {
        studio.base = cloneSpec(studio.spec);
        studio.drag = {
          mode: ptr.type === "lot" ? "lot" : "resize",
          x0: hit.x,
          z0: hit.z,
          x1: hit.x,
          z1: hit.z,
          y: 0,
          handle: ptr.type === "lot" ? ptr.handle : ptr.handle,
          item: ptr.type === "resize" ? ptr.item : undefined,
        };
        studio.painting = true;
        document.body.classList.add("studio-grab");
        return;
      }
      if (studio.tool === "select") {
        if (ptr.type === "item") {
          if (shift) {
            studio.sels = inSelection(studio.sels, ptr.item)
              ? studio.sels.filter((s) => !sameItem(s, ptr.item))
              : [...studio.sels, ptr.item];
          } else if (!inSelection(studio.sels, ptr.item)) {
            studio.sels = [ptr.item];
          }
          const pos = itemBox(studio.spec, ptr.item);
          studio.base = cloneSpec(studio.spec);
          studio.drag = {
            mode: "move",
            x0: hit.x,
            z0: hit.z,
            x1: hit.x,
            z1: hit.z,
            y: 0,
            item: ptr.item,
            ox: pos?.x ?? hit.x,
            oz: pos?.z ?? hit.z,
          };
          studio.painting = true;
        } else {
          if (!shift) studio.sels = [];
          studio.drag = { mode: "marquee", x0: gx, z0: gz, x1: gx, z1: gz, y: 0 };
          studio.painting = true;
        }
        rebuildStudio();
        paintStudio();
        document.body.classList.toggle("studio-grab", ptr.type === "item");
        return;
      }
      if (isOpeningTool(studio.tool)) {
        stampOpening();
        return;
      }
      if (isRectTool(studio.tool)) {
        studio.base = cloneSpec(studio.spec);
        const y0 = studio.tool === "wall" ? interiorYAt(studio.spec, hit.x, hit.z) : surfaceAt(studio.spec, gx, gz);
        studio.drag = { mode: "rect", x0: hit.x, z0: hit.z, x1: hit.x, z1: hit.z, y: y0 };
        studio.painting = true;
        return;
      }
      studio.painting = true;
      stampStudio();
    }
    if (e.button === 2) studio.orbiting = true;
    if (e.button === 1) studio.panning = true;
    document.body.classList.toggle("studio-nav", studio.orbiting || studio.panning);
    return;
  }
  if (!locked) return;
  if (!alive) {
    if (e.button === 0 || e.button === 2) cycleSpec(e.button === 2 ? -1 : 1);
    return;
  }
  if (e.button === 0) {
    if (weapon === "rifle") {
      mouseDown = true;
      pressFire(fireQ);
      tryFire();
    } else if (weapon === "knife") tryMelee(false);
    else if (isNade(weapon)) {
      smokeHeld = true;
      smokeCharge = 0;
    }
  }
  if (e.button === 2) {
    if (isNade(weapon)) tryDropSmoke();
    else ads = true;
  }
});
addEventListener("mouseup", (e) => {
  if (locker.on && e.button === 0) {
    locker.dragging = false;
    document.body.classList.remove("locker-drag");
  }
  if (studio.on) {
    if (e.button === 0) finishStudioDrag();
    if (e.button === 2) studio.orbiting = false;
    if (e.button === 1) studio.panning = false;
    document.body.classList.toggle("studio-nav", studio.orbiting || studio.panning);
    document.body.classList.toggle("studio-pan", studio.panning);
    document.body.classList.toggle("studio-grab", studio.tool === "select" && (studio.drag?.mode === "move" || studio.drag?.mode === "resize"));
  }
  if (e.button === 0) {
    mouseDown = false;
    releaseFire(fireQ);
    if (reloading > 0) fireQ.queued = false;
    if (isNade(weapon) && smokeHeld) releaseSmoke();
    smokeHeld = false;
  }
  if (e.button === 2) ads = false;
});
addEventListener("wheel", (e) => {
  if (locker.on) {
    if ((e.target as HTMLElement | null)?.closest("#start, #settings")) return;
    e.preventDefault();
    const k = e.deltaY > 0 ? 1.08 : 1 / 1.08;
    const portrait = lookView(locker.slot) === "portrait";
    locker.zoom = Math.max(portrait ? 0.72 : 0.75, Math.min(portrait ? 1.55 : 1.85, locker.zoom * k));
    return;
  }
  if (studio.on) {
    if ((e.target as HTMLElement | null)?.closest("#studio")) return;
    if (studio.walk) return;
    e.preventDefault();
    const { minX, maxX, minZ, maxZ } = studio.spec.bounds;
    zoomOrbit(studio.cam, e.deltaY, Math.max(180, Math.hypot(maxX - minX, maxZ - minZ) * 1.6));
    return;
  }
  if (!locked || alive) return;
  cycleSpec(e.deltaY > 0 ? 1 : -1);
}, { passive: false });
addEventListener("mousemove", (e) => {
  if (locker.on) {
    if (locker.dragging) {
      locker.phi -= e.movementX * 0.008;
      locker.theta = Math.max(0.12, Math.min(1.2, locker.theta - e.movementY * 0.008));
    }
    return;
  }
  if (studio.on) {
    studio.mx = e.clientX;
    studio.my = e.clientY;
    if (studio.walk && locked) {
      yaw -= e.movementX * MOUSE * prefs.sens;
      pitch -= e.movementY * MOUSE * prefs.sens;
      pitch = Math.max(-1.4, Math.min(1.4, pitch));
      return;
    }
    if (studio.orbiting) orbitDrag(studio.cam, e.movementX, e.movementY);
    else if (studio.panning) panDrag(studio.cam, e.movementX, e.movementY);
    else if (studio.drag && studio.painting) {
      const hit = studioHit();
      if (hit) {
        const gx = snap(hit.x);
        const gz = snap(hit.z);
        studio.drag.x1 = gx;
        studio.drag.z1 = gz;
        if (studio.drag.mode === "lot" && studio.drag.handle && studio.base) {
          const next = setLotHandle(studio.base, studio.drag.handle, hit.x, hit.z);
          if (next !== studio.spec) {
            studio.spec = next;
            refreshStudioGizmos(true);
          }
        } else if (studio.drag.mode === "resize" && studio.drag.item && studio.drag.handle && studio.base) {
          const next = resizeItem(studio.base, studio.drag.item, studio.drag.handle, hit.x, hit.z);
          if (next !== studio.spec) {
            studio.spec = next;
            refreshStudioGizmos();
          }
        } else if (studio.drag.mode === "move" && studio.base) {
          const dx = hit.x - studio.drag.x0;
          const dz = hit.z - studio.drag.z0;
          const next = moveItems(studio.base, studio.sels.length ? studio.sels : studio.drag.item ? [studio.drag.item] : [], dx, dz);
          if (next !== studio.spec) {
            studio.spec = next;
            refreshStudioGizmos();
          }
        } else if (studio.drag.mode === "peg") {
          studio.drag.x1 = hit.x;
          studio.drag.z1 = hit.z;
          studioPeg.visible = true;
          studioPeg.position.set(hit.x, interiorYAt(studio.spec, hit.x, hit.z) + 0.02, hit.z);
        }
      }
    } else if (studio.painting) stampStudio();
    return;
  }
  if (!locked || !alive) return;
  const adsScale = ads ? RIFLES[rifleKind].adsSens : 1;
  const scale = adsScale * MOUSE * prefs.sens * (stunT > 0 ? 0.28 : 1);
  yaw -= e.movementX * scale;
  pitch -= e.movementY * scale;
  pitch = Math.max(-1.4, Math.min(1.4, pitch));
});

function part(
  parent: THREE.Group,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  mat: THREE.Material,
) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
  m.position.set(x, y, z);
  parent.add(m);
}

function makeStandIn() {
  const root = new THREE.Group();
  root.visible = false;
  const fig = buildPawn(root, "ember", playerId, prefs.look);
  root.userData.body = fig.body;
  root.userData.cloth = fig.cloth;
  return root;
}

function tryJoin() {
  const you = slotById(match, playerId);
  if (!you) return;
  const other = you.team === "ember" ? "stone" : "ember";
  const seat = claimSlot(match, other, "Guest");
  if (seat) match.lastJoin = `Guest joined ${other === "ember" ? "Ember" : "Stone"} and took a bot’s seat`;
}

function startReload() {
  if (!alive || reloading > 0 || mag === magCap()) return;
  reloading = RELOAD;
}

function magCap() {
  return RIFLES[rifleKind].mag;
}

function isNade(w: string): w is NadeKind {
  return w === "smoke" || w === "frag" || w === "stun" || w === "flash";
}

function paintNadeView() {
  (nadeBody.material as THREE.MeshStandardMaterial).color.set(nadeColor(nadeKind));
}

function selectNade() {
  if (!isNade(weapon)) {
    const have = nadeBag[nadeKind] > 0 ? nadeKind : NADE_ORDER.find((k) => nadeBag[k] > 0);
    if (!have) return;
    nadeKind = have;
    weapon = have;
    paintNadeView();
    return;
  }
  cycleNade();
}

function cycleNade() {
  if (!isNade(weapon) && nadeBag[nadeKind] > 0) {
    weapon = nadeKind;
    paintNadeView();
    return;
  }
  const start = NADE_ORDER.indexOf(nadeKind);
  for (let i = 1; i <= NADE_ORDER.length; i++) {
    const next = NADE_ORDER[(start + i) % NADE_ORDER.length]!;
    if (nadeBag[next] > 0) {
      nadeKind = next;
      weapon = next;
      paintNadeView();
      return;
    }
  }
}

function smokeOrigin() {
  camera.updateMatrixWorld();
  const origin = new THREE.Vector3();
  const dir = new THREE.Vector3();
  camera.getWorldPosition(origin);
  camera.getWorldDirection(dir);
  origin.addScaledVector(dir, 0.45);
  origin.y -= 0.12;
  return { origin, dir };
}

function tryThrowSmoke(power = 0.55) {
  if (!alive || !locked || isCow(playerId)) return;
  if (!roundCombatOpen(match.phase)) return;
  if (nadeBag[nadeKind] <= 0 || time - lastThrow < 0.45) return;
  lastThrow = time;
  nadeBag[nadeKind] -= 1;
  const kind = nadeKind;
  const { origin, dir } = smokeOrigin();
  if (net.role === "client") {
    net.sendEvent({
      kind: "throwSmoke",
      ox: origin.x,
      oy: origin.y,
      oz: origin.z,
      dx: dir.x,
      dy: dir.y,
      dz: dir.z,
      power,
      nade: kind,
    });
  } else {
    throwSmoke(scene, origin, dir, power, kind);
  }
  liveRifle().root.position.z += 0.02;
  bang(90, 0.07, 0.04);
  throwDrop = false;
  throwDur = 0.4;
  throwT = 0.4;
  if (isNade(weapon) && nadeBag[nadeKind] <= 0) {
    const next = NADE_ORDER.find((k) => nadeBag[k] > 0);
    if (next) {
      nadeKind = next;
      weapon = next;
      paintNadeView();
    } else weapon = "rifle";
  }
}

function tryDropSmoke() {
  smokeHeld = false;
  smokeCharge = 0;
  if (!alive || !locked || isCow(playerId)) return;
  if (!roundCombatOpen(match.phase)) return;
  if (nadeBag[nadeKind] <= 0 || time - lastThrow < 0.45) return;
  lastThrow = time;
  nadeBag[nadeKind] -= 1;
  const kind = nadeKind;
  const { origin } = smokeOrigin();
  origin.y -= 0.35;
  if (net.role === "client") {
    net.sendEvent({
      kind: "throwSmoke",
      ox: origin.x,
      oy: origin.y,
      oz: origin.z,
      dx: 0,
      dy: -1,
      dz: 0,
      power: 0,
      nade: kind,
    });
  } else {
    dropSmoke(scene, origin, kind);
  }
  bang(70, 0.05, 0.03);
  throwDrop = true;
  throwDur = 0.24;
  throwT = 0.24;
  if (isNade(weapon) && nadeBag[nadeKind] <= 0) {
    const next = NADE_ORDER.find((k) => nadeBag[k] > 0);
    if (next) {
      nadeKind = next;
      weapon = next;
      paintNadeView();
    } else weapon = "rifle";
  }
}

function releaseSmoke() {
  const power = Math.max(0.12, Math.min(1, smokeCharge));
  smokeCharge = 0;
  smokeHeld = false;
  tryThrowSmoke(power);
}

function hipCone() {
  if (weapon === "rifle" && (ads || !grounded)) return 0;
  let s = tuning.hipStand;
  if (prone) s *= 0.45;
  else if (crouch) s *= 0.72;
  if (walking) s += tuning.hipMove;
  return s;
}

function spreadPx(s: number) {
  const fovRad = THREE.MathUtils.degToRad(camera.fov);
  return s * (innerHeight / (2 * Math.tan(fovRad / 2))) * 2;
}

function spreadDir(dir: THREE.Vector3) {
  const s = hipCone();
  hipSpread = s;
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();
  const a = Math.random() * Math.PI * 2;
  const r = s * Math.sqrt(Math.random());
  dir.addScaledVector(right, Math.cos(a) * r);
  dir.addScaledVector(up, Math.sin(a) * r);
  return dir.normalize();
}

function tryBash() {
  if (isNade(weapon)) return;
  tryMelee(weapon === "rifle");
}

function eyeOff() {
  if (!alive) return 0.42;
  if (prone) return 0.28;
  if (crouch) return 1.1;
  return 1.64;
}

function bodyH() {
  if (prone) return 0.5;
  if (crouch) return 1.2;
  return 1.78;
}

function chestOff() {
  if (prone) return 0.2;
  if (crouch) return 0.7;
  return 1.05;
}

function skipAi() {
  const ids: number[] = [];
  if (possessId != null) ids.push(possessId);
  return ids;
}

function liveRemotes(): LiveBody[] {
  return [...remotes.values()].map((r) => ({
    id: r.slotId,
    team: r.team,
    x: r.x,
    y: r.y,
    z: r.z,
    alive: r.alive,
  }));
}

function crouchIds() {
  const ids: number[] = [];
  for (const r of remotes.values()) if (r.crouch) ids.push(r.slotId);
  if (crouch) ids.push(actorId());
  return ids;
}

function hurtRemote(r: Remote, dmg: number, killerId: number) {
  if (!r.alive) return false;
  const amount = rules.oneShot ? Math.max(dmg, 200) : dmg;
  noteHit(killerId, r.slotId, time);
  r.hp = Math.max(0, r.hp - amount);
  if (r.hp <= 0) {
    r.alive = false;
    r.root.rotation.x = 1.25;
    markDead(match, r.slotId, r.x, r.y, r.z);
    frag(killerId, r.slotId, r.name, r.x, r.y, r.z);
    return true;
  }
  return false;
}

function gunDmg(head: boolean) {
  return rules.oneShot ? 200 : head ? 100 : 50;
}

function shotPeople(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  worldHit: { dist: number; point: THREE.Vector3; normal: THREE.Vector3 } | null,
  shooterId: number,
  muzzle: THREE.Vector3,
  opts: { hitmark?: boolean; extra?: LiveBody[]; shooterName?: string } = {},
): boolean {
  const youTeam = slotById(match, shooterId)?.team;
  const skip = rules.friendlyFire ? undefined : youTeam;
  const skipIds = [...skipAi(), shooterId];
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
    const id = meshHit.object.userData.botId as number;
    const head = meshHit.object.userData.part === "head";
    const dmg = gunDmg(head);
    const bot = bots.find((b) => b.id === id);
    if (bot && bot.hp > 0 && (rules.friendlyFire || bot.team !== youTeam)) {
      noteHit(shooterId, bot.id, time);
      const killed = hurtBot(bot, dmg, time);
      if (opts.hitmark) {
        lastHit = head ? "HEADSHOT" : "hit";
        flashHit(head || killed);
        bang(head ? 520 : 280, 0.06, 0.05);
      }
      if (head && killed && Math.random() < HEAD_POP_RATE) {
        popHead(bot, scene);
        bang(70, 0.12, 0.16);
        bang(140, 0.06, 0.1);
      }
      if (killed) frag(shooterId, bot.id, slotById(match, bot.id)?.name ?? "Rifle", bot.x, bot.y, bot.z);
      impact(meshHit.point, meshHit.face?.normal ?? new THREE.Vector3(0, 1, 0), true, head);
      tracer(muzzle, meshHit.point);
      return true;
    }
    const remote = [...remotes.values()].find((x) => x.slotId === id);
    if (remote && remote.alive && (rules.friendlyFire || remote.team !== youTeam)) {
      const killed = hurtRemote(remote, dmg, shooterId);
      if (opts.hitmark) {
        lastHit = head ? "HEADSHOT" : "hit";
        flashHit(head || killed);
        bang(head ? 520 : 280, 0.06, 0.05);
      }
      if (head && killed && Math.random() < HEAD_POP_RATE) {
        popPawnHead(remote.root, scene);
        bang(70, 0.12, 0.16);
        bang(140, 0.06, 0.1);
      }
      impact(meshHit.point, meshHit.face?.normal ?? new THREE.Vector3(0, 1, 0), true, head);
      tracer(muzzle, meshHit.point);
      return true;
    }
  }

  const worldDist = worldHit?.dist ?? Infinity;
  const bodyHit = pickBodyVictim(
    origin,
    dir,
    [...liveRemotes(), ...(opts.extra ?? [])],
    worldDist,
    youTeam,
    rules.friendlyFire,
    skipIds,
    crouchIds(),
  );
  if (!bodyHit) return false;
  if (bodyHit.body.id === actorId()) {
    hurtPlayer(gunDmg(false), opts.shooterName ?? "Rifle", shooterId);
    tracer(muzzle, bodyHit.point);
    return true;
  }
  const remote = [...remotes.values()].find((x) => x.slotId === bodyHit.body.id);
  if (!remote || !remote.alive) return false;
  const killed = hurtRemote(remote, gunDmg(false), shooterId);
  if (opts.hitmark) {
    lastHit = "hit";
    flashHit(killed);
    bang(280, 0.06, 0.05);
  }
  impact(bodyHit.point, new THREE.Vector3(0, 1, 0), true, false);
  tracer(muzzle, bodyHit.point);
  return true;
}

type SpecT = { id: number; name: string; bot: boolean; x: number; y: number; z: number; yaw: number; pitch: number };

function specRoster(): SpecT[] {
  if (net.role === "client" && lastSnap) {
    const me = lastSnap.pawns.find((p) => (p.netId ?? 0) === net.peerId);
    const team = me?.team;
    if (!team) return [];
    const out: SpecT[] = [];
    for (const p of lastSnap.pawns) {
      if (!p.alive || p.team !== team || (p.netId ?? 0) === net.peerId) continue;
      out.push({
        id: p.id,
        name: p.name,
        bot: (p.netId ?? 0) === 0,
        x: p.x,
        y: p.y + 1.52,
        z: p.z,
        yaw: p.yaw,
        pitch: p.pitch,
      });
    }
    return out;
  }
  const team = slotById(match, playerId)?.team;
  if (!team) return [];
  const out: SpecT[] = [];
  for (const b of bots) {
    if (b.hp <= 0 || b.team !== team || b.id === possessId) continue;
    out.push({
      id: b.id,
      name: slotById(match, b.id)?.name ?? "Rifle",
      bot: true,
      x: b.x,
      y: b.y + 1.52,
      z: b.z,
      yaw: b.yaw,
      pitch: b.lookPitch,
    });
  }
  for (const r of remotes.values()) {
    if (!r.alive || r.team !== team) continue;
    out.push({
      id: r.slotId,
      name: r.name,
      bot: false,
      x: r.x,
      y: r.y + (r.crouch ? 1.1 : 1.64),
      z: r.z,
      yaw: r.yaw,
      pitch: r.pitch,
    });
  }
  return out;
}

function specTarget(): SpecT | undefined {
  const list = specRoster();
  if (list.length === 0) return undefined;
  const hit = list.find((s) => s.id === specId);
  if (hit) return hit;
  specId = list[0]!.id;
  return list[0];
}

function cycleSpec(dir: number) {
  const list = specRoster();
  if (list.length === 0) {
    specId = null;
    return;
  }
  const i = Math.max(0, list.findIndex((s) => s.id === specId));
  specId = list[(i + dir + list.length) % list.length]!.id;
}

function tryTakeover() {
  const spec = specTarget();
  if (!spec?.bot) return;
  if (net.role === "client") {
    net.sendEvent({ kind: "takeover", slotId: spec.id });
    return;
  }
  const bot = bots.find((b) => b.id === spec.id);
  const team = slotById(match, playerId)?.team;
  if (!bot || bot.hp <= 0 || bot.team !== team) return;
  possessId = bot.id;
  px = bot.x;
  py = bot.y;
  pz = bot.z;
  yaw = bot.yaw;
  pitch = bot.lookPitch;
  hp = bot.hp;
  mag = magCap();
  alive = true;
  prone = false;
  crouch = false;
  bot.root.visible = false;
  hideDeath();
  setSpec(`On ${spec.name} · their rifle, their score`);
}

function tryProne() {
  if (!alive || !locked || isCow(playerId)) return;
  if (roundFrozen(match.phase)) return;
  if (!grounded) {
    prone = true;
    crouch = false;
    diveT = 0.72;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    diveVx = fx * 8.2;
    diveVz = fz * 8.2;
    if (vy < 0.6) vy += 0.55;
    return;
  }
  prone = !prone;
  if (prone) crouch = false;
}

function tryMelee(bash: boolean) {
  if (!alive || !locked || isCow(playerId)) return;
  if (!roundCombatOpen(match.phase)) return;
  if (time - lastMelee < 0.48) return;
  lastMelee = time;
  bashT = 0.42;
  if (bash) bang(90, 0.08, 0.05);
  else slashSound();

  camera.updateMatrixWorld();
  const origin = new THREE.Vector3();
  const dir = new THREE.Vector3();
  camera.getWorldPosition(origin);
  camera.getWorldDirection(dir);
  const youTeam = slotById(match, actorId())?.team;
  if (net.role === "client") {
    net.sendEvent({
      kind: "melee",
      ox: origin.x,
      oy: origin.y,
      oz: origin.z,
      dx: dir.x,
      dy: dir.y,
      dz: dir.z,
      bash,
    });
    const you = slotById(match, actorId())?.team;
    const bodies: LiveBody[] =
      lastSnap?.pawns
        .filter((p) => (p.netId ?? 0) !== (net.peerId ?? -1))
        .map((p) => ({
          id: p.id,
          team: p.team,
          x: p.x,
          y: p.y,
          z: p.z,
          alive: p.alive,
        })) ?? [];
    const hit = meleeTarget(origin, dir, bodies, meleeReach(), you, rules.friendlyFire, [actorId()]);
    if (hit) {
      lastHit = bash ? "bash" : "knife";
      flashHit(false);
      impact(new THREE.Vector3(hit.x, hit.y + 1.05, hit.z), new THREE.Vector3(0, 1, 0), true, false);
    }
    return;
  }
  raycaster.set(origin, dir);
  const skip = rules.friendlyFire ? undefined : youTeam;
  for (const b of bots) b.root.updateMatrixWorld(true);
  for (const r of remotes.values()) r.root.updateMatrixWorld(true);
  const hit = raycaster.intersectObjects(
    [...botTargets(bots, skip, skipAi()), ...remoteTargets(remotes.values(), skip, skipAi())],
    false,
  )[0];
  const worldHit = rayWorld(origin, dir, meleeReach(), world.colliders);
  if (!hit || hit.distance > meleeReach()) return;
  if (worldHit && worldHit.dist < hit.distance - 0.04) return;
  const id = hit.object.userData.botId as number;
  const bot = bots.find((b) => b.id === id);
  if (bot && bot.hp > 0) {
    if (!rules.friendlyFire && bot.team === youTeam) return;
    noteHit(actorId(), bot.id, time);
    const killed = hurtBot(bot, rules.oneShot ? 200 : 100, time);
    lastHit = bash ? "bash" : "knife";
    flashHit(killed);
    impact(hit.point, hit.face?.normal ?? new THREE.Vector3(0, 1, 0), true, false);
    if (killed) frag(actorId(), bot.id, slotById(match, bot.id)?.name ?? "Rifle", bot.x, bot.y, bot.z);
    return;
  }
  const remote = [...remotes.values()].find((x) => x.slotId === id);
  if (!remote || !remote.alive) return;
  if (!rules.friendlyFire && remote.team === youTeam) return;
  const killed = hurtRemote(remote, rules.oneShot ? 200 : 100, actorId());
  lastHit = bash ? "bash" : "knife";
  flashHit(killed);
  impact(hit.point, hit.face?.normal ?? new THREE.Vector3(0, 1, 0), true, false);
}

function slashSound() {
  if (!inMatch()) return;
  audio ??= new AudioContext();
  const ctx = audio;
  const n = ctx.createBufferSource();
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  n.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = 1600;
  f.Q.value = 0.55;
  const g = ctx.createGain();
  g.gain.value = 0.22 * prefs.volume;
  n.connect(f);
  f.connect(g);
  g.connect(ctx.destination);
  f.frequency.exponentialRampToValueAtTime(380, ctx.currentTime + 0.16);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
  n.start();
  n.stop(ctx.currentTime + 0.2);
}

function bang(freq: number, dur: number, gain = 0.07, track?: AudioScheduledSourceNode[]) {
  if (!inMatch()) return;
  audio ??= new AudioContext();
  if (audio.state === "suspended") void audio.resume();
  const ctx = audio;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const n = ctx.createBufferSource();
  const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  n.buffer = buf;
  o.type = "triangle";
  o.frequency.value = freq;
  g.gain.value = gain * prefs.volume;
  o.connect(g);
  n.connect(g);
  g.connect(ctx.destination);
  o.start();
  n.start();
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  o.stop(ctx.currentTime + dur);
  n.stop(ctx.currentTime + dur);
  if (track) track.push(o, n);
}

const holdSound = createHoldSound();
const cutNodes: AudioScheduledSourceNode[] = [];
let cutCueTimer = 0;
let plantBannerUntil = 0;
let lastBombSec = -1;

function playPlantStart() {
  bang(180, 0.14, 0.11);
  window.setTimeout(() => bang(240, 0.2, 0.1), 90);
}

function playCutStart() {
  bang(140, 0.12, 0.1, cutNodes);
  cutCueTimer = window.setTimeout(() => bang(190, 0.16, 0.09, cutNodes), 80);
}

function playPlanted() {
  bang(392, 0.16, 0.14);
  window.setTimeout(() => bang(523, 0.18, 0.13), 120);
  window.setTimeout(() => bang(659, 0.45, 0.16), 280);
}

function playHoldTick(cutting: boolean) {
  bang(cutting ? 210 : 170, 0.08, cutting ? 0.09 : 0.08, cutting ? cutNodes : undefined);
}

function stopCutSound() {
  if (cutCueTimer) {
    window.clearTimeout(cutCueTimer);
    cutCueTimer = 0;
  }
  for (const n of cutNodes) {
    try {
      n.stop();
    } catch {
      /* already ended */
    }
    try {
      n.disconnect();
    } catch {
      /* already ended */
    }
  }
  cutNodes.length = 0;
}

function playBombTick(sec: number) {
  const low = sec <= 10;
  bang(low ? 920 : 440, low ? 0.07 : 0.05, low ? 0.12 : 0.07);
}

function tryFire() {
  if (!alive || reloading > 0 || weapon !== "rifle" || bashT > 0 || isCow(playerId)) return;
  if (!roundCombatOpen(match.phase)) return;
  if (time - lastFire < RIFLES[rifleKind].cycle) return;
  if (mag <= 0) {
    bang(160, 0.05, 0.03);
    startReload();
    return;
  }
  consumeFire(fireQ);
  lastFire = time;
  mag -= 1;
  plantBroke = true;
  interruptPlant(match, actorId());
  const rec = tuning.recoil;
  if (RIFLES[rifleKind].glass) {
    const adsMul = ads ? 0.9 : 1;
    pitch -= 0.032 * adsMul * rec;
    yaw += (Math.random() - 0.5) * 0.007 * adsMul * rec;
    punchP += 2.05 * adsMul * rec;
    punchY += (Math.random() - 0.5) * 0.22 * rec;
    punchR += (Math.random() - 0.5) * 0.32 * rec;
    gunKickZ = 0.055 * rec;
    fov += ads ? 0.2 : 2.4;
    bang(76, 0.13, 0.11);
  } else {
    const adsMul = ads ? 0.55 : 1;
    pitch -= 0.016 * adsMul * rec;
    yaw += (Math.random() - 0.45) * 0.012 * adsMul * rec;
    punchP += 1.25 * adsMul * rec;
    punchY += (Math.random() - 0.5) * 0.55 * rec;
    punchR += (Math.random() - 0.5) * 0.8 * rec;
    gunKickZ = 0.08 * rec;
    fov += ads ? 1.2 : 2.4;
    bang(110, 0.09, 0.08);
  }
  boltDur = RIFLES[rifleKind].cycle;
  boltT = boltDur;
  const flash = liveRifle().flash;
  flash.visible = true;
  flashUntil = time + 0.045;

  camera.updateMatrixWorld();
  const origin = new THREE.Vector3();
  const dir = new THREE.Vector3();
  camera.getWorldPosition(origin);
  camera.getWorldDirection(dir);
  spreadDir(dir);
  const muzzle = new THREE.Vector3();
  flash.getWorldPosition(muzzle);

  const worldHit = rayShot(origin, dir, 120, world.colliders);
  const floorHit = rayWorld(origin, dir, 120, world.colliders);
  if (net.role === "client") {
    net.sendEvent({
      kind: "shot",
      ox: origin.x,
      oy: origin.y,
      oz: origin.z,
      dx: dir.x,
      dy: dir.y,
      dz: dir.z,
    });
    for (const g of clientPawns.values()) g.updateMatrixWorld(true);
    raycaster.set(origin, dir);
    const meshHit = raycaster.intersectObjects(
      [...clientPawns.values()].flatMap((g) => pawnHitMeshes(g)),
      false,
    )[0];
    if (meshHit && (!worldHit || meshHit.distance < worldHit.dist - 0.02)) {
      const head = meshHit.object.userData.part === "head";
      lastHit = head ? "HEADSHOT" : "hit";
      flashHit(!!head);
      bang(head ? 520 : 280, 0.06, 0.05);
      tracer(muzzle, meshHit.point);
    } else if (worldHit) {
      lastHit = "world";
      impact(worldHit.point, worldHit.normal, false, false);
      tracer(muzzle, worldHit.point);
    } else if (floorHit) {
      lastHit = "world";
      impact(floorHit.point, floorHit.normal, false, false);
      tracer(muzzle, floorHit.point);
    } else {
      lastHit = "miss";
      tracer(muzzle, origin.clone().addScaledVector(dir, 80));
    }
    if (mag === 0) startReload();
    return;
  }
  if (shotPeople(origin, dir, worldHit, actorId(), muzzle, { hitmark: true })) {
    if (mag === 0) startReload();
    return;
  }
  if (worldHit) {
    lastHit = "world";
    impact(worldHit.point, worldHit.normal, false, false);
    tracer(muzzle, worldHit.point);
  } else if (floorHit) {
    lastHit = "world";
    impact(floorHit.point, floorHit.normal, false, false);
    tracer(muzzle, floorHit.point);
  } else {
    lastHit = "miss";
    tracer(muzzle, origin.clone().addScaledVector(dir, 80));
  }
  if (mag === 0) startReload();
}

function flashHit(kill: boolean) {
  hitmark.classList.toggle("kill", kill);
  hitmark.style.opacity = "1";
}

function pawnPoseWeapon(w: string): Pose["weapon"] {
  if (w === "mosin") return "mosin";
  if (w === "knife" || w === "smoke" || w === "frag" || w === "stun" || w === "flash") return w;
  return "kar";
}

function collectPoses(): Pose[] {
  if (net.role !== "host" && lastSnap) {
    return lastSnap.pawns.map((p) => {
      const self = (p.netId ?? 0) === (net.peerId ?? -1);
      return {
        id: p.id,
        x: self ? px + Math.cos(yaw) * lastLeanM : p.x,
        y: self ? py : p.y,
        z: self ? pz - Math.sin(yaw) * lastLeanM : p.z,
        yaw: self ? yaw : p.yaw,
        pitch: self ? pitch : p.pitch,
        eye: self ? eyeOff() : 1.52,
        alive: self ? alive : p.alive,
        weapon: pawnPoseWeapon(self ? (weapon === "rifle" ? rifleKind : weapon) : p.weapon),
        ads: self ? ads && weapon === "rifle" : p.ads,
        bash: self && bashT > 0 ? 1 - bashT / 0.42 : 0,
        fov: self && ads && weapon === "rifle" ? RIFLES[rifleKind].adsFov : p.ads ? 68 : 90,
        kick: self ? gunKickZ : 0,
        punchP: self ? punchP : 0,
        punchY: self ? punchY : 0,
        flash: self ? time < flashUntil : false,
      };
    });
  }
  const poses: Pose[] = [
    {
      id: playerId,
      x: px + Math.cos(yaw) * lastLeanM,
      y: py,
      z: pz - Math.sin(yaw) * lastLeanM,
      yaw,
      pitch,
      eye: eyeOff(),
      alive,
      weapon: weapon === "rifle" ? rifleKind : weapon,
      ads: ads && weapon === "rifle",
      bash: bashT > 0 ? 1 - bashT / 0.42 : 0,
      fov,
      kick: gunKickZ,
      punchP,
      punchY,
      flash: time < flashUntil,
    },
  ];
  for (const b of bots) {
    poses.push({
      id: b.id,
      x: b.x,
      y: b.y,
      z: b.z,
      yaw: b.yaw,
      pitch: b.lookPitch,
      eye: 1.52,
      alive: b.hp > 0,
      weapon: b.id % 2 === 0 ? "kar" : "mosin",
      ads: b.aim,
      bash: 0,
      fov: b.aim ? 68 : 90,
      kick: b.flash > 0.4 ? 0.06 : 0,
      punchP: b.flash > 0.4 ? 0.8 : 0,
      punchY: 0,
      flash: b.flash > 0.35,
    });
  }
  for (const r of remotes.values()) {
    poses.push({
      id: r.slotId,
      x: r.x,
      y: r.y,
      z: r.z,
      yaw: r.yaw,
      pitch: r.pitch,
      eye: r.crouch ? 1.1 : 1.64,
      alive: r.alive,
      weapon: isNade(r.weapon) ? r.weapon : r.weapon === "mosin" ? "mosin" : r.weapon === "knife" ? r.weapon : "kar",
      ads: r.ads,
      bash: 0,
      fov: r.ads ? 64 : 90,
      kick: 0,
      punchP: 0,
      punchY: 0,
      flash: false,
    });
  }
  return poses;
}

function ingestFeed(items: Snapshot["feed"]) {
  for (const k of items) {
    const t = k.t ?? time;
    if (tape.kills.some((x) => x.killerId === k.killerId && x.victimId === k.victimId && Math.abs(x.t - t) < 0.08)) {
      continue;
    }
    pushKill(tape, { t, killerId: k.killerId, victimId: k.victimId, victimName: k.victimName });
  }
}

function tapeTime() {
  return lastSnap?.time ?? time;
}

function recordSnap() {
  pushFrame(tape, tapeTime(), collectPoses());
  lastRecord = time;
}

function frag(killerId: number, victimId: number, victimName: string, x: number, y: number, z: number) {
  recordSnap();
  noteKill(killerId, victimId, time);
  kills = line(playerId).kills;
  deaths = line(playerId).deaths;
  pushKill(tape, { t: time, killerId, victimId, victimName });
  markDead(match, victimId, x, y, z);
}

function reelViewName(id: number) {
  const slot = slotById(match, id);
  const snapName = lastSnap?.pawns.find((p) => p.id === id)?.name;
  return watchLabel(id, playerId, slot?.name ?? snapName);
}

function startReel() {
  if (!inMatch()) return;
  if (studio.on || locker.on) return;
  recordSnap();
  mouseDown = false;
  clearFire(fireQ);
  for (const b of bots) restoreHead(b);
  for (const g of clientPawns.values()) restorePawnHead(g);
  const mvp = pickMvp(tape, match, playerId);
  const t0 = tape.frames[0]?.t ?? 0;
  const t1 = tape.frames[tape.frames.length - 1]?.t ?? 0;
  const clips =
    mvp?.clips.filter((c) => c.t >= t0 - 0.6 && c.t <= t1 + 0.6) ?? [];
  const recap = clips.length === 0 ? recapWindow(tape) : null;
  if (!mvp || clips.length === 0) {
    if (!recap) {
    if (!studio.on && !locker.on) document.body.classList.add("bestplay");
    hideDeath();
    bestplayKicker.textContent = "Best play";
    bestplayName.textContent = "No clip";
    bestplayStat.textContent = "Nothing to replay this round";
    bestplayKill.textContent = "";
    bestplayPace.textContent = "";
    reel = {
      mvpId: playerId,
      clips: [],
      playT: time,
      endT: time + 2.4,
      shown: 0,
      recap: true,
      skipAt: time + 1.1,
    };
    return;
    }
    const you = slotById(match, playerId);
    reel = {
      mvpId: playerId,
      clips: [],
      playT: recap.start,
      endT: recap.end,
      shown: 0,
      recap: true,
      skipAt: time + 1.2,
    };
    bestplayKicker.textContent = "Watching";
    bestplayName.textContent = reelViewName(playerId);
    bestplayStat.textContent = you?.team === "stone" ? "Stone · round recap" : "Ember · round recap";
    bestplayKill.textContent = "";
    bestplayPace.textContent = "Live";
  } else {
    const bounds = playBounds(clips, tape);
    reel = {
      mvpId: mvp.id,
      clips,
      playT: bounds.start,
      endT: bounds.end,
      shown: 0,
      recap: false,
      skipAt: time + 1.2,
    };
    const slot = slotById(match, mvp.id);
    const team = slot?.team === "stone" ? "Stone" : "Ember";
    bestplayKicker.textContent = "Watching";
    bestplayName.textContent = reelViewName(mvp.id);
    bestplayStat.textContent = `${team} · ${mvp.kills} kill${mvp.kills === 1 ? "" : "s"} this round`;
    bestplayKill.textContent = `Kill 0 / ${mvp.kills}`;
    bestplayPace.textContent = "Live";
  }
  if (!studio.on && !locker.on) document.body.classList.add("bestplay");
  hideDeath();
  applyReel(samplePoses(tape, reel.playT), reel.mvpId, true);
}

function trySkipReel() {
  const solo = humanCount(match) <= 1;
  if (reel && time < reel.skipAt && !solo) return;
  if (!reel && !solo) return;
  if (solo) net.sendEvent({ kind: "skipRecap" });
  if (reel) stopReel();
  else if (net.role !== "client") trySkipBestPlay(match);
}

function stopReel() {
  document.body.classList.remove("bestplay");
  lastReelAds = false;
  ghost.visible = false;
  for (const b of bots) {
    b.root.visible = true;
    restoreHead(b);
  }
  reel = null;
  reelPlayed = true;
  if (net.role !== "client" && match.phase === "bestplay") concludeBestPlay(match);
}

function tickReel(dt: number) {
  if (!reel) {
    startReel();
    return;
  }
  if (reel.recap) {
    reel.playT += dt * (tape.frames.length < 2 ? 1 : PLAY_RATE);
    bestplayPace.textContent = time >= reel.skipAt || humanCount(match) <= 1 ? "Space to skip" : "Live";
    applyReel(samplePoses(tape, reel.playT), reel.mvpId, false);
    if (reel.playT >= reel.endT) stopReel();
    return;
  }
  const live = inSlowWindow(reel.playT, reel.clips);
  reel.playT += dt * (live ? PLAY_RATE : FAST_RATE);
  bestplayPace.textContent =
    time >= reel.skipAt || humanCount(match) <= 1
      ? live
        ? "Live · Space to skip"
        : "10× · Space"
      : live
        ? "Live"
        : "10×";
  const n = killsReached(reel.playT, reel.clips);
  if (n > reel.shown) {
    const clip = reel.clips[n - 1]!;
    reel.shown = n;
    bestplayKill.textContent = `Kill ${n} / ${reel.clips.length}`;
    flashHit(true);
    bang(260, 0.08, 0.06);
    const poses = samplePoses(tape, clip.t);
    const killer = poses.get(clip.killerId);
    const victim = poses.get(clip.victimId);
    if (killer && victim) {
      tracer(
        new THREE.Vector3(killer.x, killer.y + killer.eye, killer.z),
        new THREE.Vector3(victim.x, victim.y + victim.eye * 0.7, victim.z),
      );
    }
  }
  applyReel(samplePoses(tape, reel.playT), reel.mvpId, false);
  if (reel.playT >= reel.endT) stopReel();
}

function applyReel(poses: Map<number, Pose>, mvpId: number, _snap: boolean) {
  const youTeam = slotById(match, playerId)?.team ?? "ember";
  setPawnCloth((ghost.userData.cloth as THREE.Mesh[]) ?? [ghost.userData.body], teamCloth(youTeam));
  if (!reelDrivesBotMeshes(net.role)) {
    for (const [id, g] of clientPawns) {
      const p = poses.get(id);
      if (!p) {
        g.visible = false;
        continue;
      }
      g.visible = reelWorldPawnVisible(id, mvpId);
      g.position.set(p.x, p.y, p.z);
      g.rotation.y = p.yaw;
      poseStance(g, p.alive ? "stand" : "down");
      stepWalkFromPos(g, p.x, p.z, p.alive);
    }
    for (const b of bots) b.root.visible = false;
  } else {
    for (const b of bots) {
      const p = poses.get(b.id);
      if (!p) {
        b.root.visible = false;
        continue;
      }
      b.x = p.x;
      b.y = p.y;
      b.z = p.z;
      b.yaw = p.yaw;
      b.hp = p.alive ? 100 : 0;
      b.root.visible = reelWorldPawnVisible(b.id, mvpId);
      b.root.position.set(p.x, p.y, p.z);
      b.root.rotation.y = p.yaw;
      poseStance(b.root, p.alive ? "stand" : "down");
      stepWalkFromPos(b.root, p.x, p.z, p.alive);
      restoreHead(b);
      setPawnCloth(b.cloth, p.alive ? teamCloth(b.team) : 0x2a3224);
    }
    for (const r of remotes.values()) {
      const p = poses.get(r.slotId);
      if (!p) {
        if (r.slotId === mvpId) r.root.visible = false;
        continue;
      }
      r.root.visible = reelWorldPawnVisible(r.slotId, mvpId);
      r.root.position.set(p.x, p.y, p.z);
      r.root.rotation.y = p.yaw;
      poseStance(r.root, p.alive ? "stand" : "down");
      stepWalkFromPos(r.root, p.x, p.z, p.alive);
    }
  }
  const you = poses.get(playerId);
  if (you && mvpId !== playerId) {
    ghost.visible = true;
    ghost.position.set(you.x, you.y, you.z);
    ghost.rotation.y = you.yaw;
    poseStance(ghost, you.alive ? "stand" : "down");
    stepWalkFromPos(ghost, you.x, you.z, you.alive);
  } else ghost.visible = false;
  const cam = poses.get(mvpId);
  if (cam) {
    camera.position.set(cam.x, cam.y + cam.eye, cam.z);
    camera.rotation.order = "YXZ";
    camera.rotation.x = cam.pitch - cam.punchP * 0.018;
    camera.rotation.y = cam.yaw;
    camera.rotation.z = -cam.punchY * 0.02;
    applyReelHands(cam);
  }
}

function applyReelHands(cam: Pose) {
  const bashing = cam.bash > 0.02;
  const rifleOn = (cam.weapon === "kar" || cam.weapon === "mosin") && !bashing;
  const kind: RifleId = cam.weapon === "mosin" ? "mosin" : "kar";
  const camFov = cam.fov || (cam.ads ? RIFLES[kind].adsFov : 90);
  const zoom = adsZoomK(kind, camFov);
  const aiming = cam.ads && rifleOn;
  showRifle(kind, rifleOn && !glassHidesRifle(kind, aiming, zoom));
  setKarGlass(kind, aiming, zoom);
  knife.visible = cam.weapon === "knife" || bashing;
  nadeView.visible = isNade(cam.weapon as Weapon) && !bashing;
  if (bashing) poseKnifeSlash(knife, cam.bash);
  else poseKnifeRest(knife);
  const rest = cam.ads
    ? (kind === "mosin" ? mosin.adsPos : kar.adsPos).clone()
    : (kind === "mosin" ? mosin.hipPos : kar.hipPos).clone();
  const g = kind === "mosin" ? mosin.root : kar.root;
  g.position.copy(rest);
  g.position.z += cam.kick;
  g.rotation.x = (cam.ads ? 0 : 0.1) - cam.punchP * 0.04;
  g.rotation.y = cam.ads ? 0 : 0.22;
  g.rotation.z = (cam.ads ? 0 : 0.06) + cam.punchY * 0.05;
  const hold = liveRifleFor(kind);
  poseBolt(hold, 0);
  hold.root.updateMatrixWorld(true);
  if (isNade(cam.weapon as Weapon) && !bashing) {
    nadeView.rotation.set(0, 0, 0);
    nadeView.position.set(0.18, -0.2, -0.2);
  }
  kar.flash.visible = false;
  mosin.flash.visible = false;
  if (rifleOn) hold.flash.visible = cam.flash;
  const handsOn = !cam.ads && (rifleOn || knife.visible || nadeView.visible);
  arm.root.visible = handsOn;
  if (handsOn) {
    if (bashing || cam.weapon === "knife") poseArm(arm, knifeWrist(knife), cam.bash * 0.8);
    else if (isNade(cam.weapon as Weapon)) poseArm(arm, nadeWrist(nadeView));
    else poseArm(arm, rifleWrist(hold, 0));
  }
  camera.fov = camFov;
  camera.updateProjectionMatrix();
  lastReelAds = cam.ads;
}

function liveRifleFor(kind: RifleId) {
  return kind === "mosin" ? mosin : kar;
}

function tracer(from: THREE.Vector3, to: THREE.Vector3) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const line = new THREE.Line(
    geo,
    new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.85 }),
  );
  scene.add(line);
  tracers.push({ line, t: 0.07 });
}

function impact(point: THREE.Vector3, normal: THREE.Vector3, flesh: boolean, head: boolean) {
  const col = flesh ? (head ? 0xb01c16 : 0x7a1410) : 0x1a1814;
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(flesh ? 0.07 : 0.05, 8),
    new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }),
  );
  m.position.copy(point).addScaledVector(normal, 0.02);
  m.lookAt(point.clone().add(normal));
  scene.add(m);
  decals.push(m);
  if (decals.length > 60) {
    const old = decals.shift()!;
    scene.remove(old);
    old.geometry.dispose();
  }
  const sparkCol = flesh ? 0x8a1a12 : 0xffb24a;
  for (let i = 0; i < (flesh ? 6 : 5); i++) {
    const s = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.03, 0.03),
      new THREE.MeshBasicMaterial({ color: sparkCol }),
    );
    s.position.copy(point);
    scene.add(s);
    const vel = normal
      .clone()
      .add(new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.6, Math.random() - 0.5))
      .multiplyScalar(4 + Math.random() * 4);
    sparks.push({ mesh: s, vel, life: 0.22 + Math.random() * 0.12 });
  }
  if (flesh && !head) {
    for (let i = 0; i < 8; i++) {
      const s = new THREE.Mesh(
        new THREE.SphereGeometry(0.018, 5, 4),
        new THREE.MeshBasicMaterial({ color: 0x7a1410 }),
      );
      s.position.copy(point);
      scene.add(s);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 0.35,
        -0.4 - Math.random() * 0.9,
        (Math.random() - 0.5) * 0.35,
      );
      sparks.push({ mesh: s, vel, life: 0.7 + Math.random() * 0.7 });
    }
  }
}

function hurtPlayer(amount: number, source: string, killerId?: number, force = false) {
  if (!alive || time < spawnProtectUntil) return;
  if (!force && rules.godmode) return;
  if (rules.oneShot) amount = Math.max(amount, 200);
  const victim = actorId();
  if (killerId != null) noteHit(killerId, victim, time);
  hp = Math.max(0, hp - amount);
  lastDamage = `−${amount} · ${source}`;
  hurtEl.style.opacity = "0.55";
  bang(70, 0.08, 0.05);
  if (hp <= 0) {
    alive = false;
    deadAt = time;
    killedBy = source;
    lastHit = "down";
    lastDamage = `Killed · ${source}`;
    if (possessId != null) {
      const b = bots.find((x) => x.id === possessId);
      if (b) {
        b.hp = 0;
        b.root.visible = true;
        b.root.rotation.x = 1.25;
      }
      possessId = null;
    }
    const vName = displayName(slotById(match, victim)?.name);
    if (killerId != null) frag(killerId, victim, vName, px, py, pz);
    else {
      if (victim === playerId) {
        line(playerId).deaths += 1;
        deaths = line(playerId).deaths;
      }
      markDead(match, victim, px, py, pz);
    }
    showDeath({
      killer: source,
      place: calloutAt(px, pz, py),
      spawnName: "next round",
      remain: -1,
    });
    cycleSpec(1);
  }
}

function roundSpawn() {
  const you = slotById(match, playerId);
  const planter = plantingTeam(match);
  const list = you && you.team === planter ? world.plantSpawns : world.watchSpawns;
  const spawn = list[2]!;
  possessId = null;
  specId = null;
  prone = false;
  diveT = 0;
  diveVx = 0;
  diveVz = 0;
  hp = HP_MAX;
  alive = true;
  mag = magCap();
  reloading = 0;
  weapon = "rifle";
  bashT = 0;
  clearFire(fireQ);
  px = spawn.x;
  py = spawn.y;
  pz = spawn.z;
  vy = 0;
  yaw = spawnYaw(spawn, world);
  pitch = 0;
  lean = 0;
  lastDamage = "No damage taken";
  lastHit = "—";
  spawnProtectUntil = time + 1.2;
  nadeBag = { ...NADE_MAX };
  nadeKind = "smoke";
  paintNadeView();
  flashT = 0;
  stunT = 0;
  restoreHomeSeats(match, remotes);
  setRoundResult(null);
  hideDeath();
  resetBots(bots, world, match);
  for (const r of remotes.values()) {
    const list = r.team === planter ? world.plantSpawns : world.watchSpawns;
    const spawnAt = list[r.slotId % list.length]!;
    r.x = spawnAt.x;
    r.y = spawnAt.y;
    r.z = spawnAt.z;
    r.vy = 0;
    r.hp = 100;
    r.alive = true;
    r.root.position.copy(spawnAt);
    r.root.rotation.set(0, spawnYaw(spawnAt, world), 0);
    r.root.visible = true;
    r.nades = fullNades();
    restorePawnHead(r.root);
  }
  clearTape(tape);
  lastRecord = -1;
  ghost.visible = false;
  for (const b of bots) b.root.visible = true;
  const dock = calloutAt(spawn.x, spawn.z, spawn.y);
  showSpawn(
    you && you.team === planter
      ? `${dock} · you carry the Bomb`
      : `${dock} · hold ${world.sites[0]?.name ?? "A"} and ${world.sites[1]?.name ?? "B"}`,
    time,
  );
}

function botShoot(from: THREE.Vector3, dir: THREE.Vector3, target: { id: number; team: string }, shooterId: number) {
  if (isCow(shooterId)) return;
  interruptPlant(match, shooterId);
  const worldHit = rayShot(from, dir, 80, world.colliders);
  bang(150, 0.06, 0.035);
  const shooter = nearestBot(from);
  const where = calloutAt(from.x, from.z);
  const name = shooter ? `${slotById(match, shooter.id)?.name ?? "Rifle"} · ${where}` : `Rifle · ${where}`;
  const extra: LiveBody[] = [
    {
      id: actorId(),
      team: slotById(match, actorId())?.team ?? "ember",
      x: px + Math.cos(yaw) * lastLeanM,
      y: py,
      z: pz - Math.sin(yaw) * lastLeanM,
      alive,
    },
  ];
  if (shotPeople(from, dir, worldHit, shooterId, from, { extra, shooterName: name })) return;
  if (worldHit) {
    impact(worldHit.point, worldHit.normal, false, false);
    tracer(from, worldHit.point);
  } else {
    tracer(from, from.clone().addScaledVector(dir, 30));
  }
}

function playBlast(x: number, y: number, z: number) {
  bang(36, 0.7, 0.28);
  bang(90, 0.22, 0.16);
  blastFlash = 1;
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(1.4, 22, 16),
    new THREE.MeshBasicMaterial({ color: 0xffc060, transparent: true, opacity: 0.95, depthTest: false }),
  );
  mesh.position.set(x, y + 0.55, z);
  mesh.renderOrder = 8;
  scene.add(mesh);
  const light = new THREE.PointLight(0xff7818, 72, 36);
  light.position.set(x, y + 1.1, z);
  scene.add(light);
  blasts.push({ mesh, light, t: 1.45 });
}

function nadeLos(x: number, y: number, z: number) {
  camera.updateMatrixWorld();
  const eye = new THREE.Vector3();
  camera.getWorldPosition(eye);
  const dest = new THREE.Vector3(x, y + 0.2, z);
  const dir = dest.clone().sub(eye);
  const dist = dir.length();
  if (dist < 0.2) return true;
  dir.multiplyScalar(1 / dist);
  const hit = rayShot(eye, dir, dist - 0.15, world.colliders);
  return !hit;
}

function applyNadePop(pop: NadePop, fxOnly = false) {
  const pos = new THREE.Vector3(pop.x, pop.y, pop.z);
  if (pop.kind === "frag") {
    playBlast(pop.x, pop.y, pop.z);
    if (fxOnly) return;
    const dYou = Math.hypot(px - pop.x, py - pop.y, pz - pop.z);
    if (alive && dYou < FRAG_R) {
      const fall = 1 - dYou / FRAG_R;
      hurtPlayer(Math.round(20 + 80 * fall), "Frag");
    }
    for (const b of bots) {
      if (b.hp <= 0) continue;
      const d = Math.hypot(b.x - pop.x, b.y - pop.y, b.z - pop.z);
      if (d < FRAG_R) {
        const fall = 1 - d / FRAG_R;
        if (hurtBot(b, Math.round(30 + 90 * fall), time)) markDead(match, b.id, b.x, b.y, b.z);
      }
    }
    return;
  }
  if (pop.kind === "flash") {
    bang(880, 0.08, 0.12);
    if (!alive) return;
    const look = new THREE.Vector3();
    camera.getWorldDirection(look);
    const to = pos.clone().sub(new THREE.Vector3(px, py + eyeOff(), pz));
    const dist = to.length();
    if (dist > 28 || !nadeLos(pop.x, pop.y, pop.z)) return;
    to.normalize();
    const facing = Math.max(0, look.dot(to));
    const power = (1 - dist / 28) * (0.35 + 0.65 * facing);
    if (power > 0.12) flashT = Math.max(flashT, 0.6 + power * 2.4);
    return;
  }
  if (pop.kind === "stun") {
    bang(180, 0.18, 0.1);
    if (alive) {
      const dist = Math.hypot(px - pop.x, py - pop.y, pz - pop.z);
      const hold = dist > STUN_R || !nadeLos(pop.x, pop.y, pop.z) ? 0 : stunDuration(dist);
      if (hold > 0) stunT = Math.max(stunT, hold);
    }
    if (fxOnly) return;
    for (const b of bots) {
      if (b.hp <= 0) continue;
      const d = Math.hypot(b.x - pop.x, b.y - pop.y, b.z - pop.z);
      const hold = stunDuration(d);
      if (hold <= 0) continue;
      b.stunUntil = Math.max(b.stunUntil, time + hold);
      b.aim = false;
      b.seeT = 0;
    }
  }
}

function roundSting(win: boolean) {
  if (win) {
    bang(523, 0.11, 0.09);
    bang(659, 0.14, 0.08);
    bang(784, 0.28, 0.1);
  } else {
    bang(392, 0.16, 0.08);
    bang(311, 0.22, 0.07);
    bang(247, 0.4, 0.1);
  }
}

function detonateWire(x: number, y: number, z: number) {
  playBlast(x, y, z);
  const plant = plantingTeam(match);
  const you = slotById(match, playerId);
  if (you && you.team !== plant && alive) {
    if (Math.hypot(px - x, py - y, pz - z) < tuning.blastR) hurtPlayer(200, "The Bomb");
  }
  for (const b of bots) {
    if (b.hp <= 0 || b.team === plant) continue;
    if (Math.hypot(b.x - x, b.y - y, b.z - z) < tuning.blastR && hurtBot(b, 200, time)) {
      markDead(match, b.id, b.x, b.y, b.z);
    }
  }
}

function maxLean(desired: number, height: number) {
  if (Math.abs(desired) < 0.01) return 0;
  const sign = Math.sign(desired);
  let lo = 0;
  let hi = Math.abs(desired);
  const rightX = Math.cos(yaw);
  const rightZ = -Math.sin(yaw);
  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2;
    const ox = rightX * mid * sign;
    const oz = rightZ * mid * sign;
    const t = collideXZ(world.colliders, px + ox, pz + oz, RADIUS, py + 0.1, py + height);
    if (Math.hypot(t.x - (px + ox), t.z - (pz + oz)) <= 0.04) lo = mid;
    else hi = mid;
  }
  return lo * sign;
}

function remoteFire(r: Remote): boolean {
  const kind: RifleId = r.weapon === "mosin" ? "mosin" : "kar";
  if (time - r.lastFire < RIFLES[kind].cycle) return false;
  if (r.weapon === "knife" || r.weapon === "smoke" || r.weapon === "frag" || r.weapon === "stun" || r.weapon === "flash") return false;
  r.lastFire = time;
  interruptPlant(match, r.slotId);
  const origin = new THREE.Vector3(r.x, r.y + (r.crouch ? 1.1 : 1.64), r.z);
  const dir = new THREE.Vector3(
    -Math.sin(r.yaw) * Math.cos(r.pitch),
    -Math.sin(r.pitch),
    -Math.cos(r.yaw) * Math.cos(r.pitch),
  ).normalize();
  const worldHit = rayShot(origin, dir, 120, world.colliders);
  bang(110, 0.07, 0.05);
  const extra: LiveBody[] = [
    {
      id: actorId(),
      team: slotById(match, actorId())?.team ?? "ember",
      x: px,
      y: py,
      z: pz,
      alive,
    },
  ];
  if (shotPeople(origin, dir, worldHit, r.slotId, origin, { extra, shooterName: r.name })) return true;
  if (worldHit) {
    impact(worldHit.point, worldHit.normal, false, false);
    tracer(origin, worldHit.point);
  }
  return true;
}

function nearestBot(from: THREE.Vector3): Bot | undefined {
  let best = Infinity;
  let found: Bot | undefined;
  for (const b of bots) {
    if (b.hp <= 0) continue;
    const d = Math.hypot(b.x - from.x, b.z - from.z);
    if (d < best) {
      best = d;
      found = b;
    }
  }
  return found;
}

let last = performance.now();
function frame(now: number) {
  if (serverGone(document.body.classList.contains("started") && net.status !== "offline", lastBeat, now)) {
    leaveToLobby();
  }
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;

  if (cowId != null && time >= cowUntil) explodeCow();
  refreshCows();
  for (const [id, mesh] of cowMeshes) {
    let cx = px;
    let cy = py;
    let cz = pz;
    if (id !== playerId && id !== possessId) {
      const p = lastSnap?.pawns.find((t) => t.id === id);
      const b = bots.find((t) => t.id === id);
      const r = [...remotes.values()].find((t) => t.slotId === id);
      if (p) {
        cx = p.x;
        cy = p.y;
        cz = p.z;
      } else if (b) {
        cx = b.x;
        cy = b.y;
        cz = b.z;
      } else if (r) {
        cx = r.x;
        cy = r.y;
        cz = r.z;
      }
    }
    mesh.position.set(cx, cy, cz);
    mesh.rotation.y = time * 3;
    mesh.scale.setScalar(1 + Math.sin(time * 18) * 0.04);
    mesh.visible = id !== playerId || reel !== null;
    hideCowPawn(id, true);
  }

  const isClient = net.role === "client";
  if (isClient && lastSnap) applyMatchSnap(match, lastSnap);
  const reeling = match.phase === "bestplay";
  const froze = roundFrozen(match.phase);
  const combatLock = !roundCombatOpen(match.phase);

  if (weapon !== "rifle") clearFire(fireQ);
  else if (mouseDown && !fireQ.held) pressFire(fireQ);
  const wantShot = !studio.on && weapon === "rifle" && fireWantsShot(fireQ);
  if (locked && alive && wantShot && !combatLock && bashT <= 0) tryFire();
  if (!keys.has("KeyF")) plantBroke = false;
  const wantUse = locked && alive && keys.has("KeyF") && !isCow(playerId) && !plantBroke;
  const planting = isPlanting(
    match,
    { id: actorId(), x: px, y: py, z: pz, holdingUse: wantUse },
    (site, x, z, y) => inSite(world, site, x, z, y),
  );

  crouch = !studio.on && locked && alive && !prone && keys.has("KeyC");
  leanInput = 0;
  if (locked && alive && keys.has("KeyQ")) leanInput -= 1;
  if (locked && alive && keys.has("KeyE")) leanInput += 1;
  ads = ads && locked && alive && weapon === "rifle";
  document.body.classList.toggle("ads", ads);
  if (diveT > 0) diveT = Math.max(0, diveT - dt);
  if (bashT > 0) bashT = Math.max(0, bashT - dt);
  if (boltT > 0) boltT = Math.max(0, boltT - dt);
  if (throwT > 0) throwT = Math.max(0, throwT - dt);
  if (flashT > 0) flashT = Math.max(0, flashT - dt);
  if (stunT > 0) stunT = Math.max(0, stunT - dt);

  if (reloading > 0) {
    reloading -= dt;
    if (reloading <= 0) {
      reloading = 0;
      mag = magCap();
      if (!fireQ.held) fireQ.queued = false;
    }
  }

  const height = bodyH();
  let stanceMul = prone ? (diveT > 0 ? 1.12 : 0.36) : crouch ? 0.55 : 1;
  if (weapon === "knife" && !ads) stanceMul *= 1.25;
  if (stunT > 0) stanceMul *= 0.42;
  const speed = tuning.walk * stanceMul * (ads ? tuning.adsSlow : 1);
  const gh = groundHeight(world.colliders, px, pz, RADIUS, py);
  grounded = py <= gh + 0.06 && vy <= 0.2;

  if (!studio.on && alive && !froze && locked) {
    const forwardX = -Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);
    let wx = 0;
    let wz = 0;
    if (locked && !planting) {
      if (keys.has("KeyW")) {
        wx += forwardX;
        wz += forwardZ;
      }
      if (keys.has("KeyS")) {
        wx -= forwardX;
        wz -= forwardZ;
      }
      if (keys.has("KeyD")) {
        wx += rightX;
        wz += rightZ;
      }
      if (keys.has("KeyA")) {
        wx -= rightX;
        wz -= rightZ;
      }
    }
    const len = Math.hypot(wx, wz);
    walking = len > 0 && alive;
    if (len > 0 && alive) {
      const n = collideXZ(
        world.colliders,
        px + (wx / len) * speed * dt,
        pz + (wz / len) * speed * dt,
        RADIUS,
        py + 0.08,
        py + height,
      );
      px = n.x;
      pz = n.z;
    }
    if (diveT > 0 || (prone && (Math.abs(diveVx) > 0.2 || Math.abs(diveVz) > 0.2))) {
      const n = collideXZ(
        world.colliders,
        px + diveVx * dt,
        pz + diveVz * dt,
        RADIUS,
        py + 0.04,
        py + height,
      );
      px = n.x;
      pz = n.z;
      const damp = grounded ? 6 : 1.6;
      diveVx += (0 - diveVx) * Math.min(1, dt * damp);
      diveVz += (0 - diveVz) * Math.min(1, dt * damp);
    }
    if (locked && alive && grounded && keys.has("Space") && !jumpHeld && !planting) {
      if (prone) {
        prone = false;
        vy = jumpSpeed() * 0.82;
      } else vy = jumpSpeed();
      grounded = false;
    }
    jumpHeld = keys.has("Space");
    if (grounded && vy <= 0) {
      py = gh;
      vy = 0;
    } else {
      vy += -tuning.gravity * dt;
      py += vy * dt;
      const g2 = groundHeight(world.colliders, px, pz, RADIUS, py);
      if (py < g2) {
        py = g2;
        vy = 0;
        grounded = true;
      }
    }
    if (py < -3.2) {
      py = -2.2;
      vy = 0;
    }
  } else {
    walking = false;
  }

  if (isClient && alive && !studio.on) {
    pushPred(predHist, { t: performance.now(), x: px, y: py, z: pz });
  }

  tickSteps({
    x: px,
    z: pz,
    grounded,
    moving: walking,
    crouch,
    ads,
    prone,
    ctx: audio,
  });

  if (roundCombatOpen(match.phase) && time - lastRecord >= 1 / 14) {
    recordSnap();
  }

  if (smokeHeld && isNade(weapon) && alive && !combatLock) smokeCharge = Math.min(1, smokeCharge + dt / 0.85);
  else if (!smokeHeld) smokeCharge = 0;

  const fightEye = py + eyeOff();
  const fighters = [
    {
      id: actorId(),
      team: slotById(match, actorId())?.team ?? "ember" as const,
      x: px + Math.cos(yaw) * lastLeanM,
      y: fightEye,
      z: pz - Math.sin(yaw) * lastLeanM,
      alive,
    },
    ...bots.map((b) => ({
      id: b.id,
      team: b.team,
      x: b.x,
      y: b.y + 1.5,
      z: b.z,
      alive: b.hp > 0 && b.id !== possessId,
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
  if (!reeling && !isClient && inMatch()) {
    botCutting = updateBots(
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
      skipAi(),
      rules.botSkill,
    ).cutting;
  }

  if (!isClient && !studio.on && !locker.on && inMatch()) {
  const youSeat = slotById(match, playerId);
  markSeatsFromBodies(
    match,
    livingSeatIds({
      local: { id: playerId, alive },
      bots,
      remotes: remotes.values(),
      possessId,
    }),
  );
  tickMatch(match, dt, {
    living: (team) =>
      countLiving(
        team,
        combatBodies({
          local: youSeat ? { team: youSeat.team, alive } : null,
          bots,
          remotes: remotes.values(),
          possessId,
        }),
      ),
    inSite: (id, x, z, y) => inSite(world, id, x, z, y),
    holdingUse: wantUse,
    actor: {
      id: actorId(),
      team: slotById(match, actorId())?.team ?? "ember",
      x: px,
      y: py,
      z: pz,
      alive,
      fired: plantBroke,
    },
    actors: [
      {
        id: actorId(),
        team: slotById(match, actorId())?.team ?? "ember",
        x: px,
        y: py,
        z: pz,
        alive,
        holdingUse: wantUse,
        fired: plantBroke,
      },
      ...[...remotes.values()].map((r) => ({
        id: r.slotId,
        team: r.team,
        x: r.x,
        y: r.y,
        z: r.z,
        alive: r.alive,
        holdingUse: !!r.input.use && !r.input.fire,
        fired: !!r.input.fire,
      })),
    ],
    spawnPlant: world.plantSpawns[2]!,
    onDetonate: detonateWire,
    botCutting,
    skipRecap: !rules.highlights,
  });
  }

  if (inMatch() && match.phase === "settle" && seenPhase !== "settle") {
    if (isClient && match.endText === "The Bomb ran out") playBlast(match.wire.x, match.wire.y, match.wire.z);
    const you = slotById(match, playerId);
    const win = !!you && match.lastWinner === you.team;
    setRoundResult(win ? "Round Victory!" : "Round Loss!", win);
    roundSting(win);
  }
  if (inMatch() && match.phase === "bestplay" && seenPhase !== "bestplay") {
    recordSnap();
    setRoundResult(null);
    reelPlayed = false;
  }
  if (inMatch() && match.phase === "planted" && seenPhase !== "planted") {
    playPlanted();
    const you = slotById(match, playerId);
    const win = !!you && you.team === plantingTeam(match);
    setRoundResult("Bomb planted", win);
    plantBannerUntil = time + 3.4;
  }
  const holdingPlant = match.wire.plantHold > 0.02 && (match.phase === "live" || match.phase === "planted");
  const youCut = slotById(match, playerId);
  const watchCut = watchingTeam(match);
  const holdingUseNow = wantUse;
  const cutNow = {
    phase: match.phase,
    wireMode: match.wire.mode,
    watchTeam: watchCut,
    wx: match.wire.x,
    wy: match.wire.y,
    wz: match.wire.z,
  };
  let remoteCutting = false;
  if (cutNow.phase === "planted" && cutNow.wireMode === "planted") {
    for (const r of remotes.values()) {
      if (
        isActivelyCutting({
          ...cutNow,
          holdingUse: r.input.use,
          alive: r.alive,
          cutterTeam: r.team,
          x: r.x,
          y: r.y,
          z: r.z,
        })
      ) {
        remoteCutting = true;
        break;
      }
    }
  }
  const holdingCut =
    isActivelyCutting({
      ...cutNow,
      holdingUse: holdingUseNow,
      alive,
      cutterTeam: youCut?.team ?? "",
      x: px,
      y: py,
      z: pz,
    }) ||
    (cutNow.phase === "planted" && cutNow.wireMode === "planted" && botCutting) ||
    remoteCutting;
  tickHoldSound(holdSound, { holdingPlant, holdingCut, dt }, {
    playCutStart,
    playPlantStart,
    playHoldTick,
    stopCut: stopCutSound,
  });
  if (match.phase === "planted") {
    const sec = Math.max(0, Math.ceil(match.bombTime));
    if (lastBombSec >= 0 && sec < lastBombSec) playBombTick(sec);
    lastBombSec = sec;
  } else lastBombSec = -1;
  if (plantBannerUntil && time > plantBannerUntil) {
    if (match.phase === "planted") setRoundResult(null);
    plantBannerUntil = 0;
  }
  if (match.phase === "freeze" && seenPhase !== "freeze") {
    setRoundResult(null);
    plantBroke = false;
    if (isClient) {
      clearTape(tape);
      lastRecord = -1;
      nadeBag = { ...NADE_MAX };
      killedBy = "";
      lastDamage = "No damage taken";
      for (const g of clientPawns.values()) restorePawnHead(g);
      plantBannerUntil = 0;
      lastBombSec = -1;
    }
  }
  seenPhase = match.phase;

  if (!inMatch()) {
    if (reel) stopReel();
  } else if (match.phase === "bestplay") {
    if (rules.highlights && !reelPlayed) tickReel(dt);
    else if (reel) stopReel();
  } else if (reel) {
    stopReel();
  }
  const watching = reel !== null;
  document.body.classList.toggle("ads", watching ? lastReelAds : ads);

  if (net.role === "host" && !reeling) {
    for (const r of remotes.values()) {
      const cowPawn = isCow(r.slotId);
      const rooted = isPlanting(
        match,
        {
          id: r.slotId,
          x: r.x,
          y: r.y,
          z: r.z,
          holdingUse: !!r.input.use && !r.input.fire,
        },
        (site, x, z, y) => inSite(world, site, x, z, y),
      );
      tickRemote(r, dt, time, world, froze, rooted);
      if (r.input.fire && !r.fireQ.held) pressFire(r.fireQ);
      else if (!r.input.fire && r.fireQ.held) releaseFire(r.fireQ);
      if (fireWantsShot(r.fireQ) && r.alive && !combatLock && !cowPawn && remoteFire(r)) consumeFire(r.fireQ);
    }
  }

  if (isClient && lastSnap && net.peerId != null) {
    applyMatchSnap(match, lastSnap);
    const snapMap = lastSnap.mapId;
    if (!studio.on && !locker.on && snapMap && snapMap !== mapId && !lastSnap.mapCustom && MAPS.some((m) => m.id === snapMap)) {
      loadMap(snapMap);
    }
    if (!reel && !studio.on && !locker.on) {
      syncClientPawns(scene, lastSnap.pawns, net.peerId, clientPawns, dt, {
        forceSnap: lastSnap.round !== seenRound,
        now: performance.now(),
        snapAt: lastBeat,
        snapSeq,
      });
      for (const p of lastSnap.pawns) {
        if ((p.netId ?? 0) === net.peerId) continue;
        const g = clientPawns.get(p.id);
        if (g && p.cow) g.visible = false;
        if (g && p.alive) restorePawnHead(g);
      }
      for (const b of bots) b.root.visible = false;
      ghost.visible = false;
    }
    for (const p of lastSnap.pawns) {
      if (p.kills != null) applyLine(p.id, p.kills, p.assists ?? 0, p.deaths ?? 0);
    }
    const me = lastSnap.pawns.find((p) => (p.netId ?? 0) === net.peerId);
    if (snapSeq !== appliedSeq) {
      ingestFeed(lastSnap.feed);
      for (const pop of lastSnap.pops ?? []) applyNadePop(pop, true);
      for (const id of lastSnap.headPops ?? []) {
        const g = clientPawns.get(id);
        if (g && popPawnHead(g, scene)) {
          bang(70, 0.12, 0.16);
          bang(140, 0.06, 0.1);
        }
      }
      if (roundCombatOpen(match.phase)) recordSnap();
      if (me) {
        if (me.nades) {
          if (!alive && me.alive) nadeBag = { ...me.nades };
          else {
            nadeBag = {
              smoke: Math.min(nadeBag.smoke, me.nades.smoke),
              frag: Math.min(nadeBag.frag, me.nades.frag),
              stun: Math.min(nadeBag.stun, me.nades.stun),
              flash: Math.min(nadeBag.flash, me.nades.flash),
            };
          }
        }
        if (me.hp < hp) {
          lastDamage = `−${Math.round(hp - me.hp)}`;
          hurtEl.style.opacity = "0.55";
          bang(70, 0.08, 0.05);
        }
        if (alive && !me.alive) {
          const kill = [...lastSnap.feed].reverse().find((k) => k.victimId === me.id);
          killedBy = kill?.killerName ?? "a rifleman";
          lastDamage = `Killed · ${killedBy}`;
          lastHit = "down";
        }
        playerId = me.id;
        hp = me.hp;
        if (!studio.on) {
          alive = me.alive;
          if (!me.alive) {
            px = me.x;
            py = me.y;
            pz = me.z;
            predHist.length = 0;
          } else {
            const ack = performance.now() - lookbackMs(net.pingMs);
            const n = reconcilePredicted(px, py, pz, me.x, me.y, me.z, predHist, ack);
            px = n.x;
            py = n.y;
            pz = n.z;
          }
        }
      }
      appliedSeq = snapSeq;
    }
    if (me) {
      playerId = me.id;
      hp = me.hp;
      if (!studio.on) alive = me.alive;
      if (me.kills != null) {
        kills = me.kills;
        deaths = me.deaths ?? deaths;
      }
      paintTeamPick();
    }
  }

  if (!isClient && match.round !== seenRound) {
    seenRound = match.round;
    roundSpawn();
  }
  if (isClient && lastSnap && match.round !== seenRound) {
    seenRound = match.round;
    nadeBag = { ...NADE_MAX };
    nadeKind = "smoke";
    predHist.length = 0;
    paintNadeView();
  }

  if (alive || match.phase === "bestplay" || match.phase === "matchover" || match.phase === "settle") {
    hideDeath();
  } else {
    showDeath({
      killer: killedBy || "a rifleman",
      place: calloutAt(px, pz, py),
      spawnName: "next round",
      remain: -1,
    });
  }

  const eyeY = py + eyeOff();
  const leanTarget = leanInput;
  const leanRate = 1 / 0.11;
  if (lean < leanTarget) lean = Math.min(leanTarget, lean + leanRate * dt);
  else lean = Math.max(leanTarget, lean - leanRate * dt);

  const rightX = Math.cos(yaw);
  const rightZ = -Math.sin(yaw);
  const leanM = maxLean(lean * tuning.leanM, height);
  lastLeanM = leanM;

  const punchSettle = rifleKind === "kar" && ads ? 6.5 : 12;
  punchP += (0 - punchP) * Math.min(1, dt * punchSettle);
  punchY += (0 - punchY) * Math.min(1, dt * 10);
  punchR += (0 - punchR) * Math.min(1, dt * 10);
  gunKickZ += (0 - gunKickZ) * Math.min(1, dt * 16);
  if (!watching && time > flashUntil) {
    kar.flash.visible = false;
    mosin.flash.visible = false;
  }
  hipSpread = hipCone();
  blastFlash += (0 - blastFlash) * Math.min(1, dt * 1.7);
  blastEl.style.opacity = String(blastFlash);

  for (let i = blasts.length - 1; i >= 0; i--) {
    const b = blasts[i]!;
    b.t -= dt;
    const k = 1 - Math.max(0, b.t) / 1.45;
    b.mesh.scale.setScalar(0.8 + k * 16);
    (b.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.95 * (1 - k));
    b.light.intensity = 72 * (1 - k);
    if (b.t <= 0) {
      scene.remove(b.mesh, b.light);
      b.mesh.geometry.dispose();
      (b.mesh.material as THREE.Material).dispose();
      blasts.splice(i, 1);
    }
  }

  if (!watching) {
    if (match.phase === "matchover") {
      const { minX, maxX, minZ, maxZ } = world.bounds;
      const cx = (minX + maxX) * 0.5;
      const cz = (minZ + maxZ) * 0.5;
      const span = Math.max(maxX - minX, maxZ - minZ);
      const radius = span * 0.3;
      const ang = time * 0.12;
      camera.position.set(cx + Math.sin(ang) * radius, 40, cz + Math.cos(ang) * radius);
      const look = podiumLookAt(world);
      camera.lookAt(look.x, look.y, look.z);
      fov += (62 - fov) * Math.min(1, dt * 4);
      camera.fov = fov;
      camera.updateProjectionMatrix();
      showRifle(rifleKind, false);
      setKarGlass(rifleKind, false, 0);
      knife.visible = false;
      nadeView.visible = false;
      arm.root.visible = false;
      setSpec(null);
      ghost.visible = false;
      if (!isClient) {
        for (const b of bots) b.root.visible = b.id !== possessId;
        for (const r of remotes.values()) r.root.visible = true;
      }
    } else {
      const spec = !alive && !studio.on ? specTarget() : undefined;
      if (spec) {
        camera.position.set(spec.x, spec.y, spec.z);
        camera.rotation.y = spec.yaw;
        camera.rotation.x = spec.pitch;
        camera.rotation.z = 0;
        fov += (90 - fov) * Math.min(1, dt * 10);
        camera.fov = fov;
        camera.updateProjectionMatrix();
        showRifle(rifleKind, false);
        setKarGlass(rifleKind, false, 0);
        knife.visible = false;
        nadeView.visible = false;
        arm.root.visible = false;
        setSpec(
          `${spec.name}${spec.bot ? " · E take over" : " · human"} · click next`,
        );
      } else {
        setSpec(alive ? (possessId != null ? `On ${slotById(match, possessId)?.name ?? "bot"} · their score` : null) : "No living teammates");
        camera.position.set(px + rightX * leanM, eyeY, pz + rightZ * leanM);
        camera.rotation.y = yaw;
        camera.rotation.x = (alive ? pitch : Math.min(pitch + 0.35, 0.6)) - punchP * 0.018;
        camera.rotation.z = -lean * THREE.MathUtils.degToRad(8) - punchR * 0.02;
        const fovTarget = ads ? RIFLES[rifleKind].adsFov : 90;
        const zoomRate = RIFLES[rifleKind].glass ? 6.5 : 10;
        fov += (fovTarget - fov) * Math.min(1, dt * zoomRate);
        camera.fov = fov;
        camera.updateProjectionMatrix();
        const bashing = bashT > 0;
        const throwing = throwT > 0;
        const boltK = boltT > 0 ? 1 - boltT / boltDur : 0;
        const throwK = throwing ? 1 - throwT / throwDur : 0;
        const cowedSelf = isCow(playerId);
        const aiming = ads && alive && weapon === "rifle" && !bashing && !throwing && !cowedSelf;
        const zoom = adsZoomK(rifleKind, fov);
        const rifleOn = !studio.on && alive && weapon === "rifle" && !bashing && !throwing && !cowedSelf;
        showRifle(rifleKind, rifleOn && !glassHidesRifle(rifleKind, aiming, zoom));
        setKarGlass(rifleKind, aiming, zoom);
        knife.visible = !studio.on && alive && (weapon === "knife" || bashing) && !throwing && !cowedSelf;
        nadeView.visible = !studio.on && alive && !bashing && (isNade(weapon) || throwing) && !cowedSelf;
        if (bashing) poseKnifeSlash(knife, 1 - bashT / 0.42);
        else poseKnifeRest(knife);
        if (throwing) poseThrow(nadeView, throwK, throwDrop);
        else if (isNade(weapon)) {
          nadeView.rotation.x = Math.sin(time * 3) * 0.04;
          nadeView.position.set(0.18, -0.2, -0.2 - smokeCharge * 0.18);
        }
        const hold = liveRifle();
        const rest = (ads ? hold.adsPos : hold.hipPos).clone();
        const g = hold.root;
        g.position.lerp(rest, Math.min(1, dt * 14));
        g.position.z += gunKickZ;
        g.rotation.x = (ads ? 0 : 0.1) - punchP * 0.04;
        g.rotation.y = ads ? 0 : 0.22;
        g.rotation.z = (ads ? 0 : 0.06) + punchY * 0.05;
        const reloadK = reloading > 0 ? 1 - reloading / RELOAD : 0;
        if (reloading > 0 && weapon === "rifle") {
          if (!ads) applyReloadPose(g, rifleKind, reloadK);
          poseBolt(hold, reloadBoltK(reloadK));
        } else poseBolt(hold, weapon === "rifle" ? boltK : 0);
        poseAmmo(hold, mag, magCap(), reloadK);
        poseAmmo(rifleKind === "kar" ? mosin : kar, mag, magCap(), 0);
        hold.root.updateMatrixWorld(true);
        const handsOn =
          alive &&
          !ads &&
          (kar.root.visible || mosin.root.visible || knife.visible || nadeView.visible || throwing);
        arm.root.visible = handsOn;
        if (handsOn) {
          if (bashing || weapon === "knife") poseArm(arm, knifeWrist(knife), bashing ? (1 - bashT / 0.42) * 0.8 : 0);
          else if (throwing || isNade(weapon)) poseArm(arm, nadeWrist(nadeView));
          else poseArm(arm, rifleWrist(hold, reloading > 0 ? reloadBoltK(reloadK) : boltK));
        }
      }
    }
  } else {
    setSpec(null);
  }

  setCook(alive && isNade(weapon) && smokeHeld, smokeCharge);

  if (isClient) {
    applyNadeSnap(scene, lastSnap?.nades ?? []);
    applyCloudSnap(scene, lastSnap?.clouds ?? []);
    billowClouds(dt);
  } else updateSmoke(scene, dt, world.colliders, applyNadePop);
  updateGore(scene, dt);

  if (match.wire.mode === "carried") {
    if (match.wire.carrierId === actorId()) {
      wirePack.position.set(px + Math.cos(yaw) * 0.25, py + 0.85, pz - Math.sin(yaw) * 0.05);
    } else {
      const mesh = match.wire.carrierId != null ? clientPawns.get(match.wire.carrierId) : undefined;
      const pawn = lastSnap?.pawns.find((p) => p.id === match.wire.carrierId);
      const carrier = bots.find((b) => b.id === match.wire.carrierId);
      if (mesh) wirePack.position.set(mesh.position.x, mesh.position.y + 0.85, mesh.position.z);
      else if (pawn) wirePack.position.set(pawn.x, pawn.y + 0.85, pawn.z);
      else if (carrier) wirePack.position.set(carrier.x, carrier.y + 0.85, carrier.z);
      else wirePack.position.set(match.wire.x, match.wire.y + 0.85, match.wire.z);
    }
    wirePack.visible = match.wire.carrierId !== actorId();
  } else {
    wirePack.visible = true;
    wirePack.position.set(match.wire.x, match.wire.y, match.wire.z);
  }
  bomb.pulse(time, match.phase === "planted" && match.wire.mode === "planted" ? "planted" : match.wire.mode === "planted" ? "ground" : match.wire.mode);

  const cover = smokeCoverage(px, eyeY, pz);
  veilEl.style.opacity = String(cover * 0.92);
  if (flashVeil) flashVeil.style.opacity = String(flashT > 0 ? Math.min(1, flashT * 0.85) : 0);
  if (stunVeil) stunVeil.style.opacity = String(stunT > 0 ? Math.min(0.7, stunT * 0.28) : 0);

  for (let i = tracers.length - 1; i >= 0; i--) {
    tracers[i].t -= dt;
    const mat = tracers[i].line.material as THREE.LineBasicMaterial;
    mat.opacity = Math.max(0, tracers[i].t / 0.07);
    if (tracers[i].t <= 0) {
      scene.remove(tracers[i].line);
      tracers[i].line.geometry.dispose();
      tracers.splice(i, 1);
    }
  }
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.life -= dt;
    s.vel.y -= 12 * dt;
    s.mesh.position.addScaledVector(s.vel, dt);
    s.mesh.scale.setScalar(Math.max(0.01, s.life * 4));
    if (s.life <= 0) {
      scene.remove(s.mesh);
      sparks.splice(i, 1);
    }
  }

  const hm = Number(hitmark.style.opacity || "0");
  if (hm > 0) hitmark.style.opacity = String(Math.max(0, hm - dt * 4));
  const hurt = Number(hurtEl.style.opacity || "0");
  if (hurt > 0) hurtEl.style.opacity = String(Math.max(0, hurt - dt * 1.6));

  tickBanners(time);
  const mePawn =
    isClient && lastSnap && net.peerId != null
      ? lastSnap.pawns.find((p) => (p.netId ?? 0) === net.peerId)
      : null;
  const youTeam = mePawn?.team ?? slotById(match, playerId)?.team ?? "ember";
  const viewId = mePawn?.id ?? playerId;
  const planter = plantingTeam(match);
  let prompt = "";
  if (waitingForPlayers(match)) prompt = "Waiting for players";
  else if (match.phase === "freeze") prompt = "Hold";
  else if (match.phase === "bestplay") prompt = "";
  else if (match.phase === "ending" || match.phase === "matchover") prompt = match.endText;
  else if (match.wire.mode === "carried" && match.wire.carrierId === viewId) {
    const site = inSite(world, "loft", px, pz, py) ? "ICE" : inSite(world, "well", px, pz, py) ? "SLIP" : "";
    prompt = site
      ? "HOLD F · PLANT"
      : `${displayName(slotById(match, viewId)?.name ?? mePawn?.name ?? prefs.name)} has the Bomb · gold pad at A or B`;
  } else if (match.wire.mode === "planted" && youTeam !== planter) {
    if (Math.hypot(px - match.wire.x, pz - match.wire.z) < 1.5) prompt = "HOLD F · CUT THE BOMB";
  } else if (match.phase === "planted") {
    prompt = "Bomb live";
  }
  const nextId = lastSnap?.nextMap;
  updateMatchHud(match, prompt, {
    nextMap: nextId ? MAPS.find((m) => m.id === nextId)?.title ?? nextId : undefined,
  });
  syncKillFeed(lastSnap?.feed, lastSnap?.time ?? time);
  const holdBoard = holdScoreboard(keys, {
    started: document.body.classList.contains("started"),
    studio: studio.on,
    locker: locker.on,
    settings: document.body.classList.contains("settings"),
    admin: document.body.classList.contains("admin"),
    podium: document.body.classList.contains("podium"),
  });
  const showBoard = holdBoard || match.phase === "matchover";
  document.body.classList.toggle("board", holdBoard);
  if (showBoard) {
    renderScoreboard(match, viewId, (id) => {
      if (id === viewId) return net.role === "client" ? net.pingMs : 0;
      const remote = [...remotes.values()].find((x) => x.slotId === id);
      if (remote) return remote.ping;
      const pawn = lastSnap?.pawns.find((p) => p.id === id);
      if (pawn?.ping != null) return pawn.ping;
      if (bots.some((b) => b.id === id)) return null;
      if (pawn && (pawn.netId ?? 0) > 0) return pawn.ping ?? 0;
      return null;
    });
  }
  if (match.phase === "matchover") {
    if (!podiumOn) {
      podiumOn = true;
      hideDeath();
      const ranked = [...(lastSnap?.pawns ?? match.slots.map((s) => ({
        id: s.id,
        name: s.name,
        team: s.team,
        kills: line(s.id).kills,
        assists: line(s.id).assists,
        deaths: line(s.id).deaths,
        absent: false as boolean | undefined,
      })))]
        .filter((p) => !p.absent)
        .map((p) => ({
          id: p.id,
          name: p.name,
          team: p.team,
          kills: p.kills ?? line(p.id).kills,
          assists: p.assists ?? line(p.id).assists,
          deaths: p.deaths ?? line(p.id).deaths,
          skin: "skin" in p ? p.skin : undefined,
          look: "look" in p ? p.look : undefined,
        }))
        .sort((a, b) => b.kills - a.kills || b.assists - a.assists || a.deaths - b.deaths)
        .slice(0, 3);
      showPodium(match, ranked);
      mountPodium(scene, world, ranked);
    }
  } else if (podiumOn) {
    podiumOn = false;
    hidePodium();
    clearPodium(scene);
    ghost.visible = false;
  }
  updateHud({
    hp,
    hpMax: HP_MAX,
    alive,
    stance: !alive ? "Down" : prone ? "Prone" : crouch ? "Crouch" : "Stand",
    x: px,
    y: py,
    z: pz,
    lastDamage,
    mag,
    magMax: magCap(),
    reloading,
    kills,
    deaths,
    yaw,
    bots:
      isClient && lastSnap
        ? lastSnap.pawns
            .filter((p) => (p.netId ?? 0) !== (net.peerId ?? -1) && !p.absent)
            .map((p) => ({ x: p.x, z: p.z, team: p.team, hp: p.alive ? p.hp : 0 }))
        : [
            ...bots.map((b) => ({ x: b.x, z: b.z, team: b.team, hp: b.hp })),
            ...[...remotes.values()].map((r) => ({
              x: r.x,
              z: r.z,
              team: r.team,
              hp: r.alive ? r.hp : 0,
            })),
          ],
    world,
    smokes: nadeBag.smoke,
    smokeMax: NADE_MAX.smoke,
    nades: nadeBag,
    nadeKind,
    clouds: lastSnap?.clouds ?? activeClouds(),
    air: lastSnap?.nades ?? activeNades(),
    weapon: weapon === "rifle" ? rifleKind : weapon,
    rifleName: RIFLES[rifleKind].name,
    spread: watching ? (lastReelAds ? 8 : 26) : spreadPx(hipSpread),
    youTeam,
    minimapEnemies: rules.minimapEnemies,
    bomb: { x: match.wire.x, z: match.wire.z, mode: match.wire.mode },
  });

  const netLine = statusLine(net);
  if (netLine) match.lastJoin = netLine;
  paintNetMeter(
    document.body.classList.contains("started") && net.role === "client"
      ? { ping: net.pingMs, hz: net.snapHz, kbps: net.inKbps }
      : null,
  );

  if (net.role === "host") {
    const snap = buildSnapshot(
      match,
      {
        id: playerId,
        netId: net.peerId ?? 0,
        name: slotById(match, playerId)?.name ?? prefs.name,
        team: slotById(match, playerId)?.team ?? "ember",
        x: px,
        y: py,
        z: pz,
        yaw,
        pitch,
        hp,
        alive,
        weapon: weapon === "rifle" ? rifleKind : weapon,
        ads,
        crouch,
        prone,
        nades: { ...nadeBag },
        kills: line(playerId).kills,
        assists: line(playerId).assists,
        deaths: line(playerId).deaths,
        ping: 0,
        skin: prefs.skin,
        look: packLook(prefs.look),
        cow: isCow(playerId),
      },
      bots,
      remotes,
      mapId,
      time,
    );
    for (const p of snap.pawns) p.cow = isCow(p.id);
    net.sendSnapshot(snap);
  }
  if (net.role === "client") {
    net.sendInput(
      collectInput({
        keys: studio.on || locker.on ? new Set() : keys,
        yaw,
        pitch,
        fire: studio.on || locker.on || isCow(playerId) ? false : wantShot,
        ads: studio.on || locker.on ? false : ads,
        lean: studio.on || locker.on ? 0 : lean,
        weapon: weapon === "rifle" ? rifleKind : weapon,
        crouch: studio.on || locker.on ? false : crouch,
        prone: studio.on || locker.on ? false : prone,
        jump: studio.on || locker.on ? false : keys.has("Space"),
        use: studio.on || locker.on ? false : wantUse,
        ping: net.pingMs,
      }),
    );
  }

  if (locker.on) {
    for (const g of clientPawns.values()) g.visible = false;
    for (const b of bots) b.root.visible = false;
    ghost.visible = false;
    showRifle(rifleKind, false);
    setKarGlass(rifleKind, false, 0);
    knife.visible = false;
    nadeView.visible = false;
    arm.root.visible = false;
    studioGhost.visible = false;
    lockerPawn.visible = true;
    const want = lockerCamTarget();
    const ease = 1 - Math.exp(-dt * 8);
    locker.dist += (want.dist - locker.dist) * ease;
    locker.aimY += (want.aimY - locker.aimY) * ease;
    locker.fov += (want.fov - locker.fov) * ease;
    if (!locker.dragging) locker.phi += dt * 0.2;
    applyLockerCam();
  } else if (studio.on) {
    if (studio.drag?.mode !== "peg") studioPeg.visible = false;
    for (const g of clientPawns.values()) g.visible = false;
    for (const b of bots) b.root.visible = false;
    ghost.visible = false;
    knife.visible = false;
    nadeView.visible = false;
    if (studio.walk) {
      const height = 1.78;
      const speed = tuning.walk;
      const gh = groundHeight(world.colliders, px, pz, RADIUS, py);
      grounded = py <= gh + 0.06 && vy <= 0.2;
      const forwardX = -Math.sin(yaw);
      const forwardZ = -Math.cos(yaw);
      const rightX = Math.cos(yaw);
      const rightZ = -Math.sin(yaw);
      let wx = 0;
      let wz = 0;
      if (keys.has("KeyW")) {
        wx += forwardX;
        wz += forwardZ;
      }
      if (keys.has("KeyS")) {
        wx -= forwardX;
        wz -= forwardZ;
      }
      if (keys.has("KeyD")) {
        wx += rightX;
        wz += rightZ;
      }
      if (keys.has("KeyA")) {
        wx -= rightX;
        wz -= rightZ;
      }
      const len = Math.hypot(wx, wz);
      if (len > 0) {
        const n = collideXZ(
          world.colliders,
          px + (wx / len) * speed * dt,
          pz + (wz / len) * speed * dt,
          RADIUS,
          py + 0.08,
          py + height,
        );
        px = n.x;
        pz = n.z;
      }
      if (grounded && keys.has("Space") && !jumpHeld) {
        vy = jumpSpeed();
        grounded = false;
      }
      jumpHeld = keys.has("Space");
      if (grounded && vy <= 0) {
        py = gh;
        vy = 0;
      } else {
        vy += -tuning.gravity * dt;
        py += vy * dt;
        const g2 = groundHeight(world.colliders, px, pz, RADIUS, py);
        if (py < g2) {
          py = g2;
          vy = 0;
          grounded = true;
        }
      }
      if (py < -3.2) {
        py = 0;
        vy = 0;
      }
      camera.near = 0.05;
      camera.fov = 90;
      camera.position.set(px, py + 1.64, pz);
      camera.rotation.order = "YXZ";
      camera.rotation.x = pitch;
      camera.rotation.y = yaw;
      camera.rotation.z = 0;
      camera.updateProjectionMatrix();
      showRifle(rifleKind, true);
      setKarGlass(rifleKind, false, 0);
      const hold = liveRifle();
      hold.root.position.copy(hold.hipPos);
      hold.root.rotation.set(0.1, 0.22, 0.06);
      poseBolt(hold, 0);
      hold.root.updateMatrixWorld(true);
      arm.root.visible = true;
      poseArm(arm, rifleWrist(hold, 0));
      if (isOpeningTool(studio.tool)) {
        studioAim.set(0, 0, -1).applyQuaternion(camera.quaternion);
        const wall = pickBuildingWall(studio.spec, camera.position, studioAim);
        if (wall) {
          const pose = openingPose(wall, studio.tool);
          studioGhost.visible = true;
          studioGhost.scale.set(pose.sx, pose.sy, pose.sz);
          studioGhost.position.set(pose.x, pose.y, pose.z);
        } else studioGhost.visible = false;
      } else if (studio.tool === "wall") {
        studioAim.set(0, 0, -1).applyQuaternion(camera.quaternion);
        const ground = aimGround(camera.position, studioAim);
        if (ground) {
          const foot = wallFootprint(ground.x, ground.z, ground.x, ground.z, yaw);
          const y = interiorYAt(studio.spec, foot.x, foot.z, py);
          const sy = wallHeightAt(studio.spec, foot.x, foot.z, y);
          studioGhost.visible = true;
          studioGhost.scale.set(foot.w, sy, foot.d);
          studioGhost.position.set(foot.x, y + sy / 2, foot.z);
        } else studioGhost.visible = false;
      } else if (studio.tool === "floor" || studio.tool === "cut") {
        studioAim.set(0, 0, -1).applyQuaternion(camera.quaternion);
        const ground = aimGround(camera.position, studioAim);
        if (ground) {
          const gx = snap(ground.x);
          const gz = snap(ground.z);
          const y = surfaceAt(studio.spec, gx, gz);
          if (studio.tool === "floor") {
            const fit = snapFloor(studio.spec, gx, gz, gx, gz, y);
            studioGhost.visible = true;
            studioGhost.scale.set(fit.w, 0.16, fit.d);
            studioGhost.position.set(fit.x, fit.y - 0.08, fit.z);
          } else {
            const [sx, sy, sz] = ghostSize("cut", GRID, GRID);
            studioGhost.visible = true;
            studioGhost.scale.set(sx, sy, sz);
            studioGhost.position.set(gx, Math.max(SLAB_Y, y) - 0.08, gz);
          }
        } else studioGhost.visible = false;
      } else if (isAccessoryTool(studio.tool) && studio.tool !== "erase") {
        studioAim.set(0, 0, -1).applyQuaternion(camera.quaternion);
        const ground = aimGround(camera.position, studioAim);
        if (ground) {
          const [sx, sy, sz] = ghostSize(studio.tool, STAMP, STAMP);
          const gx = studio.tool === "crate" ? snapCell(ground.x) : snap(ground.x);
          const gz = studio.tool === "crate" ? snapCell(ground.z) : snap(ground.z);
          studioGhost.visible = true;
          studioGhost.scale.set(sx, sy, sz);
          studioGhost.position.set(gx, surfaceAt(studio.spec, gx, gz) + sy / 2, gz);
        } else studioGhost.visible = false;
      } else studioGhost.visible = false;
      studioSel.visible = false;
    } else {
      showRifle(rifleKind, false);
      setKarGlass(rifleKind, false, 0);
      arm.root.visible = false;
      applyOrbit(camera, studio.cam);
      studioSel.visible = false;
      if (studio.drag?.mode === "marquee") {
        const w = Math.max(0.4, Math.abs(studio.drag.x1 - studio.drag.x0));
        const d = Math.max(0.4, Math.abs(studio.drag.z1 - studio.drag.z0));
        studioGhost.visible = true;
        studioGhost.scale.set(w, 0.12, d);
        studioGhost.position.set((studio.drag.x0 + studio.drag.x1) / 2, 0.08, (studio.drag.z0 + studio.drag.z1) / 2);
      } else if (studio.drag?.mode === "move" || studio.drag?.mode === "resize") {
        const item = studio.drag.item ?? studio.sels[0];
        const box = item ? itemBox(studio.spec, item) : null;
        if (box) {
          studioGhost.visible = true;
          studioGhost.scale.set(box.sx, box.sy, box.sz);
          studioGhost.position.set(box.x, box.y, box.z);
        } else studioGhost.visible = false;
      } else if (studio.drag?.mode === "rect") {
        if (studio.tool === "floor") {
          const fit = snapFloor(studio.spec, studio.drag.x0, studio.drag.z0, studio.drag.x1, studio.drag.z1, studio.drag.y);
          studioGhost.visible = true;
          studioGhost.scale.set(fit.w, 0.16, fit.d);
          studioGhost.position.set(fit.x, fit.y - 0.08, fit.z);
        } else if (studio.tool === "cut") {
          const w = Math.max(0.4, Math.abs(studio.drag.x1 - studio.drag.x0));
          const d = Math.max(0.4, Math.abs(studio.drag.z1 - studio.drag.z0));
          const y = rectSurfaceY(studio.spec, studio.drag.x0, studio.drag.z0, studio.drag.x1, studio.drag.z1);
          studioGhost.visible = true;
          studioGhost.scale.set(w, 0.16, d);
          studioGhost.position.set((studio.drag.x0 + studio.drag.x1) / 2, Math.max(SLAB_Y, y) - 0.08, (studio.drag.z0 + studio.drag.z1) / 2);
        } else if (studio.tool === "wall") {
          const foot = wallFootprint(studio.drag.x0, studio.drag.z0, studio.drag.x1, studio.drag.z1, studio.faceYaw);
          const y = interiorYAt(studio.spec, foot.x, foot.z, studio.drag.y);
          const sy = wallHeightAt(studio.spec, foot.x, foot.z, y);
          studioGhost.visible = true;
          studioGhost.scale.set(foot.w, sy, foot.d);
          studioGhost.position.set(foot.x, y + sy / 2, foot.z);
        } else if (studio.tool === "area") {
          const w = Math.max(GRID, Math.abs(studio.drag.x1 - studio.drag.x0));
          const d = Math.max(GRID, Math.abs(studio.drag.z1 - studio.drag.z0));
          studioGhost.visible = true;
          studioGhost.scale.set(w, 0.12, d);
          studioGhost.position.set((studio.drag.x0 + studio.drag.x1) / 2, 0.06, (studio.drag.z0 + studio.drag.z1) / 2);
        } else {
          const w = Math.max(GRID, Math.abs(studio.drag.x1 - studio.drag.x0));
          const d = Math.max(GRID, Math.abs(studio.drag.z1 - studio.drag.z0));
          const [, sy] = ghostSize(studio.tool, w, d);
          const y = rectSurfaceY(studio.spec, studio.drag.x0, studio.drag.z0, studio.drag.x1, studio.drag.z1);
          studioGhost.visible = true;
          studioGhost.scale.set(w, sy, d);
          studioGhost.position.set((studio.drag.x0 + studio.drag.x1) / 2, y + sy / 2, (studio.drag.z0 + studio.drag.z1) / 2);
        }
      } else if (isOpeningTool(studio.tool) || studio.tool === "ladder") {
        const ground = studioHit();
        const wall = ground ? nearestBuildingWall(studio.spec, ground.x, ground.z, surfaceAt(studio.spec, ground.x, ground.z)) : null;
        if (wall) {
          const pose = studio.tool === "ladder" ? ladderPose(wall) : openingPose(wall, studio.tool);
          studioGhost.visible = true;
          studioGhost.scale.set(pose.sx, pose.sy, pose.sz);
          studioGhost.position.set(pose.x, pose.y, pose.z);
        } else studioGhost.visible = false;
      } else if (studio.tool === "select" || studio.tool === "erase") {
        studioGhost.visible = false;
      } else {
        const hit = studioHit();
        const show = !!hit;
        studioGhost.visible = show;
        if (hit && show) {
          if (studio.tool === "floor") {
            const gx = snap(hit.x);
            const gz = snap(hit.z);
            const fit = snapFloor(studio.spec, gx, gz, gx, gz, surfaceAt(studio.spec, gx, gz));
            studioGhost.scale.set(fit.w, 0.16, fit.d);
            studioGhost.position.set(fit.x, fit.y - 0.08, fit.z);
          } else if (studio.tool === "cut") {
            const [sx, sy, sz] = ghostSize("cut", GRID, GRID);
            studioGhost.scale.set(sx, sy, sz);
            studioGhost.position.set(snap(hit.x), Math.max(SLAB_Y, surfaceAt(studio.spec, hit.x, hit.z)) - 0.08, snap(hit.z));
          } else if (studio.tool === "wall") {
            const foot = wallFootprint(hit.x, hit.z, hit.x, hit.z, studio.faceYaw);
            const y = interiorYAt(studio.spec, foot.x, foot.z);
            const h = wallHeightAt(studio.spec, foot.x, foot.z, y);
            studioGhost.scale.set(foot.w, h, foot.d);
            studioGhost.position.set(foot.x, y + h / 2, foot.z);
          } else if (studio.tool === "area") {
            studioGhost.scale.set(STAMP, 0.12, STAMP);
            studioGhost.position.set(snapCell(hit.x), 0.06, snapCell(hit.z));
          } else {
            const [sx, sy, sz] = ghostSize(studio.tool, STAMP, STAMP);
            const gx = studio.tool === "crate" ? snapCell(hit.x) : snap(hit.x);
            const gz = studio.tool === "crate" ? snapCell(hit.z) : snap(hit.z);
            const y = isRectTool(studio.tool) ? surfaceAt(studio.spec, hit.x, hit.z) : 0;
            studioGhost.scale.set(sx, sy, sz);
            studioGhost.position.set(gx, y + sy / 2, gz);
          }
        }
      }
    }
  } else {
    studioGhost.visible = false;
    studioSel.visible = false;
    lockerPawn.visible = false;
  }

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
