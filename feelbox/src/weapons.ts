import * as THREE from "three";

export type RifleId = "kar" | "mosin";

export const RIFLES: Record<
  RifleId,
  { name: string; mag: number; cycle: number; adsFov: number }
> = {
  kar: { name: "Kar98k", mag: 5, cycle: 0.74, adsFov: 38 },
  mosin: { name: "Mosin", mag: 5, cycle: 0.9, adsFov: 40 },
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
function karLeafRear(root: THREE.Group, z: number, floorY: number, steel: THREE.Material) {
  const earH = 0.007;
  const thick = 0.0028;
  const gap = 0.007;
  place(root, cylY(thick, earH, steel, 6), -gap, floorY + earH * 0.5, z);
  place(root, cylY(thick, earH, steel, 6), gap, floorY + earH * 0.5, z);
  place(root, cylX(thick, gap * 2 + thick, steel, 6), 0, floorY, z);
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

/** Karabiner 98k: round barrel, walnut stock, U rear + post front. */
export function makeKar98(): RifleView {
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

  // U planted on the receiver. Front blade sits on a ramp so it isn't hovering.
  const recTop = axisY + recR;
  const barTop = axisY + barR;
  const uH = 0.007;
  karLeafRear(root, -0.08, recTop, steel);
  const postH = uH * 0.5;
  const postZ = -0.5;
  const rampH = recTop - barTop;
  place(root, cylY(0.0032, rampH, steel, 6), 0, barTop + rampH * 0.5, postZ);
  place(root, cylY(0.0017, postH, steel, 5), 0, recTop + postH * 0.5, postZ);

  const flash = flashMesh(0, axisY, -0.52);
  root.add(flash);
  const { rounds, clip } = makeAmmoKit(root, axisY, "kar", steel);
  const hipPos = new THREE.Vector3(0.17, -0.16, -0.2);
  const adsPos = new THREE.Vector3(0, -(recTop + postH), -0.11);
  root.position.copy(hipPos);
  return { id: "kar", root, flash, hipPos, adsPos, bolt, rounds, clip };
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

/** One open balisong handle: U-channel rails, spacers, pivot knuckles. `z` is half-thickness. */
function baliHandle(parent: THREE.Group, z: number, dark: THREE.Material, accent: THREE.Material) {
  const railW = 0.0054;
  const railT = 0.0056;
  const x = 0.013;
  part(parent, -x, -0.078, z, railW, 0.122, railT, dark);
  part(parent, x, -0.078, z, railW, 0.122, railT, dark);
  for (const sy of [-0.028, -0.074, -0.12]) {
    part(parent, 0, sy, z, x * 2 + 0.003, 0.0085, railT * 0.88, accent);
  }
  part(parent, 0, -0.152, z, 0.033, 0.016, railT * 1.2, dark);
  place(parent, cylZ(0.0056, railT * 1.08, dark, 8), -0.007, 0.004, z);
  place(parent, cylZ(0.0056, railT * 1.08, dark, 8), 0.007, 0.004, z);
}

export function makeKnife(): THREE.Group {
  const root = new THREE.Group();
  const bright = new THREE.MeshStandardMaterial({ color: 0xe4e7ee, roughness: 0.12, metalness: 0.96 });
  const edge = new THREE.MeshStandardMaterial({ color: 0xf7f8fc, roughness: 0.05, metalness: 0.98 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.38, metalness: 0.82 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x4a4e56, roughness: 0.28, metalness: 0.88 });
  const pin = new THREE.MeshStandardMaterial({ color: 0xc5c9d2, roughness: 0.16, metalness: 0.94 });
  const voidMat = new THREE.MeshStandardMaterial({ color: 0x07080a, roughness: 1, metalness: 0 });

  part(root, 0, 0.02, 0, 0.022, 0.032, 0.0042, bright);
  part(root, 0, 0.105, 0, 0.026, 0.14, 0.0036, bright);
  const spear = new THREE.Mesh(new THREE.ConeGeometry(0.0135, 0.09, 6), bright);
  spear.scale.set(1, 1, 0.2);
  spear.position.set(0, 0.218, 0);
  root.add(spear);
  part(root, 0.0122, 0.11, 0, 0.0026, 0.14, 0.004, edge);

  const holeY = 0.062;
  const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.0084, 0.0084, 0.007, 16), voidMat);
  hole.rotation.x = Math.PI / 2;
  hole.position.set(0, holeY, 0);
  root.add(hole);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.0088, 0.0013, 6, 20), pin);
  rim.position.set(0, holeY, 0);
  root.add(rim);

  baliHandle(root, 0.0062, dark, accent);
  baliHandle(root, -0.0062, dark, accent);

  part(root, 0, -0.148, -0.01, 0.016, 0.028, 0.004, accent);
  part(root, 0.011, -0.14, -0.005, 0.018, 0.008, 0.004, accent);

  place(root, cylZ(0.0038, 0.024, pin, 8), -0.007, 0.004, 0);
  place(root, cylZ(0.0038, 0.024, pin, 8), 0.007, 0.004, 0);
  for (const sy of [-0.028, -0.074, -0.12]) {
    place(root, cylZ(0.0018, 0.02, pin, 6), 0, sy, 0);
  }

  root.position.set(0.3, -0.3, -0.22);
  return root;
}

/** First-person right arm: olive sleeve, forearm, skin hand. Parented to the camera. */
export function makeRightArm(): RightArm {
  const root = new THREE.Group();
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
  thumb.rotation.set(0.55, 0.15, 1.05);
  thumb.position.set(0.02, 0.012, 0.008);
  hand.add(thumb);
  root.add(sleeve, forearm, hand);
  root.visible = false;
  return { root, sleeve, forearm, hand };
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
    new THREE.BoxGeometry(id === "kar" ? 0.012 : 0.008, 0.004, id === "kar" ? 0.048 : 0.04),
    steel,
  );
  clip.add(strip);
  for (let i = 0; i < 5; i++) {
    const cr = cylZ(0.0032, 0.028, brass, 6);
    if (id === "kar") cr.position.set(0, 0.008, 0.016 - i * 0.008);
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
  if (view.id === "kar") {
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
  if (id === "kar") {
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
  _target.copy(wrist);
  _shoulder.set(0.2, -0.34, -0.1);
  _pole.set(0.36, -0.44, -0.24);
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
