import * as THREE from "three";
import type { Team } from "../match";
import {
  packLook,
  resolveLook,
  skinFromLook,
  type AccessoryId,
  type Appearance,
  type BeardId,
  type HairId,
  type HatId,
  type PantsId,
  type ShirtId,
  type ShoesId,
} from "../look";
import { makeWorldKar } from "../weapons";

export { parseLook, packLook, resolveLook, lookFor, looksEqual, type Appearance } from "../look";

/** Cylinder body (current). Keep so we can revert from admin. */
export type PawnStyle = "classic" | "limbs";
export type PawnSkin = "rifle" | "field" | "unit" | "frame";

export const SKINS: { id: PawnSkin; label: string; blurb: string }[] = [
  { id: "rifle", label: "Rifle", blurb: "Bowl helm" },
  { id: "field", label: "Field", blurb: "Cap and kit" },
  { id: "unit", label: "Unit", blurb: "Visor chassis" },
  { id: "frame", label: "Frame", blurb: "Box head" },
];

export function parseSkin(raw: unknown): PawnSkin | undefined {
  if (raw === "rifle" || raw === "field" || raw === "unit" || raw === "frame") return raw;
}

export const pawnStyle: { current: PawnStyle } = { current: "limbs" };

export type PawnParts = {
  body: THREE.Mesh;
  head: THREE.Mesh;
  helm: THREE.Mesh;
  rifle: THREE.Object3D;
  cloth: THREE.Mesh[];
  hits: THREE.Mesh[];
  walk?: WalkRig;
};

export type WalkRig = {
  lHip: THREE.Group;
  rHip: THREE.Group;
  lKnee: THREE.Group;
  rKnee: THREE.Group;
};

const EMBER = 0xc44a22;
const STONE = 0x2f6cad;
const BOOT = 0x1c1814;
const STEEL = 0x1c1e18;
const FACE_HEX: Record<Appearance["face"], number> = {
  pale: 0xe0c4a8,
  tan: 0xc4a07a,
  olive: 0x8a6a48,
  umber: 0x5a3a28,
  square: 0xb89268,
};
const HAIR_HEX: Record<HairId, number> = {
  buzz: 0x1a1410,
  crew: 0x2a2018,
  mop: 0x8a6a38,
  fade: 0x1c1814,
  bun: 0x5a2818,
};
const BEARD_HEX = 0x2a2018;
const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

export function teamCloth(team: Team) {
  return team === "ember" ? EMBER : STONE;
}

export function teamHelm(team: Team) {
  return team === "ember" ? 0x8a280c : 0x163a68;
}

export function teamTrim(team: Team) {
  return team === "ember" ? 0xf0a030 : 0x7ec8ff;
}

export type Stance = "stand" | "crouch" | "prone" | "down";

export function skinFor(id?: number): PawnSkin {
  if (id == null) return "rifle";
  return (["rifle", "field", "unit", "frame"] as const)[Math.abs(id) % 4]!;
}

export function setPawnCloth(cloth: THREE.Mesh[], color: number) {
  for (const m of cloth) (m.material as THREE.MeshStandardMaterial).color.set(color);
}

export function buildPawn(root: THREE.Group, team: Team, botId?: number, kit?: PawnSkin | Appearance | string): PawnParts {
  clearGroup(root);
  const look = resolveLook(kit, botId);
  const parts = limbsPawn(team, look);
  stamp(parts, team, botId);
  root.add(parts.body, parts.head, parts.rifle);
  if (!parts.helm.parent) root.add(parts.helm);
  if (parts.walk) root.add(parts.walk.lHip, parts.walk.rHip);
  for (const m of parts.hits) {
    if (!m.parent) root.add(m);
  }
  root.userData.body = parts.body;
  root.userData.bodyRestY = parts.body.position.y;
  root.userData.cloth = parts.cloth;
  root.userData.head = parts.head;
  root.userData.helm = parts.helm;
  root.userData.rifle = parts.rifle;
  root.userData.walk = parts.walk ?? null;
  root.userData.skin = skinFromLook(look);
  root.userData.look = look;
  root.userData.lookId = packLook(look);
  root.userData.team = team;
  if (root.userData.gait == null) root.userData.gait = 0;
  root.userData.walkX = root.position.x;
  root.userData.walkZ = root.position.z;
  return parts;
}

const BODY_REST_Y = 1.18;

export function stepWalkFromPos(root: THREE.Group, x: number, z: number, moving: boolean) {
  const lx = typeof root.userData.walkX === "number" ? root.userData.walkX : x;
  const lz = typeof root.userData.walkZ === "number" ? root.userData.walkZ : z;
  let dist = Math.hypot(x - lx, z - lz);
  root.userData.walkX = x;
  root.userData.walkZ = z;
  if (dist > 1.2) dist = 0;
  dist = Math.min(dist, 0.22);
  stepWalk(root, dist, moving && dist > 0.003);
}

