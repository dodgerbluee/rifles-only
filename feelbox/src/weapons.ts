import * as THREE from "three";
import { makeMelee } from "./knife-variants";
import type { MeleeId } from "./look";

export type RifleId = "kar" | "karscope" | "mosin";

export function isRifleId(id: string): id is RifleId {
  return id === "kar" || id === "karscope" || id === "mosin";
}

export function isMauser(id: RifleId) {
  return id !== "mosin";
}

export function rifleFromWeapon(w: string): RifleId {
  if (w === "mosin") return "mosin";
  if (w === "karscope") return "karscope";
  return "kar";
}

export type RifleSpec = {
  name: string;
  mag: number;
  cycle: number;
  adsFov: number;
  /** Mouse scale while ADS. */
  adsSens: number;
  /** CoD1-style screen glass. Viewmodel hides once the zoom is in. */
  glass: boolean;
};

export const RIFLES: Record<RifleId, RifleSpec> = {
  kar: { name: "Kar98k", mag: 5, cycle: 0.74, adsFov: 52, adsSens: 0.38, glass: false },
  karscope: { name: "Kar98k Scoped", mag: 5, cycle: 0.8, adsFov: 26, adsSens: 0.26, glass: true },
  mosin: { name: "Mosin", mag: 5, cycle: 0.9, adsFov: 40, adsSens: 0.42, glass: false },
};

export type RifleView = {
  id: RifleId;
  root: THREE.Group;
  flash: THREE.Mesh;
  hipPos: THREE.Vector3;
  adsPos: THREE.Vector3;
  bolt: THREE.Group;
  rounds: THREE.Mesh[];
  clip: THREE.Group;
  /** Local points where iron ADS hands wrap the barrel. */
  adsGrip?: { left: THREE.Vector3; right: THREE.Vector3 };
  /** Extra pitch so iron ADS looks down onto the barrel, not down a tube. */
  adsPitch?: number;
};

export type RightArm = {
  root: THREE.Group;
  sleeve: THREE.Mesh;
  forearm: THREE.Mesh;
  hand: THREE.Group;
};

const SKIN = 0xc4a07a;
const SLEEVE = 0x2a3324;
const FOREARM = 0x3a4530;

const _mid = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _yUp = new THREE.Vector3(0, 1, 0);
const _axis = new THREE.Vector3();
const _pole = new THREE.Vector3();
const _elbow = new THREE.Vector3();
const _shoulder = new THREE.Vector3();
const _grip = new THREE.Vector3();
const _knob = new THREE.Vector3();
const _wrist = new THREE.Vector3();
const _target = new THREE.Vector3();
const _q = new THREE.Quaternion();

function part(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  mat: THREE.Material,
) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

function extrude(shape: THREE.Shape, depth: number, mat: THREE.Material, curveSegments = 16) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: depth * 0.12,
    bevelSize: depth * 0.1,
    bevelSegments: 1,
    curveSegments,
  });
  geo.translate(0, 0, -depth / 2);
  return new THREE.Mesh(geo, mat);
}

function place(parent: THREE.Object3D, mesh: THREE.Mesh, x: number, y: number, z: number) {
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

/** Cylinder along local Z (Three's Y-up cylinder, pitched). */
function cylZ(r: number, len: number, mat: THREE.Material, segs = 10) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, segs), mat);
  m.rotation.x = Math.PI / 2;
  return m;
}

/** Open tube along local Z so you can look through it. */
function pipeZ(r: number, len: number, mat: THREE.Material, segs = 8) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, segs, 1, true), mat);
  m.rotation.x = Math.PI / 2;
  return m;
}

function ringZ(inner: number, outer: number, mat: THREE.Material, segs = 8) {
  return new THREE.Mesh(new THREE.RingGeometry(inner, outer, segs), mat);
}

function cylY(r: number, len: number, mat: THREE.Material, segs = 8) {
  return new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, segs), mat);
}

function cylX(r: number, len: number, mat: THREE.Material, segs = 8) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, segs), mat);
  m.rotation.z = Math.PI / 2;
  return m;
}

/** Capsule along local Z. `mid` is the cylindrical span between hemispheres. */
function capZ(r: number, mid: number, mat: THREE.Material, segs = 8) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, mid, 4, segs), mat);
  m.rotation.x = Math.PI / 2;
  return m;
}

