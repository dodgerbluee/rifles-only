import * as THREE from "three";
import { makeKit, sky, finish, T } from "./kit";
import type { BoxFn, MatFn, Kit } from "./kit";
import type { World } from "../world";

type Kind = "plaster" | "brick" | "wood" | "cobble";

/** Carentan-like suburb: open yards, three streets, chapel A, gardens B. */
export function buildParish(scene: THREE.Scene): World {
  const kit = makeKit(scene);
  const { box, mat, v, siteMarker, lamp, pad, climb } = kit;

  scene.background = new THREE.Color(0x9aa094);
  scene.fog = new THREE.Fog(0x8a8478, 14, 44);
  sky(scene, "#9aa094", "#6a6860");
  scene.add(new THREE.HemisphereLight(0xc8c2b0, 0x4a463c, 0.9));
  const sun = new THREE.DirectionalLight(0xd8d0c0, 0.52);
  sun.position.set(10, 46, -8);
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
  box(0, -0.06, 4, 89.2, 0.12, 57.2, mat("dirt", 40, 28), true, true);
  box(2, 0.02, 2, 4.6, 0.04, 40, mat("cobble", 3, 18), false);
  box(-12, 0.02, 2, 3.6, 0.04, 32, mat("cobble", 2, 14), false);
  box(18, 0.02, 2, 3.6, 0.04, 28, mat("cobble", 2, 12), false);
  box(2, 0.02, 4, 28, 0.035, 4.0, mat("cobble", 14, 3), false);
  box(2, 0.02, -8, 24, 0.035, 3.4, mat("cobble", 12, 3), false);

  box(0, H / 2, 32.35, 90, H, 0.5, mat("brick", 28, 6));
  box(0, H / 2, -24.25, 90, H, 0.5, mat("brick", 28, 6));
  box(-44.35, H / 2, 4, 0.5, H, 57.5, mat("brick", 22, 6));
  box(44.35, H / 2, 4, 0.5, H, 57.5, mat("brick", 22, 6));

  chapel(box, mat, pad, siteMarker, v);
  gardens(box, mat, pad, siteMarker, v);
  westHouse(box, mat, climb);
  eastHouse(box, mat);
  square(box, mat, kit.root);
  openYards(box, mat);
  dressParish(box, mat, lamp);

  return finish(kit, {
    id: "parish",
    title: "Parish",
    blurb: "Norman streets. Plant the Wire at A or B.",
    plantSpawns: [v(8, 28), v(8, 26), v(12, 26), v(10, 26), v(11, 27)],
    watchSpawns: [v(-6, -20), v(-4, -20), v(-2, -20), v(-6, -18), v(0, -18)],
    waypoints: [
      [v(-4, -14), v(-12, -10), v(-16, -8)],
      [v(-4, -14), v(2, -6), v(2, 4), v(2, 12), v(8, 18), v(8, 22)],
      [v(-4, -14), v(-12, -2), v(-12, 6), v(-12, 14), v(2, 16), v(8, 20)],
      [v(10, 26), v(8, 22), v(8, 18)],
      [v(10, 26), v(2, 16), v(-12, 8), v(-12, 0), v(-16, -8)],
      [v(10, 26), v(18, 16), v(18, 4), v(18, -4), v(2, -8), v(-4, -10)],
      [v(6, 20), v(8, 22), v(10, 22)],
      [v(-18, -10), v(-16, -8), v(-14, -6)],
      [v(-16, -1.5, 2.8), v(-16, 2, 2.8), v(-15, 4, 2.8)],
    ],
    bounds: { minX: -44.5, maxX: 44.5, minZ: -24.5, maxZ: 32.5 },
    sites: [
      { id: "loft", call: "A", name: "Chapel", x: 8, y: 0, z: 22, r: 3 },
      { id: "well", call: "B", name: "Gardens", x: -16, y: 0, z: -8, r: 3.2 },
    ],
    placeName: (x, z, y = 0) => {
      if (z < -16 && x > -12 && x < 8) return "South yard";
      if (z > 26 && x > 2 && x < 18) return "Chapel yard";
      if (x > 1 && x < 15 && z > 16 && z < 27) return "Chapel";
      if (x > -22 && x < -10 && z > -15 && z < -1) return "Gardens";
      if (x > -4 && x < 8 && z > 0 && z < 8) return "Square";
      if (y > 2.2 && x < -13 && z > -3 && z < 10) return "West 2F";
      if (Math.abs(x - 2) < 4 && z > -16 && z < 16) return "High street";
      if (x < -10 && z > -2 && z < 16) return "West street";
      if (x > 14 && z > -8 && z < 16) return "East street";
      return "Parish";
    },
  });
}