/** Gait advance per metre. Left plant at sin peak (π/2), right at trough (3π/2). */
export const GAIT_PER_DIST = 2.2;
export type Stride = "left" | "right";

export function consumeStride(prev: number, next: number): Stride | null {
  if (!(next > prev)) return null;
  const cycle = Math.PI * 2;
  if (Math.floor((next - Math.PI / 2) / cycle) > Math.floor((prev - Math.PI / 2) / cycle)) return "left";
  if (Math.floor((next - Math.PI * 1.5) / cycle) > Math.floor((prev - Math.PI * 1.5) / cycle)) return "right";
  return null;
}

export function stepWalk(root: THREE.Group, dist: number, moving: boolean) {
  const rig = root.userData.walk as WalkRig | null | undefined;
  if (!rig) return;
  let gait = Number(root.userData.gait) || 0;
  if (moving) gait += dist * GAIT_PER_DIST;
  root.userData.gait = gait;
  poseWalk(rig, gait, moving, root.userData.body instanceof THREE.Mesh ? root.userData.body : undefined);
}

export function setPawnHeldVisible(root: THREE.Object3D, on: boolean) {
  const rifle = root.userData.rifle as THREE.Object3D | undefined;
  if (rifle) rifle.visible = on;
}

export function poseStance(root: THREE.Group, stance: Stance) {
  root.userData.stance = stance;
  const body = root.userData.body instanceof THREE.Mesh ? root.userData.body : undefined;
  const rest = typeof root.userData.bodyRestY === "number" ? root.userData.bodyRestY : BODY_REST_Y;
  const rig = root.userData.walk as WalkRig | null | undefined;
  root.rotation.order = "YXZ";
  const yaw = root.rotation.y;
  if (stance === "down") {
    root.rotation.set(1.25, yaw, 0);
    return;
  }
  if (stance === "prone") {
    root.rotation.set(1.08, yaw, 0);
    if (body) body.position.y = rest;
    if (rig) {
      rig.lHip.rotation.x = 0.18;
      rig.rHip.rotation.x = 0.18;
      rig.lKnee.rotation.x = 0.06;
      rig.rKnee.rotation.x = 0.06;
    }
    return;
  }
  root.rotation.set(0, yaw, 0);
  if (stance === "crouch") {
    if (body) body.position.y = rest - 0.34;
    if (rig) {
      rig.lHip.rotation.x = 0.82 + rig.lHip.rotation.x * 0.28;
      rig.rHip.rotation.x = 0.82 + rig.rHip.rotation.x * 0.28;
      rig.lKnee.rotation.x = -1.12 + rig.lKnee.rotation.x * 0.2;
      rig.rKnee.rotation.x = -1.12 + rig.rKnee.rotation.x * 0.2;
    }
  }
}

function poseWalk(rig: WalkRig, phase: number, moving: boolean, body?: THREE.Mesh) {
  const root = body?.parent;
  const stance = root && typeof (root as THREE.Object3D).userData?.stance === "string" ? (root as THREE.Object3D).userData.stance : "stand";
  if (stance === "prone" || stance === "down") return;
  if (!moving) {
    rig.lHip.rotation.x *= 0.72;
    rig.rHip.rotation.x *= 0.72;
    rig.lKnee.rotation.x *= 0.72;
    rig.rKnee.rotation.x *= 0.72;
    if (body && stance !== "crouch") body.position.y += (BODY_REST_Y - body.position.y) * 0.35;
    return;
  }
  const s = Math.sin(phase);
  rig.lHip.rotation.x = s * 0.58;
  rig.rHip.rotation.x = -s * 0.58;
  rig.lKnee.rotation.x = -0.1 - Math.max(0, -s) * 0.82;
  rig.rKnee.rotation.x = -0.1 - Math.max(0, s) * 0.82;
  if (body) body.position.y = BODY_REST_Y + Math.abs(s) * 0.028;
}

function stamp(parts: PawnParts, team: Team, botId?: number) {
  const mark = (m: THREE.Mesh, part: "body" | "head") => {
    m.castShadow = true;
    if (botId != null) m.userData = { botId, part, team };
  };
  mark(parts.body, "body");
  parts.head.traverse((o) => {
    if (o instanceof THREE.Mesh) mark(o, "head");
  });
  parts.helm.traverse((o) => {
    if (o instanceof THREE.Mesh) mark(o, "head");
  });
  for (const m of parts.hits) mark(m, "body");
}

