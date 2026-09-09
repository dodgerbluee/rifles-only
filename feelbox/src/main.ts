/**
 * Rifles Only — Last Wire on Wharf. 5v5, bots fill seats, a join takes a bot's slot.
 */
import "./style.css";
import * as THREE from "three";
import { collideXZ, groundHeight, inSite, rayShot, rayWorld, spawnYaw } from "./world";
import { buildMap, MAPS, compileLayout, type MapId } from "./maps";
import { botTargets, createBots, despawnBot, HEAD_POP_RATE, hurtBot, popHead, popPawnHead, refillBotPawn, resetBots, restoreHead, restorePawnHead, spawnBot, updateBots, updateGore, type Bot } from "./bots";
import {
  hideDeath,
  hidePodium,
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
  createMatch,
  dropWire,
  restartMatch,
  humanCount,
  humanSlot,
  markDead,
  pickupWire,
  plantingTeam,
  plantWire,
  roundCombatOpen,
  roundFrozen,
  slotById,
  tickMatch,
  trySkipBestPlay,
  vacateSlot,
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
  canvasNdc,
  cellKey,
  clampBuildSize,
  defaultOrbit,
  deleteItem,
  downloadSpec,
  ghostSize,
  isAccessoryTool,
  isOpeningTool,
  isRectTool,
  itemBox,
  loadStored,
  makeLotHandles,
  makeStudioGrid,
  moveItem,
  nearestBuildingWall,
  openingPose,
  orbitDrag,
  panDrag,
  paletteOf,
  pickGround,
  pickItem,
  pickLotEdge,
  place,
  placeBuildingRect,
  postDraft,
  resizeNearestBuilding,
  saveStored,
  setLotEdge,
  snap,
  surfaceAt,
  toolFromCode,
  toolsFor,
  turnYaw,
  zoomOrbit,
  type LotEdge,
  type PaletteId,
  type StudioItem,
  type ToolId,
} from "./maps/studio";
import { buildPawn, pawnStyle, poseStance, setPawnCloth, SKINS, stepWalkFromPos, teamCloth } from "./pawn";
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
  samplePoses,
  PLAY_RATE,
  watchLabel,
  type KillClip,
  type Pose,
} from "./replay";
import {
  makeKar98,
  makeMosin,
  makeKnife,
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
import { connectNet, fetchServers, playWsUrl, serverGone, setNetName, setNetSkin, type NetHandle, type Snapshot } from "./net";
import {
  applyMatchSnap,
  buildSnapshot,
  collectInput,
  dropPeer,
  reconcilePos,
  restoreHomeSeats,
  seatPeer,
  statusLine,
  syncClientPawns,
  tickRemote,
  type Remote,
} from "./peers";
import { prefs, savePrefs } from "./prefs";
import { setStepVolume, tickSteps } from "./steps";
import { applyLine, noteHit, noteKill, line, resetStats, swapLines } from "./stats";
import { jumpSpeed, tuning } from "./tuning";

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
let mapId: MapId = "wharf";
let world = buildMap(scene, mapId);
const studioGhost = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshBasicMaterial({ color: 0xc8c4bc, transparent: true, opacity: 0.38, depthWrite: false }),
);
studioGhost.visible = false;
studioGhost.frustumCulled = false;
scene.add(studioGhost);
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
  spec: blankSpec(),
  tool: "select" as ToolId,
  palette: "build" as PaletteId,
  lastKit: "crate" as ToolId,
  sel: null as StudioItem | null,
  bw: 12,
  bd: 10,
  cam: defaultOrbit(blankSpec().bounds),
  faceYaw: 0,
  mx: innerWidth / 2,
  my: innerHeight / 2,
  painting: false,
  orbiting: false,
  panning: false,
  walk: false,
  drag: null as null | {
    mode: "rect" | "move" | "lot";
    x0: number;
    z0: number;
    x1: number;
    z1: number;
    y: number;
    edge?: LotEdge;
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
  dist: 3.55,
  theta: 1.12,
  phi: Math.PI,
};
const match = createMatch();
{
  const you = humanSlot(match);
  if (you) you.name = prefs.name;
  setNetName(prefs.name);
  setNetSkin(prefs.skin);
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
    sendInput() {},
    sendSnapshot() {},
    sendEvent() {},
    onRole() {},
    onStatus() {},
    onInput() {},
    onSnapshot() {},
    onEvent() {},
    onPeerJoin() {},
    onPeerLeave() {},
    destroy() {},
  };
}

let net: NetHandle = idleNet();
const remotes = new Map<number, Remote>();
const clientPawns = new Map<number, THREE.Group>();
let lastSnap: Snapshot | null = null;
let snapSeq = 0;
let appliedSeq = -1;

let lastBeat = 0;
let refreshServers: () => Promise<void> = async () => {};

