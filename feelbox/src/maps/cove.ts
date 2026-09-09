import * as THREE from "three";
import { makeKit, sky, finish, T } from "./kit";
import type { BoxFn, MatFn, Kit } from "./kit";
import type { World } from "../world";

type Kind = "plaster" | "brick" | "wood" | "metal";

/** Industrial quay: planters west (A Yard), watchers east lot. Police + Garage 2F. */
export function buildCove(scene: THREE.Scene): World {
  const kit = makeKit(scene);
  const { box, mat, v, siteMarker, lamp, pad, climb } = kit;

  scene.background = new THREE.Color(0x6e6a64);
  scene.fog = new THREE.Fog(0x6a6560, 16, 52);
  sky(scene, "#7a746c", "#4a4844");
  scene.add(new THREE.HemisphereLight(0xc4b8a4, 0x3a3834, 0.88));
  const sun = new THREE.DirectionalLight(0xc8c0b4, 0.42);
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

  const H = 6.4;
  box(0, -0.06, 4, 89.2, 0.12, 57.2, mat("asphalt", 40, 28), true, true);
  box(-28, 0.02, -8, 24, 0.03, 20, mat("cobble", 14, 10), false);
  box(-8, 0.02, -12, 28, 0.03, 18, mat("cobble", 16, 10), false);
  box(11.6, 0.02, 6, 4.4, 0.03, 24, mat("cobble", 3, 14), false);
  box(28, 0.02, 4, 22, 0.03, 18, mat("asphalt", 14, 10), false);
  box(-20, 0.02, -22, 48, 0.04, 5, mat("dirt", 20, 3), false);

  box(0, H / 2, 32.35, 90, H, 0.5, mat("brick", 28, 6));
  box(0, H / 2, -24.25, 90, H, 0.5, mat("brick", 28, 6));
  box(-44.35, H / 2, 4, 0.5, H, 57.5, mat("brick", 22, 6));
  box(44.35, H / 2, 4, 0.5, H, 57.5, mat("brick", 22, 6));

  addWater(kit.root);
  southFactory(box, mat);
  cannery(box, mat);
  police(box, mat, climb);
  garage(box, mat, climb);
  shed(box, mat);
  alleyWalls(box, mat);
  warehouse(box, mat);
  piers(box, mat);
  truck(box, mat);
  yardA(box, mat, pad, siteMarker, v);
  cratesB(box, mat, pad, siteMarker, v);
  dressHarbor(box, mat, lamp);

  return finish(kit, {
    id: "cove",
    title: "Harbor",
    blurb: "Watchers hold the east lot. Planters walk in from A Yard.",
    plantSpawns: [v(-36, -12), v(-36, -8), v(-34, -10), v(-32, -14), v(-32, -6)],
    watchSpawns: [v(40, 8), v(40, 6), v(38, 6), v(39, 10), v(37, 10)],
    waypoints: [
      [v(-34, -10), v(-28, -2), v(-23, 8)],
      [v(-34, -10), v(-20, -18), v(-8, -18), v(4, -18), v(6, -10)],
      [v(-34, -8), v(-23, 8), v(-23, 20), v(-10, 21), v(4, 22)],
      [v(-34, -8), v(-23, 8), v(-10, 10), v(2, 12), v(4, 22)],
      [v(40, 6), v(28, 4), v(16, 2), v(11.7, 4), v(11.7, 12), v(4, 22)],
      [v(40, 6), v(28, 2), v(20, -8), v(12, -8)],
      [v(40, 8), v(30, 12), v(22, 22), v(12, 24), v(4, 22)],
      [v(-23, 8), v(-8, 2), v(-8, -6), v(-4, -10)],
      [v(-15.6, -9.4, 2.8), v(-10, -10, 2.8), v(-8, -4, 2.8), v(-4, -10, 2.8)],
      [v(6.2, -10.2, 2.8), v(12, -10, 2.8), v(16, -8, 2.8)],
      [v(-8, -18), v(2, -10), v(11.7, -4), v(11.7, 8)],
      [v(-23, 8), v(-16, 4), v(-8, 2)],
      [v(29, 2), v(29.5, 0), v(29.5, -6)],
    ],
    bounds: { minX: -44.5, maxX: 44.5, minZ: -24.5, maxZ: 32.5 },
    sites: [
      { id: "loft", call: "A", name: "Yard", x: -23, y: 0, z: 8, r: 3 },
      { id: "well", call: "B", name: "Crates", x: 4, y: 0, z: 22, r: 3.2 },
    ],
    placeName: (x, z, y = 0) => {
      if (y > 2.2 && x > -17 && x < 1 && z > -17 && z < 1.2) return "Police 2F";
      if (y > 2.2 && x > 4.5 && x < 20.5 && z > -18.5 && z < -2) return "Garage 2F";
      if (x < -22 && z < 0 && z > -19) return "West Alley";
      if (x > -32 && x < -14 && z > 1 && z < 15.5) return "Yard";
      if (x > -40.5 && x < -6 && z > 16 && z < 26.2) return "Cannery";
      if (x > -15 && x < -1 && z > -17 && z < 1.2) return "Police";
      if (z < -16 && x > -16 && x < 14) return "L Turn";
      if (x > -1.6 && x < 8 && z > -16 && z < -6) return "L Turn";
      if (x > -7 && x < 15 && z > 15.5 && z < 28.5) return "Crates";
      if (x > -3 && x < 10 && z > 6 && z < 16) return "Shed";
      if (x > 9.4 && x < 13.8 && z > -4 && z < 16.5) return "Alley";
      if (x > 7 && x < 20 && z > -18.5 && z < -2.4) return "Garage";
      if (x > 16 && x < 36 && z > 17.5) return "Piers";
      if (x > 22 && x < 34 && z > -2 && z < 12) return "Truck";
      if (x > 25 && x < 40 && z < 5) return "Warehouse";
      return "Harbor";
    },
  });
}

