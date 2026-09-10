/**
 * Home-page map sketch. The human paints a LayoutSpec from orbit; the agent
 * finalizes (routes, names, map-check, register). See .cursor/skills/design-map/SKILL.md.
 */
import * as THREE from "three";
import { T } from "./kit";
import {
  COVER_SIZE,
  HOLE_MIN,
  STOREY,
  STOREY_MAX,
  STOREY_MIN,
  YARD_SPEC,
  buildingBase,
  buildingFloors,
  buildingHeight,
  buildingInterior,
  punchRects,
  type BuildingInterior,
  type BuildingSpec,
  type ClimbDir,
  type CoverKind,
  type CoverSpec,
  type DoorWall,
  type LayoutSpec,
  type ThemeId,
  type WallOpening,
  type XzRect,
} from "./layout";

export const STUDIO_STORE = "rifles-studio-spec";
export const GRID = 2;

export type PaletteId = "hand" | "build" | "kit";

export type ToolId =
  | "select"
  | "erase"
  | "building"
  | "floor"
  | "cut"
  | "wall"
  | "door"
  | "window"
  | "crate"
  | "jumpCrate"
  | "fullCrate"
  | "low"
  | "high"
  | "truck"
  | "siteA"
  | "siteB"
  | "plant"
  | "watch"
  | "climb"
  | "ladder"
  | "lamp"
  | "tree";

export type OpeningKind = "door" | "window";

export type ToolDef = { id: ToolId; key: string; label: string };

export const HAND_TOOLS: ToolDef[] = [
  { id: "select", key: "Q", label: "Grab" },
  { id: "erase", key: "X", label: "Erase" },
];

export const BUILD_TOOLS: ToolDef[] = [
  { id: "building", key: "1", label: "Building" },
  { id: "floor", key: "2", label: "Floor" },
  { id: "cut", key: "U", label: "Cut" },
  { id: "wall", key: "I", label: "Wall" },
  { id: "door", key: "O", label: "Door" },
  { id: "window", key: "V", label: "Window" },
];

export const KIT_TOOLS: ToolDef[] = [
  { id: "jumpCrate", key: "J", label: "Jump crate" },
  { id: "crate", key: "3", label: "Crate" },
  { id: "fullCrate", key: "K", label: "Full crate" },
  { id: "low", key: "4", label: "Low" },
  { id: "high", key: "5", label: "High" },
  { id: "truck", key: "6", label: "Truck" },
  { id: "siteA", key: "7", label: "A" },
  { id: "siteB", key: "8", label: "B" },
  { id: "plant", key: "9", label: "Plant" },
  { id: "watch", key: "0", label: "Watch" },
  { id: "climb", key: "C", label: "Climb" },
  { id: "ladder", key: "N", label: "Ladder" },
  { id: "lamp", key: "L", label: "Lamp" },
  { id: "tree", key: "T", label: "Tree" },
];

export const TOOLS: ToolDef[] = [...HAND_TOOLS, ...BUILD_TOOLS, ...KIT_TOOLS];

export const HAND_IDS: ToolId[] = HAND_TOOLS.map((t) => t.id);
export const BUILD_IDS: ToolId[] = BUILD_TOOLS.map((t) => t.id);
export const KIT_IDS: ToolId[] = KIT_TOOLS.map((t) => t.id);
export const OPENING_TOOLS: OpeningKind[] = ["door", "window"];
export const RECT_TOOLS: ToolId[] = ["building", "floor", "wall"];

export function paletteOf(tool: ToolId): PaletteId {
  if (tool === "select" || tool === "erase") return "hand";
  return KIT_IDS.includes(tool) ? "kit" : "build";
}

export function toolsFor(palette: PaletteId) {
  if (palette === "hand") return HAND_TOOLS;
  if (palette === "kit") return KIT_TOOLS;
  return BUILD_TOOLS;
}

export function isRectTool(tool: ToolId) {
  return RECT_TOOLS.includes(tool);
}

export function walkKeepsTool(tool: ToolId) {
  return tool !== "building";
}

export function isHandTool(tool: ToolId) {
  return tool === "select" || tool === "erase";
}

export function isBuildPaletteTool(tool: ToolId) {
  return BUILD_IDS.includes(tool);
}

export function isAccessoryTool(tool: ToolId) {
  return KIT_IDS.includes(tool);
}

export function isOpeningTool(tool: ToolId): tool is OpeningKind {
  return OPENING_TOOLS.includes(tool as OpeningKind);
}

export type StudioItem =
  | { kind: "building"; i: number }
  | { kind: "slab"; i: number }
  | { kind: "partition"; i: number }
  | { kind: "cover"; i: number }
  | { kind: "climb"; i: number }
  | { kind: "site"; i: number }
  | { kind: "plant"; i: number }
  | { kind: "watch"; i: number }
  | { kind: "lamp"; i: number }
  | { kind: "tree"; i: number };

export type LotEdge = DoorWall;

export const LOT_STEP = 8;
export const LOT_MIN = { w: 40, d: 28 };
export const LOT_MAX = { w: 160, d: 120 };
export const LOT_BAND = 2.8;
export const BUILD_MIN = GRID;
export const BUILD_MAX = 80;
export const DOOR_W = { door: 2.4, window: 1.8 };
export const SLAB_Y = 0.16;

export const THEMES: ThemeId[] = ["dust", "winter", "harbor", "stone"];

export function blankSpec(): LayoutSpec {
  return {
    id: "draft",
    title: "Draft",
    blurb: "Studio sketch. Finalize before rotation.",
    theme: "dust",
    bounds: { ...YARD_SPEC.bounds },
    buildings: [],
    slabs: [],
    partitions: [],
    cover: [],
    climbs: [],
    sites: [
      { id: "loft", call: "A", name: "A", x: -14, z: 8 },
      { id: "well", call: "B", name: "B", x: 14, z: -6 },
    ],
    plantSpawns: [
      [-30, 0],
      [-30, 4],
      [-32, 2],
      [-30, -4],
      [-32, 6],
    ],
    watchSpawns: [
      [30, 0],
      [30, 4],
      [32, 2],
      [30, -4],
      [32, 6],
    ],
    routes: [],
    lamps: [],
    trees: [],
  };
}

export function cloneSpec(spec: LayoutSpec): LayoutSpec {
  return JSON.parse(JSON.stringify(spec)) as LayoutSpec;
}

export function studioBuildingIndex(sels: StudioItem[]) {
  if (sels.length !== 1 || sels[0]!.kind !== "building") return -1;
  return sels[0]!.i;
}

export function setBuildingStoreys(spec: LayoutSpec, i: number, floors: number): LayoutSpec {
  const cur = spec.buildings?.[i];
  if (!cur) return spec;
  const n = Math.max(STOREY_MIN, Math.min(STOREY_MAX, Math.round(floors)));
  const from = buildingFloors(cur);
  const nextInterior = from === 1 && n > 1 && cur.interior === undefined ? "empty" : cur.interior;
  const nextH = n === 1 ? (from === 1 && cur.h !== undefined ? cur.h : STOREY) : undefined;
  if (from === n && cur.h === nextH && cur.interior === nextInterior) return spec;
  const next = cloneSpec(spec);
  const b = next.buildings![i]!;
  b.floors = n;
  if (n === 1) b.h = nextH;
  else delete b.h;
  if (nextInterior) b.interior = nextInterior;
  return next;
}

export function bumpBuildingStoreys(spec: LayoutSpec, i: number, delta: number): LayoutSpec {
  const b = spec.buildings?.[i];
  if (!b) return spec;
  return setBuildingStoreys(spec, i, buildingFloors(b) + delta);
}