function classicPawn(team: Team, look: Appearance): PawnParts {
  const color = teamCloth(team);
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.3, 1.38, 10),
    mat(color, 0.85),
  );
  body.position.y = 0.78;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), mat(FACE_HEX[look.face], 0.7));
  head.position.y = 1.68;
  const helm = new THREE.Mesh(
    new THREE.SphereGeometry(0.255, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    mat(teamHelm(team), 0.6, 0.15),
  );
  helm.position.y = 1.74;
  const rifle = makeWorldKar();
  rifle.position.set(0.22, 1.18, -0.3);
  return { body, head, helm, rifle, cloth: [body], hits: [] };
}

type Kit = {
  tunic: THREE.MeshStandardMaterial;
  pants: THREE.MeshStandardMaterial;
  flesh: THREE.MeshStandardMaterial;
  boot: THREE.MeshStandardMaterial;
  helm: THREE.MeshStandardMaterial;
  plate: THREE.MeshStandardMaterial;
  hair: THREE.MeshStandardMaterial;
};

function kitFor(team: Team, look: Appearance): Kit {
  const ember = team === "ember";
  return {
    tunic: mat(teamCloth(team), look.shirt === "parka" ? 0.94 : 0.82),
    pants: mat(ember ? 0x592b1a : 0x203d55, look.pants === "armor" ? 0.62 : 0.9),
    flesh: mat(FACE_HEX[look.face], 0.76),
    boot: shoeMat(look.shoes),
    helm: mat(teamHelm(team), look.hat === "helmet" ? 0.58 : 0.86, look.hat === "helmet" ? 0.18 : 0.03),
    plate: mat(0x252923, 0.76, 0.12),
    hair: mat(HAIR_HEX[look.hair], 0.94),
  };
}

function shoeMat(id: ShoesId) {
  if (id === "sneaker") return mat(0x343936, 0.82);
  if (id === "wrap") return mat(0x51432f, 0.96);
  if (id === "steel") return mat(0x333738, 0.54, 0.35);
  if (id === "bare") return mat(0x9b7656, 0.88);
  return mat(BOOT, 0.96);
}

// STYLE: cs2 operator
function limbsPawn(team: Team, look: Appearance): PawnParts {
  const k = kitFor(team, look);
  const cloth: THREE.Mesh[] = [];
  const hits: THREE.Mesh[] = [];
  const extras: THREE.Mesh[] = [];

  const body = makeShirt(look.shirt, k, team, cloth, extras);
  body.position.y = 1.18;

  const hips = new THREE.Mesh(new THREE.SphereGeometry(0.175, 12, 8), k.pants);
  hips.position.y = 0.91;
  hips.scale.copy(hipScale(look.pants));
  cloth.push(hips);
  hits.push(hips);

  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.065, 0.23), mat(0x211f19, 0.92));
  belt.position.set(0, 0.98, 0);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.045, 0.025), k.plate);
  buckle.position.set(0, 0.98, -0.13);
  extras.push(buckle);

  const lLeg = makeLeg(-1, k, extras, look);
  const rLeg = makeLeg(1, k, extras, look);
  cloth.push(...lLeg.cloth, ...rLeg.cloth);
  hits.push(...lLeg.hits, ...rLeg.hits);

  const shoulderR = look.shirt === "parka" ? 0.112 : 0.102;
  const lShoulder = new THREE.Mesh(new THREE.SphereGeometry(shoulderR, 12, 8), k.tunic);
  lShoulder.position.set(-0.285, 1.365, -0.005);
  lShoulder.scale.set(1.08, 1, 0.94);
  const rShoulder = lShoulder.clone();
  rShoulder.position.x = 0.285;
  cloth.push(lShoulder, rShoulder);
  hits.push(lShoulder, rShoulder);

  const armR = look.shirt === "parka" ? 0.079 : 0.071;
  const bareForearms = look.shirt === "tee" || look.shirt === "vest";
  const lArm = bone(-0.29, 1.35, 0, -0.205, 1.19, -0.13, armR, k.tunic);
  const lFore = bone(-0.205, 1.19, -0.13, 0.015, 1.13, -0.365, armR * 0.82, bareForearms ? k.flesh : k.tunic);
  const rArm = bone(0.29, 1.35, 0, 0.225, 1.18, -0.1, armR, k.tunic);
  const rFore = bone(0.225, 1.18, -0.1, 0.14, 1.105, -0.285, armR * 0.82, bareForearms ? k.flesh : k.tunic);
  cloth.push(lArm, rArm);
  if (!bareForearms) cloth.push(lFore, rFore);
  hits.push(lArm, lFore, rArm, rFore);

  const lHand = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 7), k.flesh);
  lHand.position.set(0.015, 1.13, -0.375);
  lHand.scale.set(0.9, 1.12, 0.82);
  const rHand = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 7), k.flesh);
  rHand.position.set(0.14, 1.105, -0.295);
  rHand.scale.copy(lHand.scale);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.088, 0.13, 12), k.flesh);
  neck.position.set(0, 1.485, 0.005);
  extras.push(neck);

  const head = makeHead(look, k);
  head.position.y = 1.63;
  dressHair(head, look.hair, k);
  dressBeard(head, look.beard, k);
  const helm = dressHat(head, look.hat, k, team, cloth);
  dressAccessory(head, look.accessory, k, team, cloth);

  const rifle = makeWorldKar();
  rifle.position.set(0.12, 1.14, -0.3);
  rifle.rotation.x = 0.06;
  rifle.rotation.y = 0.1;

  return {
    body,
    head,
    helm,
    rifle,
    cloth,
    hits: [...hits, lHand, rHand, belt, ...extras],
    walk: { lHip: lLeg.hip, rHip: rLeg.hip, lKnee: lLeg.knee, rKnee: rLeg.knee },
  };
}