function addWater(root: THREE.Group) {
  const water = new THREE.MeshStandardMaterial({
    color: 0x3a4548,
    roughness: 0.28,
    metalness: 0.32,
    transparent: true,
    opacity: 0.68,
  });
  const north = new THREE.Mesh(new THREE.BoxGeometry(90, 0.18, 8.4), water);
  north.position.set(0, -0.12, 29.4);
  north.receiveShadow = true;
  root.add(north);
  const south = new THREE.Mesh(new THREE.BoxGeometry(52, 0.16, 3.2), water);
  south.position.set(-16, -0.14, -23.4);
  south.receiveShadow = true;
  root.add(south);
}

function southFactory(box: BoxFn, mat: MatFn) {
  const h = 4.0;
  box(-30, h / 2, -21.4, 24, h, 4.4, mat("brick", 16, 5));
  box(-30, 4.12, -21.4, 24.4, 0.18, 4.8, mat("wood", 16, 4, 0.78, 0.04), false);
}

function cannery(box: BoxFn, mat: MatFn) {
  const h = 4.2;
  wallX(box, mat, 16.85, -39.8, -6.5, h, [
    { x0: -29.2, x1: -26.4, y0: 0, y1: 2.25 },
    { x0: -20.8, x1: -18.0, y0: 0, y1: 2.25 },
    { x0: -34.2, x1: -32.8, y0: 1.15, y1: 2.5 },
    { x0: -14.6, x1: -13.2, y0: 1.15, y1: 2.5 },
  ], "brick");
  wallX(box, mat, 25.4, -39.8, -6.5, h, [
    { x0: -28.0, x1: -26.4, y0: 1.15, y1: 2.5 },
    { x0: -16.2, x1: -14.6, y0: 1.15, y1: 2.5 },
  ], "brick");
  wallZ(box, mat, -39.8, 16.85, 25.4, h, [
    { z0: 20.0, z1: 21.6, y0: 1.15, y1: 2.5 },
  ], "brick");
  wallZ(box, mat, -6.5, 16.85, 25.4, h, [
    { z0: 19.6, z1: 22.4, y0: 0, y1: 2.25 },
  ], "brick");

  box(-32.6, 0.7, 21.1, 0.55, 1.4, 0.55, mat("wood", 0.5, 1.2));
  box(-14.2, 0.7, 21.1, 0.55, 1.4, 0.55, mat("wood", 0.5, 1.2));

  box(-34, 4.32, 21.1, 12.2, 0.16, 9.0, mat("wood", 10, 8, 0.78, 0.03), false);
  box(-23, 4.48, 21.1, 10.4, 0.16, 9.0, mat("metal", 8, 8, 0.55, 0.28), false);
  box(-12, 4.32, 21.1, 11.6, 0.16, 9.0, mat("wood", 10, 8, 0.78, 0.03), false);
}

