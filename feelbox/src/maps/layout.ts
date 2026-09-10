/**
 * Compact layout → kit. Write a LayoutSpec, never a pile of box() calls.
 */
import * as THREE from "three";
import { finish, makeKit, sky, T, type Kit } from "./kit";
import type { Site, World } from "../world";

export type ThemeId = "winter" | "harbor" | "stone" | "dust";
export type DoorWall = "n" | "s" | "e" | "w";

export type WallOpening = { wall: DoorWall; at?: number; width?: number; floor?: number };

export type BuildingInterior = "floors" | "empty";

export type BuildingSpec = {
  x: number;
  z: number;
  w: number;
  d: number;
  /** Wall-base height. Stack another volume on a slab by setting this to the slab top. */
  y?: number;
  h?: number;
  floors?: number;
  /** Walkable decks between storeys. Omitted = floors (Siding / Yard). */
  interior?: BuildingInterior;
  doors?: WallOpening[];
  windows?: WallOpening[];
  stairs?: DoorWall;
  mat?: "brick" | "plaster" | "wood" | "metal";
};

export type XzRect = { x: number; z: number; w: number; d: number };

export type SlabSpec = {
  x: number;
  z: number;
  w: number;
  d: number;
  /** Walk-surface height (top of the deck). */
  y: number;
  /** World-space cuts punched out of this deck. */
  holes?: XzRect[];
};

/** Thin interior wall. Thickness is usually kit T. */
export type PartitionSpec = {
  x: number;
  z: number;
  w: number;
  d: number;
  y?: number;
  h?: number;
};

export const HOLE_MIN = 0.12;

export type CoverKind = "crate" | "jumpCrate" | "fullCrate" | "low" | "high" | "truck";

export type CoverSpec = {
  x: number;
  z: number;
  kind: CoverKind;
};

/**
 * Cover extents [w, h, d]. Player stand eye 1.64, crouch eye 1.1, stand body 1.78.
 * Jump apex is tuning.jumpH (1.05). Capsule clears a lip at py+0.08, so jump-on
 * needs height under ~0.97 and walk:true so groundHeight will land you.
 */
export const COVER_SIZE: Record<CoverKind, [number, number, number]> = {
  crate: [0.5, 1.1, 0.5], // 1 studio cell (GRID); stand-peek (eye 1.64)
  jumpCrate: [2, 0.9, 2], // jump-on + rim peek (crouch eye 1.1 still clears)
  fullCrate: [2, 2.2, 2], // taller than stand body 1.78 / eye 1.64
  low: [2.4, 0.9, 0.7],
  high: [0.7, 2.1, 2.6],
  truck: [5.2, 1.4, 2.1],
};

/** Cover tops are standable. High is a wall you can still land on if you get up there. */
export const COVER_WALK: Record<CoverKind, boolean> = {
  crate: true,
  jumpCrate: true,
  fullCrate: true,
  low: true,
  high: true,
  truck: true,
};

export type ClimbDir = "+x" | "-x" | "+z" | "-z";

export type ClimbKind = "stairs" | "ladder";

export type ClimbSpec = {
  x: number;
  z: number;
  dir: ClimbDir;
  height?: number;
  width?: number;
  startY?: number;
  /** Default stairs. Ladder is a steep vertical climb against a wall. */
  kind?: ClimbKind;
};

export type LayoutSpec = {
  id: string;
  title: string;
  blurb: string;
  theme: ThemeId;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  wallH?: number;
  buildings?: BuildingSpec[];
  slabs?: SlabSpec[];
  partitions?: PartitionSpec[];
  cover?: CoverSpec[];
  climbs?: ClimbSpec[];
  sites: { id: Site["id"]; call: string; name: string; x: number; z: number; y?: number; r?: number }[];
  plantSpawns: [number, number][];
  watchSpawns: [number, number][];
  routes: [number, number, number?][][];
  lamps?: [number, number][];
  trees?: [number, number][];
};

const THEMES: Record<
  ThemeId,
  { bg: number; fog: number; horizon: string; zenith: string; ground: "snow" | "asphalt" | "cobble" | "dirt"; wall: "brick" | "plaster" | "lime" }
