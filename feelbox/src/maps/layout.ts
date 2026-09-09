/**
 * Compact layout → kit. Write a LayoutSpec, never a pile of box() calls.
 */
import * as THREE from "three";
import { finish, makeKit, sky, T, type Kit } from "./kit";
import type { Site, World } from "../world";

export type ThemeId = "winter" | "harbor" | "stone" | "dust";
export type DoorWall = "n" | "s" | "e" | "w";

export type BuildingSpec = {
  x: number;
  z: number;
  w: number;
  d: number;
  h?: number;
  floors?: 1 | 2;
  doors?: { wall: DoorWall; at?: number; width?: number }[];
  stairs?: DoorWall;
  mat?: "brick" | "plaster" | "wood" | "metal";
};

export type CoverSpec = {
  x: number;
  z: number;
  kind: "crate" | "low" | "high" | "truck";
};

export type ClimbDir = "+x" | "-x" | "+z" | "-z";

export type ClimbSpec = {
  x: number;
  z: number;
  dir: ClimbDir;
  height?: number;
  width?: number;
  startY?: number;
};

export type LayoutSpec = {
  id: string;
  title: string;
  blurb: string;
  theme: ThemeId;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  wallH?: number;
  buildings?: BuildingSpec[];
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

function doorGaps(b: BuildingSpec, wall: DoorWall) {
  const along = wall === "n" || wall === "s" ? b.w : b.d;
  const listed = (b.doors ?? []).filter((d) => d.wall === wall);
  if (!listed.length) return [] as { c: number; w: number }[];
  const mid = wall === "n" || wall === "s" ? b.x : b.z;
  return listed.map((d) => ({
    c: mid + (d.at ?? 0),
    w: Math.min(along - 0.8, d.width ?? 2.4),
  }));
}

function facingCenter(b: BuildingSpec, cx: number, cz: number): DoorWall {
  const dx = cx - b.x;
  const dz = cz - b.z;
  if (Math.abs(dx) > Math.abs(dz)) return dx > 0 ? "e" : "w";
  return dz > 0 ? "n" : "s";
}

function buildShell(kit: Kit, b: BuildingSpec, h: number, mat: THREE.Material, y0: number) {
  const x0 = b.x - b.w / 2;
  const x1 = b.x + b.w / 2;
  const z0 = b.z - b.d / 2;
  const z1 = b.z + b.d / 2;
  wallAlongX(kit, z1, x0, x1, y0, h, mat, doorGaps(b, "n"));
  wallAlongX(kit, z0, x0, x1, y0, h, mat, doorGaps(b, "s"));
  wallAlongZ(kit, x1, z0, z1, y0, h, mat, doorGaps(b, "e"));
  wallAlongZ(kit, x0, z0, z1, y0, h, mat, doorGaps(b, "w"));
}

function coverAt(kit: Kit, c: CoverSpec) {
  if (c.kind === "crate") kit.box(c.x, 0.55, c.z, 1.4, 1.1, 1.4, kit.mat("wood", 1, 1));
  else if (c.kind === "low") kit.box(c.x, 0.45, c.z, 2.4, 0.9, 0.7, kit.mat("brick", 2, 0.6));
  else if (c.kind === "high") kit.box(c.x, 1.05, c.z, 0.7, 2.1, 2.6, kit.mat("brick", 0.6, 2));
  else {
    kit.box(c.x, 0.7, c.z, 5.2, 1.4, 2.1, kit.mat("metal", 4, 1.4));
    kit.box(c.x - 1.6, 0.42, c.z, 0.7, 0.84, 0.7, kit.mat("metal", 0.6, 0.6));
    kit.box(c.x + 1.6, 0.42, c.z, 0.7, 0.84, 0.7, kit.mat("metal", 0.6, 0.6));
  }
}

export function compileLayout(scene: THREE.Scene, spec: LayoutSpec): World {
  const kit = makeKit(scene);
  const theme = THEMES[spec.theme];
  const H = spec.wallH ?? 6.2;
  const { minX, maxX, minZ, maxZ } = spec.bounds;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const gw = maxX - minX;
  const gd = maxZ - minZ;

  scene.background = new THREE.Color(theme.bg);
  scene.fog = new THREE.Fog(theme.fog, 16, Math.max(42, Math.hypot(gw, gd) * 0.85));
  sky(scene, theme.horizon, theme.zenith);
  scene.add(new THREE.HemisphereLight(0xc8c0b4, 0x3a3834, 0.9));
  const sun = new THREE.DirectionalLight(0xe8e0d4, 0.7);
  sun.position.set(8, 48, -12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 120;
  sun.shadow.camera.left = -52;
  sun.shadow.camera.right = 52;
  sun.shadow.camera.top = 42;
  sun.shadow.camera.bottom = -42;
  sun.shadow.bias = -0.0006;
  scene.add(sun);

  kit.box(cx, -0.06, cz, gw + 6, 0.12, gd + 6, kit.mat(theme.ground, gw / 2, gd / 2), true, true);
  const rim = kit.mat(theme.wall, 20, 6);
  wallAlongX(kit, maxZ, minX, maxX, 0, H, rim, []);
  wallAlongX(kit, minZ, minX, maxX, 0, H, rim, []);
  wallAlongZ(kit, maxX, minZ, maxZ, 0, H, rim, []);
  wallAlongZ(kit, minX, minZ, maxZ, 0, H, rim, []);

  for (const raw of spec.buildings ?? []) {
    const b: BuildingSpec = {
      ...raw,
      doors: raw.doors?.length ? raw.doors : [{ wall: facingCenter(raw, cx, cz) }],
    };
    const mat = kit.mat(b.mat ?? theme.wall, b.w / 2, H / 2);
    const floors = b.floors ?? 1;
    const story = b.h ?? (floors === 2 ? 2.9 : H - 0.4);
    buildShell(kit, b, story, mat, 0);
    if (floors === 2) {
      kit.box(b.x, 2.8, b.z, b.w - T, 0.16, b.d - T, kit.mat("wood", b.w / 2, b.d / 2), true, true);
      buildShell(kit, b, Math.max(2.4, story - 1.2), mat, 2.88);
      const side = b.stairs ?? b.doors![0]!.wall;
      const out = 1.1 + (side === "n" || side === "s" ? b.d / 2 : b.w / 2);
      const dir = side === "n" ? "-z" : side === "s" ? "+z" : side === "e" ? "-x" : "+x";
      const sx = side === "e" || side === "w" ? b.x + (side === "e" ? out : -out) : b.x;
      const sz = side === "n" || side === "s" ? b.z + (side === "n" ? out : -out) : b.z;
      kit.climb(sx, sz, dir, 2.8, 2.2, 0);
    }
  }

  for (const c of spec.cover ?? []) coverAt(kit, c);
  for (const c of spec.climbs ?? []) {
    kit.climb(c.x, c.z, c.dir, c.height ?? 2.8, c.width ?? 2.2, c.startY ?? 0);
  }

  for (const s of spec.sites) {
    kit.pad(s.x, s.y ?? 0, s.z);
    kit.siteMarker(kit.v(s.x, s.z, 1.4), s.call);
  }
  for (const [x, z] of spec.lamps ?? spec.sites.map((s) => [s.x, s.z] as [number, number])) kit.lamp(x, z);
  for (const [x, z] of spec.trees ?? []) kit.tree(x, z);

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