function flashMesh(x: number, y: number, z: number) {
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.028, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffcc66 }),
  );
  flash.position.set(x, y, z);
  flash.visible = false;
  return flash;
}

function smooth01(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function cameraOf(obj: THREE.Object3D): THREE.Object3D | null {
  let a: THREE.Object3D | null = obj;
  while (a && !(a instanceof THREE.Camera)) a = a.parent;
  return a;
}

function cameraLocal(obj: THREE.Object3D, x: number, y: number, z: number, out: THREE.Vector3) {
  out.set(x, y, z);
  obj.updateWorldMatrix(true, false);
  obj.localToWorld(out);
  cameraOf(obj)?.worldToLocal(out);
  return out;
}

function alignY(mesh: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3) {
  _mid.addVectors(from, to).multiplyScalar(0.5);
  mesh.position.copy(_mid);
  _dir.subVectors(to, from);
  if (_dir.lengthSq() < 1e-8) return;
  mesh.quaternion.setFromUnitVectors(_yUp, _dir.normalize());
}

/** Kar98k tangent rear: open-top U (two uprights + floor). No hood. */
function karLeafRear(root: THREE.Group, z: number, floorY: number, steel: THREE.Material, earH = 0.009, gap = 0.0052, hipOnly = false) {
  const thick = 0.0028;
  const parts = [
    place(root, cylY(thick, earH, steel, 6), -gap, floorY + earH * 0.5, z),
    place(root, cylY(thick, earH, steel, 6), gap, floorY + earH * 0.5, z),
    place(root, cylX(thick, gap * 2 + thick, steel, 6), 0, floorY, z),
  ];
  if (hipOnly) for (const m of parts) m.userData.karHipBarrel = true;
}

/**
 * Iron rear: option-3 U as a sight block that hugs the receiver.
 * Rounded inner notch, half-height ears and aiming bar. adsPos is unchanged.
 * Inner cutout is 2× the aiming rectangle on each side of the bar.
 */
function karIronRear(root: THREE.Group, z: number, floorY: number, steel: THREE.Material) {
  const earH = 0.026 * 1.85 * 0.6 * 0.5 * 0.5;
  const recW = 0.026;
  const sink = 0.011;
  const bw = recW * 0.5 + 0.0012;
  const barW = 0.003;
  const barH = earH * 0.7;
  const barD = 0.008;
  const depth = 0.018;
  const cutW = barW + 2 * (2 * barW);
  const nw = cutW * 0.5;
  const notchFloor = 0.001;
  const leaf = new THREE.Shape();
  leaf.moveTo(-bw, -sink);
  leaf.lineTo(-bw, earH);
  leaf.lineTo(-nw, earH);
  leaf.quadraticCurveTo(-nw, notchFloor, 0, notchFloor);
  leaf.quadraticCurveTo(nw, notchFloor, nw, earH);
  leaf.lineTo(bw, earH);
  leaf.lineTo(bw, -sink);
  leaf.closePath();
  const geo = new THREE.ExtrudeGeometry(leaf, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.0005,
    bevelSize: 0.0004,
    bevelSegments: 1,
    curveSegments: 8,
  });
  geo.translate(0, 0, -depth / 2);
  const rear = new THREE.Mesh(geo, steel);
  rear.userData.karIronRear = true;
  rear.userData.karIronNotchW = cutW;
  place(root, rear, 0, floorY, z);

  const aimY = floorY + 0.005;
  const barY = Math.min(aimY, floorY + earH - barH * 0.5);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(barW, barH, barD), steel);
  bar.position.set(0, barY, z + 0.001);
  bar.userData.karPoiBar = true;
  root.add(bar);
}

