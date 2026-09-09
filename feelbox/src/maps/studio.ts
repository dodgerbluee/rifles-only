/**
 * Home-page map sketch. The human paints a LayoutSpec from orbit; the agent
 * finalizes (routes, names, map-check, register). See .cursor/skills/design-map/SKILL.md.
 */
import * as THREE from "three";
import {
  STOREY,
  YARD_SPEC,
  buildingBase,
  buildingFloors,
  buildingHeight,
  type ClimbDir,
  type CoverSpec,
  type DoorWall,
  type LayoutSpec,
  type ThemeId,
  type WallOpening,
} from "./layout";

export const STUDIO_STORE = "rifles-studio-spec";
export const GRID = 2;

export type PaletteId = "build" | "kit";

export type ToolId =
  | "select"
  | "building"
  | "floor"
  | "door"
  | "window"
  | "crate"
  | "low"
  | "high"
  | "truck"
  | "siteA"
  | "siteB"
  | "plant"
  | "watch"
  | "climb"
  | "lamp"
  | "tree";

export type OpeningKind = "door" | "window";

export type ToolDef = { id: ToolId; key: string; label: string };

export const BUILD_TOOLS: ToolDef[] = [
  { id: "select", key: "Q", label: "Select" },
  { id: "building", key: "1", label: "Building" },
  { id: "floor", key: "2", label: "Floor" },
  { id: "door", key: "O", label: "Door" },
  { id: "window", key: "V", label: "Window" },
];

export const KIT_TOOLS: ToolDef[] = [
  { id: "crate", key: "3", label: "Crate" },
  { id: "low", key: "4", label: "Low" },
  { id: "high", key: "5", label: "High" },
  { id: "truck", key: "6", label: "Truck" },
  { id: "siteA", key: "7", label: "A" },
  { id: "siteB", key: "8", label: "B" },
  { id: "plant", key: "9", label: "Plant" },
  { id: "watch", key: "0", label: "Watch" },
  { id: "climb", key: "C", label: "Climb" },
  { id: "lamp", key: "L", label: "Lamp" },
  { id: "tree", key: "T", label: "Tree" },
];

export const TOOLS: ToolDef[] = [...BUILD_TOOLS, ...KIT_TOOLS];

export const BUILD_IDS: ToolId[] = BUILD_TOOLS.map((t) => t.id);
export const KIT_IDS: ToolId[] = KIT_TOOLS.map((t) => t.id);
export const OPENING_TOOLS: OpeningKind[] = ["door", "window"];
export const RECT_TOOLS: ToolId[] = ["building", "floor"];

export function paletteOf(tool: ToolId): PaletteId {
  return KIT_IDS.includes(tool) ? "kit" : "build";
}

export function toolsFor(palette: PaletteId) {
  return palette === "kit" ? KIT_TOOLS : BUILD_TOOLS;
}