function hipScale(id: PantsId) {
  if (id === "slim") return new THREE.Vector3(1.02, 0.7, 0.82);
  if (id === "shorts") return new THREE.Vector3(1.14, 0.78, 0.94);
  if (id === "wrap") return new THREE.Vector3(1.08, 0.74, 0.9);
  if (id === "armor") return new THREE.Vector3(1.16, 0.82, 0.98);
  return new THREE.Vector3(1.14, 0.76, 0.94);
}

function makeShirt(id: ShirtId, k: Kit, team: Team, cloth: THREE.Mesh[], extras: THREE.Mesh[]) {
  const torsoW = id === "parka" ? 0.255 : id === "plate" ? 0.245 : 0.235;
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(torsoW, 0.19, 0.53, 12), k.tunic);
  torso.scale.z = id === "parka" ? 0.82 : 0.76;
  const body = torso;
  cloth.push(body);

  const heavy = id === "plate" || id === "vest";
  const carrierW = id === "plate" ? 0.43 : id === "vest" ? 0.405 : id === "parka" ? 0.35 : id === "henley" ? 0.36 : 0.34;
  const carrierH = id === "plate" ? 0.36 : id === "vest" ? 0.34 : 0.28;
  const carrierD = heavy ? 0.1 : 0.075;
  const front = new THREE.Mesh(new THREE.BoxGeometry(carrierW, carrierH, carrierD), k.plate);
  front.position.set(0, 1.22, -0.17);
  const back = new THREE.Mesh(new THREE.BoxGeometry(carrierW * 0.94, carrierH * 0.92, 0.065), k.plate);
  back.position.set(0, 1.23, 0.145);
  extras.push(front, back);

  const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.25, 0.055), k.plate);
  strapL.position.set(-carrierW * 0.36, 1.35, -0.145);
  strapL.rotation.z = -0.12;
  const strapR = strapL.clone();
  strapR.position.x *= -1;
  strapR.rotation.z *= -1;
  extras.push(strapL, strapR);

  if (heavy) {
    const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.23, 0.26), k.plate);
    sideL.position.set(-carrierW * 0.54, 1.18, -0.005);
    const sideR = sideL.clone();
    sideR.position.x *= -1;
    extras.push(sideL, sideR);
  }

  const pouchCount = id === "tee" || id === "parka" ? 2 : 3;
  const pouchW = pouchCount === 2 ? 0.135 : 0.105;
  for (let i = 0; i < pouchCount; i++) {
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(pouchW, id === "plate" ? 0.14 : 0.12, 0.075), k.plate);
    pouch.position.set((i - (pouchCount - 1) / 2) * (pouchW + 0.012), 1.09, -0.245);
    pouch.rotation.x = -0.04;
    extras.push(pouch);
  }

  const patch = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.055, 0.018), mat(teamTrim(team), 0.7));
  patch.position.set(0.13, 1.315, -0.224);
  extras.push(patch);

  if (id === "henley") {
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.092, 0.018, 7, 14), k.tunic);
    collar.position.set(0, 1.445, -0.005);
    collar.rotation.x = Math.PI / 2;
    extras.push(collar);
    cloth.push(collar);
  }
  if (id === "parka") {
    const hood = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.035, 7, 14), k.tunic);
    hood.position.set(0, 1.445, 0.035);
    hood.rotation.x = Math.PI / 2;
    hood.scale.z = 1.22;
    extras.push(hood);
    cloth.push(hood);
  }
  if (id === "plate") {
    const shoulderL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.08, 0.14), k.plate);
    shoulderL.position.set(-0.255, 1.405, 0);
    shoulderL.rotation.z = -0.18;
    const shoulderR = shoulderL.clone();
    shoulderR.position.x *= -1;
    shoulderR.rotation.z *= -1;
    extras.push(shoulderL, shoulderR);
  }
  return body;
}