/** ZF39-style tube on the receiver. ADS glass is 2D; this is the hip silhouette. */
function karScope(root: THREE.Group, recTop: number, steel: THREE.Material) {
  const tubeR = 0.0066;
  const tubeLen = 0.15;
  const axisY = recTop + 0.01 + tubeR;
  const midZ = -0.055;
  place(root, cylZ(tubeR, tubeLen, steel, 10), 0, axisY, midZ);
  place(root, cylZ(0.008, 0.018, steel, 10), 0, axisY, midZ + tubeLen * 0.5 + 0.004);
  const ocular = new THREE.Mesh(new THREE.TorusGeometry(0.0042, 0.0011, 8, 16), steel);
  ocular.rotation.x = Math.PI / 2;
  ocular.userData.karOcular = true;
  place(root, ocular, 0, axisY, midZ + tubeLen * 0.5 + 0.012);
  place(root, cylZ(0.0085, 0.02, steel, 10), 0, axisY, midZ - tubeLen * 0.5 - 0.002);
  const obj = new THREE.Mesh(new THREE.TorusGeometry(0.006, 0.0012, 8, 16), steel);
  obj.rotation.x = Math.PI / 2;
  place(root, obj, 0, axisY, midZ - tubeLen * 0.5 - 0.01);
  const mountH = axisY - recTop;
  place(root, cylY(0.0022, mountH, steel, 6), 0, recTop + mountH * 0.5, midZ + 0.04);
  place(root, cylY(0.0022, mountH, steel, 6), 0, recTop + mountH * 0.5, midZ - 0.04);
  return { axisY, ocularZ: ocular.position.z };
}

/**
 * Open-tangent Kar picture: the eye sits over the bolt shroud, not in a tube.
 */
function karIronSight(root: THREE.Group, axisY: number, _steel: THREE.Material) {
  const g = new THREE.Group();
  g.userData.karIronSight = true;
  g.visible = false;
  root.add(g);

  const segs = 8;
  const nearR = 0.039;
  const faceZ = 0.024;
  const eye = 0.1;
  const lookLift = 0.013;
  const blued = new THREE.MeshStandardMaterial({
    color: 0x2a2c26,
    roughness: 0.55,
    metalness: 0.36,
    flatShading: true,
  });
  const worn = new THREE.MeshStandardMaterial({
    color: 0x3c3e36,
    roughness: 0.6,
    metalness: 0.26,
    flatShading: true,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x151613,
    roughness: 0.78,
    metalness: 0.18,
    flatShading: true,
  });
  const skin = new THREE.MeshStandardMaterial({
    color: 0xb08968,
    roughness: 0.78,
    metalness: 0.04,
    flatShading: true,
  });
  const stockMat = new THREE.MeshStandardMaterial({
    color: 0x5a3824,
    roughness: 0.88,
    metalness: 0.02,
    flatShading: true,
  });
  // Broad bolt sleeve and barrel leave the receiver low in the sight picture.
  place(g, cylZ(nearR, 0.05, blued, segs), 0, axisY - 0.012, faceZ - 0.022);
  place(g, cylZ(0.031, 0.035, worn, segs), 0, axisY - 0.012, faceZ - 0.06);
  place(g, cylZ(0.022, 0.18, blued, segs), 0, axisY + 0.002, faceZ - 0.15);

  // Tangent rear: an open notch above the shroud, never a scope ocular.
  const earH = 0.03;
  const earZ = faceZ - 0.005;
  const leftEar = new THREE.Mesh(new THREE.BoxGeometry(0.006, earH, 0.012), worn);
  leftEar.position.set(-0.0065, axisY + nearR - 0.004 + earH * 0.5, earZ);
  g.add(leftEar);
  const rightEar = new THREE.Mesh(new THREE.BoxGeometry(0.006, earH, 0.012), worn);
  rightEar.position.set(0.0065, axisY + nearR - 0.004 + earH * 0.5, earZ);
  g.add(rightEar);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.005, 0.012), blued);
  bar.position.set(0, axisY + nearR - 0.004, earZ);
  g.add(bar);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.019, 0.007), worn);
  blade.position.set(0, axisY + 0.027, faceZ - 0.34);
  g.add(blade);

  const lug = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.018, 0.028), worn);
  lug.position.set(-nearR * 0.65, axisY - nearR * 0.45, faceZ - 0.02);
  g.add(lug);

  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.042, 0.2), stockMat);
  stock.position.set(-0.062, axisY - 0.05, faceZ - 0.02);
  stock.rotation.z = 0.28;
  g.add(stock);

  function wrapHand(side: 1 | -1) {
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 5), skin);
    palm.scale.set(0.85, 1.05, 1.3);
    palm.position.set(side * (nearR + 0.012), axisY + 0.004, faceZ - 0.042);
    g.add(palm);
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.006, 0.015, 2, 5), skin);
    thumb.position.set(side * nearR * 0.82, axisY + nearR * 0.85, faceZ - 0.018);
    thumb.rotation.z = -side * 0.85;
    thumb.rotation.x = 0.25;
    g.add(thumb);
    for (let i = 0; i < 4; i++) {
      const t = i / 3;
      const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.0048, 0.016, 2, 5), skin);
      f.position.set(
        side * (nearR + 0.004 - t * 0.004),
        axisY + nearR * 0.35 - t * 0.008,
        faceZ - 0.028 - t * 0.008,
      );
      f.rotation.z = -side * 0.95;
      f.rotation.x = 0.45;
      g.add(f);
    }
  }
  wrapHand(-1);
  wrapHand(1);

  return {
    axisY,
    faceZ,
    eye,
    lookY: axisY + lookLift,
    pitch: -0.2,
    grip: {
      left: new THREE.Vector3(-nearR - 0.01, axisY, faceZ - 0.04),
      right: new THREE.Vector3(nearR + 0.01, axisY, faceZ - 0.04),
    },
  };
}