export function setBuildingInterior(spec: LayoutSpec, i: number, interior: BuildingInterior): LayoutSpec {
  const cur = spec.buildings?.[i];
  if (!cur) return spec;
  if (buildingInterior(cur) === interior) return spec;
  const next = cloneSpec(spec);
  next.buildings![i]!.interior = interior;
  return next;
}

export function snap(n: number, grid = GRID) {
  return Math.round(n / grid) * grid;
}

export function dirFromYaw(yaw: number): ClimbDir {
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  if (Math.abs(fx) >= Math.abs(fz)) return fx >= 0 ? "+x" : "-x";
  return fz >= 0 ? "+z" : "-z";
}

export function aimGround(origin: THREE.Vector3, dir: THREE.Vector3) {
  if (Math.abs(dir.y) < 0.02) return null;
  const t = -origin.y / dir.y;
  if (t < 0.4 || t > 90) return null;
  return origin.clone().addScaledVector(dir, t);
}

const COVER: CoverKind[] = ["crate", "jumpCrate", "fullCrate", "low", "high", "truck"];

export function place(
  spec: LayoutSpec,
  tool: ToolId,
  x: number,
  z: number,
  opts: { yaw?: number; bw?: number; bd?: number; y?: number } = {},
): LayoutSpec {
  const next = cloneSpec(spec);
  const gx = snap(x);
  const gz = snap(z);
  const bw = opts.bw ?? 12;
  const bd = opts.bd ?? 10;
  const dir = dirFromYaw(opts.yaw ?? 0);

  if (tool === "select") return next;
  if (tool === "erase") return eraseNear(spec, gx, gz);

  if (tool === "building") {
    const y0 = opts.y ?? surfaceAt(spec, gx, gz);
    const raised = raiseStoreyIfMatch(spec, gx, gz, bw, bd, y0);
    if (raised) return raised;
    next.buildings = next.buildings ?? [];
    next.buildings.push({
      x: gx,
      z: gz,
      w: bw,
      d: bd,
      y: y0,
      h: STOREY,
      floors: 1,
      doors: [],
    });
    return next;
  }
  if (tool === "floor") {
    next.slabs = next.slabs ?? [];
    next.slabs.push({
      x: gx,
      z: gz,
      w: bw,
      d: bd,
      y: Math.max(SLAB_Y, opts.y ?? SLAB_Y),
    });
    return next;
  }
  if (tool === "cut") {
    return cutCell(spec, gx, gz);
  }
  if (tool === "wall") {
    const alongX = dir === "+z" || dir === "-z";
    const length = Math.max(2, alongX ? bw : bd);
    next.partitions = next.partitions ?? [];
    next.partitions.push({
      x: gx,
      z: gz,
      w: alongX ? length : T,
      d: alongX ? T : length,
      y: opts.y ?? surfaceAt(spec, gx, gz),
      h: STOREY,
    });
    return next;
  }
  if (COVER.includes(tool as CoverSpec["kind"])) {
    next.cover = next.cover ?? [];
    next.cover.push({ x: gx, z: gz, kind: tool as CoverSpec["kind"] });
    return next;
  }
  if (tool === "siteA" || tool === "siteB") {
    const id = tool === "siteA" ? "loft" : "well";
    const call = tool === "siteA" ? "A" : "B";
    const name = call;
    next.sites = next.sites.filter((s) => s.id !== id);
    next.sites.push({ id, call, name, x: gx, z: gz });
    return next;
  }
  if (tool === "plant") {
    next.plantSpawns.push([gx, gz]);
    if (next.plantSpawns.length > 8) next.plantSpawns.splice(0, next.plantSpawns.length - 8);
    return next;
  }
  if (tool === "watch") {
    next.watchSpawns.push([gx, gz]);
    if (next.watchSpawns.length > 8) next.watchSpawns.splice(0, next.watchSpawns.length - 8);
    return next;
  }
  if (tool === "climb") {
    next.climbs = next.climbs ?? [];
    next.climbs.push({ x: gx, z: gz, dir, height: 2.8, width: 2.2 });
    return next;
  }
  if (tool === "ladder") {
    return placeLadder(spec, x, z, opts.yaw ?? 0, opts.y);
  }
  if (tool === "lamp") {
    next.lamps = next.lamps ?? [];
    next.lamps.push([gx, gz]);
    return next;
  }
  if (tool === "tree") {
    next.trees = next.trees ?? [];
    next.trees.push([gx, gz]);
    return next;
  }
  return next;
}

export function eraseNear(spec: LayoutSpec, x: number, z: number, r = 3.2): LayoutSpec {
  const item = pickItem(spec, x, z, r);
  if (!item) return spec;
  return deleteItem(spec, item);
}

export function deleteItem(spec: LayoutSpec, item: StudioItem): LayoutSpec {
  const next = cloneSpec(spec);
  if (item.kind === "building") {
    next.buildings?.splice(item.i, 1);
    return next;
  }
  if (item.kind === "slab") {
    next.slabs?.splice(item.i, 1);
    return next;
  }
  if (item.kind === "partition") {
    next.partitions?.splice(item.i, 1);
    return next;
  }
  if (item.kind === "cover") {
    next.cover?.splice(item.i, 1);
    return next;
  }
  if (item.kind === "climb") {
    next.climbs?.splice(item.i, 1);
    return next;
  }
  if (item.kind === "site") {
    next.sites.splice(item.i, 1);
    return next;
  }
  if (item.kind === "plant" && next.plantSpawns.length > 1) {
    next.plantSpawns.splice(item.i, 1);
    return next;
  }
  if (item.kind === "watch" && next.watchSpawns.length > 1) {
    next.watchSpawns.splice(item.i, 1);
    return next;
  }
  if (item.kind === "lamp") {
    next.lamps?.splice(item.i, 1);
    return next;
  }
  if (item.kind === "tree") {
    next.trees?.splice(item.i, 1);
    return next;
  }
  return spec;
}

export function containsXZ(x: number, z: number, cx: number, cz: number, w: number, d: number, pad = 0) {
  return Math.abs(x - cx) <= w / 2 + pad && Math.abs(z - cz) <= d / 2 + pad;
}

export function inSlabHole(s: { x: number; z: number; w: number; d: number; holes?: XzRect[] }, x: number, z: number) {
  return (s.holes ?? []).some((h) => containsXZ(x, z, h.x, h.z, h.w, h.d));
}

export function surfaceAt(spec: LayoutSpec, x: number, z: number) {
  let y = 0;
  for (const s of spec.slabs ?? []) {
    if (containsXZ(x, z, s.x, s.z, s.w, s.d) && !inSlabHole(s, x, z)) y = Math.max(y, s.y);
  }
  for (const b of spec.buildings ?? []) {
    if (containsXZ(x, z, b.x, b.z, b.w, b.d)) y = Math.max(y, buildingBase(b) + buildingHeight(b));
  }
  return y;
}

export function rectSurfaceY(spec: LayoutSpec, x0: number, z0: number, x1: number, z1: number) {
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  return Math.max(
    surfaceAt(spec, cx, cz),
    surfaceAt(spec, x0, z0),
    surfaceAt(spec, x1, z1),
    surfaceAt(spec, x0, z1),
    surfaceAt(spec, x1, z0),
  );
}

