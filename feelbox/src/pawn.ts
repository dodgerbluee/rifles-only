import * as THREE from "three";
import type { Team } from "./match";
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
} from "./look";
import { makeWorldKar } from "./weapons";

export { parseLook, packLook, resolveLook, lookFor, looksEqual, type Appearance } from "./look";

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
  const parts = pawnStyle.current === "classic" ? classicPawn(team, look) : limbsPawn(team, look);
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
  const plate = look.shirt === "plate";
  return {
    tunic: mat(teamCloth(team), plate ? 0.42 : 0.82, plate ? 0.45 : 0.04),
    pants: mat(ember ? 0x5a2410 : 0x1a3a58, look.pants === "armor" ? 0.4 : 0.9, look.pants === "armor" ? 0.45 : 0.04),
    flesh: mat(FACE_HEX[look.face], 0.72),
    boot: shoeMat(look.shoes),
    helm: mat(teamHelm(team), look.hat === "helmet" ? 0.5 : 0.72, look.hat === "helmet" ? 0.22 : 0.06),
    plate: mat(STEEL, 0.48, 0.35),
    hair: mat(HAIR_HEX[look.hair], 0.88),
  };
}

function shoeMat(id: ShoesId) {
  if (id === "sneaker") return mat(0x3a342c, 0.78);
  if (id === "wrap") return mat(0x4a3a28, 0.9);
  if (id === "steel") return mat(0x4a4e52, 0.38, 0.62);
  if (id === "bare") return mat(0xc4a07a, 0.74);
  return mat(BOOT, 0.92);
}

// STYLE: neck-skull-shoulder silhouette
function limbsPawn(team: Team, look: Appearance): PawnParts {
  const k = kitFor(team, look);
  const cloth: THREE.Mesh[] = [];
  const hits: THREE.Mesh[] = [];
  const extras: THREE.Mesh[] = [];

  const shirt = makeShirt(look.shirt, k, team, cloth, extras);
  const body = shirt.body;
  body.position.y = BODY_REST_Y;

  const hips = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 8), k.pants);
  hips.position.y = 0.92;
  hips.scale.copy(hipScale(look.pants));
  cloth.push(hips);
  hits.push(hips);

  const belt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.205, 0.205, 0.036, 12),
    look.shirt === "plate" ? k.plate : mat(0x2a2218, 0.92),
  );
  belt.position.y = 0.975;
  belt.scale.z = 0.76;

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.071, 0.15, 10), k.flesh);
  neck.position.y = 1.515;
  hits.push(neck);

  const lLeg = makeLeg(-1, k, extras, look);
  const rLeg = makeLeg(1, k, extras, look);
  cloth.push(...lLeg.cloth, ...rLeg.cloth);
  hits.push(...lLeg.hits, ...rLeg.hits);

  const armR = look.shirt === "parka" ? 0.081 : look.shirt === "plate" ? 0.073 : 0.066;
  const foreR = armR * 0.84;
  const bareUpper = look.shirt === "vest";
  const shortSleeve = look.shirt === "tee";

  const lShoulder = new THREE.Vector3(-shirt.shoulderX, 1.405, 0);
  const rShoulder = new THREE.Vector3(shirt.shoulderX, 1.405, 0);
  const lSleeveEnd = new THREE.Vector3(-0.255, 1.325, -0.065);
  const rSleeveEnd = new THREE.Vector3(0.275, 1.325, -0.045);
  const lElbow = new THREE.Vector3(-0.175, 1.215, -0.17);
  const rElbow = new THREE.Vector3(0.235, 1.205, -0.12);

  const lArm = bone(
    lShoulder.x,
    lShoulder.y,
    lShoulder.z,
    shortSleeve ? lSleeveEnd.x : lElbow.x,
    shortSleeve ? lSleeveEnd.y : lElbow.y,
    shortSleeve ? lSleeveEnd.z : lElbow.z,
    armR,
    bareUpper ? k.flesh : k.tunic,
  );
  const rArm = bone(
    rShoulder.x,
    rShoulder.y,
    rShoulder.z,
    shortSleeve ? rSleeveEnd.x : rElbow.x,
    shortSleeve ? rSleeveEnd.y : rElbow.y,
    shortSleeve ? rSleeveEnd.z : rElbow.z,
    armR,
    bareUpper ? k.flesh : k.tunic,
  );
  hits.push(lArm, rArm);
  if (!bareUpper) cloth.push(lArm, rArm);

  if (shortSleeve) {
    const lUpper = bone(lSleeveEnd.x, lSleeveEnd.y, lSleeveEnd.z, lElbow.x, lElbow.y, lElbow.z, foreR, k.flesh);
    const rUpper = bone(rSleeveEnd.x, rSleeveEnd.y, rSleeveEnd.z, rElbow.x, rElbow.y, rElbow.z, foreR, k.flesh);
    hits.push(lUpper, rUpper);
  }

  const forearmMat = look.shirt === "tee" || look.shirt === "vest" ? k.flesh : k.tunic;
  const lFore = bone(lElbow.x, lElbow.y, lElbow.z, 0.015, 1.145, -0.385, foreR, forearmMat);
  const rFore = bone(rElbow.x, rElbow.y, rElbow.z, 0.14, 1.13, -0.29, foreR, forearmMat);
  hits.push(lFore, rFore);
  if (forearmMat === k.tunic) cloth.push(lFore, rFore);

  const lHand = makeHand(0.018, 1.142, -0.397, k.flesh);
  const rHand = makeHand(0.143, 1.126, -0.302, k.flesh);

  const head = makeHead(look, k);
  head.position.y = 1.64;
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