function makeBolt(root: THREE.Group, home: THREE.Vector3, knob: THREE.Vector3) {
  const bolt = new THREE.Group();
  bolt.position.copy(home);
  bolt.userData.home = home.clone();
  const tip = new THREE.Object3D();
  tip.position.copy(knob);
  bolt.add(tip);
  bolt.userData.knob = tip;
  root.add(bolt);
  return bolt;
}

function buildKar98(scoped: boolean, world = false): RifleView {
  const root = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x1c1e1a, roughness: 0.3, metalness: 0.7 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.84, metalness: 0.02 });

  const axisY = 0.034;
  const recR = 0.013;
  const barR = 0.0072;
  place(root, capZ(0.028, 0.12, wood), 0, 0.002, 0.18);
  place(root, new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), wood), 0, -0.028, 0.22);
  place(root, capZ(0.02, 0.1, wood), 0, 0.01, 0.04);
  place(root, capZ(0.016, 0.3, wood), 0, 0.012, -0.18);
  place(root, cylZ(recR, 0.14, steel), 0, axisY, -0.02);
  place(root, cylZ(barR, 0.42, steel, 8), 0, axisY, -0.3);

  const bolt = makeBolt(root, new THREE.Vector3(0, axisY, 0.02), new THREE.Vector3(0.056, -0.031, 0));
  place(bolt, cylX(0.005, 0.048, steel, 6), 0.034, 0.004, 0);
  place(bolt, cylY(0.005, 0.034, steel, 6), 0.056, -0.014, 0);

  const recTop = axisY + recR;
  const barTop = axisY + barR;
  const uH = scoped ? 0.007 : 0.01;
  if (scoped) karLeafRear(root, -0.08, recTop, steel, uH, 0.0046);
  else karIronRear(root, -0.08, recTop, steel);
  const postH = uH * 0.5;
  const postZ = -0.5;
  const rampH = recTop - barTop;
  place(root, cylY(0.0032, rampH, steel, 6), 0, barTop + rampH * 0.5, postZ);
  if (scoped) {
    place(root, cylY(0.0017, postH, steel, 5), 0, recTop + postH * 0.5, postZ);
    const wingH = postH + 0.004;
    place(root, cylY(0.0014, wingH, steel, 5), -0.0044, recTop + wingH * 0.35, postZ);
    place(root, cylY(0.0014, wingH, steel, 5), 0.0044, recTop + wingH * 0.35, postZ);
  } else {
    const front = new THREE.Mesh(new THREE.BoxGeometry(0.0022, postH + 0.007, 0.0045), steel);
    front.position.set(0, recTop + postH, postZ);
    front.userData.karIronFront = true;
    root.add(front);
  }

  const hipPos = new THREE.Vector3(0.17, -0.16, -0.2);
  let adsPos = new THREE.Vector3(0, -(recTop + postH), -0.15);
  if (scoped) {
    const scope = karScope(root, recTop, steel);
    adsPos = new THREE.Vector3(0, -scope.axisY, -0.13);
  }

  const flash = flashMesh(0, axisY, -0.52);
  root.add(flash);
  const id: RifleId = scoped ? "karscope" : "kar";
  const { rounds, clip } = makeAmmoKit(root, axisY, id, steel);
  root.position.copy(hipPos);
  return { id, root, flash, hipPos, adsPos, bolt, rounds, clip };
}

