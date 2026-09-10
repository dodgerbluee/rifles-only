import * as THREE from "three";
import { MELEES, type MeleeId } from "./look";

export type KnifeKind = {
  id: MeleeId;
  name: string;
  blurb: string;
  build: () => THREE.Group;
};

type Kit = {
  steel: THREE.MeshStandardMaterial;
  bright: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  darkWood: THREE.MeshStandardMaterial;
  wrap: THREE.MeshStandardMaterial;
  brass: THREE.MeshStandardMaterial;
  cord: THREE.MeshStandardMaterial;
};

function mat(color: number, roughness: number, metalness: number) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function kit(): Kit {
  return {
    steel: mat(0xd0d4dc, 0.2, 0.78),
    bright: mat(0xf2f4f8, 0.08, 0.88),
    dark: mat(0x1c1e1a, 0.32, 0.7),
    wood: mat(0x6b4226, 0.84, 0.02),
    darkWood: mat(0x3d2816, 0.88, 0.02),
    wrap: mat(0x2a2418, 0.92, 0.03),
    brass: mat(0xb08a3a, 0.35, 0.65),
    cord: mat(0x8a7a54, 0.85, 0.04),
  };
}

function part(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  material: THREE.Material,
) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

function place(parent: THREE.Object3D, mesh: THREE.Mesh, x: number, y: number, z: number) {
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function extrude(shape: THREE.Shape, depth: number, material: THREE.Material, curveSegments = 16) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: depth * 0.14,
    bevelSize: depth * 0.12,
    bevelSegments: 1,
    curveSegments,
  });
  geo.translate(0, 0, -depth / 2);
  return new THREE.Mesh(geo, material);
}

function cylZ(r: number, len: number, material: THREE.Material, segs = 10) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, segs), material);
  m.rotation.x = Math.PI / 2;
  return m;
}

function cylY(r: number, len: number, material: THREE.Material, segs = 8) {
  return new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, segs), material);
}

function capY(r: number, mid: number, material: THREE.Material, segs = 8) {
  return new THREE.Mesh(new THREE.CapsuleGeometry(r, mid, 4, segs), material);
}

function rivets(parent: THREE.Object3D, ys: number[], material: THREE.Material, x = 0, z = 0.012) {
  for (const y of ys) {
    place(parent, cylZ(0.0028, 0.028, material, 6), x, y, z);
  }
}

function wrapBands(
  parent: THREE.Object3D,
  y0: number,
  y1: number,
  count: number,
  material: THREE.Material,
  rx: number,
  rz: number,
) {
  for (let i = 0; i < count; i++) {
    const y = y0 + ((i + 0.5) / count) * (y1 - y0);
    part(parent, 0, y, 0, rx * 2.12, 0.0055, rz * 2.12, material);
  }
}

function clipUtility(): THREE.Group {
  const root = new THREE.Group();
  const k = kit();
  const s = new THREE.Shape();
  s.moveTo(-0.008, 0.002);
  s.lineTo(0.018, 0.002);
  s.lineTo(0.02, 0.11);
  s.lineTo(0.006, 0.162);
  s.lineTo(-0.002, 0.172);
  s.quadraticCurveTo(-0.026, 0.1, -0.022, 0.038);
  s.lineTo(-0.01, 0.002);
  s.closePath();
  root.add(extrude(s, 0.0062, k.steel, 12));
  part(root, -0.016, 0.05, 0, 0.004, 0.08, 0.002, k.bright);

  part(root, 0, 0.004, 0, 0.034, 0.01, 0.016, k.brass);
  part(root, 0.02, 0.004, 0, 0.012, 0.006, 0.01, k.brass);
  place(root, capY(0.011, 0.072, k.wood, 8), 0, -0.05, 0);
  wrapBands(root, -0.078, -0.022, 4, k.wrap, 0.011, 0.011);
  part(root, 0, -0.098, 0, 0.022, 0.016, 0.02, k.dark);
  rivets(root, [-0.04, -0.068], k.brass);
  return root;
}