function makeHead(look: Appearance, k: Kit) {
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), k.flesh);
  const faceScale: Record<Appearance["face"], [number, number, number]> = {
    pale: [0.98, 1.08, 0.96],
    tan: [1, 1.06, 0.97],
    olive: [0.96, 1.09, 0.96],
    umber: [1.01, 1.05, 0.98],
    square: [1.07, 1.02, 0.98],
  };
  head.scale.set(...faceScale[look.face]);

  const socketM = mat(0x3a2a21, 0.9);
  const eyeM = mat(0x111313, 0.36);
  for (const x of [-0.058, 0.058]) {
    const socket = ellipsoid(0.028, socketM, 1.25, 0.7, 0.3);
    socket.position.set(x, 0.025, -0.161);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.017, 10, 8), eyeM);
    eye.position.set(x, 0.023, -0.169);
    eye.scale.set(1.08, 0.72, 0.58);
    head.add(socket, eye);
  }

  const browL = bone(-0.105, 0.072, -0.151, -0.02, 0.065, -0.16, 0.015, k.flesh);
  const browR = bone(0.02, 0.065, -0.16, 0.105, 0.072, -0.151, 0.015, k.flesh);
  head.add(browL, browR);

  const nose = ellipsoid(0.04, k.flesh, 0.5, 0.82, 0.62);
  nose.position.set(0, -0.012, -0.169);
  nose.rotation.x = -0.18;
  head.add(nose);

  if (look.face === "square") {
    const jaw = ellipsoid(0.11, k.flesh, 1.18, 0.5, 0.9);
    jaw.position.set(0, -0.11, -0.015);
    head.add(jaw);
  }

  const earL = ellipsoid(0.038, k.flesh, 0.58, 1.08, 0.55);
  earL.position.set(-0.169, -0.005, 0);
  const earR = earL.clone();
  earR.position.x = 0.169;
  head.add(earL, earR);
  return head;
}

function ellipsoid(radius: number, material: THREE.Material, sx: number, sy: number, sz: number) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 9), material);
  mesh.scale.set(sx, sy, sz);
  return mesh;
}

function dressHair(head: THREE.Mesh, id: HairId, k: Kit) {
  const hair = k.hair;
  if (id === "buzz") {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.172, 14, 9, 0, Math.PI * 2, 0, Math.PI * 0.49), hair);
    cap.position.y = 0.012;
    cap.scale.set(1.01, 1.01, 1.01);
    head.add(cap);
    return;
  }
  if (id === "crew") {
    const crop = ellipsoid(0.15, hair, 0.86, 0.48, 0.82);
    crop.position.set(0, 0.12, 0.015);
    const ridge = ellipsoid(0.09, hair, 0.75, 0.43, 0.9);
    ridge.position.set(0, 0.16, -0.01);
    head.add(crop, ridge);
    return;
  }
  if (id === "mop") {
    const crown = ellipsoid(0.16, hair, 1.02, 0.5, 0.98);
    crown.position.set(0, 0.125, 0.015);
    const lockL = ellipsoid(0.065, hair, 0.85, 0.65, 0.75);
    lockL.position.set(-0.075, 0.09, -0.135);
    lockL.rotation.z = 0.2;
    const lockR = lockL.clone();
    lockR.position.x = 0.075;
    lockR.rotation.z = -0.2;
    const rear = ellipsoid(0.1, hair, 1.22, 0.78, 0.55);
    rear.position.set(0, 0.07, 0.135);
    head.add(crown, lockL, lockR, rear);
    return;
  }
  if (id === "fade") {
    const shadow = new THREE.Mesh(new THREE.SphereGeometry(0.168, 14, 9, 0, Math.PI * 2, 0, Math.PI * 0.37), hair);
    shadow.position.y = 0.018;
    const top = ellipsoid(0.115, hair, 0.78, 0.52, 0.82);
    top.position.set(0, 0.155, -0.005);
    head.add(shadow, top);
    return;
  }
  const swept = ellipsoid(0.135, hair, 0.92, 0.42, 0.86);
  swept.position.set(0, 0.13, 0.035);
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 9), hair);
  bun.position.set(0, 0.145, 0.145);
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.009, 6, 12), mat(0x151515, 0.9));
  tie.position.copy(bun.position);
  head.add(swept, bun, tie);
}