/** Karabiner 98k: iron U + post, CoD1 rifle picture. */
export function makeKar98(): RifleView {
  return buildKar98(false);
}

/** Third-person held Kar — same mesh as the iron viewmodel, not a stub or scoped glass. */
export function makeWorldKar() {
  const view = buildKar98(false, true);
  view.flash.visible = false;
  view.clip.visible = false;
  for (const round of view.rounds) round.visible = false;
  const gun = view.root;
  gun.position.set(0, 0, 0);
  gun.rotation.set(0, 0, 0);
  gun.scale.setScalar(1.25);
  gun.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return gun;
}

/** Same rifle with ZF glass. ADS uses the screen overlay. */
export function makeKar98Scoped(): RifleView {
  return buildKar98(true);
}

/** Mosin-Nagant 91/30: barrel meets receiver, small peep you look through. */
export function makeMosin(): RifleView {
  const root = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x22241e, roughness: 0.36, metalness: 0.62 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x3d2816, roughness: 0.88, metalness: 0.02 });

  const axisY = 0.034;
  const recR = 0.013;
  const barR = 0.0074;
  place(root, capZ(0.026, 0.14, wood), 0, 0.004, 0.2);
  place(root, capZ(0.018, 0.12, wood), 0, 0.012, 0.06);
  place(root, capZ(0.015, 0.34, wood), 0, 0.014, -0.16);
  place(root, cylZ(recR, 0.18, steel), 0, axisY, 0.02);
  place(root, cylZ((recR + barR) * 0.5, 0.05, steel, 8), 0, axisY, -0.08);
  place(root, cylZ(barR, 0.5, steel, 8), 0, axisY, -0.32);
  place(root, new THREE.Mesh(new THREE.CapsuleGeometry(0.015, 0.026, 4, 8), wood), 0, -0.014, 0.04);

  const bolt = makeBolt(root, new THREE.Vector3(0, axisY, 0.04), new THREE.Vector3(0.074, 0.006, 0));
  place(bolt, cylX(0.005, 0.068, steel, 6), 0.04, 0.006, 0);

  const recTop = axisY + recR;
  const ringR = 0.0031;
  const tube = 0.00028;
  const ringZ = -0.04;
  const ringY = recTop + ringR;
  place(root, cylY(0.0007, ringR + tube, steel, 6), 0, recTop + (ringR + tube) * 0.5, ringZ);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(ringR, tube, 8, 24), steel);
  ring.renderOrder = 3;
  place(root, ring, 0, ringY, ringZ);

  const flash = flashMesh(0, axisY, -0.58);
  root.add(flash);
  const { rounds, clip } = makeAmmoKit(root, axisY, "mosin", steel);
  const hipPos = new THREE.Vector3(0.17, -0.16, -0.2);
  const adsPos = new THREE.Vector3(0, -ringY, -0.16);
  root.position.copy(hipPos);
  return { id: "mosin", root, flash, hipPos, adsPos, bolt, rounds, clip };
}

/** CS Gargoyle handle: chunky curved D-frame with two oval windows. */
function baliHandle(
  parent: THREE.Group,
  z: number,
  dark: THREE.Material,
  accent: THREE.Material,
  latch: boolean,
) {
  const g = new THREE.Group();
  g.position.z = z;
  parent.add(g);

  const s = new THREE.Shape();
  s.moveTo(-0.019, 0.02);
  s.quadraticCurveTo(-0.016, -0.024, 0.002, -0.072);
  s.quadraticCurveTo(0.018, -0.118, 0.04, -0.16);
  s.quadraticCurveTo(0.058, -0.172, 0.07, -0.152);
  s.quadraticCurveTo(0.056, -0.122, 0.04, -0.078);
  s.quadraticCurveTo(0.024, -0.028, 0.019, 0.02);
  s.lineTo(-0.019, 0.02);
  s.closePath();

  const h1 = new THREE.Path();
  h1.absellipse(0.002, -0.04, 0.0072, 0.026, 0, Math.PI * 2, true, 0.18);
  const h2 = new THREE.Path();
  h2.absellipse(0.03, -0.112, 0.0068, 0.024, 0, Math.PI * 2, true, 0.52);
  s.holes.push(h1, h2);
  g.add(extrude(s, 0.011, dark, 20));

  place(g, cylZ(0.0066, 0.012, dark, 10), -0.006, 0.01, 0);
  place(g, cylZ(0.0066, 0.012, dark, 10), 0.01, 0.008, 0);

  if (latch) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.03, 0.0048), accent);
    arm.position.set(0.052, -0.168, 0);
    arm.rotation.z = 0.55;
    g.add(arm);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.0065, 0.0048), accent);
    bar.position.set(0.064, -0.156, 0);
    bar.rotation.z = -0.2;
    g.add(bar);
  }
}