function karBayonet(): THREE.Group {
  const root = new THREE.Group();
  const k = kit();
  k.wood.color.set(0x5a3820);
  const s = new THREE.Shape();
  s.moveTo(-0.012, 0.004);
  s.lineTo(0.012, 0.004);
  s.lineTo(0.014, 0.2);
  s.lineTo(0, 0.31);
  s.lineTo(-0.014, 0.2);
  s.closePath();
  root.add(extrude(s, 0.0052, k.steel, 10));
  part(root, 0, 0.14, 0.0014, 0.004, 0.16, 0.0012, k.dark);

  part(root, 0, 0.006, 0, 0.072, 0.01, 0.014, k.dark);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0032, 8, 18), k.dark);
  ring.rotation.y = Math.PI / 2;
  place(root, ring, 0.028, 0.006, 0);
  place(root, cylY(0.012, 0.11, k.wood, 8), 0, -0.062, 0);
  place(root, cylY(0.013, 0.016, k.dark, 8), 0, -0.004, 0);
  place(root, cylY(0.014, 0.02, k.dark, 8), 0, -0.122, 0);
  part(root, 0, -0.136, 0, 0.02, 0.01, 0.02, k.steel);
  return root;
}

function kukri(): THREE.Group {
  const root = new THREE.Group();
  const k = kit();
  const s = new THREE.Shape();
  s.moveTo(0.008, 0.002);
  s.lineTo(0.02, 0.036);
  s.quadraticCurveTo(0.048, 0.11, 0.07, 0.155);
  s.lineTo(0.052, 0.198);
  s.lineTo(0.026, 0.205);
  s.quadraticCurveTo(0.084, 0.118, 0.018, 0.052);
  s.lineTo(-0.006, 0.03);
  s.lineTo(0.01, 0.02);
  s.lineTo(0.002, 0.002);
  s.closePath();
  root.add(extrude(s, 0.0062, k.steel, 18));
  part(root, 0.038, 0.12, 0.0022, 0.028, 0.07, 0.002, k.dark);

  place(root, capY(0.013, 0.07, k.darkWood, 8), 0.004, -0.052, 0);
  const flare = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.028, 0.024), k.darkWood);
  flare.position.set(0.002, -0.098, 0);
  flare.rotation.z = 0.18;
  root.add(flare);
  part(root, 0.004, -0.008, 0, 0.024, 0.014, 0.02, k.brass);
  part(root, 0.002, -0.116, 0, 0.026, 0.014, 0.022, k.brass);
  rivets(root, [-0.036, -0.062, -0.086], k.brass, 0.004);
  return root;
}

function fairbairn(): THREE.Group {
  const root = new THREE.Group();
  const k = kit();
  const s = new THREE.Shape();
  s.moveTo(-0.004, 0.002);
  s.lineTo(0.004, 0.002);
  s.lineTo(0.009, 0.1);
  s.lineTo(0, 0.258);
  s.lineTo(-0.009, 0.1);
  s.closePath();
  root.add(extrude(s, 0.0036, k.bright, 8));
  part(root, 0, 0.12, 0.0012, 0.003, 0.14, 0.001, k.steel);

  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.007, 0.012), k.dark);
  guard.position.set(0, 0.004, 0);
  guard.rotation.z = 0.22;
  root.add(guard);
  const hook = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.007, 0.012), k.dark);
  hook.position.set(-0.03, 0.012, 0);
  hook.rotation.z = 0.9;
  root.add(hook);
  place(root, capY(0.0085, 0.078, k.wrap, 8), 0, -0.052, 0);
  wrapBands(root, -0.086, -0.018, 6, k.cord, 0.0085, 0.0085);
  place(root, new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 8), k.dark), 0, -0.104, 0);
  return root;
}

function cleaver(): THREE.Group {
  const root = new THREE.Group();
  const k = kit();
  const s = new THREE.Shape();
  s.moveTo(-0.02, 0.002);
  s.lineTo(0.068, 0.002);
  s.lineTo(0.074, 0.15);
  s.lineTo(0.052, 0.178);
  s.lineTo(-0.02, 0.168);
  s.closePath();
  const hole = new THREE.Path();
  hole.absarc(0.052, 0.128, 0.012, 0, Math.PI * 2, true);
  s.holes.push(hole);
  root.add(extrude(s, 0.0072, k.steel, 10));
  part(root, 0.028, 0.162, 0, 0.09, 0.012, 0.008, k.dark);

  part(root, 0.004, 0.006, 0, 0.036, 0.022, 0.022, k.dark);
  place(root, capY(0.014, 0.055, k.wood, 8), 0.002, -0.05, 0);
  part(root, 0.002, -0.088, 0, 0.026, 0.016, 0.022, k.darkWood);
  rivets(root, [-0.032, -0.056, -0.076], k.dark, 0.002);
  return root;
}