export function wallFootprint(x0: number, z0: number, x1: number, z1: number) {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const alongX = Math.abs(dx) >= Math.abs(dz);
  const length = Math.max(T, alongX ? Math.abs(dx) : Math.abs(dz));
  return {
    x: (x0 + x1) / 2,
    z: (z0 + z1) / 2,
    w: alongX ? length : T,
    d: alongX ? T : length,
  };
}

function similarFootprint(a: { w: number; d: number }, b: { w: number; d: number }) {
  const wr = Math.min(a.w, b.w) / Math.max(a.w, b.w);
  const dr = Math.min(a.d, b.d) / Math.max(a.d, b.d);
  return wr >= 0.72 && dr >= 0.72;
}

export function raiseStoreyIfMatch(spec: LayoutSpec, x: number, z: number, w: number, d: number, y: number): LayoutSpec | null {
  const next = cloneSpec(spec);
  for (const b of next.buildings ?? []) {
    if (buildingFloors(b) !== 1) continue;
    if (!containsXZ(x, z, b.x, b.z, b.w, b.d)) continue;
    if (!similarFootprint({ w, d }, b)) continue;
    const roof = buildingBase(b) + buildingHeight(b);
    if (Math.abs(y - roof) > 0.35) continue;
    b.floors = 2;
    delete b.h;
    return next;
  }
  return null;
}

export function cutCell(spec: LayoutSpec, x: number, z: number): LayoutSpec {
  const gx = snap(x);
  const gz = snap(z);
  const h = GRID / 2;
  return cutSlabRect(spec, gx - h, gz - h, gx + h, gz + h);
}

export function cutSlabRect(spec: LayoutSpec, x0: number, z0: number, x1: number, z1: number): LayoutSpec {
  const hole: XzRect = {
    x: (x0 + x1) / 2,
    z: (z0 + z1) / 2,
    w: Math.max(HOLE_MIN, Math.abs(x1 - x0)),
    d: Math.max(HOLE_MIN, Math.abs(z1 - z0)),
  };
  if (hole.w < 0.4 && hole.d < 0.4) return spec;
  const next = cloneSpec(spec);
  const slabs = next.slabs ?? [];
  let best = -1;
  let bestY = -Infinity;
  for (let i = 0; i < slabs.length; i++) {
    const s = slabs[i]!;
    if (!containsXZ(hole.x, hole.z, s.x, s.z, s.w, s.d)) continue;
    if (s.y >= bestY) {
      bestY = s.y;
      best = i;
    }
  }
  if (best < 0) return spec;
  const slab = slabs[best]!;
  const holes = [...(slab.holes ?? []), hole];
  const leftover = punchRects(slab, holes);
  if (!leftover.length) {
    slabs.splice(best, 1);
    return next;
  }
  slab.holes = holes;
  return next;
}

function wallToClimbDir(wall: DoorWall): ClimbDir {
  if (wall === "n") return "-z";
  if (wall === "s") return "+z";
  if (wall === "e") return "-x";
  return "+x";
}

export function placeLadder(spec: LayoutSpec, x: number, z: number, yaw = 0, y?: number): LayoutSpec {
  const next = cloneSpec(spec);
  const startY = y ?? surfaceAt(spec, x, z);
  const hit = nearestBuildingWall(spec, x, z, startY, 8);
  let px = snap(x);
  let pz = snap(z);
  let dir = dirFromYaw(yaw);
  if (hit) {
    const out = 0.22;
    px = hit.x + (hit.wall === "e" ? out : hit.wall === "w" ? -out : 0);
    pz = hit.z + (hit.wall === "n" ? out : hit.wall === "s" ? -out : 0);
    dir = wallToClimbDir(hit.wall);
  }
  next.climbs = next.climbs ?? [];
  next.climbs.push({
    x: px,
    z: pz,
    dir,
    height: STOREY,
    width: 1.1,
    startY: surfaceAt(spec, px, pz),
    kind: "ladder",
  });
  return next;
}

/** First-floor deck flush with a 1-storey building's outer wall faces. */
export function snapFloor(
  spec: LayoutSpec,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  y = 0,
  fallback?: { w: number; d: number },
): { x: number; z: number; w: number; d: number; y: number } {
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const w = Math.abs(x1 - x0);
  const d = Math.abs(z1 - z0);
  const hit = (b: BuildingSpec) =>
    buildingFloors(b) === 1 &&
    (containsXZ(cx, cz, b.x, b.z, b.w, b.d, 0.6) ||
      containsXZ(x0, z0, b.x, b.z, b.w, b.d, 0.6) ||
      containsXZ(x1, z1, b.x, b.z, b.w, b.d, 0.6));
  const b = (spec.buildings ?? []).find(hit);
  if (b) {
    return {
      x: b.x,
      z: b.z,
      w: b.w + T,
      d: b.d + T,
      y: buildingBase(b) + (b.h ?? STOREY),
    };
  }
  return {
    x: snap(cx),
    z: snap(cz),
    w: fallback?.w ?? clampBuildSize(Math.max(BUILD_MIN, w)),
    d: fallback?.d ?? clampBuildSize(Math.max(BUILD_MIN, d)),
    y: Math.max(SLAB_Y, y || surfaceAt(spec, cx, cz)),
  };
}

export function playableSpec(spec: LayoutSpec): LayoutSpec {
  const next = cloneSpec(spec);
  if (!next.blurb) next.blurb = "Studio sketch";
  if ((next.routes?.length ?? 0) >= 2) return next;
  const a = next.sites.find((s) => s.id === "loft") ?? next.sites[0];
  const b = next.sites.find((s) => s.id === "well") ?? next.sites[1] ?? a;
  const p = next.plantSpawns[2] ?? next.plantSpawns[0];
  const w = next.watchSpawns[2] ?? next.watchSpawns[0];
  if (!a || !p || !w) return next;
  const mid: [number, number] = [(p[0] + w[0]) / 2, (p[1] + w[1]) / 2];
  next.routes = [
    [p, mid, [a.x, a.z]],
    [p, mid, [b.x, b.z]],
    [w, mid, [a.x, a.z]],
  ];
  return next;
}