function police(box: BoxFn, mat: MatFn, climb: Kit["climb"]) {
  const h = 5.4;
  const xW = -14.2;
  const xE = -1.8;
  const zS = -16.2;
  const zN = 0.2;

  wallZ(box, mat, xW, zS, zN, h, [
    { z0: -5.2, z1: -2.6, y0: 0, y1: 2.25 },
    { z0: -11.0, z1: -8.2, y0: 2.8, y1: 5.35 },
    { z0: -14.6, z1: -13.2, y0: 1.15, y1: 2.5 },
  ], "plaster");
  wallZ(box, mat, xE, zS, zN, h, [
    { z0: -5.2, z1: -2.6, y0: 0, y1: 2.25 },
    { z0: -11.0, z1: -8.2, y0: 2.8, y1: 5.35 },
    { z0: -14.6, z1: -13.2, y0: 1.15, y1: 2.5 },
    { z0:  -7.4, z1:  -6.0, y0: 3.15, y1: 4.45 },
  ], "plaster");
  wallX(box, mat, zN, xW, xE, h, [
    { x0: -9.6, x1: -6.8, y0: 0, y1: 2.25 },
    { x0: -13.2, x1: -11.8, y0: 3.15, y1: 4.45 },
    { x0: -5.0, x1: -3.6, y0: 3.15, y1: 4.45 },
  ], "plaster");
  wallX(box, mat, zS, xW, xE, h, [
    { x0: -11.4, x1: -10.0, y0: 1.15, y1: 2.5 },
    { x0: -6.0, x1: -4.6, y0: 1.15, y1: 2.5 },
    { x0: -9.0, x1: -7.6, y0: 3.15, y1: 4.45 },
  ], "plaster");

  const fl = mat("wood", 8, 6, 0.8, 0.02);
  box(-8.0, 2.72, -11.15, 11.8, 0.16, 9.5, fl, true, true);
  box(-8.0, 2.72, -1.65, 11.8, 0.16, 3.1, fl, true, true);
  box(-11.95, 2.72, -4.8, 3.9, 0.16, 3.2, fl, true, true);
  box(-4.45, 2.72, -4.8, 4.7, 0.16, 3.2, fl, true, true);
  box(-15.2, 2.72, -8.55, 3.6, 0.16, 2.3, fl, true, true);
  box(-0.4, 2.72, -8.55, 4.4, 0.16, 2.3, fl, true, true);

  climb(-15.6, -15.5, "+z", 2.8, 2.4, 0);
  climb(-0.4, -15.5, "+z", 2.8, 2.4, 0);

  box(-8, 5.48, -8, 12.8, 0.16, 16.8, mat("wood", 10, 12, 0.72, 0.04), false);

  box(-11.2, 0.5, -12.4, 1.15, 1.0, 1.05, mat("wood", 1, 0.9), true, true);
  box(-4.6, 3.3, -12.0, 1.1, 1.0, 1.0, mat("wood", 1, 0.8), true, true);
  box(-10.4, 0.42, -7.2, 2.2, 0.84, 0.7, mat("wood", 2, 0.6), true, true);
}

