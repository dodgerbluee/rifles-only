import * as THREE from "three";
import { makeTextures, surf, type TexPack } from "../textures";
import type { Aabb, Site, World } from "../world";

export type MapId = "wharf" | "cove" | "parish" | "cut";

export type BoxFn = (
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

export type MatFn = (kind: keyof TexPack, a: number, b: number, r?: number, m?: number) => THREE.Material;

export type Kit = {
  root: THREE.Group;
  tex: TexPack;
  colliders: Aabb[];
  shootables: THREE.Object3D[];
  box: BoxFn;
  mat: MatFn;
  gold: THREE.MeshStandardMaterial;
  v: (x: number, z: number, y?: number) => THREE.Vector3;
  siteMarker: (pos: THREE.Vector3, letter: string) => void;
  tree: (x: number, z: number, h?: number) => void;
  lamp: (x: number, z: number, color?: number) => void;
  pad: (x: number, y: number, z: number, sx?: number, sz?: number) => void;
  climb: (
    x: number,
    z: number,
    dir: "+x" | "-x" | "+z" | "-z",
    height: number,
    width?: number,
    startY?: number,
  ) => void;
};

const T = 0.32;

export function makeKit(scene: THREE.Scene): Kit {
  const tex = makeTextures();
  const root = new THREE.Group();
  root.name = "map-root";
  scene.add(root);
  const colliders: Aabb[] = [];
  const shootables: THREE.Object3D[] = [];

  const box: BoxFn = (x, y, z, sx, sy, sz, mat, collide = true, walk = false, shot = true) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
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

  const mat: MatFn = (kind, a, b, r = 0.92, m = 0.04) => surf(tex[kind], a, b, r, m);

  const gold = new THREE.MeshStandardMaterial({
    color: 0xc4a045,
    roughness: 0.42,
    metalness: 0.45,
    emissive: 0x3a2808,
    emissiveIntensity: 0.4,
  });

  const v = (x: number, z: number, y = 0) => new THREE.Vector3(x, y, z);

  const siteMarker = (pos: THREE.Vector3, letter: string) => {
    if (typeof document === "undefined") {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1.2, 1.2),
        new THREE.MeshBasicMaterial({ color: 0xe8d9a8, side: THREE.DoubleSide }),
      );
      mesh.position.copy(pos);
      root.add(mesh);
      return;
    }
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    g.fillStyle = "rgba(16,17,12,0.55)";
    g.beginPath();
    g.arc(64, 64, 58, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#e8d9a8";
    g.font = "bold 72px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(letter, 64, 70);
    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false }));
    sprite.position.copy(pos);
    sprite.scale.set(1.55, 1.55, 1);
    root.add(sprite);
  };

  const tree = (x: number, z: number, h = 4.2) => {
    box(x, 0.7, z, 0.28, 1.4, 0.28, mat("wood", 0.4, 1.2), true, false, true);
    const canopy = mat("leaf", 2, 2, 0.88, 0.02);
    box(x, 1.6 + h * 0.28, z, 1.8, h * 0.45, 1.8, canopy, true, false, true);
    box(x + 0.35, 2.1 + h * 0.22, z - 0.2, 1.3, h * 0.32, 1.3, canopy, false);
  };

  const lamp = (x: number, z: number, color = 0xffd09a) => {
    box(x, 1.6, z, 0.08, 3.2, 0.08, mat("metal", 0.2, 2), true, false, true);
    const light = new THREE.PointLight(color, 10, 11, 1.6);
    light.position.set(x, 3.3, z);
    root.add(light);
  };

  const pad = (x: number, y: number, z: number, sx = 2.4, sz = 2.4) => {
    box(x, y, z, sx, 0.08, sz, gold, true, true, false);
  };

  const climb: Kit["climb"] = (x, z, dir, height, width = 2.2, startY = 0) => {
    const rise = 0.28;
    const run = 0.62;
    const steps = Math.max(2, Math.ceil(height / rise));
    const ax = dir === "+x" ? 1 : dir === "-x" ? -1 : 0;
    const az = dir === "+z" ? 1 : dir === "-z" ? -1 : 0;
    const plank = mat("wood", 1.4, 0.4);
    for (let i = 0; i < steps; i++) {
      const y = startY + (i + 1) * rise;
      const cx = x + ax * (i * run + run * 0.5);
      const cz = z + az * (i * run + run * 0.5);
      const sx = ax !== 0 ? run + 0.12 : width;
      const sz = az !== 0 ? run + 0.12 : width;
      box(cx, y - rise * 0.5, cz, sx, rise, sz, plank, true, true);
    }
  };

  return { root, tex, colliders, shootables, box, mat, gold, v, siteMarker, tree, lamp, pad, climb };
}

export function sky(scene: THREE.Scene, horizon: string, zenith: string) {
  const g = new THREE.SphereGeometry(110, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    fog: false,
    uniforms: {
      uH: { value: new THREE.Color(horizon) },
      uZ: { value: new THREE.Color(zenith) },
    },
    vertexShader: `
      varying vec3 vP;
      void main() {
        vP = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vP;
      uniform vec3 uH;
      uniform vec3 uZ;
      void main() {
        float h = normalize(vP).y;
        vec3 col = mix(uH, uZ, smoothstep(-0.08, 0.62, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = "sky";
  scene.add(mesh);
  return mesh;
}

export function finish(
  kit: Kit,
  opts: {
    id: string;
    title: string;
    blurb: string;
    plantSpawns: THREE.Vector3[];
    watchSpawns: THREE.Vector3[];
    waypoints: THREE.Vector3[][];
    bounds: World["bounds"];
    sites: Site[];
    placeName: (x: number, z: number, y?: number) => string;
  },
): World {
  return {
    id: opts.id,
    title: opts.title,
    blurb: opts.blurb,
    root: kit.root,
    colliders: kit.colliders,
    shootables: kit.shootables,
    playerSpawn: opts.plantSpawns[2]!,
    plantSpawns: opts.plantSpawns,
    watchSpawns: opts.watchSpawns,
    botSpawns: [...opts.plantSpawns, ...opts.watchSpawns],
    waypoints: opts.waypoints,
    bounds: opts.bounds,
    sites: opts.sites,
    placeName: opts.placeName,
  };
}

export { T };