export function pickItem(spec: LayoutSpec, x: number, z: number, r = 3.2): StudioItem | null {
  type Hit = { item: StudioItem; y: number; area: number; dist: number };
  const hits: Hit[] = [];
  const inside = (cx: number, cz: number, w: number, d: number) => containsXZ(x, z, cx, cz, w, d, 0.4);
  for (let i = 0; i < (spec.buildings ?? []).length; i++) {
    const b = spec.buildings![i]!;
    if (inside(b.x, b.z, b.w, b.d)) {
      hits.push({ item: { kind: "building", i }, y: buildingBase(b) + buildingHeight(b), area: b.w * b.d, dist: 0 });
    }
  }
  for (let i = 0; i < (spec.slabs ?? []).length; i++) {
    const s = spec.slabs![i]!;
    if (inside(s.x, s.z, s.w, s.d) && !inSlabHole(s, x, z)) {
      hits.push({ item: { kind: "slab", i }, y: s.y, area: s.w * s.d, dist: 0 });
    }
  }
  for (let i = 0; i < (spec.partitions ?? []).length; i++) {
    const p = spec.partitions![i]!;
    if (inside(p.x, p.z, p.w, p.d)) {
      hits.push({ item: { kind: "partition", i }, y: (p.y ?? 0) + (p.h ?? STOREY), area: p.w * p.d, dist: 0 });
    }
  }
  const stamp = (item: StudioItem, ax: number, az: number, y: number, area: number) => {
    const dist = Math.hypot(x - ax, z - az);
    if (dist <= r) hits.push({ item, y, area, dist });
  };
  for (let i = 0; i < (spec.cover ?? []).length; i++) {
    const c = spec.cover![i]!;
    const [sx, , sz] = COVER_SIZE[c.kind];
    if (inside(c.x, c.z, sx, sz)) {
      hits.push({ item: { kind: "cover", i }, y: COVER_SIZE[c.kind][1], area: sx * sz, dist: 0 });
    } else stamp({ kind: "cover", i }, c.x, c.z, 1, sx * sz);
  }
  for (let i = 0; i < (spec.climbs ?? []).length; i++) {
    const c = spec.climbs![i]!;
    stamp({ kind: "climb", i }, c.x, c.z, c.startY ?? 0, 4);
  }
  for (let i = 0; i < spec.sites.length; i++) {
    const s = spec.sites[i]!;
    stamp({ kind: "site", i }, s.x, s.z, s.y ?? 0, 9);
  }
  for (let i = 0; i < spec.plantSpawns.length; i++) {
    const [sx, sz] = spec.plantSpawns[i]!;
    stamp({ kind: "plant", i }, sx, sz, 0, 1.4);
  }
  for (let i = 0; i < spec.watchSpawns.length; i++) {
    const [sx, sz] = spec.watchSpawns[i]!;
    stamp({ kind: "watch", i }, sx, sz, 0, 1.4);
  }
  for (let i = 0; i < (spec.lamps ?? []).length; i++) {
    const [sx, sz] = spec.lamps![i]!;
    stamp({ kind: "lamp", i }, sx, sz, 0, 0.4);
  }
  for (let i = 0; i < (spec.trees ?? []).length; i++) {
    const [sx, sz] = spec.trees![i]!;
    stamp({ kind: "tree", i }, sx, sz, 0, 3);
  }
  hits.sort((a, b) => {
    const aIn = a.dist === 0 ? 0 : 1;
    const bIn = b.dist === 0 ? 0 : 1;
    if (aIn !== bIn) return aIn - bIn;
    const aPt = a.area < 10;
    const bPt = b.area < 10;
    if (aPt !== bPt) return aPt ? -1 : 1;
    if (a.dist === 0 && b.dist === 0 && a.y !== b.y) return b.y - a.y;
    if (a.dist === 0 && b.dist === 0 && a.area !== b.area) return a.area - b.area;
    return a.dist - b.dist;
  });
  return hits[0]?.item ?? null;
}

export function itemPos(spec: LayoutSpec, item: StudioItem): { x: number; z: number } | null {
  if (item.kind === "building") {
    const b = spec.buildings?.[item.i];
    return b ? { x: b.x, z: b.z } : null;
  }
  if (item.kind === "slab") {
    const s = spec.slabs?.[item.i];
    return s ? { x: s.x, z: s.z } : null;
  }
  if (item.kind === "partition") {
    const p = spec.partitions?.[item.i];
    return p ? { x: p.x, z: p.z } : null;
  }
  if (item.kind === "cover") {
    const c = spec.cover?.[item.i];
    return c ? { x: c.x, z: c.z } : null;
  }
  if (item.kind === "climb") {
    const c = spec.climbs?.[item.i];
    return c ? { x: c.x, z: c.z } : null;
  }
  if (item.kind === "site") {
    const s = spec.sites[item.i];
    return s ? { x: s.x, z: s.z } : null;
  }
  if (item.kind === "plant") {
    const p = spec.plantSpawns[item.i];
    return p ? { x: p[0], z: p[1] } : null;
  }
  if (item.kind === "watch") {
    const p = spec.watchSpawns[item.i];
    return p ? { x: p[0], z: p[1] } : null;
  }
  if (item.kind === "lamp") {
    const p = spec.lamps?.[item.i];
    return p ? { x: p[0], z: p[1] } : null;
  }
  const p = spec.trees?.[item.i];
  return p ? { x: p[0], z: p[1] } : null;
}

export function moveItem(spec: LayoutSpec, item: StudioItem, x: number, z: number): LayoutSpec {
  const next = cloneSpec(spec);
  const gx = snap(x);
  const gz = snap(z);
  if (item.kind === "building") {
    const b = next.buildings?.[item.i];
    if (!b) return spec;
    if (b.x === gx && b.z === gz) return spec;
    b.x = gx;
    b.z = gz;
    return next;
  }
  if (item.kind === "slab") {
    const s = next.slabs?.[item.i];
    if (!s) return spec;
    s.x = gx;
    s.z = gz;
    return next;
  }
  if (item.kind === "partition") {
    const p = next.partitions?.[item.i];
    if (!p) return spec;
    p.x = gx;
    p.z = gz;
    return next;
  }
  if (item.kind === "cover") {
    const c = next.cover?.[item.i];
    if (!c) return spec;
    c.x = gx;
    c.z = gz;
    return next;
  }
  if (item.kind === "climb") {
    const c = next.climbs?.[item.i];
    if (!c) return spec;
    c.x = gx;
    c.z = gz;
    return next;
  }
  if (item.kind === "site") {
    const s = next.sites[item.i];
    if (!s) return spec;
    s.x = gx;
    s.z = gz;
    return next;
  }
  if (item.kind === "plant") {
    if (!next.plantSpawns[item.i]) return spec;
    next.plantSpawns[item.i] = [gx, gz];
    return next;
  }
  if (item.kind === "watch") {
    if (!next.watchSpawns[item.i]) return spec;
    next.watchSpawns[item.i] = [gx, gz];
    return next;
  }
  if (item.kind === "lamp") {
    if (!next.lamps?.[item.i]) return spec;
    next.lamps[item.i] = [gx, gz];
    return next;
  }
  if (!next.trees?.[item.i]) return spec;
  next.trees[item.i] = [gx, gz];
  return next;
}

export function itemBox(spec: LayoutSpec, item: StudioItem): { x: number; y: number; z: number; sx: number; sy: number; sz: number } | null {
  if (item.kind === "building") {
    const b = spec.buildings?.[item.i];
    if (!b) return null;
    const h = buildingHeight(b);
    const y0 = buildingBase(b);
    return { x: b.x, y: y0 + h / 2, z: b.z, sx: b.w, sy: h, sz: b.d };
  }
  if (item.kind === "slab") {
    const s = spec.slabs?.[item.i];
    if (!s) return null;
    return { x: s.x, y: s.y - 0.08, z: s.z, sx: s.w, sy: 0.16, sz: s.d };
  }
  if (item.kind === "partition") {
    const p = spec.partitions?.[item.i];
    if (!p) return null;
    const h = p.h ?? STOREY;
    const y0 = p.y ?? 0;
    return { x: p.x, y: y0 + h / 2, z: p.z, sx: p.w, sy: h, sz: p.d };
  }
  if (item.kind === "cover") {
    const c = spec.cover?.[item.i];
    if (!c) return null;
    const [sx, sy, sz] = ghostSize(c.kind, 12, 10);
    return { x: c.x, y: sy / 2, z: c.z, sx, sy, sz };
  }
  if (item.kind === "climb") {
    const c = spec.climbs?.[item.i];
    if (!c) return null;
    if (c.kind === "ladder") {
      const h = c.height ?? STOREY;
      return { x: c.x, y: (c.startY ?? 0) + h / 2, z: c.z, sx: 1.2, sy: h, sz: 1.2 };
    }
    return { x: c.x, y: (c.startY ?? 0) + 0.2, z: c.z, sx: 2.2, sy: 0.4, sz: 7 };
  }
  if (item.kind === "site") {
    const s = spec.sites[item.i];
    if (!s) return null;
    return { x: s.x, y: 0.06, z: s.z, sx: 3, sy: 0.12, sz: 3 };
  }
  const pos = itemPos(spec, item);
  if (!pos) return null;
  if (item.kind === "lamp") return { x: pos.x, y: 1.6, z: pos.z, sx: 0.2, sy: 3.2, sz: 0.2 };
  if (item.kind === "tree") return { x: pos.x, y: 2, z: pos.z, sx: 1.8, sy: 4, sz: 1.8 };
  return { x: pos.x, y: 0.12, z: pos.z, sx: 1.2, sy: 0.24, sz: 1.2 };
}