function makeHand(x: number, y: number, z: number, flesh: THREE.Material) {
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), flesh);
  hand.position.set(x, y, z);
  hand.scale.set(0.86, 0.72, 1.18);
  return hand;
}

function hipScale(id: PantsId) {
  if (id === "slim") return new THREE.Vector3(1.02, 0.62, 0.82);
  if (id === "shorts") return new THREE.Vector3(1.28, 0.72, 1.02);
  if (id === "wrap") return new THREE.Vector3(1.16, 0.68, 0.92);
  if (id === "armor") return new THREE.Vector3(1.2, 0.78, 0.98);
  return new THREE.Vector3(1.28, 0.7, 1.02);
}

type ShirtBuild = {
  body: THREE.Mesh;
  shoulderX: number;
};

function makeShirt(id: ShirtId, k: Kit, team: Team, cloth: THREE.Mesh[], extras: THREE.Mesh[]): ShirtBuild {
  const parka = id === "parka";
  const topR = parka ? 0.245 : id === "plate" ? 0.235 : id === "henley" ? 0.23 : 0.22;
  const waistR = parka ? 0.205 : 0.185;
  const torsoMat = id === "vest" ? mat(0x29251f, 0.9) : k.tunic;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(topR, waistR, parka ? 0.5 : 0.46, 12), torsoMat);
  body.scale.z = parka ? 0.82 : 0.74;
  if (id !== "vest") cloth.push(body);

  const shoulderX = parka ? 0.305 : 0.285;
  const shoulderMat = id === "vest" ? k.flesh : k.tunic;
  const shoulder = bone(-shoulderX, 1.405, 0, shoulderX, 1.405, 0, parka ? 0.09 : 0.075, shoulderMat);
  extras.push(shoulder);
  if (id !== "vest") cloth.push(shoulder);

  if (id === "tee") {
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.018, 12), k.tunic);
    collar.position.set(0, 1.412, -0.005);
    collar.scale.z = 0.78;
    extras.push(collar);
    cloth.push(collar);
  } else if (id === "henley") {
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.028, 12), k.tunic);
    collar.position.set(0, 1.415, -0.005);
    collar.scale.z = 0.8;
    extras.push(collar);
    cloth.push(collar);
    for (let i = 0; i < 3; i++) {
      const button = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5), mat(0x30261c, 0.75));
      button.position.set(0, 1.35 - i * 0.052, -0.174);
      extras.push(button);
    }
  } else if (id === "vest") {
    const lapelL = bone(-0.075, 1.405, -0.145, -0.125, 1.075, -0.145, 0.038, k.tunic);
    const lapelR = bone(0.075, 1.405, -0.145, 0.125, 1.075, -0.145, 0.038, k.tunic);
    extras.push(lapelL, lapelR);
    cloth.push(lapelL, lapelR);
  } else if (id === "parka") {
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), k.tunic);
    hood.position.set(0, 1.445, 0.055);
    hood.scale.set(1, 0.82, 0.58);
    const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.208, 0.208, 0.045, 12), k.tunic);
    hem.position.y = 0.945;
    hem.scale.z = 0.82;
    extras.push(hood, hem);
    cloth.push(hood, hem);
  } else {
    const plate = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), k.plate);
    plate.position.set(0, 1.23, -0.14);
    plate.scale.set(1.28, 0.88, 0.3);
    const trim = bone(-0.08, 1.3, -0.187, 0.08, 1.3, -0.187, 0.018, mat(teamTrim(team), 0.42, 0.24));
    extras.push(plate, trim);
    cloth.push(trim);
  }

  return { body, shoulderX };
}