function garage(box: BoxFn, mat: MatFn, climb: Kit["climb"]) {
  const h = 5.4;
  const xW = 7.5;
  const xE = 19.5;
  const zS = -17.8;
  const zN = -3.0;

  wallZ(box, mat, xW, zS, zN, h, [
    { z0: -7.2, z1: -4.6, y0: 0, y1: 2.25 },
    { z0: -12.2, z1: -9.4, y0: 2.8, y1: 5.35 },
    { z0: -16.4, z1: -15.0, y0: 1.15, y1: 2.5 },
  ], "brick");
  wallZ(box, mat, xE, zS, zN, h, [
    { z0: -12.4, z1: -10.8, y0: 1.15, y1: 2.5 },
    { z0: -8.2, z1: -6.6, y0: 3.15, y1: 4.45 },
  ], "brick");
  wallX(box, mat, zN, xW, xE, h, [
    { x0: 10.4, x1: 13.2, y0: 0, y1: 2.25 },
    { x0: 15.6, x1: 17.0, y0: 1.15, y1: 2.5 },
  ], "brick");
  wallX(box, mat, zS, xW, xE, h, [
    { x0: 12.4, x1: 13.8, y0: 1.15, y1: 2.5 },
  ], "brick");

  const fl = mat("wood", 8, 6, 0.8, 0.02);
  box(13.5, 2.72, -14.85, 11.4, 0.16, 5.3, fl, true, true);
  box(13.5, 2.72, -5.9, 11.4, 0.16, 5.8, fl, true, true);
  box(10.1, 2.72, -10.5, 4.6, 0.16, 3.4, fl, true, true);
  box(17.4, 2.72, -10.5, 3.6, 0.16, 3.4, fl, true, true);
  box(6.3, 2.72, -9.8, 3.4, 0.16, 2.4, fl, true, true);

  climb(5.8, -16.6, "+z", 2.8, 2.4, 0);

  box(13.5, 5.48, -10.4, 12.4, 0.16, 15.2, mat("metal", 10, 12, 0.5, 0.3), false);

  box(10.2, 0.5, -14.4, 1.15, 1.0, 1.05, mat("wood", 1, 0.9), true, true);
  box(11.25, 0.46, -14.25, 1.0, 0.92, 0.95, mat("wood", 1, 0.8), true, true);
  box(16.4, 0.5, -6.2, 1.15, 1.0, 1.05, mat("wood", 1, 0.9), true, true);
  box(15.2, 3.3, -14.0, 1.1, 1.0, 1.0, mat("wood", 1, 0.8), true, true);
}

function shed(box: BoxFn, mat: MatFn) {
  const h = 2.8;
  wallZ(box, mat, 0.2, 7.4, 14.6, h, [
    { z0: 10.2, z1: 12.0, y0: 0, y1: 2.2 },
  ], "wood");
  wallZ(box, mat, 7.8, 7.4, 14.6, h, [
    { z0: 10.4, z1: 12.2, y0: 0, y1: 2.2 },
  ], "wood");
  wallX(box, mat, 7.4, 0.2, 7.8, h, [
    { x0: 3.0, x1: 5.2, y0: 0, y1: 2.2 },
  ], "wood");
  wallX(box, mat, 14.6, 0.2, 7.8, h, [], "wood");
  box(4.0, 2.92, 11.0, 8.0, 0.16, 7.6, mat("wood", 6, 6, 0.78, 0.03), false);

  cover(box, mat, 1.2, 8.8);
  cover(box, mat, 5.4, 13.2);
}

function alleyWalls(box: BoxFn, mat: MatFn) {
  const h = 4.4;
  wallZ(box, mat, 9.84, -3.0, 8.2, h, [
    { z0: 1.2, z1: 3.8, y0: 0, y1: 2.25 },
  ], "brick");
  wallZ(box, mat, 13.36, -3.0, 16.4, h, [
    { z0: 0.0, z1: 2.8, y0: 0, y1: 2.25 },
    { z0: 8.4, z1: 9.8, y0: 1.15, y1: 2.5 },
  ], "brick");
  box(16.4, 2.2, 10.2, 5.8, 4.4, 12.4, mat("brick", 5, 5));
}

