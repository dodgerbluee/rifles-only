import * as THREE from "three";
import { makeTextures, surf, type TexPack } from "./textures";

import { type Aabb, hasLos, rayShot, rayWorld } from "./trace";

export type { Aabb };
export { hasLos, rayShot, rayWorld };

export type Site = {
  id: "loft" | "well";
  call: string;
  name: string;
  x: number;
  y: number;
  z: number;
  r: number;
};

export type World = {
  id?: string;
  title?: string;
  blurb?: string;
  root?: THREE.Group;
  colliders: Aabb[];
  shootables: THREE.Object3D[];
  playerSpawn: THREE.Vector3;
  plantSpawns: THREE.Vector3[];
  watchSpawns: THREE.Vector3[];
  botSpawns: THREE.Vector3[];
  waypoints: THREE.Vector3[][];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  sites: Site[];
  placeName?: (x: number, z: number, y?: number) => string;
};

const T = 0.32;

export function buildWorld(scene: THREE.Scene): World {
  const tex = makeTextures();
  const colliders: Aabb[] = [];
  const shootables: THREE.Object3D[] = [];

  scene.background = new THREE.Color(0xb4bcc4);
  scene.fog = new THREE.Fog(0xb4bcc4, 14, 42);
  addSky(scene);

  scene.add(new THREE.HemisphereLight(0xc8d0d6, 0x5a5e62, 0.95));
  const sun = new THREE.DirectionalLight(0xe8eef2, 1.15);
  sun.position.set(-8, 42, 18);
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

  const iceLamp = new THREE.PointLight(0xffc27a, 18, 14, 1.5);
  iceLamp.position.set(-9, 5.1, 20.5);
  scene.add(iceLamp);
  const slipLamp = new THREE.PointLight(0x9ec4d4, 16, 12, 1.4);
  slipLamp.position.set(10, 2.6, -16);
  scene.add(slipLamp);
  const emberLamp = new THREE.PointLight(0xffd09a, 14, 12, 1.6);
  emberLamp.position.set(-38, 3.4, 10);
  scene.add(emberLamp);
  const stoneLamp = new THREE.PointLight(0xffd09a, 14, 12, 1.6);
  stoneLamp.position.set(38, 3.4, 10);
  scene.add(stoneLamp);

  const box = (
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    mat: THREE.Material,
    collide = true,
    walk = false,
    shot = true,
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    if (shot) shootables.push(mesh);
    if (collide) {
      colliders.push({
        min: new THREE.Vector3(x - sx / 2, y - sy / 2, z - sz / 2),
        max: new THREE.Vector3(x + sx / 2, y + sy / 2, z + sz / 2),
        walk,
        shot,
      });
    }
    return mesh;
  };

  const mat = (kind: keyof TexPack, a: number, b: number, r = 0.92, m = 0.04) =>
    surf(tex[kind], a, b, r, m);

  buildWharf(box, mat, scene, tex);

  siteMarker(scene, new THREE.Vector3(-9, 5.9, 20.5), "A");
  siteMarker(scene, new THREE.Vector3(-10, 3.15, 11.15), "A");
  siteMarker(scene, new THREE.Vector3(10, 3.35, -16), "B");
  siteMarker(scene, new THREE.Vector3(10, 3.1, -9.6), "B");

  const plantSpawns = [v(38, 2), v(38, 4), v(38, 5.5), v(36, 3), v(36, 5)];
  const watchSpawns = [v(-38, 6), v(-38, 8), v(-38, 10), v(-36, 7), v(-36, 9)];

  return {
    id: "wharf",
    title: "Wharf",
    blurb: "Winter dockyard. Plant the Wire at A or B.",
    colliders,
    shootables,
    playerSpawn: plantSpawns[2]!,
    plantSpawns,
    watchSpawns,
    botSpawns: [...plantSpawns, ...watchSpawns],
    waypoints: wharfWays(),
    bounds: { minX: -44.5, maxX: 44.5, minZ: -24.5, maxZ: 32.5 },
    sites: [
      { id: "loft", call: "A", name: "Ice", x: -9, y: 3.35, z: 20.5, r: 3.0 },
      { id: "well", call: "B", name: "Slip", x: 10, y: 0.12, z: -16, r: 3.2 },
    ],
  };
}

function v(x: number, z: number, y = 0) {
  return new THREE.Vector3(x, y, z);
}