> = {
  winter: { bg: 0xb4bcc4, fog: 0xb4bcc4, horizon: "#c8d0d6", zenith: "#5a6068", ground: "snow", wall: "brick" },
  harbor: { bg: 0x6e6a64, fog: 0x6a6560, horizon: "#7a746c", zenith: "#4a4844", ground: "asphalt", wall: "brick" },
  stone: { bg: 0x9aa094, fog: 0x8a8478, horizon: "#9aa094", zenith: "#6a6860", ground: "cobble", wall: "plaster" },
  dust: { bg: 0xc4a070, fog: 0xc4a882, horizon: "#c4a070", zenith: "#8a6238", ground: "dirt", wall: "lime" },
};

export function subtractRect(host: XzRect, hole: XzRect, min = HOLE_MIN): XzRect[] {
  const hx0 = host.x - host.w / 2;
  const hx1 = host.x + host.w / 2;
  const hz0 = host.z - host.d / 2;
  const hz1 = host.z + host.d / 2;
  const ox0 = Math.max(hx0, hole.x - hole.w / 2);
  const ox1 = Math.min(hx1, hole.x + hole.w / 2);
  const oz0 = Math.max(hz0, hole.z - hole.d / 2);
  const oz1 = Math.min(hz1, hole.z + hole.d / 2);
  if (ox1 <= ox0 || oz1 <= oz0) return [host];
  const out: XzRect[] = [];
  const push = (x0: number, x1: number, z0: number, z1: number) => {
    const w = x1 - x0;
    const d = z1 - z0;
    if (w >= min && d >= min) out.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w, d });
  };
  push(hx0, ox0, hz0, hz1);
  push(ox1, hx1, hz0, hz1);
  push(ox0, ox1, hz0, oz0);
  push(ox0, ox1, oz1, hz1);
  return out;
}

export function punchRects(host: XzRect, holes: XzRect[] | undefined, min = HOLE_MIN): XzRect[] {
  let rects: XzRect[] = [host];
  for (const hole of holes ?? []) {
    const next: XzRect[] = [];
    for (const r of rects) next.push(...subtractRect(r, hole, min));
    rects = next;
  }
  return rects;
}

function spans(a: number, b: number, gaps: { c: number; w: number }[]) {
  let out: [number, number][] = [[Math.min(a, b), Math.max(a, b)]];
  for (const g of gaps) {
    const g0 = g.c - g.w / 2;
    const g1 = g.c + g.w / 2;
    const next: [number, number][] = [];
    for (const [s, e] of out) {
      if (g1 <= s || g0 >= e) {
        next.push([s, e]);
        continue;
      }
      if (g0 > s) next.push([s, g0]);
      if (g1 < e) next.push([g1, e]);
    }
    out = next;
  }
  return out.filter(([s, e]) => e - s > 0.24);
}

function wallAlongX(kit: Kit, z: number, x0: number, x1: number, y: number, h: number, mat: THREE.Material, gaps: { c: number; w: number }[]) {
  for (const [s, e] of spans(x0, x1, gaps)) {
    kit.box((s + e) / 2, y + h / 2, z, e - s, h, T, mat);
  }
}

function wallAlongZ(kit: Kit, x: number, z0: number, z1: number, y: number, h: number, mat: THREE.Material, gaps: { c: number; w: number }[]) {
  for (const [s, e] of spans(z0, z1, gaps)) {
    kit.box(x, y + h / 2, (s + e) / 2, T, h, e - s, mat);
  }
}

export const STOREY = 2.88;
export const STOREY_MIN = 1;
export const STOREY_MAX = 10;
/** Same-Y walk decks within this are treated as one surface. */
export const WALK_Y_EPS = 0.08;
const WIN_SILL = 1.05;
const WIN_HEAD = 2.35;

export function buildingFloors(b: BuildingSpec) {
  return Math.max(STOREY_MIN, Math.min(STOREY_MAX, Math.round(b.floors ?? 1)));
}

export function buildingInterior(b: BuildingSpec): BuildingInterior {
  return b.interior === "empty" ? "empty" : "floors";
}