export function sameItem(a: StudioItem | null, b: StudioItem | null) {
  return !!a && !!b && a.kind === b.kind && a.i === b.i;
}

export type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export type StudioHit =
  | { type: "lot"; handle: Handle }
  | { type: "resize"; item: StudioItem; handle: Handle }
  | { type: "item"; item: StudioItem }
  | { type: "empty" };

function boxMinMax(x: number, z: number, w: number, d: number) {
  return { x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 };
}

export function pickHandleOnBox(
  x: number,
  z: number,
  w: number,
  d: number,
  px: number,
  pz: number,
  band = 1.4,
): Handle | null {
  const { x0, x1, z0, z1 } = boxMinMax(x, z, w, d);
  const inX = px >= x0 - band && px <= x1 + band;
  const inZ = pz >= z0 - band && pz <= z1 + band;
  if (!inX || !inZ) return null;
  const nearE = Math.abs(px - x1) <= band;
  const nearW = Math.abs(px - x0) <= band;
  const nearN = Math.abs(pz - z1) <= band;
  const nearS = Math.abs(pz - z0) <= band;
  const ns = nearN ? "n" : nearS ? "s" : "";
  const ew = nearE ? "e" : nearW ? "w" : "";
  if (!ns && !ew) return null;
  if (ns && ew) return `${ns}${ew}` as Handle;
  return (ns || ew) as Handle;
}

export function pickLotHandle(bounds: LayoutSpec["bounds"], x: number, z: number, band = LOT_BAND): Handle | null {
  const w = bounds.maxX - bounds.minX;
  const d = bounds.maxZ - bounds.minZ;
  return pickHandleOnBox((bounds.minX + bounds.maxX) / 2, (bounds.minZ + bounds.maxZ) / 2, w, d, x, z, band);
}

export function pickLotEdge(bounds: LayoutSpec["bounds"], x: number, z: number, band = LOT_BAND): LotEdge | null {
  const h = pickLotHandle(bounds, x, z, band);
  if (!h) return null;
  if (h === "n" || h === "s" || h === "e" || h === "w") return h;
  if (h.startsWith("n")) return "n";
  if (h.startsWith("s")) return "s";
  return h.includes("e") ? "e" : "w";
}

export function resizeFootprint(
  x: number,
  z: number,
  w: number,
  d: number,
  handle: Handle,
  hx: number,
  hz: number,
  minW: number,
  minD: number,
) {
  let { x0, x1, z0, z1 } = boxMinMax(x, z, w, d);
  const sx = snap(hx);
  const sz = snap(hz);
  if (handle.includes("e")) x1 = sx;
  if (handle.includes("w")) x0 = sx;
  if (handle.includes("n")) z1 = sz;
  if (handle.includes("s")) z0 = sz;
  if (x1 < x0) [x0, x1] = [x1, x0];
  if (z1 < z0) [z0, z1] = [z1, z0];
  if (x1 - x0 < minW) {
    if (handle.includes("w") && !handle.includes("e")) x0 = x1 - minW;
    else x1 = x0 + minW;
  }
  if (z1 - z0 < minD) {
    if (handle.includes("s") && !handle.includes("n")) z0 = z1 - minD;
    else z1 = z0 + minD;
  }
  return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0 };
}

export function setLotHandle(spec: LayoutSpec, handle: Handle, x: number, z: number): LayoutSpec {
  const b = spec.bounds;
  const next = resizeFootprint(
    (b.minX + b.maxX) / 2,
    (b.minZ + b.maxZ) / 2,
    b.maxX - b.minX,
    b.maxZ - b.minZ,
    handle,
    x,
    z,
    LOT_MIN.w,
    LOT_MIN.d,
  );
  const bounds = {
    minX: snap(next.x - next.w / 2),
    maxX: snap(next.x + next.w / 2),
    minZ: snap(next.z - next.d / 2),
    maxZ: snap(next.z + next.d / 2),
  };
  if (bounds.maxX - bounds.minX > LOT_MAX.w || bounds.maxZ - bounds.minZ > LOT_MAX.d) return spec;
  if (
    bounds.minX === b.minX &&
    bounds.maxX === b.maxX &&
    bounds.minZ === b.minZ &&
    bounds.maxZ === b.maxZ
  ) {
    return spec;
  }
  const out = cloneSpec(spec);
  out.bounds = bounds;
  return out;
}

export function resizableBox(spec: LayoutSpec, item: StudioItem) {
  if (item.kind === "building") {
    const b = spec.buildings?.[item.i];
    return b ? { x: b.x, z: b.z, w: b.w, d: b.d, minW: BUILD_MIN, minD: BUILD_MIN } : null;
  }
  if (item.kind === "slab") {
    const s = spec.slabs?.[item.i];
    return s ? { x: s.x, z: s.z, w: s.w, d: s.d, minW: 4, minD: 4 } : null;
  }
  if (item.kind === "partition") {
    const p = spec.partitions?.[item.i];
    if (!p) return null;
    const alongX = p.w >= p.d;
    return { x: p.x, z: p.z, w: p.w, d: p.d, minW: alongX ? 2 : T, minD: alongX ? T : 2 };
  }
  return null;
}

export function pickResizeHandle(spec: LayoutSpec, item: StudioItem, x: number, z: number): Handle | null {
  const box = resizableBox(spec, item);
  if (!box) return null;
  return pickHandleOnBox(box.x, box.z, box.w, box.d, x, z, 1.45);
}

export function resizeItem(spec: LayoutSpec, item: StudioItem, handle: Handle, x: number, z: number): LayoutSpec {
  const box = resizableBox(spec, item);
  if (!box) return spec;
  const nextBox = resizeFootprint(box.x, box.z, box.w, box.d, handle, x, z, box.minW, box.minD);
  const next = cloneSpec(spec);
  if (item.kind === "building") {
    const b = next.buildings?.[item.i];
    if (!b) return spec;
    b.x = nextBox.x;
    b.z = nextBox.z;
    b.w = nextBox.w;
    b.d = nextBox.d;
    return next;
  }
  if (item.kind === "slab") {
    const s = next.slabs?.[item.i];
    if (!s) return spec;
    s.x = nextBox.x;
    s.z = nextBox.z;
    s.w = nextBox.w;
    s.d = nextBox.d;
    return next;
  }
  if (item.kind === "partition") {
    const p = next.partitions?.[item.i];
    if (!p) return spec;
    p.x = nextBox.x;
    p.z = nextBox.z;
    p.w = nextBox.w;
    p.d = nextBox.d;
    return next;
  }
  return spec;
}

export function moveItems(spec: LayoutSpec, items: StudioItem[], dx: number, dz: number): LayoutSpec {
  let next = spec;
  for (const item of items) {
    const pos = itemPos(next, item);
    if (!pos) continue;
    next = moveItem(next, item, pos.x + dx, pos.z + dz);
  }
  return next;
}