function wharfWays() {
  return [
    [v(-34, 6), v(-28, 14), v(-24, 18), v(-14, 18, 3.35), v(-9, 20.5, 3.35)],
    [v(-34, 4), v(-20, -4), v(-8, -8), v(4, -12), v(10, -16)],
    [v(34, 4), v(14, 4), v(12, 13), v(-2, 13), v(-9, 20.5, 3.35)],
    [v(34, 4), v(24, 0), v(14, -6), v(10, -14), v(10, -16)],
    [v(-22, 4), v(-8, 6), v(2, 8), v(12, 8), v(20, 8)],
    [v(-16, 2), v(-8, -4), v(2, -8), v(12, -10)],
    [v(8, 16, 3.35), v(-2, 16, 3.35), v(-9, 20.5, 3.35)],
    [v(22, 0), v(16, -4), v(12, -8), v(10, -14)],
  ];
}

function buildWharf(box: BoxFn, mat: MatFn, scene: THREE.Scene, tex: TexPack) {
  const H = 6.4;
  const snow = mat("snow", 40, 28, 0.96, 0.02);
  const water = new THREE.MeshStandardMaterial({
    color: 0x4a5860,
    roughness: 0.28,
    metalness: 0.38,
  });
  const gold = new THREE.MeshStandardMaterial({
    color: 0xc4a045,
    roughness: 0.42,
    metalness: 0.45,
    emissive: 0x3a2808,
    emissiveIntensity: 0.4,
  });

  box(0, -0.06, 4, 89.2, 0.12, 57.2, snow, true, true);
  box(0, 0.01, 4, 4.4, 0.04, 36, mat("asphalt", 3, 16), false);
  const drink = new THREE.Mesh(new THREE.BoxGeometry(92, 0.2, 14), water);
  drink.position.set(0, -0.7, -31);
  drink.receiveShadow = true;
  scene.add(drink);

  box(0, H / 2, 32.35, 90, H, 0.5, mat("brick", 28, 6));
  box(0, 1.6, -24.25, 90, 3.2, 0.5, mat("brick", 28, 3));
  box(-44.35, H / 2, 4, 0.5, H, 57.5, mat("brick", 22, 6));
  box(44.35, H / 2, 4, 0.5, H, 57.5, mat("brick", 22, 6));

  box(-36, 3.7, 27.2, 15.5, 7.4, 9.2, mat("brick", 12, 6));
  box(36, 3.7, 27.2, 15.5, 7.4, 9.2, mat("brick", 12, 6));
  box(12, 3.9, 29.6, 18, 7.8, 5.2, mat("brick", 14, 6));
  box(-12, 3.4, 29.8, 10, 6.8, 4.6, mat("brick", 8, 5));

  buildEmberDock(box, mat);
  buildStoneDock(box, mat);
  buildIce(box, mat, gold);
  buildSlip(box, mat, gold);
  buildBoatShed(box, mat);
  buildNetShed(box, mat);
  buildMidCover(box, mat);

  const piles: [number, number][] = [
    [-24, 10],
    [-22, 16.2],
    [-20, 8],
    [-16, 6],
    [-14, 9.5],
    [-8, 6.5],
    [-4, 8],
    [0, 4.5],
    [3, 7],
    [6, 2],
    [8, -4],
    [12, -8],
    [16, 2],
    [18, 6],
    [22, 4.2],
    [20, -2],
    [14, -13],
    [6, -11],
    [-4, -6],
    [-12, -4],
    [-18, 0.5],
    [2, 14],
    [-6, 16],
    [22, 10],
    [8, 10],
    [-26, 16],
    [4, -2],
    [26, 0],
    [-8, -10],
    [18, -12],
  ];
  for (const [x, z] of piles) cratePile(box, mat, x, z);

  truck(box, mat, -6, -6, true);
  truck(box, mat, 14, 4, false);
  truck(box, mat, -20, 4, true);

  barrel(scene, tex, -10, -8);
  barrel(scene, tex, -9.4, -8.2);
  barrel(scene, tex, 8, -4);
  barrel(scene, tex, 18, -6);
  barrel(scene, tex, -15, 8);
  barrel(scene, tex, 4, 12);
  barrel(scene, tex, 22, 8);
  barrel(scene, tex, -22, 12);
  barrel(scene, tex, 6, -14);
  barrel(scene, tex, -4, 2);

  lamp(scene, -28, 10);
  lamp(scene, -18, 12);
  lamp(scene, -8, 4);
  lamp(scene, 6, 10);
  lamp(scene, 18, 6);
  lamp(scene, 28, 8);
  lamp(scene, 8, -8);
  lamp(scene, -12, -6);
  lamp(scene, 22, -4);
  lamp(scene, -32, 14);
}