function chapel(
  box: BoxFn,
  mat: MatFn,
  pad: Kit["pad"],
  siteMarker: Kit["siteMarker"],
  v: Kit["v"],
) {
  const h = 5.6;
  wallZ(box, mat, 2.2, 16.4, 26.4, h, [
    { z0: 20.6, z1: 23.2, y0: 1.15, y1: 2.55 },
  ], "plaster");
  wallZ(box, mat, 13.8, 16.4, 26.4, h, [
    { z0: 18.4, z1: 20.0, y0: 1.15, y1: 2.5 },
    { z0: 22.8, z1: 24.4, y0: 1.15, y1: 2.5 },
  ], "plaster");
  wallX(box, mat, 16.4, 2.2, 13.8, h, [{ x0: 6.6, x1: 9.4, y0: 0, y1: 2.25 }], "plaster");
  wallX(box, mat, 26.4, 2.2, 13.8, h, [{ x0: 6.6, x1: 9.4, y0: 0, y1: 2.25 }], "plaster");
  box(8, 5.72, 21.4, 12.0, 0.16, 10.4, mat("wood", 10, 8, 0.8, 0.02), false);

  box(5.0, 0.42, 18.2, 1.7, 0.84, 0.55, mat("wood", 1.6, 0.5), true, true);
  box(11.0, 0.42, 18.2, 1.7, 0.84, 0.55, mat("wood", 1.6, 0.5), true, true);
  box(5.0, 0.42, 19.4, 1.7, 0.84, 0.55, mat("wood", 1.6, 0.5), true, true);
  box(11.0, 0.42, 19.4, 1.7, 0.84, 0.55, mat("wood", 1.6, 0.5), true, true);
  box(8, 0.65, 25.2, 2.2, 1.3, 0.6, mat("plaster", 2, 1.2));

  pad(8, 0.04, 22);
  siteMarker(v(8, 22, 3.1), "A");
  siteMarker(v(8, 16.2, 2.5), "A");
}

function gardens(
  box: BoxFn,
  mat: MatFn,
  pad: Kit["pad"],
  siteMarker: Kit["siteMarker"],
  v: Kit["v"],
) {
  const h = 2.8;
  const brick = mat("brick", 10, 3);
  box(-22.15, h / 2, -8, T, h, 12.6, brick);
  box(-10.0, h / 2, -12.2, T, h, 4.2, brick);
  box(-10.0, h / 2, -3.2, T, h, 2.8, brick);
  box(-16.1, h / 2, -14.25, 12.4, h, T, brick);
  box(-19.6, h / 2, -1.75, 5.2, h, T, brick);
  box(-12.4, h / 2, -1.75, 4.0, h, T, brick);

  box(-20.2, 0.55, -11.4, 1.3, 1.1, 1.1, mat("leaf", 1.2, 1));
  box(-12.4, 0.5, -4.6, 1.2, 1.0, 1.0, mat("leaf", 1.1, 1));
  cover(box, mat, -12.8, -12.0);

  pad(-16, 0.04, -8);
  siteMarker(v(-16, -8, 2.6), "B");
  siteMarker(v(-11, -4, 2.3), "B");
}

function westHouse(box: BoxFn, mat: MatFn, climb: Kit["climb"]) {
  const h = 5.4;
  wallZ(box, mat, -22.2, 0.4, 10.0, h, [
    { z0: 3.6, z1: 5.2, y0: 1.15, y1: 2.45 },
    { z0: 6.8, z1: 8.2, y0: 3.15, y1: 4.45 },
  ], "brick");
  wallZ(box, mat, -13.8, 0.4, 10.0, h, [
    { z0: 3.8, z1: 6.2, y0: 0, y1: 2.2 },
    { z0: 1.2, z1: 2.6, y0: 1.15, y1: 2.45 },
    { z0: 7.0, z1: 8.4, y0: 3.15, y1: 4.45 },
  ], "brick");
  wallX(box, mat, 0.4, -22.2, -13.8, h, [
    { x0: -17.4, x1: -14.8, y0: 2.8, y1: 5.05 },
  ], "brick");
  wallX(box, mat, 10.0, -22.2, -13.8, h, [
    { x0: -19.0, x1: -17.4, y0: 1.15, y1: 2.45 },
  ], "brick");

  box(-17.9, 2.72, 3.2, 7.0, 0.16, 4.8, mat("wood", 6, 4, 0.8, 0.02), true, true);
  box(-16.1, 2.72, 7.6, 3.4, 0.16, 4.0, mat("wood", 3, 4, 0.8, 0.02), true, true);
  box(-16.2, 2.72, -1.0, 4.6, 0.16, 3.6, mat("wood", 4, 3, 0.8, 0.02), true, true);

  climb(-21.2, -1.5, "+x", 2.8, 2.4, 0);

  box(-16.4, 0.5, 7.4, 1.15, 1.0, 1.05, mat("wood", 1, 0.9), true, true);
  box(-15.2, 3.3, 6.4, 1.1, 1.0, 1.0, mat("wood", 1, 0.8), true, true);

  box(-18, 5.48, 5.2, 8.8, 0.16, 10.0, mat("wood", 8, 8, 0.7, 0.04), false);
}