function warehouse(box: BoxFn, mat: MatFn) {
  const brick = mat("brick", 12, 6);
  box(32.5, 2.6, -12.0, 13.0, 5.2, 16.0, brick);
  box(36.0, 2.6, 0.0, 6.0, 5.2, 8.0, brick);
  box(32.5, 5.32, -8.0, 13.4, 0.2, 24.4, mat("metal", 10, 16, 0.5, 0.28), false);

  const h = 3.6;
  wallZ(box, mat, 26.0, -3.8, 3.6, h, [
    { z0: -1.2, z1: 1.4, y0: 0, y1: 2.25 },
  ], "brick");
  wallX(box, mat, 3.6, 26.0, 33.0, h, [
    { x0: 28.6, x1: 31.2, y0: 0, y1: 2.25 },
  ], "brick");
  wallX(box, mat, -3.8, 26.0, 33.0, h, [], "brick");
}

function piers(box: BoxFn, mat: MatFn) {
  const plank = mat("wood", 8, 4, 0.82, 0.04);
  box(22.0, 0.06, 24.2, 4.2, 0.12, 12.4, plank, true, true);
  box(30.0, 0.06, 24.2, 4.2, 0.12, 12.4, plank, true, true);
  box(22.0, 0.55, 29.4, 0.22, 1.0, 0.22, mat("wood", 0.2, 0.8));
  box(30.0, 0.55, 29.4, 0.22, 1.0, 0.22, mat("wood", 0.2, 0.8));
  cover(box, mat, 19.6, 19.4);
}

function truck(box: BoxFn, mat: MatFn) {
  const steel = mat("metal", 4, 1.6, 0.48, 0.42);
  box(27.0, 0.85, 4.2, 4.8, 1.7, 2.0, steel);
  box(25.2, 1.55, 4.2, 1.6, 0.9, 1.9, steel);
  box(27.4, 1.85, 4.2, 3.6, 0.28, 1.7, mat("metal", 3, 1.4, 0.5, 0.35));
}

function yardA(
  box: BoxFn,
  mat: MatFn,
  pad: Kit["pad"],
  siteMarker: Kit["siteMarker"],
  v: Kit["v"],
) {
  cover(box, mat, -28.2, 4.6);
  cover(box, mat, -18.2, 11.4);
  pad(-23, 0.04, 8);
  siteMarker(v(-23, 8, 2.8), "A");
  siteMarker(v(-23, 0.6, 2.4), "A");
}

function cratesB(
  box: BoxFn,
  mat: MatFn,
  pad: Kit["pad"],
  siteMarker: Kit["siteMarker"],
  v: Kit["v"],
) {
  stack(box, mat, -2.2, 18.0, 1.05);
  stack(box, mat, 8.2, 18.2, 1.12);
  stack(box, mat, -2.4, 25.6, 1.0);
  stack(box, mat, 8.0, 25.8, 1.08);
  stack(box, mat, -2.0, 21.8, 1.15);
  stack(box, mat, 8.4, 21.6, 1.1);
  peek(box, mat, 2.0, 18.2);
  peek(box, mat, 2.2, 25.6);
  cover(box, mat, 11.2, 20.4);

  pad(4, 0.04, 22);
  siteMarker(v(4, 22, 2.8), "B");
  siteMarker(v(4, 14.2, 2.4), "B");
}

function dressHarbor(box: BoxFn, mat: MatFn, lamp: Kit["lamp"]) {
  cover(box, mat, -34.2, -4.2);
  cover(box, mat, -28.4, -14.2);
  cover(box, mat, -8.4, -18.6);
  cover(box, mat, 2.2, -10.4);
  cover(box, mat, 20.4, -2.2);
  cover(box, mat, 36.4, 8.2);
  box(-37.2, 0.4, -16.2, 1.6, 0.8, 0.7, mat("wood", 1.4, 0.6), true, true);

  lamp(-32, -10, 0xe8d4b0);
  lamp(-23, 8, 0xe8d4b0);
  lamp(-8, -8, 0xe8d4b0);
  lamp(4, 22, 0xe8d4b0);
  lamp(11.6, 6, 0xe8d4b0);
  lamp(12, -10, 0xe8d4b0);
  lamp(27, 6, 0xe8d4b0);
  lamp(22, 22, 0xc8d4d8);
}