function makeHead(look: Appearance, k: Kit) {
  const skullScale: Record<Appearance["face"], [number, number, number]> = {
    pale: [0.96, 1.14, 0.94],
    tan: [1, 1.16, 0.96],
    olive: [0.94, 1.18, 0.98],
    umber: [0.98, 1.17, 1],
    square: [1.05, 1.15, 0.98],
  };
  const jawScale: Record<Appearance["face"], [number, number, number]> = {
    pale: [1.18, 0.64, 0.92],
    tan: [1.24, 0.68, 0.94],
    olive: [1.14, 0.72, 0.96],
    umber: [1.2, 0.76, 0.98],
    square: [1.42, 0.72, 1],
  };
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.145, 16, 12), k.flesh);
  head.scale.set(...skullScale[look.face]);

  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.105, 14, 9), k.flesh);
  jaw.position.set(0, -0.108, -0.008);
  jaw.scale.set(...jawScale[look.face]);

  const socketColor = new THREE.Color(FACE_HEX[look.face]).multiplyScalar(0.76).getHex();
  const socketMat = mat(socketColor, 0.8);
  const eyeMat = mat(0x171513, 0.38);
  for (const side of [-1, 1] as const) {
    const socket = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 7), socketMat);
    socket.position.set(side * 0.054, 0.026, -0.137);
    socket.scale.set(1, 0.72, 0.24);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.015, 9, 7), eyeMat);
    eye.position.set(side * 0.054, 0.025, -0.149);
    eye.scale.set(0.88, 1, 0.58);
    head.add(socket, eye);
  }

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 7), k.flesh);
  nose.position.set(0, -0.008, -0.149);
  nose.scale.set(look.face === "square" ? 0.82 : 0.68, look.face === "olive" ? 1.34 : 1.18, 0.82);

  const mouth = bone(-0.035, -0.074, -0.148, 0.035, -0.074, -0.148, 0.008, mat(socketColor, 0.86));

  const earL = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 7), k.flesh);
  earL.position.set(-0.148, -0.005, 0);
  earL.scale.set(0.35, 0.82, 0.58);
  const earR = earL.clone();
  earR.position.x = 0.148;
  head.add(jaw, nose, mouth, earL, earR);
  return head;
}

function dressHair(head: THREE.Mesh, id: HairId, k: Kit) {
  const hair = k.hair;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), hair);
  cap.position.y = 0.02;
  head.add(cap);
  if (id === "buzz") {
    cap.scale.set(1.01, 0.96, 1);
    return;
  }
  if (id === "crew") {
    cap.scale.set(0.91, 1.02, 0.92);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 7), hair);
    top.position.set(0, 0.113, -0.015);
    top.scale.set(1.25, 0.54, 1);
    head.add(top);
    return;
  }
  if (id === "mop") {
    cap.scale.set(1.06, 1.04, 1.05);
    const fringe = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 7, 14, Math.PI), hair);
    fringe.position.set(0, 0.057, -0.137);
    head.add(fringe);
    return;
  }
  if (id === "fade") {
    cap.scale.set(0.87, 1, 0.9);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 7), hair);
    top.position.set(0, 0.112, -0.005);
    top.scale.set(1.08, 0.48, 0.88);
    head.add(top);
    return;
  }
  cap.scale.set(0.96, 1, 0.98);
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), hair);
  bun.position.set(0, 0.11, 0.135);
  head.add(bun);
}