function dressBeard(head: THREE.Mesh, id: BeardId, k: Kit) {
  if (id === "none") return;
  const hair = mat(BEARD_HEX, 0.9);
  if (id === "stubble") {
    const jaw = ellipsoid(0.1, hair, 1.18, 0.27, 0.76);
    jaw.position.set(0, -0.115, -0.095);
    head.add(jaw);
    return;
  }
  if (id === "goatee") {
    const lip = ellipsoid(0.055, hair, 0.65, 0.25, 0.5);
    lip.position.set(0, -0.065, -0.157);
    const chin = ellipsoid(0.065, hair, 0.58, 0.92, 0.54);
    chin.position.set(0, -0.145, -0.125);
    head.add(lip, chin);
    return;
  }
  if (id === "full") {
    const jaw = ellipsoid(0.12, hair, 1.12, 0.64, 0.76);
    jaw.position.set(0, -0.13, -0.07);
    const cheekL = ellipsoid(0.07, hair, 0.55, 0.9, 0.62);
    cheekL.position.set(-0.12, -0.065, -0.09);
    const cheekR = cheekL.clone();
    cheekR.position.x = 0.12;
    head.add(jaw, cheekL, cheekR);
    return;
  }
  if (id === "braid") {
    const chin = ellipsoid(0.065, hair, 0.62, 0.7, 0.58);
    chin.position.set(0, -0.145, -0.125);
    const braid = new THREE.Mesh(new THREE.CapsuleGeometry(0.024, 0.12, 4, 8), hair);
    braid.position.set(0, -0.245, -0.12);
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.027, 0.007, 5, 10), k.helm);
    tie.position.set(0, -0.205, -0.12);
    tie.rotation.x = Math.PI / 2;
    head.add(chin, braid, tie);
    return;
  }
  if (id === "stache") {
    const halfL = ellipsoid(0.065, hair, 1.05, 0.3, 0.45);
    halfL.position.set(-0.045, -0.062, -0.158);
    halfL.rotation.z = -0.13;
    const halfR = halfL.clone();
    halfR.position.x = 0.045;
    halfR.rotation.z *= -1;
    head.add(halfL, halfR);
    return;
  }
  if (id === "mutton") {
    const chopL = ellipsoid(0.09, hair, 0.42, 1.04, 0.64);
    chopL.position.set(-0.13, -0.06, -0.055);
    const chopR = chopL.clone();
    chopR.position.x = 0.14;
    head.add(chopL, chopR);
    return;
  }
  if (id === "soul") {
    const patch = ellipsoid(0.038, hair, 0.5, 0.82, 0.4);
    patch.position.set(0, -0.105, -0.163);
    head.add(patch);
    return;
  }
  if (id === "forked") {
    const jaw = ellipsoid(0.11, hair, 1.04, 0.5, 0.68);
    jaw.position.set(0, -0.13, -0.085);
    const tineL = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.09, 4, 8), hair);
    tineL.position.set(-0.047, -0.235, -0.105);
    tineL.rotation.z = 0.1;
    const tineR = tineL.clone();
    tineR.position.x = 0.047;
    tineR.rotation.z *= -1;
    head.add(jaw, tineL, tineR);
    return;
  }
  const brushL = ellipsoid(0.075, hair, 1.05, 0.36, 0.5);
  brushL.position.set(-0.045, -0.065, -0.155);
  brushL.rotation.z = -0.1;
  const brushR = brushL.clone();
  brushR.position.x = 0.045;
  brushR.rotation.z *= -1;
  const chin = ellipsoid(0.085, hair, 0.9, 0.55, 0.58);
  chin.position.set(0, -0.145, -0.12);
  head.add(brushL, brushR, chin);
}