export function isRectTool(tool: ToolId) {
  return RECT_TOOLS.includes(tool);
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
export const LOT_BAND = 3.2;
export const BUILD_MIN = 6;
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

const COVER: CoverSpec["kind"][] = ["crate", "low", "high", "truck"];

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

  if (tool === "building") {
    next.buildings = next.buildings ?? [];
    next.buildings.push({
      x: gx,
      z: gz,
      w: bw,
      d: bd,
      y: opts.y ?? 0,
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

export function surfaceAt(spec: LayoutSpec, x: number, z: number) {
  let y = 0;
  for (const s of spec.slabs ?? []) {
    if (containsXZ(x, z, s.x, s.z, s.w, s.d)) y = Math.max(y, s.y);
  }
  for (const b of spec.buildings ?? []) {
    if (containsXZ(x, z, b.x, b.z, b.w, b.d)) y = Math.max(y, buildingBase(b) + buildingHeight(b));
  }
  return y;
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
    if (inside(s.x, s.z, s.w, s.d)) {
      hits.push({ item: { kind: "slab", i }, y: s.y, area: s.w * s.d, dist: 0 });
    }
  }
  const stamp = (item: StudioItem, ax: number, az: number, y: number, area: number) => {
    const dist = Math.hypot(x - ax, z - az);
    if (dist <= r) hits.push({ item, y, area, dist });
  };
  for (let i = 0; i < (spec.cover ?? []).length; i++) {
    const c = spec.cover![i]!;
    stamp({ kind: "cover", i }, c.x, c.z, 1, 2);
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
  if (item.kind === "cover") {
    const c = spec.cover?.[item.i];
    if (!c) return null;
    const [sx, sy, sz] = ghostSize(c.kind, 12, 10);
    return { x: c.x, y: sy / 2, z: c.z, sx, sy, sz };
  }
  if (item.kind === "climb") {
    const c = spec.climbs?.[item.i];
    if (!c) return null;
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

export function pickLotEdge(bounds: LayoutSpec["bounds"], x: number, z: number, band = LOT_BAND): LotEdge | null {
  const { minX, maxX, minZ, maxZ } = bounds;
  const alongX = x >= minX - 1 && x <= maxX + 1;
  const alongZ = z >= minZ - 1 && z <= maxZ + 1;
  if (alongX && z > maxZ && z <= maxZ + band) return "n";
  if (alongX && z < minZ && z >= minZ - band) return "s";
  if (alongZ && x > maxX && x <= maxX + band) return "e";
  if (alongZ && x < minX && x >= minX - band) return "w";
  return null;
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
  const mat = new THREE.MeshBasicMaterial({ color: 0xc8c4bc, transparent: true, opacity: 0.55, depthWrite: false });
  const bar = (x: number, z: number, sx: number, sz: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.28, sz), mat);
    m.position.set(x, 0.2, z);
    m.userData.lot = true;
    group.add(m);
  };
  bar((minX + maxX) / 2, maxZ + 1.1, w + 2.2, 1.6);
  bar((minX + maxX) / 2, minZ - 1.1, w + 2.2, 1.6);
  bar(maxX + 1.1, (minZ + maxZ) / 2, 1.6, d);
  bar(minX - 1.1, (minZ + maxZ) / 2, 1.6, d);
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
  if (tool === "building") return [bw, STOREY, bd];
  if (tool === "floor") return [bw, 0.16, bd];
  if (tool === "door") return [2.4, 2.4, 0.28];
  if (tool === "window") return [1.8, 1.3, 0.28];
  if (tool === "crate") return [1.4, 1.1, 1.4];
  if (tool === "low") return [2.4, 0.9, 0.7];
  if (tool === "high") return [0.7, 2.1, 2.6];
  if (tool === "truck") return [5.2, 1.4, 2.1];
  if (tool === "climb") return [2.2, 0.4, 7];
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
  const scale = cam.dist * 0.0018;
  const rx = Math.cos(cam.phi);
  const rz = -Math.sin(cam.phi);
  const fx = -Math.sin(cam.phi);
  const fz = -Math.cos(cam.phi);
  cam.tx -= rx * dx * scale + fx * dy * scale;
  cam.tz -= rz * dx * scale + fz * dy * scale;
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
  if (code === "KeyQ") return "select";
  if (code === "Digit1" || code === "Numpad1") return palette === "kit" ? "crate" : "building";
  if (code === "Digit2" || code === "Numpad2" || code === "KeyF") return palette === "kit" ? "low" : "floor";
  if (code === "KeyO" || code === "KeyD") return "door";
  if (code === "KeyV") return "window";
  if (code === "Digit3" || code === "Numpad3") return "crate";
  if (code === "Digit4" || code === "Numpad4") return "low";
  if (code === "Digit5" || code === "Numpad5") return "high";
  if (code === "Digit6" || code === "Numpad6") return "truck";
  if (code === "Digit7" || code === "Numpad7") return "siteA";
  if (code === "Digit8" || code === "Numpad8") return "siteB";
  if (code === "Digit9" || code === "Numpad9") return "plant";
  if (code === "Digit0" || code === "Numpad0") return "watch";
  if (code === "KeyC") return "climb";
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
  const w = clampBuildSize(Math.abs(x1 - x0));
  const d = clampBuildSize(Math.abs(z1 - z0));
  const placeY = tool === "floor" ? Math.max(SLAB_Y, y || SLAB_Y) : y;
  return place(spec, isRectTool(tool) ? tool : "building", (x0 + x1) / 2, (z0 + z1) / 2, { yaw, bw: w, bd: d, y: placeY });
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
  if (kind !== "window" && (b.floors ?? 1) > 1) b.stairs = b.stairs ?? hit.wall;
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