function tanto(): THREE.Group {
  const root = new THREE.Group();
  const k = kit();
  const s = new THREE.Shape();
  s.moveTo(-0.012, 0.002);
  s.lineTo(0.015, 0.002);
  s.lineTo(0.016, 0.142);
  s.lineTo(0.002, 0.188);
  s.lineTo(-0.012, 0.138);
  s.closePath();
  root.add(extrude(s, 0.0056, k.steel, 6));
  part(root, 0.002, 0.138, 0, 0.028, 0.003, 0.006, k.bright);

  part(root, 0, 0.006, 0, 0.042, 0.008, 0.02, k.dark);
  part(root, 0, 0.006, 0, 0.008, 0.028, 0.02, k.dark);
  place(root, new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.088, 0.016), k.wrap), 0, -0.05, 0);
  wrapBands(root, -0.09, -0.012, 7, k.cord, 0.01, 0.008);
  const kashira = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.02, 0.02), k.dark);
  kashira.position.set(0, -0.104, 0);
  kashira.rotation.z = 0.12;
  root.add(kashira);
  return root;
}

function karambit(): THREE.Group {
  const root = new THREE.Group();
  const k = kit();
  const s = new THREE.Shape();
  s.moveTo(0.006, 0.002);
  s.quadraticCurveTo(0.055, 0.018, 0.088, 0.068);
  s.quadraticCurveTo(0.082, 0.118, 0.042, 0.128);
  s.quadraticCurveTo(0.07, 0.082, 0.038, 0.038);
  s.lineTo(0.004, 0.014);
  s.closePath();
  root.add(extrude(s, 0.0044, k.steel, 20));
  part(root, 0.018, 0.01, 0, 0.02, 0.01, 0.012, k.dark);

  place(root, capY(0.009, 0.042, k.wrap, 8), 0, -0.034, 0);
  wrapBands(root, -0.054, -0.014, 3, k.cord, 0.009, 0.009);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0042, 8, 18), k.dark);
  place(root, ring, 0, -0.078, 0);
  part(root, -0.014, -0.008, 0, 0.012, 0.01, 0.01, k.dark);
  return root;
}

function machete(): THREE.Group {
  const root = new THREE.Group();
  const k = kit();
  k.wood.color.set(0x7a4a24);
  const s = new THREE.Shape();
  s.moveTo(-0.016, 0.002);
  s.lineTo(0.024, 0.002);
  s.lineTo(0.03, 0.21);
  s.lineTo(0.01, 0.318);
  s.lineTo(-0.018, 0.285);
  s.lineTo(-0.02, 0.036);
  s.closePath();
  root.add(extrude(s, 0.0048, k.steel, 10));
  part(root, 0.006, 0.28, 0.0016, 0.02, 0.05, 0.0014, k.bright);

  part(root, 0, 0.004, 0, 0.03, 0.012, 0.016, k.dark);
  place(root, new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.1, 0.02), k.wood), 0, -0.058, 0);
  rivets(root, [-0.028, -0.052, -0.078], k.steel);
  part(root, 0, -0.112, 0, 0.026, 0.012, 0.02, k.darkWood);
  return root;
}

function trenchSpike(): THREE.Group {
  const root = new THREE.Group();
  const k = kit();
  const spike = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.26, 3), k.steel);
  spike.position.set(0, 0.14, 0);
  root.add(spike);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.014, 0.028, 3), k.dark);
  neck.position.set(0, 0.02, 0);
  root.add(neck);

  part(root, 0, 0.004, 0, 0.028, 0.012, 0.018, k.dark);
  part(root, 0.03, -0.05, 0, 0.01, 0.112, 0.016, k.dark);
  part(root, 0.016, 0.01, 0, 0.04, 0.01, 0.016, k.dark);
  part(root, 0.016, -0.11, 0, 0.04, 0.01, 0.016, k.dark);
  part(root, 0.022, -0.028, 0, 0.008, 0.008, 0.014, k.steel);
  part(root, 0.022, -0.056, 0, 0.008, 0.008, 0.014, k.steel);
  part(root, 0.022, -0.084, 0, 0.008, 0.008, 0.014, k.steel);
  place(root, cylY(0.011, 0.09, k.wrap, 8), 0, -0.056, 0);
  wrapBands(root, -0.092, -0.02, 4, k.dark, 0.011, 0.011);
  const crush = new THREE.Mesh(new THREE.ConeGeometry(0.01, 0.028, 4), k.dark);
  crush.rotation.x = Math.PI;
  place(root, crush, 0, -0.118, 0);
  return root;
}

