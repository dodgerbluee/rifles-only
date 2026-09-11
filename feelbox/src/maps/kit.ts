import * as THREE from "three";
import { makeTextures, surf, type TexPack } from "../textures";
import type { Aabb, Site, World } from "../world";

export type MapId = "wharf" | "harbor" | "cove" | "parish" | "cut" | "siding";

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
    tread?: "wood" | "lime",
  ) => void;
  ladder: (
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

  const box: BoxFn = (x, y, z, sx, sy, sz, mat, collide = true, walk = true, shot = true) => {
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

  const climb: Kit["climb"] = (x, z, dir, height, width = 2.2, startY = 0, tread = "wood") => {
    const rise = 0.28;
    const run = 0.155;
    const treadH = 0.1;
    const nosing = 0.1;
    const gap = 0.038;
    const steps = Math.max(2, Math.ceil(height / rise));
    const ax = dir === "+x" ? 1 : dir === "-x" ? -1 : 0;
    const az = dir === "+z" ? 1 : dir === "-z" ? -1 : 0;
    const px = -az;
    const pz = ax;
    const lime = tread === "lime";
    const treadMat = lime ? mat("lime", 1.8, 0.45, 0.88, 0.05) : mat("wood", 1.8, 0.38, 0.82, 0.04);
    const riserMat = lime ? mat("dirt", 0.7, 0.28, 0.96, 0.02) : mat("brick", 0.5, 0.22, 0.95, 0.02);
    const lipMat = lime ? mat("lime", 0.45, 0.18, 0.76, 0.06) : mat("wood", 0.4, 0.18, 0.7, 0.03);
    const railMat = mat("metal", 0.18, 1.1, 0.42, 0.55);

    for (let i = 0; i < steps; i++) {
      const yTop = startY + (i + 1) * rise;
      const along = i * run + run * 0.5 - nosing * 0.5;
      const cx = x + ax * along;
      const cz = z + az * along;
      const depth = run + nosing;
      box(cx, yTop - treadH * 0.5, cz, ax !== 0 ? depth : width, treadH, az !== 0 ? depth : width, treadMat, true, true);

      const lipD = 0.055;
      const lipH = 0.028;
      const lipAlong = i * run - nosing + lipD * 0.5;
      box(
        x + ax * lipAlong,
        yTop + lipH * 0.15,
        z + az * lipAlong,
        ax !== 0 ? lipD : width + 0.02,
        lipH,
        az !== 0 ? lipD : width + 0.02,
        lipMat,
        false,
      );

      const riserD = 0.07;
      const riserH = Math.max(0.08, rise - treadH - gap);
      const rAlong = i * run + riserD * 0.5;
      box(
        x + ax * rAlong,
        yTop - treadH - gap - riserH * 0.5,
        z + az * rAlong,
        ax !== 0 ? riserD : width * 0.94,
        riserH,
        az !== 0 ? riserD : width * 0.94,
        riserMat,
        false,
      );
    }

    const span = steps * run;
    const climbH = steps * rise;
    const angle = Math.atan2(climbH, span);
    const railY = 0.86;
    const postW = 0.05;
    const edge = width * 0.5 - 0.05;
    const postN = Math.max(2, Math.round(steps / 3));
    for (const side of [-1, 1] as const) {
      const ox = px * edge * side;
      const oz = pz * edge * side;
      for (let p = 0; p <= postN; p++) {
        const t = p / postN;
        const along = 0.08 + t * (span - 0.16);
        const foot = startY + t * climbH;
        box(x + ax * along + ox, foot + railY * 0.5, z + az * along + oz, postW, railY, postW, railMat, false);
      }
      const len = Math.hypot(span, climbH) + 0.08;
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(ax !== 0 ? len : postW, 0.042, az !== 0 ? len : postW),
        railMat,
      );
      rail.position.set(x + ax * (span * 0.5) + ox, startY + climbH * 0.5 + railY, z + az * (span * 0.5) + oz);
      if (ax !== 0) rail.rotation.z = ax * angle;
      if (az !== 0) rail.rotation.x = -az * angle;
      rail.castShadow = true;
      rail.receiveShadow = true;
      root.add(rail);
    }
  };

  const ladder: Kit["ladder"] = (x, z, dir, height, width = 1.1, startY = 0) => {
    const rise = 0.3;
    const run = 0.15;
    const treadH = 0.08;
    const steps = Math.max(2, Math.ceil(height / rise));
    const ax = dir === "+x" ? 1 : dir === "-x" ? -1 : 0;
    const az = dir === "+z" ? 1 : dir === "-z" ? -1 : 0;
    const px = -az;
    const pz = ax;
    const treadMat = mat("wood", 1.1, 0.28, 0.82, 0.04);
    const railMat = mat("metal", 0.16, 1.0, 0.4, 0.55);
    for (let i = 0; i < steps; i++) {
      const yTop = startY + (i + 1) * rise;
      const along = i * run + run * 0.5;
      const cx = x + ax * along;
      const cz = z + az * along;
      box(cx, yTop - treadH * 0.5, cz, ax !== 0 ? run : width, treadH, az !== 0 ? run : width, treadMat, true, true);
    }
    const span = steps * run;
    const climbH = steps * rise;
    const edge = width * 0.5 - 0.04;
    for (const side of [-1, 1] as const) {
      const ox = px * edge * side;
      const oz = pz * edge * side;
      box(
        x + ax * (span * 0.5) + ox,
        startY + climbH * 0.5,
        z + az * (span * 0.5) + oz,
        ax !== 0 ? span : 0.05,
        climbH,
        az !== 0 ? span : 0.05,
        railMat,
        false,
      );
    }
  };

  return { root, tex, colliders, shootables, box, mat, gold, v, siteMarker, tree, lamp, pad, climb, ladder };
}

export function sky(scene: THREE.Scene, horizon: string, zenith: string, radius = 110) {
  const g = new THREE.SphereGeometry(radius, 24, 16);
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
    playerSpawn: opts.plantSpawns[2] ?? opts.plantSpawns[0] ?? new THREE.Vector3(),
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