function dressAccessory(head: THREE.Mesh, id: AccessoryId, k: Kit, _team: Team, cloth: THREE.Mesh[]) {
  if (id === "none") return;
  if (id === "glasses") {
    const frame = mat(0x1a1814, 0.35, 0.25);
    const lens = mat(0x29383b, 0.24, 0.35);
    const rimL = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.006, 6, 14), frame);
    rimL.position.set(-0.058, 0.023, -0.177);
    rimL.scale.set(1.16, 0.72, 1);
    const rimR = rimL.clone();
    rimR.position.x = 0.058;
    const glassL = ellipsoid(0.033, lens, 1.2, 0.7, 0.12);
    glassL.position.set(-0.058, 0.023, -0.175);
    const glassR = glassL.clone();
    glassR.position.x = 0.058;
    const bridge = bone(-0.02, 0.025, -0.177, 0.02, 0.025, -0.177, 0.006, frame);
    const armL = bone(-0.098, 0.028, -0.17, -0.15, 0.026, -0.07, 0.005, frame);
    const armR = bone(0.098, 0.028, -0.17, 0.15, 0.026, -0.07, 0.005, frame);
    head.add(bridge, rimL, rimR, glassL, glassR, armL, armR);
    return;
  }
  if (id === "scarf") {
    const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.04, 7, 14), k.tunic);
    wrap.position.set(0, -0.205, 0.015);
    wrap.rotation.x = Math.PI / 2;
    const throat = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.15, 0.035), k.tunic);
    throat.position.set(0, -0.265, -0.095);
    throat.rotation.x = -0.18;
    head.add(wrap, throat);
    cloth.push(wrap, throat);
    return;
  }
  if (id === "earpro") {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.176, 0.014, 6, 16, Math.PI), k.helm);
    band.position.y = 0.005;
    const cupL = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 12), k.helm);
    cupL.position.set(-0.18, 0.005, 0);
    cupL.rotation.z = Math.PI / 2;
    const cupR = cupL.clone();
    cupR.position.x = 0.18;
    const padL = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.009, 6, 12), mat(0x171916, 0.96));
    padL.position.set(-0.151, 0.005, 0);
    padL.rotation.y = Math.PI / 2;
    const padR = padL.clone();
    padR.position.x = 0.151;
    head.add(band, cupL, cupR, padL, padR);
    cloth.push(band, cupL, cupR);
    return;
  }
  if (id === "mask") {
    const coverM = mat(0x292d28, 0.94);
    const cover = ellipsoid(0.1, coverM, 1.2, 0.66, 0.48);
    cover.position.set(0, -0.08, -0.135);
    const seam = bone(-0.065, -0.105, -0.181, 0.065, -0.105, -0.181, 0.006, k.plate);
    const strapL = bone(-0.105, -0.055, -0.13, -0.165, -0.02, -0.025, 0.008, coverM);
    const strapR = bone(0.105, -0.055, -0.13, 0.165, -0.02, -0.025, 0.008, coverM);
    head.add(cover, seam, strapL, strapR);
    return;
  }
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.045, 12), k.helm);
  cup.position.set(-0.181, 0.005, 0.015);
  cup.rotation.z = Math.PI / 2;
  const boom = bone(-0.17, -0.015, -0.015, -0.055, -0.075, -0.15, 0.009, k.plate);
  const mic = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5), k.plate);
  mic.position.set(-0.05, -0.078, -0.154);
  const cable = bone(-0.18, -0.03, 0.02, -0.17, -0.13, 0.045, 0.006, mat(0x111311, 0.98));
  head.add(cup, boom, mic, cable);
  cloth.push(cup);
}

function dressHat(head: THREE.Mesh, id: HatId, k: Kit, team: Team, cloth: THREE.Mesh[]) {
  if (id === "none") {
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.01, 4, 4), k.helm);
    helm.visible = false;
    head.add(helm);
    return helm;
  }
  if (id === "watch") {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.174, 14, 9, 0, Math.PI * 2, 0, Math.PI * 0.52), k.helm);
    cap.position.y = 0.03;
    cap.scale.y = 0.96;
    const roll = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.024, 7, 16), k.helm);
    roll.position.y = 0.018;
    roll.rotation.x = Math.PI / 2;
    cap.add(roll);
    head.add(cap);
    cloth.push(cap, roll);
    return cap;
  }
  if (id === "ushanka") {
    const crown = ellipsoid(0.17, k.helm, 1.04, 0.62, 1);
    crown.position.y = 0.105;
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.025, 7, 14), k.helm);
    band.position.y = 0.02;
    band.rotation.x = Math.PI / 2;
    const flapL = new THREE.Mesh(new THREE.CapsuleGeometry(0.043, 0.085, 4, 8), k.helm);
    flapL.position.set(-0.185, -0.005, 0);
    const flapR = flapL.clone();
    flapR.position.x = 0.185;
    crown.add(band, flapL, flapR);
    head.add(crown);
    cloth.push(crown, band, flapL, flapR);
    return crown;
  }
  if (id === "boonie") {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 9, 0, Math.PI * 2, 0, Math.PI * 0.53), k.helm);
    dome.position.y = 0.035;
    dome.scale.y = 0.92;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.225, 0.018, 16), k.helm);
    brim.position.y = 0.005;
    brim.rotation.z = 0.025;
    dome.add(brim);
    head.add(dome);
    cloth.push(dome, brim);
    return dome;
  }
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.174, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.59), k.helm);
  helm.position.y = 0.035;
  helm.scale.set(1.05, 0.98, 1.08);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.178, 0.014, 7, 18), k.helm);
  rim.position.y = -0.04;
  rim.rotation.x = Math.PI / 2;
  const railL = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.055, 0.11), k.plate);
  railL.position.set(-0.172, 0.015, 0);
  const railR = railL.clone();
  railR.position.x = 0.172;
  const patch = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.04, 0.012), mat(teamTrim(team), 0.68));
  patch.position.set(0, 0.07, -0.166);
  helm.add(rim, railL, railR, patch);
  head.add(helm);
  cloth.push(helm, rim);
  return helm;
}