function pocketFolder(): THREE.Group {
  const root = new THREE.Group();
  const k = kit();
  k.wood.color.set(0x4a3018);
  const s = new THREE.Shape();
  s.moveTo(-0.004, 0.008);
  s.lineTo(0.012, 0.008);
  s.lineTo(0.013, 0.1);
  s.lineTo(0.004, 0.148);
  s.lineTo(0, 0.156);
  s.quadraticCurveTo(-0.016, 0.1, -0.013, 0.04);
  s.lineTo(-0.006, 0.008);
  s.closePath();
  const nick = new THREE.Path();
  nick.absarc(-0.002, 0.072, 0.006, 0, Math.PI * 2, true);
  s.holes.push(nick);
  root.add(extrude(s, 0.0038, k.steel, 12));

  place(root, new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.118, 0.008), k.wood), 0, -0.052, 0.008);
  place(root, new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.118, 0.008), k.wood), 0, -0.052, -0.008);
  place(root, new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.112, 0.006), k.dark), 0, -0.05, 0);
  place(root, cylZ(0.006, 0.028, k.steel, 10), 0, 0.004, 0);
  place(root, cylZ(0.0032, 0.03, k.bright, 8), 0, 0.004, 0);
  const clip = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.07, 0.0024), k.steel);
  clip.position.set(0.012, -0.062, -0.014);
  root.add(clip);
  part(root, 0, -0.108, 0, 0.024, 0.012, 0.02, k.dark);
  rivets(root, [-0.036, -0.072], k.steel, 0, 0.014);
  return root;
}

function baseballBat(): THREE.Group {
  const root = new THREE.Group();
  const k = kit();
  k.wood.color.set(0x8a5a2a);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.014, 0.2, 10), k.wood);
  barrel.position.set(0, 0.14, 0);
  root.add(barrel);
  const belly = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.026, 0.07, 10), k.wood);
  belly.position.set(0, 0.268, 0);
  root.add(belly);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), k.wood);
  tip.position.set(0, 0.308, 0);
  root.add(tip);
  place(root, cylY(0.01, 0.036, k.darkWood, 8), 0, 0.022, 0);
  place(root, cylY(0.009, 0.07, k.darkWood, 8), 0, -0.03, 0);
  wrapBands(root, -0.06, 0.002, 5, k.wrap, 0.0095, 0.0095);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 8), k.darkWood);
  knob.scale.set(1, 0.72, 1);
  place(root, knob, 0, -0.078, 0);
  place(root, cylY(0.007, 0.012, k.dark, 8), 0, -0.066, 0);
  return root;
}

const BUILDS: Record<MeleeId, () => THREE.Group> = {
  clip: clipUtility,
  bayonet: karBayonet,
  kukri,
  fairbairn,
  cleaver,
  tanto,
  karambit,
  machete,
  spike: trenchSpike,
  folder: pocketFolder,
  bat: baseballBat,
};

const MELEE_NAMES: Record<MeleeId, string> = {
  clip: "Clip Utility",
  bayonet: "Kar Bayonet",
  kukri: "Kukri",
  fairbairn: "Fairbairn",
  cleaver: "Cleaver",
  tanto: "Tanto",
  karambit: "Karambit",
  machete: "Machete",
  spike: "Trench Spike",
  folder: "Pocket Folder",
  bat: "Baseball Bat",
};

export const KNIFE_KINDS: KnifeKind[] = MELEES.map((m) => ({
  id: m.id,
  name: MELEE_NAMES[m.id],
  blurb: m.blurb,
  build: BUILDS[m.id],
}));

export function makeMelee(id: MeleeId | number = "clip"): THREE.Group {
  const kind =
    typeof id === "number"
      ? MELEES[((id % MELEES.length) + MELEES.length) % MELEES.length]!.id
      : MELEES.some((o) => o.id === id)
        ? id
        : "clip";
  const root = BUILDS[kind]();
  root.name = kind;
  root.userData.melee = kind;
  return root;
}

export function makeKnifeVariant(index: number): THREE.Group {
  return makeMelee(index);
}