function dressBeard(head: THREE.Mesh, id: BeardId, k: Kit) {
  if (id === "none") return;
  const hair = mat(BEARD_HEX, 0.9);
  if (id === "stubble") {
    const jaw = beardMass(hair, 0, -0.112, -0.112, 0.112, 0.035, 0.047);
    head.add(jaw);
    return;
  }
  if (id === "goatee") {
    const chin = bone(0, -0.07, -0.15, 0, -0.175, -0.125, 0.027, hair);
    head.add(chin);
    return;
  }
  if (id === "full") {
    const jaw = beardMass(hair, 0, -0.12, -0.103, 0.126, 0.078, 0.065);
    const cheekL = bone(-0.118, -0.025, -0.105, -0.09, -0.13, -0.12, 0.034, hair);
    const cheekR = bone(0.118, -0.025, -0.105, 0.09, -0.13, -0.12, 0.034, hair);
    head.add(jaw, cheekL, cheekR);
    return;
  }
  if (id === "braid") {
    const chin = beardMass(hair, 0, -0.135, -0.12, 0.045, 0.055, 0.038);
    const braid = bone(0, -0.16, -0.122, 0, -0.285, -0.115, 0.022, hair);
    const tie = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), k.helm);
    tie.position.set(0, -0.225, -0.118);
    tie.scale.y = 0.55;
    head.add(chin, braid, tie);
    return;
  }
  if (id === "stache") {
    const halfL = bone(-0.082, -0.065, -0.145, -0.008, -0.047, -0.153, 0.017, hair);
    const halfR = bone(0.008, -0.047, -0.153, 0.082, -0.065, -0.145, 0.017, hair);
    head.add(halfL, halfR);
    return;
  }
  if (id === "mutton") {
    const chopL = bone(-0.125, 0.015, -0.065, -0.108, -0.13, -0.102, 0.032, hair);
    const chopR = bone(0.125, 0.015, -0.065, 0.108, -0.13, -0.102, 0.032, hair);
    head.add(chopL, chopR);
    return;
  }
  if (id === "soul") {
    const patch = beardMass(hair, 0, -0.105, -0.151, 0.022, 0.032, 0.014);
    head.add(patch);
    return;
  }
  if (id === "forked") {
    const jaw = beardMass(hair, 0, -0.125, -0.108, 0.11, 0.065, 0.055);
    const tineL = bone(-0.045, -0.145, -0.118, -0.055, -0.27, -0.108, 0.026, hair);
    const tineR = bone(0.045, -0.145, -0.118, 0.055, -0.27, -0.108, 0.026, hair);
    head.add(jaw, tineL, tineR);
    return;
  }
  const brushL = bone(-0.105, -0.072, -0.142, -0.008, -0.052, -0.153, 0.025, hair);
  const brushR = bone(0.008, -0.052, -0.153, 0.105, -0.072, -0.142, 0.025, hair);
  const hang = beardMass(hair, 0, -0.125, -0.125, 0.1, 0.055, 0.045);
  const chin = beardMass(hair, 0, -0.174, -0.116, 0.052, 0.05, 0.04);
  head.add(brushL, brushR, hang, chin);
}

function beardMass(material: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) {
  const mass = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 7), material);
  mass.position.set(x, y, z);
  mass.scale.set(sx, sy, sz);
  return mass;
}