function knifeBlade(mat: THREE.Material) {
  const s = new THREE.Shape();
  s.moveTo(-0.015, -0.01);
  s.lineTo(0.015, -0.01);
  s.lineTo(0.015, 0.02);
  s.quadraticCurveTo(0.034, 0.07, 0.032, 0.12);
  s.quadraticCurveTo(0.024, 0.172, 0.005, 0.228);
  s.quadraticCurveTo(-0.01, 0.19, -0.016, 0.138);
  s.lineTo(-0.016, 0.02);
  s.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0.046, 0.008, 0, Math.PI * 2, true);
  s.holes.push(hole);
  return extrude(s, 0.0046, mat, 20);
}

export function makeKnife(kind: MeleeId | number = "clip"): THREE.Group {
  return makeMelee(kind);
}

function makeArm(side: 1 | -1): RightArm {
  const root = new THREE.Group();
  root.userData.armSide = side;
  const sleeveMat = new THREE.MeshStandardMaterial({ color: SLEEVE, roughness: 0.9, metalness: 0.04 });
  const forearmMat = new THREE.MeshStandardMaterial({ color: FOREARM, roughness: 0.86, metalness: 0.04 });
  const skinMat = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.7, metalness: 0.05 });

  const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.15, 4, 8), sleeveMat);
  const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.13, 4, 8), forearmMat);
  const hand = new THREE.Group();
  const palm = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.038, 3, 7), skinMat);
  palm.rotation.x = Math.PI / 2;
  palm.position.set(0, 0, 0.01);
  hand.add(palm);
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.028, 3, 6), skinMat);
  thumb.rotation.set(0.55, 0.15 * side, 1.05 * side);
  thumb.position.set(0.02 * side, 0.012, 0.008);
  hand.add(thumb);
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.0065, 0.028, 2, 5), skinMat);
    f.rotation.x = 1.15;
    f.position.set((i - 1.5) * 0.011 * side, -0.004, 0.032);
    hand.add(f);
  }
  root.add(sleeve, forearm, hand);
  root.visible = false;
  return { root, sleeve, forearm, hand };
}

/** First-person right arm: olive sleeve, forearm, skin hand. Parented to the camera. */
export function makeRightArm(): RightArm {
  return makeArm(1);
}

export function makeLeftArm(): RightArm {
  return makeArm(-1);
}

function makeAmmoKit(root: THREE.Group, axisY: number, id: RifleId, steel: THREE.Material) {
  const brass = new THREE.MeshStandardMaterial({ color: 0xb08a3a, roughness: 0.35, metalness: 0.65 });
  const rounds: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const r = cylZ(0.0034, 0.03, brass, 6);
    r.position.set(0.016, axisY + 0.001, 0.012 - i * 0.007);
    root.add(r);
    rounds.push(r);
  }
  const clip = new THREE.Group();
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(isMauser(id) ? 0.012 : 0.008, 0.004, isMauser(id) ? 0.048 : 0.04),
    steel,
  );
  clip.add(strip);
  for (let i = 0; i < 5; i++) {
    const cr = cylZ(0.0032, 0.028, brass, 6);
    if (isMauser(id)) cr.position.set(0, 0.008, 0.016 - i * 0.008);
    else cr.position.set(0, 0.01, 0.014 - i * 0.007);
    clip.add(cr);
  }
  clip.visible = false;
  root.add(clip);
  return { rounds, clip };
}