export function buildingHasDecks(b: BuildingSpec) {
  return buildingFloors(b) > 1 && buildingInterior(b) === "floors";
}

/** Later / same-Y walk decks lose the overlapping XZ so two slabs cannot glow. */
export function resolveWalkDecks(decks: SlabSpec[], yEps = WALK_Y_EPS): SlabSpec[] {
  const out: SlabSpec[] = [];
  for (const deck of decks) {
    let pieces = punchRects({ x: deck.x, z: deck.z, w: deck.w, d: deck.d }, deck.holes);
    for (const prior of out) {
      if (Math.abs(prior.y - deck.y) > yEps) continue;
      pieces = pieces.flatMap((p) => subtractRect(p, prior));
    }
    for (const p of pieces) out.push({ x: p.x, z: p.z, w: p.w, d: p.d, y: deck.y });
  }
  return out;
}

export function buildingHeight(b: BuildingSpec, wallH = 6.2) {
  const floors = buildingFloors(b);
  if (floors === 1) return b.h ?? wallH - 0.4;
  return floors * STOREY;
}

export function buildingBase(b: BuildingSpec) {
  return b.y ?? 0;
}

export function asLayoutSpec(raw: unknown): LayoutSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as LayoutSpec;
  if (typeof s.id !== "string" || !s.bounds) return null;
  const b = s.bounds;
  if (![b.minX, b.maxX, b.minZ, b.maxZ].every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  if (!Array.isArray(s.sites) || !Array.isArray(s.plantSpawns) || !Array.isArray(s.watchSpawns)) return null;
  return s;
}

function alongOf(b: BuildingSpec, wall: DoorWall) {
  return wall === "n" || wall === "s" ? b.w : b.d;
}

function midOf(b: BuildingSpec, wall: DoorWall) {
  return wall === "n" || wall === "s" ? b.x : b.z;
}

function openingGaps(b: BuildingSpec, listed: WallOpening[] | undefined, wall: DoorWall, floor: number, fallbackW: number) {
  const along = alongOf(b, wall);
  const hits = (listed ?? []).filter((d) => d.wall === wall && (d.floor ?? 0) === floor);
  if (!hits.length) return [] as { c: number; w: number }[];
  const mid = midOf(b, wall);
  return hits.map((d) => ({
    c: mid + (d.at ?? 0),
    w: Math.min(along - 0.8, d.width ?? fallbackW),
  }));
}

function doorGaps(b: BuildingSpec, wall: DoorWall, floor: number) {
  return openingGaps(b, b.doors, wall, floor, 2.4);
}

function windowGaps(b: BuildingSpec, wall: DoorWall, floor: number) {
  return openingGaps(b, b.windows, wall, floor, 1.8);
}

export function facingCenter(b: BuildingSpec, cx: number, cz: number): DoorWall {
  const dx = cx - b.x;
  const dz = cz - b.z;
  if (Math.abs(dx) > Math.abs(dz)) return dx > 0 ? "e" : "w";
  return dz > 0 ? "n" : "s";
}

function wallBands(
  along: (y: number, h: number, gaps: { c: number; w: number }[]) => void,
  y0: number,
  h: number,
  doors: { c: number; w: number }[],
  windows: { c: number; w: number }[],
) {
  if (!windows.length) {
    along(y0, h, doors);
    return;
  }
  const sill = Math.min(WIN_SILL, h * 0.45);
  const head = Math.min(WIN_HEAD, Math.max(sill + 0.4, h * 0.82));
  if (sill > 0.2) along(y0, sill, doors);
  const midH = head - sill;
  if (midH > 0.2) along(y0 + sill, midH, [...doors, ...windows]);
  const topH = h - head;
  if (topH > 0.2) along(y0 + head, topH, doors);
}