function buildEmberDock(box: BoxFn, mat: MatFn) {
  // Open west yard: cover north/south of a wide walk-out, no boxed spawn.
  box(-30, 3.2, 16.65, 4.4, 6.4, 4.3, mat("brick", 4, 6));
  box(-30, 3.2, -4.2, 4.4, 6.4, 8.5, mat("brick", 4, 6));
  box(-28, 3.2, -8.4, 8.2, 6.4, 0.5, mat("brick", 7, 6));
  box(-32.2, 0.55, 14.4, 1.6, 1.1, 1.4, mat("wood", 1.4, 1), true, true);
  box(-32.2, 0.5, 0.9, 1.3, 1.0, 1.1, mat("wood", 1.2, 0.9), true, true);
}

function buildStoneDock(box: BoxFn, mat: MatFn) {
  box(30, 3.2, 16.65, 4.4, 6.4, 4.3, mat("brick", 4, 6));
  box(30, 3.2, -4.2, 4.4, 6.4, 8.5, mat("brick", 4, 6));
  box(28, 3.2, -8.4, 8.2, 6.4, 0.5, mat("brick", 7, 6));
  box(32.2, 0.55, 14.4, 1.6, 1.1, 1.4, mat("wood", 1.4, 1), true, true);
  box(32.2, 0.5, 0.9, 1.3, 1.0, 1.1, mat("wood", 1.2, 0.9), true, true);
}

function buildIce(box: BoxFn, mat: MatFn, gold: THREE.Material) {
  const h = 6.2;
  wallZ(box, mat, -18, 12, 25, h, [{ z0: 17.2, z1: 18.9, y0: 0, y1: 2.15 }]);
  wallZ(box, mat, 0, 12, 25, h, [
    { z0: 17.2, z1: 18.9, y0: 0, y1: 2.15 },
    { z0: 17.4, z1: 19.2, y0: 3.5, y1: 5.15 },
  ]);
  wallX(box, mat, 12, -18, 0, h, [
    { x0: -14.2, x1: -12.4, y0: 0, y1: 2.15 },
    { x0: -7.2, x1: -5.4, y0: 0, y1: 2.15 },
    { x0: -15.6, x1: -13.4, y0: 3.5, y1: 5.15 },
    { x0: -8.6, x1: -6.4, y0: 3.5, y1: 5.15 },
  ]);
  wallX(box, mat, 25, -18, 0, h, []);
  box(-9, 3.28, 21.3, 17.6, 0.16, 7.4, mat("wood", 14, 8, 0.8, 0.02), true, true);
  box(-14.7, 3.28, 16.55, 6.4, 0.16, 2.1, mat("wood", 5, 2, 0.8, 0.02), true, true);
  box(-4.9, 3.28, 16.55, 9.6, 0.16, 2.1, mat("wood", 8, 2, 0.8, 0.02), true, true);
  box(-9, 6.22, 18.5, 18.2, 0.14, 13.4, mat("metal", 14, 10, 0.62, 0.22), false);
  box(-14.4, 4.15, 19.2, 0.1, 1.6, 6.4, mat("metal", 0.4, 5, 0.45, 0.5), false);
  box(-3.6, 4.15, 19.2, 0.1, 1.6, 6.4, mat("metal", 0.4, 5, 0.45, 0.5), false);
  box(-9, 4.85, 20.5, 11.2, 0.08, 0.1, mat("metal", 8, 0.3, 0.45, 0.5), false);
  box(-9, 3.38, 20.5, 3.5, 0.06, 3.5, gold, true, true);
  box(-12.2, 3.85, 22.4, 1.2, 1.0, 1.1, mat("wood", 1, 0.9), true, true);
  box(-5.6, 3.85, 18.2, 1.3, 1.0, 1.05, mat("wood", 1, 0.9), true, true);
  stairs(box, mat, -10.6, 13.15, "+z", 8, 0.42, 0.52, 1.7, 0);
}