function eastHouse(box: BoxFn, mat: MatFn) {
  const h = 4.2;
  wallZ(box, mat, 13.8, -0.4, 9.8, h, [
    { z0: 3.2, z1: 5.6, y0: 0, y1: 2.2 },
    { z0: 0.8, z1: 2.2, y0: 1.15, y1: 2.45 },
    { z0: 6.6, z1: 8.0, y0: 1.15, y1: 2.45 },
  ], "plaster");
  wallZ(box, mat, 22.2, -0.4, 9.8, h, [
    { z0: 3.6, z1: 5.0, y0: 1.15, y1: 2.45 },
  ], "plaster");
  wallX(box, mat, -0.4, 13.8, 22.2, h, [{ x0: 16.4, x1: 18.0, y0: 1.15, y1: 2.45 }], "plaster");
  wallX(box, mat, 9.8, 13.8, 22.2, h, [{ x0: 16.8, x1: 18.2, y0: 1.15, y1: 2.45 }], "plaster");
  box(18, 4.32, 4.7, 8.8, 0.16, 10.6, mat("wood", 8, 8, 0.8, 0.02), false);
  box(18.6, 0.5, 6.4, 1.15, 1.0, 1.05, mat("wood", 1, 0.9), true, true);
}

function square(box: BoxFn, mat: MatFn, root: THREE.Group) {
  box(2, 0.32, 4, 3.4, 0.64, 3.4, mat("cobble", 3, 3));
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.7, 0.7, 16), mat("cobble", 3, 1));
  ring.position.set(2, 0.36, 4);
  ring.castShadow = true;
  ring.receiveShadow = true;
  root.add(ring);
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(0.95, 0.95, 0.1, 14),
    new THREE.MeshStandardMaterial({ color: 0x4a5a58, roughness: 0.22, metalness: 0.3 }),
  );
  water.position.set(2, 0.68, 4);
  root.add(water);
}

function openYards(box: BoxFn, mat: MatFn) {
  box(-8.4, 0.7, -21.2, 1.6, 1.4, 0.7, mat("wood", 1.4, 1.2));
  cover(box, mat, -1.2, -20.4);
  box(6.4, 0.38, 29.2, 1.8, 0.76, 0.7, mat("brick", 1.6, 0.6));
  box(14.2, 0.36, 28.4, 1.5, 0.72, 0.65, mat("brick", 1.4, 0.6));
  cover(box, mat, 16.4, 24.6);
}

function dressParish(box: BoxFn, mat: MatFn, lamp: Kit["lamp"]) {
  cover(box, mat, -8, -10);
  cover(box, mat, 6, -6);
  cover(box, mat, -8, 8);
  cover(box, mat, 10, 12);
  cover(box, mat, 18, -6);

  box(-2.2, 0.36, -10.4, 1.3, 0.72, 1.0, mat("brick", 1.2, 0.6), true, true);
  box(12.4, 0.34, 10.2, 1.2, 0.68, 0.9, mat("brick", 1.1, 0.6), true, true);

  lamp(2, -10, 0xffc090);
  lamp(2, 4, 0xffc090);
  lamp(-12, 2, 0xffc090);
  lamp(18, 4, 0xffc090);
  lamp(8, 18, 0xffd4a0);
  lamp(10, 28, 0xffc090);
}

function cover(box: BoxFn, mat: MatFn, x: number, z: number) {
  box(x, 0.5, z, 1.15, 1.0, 1.05, mat("wood", 1.1, 0.9), true, true);
  box(x + 1.05, 0.46, z + 0.15, 1.0, 0.92, 0.95, mat("wood", 1, 0.8), true, true);
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