function buildStorey(kit: Kit, b: BuildingSpec, h: number, mat: THREE.Material, y0: number, floor: number, stairWall?: DoorWall) {
  const x0 = b.x - b.w / 2;
  const x1 = b.x + b.w / 2;
  const z0 = b.z - b.d / 2;
  const z1 = b.z + b.d / 2;
  const walls: DoorWall[] = ["n", "s", "e", "w"];
  for (const wall of walls) {
    const doors = doorGaps(b, wall, floor);
    if (floor > 0 && wall === stairWall) {
      const mid = midOf(b, wall);
      if (!doors.some((g) => Math.abs(g.c - mid) < 1.2)) doors.push({ c: mid, w: 2.4 });
    }
    const windows = windowGaps(b, wall, floor);
    const along =
      wall === "n" || wall === "s"
        ? (y: number, hh: number, gaps: { c: number; w: number }[]) =>
            wallAlongX(kit, wall === "n" ? z1 : z0, x0, x1, y, hh, mat, gaps)
        : (y: number, hh: number, gaps: { c: number; w: number }[]) =>
            wallAlongZ(kit, wall === "e" ? x1 : x0, z0, z1, y, hh, mat, gaps);
    wallBands(along, y0, h, doors, windows);
  }
}

function coverMat(kit: Kit, kind: CoverKind, h: number) {
  if (kind === "low") return kit.mat("brick", 2, 0.6);
  if (kind === "high") return kit.mat("brick", 0.6, 2);
  if (kind === "truck") return kit.mat("metal", 4, 1.4);
  return kit.mat("wood", 1, h > 1.6 ? 2 : 1);
}

function coverAt(kit: Kit, c: CoverSpec) {
  if (c.kind === "truck") {
    kit.box(c.x, 0.7, c.z, 5.2, 1.4, 2.1, kit.mat("metal", 4, 1.4));
    kit.box(c.x - 1.6, 0.42, c.z, 0.7, 0.84, 0.7, kit.mat("metal", 0.6, 0.6));
    kit.box(c.x + 1.6, 0.42, c.z, 0.7, 0.84, 0.7, kit.mat("metal", 0.6, 0.6));
    return;
  }
  const [sx, sy, sz] = COVER_SIZE[c.kind];
  kit.box(c.x, sy / 2, c.z, sx, sy, sz, coverMat(kit, c.kind, sy), true, COVER_WALK[c.kind]);
}