function bindNet(handle: NetHandle) {
  handle.onSnapshot((snap) => {
    lastSnap = snap;
    snapSeq += 1;
    lastBeat = performance.now();
  });
  handle.onRole((role) => {
    if (role === "client") lastBeat = performance.now();
    if (role === "client" && prefs.team && document.body.classList.contains("started")) {
      handle.sendEvent({ kind: "joinTeam", team: prefs.team, name: prefs.name, skin: prefs.skin });
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
    document.body.classList.remove("studio", "studio-nav", "studio-walk", "locker", "locker-drag");
    locker.on = false;
    lockerPawn.visible = false;
  }
  net.destroy();
  net = idleNet();
  bindNet(net);
  lastSnap = null;
  lastBeat = 0;
  joiningName = "";
  hideJoinTeam();
  document.body.classList.remove("started", "playing", "admin", "settings", "dead", "ads", "podium");
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
    } else {
      el.textContent = "";
      el.hidden = true;
    }
  }
  const connecting = net.status === "connecting";
  const picking = awaitingTeamPick();
  if (list) list.hidden = connecting || picking;
  if (pick) pick.hidden = !picking;
  if (panel) {
    panel.hidden = !connecting && !picking;
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
let cowMesh: THREE.Group | null = null;
let podiumOn = false;

function isCow(id: number) {
  return cowId === id && time < cowUntil;
}

function clearCow() {
  cowUntil = 0;
  cowId = null;
  if (cowMesh) {
    scene.remove(cowMesh);
    cowMesh = null;
  }
  for (const b of bots) if (b.hp > 0) b.root.visible = true;
  for (const r of remotes.values()) r.root.visible = true;
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
  clearCow();
  cowId = slot.id;
  cowUntil = time + 5;
  cowMesh = makeCowMesh();
  scene.add(cowMesh);
  const b = bots.find((x) => x.id === slot.id);
  if (b) b.root.visible = false;
  const r = [...remotes.values()].find((x) => x.slotId === slot.id);
  if (r) r.root.visible = false;
}

function explodeCow() {
  const id = cowId;
  let x = px;
  let y = py;
  let z = pz;
  const b = bots.find((t) => t.id === id);
  const r = [...remotes.values()].find((t) => t.slotId === id);
  if (b) {
    x = b.x;
    y = b.y;
    z = b.z;
  } else if (r) {
    x = r.x;
    y = r.y;
    z = r.z;
  }
  playBlast(x, y, z);
  if (id === playerId || id === possessId) hurtPlayer(400, "a flaming cow", undefined, true);
  else if (b && hurtBot(b, 400, time)) markDead(match, b.id, b.x, b.y, b.z);
  else if (r) {
    r.hp = 0;
    r.alive = false;
    markDead(match, r.slotId, r.x, r.y, r.z);
  }
  clearCow();
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
  const sel = document.querySelector<HTMLSelectElement>("#admin-map");
  if (sel && sel.value !== mapId) sel.value = mapId;
  paintTeamPick();
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
    net.sendEvent({ kind: "joinTeam", team, name: prefs.name, skin: prefs.skin });
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
  const seat = claimSlot(match, team, prefs.name.trim() || "You");
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
  const gfig = buildPawn(ghost, team);
  ghost.userData.body = gfig.body;
  ghost.userData.cloth = gfig.cloth;
  roundSpawn();
  paintTeamPick();
}

function loadMap(id: MapId, force = false) {
  if (!force && id === mapId && net.role !== "client") {
    paintMapPick();
    return;
  }
  mapId = id;
  clearCow();
  if (net.role !== "client") {
    for (const b of [...bots]) despawnBot(scene, bots, b.id);
  }
  wipeMapMeshes();
  world = buildMap(scene, id);
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

function wipeMapMeshes() {
  const keep = new Set<THREE.Object3D>([
    camera,
    ghost,
    wirePack,
    studioGhost,
    studioSel,
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

function setStudioTool(id: ToolId) {
  studio.tool = id;
  studio.palette = paletteOf(id);
  if (isAccessoryTool(id)) studio.lastKit = id;
  if (studio.walk && !isAccessoryTool(id) && id !== "select") leaveWalk();
  paintStudio();
}

function paintStudio() {
  document.body.classList.toggle("studio", studio.on);
  document.body.classList.toggle("studio-walk", studio.on && studio.walk);
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
  if (del) del.disabled = !studio.sel;
  const hint = document.querySelector("#studio-hint");
  if (hint) {
    hint.textContent = studio.walk
      ? "WASD move · click lock look · click to drop accessories · Esc orbit"
      : "Build in orbit · drag lot rims · Select then drag or Delete · Walk drops accessories · Esc leave";
  }
  const status = document.querySelector("#studio-status");
  const b = studio.spec.bounds;
  if (status) {
    const sel = studio.sel ? ` · ${studio.sel.kind}` : "";
    status.textContent = `${studio.spec.title} · lot ${b.maxX - b.minX}×${b.maxZ - b.minZ}${sel}`;
  }
}

function rebuildStudio() {
  wipeMapMeshes();
  world = compileLayout(scene, studio.spec, { clay: !studio.walk });
  afterMapLoad();
  if (!studio.walk) {
    scene.add(makeStudioGrid(studio.spec.bounds));
    scene.add(makeLotHandles(studio.spec.bounds));
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

function enterStudio() {
  if (locker.on) leaveLocker(false);
  studio.on = true;
  studio.walk = false;
  studio.drag = null;
  studio.sel = null;
  studio.tool = "select";
  studio.palette = "build";
  studio.spec = loadStored() ?? blankSpec();
  studio.cam = defaultOrbit(studio.spec.bounds);
  studio.faceYaw = 0;
  studio.painting = false;
  studio.orbiting = false;
  studio.panning = false;
  studio.lastCell = "";
  const titleEl = document.querySelector<HTMLInputElement>("#studio-title")!;
  const themeEl = document.querySelector<HTMLSelectElement>("#studio-theme")!;
  titleEl.value = studio.spec.title;
  themeEl.value = studio.spec.theme;
  rebuildStudio();
  paintStudio();
  hideJoinTeam();
  document.body.classList.add("studio");
  document.body.classList.remove("studio-walk");
  applyOrbit(camera, studio.cam);
  document.exitPointerLock();
}

function leaveStudio() {
  studio.on = false;
  studio.walk = false;
  studio.drag = null;
  studio.sel = null;
  studio.painting = false;
  studio.orbiting = false;
  studio.panning = false;
  studio.lastCell = "";
  studioGhost.visible = false;
  studioSel.visible = false;
  document.body.classList.remove("studio", "studio-nav", "studio-walk");
  camera.near = 0.05;
  camera.far = 85;
  camera.fov = 90;
  camera.updateProjectionMatrix();
  loadMap(mapId, true);
}

function paintLocker() {
  const panel = document.querySelector<HTMLElement>("#locker");
  if (panel) panel.hidden = !locker.on;
  const nameEl = document.querySelector<HTMLInputElement>("#locker-name");
  if (nameEl && nameEl !== document.activeElement) nameEl.value = prefs.name;
  const kits = document.querySelector("#locker-kits");
  if (kits && !kits.childElementCount) {
    for (const k of SKINS) {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.skin = k.id;
      b.innerHTML = `<b>${k.label}</b><span>${k.blurb}</span>`;
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        prefs.skin = k.id;
        setNetSkin(k.id);
        savePrefs();
        dressLockerPawn();
        paintLocker();
      });
      kits.append(b);
    }
  }
  kits?.querySelectorAll("button").forEach((b) => {
    b.classList.toggle("on", (b as HTMLButtonElement).dataset.skin === prefs.skin);
  });
  document.querySelectorAll<HTMLButtonElement>("#locker-sides button").forEach((b) => {
    b.classList.toggle("on", b.dataset.side === locker.team);
  });
  const title = document.querySelector("#start-title");
  const blurb = document.querySelector("#start-blurb");
  if (title) title.textContent = locker.on ? "Player" : "Servers";
  if (blurb) {
    blurb.textContent = locker.on
      ? "Pick a kit. Ember and Stone colors apply when you join."
      : "Pick a match. Ember plants the Wire. First to six.";
  }
}

function dressLockerPawn() {
  pawnStyle.current = "limbs";
  buildPawn(lockerPawn, locker.team, 0, prefs.skin);
  lockerPawn.visible = true;
}

function applyLockerCam() {
  const { dist, theta, phi } = locker;
  camera.position.set(
    dist * Math.sin(theta) * Math.sin(phi),
    1.05 + dist * Math.cos(theta),
    dist * Math.sin(theta) * Math.cos(phi),
  );
  camera.lookAt(0, 1.05, 0);
  camera.fov = 42;
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
  applyLockerCam();
}

function enterLocker() {
  if (studio.on) leaveStudio();
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

function enterWalk() {
  studio.walk = true;
  studio.painting = false;
  studio.orbiting = false;
  studio.panning = false;
  studio.drag = null;
  studio.sel = null;
  if (!isAccessoryTool(studio.tool)) setStudioTool(studio.lastKit);
  const spawn = walkSpawn();
  px = spawn.x;
  pz = spawn.z;
  py = 0.02;
  vy = 0;
  yaw = 0;
  pitch = 0;
  rebuildStudio();
  paintStudio();
  canvas.requestPointerLock();
}

function leaveWalk() {
  studio.walk = false;
  studio.drag = null;
  document.exitPointerLock();
  rebuildStudio();
  paintStudio();
  applyOrbit(camera, studio.cam);
}

function bumpLotEdge(edge: LotEdge, value: number) {
  const next = setLotEdge(studio.spec, edge, value);
  if (next === studio.spec) return;
  studio.spec = next;
  saveStored(studio.spec);
  rebuildStudio();
  paintStudio();
}

function deleteStudioSel() {
  if (!studio.sel) return;
  const next = deleteItem(studio.spec, studio.sel);
  if (next === studio.spec) return;
  studio.spec = next;
  studio.sel = null;
  saveStored(studio.spec);
  rebuildStudio();
  paintStudio();
}

function stampOpening() {
  if (!isOpeningTool(studio.tool)) return;
  const ground = studioHit();
  const hit = ground ? nearestBuildingWall(studio.spec, ground.x, ground.z, surfaceAt(studio.spec, ground.x, ground.z)) : null;
  const status = document.querySelector("#studio-status");
  if (!hit) {
    if (status) status.textContent = "aim a building wall";
    return;
  }
  studio.spec = addOpening(studio.spec, studio.tool, hit);
  saveStored(studio.spec);
  rebuildStudio();
  paintStudio();
  if (status) status.textContent = `placed ${studio.tool}`;
}

function commitBuildDrag() {
  const drag = studio.drag;
  studio.drag = null;
  studio.painting = false;
  studio.lastCell = "";
  if (!drag || drag.mode !== "rect") return;
  const w = Math.abs(drag.x1 - drag.x0);
  const d = Math.abs(drag.z1 - drag.z0);
  if (w >= 4 || d >= 4) {
    studio.spec = placeBuildingRect(studio.spec, drag.x0, drag.z0, drag.x1, drag.z1, studio.tool, studio.faceYaw, drag.y);
    studio.bw = clampBuildSize(w);
    studio.bd = clampBuildSize(d);
  } else {
    studio.spec = place(studio.spec, studio.tool, drag.x0, drag.z0, {
      yaw: studio.faceYaw,
      bw: studio.bw,
      bd: studio.bd,
      y: drag.y,
    });
  }
  saveStored(studio.spec);
  rebuildStudio();
  paintStudio();
  const status = document.querySelector("#studio-status");
  if (status) status.textContent = `placed ${studio.tool}`;
}

function studioHit() {
  const ndc = canvasNdc(canvas, studio.mx, studio.my);
  return pickGround(camera, ndc.x, ndc.y);
}

function stampStudio() {
  if (studio.tool === "select" || isRectTool(studio.tool) || isOpeningTool(studio.tool)) return;
  const hit = studioHit();
  if (!hit) return;
  const gx = snap(hit.x);
  const gz = snap(hit.z);
  const key = cellKey(studio.tool, gx, gz);
  if (key === studio.lastCell) return;
  studio.lastCell = key;
  studio.spec = place(studio.spec, studio.tool, gx, gz, {
    yaw: studio.faceYaw,
    bw: studio.bw,
    bd: studio.bd,
    y: surfaceAt(studio.spec, gx, gz),
  });
  saveStored(studio.spec);
  rebuildStudio();
  paintStudio();
  const status = document.querySelector("#studio-status");
  if (status) status.textContent = `placed ${studio.tool}`;
}

function stampWalkAccessory() {
  if (!isAccessoryTool(studio.tool)) return;
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const hit = aimGround(camera.position, dir);
  if (!hit) return;
  const gx = snap(hit.x);
  const gz = snap(hit.z);
  studio.spec = place(studio.spec, studio.tool, gx, gz, {
    yaw: studio.faceYaw,
    y: surfaceAt(studio.spec, gx, gz),
  });
  saveStored(studio.spec);
  rebuildStudio();
  paintStudio();
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

function rebuildPawns() {
  pawnStyle.current = rules.classicPawn ? "classic" : "limbs";
  for (const b of bots) refillBotPawn(b);
  const youTeam = slotById(match, playerId)?.team ?? "ember";
  const gfig = buildPawn(ghost, youTeam, playerId, prefs.skin);
  ghost.userData.body = gfig.body;
  ghost.userData.cloth = gfig.cloth;
  for (const r of remotes.values()) {
    const fig = buildPawn(r.root, r.team, r.slotId, r.skin);
    r.root.userData.body = fig.body;
    r.root.userData.cloth = fig.cloth;
  }
  for (const g of clientPawns.values()) {
    const team = (g.userData.team as "ember" | "stone") ?? "ember";
    const id = typeof g.userData.id === "number" ? g.userData.id : undefined;
    const fig = buildPawn(g, team, id, g.userData.skin);
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
    net.sendEvent({ kind: "kick", slotId: slot.id });
  },
  onCow: (slot) => {
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

{
  const titleEl = document.querySelector<HTMLInputElement>("#studio-title")!;
  const themeEl = document.querySelector<HTMLSelectElement>("#studio-theme")!;
  titleEl.addEventListener("input", () => {
    studio.spec.title = titleEl.value.slice(0, 24) || "Draft";
    studio.spec.id = studio.spec.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "draft";
  });
  themeEl.addEventListener("change", () => {
    studio.spec.theme = themeEl.value as typeof studio.spec.theme;
    if (studio.on) rebuildStudio();
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
    if (you) you.name = prefs.name.trim() || "You";
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
    void saveStudio();
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
  document.querySelector("#studio-delete")?.addEventListener("click", (e) => {
    e.stopPropagation();
    deleteStudioSel();
  });
  document.querySelector("#studio-pal-build")?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (studio.walk) leaveWalk();
    studio.palette = "build";
    if (!BUILD_IDS.includes(studio.tool)) studio.tool = "select";
    paintStudio();
  });
  document.querySelector("#studio-pal-kit")?.addEventListener("click", (e) => {
    e.stopPropagation();
    studio.palette = "kit";
    if (!KIT_IDS.includes(studio.tool)) studio.tool = studio.lastKit;
    paintStudio();
  });
  document.querySelector("#studio")?.addEventListener("mousedown", (e) => e.stopPropagation());
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

const knife = makeKnife();
knife.visible = false;
poseKnifeRest(knife);
camera.add(knife);

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
  for (const m of MAPS) {
    const o = document.createElement("option");
    o.value = m.id;
    o.textContent = m.title;
    adminMap.append(o);
  }
  adminMap.addEventListener("change", () => {
    net.sendEvent({ kind: "changeMap", mapId: adminMap.value });
  });
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
    if (you) you.name = prefs.name.trim() || "You";
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
  if (e.code === "Space" && match.phase === "bestplay") {
    trySkipReel();
    return;
  }
  keys.add(e.code);
  if (locker.on) {
    if (e.code === "Escape") leaveLocker();
    const n = e.code === "Digit1" || e.code === "Numpad1" ? 0
      : e.code === "Digit2" || e.code === "Numpad2" ? 1
      : e.code === "Digit3" || e.code === "Numpad3" ? 2
      : e.code === "Digit4" || e.code === "Numpad4" ? 3
      : -1;
    const pick = n >= 0 ? SKINS[n] : undefined;
    if (pick) {
      prefs.skin = pick.id;
      setNetSkin(pick.id);
      savePrefs();
      dressLockerPawn();
      paintLocker();
    }
    return;
  }
  if (studio.on) {
    const moveKeys = studio.walk && ["KeyW", "KeyA", "KeyS", "KeyD", "KeyC", "Space", "KeyF"].includes(e.code);
    const tool = moveKeys ? null : toolFromCode(e.code, studio.palette);
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
    if (e.code === "Delete" || e.code === "Backspace" || e.code === "KeyX") {
      deleteStudioSel();
    }
    if (e.code === "BracketLeft" || e.code === "BracketRight") {
      const dw = e.code === "BracketRight" ? 2 : -2;
      const ground = studio.walk ? { x: px, z: pz } : studioHit();
      if (ground) {
        const next = resizeNearestBuilding(studio.spec, ground.x, ground.z, dw, dw);
        if (next !== studio.spec) {
          studio.spec = next;
          saveStored(studio.spec);
          rebuildStudio();
        }
      }
      studio.bw = clampBuildSize(studio.bw + dw);
      studio.bd = clampBuildSize(studio.bd + dw);
      paintStudio();
    }
    if (e.code === "Escape") {
      if (studio.sel) {
        studio.sel = null;
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
    if (document.body.classList.contains("settings")) {
      document.body.classList.remove("settings");
      return;
    }
    if (locked) document.exitPointerLock();
    else if (!document.body.classList.contains("admin")) document.body.classList.add("settings");
  }
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("mousedown", (e) => {
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
      if (e.button === 0 && isAccessoryTool(studio.tool)) stampWalkAccessory();
      return;
    }
    if (e.button === 0) {
      studio.lastCell = "";
      const hit = studioHit();
      if (!hit) return;
      const gx = snap(hit.x);
      const gz = snap(hit.z);
      const edge = pickLotEdge(studio.spec.bounds, hit.x, hit.z);
      if (edge) {
        studio.drag = { mode: "lot", x0: gx, z0: gz, x1: gx, z1: gz, y: 0, edge };
        studio.painting = true;
        return;
      }
      if (studio.tool === "select") {
        const item = pickItem(studio.spec, gx, gz);
        studio.sel = item;
        if (item) {
          const pos = itemBox(studio.spec, item);
          studio.drag = {
            mode: "move",
            x0: gx,
            z0: gz,
            x1: gx,
            z1: gz,
            y: 0,
            item,
            ox: pos?.x ?? gx,
            oz: pos?.z ?? gz,
          };
          studio.painting = true;
        }
        paintStudio();
        return;
      }
      if (isOpeningTool(studio.tool)) {
        stampOpening();
        return;
      }
      if (isRectTool(studio.tool)) {
        studio.drag = { mode: "rect", x0: gx, z0: gz, x1: gx, z1: gz, y: surfaceAt(studio.spec, gx, gz) };
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
    if (e.button === 0) {
      if (studio.drag?.mode === "rect") commitBuildDrag();
      else if (studio.drag?.mode === "move" || studio.drag?.mode === "lot") {
        studio.drag = null;
        saveStored(studio.spec);
        rebuildStudio();
        paintStudio();
      }
      studio.painting = false;
      studio.lastCell = "";
    }
    if (e.button === 2) studio.orbiting = false;
    if (e.button === 1) studio.panning = false;
    document.body.classList.toggle("studio-nav", studio.orbiting || studio.panning);
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
    locker.dist = Math.max(2.6, Math.min(7.5, locker.dist * k));
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
        if (studio.drag.mode === "lot" && studio.drag.edge) {
          bumpLotEdge(studio.drag.edge, studio.drag.edge === "n" || studio.drag.edge === "s" ? hit.z : hit.x);
        } else if (studio.drag.mode === "move" && studio.drag.item) {
          const dx = gx - studio.drag.x0;
          const dz = gz - studio.drag.z0;
          const next = moveItem(studio.spec, studio.drag.item, (studio.drag.ox ?? 0) + dx, (studio.drag.oz ?? 0) + dz);
          if (next !== studio.spec) {
            studio.spec = next;
            rebuildStudio();
          }
        }
      }
    } else if (studio.painting) stampStudio();
    return;
  }
  if (!locked || !alive) return;
  const scale = (ads ? 0.42 : 1) * MOUSE * prefs.sens * (stunT > 0 ? 0.28 : 1);
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
  const fig = buildPawn(root, "ember");
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
  if (cowId != null && isCow(cowId)) ids.push(cowId);
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
    const hit = meleeTarget(origin, dir, bodies, tuning.melee, you, rules.friendlyFire, [actorId()]);
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
  const worldHit = rayWorld(origin, dir, tuning.melee, world.colliders);
  if (!hit || hit.distance > tuning.melee) return;
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

function bang(freq: number, dur: number, gain = 0.07) {
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
}

let plantCue = false;
let holdTick = 0;
let plantBannerUntil = 0;
let lastBombSec = -1;

function playPlantStart() {
  bang(180, 0.14, 0.11);
  window.setTimeout(() => bang(240, 0.2, 0.1), 90);
}

function playCutStart() {
  bang(140, 0.12, 0.1);
  window.setTimeout(() => bang(190, 0.16, 0.09), 80);
}

function playPlanted() {
  bang(392, 0.16, 0.14);
  window.setTimeout(() => bang(523, 0.18, 0.13), 120);
  window.setTimeout(() => bang(659, 0.45, 0.16), 280);
}

function playHoldTick(cutting: boolean) {
  bang(cutting ? 210 : 170, 0.08, cutting ? 0.09 : 0.08);
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
  const adsMul = ads ? 0.55 : 1;
  const rec = tuning.recoil;
  pitch -= 0.016 * adsMul * rec;
  yaw += (Math.random() - 0.45) * 0.012 * adsMul * rec;
  punchP += 1.25 * adsMul * rec;
  punchY += (Math.random() - 0.5) * 0.55 * rec;
  punchR += (Math.random() - 0.5) * 0.8 * rec;
  gunKickZ = 0.08 * rec;
  boltDur = RIFLES[rifleKind].cycle;
  boltT = boltDur;
  const flash = liveRifle().flash;
  flash.visible = true;
  flashUntil = time + 0.045;
  fov += ads ? 1.2 : 2.4;
  bang(110, 0.09, 0.08);

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
        fov: (self ? ads && weapon === "rifle" : p.ads) ? 68 : 90,
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
    document.body.classList.add("bestplay");
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
  document.body.classList.add("bestplay");
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
  const isClient = net.role !== "host";
  if (isClient) {
    for (const [id, g] of clientPawns) {
      const p = poses.get(id);
      if (!p) {
        g.visible = false;
        continue;
      }
      g.visible = id !== mvpId;
      g.position.set(p.x, p.y, p.z);
      g.rotation.y = p.yaw;
      poseStance(g, p.alive ? "stand" : "down");
      stepWalkFromPos(g, p.x, p.z, p.alive);
    }
  } else {
    for (const b of bots) {
      const p = poses.get(b.id);
      if (!p) continue;
      b.x = p.x;
      b.y = p.y;
      b.z = p.z;
      b.yaw = p.yaw;
      b.hp = p.alive ? 100 : 0;
      b.root.visible = b.id !== mvpId;
      b.root.position.set(p.x, p.y, p.z);
      b.root.rotation.y = p.yaw;
      poseStance(b.root, p.alive ? "stand" : "down");
      stepWalkFromPos(b.root, p.x, p.z, p.alive);
      restoreHead(b);
      setPawnCloth(b.cloth, p.alive ? teamCloth(b.team) : 0x2a3224);
    }
    for (const r of remotes.values()) {
      const p = poses.get(r.slotId);
      if (!p) continue;
      r.root.visible = r.slotId !== mvpId;
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
  showRifle(kind, rifleOn);
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
  g.rotation.x = (cam.ads ? (kind === "mosin" ? 0 : 0.018) : 0.1) - cam.punchP * 0.04;
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
  camera.fov = cam.fov || (cam.ads ? 65 : 90);
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
    const vName = slotById(match, victim)?.name ?? "You";
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
      place: world.placeName?.(px, pz, py) ?? placeName(px, pz, py),
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
  showSpawn(
    you && you.team === planter
      ? "Ember dock · you carry the Bomb"
      : `Stone dock · hold ${world.sites[0]?.name ?? "A"} and ${world.sites[1]?.name ?? "B"}`,
    time,
  );
}

function botShoot(from: THREE.Vector3, dir: THREE.Vector3, target: { id: number; team: string }, shooterId: number) {
  const worldHit = rayShot(from, dir, 80, world.colliders);
  bang(150, 0.06, 0.035);
  const shooter = nearestBot(from);
  const where = placeName(from.x, from.z);
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
  bang(42, 0.5, 0.22);
  blastFlash = 1;
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 18, 14),
    new THREE.MeshBasicMaterial({ color: 0xffc060, transparent: true, opacity: 0.9 }),
  );
  mesh.position.set(x, y + 0.45, z);
  scene.add(mesh);
  const light = new THREE.PointLight(0xff7818, 48, 24);
  light.position.set(x, y + 0.9, z);
  scene.add(light);
  blasts.push({ mesh, light, t: 0.9 });
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

function applyRemoteUse(r: Remote, dt: number) {
  if (!r.alive || !r.input.use) return;
  const team = r.team;
  if (match.wire.mode === "ground" && team === plantingTeam(match)) {
    if (Math.hypot(r.x - match.wire.x, r.z - match.wire.z) < 1.15) pickupWire(match, r.slotId, team);
  }
  if (match.wire.mode === "carried" && match.wire.carrierId === r.slotId && match.phase === "live") {
    const site = inSite(world, "loft", r.x, r.z, r.y) ? "loft" : inSite(world, "well", r.x, r.z, r.y) ? "well" : null;
    if (site) {
      match.wire.plantHold += dt;
      if (match.wire.plantHold >= tuning.plant) plantWire(match, site, r.x, r.y, r.z);
    }
  }
  if (match.wire.mode === "planted" && match.phase === "planted" && team === watchingTeam(match)) {
    const d = Math.hypot(r.x - match.wire.x, r.z - match.wire.z);
    if (d < 1.35 && Math.abs(r.y - match.wire.y) < 1.6) match.wire.cutHold += dt;
  }
}

function remoteFire(r: Remote): boolean {
  const kind: RifleId = r.weapon === "mosin" ? "mosin" : "kar";
  if (time - r.lastFire < RIFLES[kind].cycle) return false;
  if (r.weapon === "knife" || r.weapon === "smoke" || r.weapon === "frag" || r.weapon === "stun" || r.weapon === "flash") return false;
  r.lastFire = time;
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
  if (cowMesh && cowId != null) {
    let cx = px;
    let cy = py;
    let cz = pz;
    const b = bots.find((t) => t.id === cowId);
    const r = [...remotes.values()].find((t) => t.slotId === cowId);
    if (b) {
      cx = b.x;
      cy = b.y;
      cz = b.z;
    } else if (r) {
      cx = r.x;
      cy = r.y;
      cz = r.z;
    }
    cowMesh.position.set(cx, cy, cz);
    cowMesh.rotation.y = time * 3;
    cowMesh.scale.setScalar(1 + Math.sin(time * 18) * 0.04);
    cowMesh.visible = cowId !== playerId || reel !== null;
  }

  const isClient = net.role !== "host";
  if (isClient && lastSnap) applyMatchSnap(match, lastSnap);
  const reeling = match.phase === "bestplay";
  const froze = roundFrozen(match.phase);
  const combatLock = !roundCombatOpen(match.phase);

  if (weapon !== "rifle") clearFire(fireQ);
  else if (mouseDown && !fireQ.held) pressFire(fireQ);
  const wantShot = !studio.on && weapon === "rifle" && fireWantsShot(fireQ);
  if (locked && alive && wantShot && !combatLock && bashT <= 0) tryFire();

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

  if (!studio.on && (alive && !froze && net.role !== "offline" && !isCow(playerId)) && locked) {
    const forwardX = -Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);
    let wx = 0;
    let wz = 0;
    if (locked) {
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
    if (locked && alive && grounded && keys.has("Space") && !jumpHeld) {
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
  if (!reeling && !isClient) {
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

  if (!isClient) {
  tickMatch(match, dt, {
    living: (team) => match.slots.filter((s) => s.team === team && s.alive).length,
    inSite: (id, x, z, y) => inSite(world, id, x, z, y),
    holdingUse: locked && alive && keys.has("KeyF") && !isCow(playerId),
    actor: {
      id: actorId(),
      team: slotById(match, actorId())?.team ?? "ember",
      x: px,
      y: py,
      z: pz,
      alive,
    },
    spawnPlant: world.plantSpawns[2]!,
    onDetonate: detonateWire,
    botCutting,
    skipRecap: !rules.highlights,
  });
  }

  if (match.phase === "settle" && seenPhase !== "settle") {
    const you = slotById(match, playerId);
    const win = !!you && match.lastWinner === you.team;
    setRoundResult(win ? "Round Victory!" : "Round Loss!", win);
    roundSting(win);
  }
  if (match.phase === "bestplay" && seenPhase !== "bestplay") {
    recordSnap();
    setRoundResult(null);
    reelPlayed = false;
  }
  if (match.phase === "planted" && seenPhase !== "planted") {
    playPlanted();
    const you = slotById(match, playerId);
    const win = !!you && you.team === plantingTeam(match);
    setRoundResult("Bomb planted", win);
    plantBannerUntil = time + 3.4;
  }
  const holdingPlant = match.wire.plantHold > 0.02 && (match.phase === "live" || match.phase === "planted");
  const holdingCut = match.wire.cutHold > 0.02 && match.phase === "planted";
  if (holdingPlant || holdingCut) {
    if (!plantCue) {
      plantCue = true;
      if (holdingCut) playCutStart();
      else playPlantStart();
    }
    holdTick += dt;
    const period = holdingCut ? 0.26 : 0.36;
    if (holdTick >= period) {
      holdTick = 0;
      playHoldTick(holdingCut);
    }
  } else {
    plantCue = false;
    holdTick = 0;
  }
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

  if (match.phase === "bestplay") {
    if (rules.highlights && !reelPlayed) tickReel(dt);
    else if (reel) stopReel();
  } else if (reel) {
    stopReel();
  }
  const watching = reel !== null;
  document.body.classList.toggle("ads", watching ? lastReelAds : ads);

  if (net.role === "host" && !reeling) {
    for (const r of remotes.values()) {
      const cowed = isCow(r.slotId);
      tickRemote(r, dt, time, world, froze || cowed);
      if (!cowed) applyRemoteUse(r, dt);
      if (r.input.fire && !r.fireQ.held) pressFire(r.fireQ);
      else if (!r.input.fire && r.fireQ.held) releaseFire(r.fireQ);
      if (fireWantsShot(r.fireQ) && r.alive && !combatLock && !cowed && remoteFire(r)) consumeFire(r.fireQ);
    }
  }

  if (isClient && lastSnap && net.peerId != null) {
    applyMatchSnap(match, lastSnap);
    const snapMap = lastSnap.mapId;
    if (!studio.on && !locker.on && snapMap && MAPS.some((m) => m.id === snapMap) && snapMap !== mapId) {
      loadMap(snapMap as MapId);
    }
    if (!reel && !studio.on && !locker.on) {
      syncClientPawns(scene, lastSnap.pawns, net.peerId, clientPawns, dt, {
        forceSnap: lastSnap.round !== seenRound,
      });
      for (const p of lastSnap.pawns) {
        if ((p.netId ?? 0) === net.peerId) continue;
        const g = clientPawns.get(p.id);
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
          } else {
            const n = reconcilePos(px, py, pz, me.x, me.y, me.z);
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
    paintNadeView();
  }

  if (alive || match.phase === "bestplay" || match.phase === "matchover" || match.phase === "settle") {
    hideDeath();
  } else {
    showDeath({
      killer: killedBy || "a rifleman",
      place: placeName(px, pz, py),
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

  punchP += (0 - punchP) * Math.min(1, dt * 12);
  punchY += (0 - punchY) * Math.min(1, dt * 10);
  punchR += (0 - punchR) * Math.min(1, dt * 10);
  gunKickZ += (0 - gunKickZ) * Math.min(1, dt * 16);
  if (!watching && time > flashUntil) {
    kar.flash.visible = false;
    mosin.flash.visible = false;
  }
  hipSpread = hipCone();
  blastFlash += (0 - blastFlash) * Math.min(1, dt * 2.8);
  blastEl.style.opacity = String(blastFlash);

  for (let i = blasts.length - 1; i >= 0; i--) {
    const b = blasts[i]!;
    b.t -= dt;
    const k = 1 - Math.max(0, b.t) / 0.9;
    b.mesh.scale.setScalar(0.6 + k * 11);
    (b.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - k));
    b.light.intensity = 48 * (1 - k);
    if (b.t <= 0) {
      scene.remove(b.mesh, b.light);
      b.mesh.geometry.dispose();
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
        fov += (fovTarget - fov) * Math.min(1, dt * 10);
        camera.fov = fov;
        camera.updateProjectionMatrix();
        const bashing = bashT > 0;
        const throwing = throwT > 0;
        const boltK = boltT > 0 ? 1 - boltT / boltDur : 0;
        const throwK = throwing ? 1 - throwT / throwDur : 0;
        showRifle(rifleKind, !studio.on && alive && weapon === "rifle" && !bashing && !throwing);
        knife.visible = !studio.on && alive && (weapon === "knife" || bashing) && !throwing;
        nadeView.visible = !studio.on && alive && !bashing && (isNade(weapon) || throwing);
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
        g.rotation.x = (ads ? (rifleKind === "mosin" ? 0 : 0.018) : 0.1) - punchP * 0.04;
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
  if (match.phase === "freeze") prompt = "Hold";
  else if (match.phase === "bestplay") prompt = "";
  else if (match.phase === "ending" || match.phase === "matchover") prompt = match.endText;
  else if (match.wire.mode === "carried" && match.wire.carrierId === viewId) {
    const site = inSite(world, "loft", px, pz, py) ? "ICE" : inSite(world, "well", px, pz, py) ? "SLIP" : "";
    prompt = site
      ? "HOLD F · PLANT"
      : "You have the Bomb · gold pad at A or B";
  } else if (match.wire.mode === "ground" && youTeam === planter) {
    if (Math.hypot(px - match.wire.x, pz - match.wire.z) < 1.4) prompt = "HOLD F · PICK UP THE BOMB";
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
  const shiftBoard =
    (keys.has("ShiftLeft") || keys.has("ShiftRight")) &&
    !document.body.classList.contains("settings") &&
    !document.body.classList.contains("admin") &&
    !document.body.classList.contains("podium");
  const showBoard = shiftBoard || match.phase === "matchover";
  document.body.classList.toggle("board", shiftBoard);
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

  if (net.role === "host") {
    net.sendSnapshot(
      buildSnapshot(
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
        },
        bots,
        remotes,
        mapId,
        time,
      ),
    );
  }
  if (net.role === "client") {
    net.sendInput(
      collectInput({
        keys: studio.on || locker.on ? new Set() : keys,
        yaw,
        pitch,
        fire: studio.on || locker.on ? false : wantShot,
        ads: studio.on || locker.on ? false : ads,
        lean: studio.on || locker.on ? 0 : lean,
        weapon: weapon === "rifle" ? rifleKind : weapon,
        crouch: studio.on || locker.on ? false : crouch,
        prone: studio.on || locker.on ? false : prone,
        jump: studio.on || locker.on ? false : keys.has("Space"),
        use: studio.on || locker.on ? false : keys.has("KeyF"),
        ping: net.pingMs,
      }),
    );
  }

  if (locker.on) {
    for (const g of clientPawns.values()) g.visible = false;
    for (const b of bots) b.root.visible = false;
    ghost.visible = false;
    showRifle(rifleKind, false);
    knife.visible = false;
    nadeView.visible = false;
    arm.root.visible = false;
    studioGhost.visible = false;
    lockerPawn.visible = true;
    if (!locker.dragging) locker.phi += dt * 0.2;
    applyLockerCam();
  } else if (studio.on) {
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
      const hold = liveRifle();
      hold.root.position.copy(hold.hipPos);
      hold.root.rotation.set(0.1, 0.22, 0.06);
      poseBolt(hold, 0);
      hold.root.updateMatrixWorld(true);
      arm.root.visible = true;
      poseArm(arm, rifleWrist(hold, 0));
      if (isAccessoryTool(studio.tool)) {
        studioAim.set(0, 0, -1).applyQuaternion(camera.quaternion);
        const ground = aimGround(camera.position, studioAim);
        if (ground) {
          const [sx, sy, sz] = ghostSize(studio.tool, studio.bw, studio.bd);
          studioGhost.visible = true;
          studioGhost.scale.set(sx, sy, sz);
          studioGhost.position.set(snap(ground.x), surfaceAt(studio.spec, ground.x, ground.z) + sy / 2, snap(ground.z));
        } else studioGhost.visible = false;
      } else studioGhost.visible = false;
      studioSel.visible = false;
    } else {
      showRifle(rifleKind, false);
      arm.root.visible = false;
      applyOrbit(camera, studio.cam);
      const box = studio.sel ? itemBox(studio.spec, studio.sel) : null;
      studioSel.visible = !!box;
      if (box) {
        studioSel.scale.set(box.sx + 0.2, box.sy + 0.2, box.sz + 0.2);
        studioSel.position.set(box.x, box.y, box.z);
      }
      if (studio.drag?.mode === "rect") {
        const w = Math.max(2, Math.abs(studio.drag.x1 - studio.drag.x0));
        const d = Math.max(2, Math.abs(studio.drag.z1 - studio.drag.z0));
        const [sx, sy, sz] = ghostSize(studio.tool, w, d);
        studioGhost.visible = true;
        studioGhost.scale.set(w, sy, d);
        studioGhost.position.set((studio.drag.x0 + studio.drag.x1) / 2, studio.drag.y + sy / 2, (studio.drag.z0 + studio.drag.z1) / 2);
      } else if (isOpeningTool(studio.tool)) {
        const ground = studioHit();
        const wall = ground ? nearestBuildingWall(studio.spec, ground.x, ground.z, surfaceAt(studio.spec, ground.x, ground.z)) : null;
        if (wall) {
          const pose = openingPose(wall, studio.tool);
          studioGhost.visible = true;
          studioGhost.scale.set(pose.sx, pose.sy, pose.sz);
          studioGhost.position.set(pose.x, pose.y, pose.z);
        } else studioGhost.visible = false;
      } else if (studio.tool === "select") {
        studioGhost.visible = false;
      } else {
        const hit = studioHit();
        const show = !!hit;
        studioGhost.visible = show;
        if (hit && show) {
          const [sx, sy, sz] = ghostSize(studio.tool, studio.bw, studio.bd);
          const y = isRectTool(studio.tool) ? surfaceAt(studio.spec, hit.x, hit.z) : 0;
          studioGhost.scale.set(sx, sy, sz);
          studioGhost.position.set(snap(hit.x), y + sy / 2, snap(hit.z));
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