/**
 * Bolt cycle k=0..1. Closed at both ends.
 * Kar: lift/rotate ~90°, pull +Z, slam home, rotate down.
 * Mosin: straight pull along +Z, handle stays horizontal.
 */
export function poseBolt(view: RifleView, k: number) {
  const bolt = view.bolt;
  const home = bolt.userData.home as THREE.Vector3;
  const t = Math.min(1, Math.max(0, k));
  let lift = 0;
  let pull = 0;
  if (t > 0 && t < 1) {
    if (t < 0.12) {
      lift = 0;
    } else if (t < 0.28) {
      lift = smooth01((t - 0.12) / 0.16);
    } else if (t < 0.5) {
      lift = 1;
      pull = smooth01((t - 0.28) / 0.22);
    } else if (t < 0.58) {
      lift = 1;
      pull = 1;
    } else if (t < 0.8) {
      lift = 1;
      pull = 1 - smooth01((t - 0.58) / 0.22);
    } else {
      lift = 1 - smooth01((t - 0.8) / 0.2);
    }
  }
  bolt.position.copy(home);
  bolt.position.z += (view.id === "mosin" ? 0.062 : 0.05) * pull;
  bolt.rotation.set(0, 0, view.id === "mosin" ? 0 : lift * (Math.PI / 2));
}

/** Stripper in, rounds fill, bolt works. k=0 start, 1 done. */
export function poseAmmo(view: RifleView, mag: number, magMax: number, reloadK = 0) {
  const k = Math.min(1, Math.max(0, reloadK));
  let shown = mag;
  if (k > 0.32) {
    const fill = Math.min(1, (k - 0.32) / 0.36);
    shown = mag + Math.round((magMax - mag) * fill);
  }
  for (let i = 0; i < view.rounds.length; i++) view.rounds[i]!.visible = i < shown;

  const clip = view.clip;
  if (k <= 0.1 || k >= 0.78) {
    clip.visible = false;
    return;
  }
  clip.visible = true;
  const u = smooth01((k - 0.12) / 0.42);
  if (isMauser(view.id)) {
    clip.position.set(0.09 * (1 - u), 0.055 * (1 - u) + 0.012, 0.01);
    clip.rotation.set(0.35 * (1 - u), 0.15 * (1 - u), 0.55 * (1 - u));
  } else {
    clip.position.set(0, 0.11 * (1 - u) + 0.018, 0.028);
    clip.rotation.set(-0.4 * (1 - u), 0, 0);
  }
}

export function reloadBoltK(k: number) {
  const t = Math.min(1, Math.max(0, k));
  if (t < 0.2) return (t / 0.2) * 0.5;
  if (t < 0.72) return 0.5;
  return 0.5 + ((t - 0.72) / 0.28) * 0.5;
}

export function applyReloadPose(root: THREE.Group, id: RifleId, k: number) {
  const t = Math.min(1, Math.max(0, k));
  if (isMauser(id)) {
    const dip = t < 0.58 ? Math.sin((t / 0.58) * Math.PI) : 0;
    root.position.x += dip * 0.035;
    root.position.y -= dip * 0.045;
    root.rotation.z += dip * 0.38;
    root.rotation.x += dip * 0.1;
  } else {
    const dip = t < 0.62 ? Math.sin((t / 0.62) * Math.PI) : 0;
    root.position.y -= dip * 0.02;
    root.position.z += dip * 0.055;
    root.rotation.x -= dip * 0.32;
    root.rotation.y += dip * 0.06;
  }
}

/**
 * Overhand toss along -Z. k=0 hold, cocks back, snaps forward.
 * Pass `drop` for a shorter downward flick. Hides the nade near the end.
 */
export function poseThrow(nade: THREE.Group, k: number, drop = false) {
  const t = Math.min(1, Math.max(0, k));
  if (drop) {
    const e = smooth01(t);
    nade.position.set(0.2 + e * 0.04, -0.2 - e * 0.2, -0.38 - e * 0.16);
    nade.rotation.set(0.2 + e * 0.85, 0.08, 0.22);
    nade.visible = t < 0.72;
    return;
  }
  const cock = t < 0.28 ? smooth01(t / 0.28) : 1 - smooth01((t - 0.28) / 0.22);
  const snap = t < 0.26 ? 0 : smooth01((t - 0.26) / 0.42);
  nade.position.set(0.2 + snap * 0.02, -0.16 + cock * 0.1 - snap * 0.04, -0.34 + cock * 0.14 - snap * 0.52);
  nade.rotation.set(0.15 + cock * 0.45 - snap * 1.25, 0.12, 0.28 - snap * 0.45);
  nade.visible = t < 0.7;
}