function buildSlip(box: BoxFn, mat: MatFn, gold: THREE.Material) {
  box(10, 4.15, -16, 16.4, 2.6, 9.2, mat("metal", 12, 8, 0.5, 0.4));
  box(2.4, 1.5, -16, 0.35, 3.0, 8.6, mat("wood", 0.5, 3));
  box(17.6, 1.5, -16, 0.35, 3.0, 8.6, mat("wood", 0.5, 3));
  box(10, 1.5, -20.4, 15.4, 3.0, 0.35, mat("wood", 12, 3));
  box(4, 0.45, -14.2, 1.5, 0.9, 1.3, mat("wood", 1.2, 0.8), true, true);
  box(16, 0.45, -14.4, 1.5, 0.9, 1.3, mat("wood", 1.2, 0.8), true, true);
  box(4.2, 0.45, -17.8, 1.4, 0.9, 1.2, mat("wood", 1.2, 0.8), true, true);
  box(15.8, 0.45, -17.6, 1.4, 0.9, 1.2, mat("wood", 1.2, 0.8), true, true);
  box(10, 0.08, -16, 3.6, 0.08, 3.6, gold, true, true);
  box(10, 0.02, -12, 8, 0.05, 4.5, mat("wood", 6, 4), true, true);
}

function buildBoatShed(box: BoxFn, mat: MatFn) {
  const h = 6.1;
  wallZ(box, mat, 16, 6.5, 18, h, [{ z0: 10.2, z1: 12.0, y0: 0, y1: 2.15 }]);
  wallZ(box, mat, 27.4, 6.5, 18, h, [{ z0: 10.2, z1: 12.0, y0: 0, y1: 2.15 }]);
  wallX(box, mat, 6.5, 16, 27.4, h, [{ x0: 20.2, x1: 22.0, y0: 0, y1: 2.15 }]);
  wallX(box, mat, 18, 16, 27.4, h, []);
  box(21.7, 3.28, 14.8, 11.0, 0.16, 6.4, mat("wood", 10, 6, 0.8, 0.02), true, true);
  box(23.25, 3.28, 9.6, 7.9, 0.16, 4.0, mat("wood", 6, 3, 0.8, 0.02), true, true);
  box(21.7, 6.15, 12.25, 11.6, 0.14, 11.7, mat("metal", 10, 8, 0.6, 0.25), false);
  stairs(box, mat, 18.4, 7.4, "+z", 8, 0.42, 0.52, 1.6, 0);
  box(24.2, 3.85, 14.2, 1.25, 1.0, 1.1, mat("wood", 1, 0.9), true, true);
}

function buildNetShed(box: BoxFn, mat: MatFn) {
  const h = 3.25;
  wallZ(box, mat, -26, -9, 1, h, [{ z0: -5.0, z1: -3.3, y0: 0, y1: 2.1 }], "wood");
  wallZ(box, mat, -16, -9, 1, h, [{ z0: -5.0, z1: -3.3, y0: 0, y1: 2.1 }], "wood");
  wallX(box, mat, -9, -26, -16, h, [{ x0: -22.0, x1: -20.2, y0: 0, y1: 2.1 }], "wood");
  wallX(box, mat, 1, -26, -16, h, [], "wood");
  box(-21, 3.32, -4, 10.4, 0.16, 10.4, mat("wood", 8, 8, 0.8, 0.02), true, true);
  box(-19, 0.5, -4, 1.4, 1.0, 1.2, mat("wood", 1.2, 0.9), true, true);
}

function buildMidCover(box: BoxFn, mat: MatFn) {
  box(6, 1.65, 10.4, 8.2, 3.3, 1.15, mat("brick", 7, 3));
  box(2.2, 1.65, 7.6, 1.15, 3.3, 6.6, mat("brick", 5, 3));
  box(-22, 1.7, 8.4, 4.2, 3.4, 3.6, mat("brick", 4, 3));
}

function cratePile(box: BoxFn, mat: MatFn, x: number, z: number) {
  box(x, 0.5, z, 1.15, 1.0, 1.05, mat("wood", 1.1, 0.9), true, true);
  box(x + 1.12, 0.48, z + 0.18, 1.05, 0.96, 0.95, mat("wood", 1, 0.85), true, true);
  box(x + 0.45, 1.42, z + 0.08, 0.95, 0.82, 0.9, mat("wood", 0.9, 0.7), true, true);
}