export function deleteItems(spec: LayoutSpec, items: StudioItem[]): LayoutSpec {
  const ordered = [...items].sort((a, b) => (a.kind === b.kind ? b.i - a.i : a.kind.localeCompare(b.kind)));
  let next = spec;
  for (const item of ordered) next = deleteItem(next, item);
  return next;
}

export function allItems(spec: LayoutSpec): StudioItem[] {
  const out: StudioItem[] = [];
  const push = (kind: StudioItem["kind"], n: number) => {
    for (let i = 0; i < n; i++) out.push({ kind, i } as StudioItem);
  };
  push("building", spec.buildings?.length ?? 0);
  push("slab", spec.slabs?.length ?? 0);
  push("partition", spec.partitions?.length ?? 0);
  push("cover", spec.cover?.length ?? 0);
  push("climb", spec.climbs?.length ?? 0);
  push("site", spec.sites.length);
  push("plant", spec.plantSpawns.length);
  push("watch", spec.watchSpawns.length);
  push("lamp", spec.lamps?.length ?? 0);
  push("tree", spec.trees?.length ?? 0);
  return out;
}

export function itemsInRect(spec: LayoutSpec, x0: number, z0: number, x1: number, z1: number): StudioItem[] {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minZ = Math.min(z0, z1);
  const maxZ = Math.max(z0, z1);
  return allItems(spec).filter((item) => {
    const p = itemPos(spec, item);
    return !!p && p.x >= minX && p.x <= maxX && p.z >= minZ && p.z <= maxZ;
  });
}

export function pickStudioHit(spec: LayoutSpec, x: number, z: number, sels: StudioItem[]): StudioHit {
  const lot = pickLotHandle(spec.bounds, x, z, LOT_BAND);
  const isCorner = !!lot && lot.length === 2;
  if (isCorner) return { type: "lot", handle: lot };
  for (const sel of sels) {
    const handle = pickResizeHandle(spec, sel, x, z);
    if (handle) return { type: "resize", item: sel, handle };
  }
  const item = pickItem(spec, x, z);
  if (item) {
    const handle = pickResizeHandle(spec, item, x, z);
    if (handle) return { type: "resize", item, handle };
    return { type: "item", item };
  }
  if (lot) return { type: "lot", handle: lot };
  return { type: "empty" };
}

export function inSelection(sels: StudioItem[], item: StudioItem | null) {
  return !!item && sels.some((s) => sameItem(s, item));
}

export function setLotEdge(spec: LayoutSpec, edge: LotEdge, value: number): LayoutSpec {
  const next = cloneSpec(spec);
  const b = next.bounds;
  if (edge === "n") b.maxZ = Math.max(b.minZ + LOT_MIN.d, Math.min(b.minZ + LOT_MAX.d, snap(value)));
  else if (edge === "s") b.minZ = Math.min(b.maxZ - LOT_MIN.d, Math.max(b.maxZ - LOT_MAX.d, snap(value)));
  else if (edge === "e") b.maxX = Math.max(b.minX + LOT_MIN.w, Math.min(b.minX + LOT_MAX.w, snap(value)));
  else b.minX = Math.min(b.maxX - LOT_MIN.w, Math.max(b.maxX - LOT_MAX.w, snap(value)));
  if (
    b.minX === spec.bounds.minX &&
    b.maxX === spec.bounds.maxX &&
    b.minZ === spec.bounds.minZ &&
    b.maxZ === spec.bounds.maxZ
  ) {
    return spec;
  }
  return next;
}

export function makeLotHandles(bounds: LayoutSpec["bounds"]) {
  const { minX, maxX, minZ, maxZ } = bounds;
  const w = maxX - minX;
  const d = maxZ - minZ;
  const group = new THREE.Group();
  group.name = "studio-lot";
  const mat = new THREE.MeshBasicMaterial({ color: 0xc8c4bc, transparent: true, opacity: 0.62, depthWrite: false });
  const cornerMat = new THREE.MeshBasicMaterial({ color: 0xe8d9a8, transparent: true, opacity: 0.9, depthWrite: false });
  const bar = (x: number, z: number, sx: number, sz: number, m = mat) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.36, sz), m);
    mesh.position.set(x, 0.22, z);
    mesh.userData.lot = true;
    group.add(mesh);
  };
  bar((minX + maxX) / 2, maxZ, Math.max(4, w - 3), 1.7);
  bar((minX + maxX) / 2, minZ, Math.max(4, w - 3), 1.7);
  bar(maxX, (minZ + maxZ) / 2, 1.7, Math.max(4, d - 3));
  bar(minX, (minZ + maxZ) / 2, 1.7, Math.max(4, d - 3));
  const post = 2.1;
  bar(maxX, maxZ, post, post, cornerMat);
  bar(minX, maxZ, post, post, cornerMat);
  bar(maxX, minZ, post, post, cornerMat);
  bar(minX, minZ, post, post, cornerMat);
  return group;
}

function addHandleKnobs(group: THREE.Group, x: number, y: number, z: number, w: number, d: number) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xf2e6b8, transparent: true, opacity: 0.95, depthWrite: false });
  const knob = (kx: number, kz: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.55, 1.05), mat);
    m.position.set(kx, y, kz);
    group.add(m);
  };
  const x0 = x - w / 2;
  const x1 = x + w / 2;
  const z0 = z - d / 2;
  const z1 = z + d / 2;
  knob(x, z1);
  knob(x, z0);
  knob(x1, z);
  knob(x0, z);
  knob(x1, z1);
  knob(x0, z1);
  knob(x1, z0);
  knob(x0, z0);
}

export function makeStudioGizmos(spec: LayoutSpec, sels: StudioItem[]) {
  const group = makeLotHandles(spec.bounds);
  group.name = "studio-gizmos";
  const glow = new THREE.MeshBasicMaterial({ color: 0xe8d9a8, transparent: true, opacity: 0.2, depthWrite: false });
  for (const item of sels) {
    const box = itemBox(spec, item);
    if (!box) continue;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(box.sx + 0.24, box.sy + 0.24, box.sz + 0.24), glow);
    frame.position.set(box.x, box.y, box.z);
    group.add(frame);
    const resize = resizableBox(spec, item);
    if (resize) addHandleKnobs(group, resize.x, box.y + box.sy / 2 + 0.2, resize.z, resize.w, resize.d);
  }
  return group;
}

export function loadStored(): LayoutSpec | null {
  try {
    const raw = localStorage.getItem(STUDIO_STORE);
    if (!raw) return null;
    const spec = JSON.parse(raw) as LayoutSpec;
    if (!spec?.id || !spec.bounds) return null;
    return spec;
  } catch {
    return null;
  }
}

export function saveStored(spec: LayoutSpec) {
  try {
    localStorage.setItem(STUDIO_STORE, JSON.stringify(spec));
  } catch {
    /* quota */
  }
}