export function poseKnifeRest(knife: THREE.Group) {
  knife.rotation.set(0.08, 0.42, -0.12);
  knife.position.set(0.3, -0.28, -0.2);
}

/** Horizontal / diagonal cut across the camera. k=0..1. */
export function poseKnifeSlash(knife: THREE.Group, k: number) {
  const e = smooth01(k);
  const lift = Math.sin(k * Math.PI);
  knife.position.set(0.34 - e * 0.68, -0.16 + lift * 0.12, -0.18 - lift * 0.06);
  knife.rotation.set(0.08 + e * 0.35, 0.42 - e * 1.4, -0.12 + e * 1.35);
}

export function rifleWrist(view: RifleView, boltK: number, out = _wrist) {
  cameraLocal(view.root, 0.038, -0.034, 0.15, _grip);
  const follow = boltFollow(boltK);
  if (follow <= 0) return out.copy(_grip);
  const tip = view.bolt.userData.knob as THREE.Object3D;
  cameraLocal(tip, 0.018, -0.012, 0.004, _knob);
  return out.copy(_grip).lerp(_knob, follow);
}

export function poseAdsMask(view: RifleView, on: boolean) {
  void view;
  void on;
}

/** Palm on the left or right of the iron barrel. */
export function adsWrist(view: RifleView, side: 1 | -1, out = _wrist) {
  const grip = view.adsGrip;
  if (!grip) return rifleWrist(view, 0, out);
  const p = side < 0 ? grip.left : grip.right;
  return cameraLocal(view.root, p.x, p.y, p.z, out);
}

export function knifeWrist(knife: THREE.Group, out = _wrist) {
  return cameraLocal(knife, 0, -0.09, 0.01, out);
}

export function nadeWrist(nade: THREE.Group, out = _wrist) {
  return cameraLocal(nade, 0.02, -0.01, 0.02, out);
}

function boltFollow(k: number) {
  if (k <= 0.1 || k >= 0.94) return 0;
  if (k < 0.26) return smooth01((k - 0.1) / 0.16);
  if (k < 0.8) return 1;
  return 1 - smooth01((k - 0.8) / 0.14);
}

/** Two-bone IK so the palm sits at camera-local `wrist`. */
export function poseArm(arm: RightArm, wrist: THREE.Vector3, roll = 0) {
  const side = (arm.root.userData.armSide as number) || 1;
  _target.copy(wrist);
  _shoulder.set(0.2 * side, -0.34, -0.1);
  _pole.set(0.36 * side, -0.44, -0.24);
  const lenA = 0.2;
  const lenB = 0.18;
  _dir.subVectors(_target, _shoulder);
  let dist = _dir.length();
  if (dist < 1e-4) dist = 1e-4;
  const reach = lenA + lenB - 0.012;
  if (dist > reach) {
    _dir.multiplyScalar(reach / dist);
    _elbow.copy(_shoulder).addScaledVector(_dir, lenA);
    _target.copy(_shoulder).add(_dir);
  } else {
    const cosA = THREE.MathUtils.clamp((lenA * lenA + dist * dist - lenB * lenB) / (2 * lenA * dist), -1, 1);
    const ang = Math.acos(cosA);
    _dir.multiplyScalar(1 / dist);
    _pole.sub(_shoulder);
    _axis.crossVectors(_dir, _pole);
    if (_axis.lengthSq() < 1e-6) _axis.set(0, 0, 1);
    else _axis.normalize();
    _q.setFromAxisAngle(_axis, ang);
    _elbow.copy(_dir).applyQuaternion(_q).multiplyScalar(lenA).add(_shoulder);
  }
  alignY(arm.sleeve, _shoulder, _elbow);
  alignY(arm.forearm, _elbow, _target);
  arm.hand.position.copy(_target);
  arm.hand.quaternion.copy(arm.forearm.quaternion);
  arm.hand.rotateX(1.15);
  arm.hand.rotateZ(roll);
}