function truck(box: BoxFn, mat: MatFn, x: number, z: number, alongX: boolean) {
  const metal = mat("metal", 5, 2, 0.5, 0.42);
  if (alongX) {
    box(x, 0.9, z, 5.5, 1.8, 2.15, metal);
    box(x - 1.7, 1.9, z, 2.05, 1.05, 2.05, metal);
  } else {
    box(x, 0.9, z, 2.15, 1.8, 5.5, metal);
    box(x, 1.9, z + 1.7, 2.05, 1.05, 2.05, metal);
  }
}

function stairs(
  box: BoxFn,
  mat: MatFn,
  x: number,
  z: number,
  dir: "+x" | "-x" | "+z" | "-z",
  steps: number,
  rise: number,
  run: number,
  width: number,
  startY: number,
) {
  const ax = dir === "+x" ? 1 : dir === "-x" ? -1 : 0;
  const az = dir === "+z" ? 1 : dir === "-z" ? -1 : 0;
  for (let i = 0; i < steps; i++) {
    const y = startY + i * rise + rise / 2;
    const cx = x + ax * (i * run + run / 2);
    const cz = z + az * (i * run + run / 2);
    const sx = ax !== 0 ? run : width;
    const sz = az !== 0 ? run : width;
    box(cx, y, cz, sx, rise, sz, mat("wood", 1.2, 0.5), true, true);
  }
}

function barrel(scene: THREE.Scene, tex: TexPack, x: number, z: number) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.3, 0.92, 12),
    surf(tex.metal, 1, 1.2, 0.45, 0.35),
  );
  mesh.position.set(x, 0.46, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function lamp(scene: THREE.Scene, x: number, z: number) {
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.07, 3.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x2c2e2a, roughness: 0.6, metalness: 0.4 }),
  );
  pole.position.set(x, 1.7, z);
  pole.castShadow = true;
  scene.add(pole);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.12, 0.22),
    new THREE.MeshStandardMaterial({ color: 0x3a3c36, roughness: 0.5, metalness: 0.5 }),
  );
  head.position.set(x, 3.35, z);
  scene.add(head);
  const light = new THREE.PointLight(0xffd19a, 7, 9, 1.8);
  light.position.set(x, 3.2, z);
  scene.add(light);
}

function siteMarker(scene: THREE.Scene, pos: THREE.Vector3, letter: string) {
  if (typeof document === "undefined") {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 1.2),
      new THREE.MeshBasicMaterial({ color: 0xe8d9a8, side: THREE.DoubleSide }),
    );
    mesh.position.copy(pos);
    scene.add(mesh);
    return;
  }
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "rgba(20,18,12,0.62)";
  g.fillRect(16, 16, 96, 96);
  g.strokeStyle = "#e8d9a8";
  g.lineWidth = 6;
  g.strokeRect(22, 22, 84, 84);
  g.fillStyle = "#e8d9a8";
  g.font = "bold 72px ui-sans-serif, system-ui";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(letter, 64, 70);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false }));
  sprite.position.copy(pos);
  sprite.scale.set(1.55, 1.55, 1);
  scene.add(sprite);
}