function dressAccessory(head: THREE.Mesh, id: AccessoryId, k: Kit, team: Team, cloth: THREE.Mesh[]) {
  if (id === "none") return;
  if (id === "glasses") {
    const frame = mat(0x1a1814, 0.35, 0.25);
    const lens = mat(0x3a4a58, 0.18, 0.55);
    const bridge = bone(-0.02, 0.025, -0.158, 0.02, 0.025, -0.158, 0.006, frame);
    const rimL = new THREE.Mesh(new THREE.CylinderGeometry(0.037, 0.037, 0.008, 12), frame);
    rimL.position.set(-0.055, 0.025, -0.155);
    rimL.rotation.x = Math.PI / 2;
    rimL.scale.set(1.12, 1, 0.82);
    const rimR = rimL.clone();
    rimR.position.x = 0.06;
    const glassL = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 7), lens);
    glassL.position.set(-0.055, 0.025, -0.157);
    glassL.scale.set(1.15, 0.82, 0.12);
    const glassR = glassL.clone();
    glassR.position.x = 0.055;
    const armL = bone(-0.09, 0.025, -0.15, -0.135, 0.02, -0.04, 0.006, frame);
    const armR = bone(0.09, 0.025, -0.15, 0.135, 0.02, -0.04, 0.006, frame);
    head.add(bridge, rimL, rimR, glassL, glassR, armL, armR);
    return;
  }
  if (id === "scarf") {
    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.07, 12), k.tunic);
    wrap.position.set(0, -0.235, 0.015);
    wrap.scale.z = 0.82;
    const tail = bone(0.045, -0.26, -0.08, 0.095, -0.41, -0.045, 0.035, k.tunic);
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.044, 9, 7), mat(teamTrim(team), 0.5, 0.12));
    knot.position.set(0.025, -0.265, -0.095);
    knot.scale.y = 0.75;
    head.add(wrap, tail, knot);
    cloth.push(wrap, tail);
    return;
  }
  if (id === "earpro") {
    const band = bone(-0.145, 0.125, 0.005, 0.145, 0.125, 0.005, 0.018, k.helm);
    const cupL = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), k.helm);
    cupL.position.set(-0.165, 0.005, 0);
    cupL.scale.set(0.48, 1, 0.78);
    const cupR = cupL.clone();
    cupR.position.x = 0.165;
    const padL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 9, 7), mat(0x2a241c, 0.9));
    padL.position.set(-0.143, 0.005, 0);
    padL.scale.set(0.25, 0.92, 0.7);
    const padR = padL.clone();
    padR.position.x = 0.143;
    head.add(band, cupL, cupR, padL, padR);
    cloth.push(band, cupL, cupR);
    return;
  }
  if (id === "mask") {
    const cover = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mat(0x2a241c, 0.82));
    cover.position.set(0, -0.08, -0.135);
    cover.scale.set(0.112, 0.068, 0.042);
    const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.09, 8), k.plate);
    vent.position.set(0, -0.1, -0.174);
    vent.rotation.z = Math.PI / 2;
    const strapL = bone(-0.115, -0.06, -0.105, -0.14, -0.045, 0, 0.01, mat(0x1a1814, 0.88));
    const strapR = bone(0.115, -0.06, -0.105, 0.14, -0.045, 0, 0.01, mat(0x1a1814, 0.88));
    head.add(cover, vent, strapL, strapR);
    return;
  }
  const cup = new THREE.Mesh(new THREE.SphereGeometry(0.055, 9, 7), k.helm);
  cup.position.set(-0.162, 0.015, 0.015);
  cup.scale.set(0.42, 0.85, 0.68);
  const boom = bone(-0.165, -0.02, -0.005, -0.045, -0.08, -0.155, 0.008, k.plate);
  const mic = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5), k.plate);
  mic.position.set(-0.04, -0.083, -0.16);
  const cable = bone(-0.165, -0.025, 0.025, -0.15, -0.13, 0.035, 0.006, mat(0x1a1814, 0.9));
  head.add(cup, boom, mic, cable);
  cloth.push(cup);
}

function dressHat(head: THREE.Mesh, id: HatId, k: Kit, _team: Team, cloth: THREE.Mesh[]) {
  if (id === "none") {
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.01, 4, 4), k.helm);
    helm.visible = false;
    head.add(helm);
    return helm;
  }
  if (id === "watch") {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.158, 0.09, 12), k.helm);
    cap.position.y = 0.09;
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), k.helm);
    crown.position.y = 0.015;
    crown.scale.y = 0.45;
    cap.add(crown);
    head.add(cap);
    cloth.push(cap, crown);
    return cap;
  }
  if (id === "ushanka") {
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.162, 12, 9, 0, Math.PI * 2, 0, Math.PI * 0.58), k.helm);
    crown.position.y = 0.025;
    crown.scale.y = 0.88;
    const flapL = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 7), k.helm);
    flapL.position.set(-0.166, -0.03, 0.005);
    flapL.scale.set(0.46, 1.15, 0.9);
    const flapR = flapL.clone();
    flapR.position.x = 0.166;
    crown.add(flapL, flapR);
    head.add(crown);
    cloth.push(crown, flapL, flapR);
    return crown;
  }
  if (id === "boonie") {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.153, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.54), k.helm);
    dome.position.y = 0.03;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.018, 14), k.helm);
    brim.position.y = 0;
    brim.scale.z = 0.84;
    dome.add(brim);
    head.add(dome);
    cloth.push(dome, brim);
    return dome;
  }
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.157, 14, 9, 0, Math.PI * 2, 0, Math.PI * 0.58), k.helm);
  helm.position.y = 0.025;
  const brim = bone(-0.1, -0.025, -0.13, 0.1, -0.025, -0.13, 0.015, k.helm);
  helm.add(brim);
  head.add(helm);
  cloth.push(helm, brim);
  return helm;
}