function cover(box: BoxFn, mat: MatFn, x: number, z: number) {
  box(x, 0.5, z, 1.15, 1.0, 1.05, mat("wood", 1.1, 0.9), true, true);
  box(x + 1.05, 0.46, z + 0.15, 1.0, 0.92, 0.95, mat("wood", 1, 0.8), true, true);
}

function stack(box: BoxFn, mat: MatFn, x: number, z: number, h: number) {
  box(x, h / 2, z, 1.2, h, 1.15, mat("wood", 1.1, 1), true, true);
  box(x + 1.15, (h * 0.88) / 2, z + 0.12, 1.05, h * 0.88, 1.0, mat("wood", 1, 0.9), true, true);
}

function peek(box: BoxFn, mat: MatFn, x: number, z: number) {
  box(x, 0.55, z, 1.25, 1.1, 1.15, mat("wood", 1.1, 1), true, true);
}

type HoleZ = { z0: number; z1: number; y0: number; y1: number };
type HoleX = { x0: number; x1: number; y0: number; y1: number };

function wallZ(box: BoxFn, mat: MatFn, x: number, z0: number, z1: number, h: number, holes: HoleZ[], kind: Kind) {
  const solids = subtract1d(z0, z1, holes.map((hole) => [hole.z0, hole.z1] as [number, number]));
  for (const [a, b] of solids) {
    const z = (a + b) / 2;
    const sz = b - a;
    if (sz < 0.05) continue;
    box(x, h / 2, z, T, h, sz, mat(kind, sz, h));
  }
  for (const hole of holes) {
    if (hole.y0 > 0.05) {
      const sy = hole.y0;
      box(x, sy / 2, (hole.z0 + hole.z1) / 2, T, sy, hole.z1 - hole.z0, mat(kind, hole.z1 - hole.z0, sy));
    }
    if (hole.y1 < h - 0.05) {
      const sy = h - hole.y1;
      box(x, hole.y1 + sy / 2, (hole.z0 + hole.z1) / 2, T, sy, hole.z1 - hole.z0, mat(kind, hole.z1 - hole.z0, sy));
    }
  }
}

function wallX(box: BoxFn, mat: MatFn, z: number, x0: number, x1: number, h: number, holes: HoleX[], kind: Kind) {
  const solids = subtract1d(x0, x1, holes.map((hole) => [hole.x0, hole.x1] as [number, number]));
  for (const [a, b] of solids) {
    const x = (a + b) / 2;
    const sx = b - a;
    if (sx < 0.05) continue;
    box(x, h / 2, z, sx, h, T, mat(kind, sx, h));
  }
  for (const hole of holes) {
    if (hole.y0 > 0.05) {
      const sy = hole.y0;
      box((hole.x0 + hole.x1) / 2, sy / 2, z, hole.x1 - hole.x0, sy, T, mat(kind, hole.x1 - hole.x0, sy));
    }
    if (hole.y1 < h - 0.05) {
      const sy = h - hole.y1;
      box((hole.x0 + hole.x1) / 2, hole.y1 + sy / 2, z, hole.x1 - hole.x0, sy, T, mat(kind, hole.x1 - hole.x0, sy));
    }
  }
}

function subtract1d(a: number, b: number, holes: [number, number][]) {
  let spans: [number, number][] = [[Math.min(a, b), Math.max(a, b)]];
  const hs = holes
    .map(([s, e]) => [Math.min(s, e), Math.max(s, e)] as [number, number])
    .sort((p, q) => p[0] - q[0]);
  for (const [hs0, hs1] of hs) {
    const next: [number, number][] = [];
    for (const [s, e] of spans) {
      if (hs1 <= s || hs0 >= e) {
        next.push([s, e]);
        continue;
      }
      if (hs0 > s) next.push([s, hs0]);
      if (hs1 < e) next.push([hs1, e]);
    }
    spans = next;
  }
  return spans;
}