function addSky(scene: THREE.Scene) {
  const g = new THREE.SphereGeometry(110, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    fog: false,
    uniforms: {},
    vertexShader: `
      varying vec3 vP;
      void main() {
        vP = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vP;
      void main() {
        float h = normalize(vP).y;
        vec3 horizon = vec3(0.72, 0.74, 0.76);
        vec3 zenith = vec3(0.52, 0.58, 0.64);
        vec3 col = mix(horizon, zenith, smoothstep(-0.08, 0.62, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  scene.add(new THREE.Mesh(g, mat));
}

type HoleZ = { z0: number; z1: number; y0: number; y1: number };
type HoleX = { x0: number; x1: number; y0: number; y1: number };
type BoxFn = (
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  mat: THREE.Material,
  collide?: boolean,
  walk?: boolean,
  shot?: boolean,
) => THREE.Mesh;
type MatFn = (kind: keyof TexPack, a: number, b: number, r?: number, m?: number) => THREE.Material;

function wallZ(
  box: BoxFn,
  mat: MatFn,
  x: number,
  z0: number,
  z1: number,
  h: number,
  holes: HoleZ[],
  kind: keyof TexPack = "brick",
) {
  const solids = subtract1d(z0, z1, holes.map((h) => [h.z0, h.z1] as [number, number]));
  for (const [a, b] of solids) {
    const z = (a + b) / 2;
    const sz = b - a;
    if (sz < 0.05) continue;
    box(x, h / 2, z, T, h, sz, mat(kind, sz, h));
  }
  for (const hole of holes) {
    if (hole.y0 > 0.05) {
      const sy = hole.y0;
      box(x, sy / 2, (hole.z0 + hole.z1) / 2, T, sy, hole.z1 - hole.z0, mat("brick", hole.z1 - hole.z0, sy));
    }
    if (hole.y1 < h - 0.05) {
      const sy = h - hole.y1;
      box(x, hole.y1 + sy / 2, (hole.z0 + hole.z1) / 2, T, sy, hole.z1 - hole.z0, mat(kind, hole.z1 - hole.z0, sy));
    }
  }
}

function wallX(
  box: BoxFn,
  mat: MatFn,
  z: number,
  x0: number,
  x1: number,
  h: number,
  holes: HoleX[],
  kind: keyof TexPack = "brick",
) {
  const solids = subtract1d(x0, x1, holes.map((h) => [h.x0, h.x1] as [number, number]));
  for (const [a, b] of solids) {
    const x = (a + b) / 2;
    const sx = b - a;
    if (sx < 0.05) continue;
    box(x, h / 2, z, sx, h, T, mat(kind, sx, h));
  }
  for (const hole of holes) {
    if (hole.y0 > 0.05) {
      const sy = hole.y0;
      box((hole.x0 + hole.x1) / 2, sy / 2, z, hole.x1 - hole.x0, sy, T, mat("brick", hole.x1 - hole.x0, sy));
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

/** Max height you can step onto. Stair treads are shorter than this. */
export const STEP_UP = 0.52;
/** Thin walk volumes are floors and stair treads, not walls. */
const WALK_SLAB = 0.4;

function blocksXZ(b: Aabb, y0: number, y1: number) {
  if (y1 < b.min.y || y0 > b.max.y) return false;
  if (b.walk && b.max.y - b.min.y <= WALK_SLAB) return false;
  return true;
}

export function collideXZ(colliders: Aabb[], x: number, z: number, radius: number, y0: number, y1: number) {
  let cx = x;
  let cz = z;
  for (let pass = 0; pass < 4; pass++) {
    for (const b of colliders) {
      if (!blocksXZ(b, y0, y1)) continue;
      const closestX = Math.max(b.min.x, Math.min(cx, b.max.x));
      const closestZ = Math.max(b.min.z, Math.min(cz, b.max.z));
      let dx = cx - closestX;
      let dz = cz - closestZ;
      if (dx === 0 && dz === 0) {
        const left = cx - b.min.x + radius;
        const right = b.max.x - cx + radius;
        const down = cz - b.min.z + radius;
        const up = b.max.z - cz + radius;
        const m = Math.min(left, right, down, up);
        if (m === left) cx = b.min.x - radius;
        else if (m === right) cx = b.max.x + radius;
        else if (m === down) cz = b.min.z - radius;
        else cz = b.max.z + radius;
        continue;
      }
      const dist = Math.hypot(dx, dz);
      if (dist < radius && dist > 0) {
        const n = radius / dist;
        cx = closestX + dx * n;
        cz = closestZ + dz * n;
      }
    }
  }
  return { x: cx, z: cz };
}

export function groundHeight(colliders: Aabb[], x: number, z: number, radius: number, fromY: number) {
  let on = -Infinity;
  let below = -Infinity;
  for (const b of colliders) {
    if (!b.walk) continue;
    if (x + radius < b.min.x || x - radius > b.max.x || z + radius < b.min.z || z - radius > b.max.z)
      continue;
    const top = b.max.y;
    if (top <= fromY + STEP_UP && top > fromY - 0.28) on = Math.max(on, top);
    else if (top < fromY - 0.28) below = Math.max(below, top);
  }
  if (on > -Infinity) return on;
  if (below > -Infinity) return below;
  return 0;
}

export function inSite(world: World, id: Site["id"], x: number, z: number, y: number) {
  const s = world.sites.find((site) => site.id === id);
  if (!s) return false;
  return Math.hypot(x - s.x, z - s.z) < s.r && Math.abs(y - s.y) < 1.8;
}

/** Face the map middle from a spawn so planters/watchers look inward. */
export function spawnYaw(spawn: THREE.Vector3, world: World) {
  const cx = (world.bounds.minX + world.bounds.maxX) * 0.5;
  const cz = (world.bounds.minZ + world.bounds.maxZ) * 0.5;
  return Math.atan2(-(cx - spawn.x), -(cz - spawn.z));
}