export function downloadSpec(spec: LayoutSpec) {
  const blob = new Blob([JSON.stringify(spec, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${spec.id || "draft"}-layout.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function postDraft(spec: LayoutSpec) {
  const res = await fetch("/api/studio-draft", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(spec),
  });
  if (!res.ok) throw new Error(`studio save ${res.status}`);
}

export function ghostSize(tool: ToolId, bw: number, bd: number): [number, number, number] {
  if (tool === "erase") return [2, 0.2, 2];
  if (tool === "building") return [bw, STOREY, bd];
  if (tool === "cut") return [GRID, 0.16, GRID];
  if (tool === "floor") return [bw, 0.16, bd];
  if (tool === "wall") return [Math.max(bw, T), STOREY, T];
  if (tool === "door") return [2.4, 2.4, 0.28];
  if (tool === "window") return [1.8, 1.3, 0.28];
  if (tool in COVER_SIZE) return COVER_SIZE[tool as CoverKind];
  if (tool === "climb") return [2.2, 0.4, 7];
  if (tool === "ladder") return [1.2, STOREY, 0.4];
  if (tool === "siteA" || tool === "siteB") return [3, 0.12, 3];
  if (tool === "plant" || tool === "watch") return [1.2, 0.2, 1.2];
  if (tool === "lamp") return [0.2, 3.2, 0.2];
  if (tool === "tree") return [1.8, 4, 1.8];
  return [2, 0.2, 2];
}

export function nextTheme(cur: ThemeId): ThemeId {
  const i = THEMES.indexOf(cur);
  return THEMES[(i + 1) % THEMES.length]!;
}

export type OrbitCam = {
  tx: number;
  ty: number;
  tz: number;
  dist: number;
  theta: number;
  phi: number;
};

export function defaultOrbit(bounds: LayoutSpec["bounds"]): OrbitCam {
  const w = bounds.maxX - bounds.minX;
  const d = bounds.maxZ - bounds.minZ;
  return {
    tx: (bounds.minX + bounds.maxX) / 2,
    ty: 0,
    tz: (bounds.minZ + bounds.maxZ) / 2,
    dist: Math.max(58, Math.hypot(w, d) * 0.72),
    theta: 0.58,
    phi: 0,
  };
}

export function applyOrbit(camera: THREE.PerspectiveCamera, cam: OrbitCam) {
  const { tx, ty, tz, dist, theta, phi } = cam;
  camera.position.set(
    tx + dist * Math.sin(theta) * Math.sin(phi),
    ty + dist * Math.cos(theta),
    tz + dist * Math.sin(theta) * Math.cos(phi),
  );
  camera.lookAt(tx, ty, tz);
  camera.fov = 48;
  camera.near = 0.2;
  camera.far = 400;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}

export function orbitDrag(cam: OrbitCam, dx: number, dy: number) {
  cam.phi -= dx * 0.008;
  cam.theta = Math.max(0.06, Math.min(1.32, cam.theta - dy * 0.008));
}

export function panDrag(cam: OrbitCam, dx: number, dy: number) {
  const scale = cam.dist * 0.0024;
  const rx = Math.cos(cam.phi);
  const rz = -Math.sin(cam.phi);
  const fx = -Math.sin(cam.phi);
  const fz = -Math.cos(cam.phi);
  cam.tx += rx * dx * scale - fx * dy * scale;
  cam.tz += rz * dx * scale - fz * dy * scale;
}

export function zoomOrbit(cam: OrbitCam, deltaY: number, maxDist = 280) {
  const k = deltaY > 0 ? 1.12 : 1 / 1.12;
  cam.dist = Math.max(14, Math.min(maxDist, cam.dist * k));
}

export function turnYaw(yaw: number, steps = 1) {
  return yaw + (Math.PI / 2) * steps;
}

export function canvasNdc(el: HTMLElement, clientX: number, clientY: number) {
  const r = el.getBoundingClientRect();
  return {
    x: ((clientX - r.left) / Math.max(1, r.width)) * 2 - 1,
    y: -((clientY - r.top) / Math.max(1, r.height)) * 2 + 1,
  };
}

const _ndc = new THREE.Vector2();
const _ray = new THREE.Raycaster();
const _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _hit = new THREE.Vector3();

export function pickGround(camera: THREE.Camera, ndcX: number, ndcY: number) {
  camera.updateMatrixWorld();
  _ndc.set(ndcX, ndcY);
  _ray.setFromCamera(_ndc, camera);
  if (!_ray.ray.intersectPlane(_plane, _hit)) return null;
  return _hit.clone();
}

export function cellKey(tool: string, x: number, z: number) {
  return `${tool}:${x},${z}`;
}

export function makeStudioGrid(bounds: LayoutSpec["bounds"]) {
  const w = bounds.maxX - bounds.minX;
  const d = bounds.maxZ - bounds.minZ;
  const size = Math.max(w, d) + 8;
  const div = Math.max(2, Math.round(size / GRID));
  const grid = new THREE.GridHelper(size, div, 0x7a7670, 0x4e4c48);
  grid.position.set((bounds.minX + bounds.maxX) / 2, 0.05, (bounds.minZ + bounds.maxZ) / 2);
  grid.name = "studio-grid";
  return grid;
}

export function toolFromCode(code: string, palette: PaletteId = "build"): ToolId | null {
  if (code === "KeyQ" || code === "KeyH") return "select";
  if (code === "KeyX") return "erase";
  if (code === "Digit1" || code === "Numpad1") return palette === "kit" ? "crate" : "building";
  if (code === "Digit2" || code === "Numpad2" || code === "KeyF") return palette === "kit" ? "low" : "floor";
  if (code === "KeyU") return "cut";
  if (code === "KeyI") return "wall";
  if (code === "KeyO") return "door";
  if (code === "KeyV") return "window";
  if (code === "Digit3" || code === "Numpad3") return "crate";
  if (code === "KeyJ") return "jumpCrate";
  if (code === "KeyK") return "fullCrate";
  if (code === "Digit4" || code === "Numpad4") return "low";
  if (code === "Digit5" || code === "Numpad5") return "high";
  if (code === "Digit6" || code === "Numpad6") return "truck";
  if (code === "Digit7" || code === "Numpad7") return "siteA";
  if (code === "Digit8" || code === "Numpad8") return "siteB";
  if (code === "Digit9" || code === "Numpad9") return "plant";
  if (code === "Digit0" || code === "Numpad0") return "watch";
  if (code === "KeyC") return "climb";
  if (code === "KeyN") return "ladder";
  if (code === "KeyL") return "lamp";
  if (code === "KeyT") return "tree";
  return null;
}

export type WallHit = {
  i: number;
  wall: DoorWall;
  at: number;
  x: number;
  y: number;
  z: number;
  floor: number;
};

export function growLot(spec: LayoutSpec, delta: number): LayoutSpec {
  const next = cloneSpec(spec);
  const b = next.bounds;
  const w = b.maxX - b.minX + delta * 2;
  const d = b.maxZ - b.minZ + delta * 2;
  if (w < LOT_MIN.w || d < LOT_MIN.d || w > LOT_MAX.w || d > LOT_MAX.d) return spec;
  next.bounds = {
    minX: b.minX - delta,
    maxX: b.maxX + delta,
    minZ: b.minZ - delta,
    maxZ: b.maxZ + delta,
  };
  return next;
}

export function clampBuildSize(n: number) {
  return Math.max(BUILD_MIN, Math.min(BUILD_MAX, snap(Math.max(n, BUILD_MIN))));
}

export function nearestBuildingIndex(spec: LayoutSpec, x: number, z: number, r = 10) {
  let best = -1;
  let dist = r;
  for (let i = 0; i < (spec.buildings ?? []).length; i++) {
    const b = spec.buildings![i]!;
    const hx = Math.max(Math.abs(x - b.x) - b.w / 2, 0);
    const hz = Math.max(Math.abs(z - b.z) - b.d / 2, 0);
    const n = Math.hypot(hx, hz);
    if (n < dist) {
      dist = n;
      best = i;
    }
  }
  return best;
}

export function resizeNearestBuilding(spec: LayoutSpec, x: number, z: number, dw: number, dd: number): LayoutSpec {
  const i = nearestBuildingIndex(spec, x, z, 8);
  if (i < 0) return spec;
  const next = cloneSpec(spec);
  const b = next.buildings![i]!;
  b.w = clampBuildSize(b.w + dw);
  b.d = clampBuildSize(b.d + dd);
  return next;
}

export function placeBuildingRect(
  spec: LayoutSpec,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  tool: ToolId,
  yaw: number,
  y = 0,
): LayoutSpec {
  if (tool === "cut") return cutSlabRect(spec, x0, z0, x1, z1);
  if (tool === "wall") {
    const foot = wallFootprint(x0, z0, x1, z1);
    const next = cloneSpec(spec);
    next.partitions = next.partitions ?? [];
    next.partitions.push({
      x: foot.x,
      z: foot.z,
      w: foot.w,
      d: foot.d,
      y: rectSurfaceY(spec, x0, z0, x1, z1),
      h: STOREY,
    });
    return next;
  }
  const w = clampBuildSize(Math.abs(x1 - x0));
  const d = clampBuildSize(Math.abs(z1 - z0));
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  if (tool === "floor") {
    const placeY = Math.max(SLAB_Y, y || SLAB_Y);
    const fit = snapFloor(spec, x0, z0, x1, z1, placeY);
    return place(spec, "floor", fit.x, fit.z, { yaw, bw: fit.w, bd: fit.d, y: fit.y });
  }
  const placeY = rectSurfaceY(spec, x0, z0, x1, z1);
  const raised = raiseStoreyIfMatch(spec, cx, cz, w, d, placeY);
  if (raised) return raised;
  return place(spec, "building", cx, cz, { yaw, bw: w, bd: d, y: placeY });
}

function distToSeg(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2));
  const qx = ax + t * dx;
  const qz = az + t * dz;
  return { dist: Math.hypot(px - qx, pz - qz), x: qx, z: qz };
}

function wallSeg(b: { x: number; z: number; w: number; d: number }, wall: DoorWall) {
  const x0 = b.x - b.w / 2;
  const x1 = b.x + b.w / 2;
  const z0 = b.z - b.d / 2;
  const z1 = b.z + b.d / 2;
  if (wall === "n") return { ax: x0, az: z1, bx: x1, bz: z1 };
  if (wall === "s") return { ax: x0, az: z0, bx: x1, bz: z0 };
  if (wall === "e") return { ax: x1, az: z0, bx: x1, bz: z1 };
  return { ax: x0, az: z0, bx: x0, bz: z1 };
}

function atOnWall(b: { x: number; z: number }, wall: DoorWall, x: number, z: number) {
  return wall === "n" || wall === "s" ? x - b.x : z - b.z;
}

export function nearestBuildingWall(spec: LayoutSpec, x: number, z: number, y = 0, maxDist = 6): WallHit | null {
  let best: WallHit | null = null;
  let dist = maxDist;
  for (let i = 0; i < (spec.buildings ?? []).length; i++) {
    const b = spec.buildings![i]!;
    const floors = buildingFloors(b);
    const base = buildingBase(b);
    const floor = floors === 1 ? 0 : Math.max(0, Math.min(floors - 1, Math.floor((y - base) / STOREY)));
    for (const wall of ["n", "s", "e", "w"] as DoorWall[]) {
      const seg = wallSeg(b, wall);
      const hit = distToSeg(x, z, seg.ax, seg.az, seg.bx, seg.bz);
      if (hit.dist < dist) {
        dist = hit.dist;
        best = { i, wall, at: atOnWall(b, wall, hit.x, hit.z), x: hit.x, y: base + floor * STOREY, z: hit.z, floor };
      }
    }
  }
  return best;
}

export function pickBuildingWall(
  spec: LayoutSpec,
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  maxDist = 10,
): WallHit | null {
  let best: WallHit | null = null;
  let dist = maxDist;
  for (let i = 0; i < (spec.buildings ?? []).length; i++) {
    const b = spec.buildings![i]!;
    const h = buildingHeight(b);
    const y0 = buildingBase(b);
    const x0 = b.x - b.w / 2;
    const x1 = b.x + b.w / 2;
    const z0 = b.z - b.d / 2;
    const z1 = b.z + b.d / 2;
    const faces: { wall: DoorWall; t: number; axis: "x" | "z" }[] = [];
    if (Math.abs(dir.z) > 1e-4) {
      faces.push({ wall: "n", t: (z1 - origin.z) / dir.z, axis: "z" });
      faces.push({ wall: "s", t: (z0 - origin.z) / dir.z, axis: "z" });
    }
    if (Math.abs(dir.x) > 1e-4) {
      faces.push({ wall: "e", t: (x1 - origin.x) / dir.x, axis: "x" });
      faces.push({ wall: "w", t: (x0 - origin.x) / dir.x, axis: "x" });
    }
    for (const f of faces) {
      if (f.t < 0.2 || f.t >= dist) continue;
      const p = origin.clone().addScaledVector(dir, f.t);
      if (p.y < y0 - 0.05 || p.y > y0 + h + 0.2) continue;
      if (f.axis === "z" && (p.x < x0 - 0.05 || p.x > x1 + 0.05)) continue;
      if (f.axis === "x" && (p.z < z0 - 0.05 || p.z > z1 + 0.05)) continue;
      const floors = buildingFloors(b);
      const floor = floors === 1 ? 0 : Math.max(0, Math.min(floors - 1, Math.floor((p.y - y0) / STOREY)));
      dist = f.t;
      best = { i, wall: f.wall, at: atOnWall(b, f.wall, p.x, p.z), x: p.x, y: p.y, z: p.z, floor };
    }
  }
  return best;
}

export function addOpening(spec: LayoutSpec, kind: OpeningKind, hit: WallHit): LayoutSpec {
  const next = cloneSpec(spec);
  const b = next.buildings?.[hit.i];
  if (!b) return spec;
  const width = DOOR_W[kind];
  const along = hit.wall === "n" || hit.wall === "s" ? b.w : b.d;
  const pad = width / 2 + 0.4;
  const at = Math.max(-along / 2 + pad, Math.min(along / 2 - pad, Math.round(hit.at * 2) / 2));
  const entry: WallOpening = { wall: hit.wall, at, width, floor: hit.floor };
  const list = kind === "window" ? (b.windows ??= []) : (b.doors ??= []);
  const dup = list.findIndex(
    (o) => o.wall === hit.wall && (o.floor ?? 0) === hit.floor && Math.abs((o.at ?? 0) - at) < 0.8,
  );
  if (dup >= 0) list.splice(dup, 1, entry);
  else list.push(entry);
  return next;
}

export function openingPose(hit: WallHit, kind: OpeningKind) {
  const w = DOOR_W[kind];
  const h = kind === "window" ? 1.3 : 2.4;
  const y = kind === "window" ? hit.y + 1.7 : hit.y + h / 2;
  const sx = hit.wall === "n" || hit.wall === "s" ? w : 0.28;
  const sz = hit.wall === "e" || hit.wall === "w" ? w : 0.28;
  return { x: hit.x, y, z: hit.z, sx, sy: h, sz };
}

export function ladderPose(hit: WallHit) {
  const out = 0.22;
  const x = hit.x + (hit.wall === "e" ? out : hit.wall === "w" ? -out : 0);
  const z = hit.z + (hit.wall === "n" ? out : hit.wall === "s" ? -out : 0);
  const along = hit.wall === "n" || hit.wall === "s";
  return { x, y: hit.y + STOREY / 2, z, sx: along ? 1.2 : 0.4, sy: STOREY, sz: along ? 0.4 : 1.2 };
}