function makeLeg(side: 1 | -1, k: Kit, extras: THREE.Mesh[], look: Appearance) {
  const hip = new THREE.Group();
  hip.position.set(side * 0.095, 0.9, side > 0 ? -0.015 : 0.015);
  hip.rotation.z = side * 0.03;
  const thighR = look.pants === "slim" ? 0.068 : look.pants === "cargo" ? 0.096 : 0.088;
  const thighLen = 0.39;
  const thigh = bone(0, 0, 0, 0, -thighLen, 0, thighR, k.pants);
  hip.add(thigh);
  const cloth: THREE.Mesh[] = [thigh];
  if (look.pants === "cargo") {
    const pouch = new THREE.Mesh(new THREE.SphereGeometry(0.06, 9, 7), k.pants);
    pouch.position.set(side * 0.075, -0.17, -0.035);
    pouch.scale.set(0.82, 1.05, 0.48);
    hip.add(pouch);
    extras.push(pouch);
    cloth.push(pouch);
  }
  const knee = new THREE.Group();
  knee.position.y = -thighLen;
  hip.add(knee);
  const shinLen = 0.41;
  const shinMat = look.pants === "shorts" ? k.flesh : k.pants;
  const shinR = look.pants === "slim" ? 0.058 : look.pants === "shorts" ? 0.06 : 0.078;
  const shin = bone(0, 0, 0, 0, -shinLen, 0, shinR, shinMat);
  knee.add(shin);
  if (look.pants !== "shorts") cloth.push(shin);
  if (look.pants === "wrap") {
    const puttee = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.082, 0.22, 8), k.pants);
    puttee.position.y = -shinLen * 0.45;
    knee.add(puttee);
    cloth.push(puttee);
  }
  if (look.pants === "armor") {
    const plate = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 7), k.plate);
    plate.position.set(0, -shinLen * 0.45, -0.055);
    plate.scale.set(0.72, 1.25, 0.36);
    knee.add(plate);
    extras.push(plate);
  }
  const foot = makeShoe(look.shoes, k, shinLen);
  knee.add(foot);
  return { hip, knee, cloth, hits: [thigh, shin, foot] };
}

function makeShoe(id: ShoesId, k: Kit, shinLen: number) {
  const size: Record<ShoesId, [number, number, number]> = {
    boot: [0.14, 0.09, 0.22],
    sneaker: [0.13, 0.065, 0.2],
    wrap: [0.12, 0.055, 0.17],
    steel: [0.16, 0.1, 0.24],
    bare: [0.13, 0.05, 0.19],
  };
  const [w, h, d] = size[id];
  const foot = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), id === "bare" ? k.flesh : k.boot);
  foot.position.set(0, -shinLen - h / 2, -d * 0.34);
  foot.castShadow = true;

  if (id === "sneaker") {
    const stripe = bone(-0.066, 0.012, -0.035, 0.066, 0.012, -0.035, 0.009, mat(0xd8d0c4, 0.7));
    foot.add(stripe);
    return foot;
  }
  if (id === "wrap") {
    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.12, 8), k.boot);
    wrap.position.set(0, 0.018, 0.01);
    wrap.rotation.x = Math.PI / 2;
    wrap.scale.y = 0.72;
    foot.add(wrap);
    return foot;
  }
  if (id === "steel") {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 7), k.plate);
    cap.position.set(0, 0.005, -0.095);
    cap.scale.set(0.95, 0.58, 0.72);
    foot.add(cap);
    return foot;
  }
  if (id === "bare") {
    for (const x of [-0.035, 0, 0.035]) {
      const toe = new THREE.Mesh(new THREE.SphereGeometry(0.021, 8, 6), k.flesh);
      toe.position.set(x, 0, -0.1);
      toe.scale.z = 1.2;
      foot.add(toe);
    }
    return foot;
  }
  const ankle = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.076, 0.13, 9), k.boot);
  ankle.position.set(0, 0.075, 0.025);
  foot.add(ankle);
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