export function compileLayout(scene: THREE.Scene, spec: LayoutSpec, opts?: { clay?: boolean }): World {
  const kit = makeKit(scene);
  const clay = !!opts?.clay;
  const theme = THEMES[spec.theme];
  const H = spec.wallH ?? 6.2;
  const { minX, maxX, minZ, maxZ } = spec.bounds;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const gw = maxX - minX;
  const gd = maxZ - minZ;

  if (clay) {
    const clayOf: Record<string, THREE.Material> = {
      plaster: new THREE.MeshLambertMaterial({ color: 0xc0bbb2 }),
      brick: new THREE.MeshLambertMaterial({ color: 0xa8a298 }),
      asphalt: new THREE.MeshLambertMaterial({ color: 0x8a8680 }),
      dirt: new THREE.MeshLambertMaterial({ color: 0x8e8a82 }),
      wood: new THREE.MeshLambertMaterial({ color: 0x9c968c }),
      metal: new THREE.MeshLambertMaterial({ color: 0x7a7874 }),
      sand: new THREE.MeshLambertMaterial({ color: 0xb0aaa0 }),
      snow: new THREE.MeshLambertMaterial({ color: 0xc8c4bc }),
      grass: new THREE.MeshLambertMaterial({ color: 0x8a867c }),
      leaf: new THREE.MeshLambertMaterial({ color: 0x8a867c }),
      cobble: new THREE.MeshLambertMaterial({ color: 0x929088 }),
      lime: new THREE.MeshLambertMaterial({ color: 0xb8b2a8 }),
    };
    kit.mat = (kind) => clayOf[kind] ?? clayOf.brick!;
    kit.gold.color.setHex(0xc8c0b0);
    kit.gold.emissive.setHex(0x222018);
    scene.background = new THREE.Color(0x5c5a56);
    scene.fog = new THREE.Fog(0x5c5a56, 70, 220);
  } else {
    scene.background = new THREE.Color(theme.bg);
    scene.fog = new THREE.Fog(theme.fog, 16, Math.max(42, Math.hypot(gw, gd) * 0.85));
    sky(scene, theme.horizon, theme.zenith, Math.max(110, Math.hypot(gw, gd) * 0.9 + 40));
  }
  scene.add(new THREE.HemisphereLight(clay ? 0xc4c0b8 : 0xc8c0b4, 0x3a3834, clay ? 0.95 : 0.9));
  const sun = new THREE.DirectionalLight(clay ? 0xddd8d0 : 0xe8e0d4, clay ? 0.85 : 0.7);
  sun.position.set(8, 48, -12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 2;
  const span = Math.max(52, Math.max(gw, gd) * 0.55 + 8);
  sun.shadow.camera.far = Math.max(120, Math.hypot(gw, gd) + 80);
  sun.shadow.camera.left = -span;
  sun.shadow.camera.right = span;
  sun.shadow.camera.top = span * 0.8;
  sun.shadow.camera.bottom = -span * 0.8;
  sun.shadow.bias = -0.0006;
  scene.add(sun);

  kit.box(cx, -0.06, cz, gw + 6, 0.12, gd + 6, kit.mat(theme.ground, gw / 2, gd / 2), true, true);
  const rim = kit.mat(theme.wall, 20, 6);
  wallAlongX(kit, maxZ, minX, maxX, 0, H, rim, []);
  wallAlongX(kit, minZ, minX, maxX, 0, H, rim, []);
  wallAlongZ(kit, maxX, minZ, maxZ, 0, H, rim, []);
  wallAlongZ(kit, minX, minZ, maxZ, 0, H, rim, []);

  const walkDecks: SlabSpec[] = [];
  for (const b of spec.buildings ?? []) {
    const mat = kit.mat(b.mat ?? theme.wall, b.w / 2, H / 2);
    const floors = buildingFloors(b);
    const y0 = buildingBase(b);
    const stairWall = floors > 1 ? b.stairs : undefined;
    if (floors === 1) {
      buildStorey(kit, b, b.h ?? H - 0.4, mat, y0, 0);
    } else {
      for (let f = 0; f < floors; f++) {
        const fy = y0 + f * STOREY;
        buildStorey(kit, b, STOREY - (f < floors - 1 ? 0.08 : 0), mat, fy, f, stairWall);
        if (f < floors - 1 && buildingHasDecks(b)) {
          walkDecks.push({
            x: b.x,
            z: b.z,
            w: Math.max(HOLE_MIN, b.w - T),
            d: Math.max(HOLE_MIN, b.d - T),
            y: fy + STOREY,
          });
        }
      }
      if (stairWall) {
        const side = stairWall;
        const out = 1.1 + (side === "n" || side === "s" ? b.d / 2 : b.w / 2);
        const dir = side === "n" ? "-z" : side === "s" ? "+z" : side === "e" ? "-x" : "+x";
        const along = side === "n" || side === "s" ? "x" : "z";
        for (let flight = 0; flight < floors - 1; flight++) {
          const shift = (flight - (floors - 2) / 2) * 2.6;
          const sx = along === "x" ? b.x + shift : b.x + (side === "e" ? out : -out);
          const sz = along === "z" ? b.z + shift : b.z + (side === "n" ? out : -out);
          kit.climb(sx, sz, dir, 2.8, 2.2, y0 + flight * 2.8);
        }
      }
    }
  }

  for (const s of spec.slabs ?? []) walkDecks.push(s);
  for (const p of resolveWalkDecks(walkDecks)) {
    kit.box(p.x, p.y - 0.08, p.z, p.w, 0.16, p.d, kit.mat("wood", p.w / 2, p.d / 2), true, true);
  }

  for (const p of spec.partitions ?? []) {
    const h = p.h ?? STOREY;
    const y0 = p.y ?? 0;
    kit.box(p.x, y0 + h / 2, p.z, p.w, h, p.d, kit.mat(theme.wall, Math.max(p.w, p.d) / 2, h / 2));
  }

  for (const c of spec.cover ?? []) coverAt(kit, c);
  for (const c of spec.climbs ?? []) {
    if (c.kind === "ladder") {
      kit.ladder(c.x, c.z, c.dir, c.height ?? STOREY, c.width ?? 1.1, c.startY ?? 0);
    } else {
      kit.climb(c.x, c.z, c.dir, c.height ?? 2.8, c.width ?? 2.2, c.startY ?? 0);
    }
  }

  for (const s of spec.sites) {
    kit.pad(s.x, s.y ?? 0, s.z);
    kit.siteMarker(kit.v(s.x, s.z, 1.4), s.call);
  }
  if (clay) {
    const plantMat = new THREE.MeshLambertMaterial({ color: 0xb88a78 });
    const watchMat = new THREE.MeshLambertMaterial({ color: 0x8a9098 });
    const lampMat = new THREE.MeshLambertMaterial({ color: 0x7a7874 });
    const treeMat = new THREE.MeshLambertMaterial({ color: 0x8a867c });
    for (const [x, z] of spec.plantSpawns) kit.box(x, 0.12, z, 1.2, 0.24, 1.2, plantMat, false, true, false);
    for (const [x, z] of spec.watchSpawns) kit.box(x, 0.12, z, 1.2, 0.24, 1.2, watchMat, false, true, false);
    for (const [x, z] of spec.lamps ?? []) kit.box(x, 1.6, z, 0.2, 3.2, 0.2, lampMat, false);
    for (const [x, z] of spec.trees ?? []) kit.box(x, 2, z, 1.8, 4, 1.8, treeMat, false);
  } else {
    for (const [x, z] of spec.lamps ?? spec.sites.map((s) => [s.x, s.z] as [number, number])) kit.lamp(x, z);
    for (const [x, z] of spec.trees ?? []) kit.tree(x, z);
  }

  const plantSpawns = spec.plantSpawns.map(([x, z]) => kit.v(x, z));
  const watchSpawns = spec.watchSpawns.map(([x, z]) => kit.v(x, z));
  const waypoints = spec.routes.map((r) => r.map(([x, z, y]) => kit.v(x, z, y)));

  return finish(kit, {
    id: spec.id,
    title: spec.title,
    blurb: spec.blurb,
    plantSpawns,
    watchSpawns,
    waypoints,
    bounds: spec.bounds,
    sites: spec.sites.map((s) => ({
      id: s.id,
      call: s.call,
      name: s.name,
      x: s.x,
      y: s.y ?? 0,
      z: s.z,
      r: s.r ?? 3,
    })),
    placeName: (x, z) => {
      let best = spec.title;
      let d = Infinity;
      for (const s of spec.sites) {
        const n = Math.hypot(x - s.x, z - s.z);
        if (n < d) {
          d = n;
          best = n < 8 ? s.name : spec.title;
        }
      }
      return best;
    },
  });
}

/** Tight yard used to prove the compiler, not a rotation map. */
export const YARD_SPEC: LayoutSpec = {
  id: "yard",
  title: "Yard",
  blurb: "Open lot. Ember plants from the west road.",
  theme: "dust",
  bounds: { minX: -36, maxX: 36, minZ: -22, maxZ: 24 },
  buildings: [
    { x: -14, z: 10, w: 12, d: 10, floors: 2, doors: [{ wall: "s" }, { wall: "e" }], stairs: "s" },
    { x: 14, z: -8, w: 12, d: 10, floors: 1, doors: [{ wall: "n" }, { wall: "w" }] },
  ],
  cover: [
    { x: 0, z: 2, kind: "crate" },
    { x: 2, z: 4, kind: "jumpCrate" },
    { x: -2, z: 4, kind: "fullCrate" },
    { x: -4, z: -2, kind: "low" },
    { x: 5, z: 6, kind: "high" },
    { x: 0, z: -10, kind: "truck" },
  ],
  sites: [
    { id: "loft", call: "A", name: "Shed", x: -14, z: 8 },
    { id: "well", call: "B", name: "Lot", x: 14, z: -6 },
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
  routes: [
    [[-30, 2], [-20, 2], [-14, 8]],
    [[-30, 2], [-8, -8], [14, -6]],
    [[30, 2], [20, 2], [14, -6]],
    [[30, 2], [8, 10], [-14, 8]],
    [[-14, 8], [0, 2], [14, -6]],
  ],
  lamps: [
    [-14, 8],
    [14, -6],
    [0, 2],
  ],
};
