/**
 * Home-page map sketch. The human paints a LayoutSpec from orbit; the agent
 * finalizes (routes, names, map-check, register). See .cursor/skills/design-map/SKILL.md.
 */
import * as THREE from "three";
import {
  YARD_SPEC,
  type ClimbDir,
  type CoverSpec,
  type LayoutSpec,
  type ThemeId,
} from "./layout";

export const STUDIO_STORE = "rifles-studio-spec";
export const GRID = 2;

export type ToolId =
  | "building"
  | "loft"
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
  | "tree"
  | "erase";

export const TOOLS: { id: ToolId; key: string; label: string }[] = [
  { id: "building", key: "1", label: "Build" },
  { id: "loft", key: "2", label: "Loft" },
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
  { id: "erase", key: "X", label: "Erase" },
];

export const THEMES: ThemeId[] = ["dust", "winter", "harbor", "stone"];

export function blankSpec(): LayoutSpec {
  return {
    id: "draft",
    title: "Draft",
    blurb: "Studio sketch. Finalize before rotation.",
    theme: "dust",
    bounds: { ...YARD_SPEC.bounds },
    buildings: [],
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

function near(ax: number, az: number, bx: number, bz: number, r: number) {
  return Math.hypot(ax - bx, az - bz) <= r;
}

const COVER: CoverSpec["kind"][] = ["crate", "low", "high", "truck"];

export function place(
  spec: LayoutSpec,
  tool: ToolId,
  x: number,
  z: number,
  opts: { yaw?: number; bw?: number; bd?: number } = {},
): LayoutSpec {
  const next = cloneSpec(spec);
  const gx = snap(x);
  const gz = snap(z);
  const bw = opts.bw ?? 12;
  const bd = opts.bd ?? 10;
  const dir = dirFromYaw(opts.yaw ?? 0);

  if (tool === "erase") return eraseNear(next, gx, gz);

  if (tool === "building" || tool === "loft") {
    next.buildings = next.buildings ?? [];
    next.buildings.push({
      x: gx,
      z: gz,
      w: bw,
      d: bd,
      floors: tool === "loft" ? 2 : 1,
      doors: [{ wall: dir === "+x" ? "e" : dir === "-x" ? "w" : dir === "+z" ? "n" : "s" }],
      stairs: tool === "loft" ? (dir === "+x" ? "e" : dir === "-x" ? "w" : dir === "+z" ? "n" : "s") : undefined,
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
  const next = cloneSpec(spec);
  const hit = (ax: number, az: number) => near(x, z, ax, az, r);
  const bi = (next.buildings ?? []).findIndex((b) => hit(b.x, b.z));
  if (bi >= 0) {
    next.buildings!.splice(bi, 1);
    return next;
  }
  const ci = (next.cover ?? []).findIndex((c) => hit(c.x, c.z));
  if (ci >= 0) {
    next.cover!.splice(ci, 1);
    return next;
  }
  const li = (next.climbs ?? []).findIndex((c) => hit(c.x, c.z));
  if (li >= 0) {
    next.climbs!.splice(li, 1);
    return next;
  }
  const si = next.sites.findIndex((s) => hit(s.x, s.z));
  if (si >= 0 && next.sites.length > 0) {
    next.sites.splice(si, 1);
    return next;
  }
  const pi = next.plantSpawns.findIndex(([sx, sz]) => hit(sx, sz));
  if (pi >= 0 && next.plantSpawns.length > 1) {
    next.plantSpawns.splice(pi, 1);
    return next;
  }
  const wi = next.watchSpawns.findIndex(([sx, sz]) => hit(sx, sz));
  if (wi >= 0 && next.watchSpawns.length > 1) {
    next.watchSpawns.splice(wi, 1);
    return next;
  }
  const lampi = (next.lamps ?? []).findIndex(([sx, sz]) => hit(sx, sz));
  if (lampi >= 0) {
    next.lamps!.splice(lampi, 1);
    return next;
  }
  const ti = (next.trees ?? []).findIndex(([sx, sz]) => hit(sx, sz));
  if (ti >= 0) {
    next.trees!.splice(ti, 1);
    return next;
  }
  return next;
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
  if (tool === "building" || tool === "loft") return [bw, tool === "loft" ? 5.6 : 3.2, bd];
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
  return {
    tx: (bounds.minX + bounds.maxX) / 2,
    ty: 0,
    tz: (bounds.minZ + bounds.maxZ) / 2,
    dist: 58,
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

export function zoomOrbit(cam: OrbitCam, deltaY: number) {
  const k = deltaY > 0 ? 1.12 : 1 / 1.12;
  cam.dist = Math.max(14, Math.min(140, cam.dist * k));
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

export function toolFromCode(code: string): ToolId | null {
  if (code === "Digit1" || code === "Numpad1") return "building";
  if (code === "Digit2" || code === "Numpad2") return "loft";
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
  if (code === "KeyX" || code === "Backspace") return "erase";
  return null;
}