function makeLeg(side: 1 | -1, k: Kit, extras: THREE.Mesh[], look: Appearance) {
  const hip = new THREE.Group();
  hip.position.set(side * 0.105, 0.9, side > 0 ? -0.012 : 0.012);
  hip.rotation.z = side * 0.025;
  const thighR = look.pants === "slim" ? 0.068 : look.pants === "cargo" ? 0.092 : 0.083;
  const thighLen = 0.395;
  const thigh = bone(0, 0, 0, 0, -thighLen, 0, thighR, k.pants);
  hip.add(thigh);
  const cloth: THREE.Mesh[] = [thigh];
  if (look.pants === "cargo") {
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.14, 0.075), k.pants);
    pouch.position.set(side * 0.083, -0.175, -0.005);
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.108, 0.035, 0.08), k.pants);
    flap.position.set(0, 0.045, -0.006);
    pouch.add(flap);
    hip.add(pouch);
    extras.push(pouch, flap);
    cloth.push(pouch, flap);
  }
  const knee = new THREE.Group();
  knee.position.y = -thighLen;
  hip.add(knee);
  const shinLen = look.pants === "shorts" ? 0.385 : 0.405;
  const shinMat = look.pants === "shorts" ? k.flesh : k.pants;
  const shinR = look.pants === "slim" ? 0.057 : look.pants === "shorts" ? 0.061 : 0.073;
  const shin = bone(0, 0, 0, 0, -shinLen, 0, shinR, shinMat);
  knee.add(shin);
  if (look.pants !== "shorts") cloth.push(shin);
  if (look.pants === "shorts") {
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.086, 0.08, 0.09, 10), k.pants);
    cuff.position.y = -0.035;
    knee.add(cuff);
    extras.push(cuff);
    cloth.push(cuff);
  }
  if (look.pants === "wrap") {
    const puttee = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.076, 0.26, 10), k.pants);
    puttee.position.y = -shinLen * 0.58;
    knee.add(puttee);
    cloth.push(puttee);
  }
  if (look.pants === "armor") {
    const kneePad = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 7), k.plate);
    kneePad.position.set(0, -0.015, -0.07);
    kneePad.scale.set(1.08, 0.78, 0.52);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.2, 0.055), k.plate);
    plate.position.set(0, -shinLen * 0.52, -0.068);
    knee.add(plate);
    knee.add(kneePad);
    extras.push(kneePad, plate);
  }
  const foot = makeShoe(look.shoes, k, shinLen);
  knee.add(foot);
  return { hip, knee, cloth, hits: [thigh, shin, foot] };
}

function makeShoe(id: ShoesId, k: Kit, shinLen: number) {
  const dims: Record<ShoesId, [number, number, number, number]> = {
    boot: [0.145, 0.1, 0.23, -0.08],
    sneaker: [0.14, 0.075, 0.22, -0.075],
    wrap: [0.13, 0.07, 0.2, -0.065],
    steel: [0.155, 0.105, 0.245, -0.085],
    bare: [0.125, 0.055, 0.19, -0.06],
  };
  const [w, h, d, z] = dims[id];
  const foot = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), id === "bare" ? k.flesh : k.boot);
  foot.position.set(0, -shinLen - h / 2, z);
  const sole = new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, 0.022, d * 1.02), mat(0x171815, 0.98));
  sole.position.y = -h * 0.48;
  const heel = new THREE.Mesh(new THREE.BoxGeometry(w * 0.78, id === "sneaker" ? 0.025 : 0.045, d * 0.34), mat(0x131411, 0.98));
  heel.position.set(0, -h * 0.58, d * 0.31);
  foot.add(sole, heel);

  if (id === "wrap") {
    const ankle = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.48, w * 0.52, 0.105, 10), k.boot);
    ankle.position.set(0, 0.07, d * 0.23);
    foot.add(ankle);
  }

  const toeMat = id === "steel" ? k.plate : id === "sneaker" ? mat(0xb7b9ad, 0.84) : id === "bare" ? k.flesh : k.boot;
  const toe = new THREE.Mesh(new THREE.BoxGeometry(w * 0.94, h * 0.78, d * 0.34), toeMat);
  toe.position.set(0, id === "sneaker" ? -0.005 : 0.004, -d * 0.37);
  foot.add(toe);
  foot.castShadow = true;
  return foot;
}

function bone(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  r: number,
  material: THREE.Material,
) {
  _a.set(ax, ay, az);
  _b.set(bx, by, bz);
  const dist = _a.distanceTo(_b);
  const mid = Math.max(0.02, dist - r * 1.6);
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(r, mid, 3, 6), material);
  _mid.addVectors(_a, _b).multiplyScalar(0.5);
  mesh.position.copy(_mid);
  _dir.subVectors(_b, _a);
  if (_dir.lengthSq() > 1e-8) mesh.quaternion.setFromUnitVectors(_up, _dir.normalize());
  mesh.castShadow = true;
  return mesh;
}

function mat(color: number, roughness: number, metalness = 0.04) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function clearGroup(root: THREE.Group) {
  const kids = [...root.children];
  for (const c of kids) {
    root.remove(c);
    c.traverse((obj) => {
      if (obj instanceof THREE.Mesh) obj.geometry.dispose();
    });
  }
}
