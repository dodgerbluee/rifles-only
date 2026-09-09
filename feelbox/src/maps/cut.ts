import * as THREE from "three";
import { makeKit, sky, finish, T } from "./kit";
import type { BoxFn, MatFn, Kit } from "./kit";
import type { World } from "../world";

/** Quarry: open rim Ember, open pit Stone, ramps pit ↔ terrace ↔ rim. */
export function buildCut(scene: THREE.Scene): World {
  const kit = makeKit(scene);
  const { box, mat, v, siteMarker, lamp, pad, climb } = kit;

  scene.background = new THREE.Color(0xc4a070);
  scene.fog = new THREE.Fog(0xc4a882, 16, 48);
  sky(scene, "#c4a070", "#8a6238");
  scene.add(new THREE.HemisphereLight(0xffc8a0, 0x4a3a28, 1.0));
  const sun = new THREE.DirectionalLight(0xffb070, 1.38);
  sun.position.set(-42, 16, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 130;
  sun.shadow.camera.left = -56;
  sun.shadow.camera.right = 56;
  sun.shadow.camera.top = 44;
  sun.shadow.camera.bottom = -44;
  sun.shadow.bias = -0.0006;
  scene.add(sun);

  const lime = (a: number, b: number) => mat("lime", a, b, 0.9, 0.04);
  const H = 6.4;

  box(0, -0.08, 4, 89.2, 0.16, 57.2, lime(40, 28), true, true);
  box(2, 0.02, 2, 28, 0.04, 20, mat("dirt", 14, 12), false);

  floors(box, lime);
  faces(box, mat);
  ramps(climb, box, mat);
  rimSite(box, mat, pad, siteMarker, v);
  kilnSite(box, mat, pad, siteMarker, v, kit.root);
  underpass(box, mat);
  openSpawns(box, mat);
  dressCut(box, mat, lamp, kit.root);
  puddle(kit.root);

  box(0, H / 2, 32.35, 90, H, 0.5, lime(28, 6));
  box(0, H / 2, -24.25, 90, H, 0.5, lime(28, 6));
  box(-44.35, H / 2, 4, 0.5, H, 57.5, lime(22, 6));
  box(44.35, H / 2, 4, 0.5, H, 57.5, lime(22, 6));

  return finish(kit, {
    id: "cut",
    title: "The Cut",
    blurb: "Limestone quarry at last light. Plant the Wire at A or B.",
    plantSpawns: [v(-38, 8, 6.4), v(-38, 10, 6.4), v(-38, 12, 6.4), v(-36, 9, 6.4), v(-36, 11, 6.4)],
    watchSpawns: [v(34, 6), v(36, 8), v(36, 10), v(34, 8), v(32, 11)],
    waypoints: [
      [v(-30, 10, 6.4), v(-20, 16, 6.4), v(-8, 16, 6.4)],
      [v(-30, 10, 6.4), v(-32, 8, 6.4), v(-22, 4, 3.2), v(-12, 4, 0), v(4, -2, 0), v(12, -6, 0)],
      [v(-30, 8, 6.4), v(-22, 8, 3.2), v(-12, 4, 0), v(8, 8, 0), v(20, 8, 0), v(24, 8, 3.2)],
      [v(34, 8, 0), v(20, -3, 0), v(24, -3, 3.2), v(24, 14, 3.2), v(8, 18, 3.2), v(-12, 20, 3.2), v(-8, 26, 6.4), v(-8, 16, 6.4)],
      [v(34, 8, 0), v(16, 0, 0), v(12, -6, 0)],
      [v(34, 8, 0), v(8, 12, 0), v(8, 18, 3.2), v(10, 18, 3.2)],
      [v(-12, 16, 6.4), v(-8, 16, 6.4), v(-4, 16, 6.4)],
      [v(8, -6, 0), v(12, -6, 0), v(14, -4, 0)],
      [v(0, 10, 0), v(-6, 14, 0), v(-6, 18, 0)],
      [v(4, -10, 0), v(4, -14, 3.2), v(-2, -20, 6.4), v(-20, -16, 6.4), v(-30, 4, 6.4)],
    ],
    bounds: { minX: -44.5, maxX: 44.5, minZ: -24.5, maxZ: 32.5 },
    sites: [
      { id: "loft", call: "A", name: "Rim", x: -8, y: 6.4, z: 16, r: 3 },
      { id: "well", call: "B", name: "Kiln", x: 12, y: 0, z: -6, r: 3.2 },
    ],
    placeName: (x, z, y = 0) => {
      if (x < -28 && y > 5) return "West rim";
      if (x > 28 && y < 2) return "East pit";
      if (x > -14 && x < -2 && z > 12 && z < 20 && y > 5) return "Rim";
      if (x > 6 && x < 18 && z > -11 && z < -1 && y < 2.4) return "Kiln floor";
      if (x > 14 && x < 26 && z > -6 && z < 0 && y > 0.4 && y < 3.8) return "Conveyor";
      if (z > 11 && z < 19 && x > -9 && x < -3 && y < 2.4) return "Underpass";
      if (y > 2.6 && y < 4.4) return "Mid terrace";
      if (Math.hypot(x - 1, z - 3) < 5 && y < 1) return "Pit puddle";
      if (y < 1.2 && Math.abs(x) < 18 && z > -10 && z < 14) return "Pit floor";
      if (y > 5.5) return "Rim walk";
      return "The Cut";
    },
  });
}

function floors(box: BoxFn, lime: (a: number, b: number) => THREE.Material) {
  box(-21, 3.12, 4, 10, 0.16, 24, lime(8, 12), true, true);
  box(-12.5, 3.12, 17, 7, 0.16, 6, lime(6, 4), true, true);
  box(10.5, 3.12, 17.6, 11, 0.16, 7.2, lime(8, 4), true, true);
  box(-2, 3.12, 19.5, 14, 0.16, 2.2, lime(10, 2), true, true);
  box(6, 3.12, -14, 20, 0.16, 8, lime(12, 4), true, true);
  box(26, 3.12, 5, 8, 0.16, 22, lime(6, 12), true, true);
  box(19, 3.12, 17, 6, 0.16, 6, lime(5, 4), true, true);

  box(-34, 6.32, 4, 20, 0.16, 44, lime(14, 22), true, true);
  box(-5, 6.32, 27, 42, 0.16, 10, lime(20, 6), true, true);
  box(-8, 6.32, 16, 12, 0.16, 12, lime(8, 8), true, true);
  box(-20, 6.32, 16, 12, 0.16, 4, lime(8, 3), true, true);
  box(-9, 6.32, -20, 34, 0.16, 8, lime(16, 5), true, true);
}

function faces(box: BoxFn, mat: MatFn) {
  const rock = mat("lime", 10, 4);
  box(-16, 1.6, -2.8, 0.5, 3.2, 10.4, rock);
  box(-16, 1.6, 11.0, 0.5, 3.2, 8.0, rock);

  box(-11.6, 1.6, 14, 8.8, 3.2, 0.5, rock);
  box(13.2, 1.6, 14, 7.2, 3.2, 0.5, rock);

  box(-1.2, 1.6, -10, 5.6, 3.2, 0.5, rock);
  box(8.8, 1.6, -10, 5.2, 3.2, 0.5, rock);
  box(13.8, 1.6, -10, 4.4, 3.2, 0.5, rock);

  box(22, 1.6, -5.4, 0.5, 3.2, 1.2, rock);
  box(22, 1.6, 3.5, 0.5, 3.2, 5.8, rock);
  box(22, 1.6, 13.0, 0.5, 3.2, 4.0, rock);

  box(-26, 4.8, -4.8, 0.5, 3.2, 18.4, rock);
  box(-26, 4.8, 18.0, 0.5, 3.2, 12.0, rock);

  box(-20.0, 4.8, 22, 10.0, 3.2, 0.5, rock);
  box(6.0, 4.8, 22, 22.0, 3.2, 0.5, rock);

  box(-14.8, 4.8, -16, 20.4, 3.2, 0.5, rock);
  box(4.4, 4.8, -16, 7.2, 3.2, 0.5, rock);
}

function ramps(climb: Kit["climb"], box: BoxFn, mat: MatFn) {
  climb(-15.4, 4.0, "-x", 3.2, 2.6, 0);
  climb(-25.4, 8.0, "-x", 3.2, 2.6, 3.2);
  climb(8.0, 12.6, "+z", 3.2, 2.6, 0);
  climb(-12.5, 19.6, "+z", 3.2, 2.6, 3.2);
  climb(17.6, -3.0, "+x", 3.2, 2.4, 0);
  climb(19.2, 8.0, "+x", 3.2, 2.6, 0);
  climb(4.0, -8.6, "-z", 3.2, 2.6, 0);
  climb(-2.0, -15.4, "-z", 3.2, 2.6, 3.2);

  box(21.6, 3.28, -3.0, 6.4, 0.12, 2.2, mat("metal", 5, 2, 0.48, 0.5), true, true);
}

function rimSite(
  box: BoxFn,
  mat: MatFn,
  pad: Kit["pad"],
  siteMarker: Kit["siteMarker"],
  v: Kit["v"],
) {
  box(-13.4, 6.78, 19.8, 2.4, 0.72, 0.6, mat("dirt", 2.2, 0.6));
  box(-2.6, 6.78, 19.6, 2.2, 0.72, 0.6, mat("dirt", 2, 0.6));
  box(-13.2, 6.78, 12.4, 2.0, 0.72, 0.55, mat("dirt", 1.8, 0.6));
  box(-2.8, 6.78, 12.2, 2.0, 0.72, 0.55, mat("dirt", 1.8, 0.6));
  box(-16.2, 8.6, 16, 0.5, 4.4, 0.5, mat("metal", 0.4, 4, 0.45, 0.55));
  box(-4, 10.5, 16, 24, 0.28, 0.38, mat("metal", 16, 0.3, 0.45, 0.55));
  pad(-8, 6.44, 16);
  siteMarker(v(-8, 16, 8.8), "A");
  siteMarker(v(-18, 16, 8.2), "A");
}

function kilnSite(
  box: BoxFn,
  mat: MatFn,
  pad: Kit["pad"],
  siteMarker: Kit["siteMarker"],
  v: Kit["v"],
  root: THREE.Group,
) {
  const h = 3.6;
  const brick = mat("brick", 8, 4);
  wallX(box, -10.2, 7.0, 17.0, h, [], brick);
  wallX(box, -1.8, 7.0, 17.0, h, [{ x0: 10.6, x1: 13.4, y0: 0, y1: 2.25 }], brick);
  wallZ(box, 7.0, -10.2, -1.8, h, [{ z0: -7.6, z1: -4.6, y0: 0, y1: 2.25 }], brick);
  wallZ(box, 17.0, -10.2, -1.8, h, [], brick);
  box(12, 3.72, -6, 10.4, 0.16, 8.8, brick, true, false);

  box(8.6, 0.7, -8.8, 1.2, 1.4, 1.1, mat("metal", 1.1, 1.3, 0.45, 0.4));
  box(15.4, 0.7, -3.2, 1.2, 1.4, 1.1, mat("metal", 1.1, 1.3, 0.45, 0.4));
  pad(12, 0.04, -6);
  siteMarker(v(12, -6, 2.8), "B");
  siteMarker(v(16, -2, 2.4), "B");
  const glow = new THREE.PointLight(0xff7a30, 14, 10, 1.5);
  glow.position.set(12, 2.4, -6);
  root.add(glow);
}

function wallX(
  box: BoxFn,
  z: number,
  x0: number,
  x1: number,
  h: number,
  holes: { x0: number; x1: number; y0: number; y1: number }[],
  brick: THREE.Material,
) {
  const solids = subtract1d(x0, x1, holes.map((hole) => [hole.x0, hole.x1] as [number, number]));
  for (const [a, b] of solids) {
    const x = (a + b) / 2;
    const sx = b - a;
    if (sx < 0.05) continue;
    box(x, h / 2, z, sx, h, T, brick);
  }
  for (const hole of holes) {
    if (hole.y1 < h - 0.05) {
      const sy = h - hole.y1;
      box((hole.x0 + hole.x1) / 2, hole.y1 + sy / 2, z, hole.x1 - hole.x0, sy, T, brick);
    }
  }
}

function wallZ(
  box: BoxFn,
  x: number,
  z0: number,
  z1: number,
  h: number,
  holes: { z0: number; z1: number; y0: number; y1: number }[],
  brick: THREE.Material,
) {
  const solids = subtract1d(z0, z1, holes.map((hole) => [hole.z0, hole.z1] as [number, number]));
  for (const [a, b] of solids) {
    const z = (a + b) / 2;
    const sz = b - a;
    if (sz < 0.05) continue;
    box(x, h / 2, z, T, h, sz, brick);
  }
  for (const hole of holes) {
    if (hole.y1 < h - 0.05) {
      const sy = h - hole.y1;
      box(x, hole.y1 + sy / 2, (hole.z0 + hole.z1) / 2, T, sy, hole.z1 - hole.z0, brick);
    }
  }
}

function subtract1d(a: number, b: number, holes: [number, number][]) {
  let spans: [number, number][] = [[Math.min(a, b), Math.max(a, b)]];
  for (const [hs0, hs1] of holes) {
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

function underpass(box: BoxFn, mat: MatFn) {
  const rock = mat("lime", 6, 3);
  box(-8.2, 1.25, 15, 0.5, 2.5, 6.4, rock);
  box(-3.8, 1.25, 15, 0.5, 2.5, 6.4, rock);
  box(-6, 2.45, 15, 4.8, 0.22, 6.0, rock);
}

function openSpawns(box: BoxFn, mat: MatFn) {
  ore(box, mat, -36, 6.4, 5);
  box(-37.2, 6.78, 14.2, 1.8, 0.72, 0.7, mat("dirt", 1.6, 0.6));
  box(-35.4, 6.74, 4.6, 1.5, 0.68, 0.65, mat("lime", 1.4, 0.6));
  ore(box, mat, 34, 0, 4);
  box(36.2, 0.42, 13.0, 1.8, 0.84, 0.7, mat("dirt", 1.6, 0.6));
  box(32.4, 0.38, 5.2, 1.5, 0.76, 0.65, mat("lime", 1.4, 0.6));
}

function dressCut(box: BoxFn, mat: MatFn, lamp: Kit["lamp"], root: THREE.Group) {
  ore(box, mat, -8, 0, 4);
  ore(box, mat, 4, 0, 8);
  ore(box, mat, -12, 3.2, 8);
  ore(box, mat, 24, 3.2, 12);
  ore(box, mat, 6, 3.2, 18);
  ore(box, mat, -22, 6.4, 20);

  cover(box, mat, -8, 0, 8);
  cover(box, mat, 18, 0, 4);
  cover(box, mat, 8, 3.2, -14);
  cover(box, mat, -20, 3.2, 0);
  cover(box, mat, 6, 6.4, 24);

  lamp(-28, 8, 0xffb070);
  lamp(8, 8, 0xffb070);
  lamp(12, -12, 0xffb070);
  lamp(26, 8, 0xffb070);
  const rimLamp = new THREE.PointLight(0xffc080, 16, 14, 1.5);
  rimLamp.position.set(-8, 9.4, 16);
  root.add(rimLamp);
  const pit = new THREE.PointLight(0xff8a40, 10, 11, 1.7);
  pit.position.set(0, 3.2, 2);
  root.add(pit);
}

function puddle(root: THREE.Group) {
  const water = new THREE.MeshStandardMaterial({
    color: 0x2a2e28,
    roughness: 0.18,
    metalness: 0.42,
    transparent: true,
    opacity: 0.7,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.08, 4.0), water);
  mesh.position.set(1.0, 0.04, 3.2);
  mesh.receiveShadow = true;
  root.add(mesh);
}

function ore(box: BoxFn, mat: MatFn, x: number, y: number, z: number) {
  box(x, y + 0.5, z, 2.0, 1.0, 1.6, mat("dirt", 1.8, 0.9));
  box(x + 0.6, y + 0.75, z + 0.15, 1.2, 0.8, 1.1, mat("lime", 1.1, 0.7));
}

function cover(box: BoxFn, mat: MatFn, x: number, y: number, z: number) {
  box(x, y + 0.5, z, 1.15, 1.0, 1.05, mat("wood", 1.1, 0.9), true, true);
  box(x + 1.05, y + 0.46, z + 0.15, 1.0, 0.92, 0.95, mat("wood", 1, 0.8), true, true);
}
