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

// STYLE: tapered cylinders
const HEAD_H = 0.2;
const TURN = 12;

function cyl(rt: number, rb: number, h: number, segs = TURN) {
  return new THREE.CylinderGeometry(rt, rb, h, segs);
}

function hemi(r: number, segs = TURN) {
  return new THREE.SphereGeometry(r, segs, Math.max(6, (segs / 2) | 0), 0, Math.PI * 2, 0, Math.PI * 0.5);
}

function faceCranium(face: Appearance["face"]) {
  if (face === "pale") return 0.132;
  if (face === "umber") return 0.118;
  if (face === "olive") return 0.112;
  if (face === "square") return 0.128;
  return 0.122;
}

function faceJaw(face: Appearance["face"]) {
  if (face === "square") return 0.11;
  if (face === "pale") return 0.078;
  if (face === "olive") return 0.07;
  if (face === "umber") return 0.076;
  return 0.08;
}

function limbsPawn(team: Team, look: Appearance): PawnParts {
  const k = kitFor(team, look);
  const cloth: THREE.Mesh[] = [];
  const hits: THREE.Mesh[] = [];
  const extras: THREE.Mesh[] = [];

  const body = makeShirt(look.shirt, k, team, cloth, extras);
  body.position.y = 1.18;

  const pelvisR = look.pants === "slim" ? 0.135 : look.pants === "shorts" ? 0.168 : look.pants === "wrap" ? 0.15 : 0.162;
  const pelvis = new THREE.Mesh(cyl(pelvisR, pelvisR * 1.08, 0.1), k.pants);
  pelvis.position.y = 0.92;
  cloth.push(pelvis);
  hits.push(pelvis);

  const belt = new THREE.Mesh(cyl(pelvisR * 1.04, pelvisR, 0.048), look.shirt === "plate" ? k.plate : mat(0x2a2218, 0.9));
  belt.position.y = 0.99;
  hits.push(belt);

  const barLen = look.shirt === "parka" ? 0.5 : look.shirt === "tee" ? 0.42 : 0.46;
  const shoulders = new THREE.Mesh(cyl(0.04, 0.048, barLen), look.shirt === "tee" ? k.flesh : k.tunic);
  shoulders.rotation.z = Math.PI / 2;
  shoulders.position.y = 1.4;
  hits.push(shoulders);
  if (look.shirt !== "tee") cloth.push(shoulders);

  const neck = new THREE.Mesh(cyl(0.04, 0.05, 0.1), k.flesh);
  neck.position.y = 1.49;
  hits.push(neck);

  const lLeg = makeLeg(-1, k, extras, look);
  const rLeg = makeLeg(1, k, extras, look);
  cloth.push(...lLeg.cloth, ...rLeg.cloth);
  hits.push(...lLeg.hits, ...rLeg.hits);

  const armHi = look.shirt === "parka" ? 0.078 : look.shirt === "tee" ? 0.05 : 0.062;
  const armLo = armHi * 0.78;
  const wrist = armLo * 0.82;
  const sleeve = look.shirt === "tee" ? k.flesh : k.tunic;
  const forearmM = look.shirt === "tee" || look.shirt === "vest" ? k.flesh : k.tunic;
  const lArm = taper(-0.24, 1.36, 0.02, -0.16, 1.2, -0.16, armHi, armLo, sleeve);
  const lFore = taper(-0.16, 1.2, -0.16, 0.02, 1.14, -0.38, armLo, wrist, forearmM);
  const rArm = taper(0.24, 1.36, 0.02, 0.22, 1.18, -0.1, armHi, armLo, sleeve);
  const rFore = taper(0.22, 1.18, -0.1, 0.14, 1.12, -0.28, armLo, wrist, forearmM);
  if (look.shirt !== "tee") cloth.push(lArm, rArm);
  if (look.shirt !== "tee" && look.shirt !== "vest") cloth.push(lFore, rFore);
  hits.push(lArm, lFore, rArm, rFore);

  const lHand = new THREE.Mesh(cyl(0.026, 0.034, 0.068, 8), k.flesh);
  lHand.position.set(0.02, 1.14, -0.4);
  lHand.rotation.x = Math.PI / 2;
  const rHand = new THREE.Mesh(cyl(0.026, 0.034, 0.068, 8), k.flesh);
  rHand.position.set(0.14, 1.12, -0.3);
  rHand.rotation.x = Math.PI / 2;

  const cranium = faceCranium(look.face);
  const head = makeHead(look, k);
  head.position.y = 1.64;
  dressHair(head, look.hair, k, cranium);
  dressBeard(head, look.beard, k);
  const helm = dressHat(head, look.hat, k, cloth, cranium);
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
    hits: [...hits, lHand, rHand, ...extras],
    walk: { lHip: lLeg.hip, rHip: rLeg.hip, lKnee: lLeg.knee, rKnee: rLeg.knee },
  };
}

function makeShirt(id: ShirtId, k: Kit, team: Team, cloth: THREE.Mesh[], extras: THREE.Mesh[]) {
  if (id === "parka") {
    const body = new THREE.Mesh(cyl(0.2, 0.155, 0.52), k.tunic);
    cloth.push(body);
    const cowl = new THREE.Mesh(cyl(0.11, 0.14, 0.1), k.tunic);
    cowl.position.y = 0.28;
    body.add(cowl);
    cloth.push(cowl);
    extras.push(cowl);
    const hood = new THREE.Mesh(hemi(0.13), k.tunic);
    hood.position.set(0, 0.32, 0.02);
    body.add(hood);
    cloth.push(hood);
    extras.push(hood);
    return body;
  }
  if (id === "vest") {
    const body = new THREE.Mesh(cyl(0.145, 0.118, 0.42), mat(0x2a241c, 0.88));
    extras.push(body);
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.14, 0.4, TURN, 1, false, 0.55, Math.PI * 2 - 1.1), k.tunic);
    shell.position.y = 0.01;
    body.add(shell);
    extras.push(shell);
    cloth.push(shell);
    return body;
  }
  if (id === "plate") {
    const body = new THREE.Mesh(cyl(0.168, 0.128, 0.44), k.tunic);
    cloth.push(body);
    const plate = new THREE.Mesh(cyl(0.14, 0.132, 0.055), k.plate);
    plate.rotation.x = Math.PI / 2;
    plate.position.set(0, 0.04, 0.12);
    body.add(plate);
    extras.push(plate);
    const trim = new THREE.Mesh(cyl(0.035, 0.035, 0.03, 8), mat(teamTrim(team), 0.4, 0.25));
    trim.rotation.x = Math.PI / 2;
    trim.position.set(0, 0.12, 0.15);
    body.add(trim);
    extras.push(trim);
    cloth.push(trim);
    return body;
  }
  const henley = id === "henley";
  const body = new THREE.Mesh(cyl(henley ? 0.162 : 0.15, henley ? 0.125 : 0.118, henley ? 0.46 : 0.42), k.tunic);
  cloth.push(body);
  if (henley) {
    const placket = new THREE.Mesh(cyl(0.016, 0.016, 0.16, 8), k.tunic);
    placket.position.set(0, 0.08, 0.128);
    body.add(placket);
    cloth.push(placket);
    extras.push(placket);
    for (const dy of [0.13, 0.06, -0.01]) {
      const btn = new THREE.Mesh(cyl(0.011, 0.011, 0.012, 8), mat(0x2a2218, 0.7));
      btn.rotation.x = Math.PI / 2;
      btn.position.set(0, dy, 0.14);
      body.add(btn);
      extras.push(btn);
    }
  }
  return body;
}

function makeHead(look: Appearance, k: Kit) {
  const cr = faceCranium(look.face);
  const jaw = faceJaw(look.face);
  const head = new THREE.Mesh(cyl(cr, jaw, HEAD_H), k.flesh);
  if (look.face === "olive") head.scale.set(0.94, 1.06, 1);
  if (look.face === "square") head.scale.set(1.08, 0.96, 0.9);
  const cap = new THREE.Mesh(hemi(cr), k.flesh);
  cap.position.y = HEAD_H / 2;
  head.add(cap);
  const eyeM = mat(0x1a1410, 0.35, 0.08);
  const eyeZ = -(cr * 0.55 + jaw * 0.45) + 0.006;
  const inset = (x: number) => {
    const m = new THREE.Mesh(cyl(0.013, 0.02, 0.03, 8), eyeM);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.028, eyeZ);
    return m;
  };
  head.add(inset(-0.042), inset(0.042));
  const nose = new THREE.Mesh(cyl(0.01, 0.022, 0.048, 8), k.flesh);
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, -0.008, eyeZ - 0.014);
  head.add(nose);
  const earL = new THREE.Mesh(cyl(0.012, 0.018, 0.048, 8), k.flesh);
  earL.position.set(-(cr + 0.006), 0.008, 0.012);
  const earR = earL.clone();
  earR.position.x = cr + 0.006;
  head.add(earL, earR);
  return head;
}

function dressHair(head: THREE.Mesh, id: HairId, k: Kit, cranium: number) {
  const hair = k.hair;
  const crownY = HEAD_H / 2;
  if (id === "buzz") {
    const cap = new THREE.Mesh(hemi(cranium + 0.01), hair);
    cap.position.y = crownY;
    head.add(cap);
    return;
  }
  if (id === "crew") {
    const top = new THREE.Mesh(cyl(cranium * 0.72, cranium * 0.9, 0.07), hair);
    top.position.y = crownY + 0.02;
    const cap = new THREE.Mesh(hemi(cranium * 0.72), hair);
    cap.position.y = 0.035;
    top.add(cap);
    head.add(top);
    return;
  }
  if (id === "mop") {
    const top = new THREE.Mesh(cyl(cranium + 0.038, cranium + 0.012, 0.1), hair);
    top.position.y = crownY;
    const cap = new THREE.Mesh(hemi(cranium + 0.038), hair);
    cap.position.y = 0.05;
    top.add(cap);
    const bang = new THREE.Mesh(cyl(0.07, 0.1, 0.08, 8), hair);
    bang.rotation.x = -0.95;
    bang.position.set(0, 0.04, -cranium + 0.02);
    head.add(top, bang);
    return;
  }
  if (id === "fade") {
    const top = new THREE.Mesh(cyl(cranium * 0.62, cranium * 0.5, 0.075), hair);
    top.position.y = crownY + 0.018;
    const cap = new THREE.Mesh(hemi(cranium * 0.62), hair);
    cap.position.y = 0.038;
    top.add(cap);
    const sideL = new THREE.Mesh(cyl(0.018, 0.012, 0.1, 8), hair);
    sideL.position.set(-(cranium * 0.92), 0.02, 0);
    const sideR = sideL.clone();
    sideR.position.x = cranium * 0.92;
    head.add(top, sideL, sideR);
    return;
  }
  const top = new THREE.Mesh(cyl(cranium * 0.78, cranium * 0.88, 0.055), hair);
  top.position.y = crownY;
  const bun = new THREE.Mesh(cyl(0.042, 0.055, 0.07, 8), hair);
  bun.rotation.x = Math.PI / 2;
  bun.position.set(0, crownY + 0.02, cranium * 0.7);
  const bunCap = new THREE.Mesh(hemi(0.055), hair);
  bunCap.rotation.x = Math.PI / 2;
  bun.add(bunCap);
  head.add(top, bun);
}

function dressBeard(head: THREE.Mesh, id: BeardId, k: Kit) {
  if (id === "none") return;
  const hair = mat(BEARD_HEX, 0.9);
  const jawY = -HEAD_H * 0.42;
  if (id === "stubble") {
    const jaw = new THREE.Mesh(cyl(0.09, 0.08, 0.04, 10), hair);
    jaw.position.set(0, jawY, -0.02);
    head.add(jaw);
    return;
  }
  if (id === "goatee") {
    const chin = new THREE.Mesh(cyl(0.018, 0.032, 0.09, 8), hair);
    chin.position.set(0, jawY - 0.04, -0.08);
    head.add(chin);
    return;
  }
  if (id === "full") {
    const jaw = new THREE.Mesh(cyl(0.11, 0.09, 0.12, 10), hair);
    jaw.position.set(0, jawY - 0.02, -0.02);
    const cheekL = new THREE.Mesh(cyl(0.028, 0.022, 0.1, 8), hair);
    cheekL.position.set(-0.08, jawY + 0.04, -0.05);
    const cheekR = cheekL.clone();
    cheekR.position.x = 0.08;
    head.add(jaw, cheekL, cheekR);
    return;
  }
  if (id === "braid") {
    const chin = new THREE.Mesh(cyl(0.02, 0.028, 0.07, 8), hair);
    chin.position.set(0, jawY - 0.03, -0.08);
    const braid = new THREE.Mesh(cyl(0.012, 0.02, 0.18, 8), hair);
    braid.position.set(0, jawY - 0.16, -0.08);
    const tie = new THREE.Mesh(cyl(0.022, 0.022, 0.025, 8), k.helm);
    tie.position.set(0, jawY - 0.08, -0.08);
    head.add(chin, braid, tie);
    return;
  }
  if (id === "stache") {
    const stache = new THREE.Mesh(cyl(0.012, 0.012, 0.14, 8), hair);
    stache.rotation.z = Math.PI / 2;
    stache.position.set(0, -0.04, -0.1);
    const tipL = new THREE.Mesh(cyl(0.008, 0.014, 0.04, 8), hair);
    tipL.position.set(-0.07, -0.06, -0.09);
    const tipR = tipL.clone();
    tipR.position.x = 0.07;
    head.add(stache, tipL, tipR);
    return;
  }
  if (id === "mutton") {
    const chopL = new THREE.Mesh(cyl(0.028, 0.02, 0.16, 8), hair);
    chopL.position.set(-0.1, jawY + 0.02, -0.02);
    const chopR = chopL.clone();
    chopR.position.x = 0.1;
    const burnL = new THREE.Mesh(cyl(0.018, 0.014, 0.08, 8), hair);
    burnL.position.set(-0.11, 0.04, 0);
    const burnR = burnL.clone();
    burnR.position.x = 0.11;
    head.add(chopL, chopR, burnL, burnR);
    return;
  }
  if (id === "soul") {
    const patch = new THREE.Mesh(cyl(0.01, 0.016, 0.04, 8), hair);
    patch.position.set(0, jawY, -0.1);
    head.add(patch);
    return;
  }
  if (id === "forked") {
    const jaw = new THREE.Mesh(cyl(0.09, 0.07, 0.08, 10), hair);
    jaw.position.set(0, jawY - 0.02, -0.04);
    const tineL = new THREE.Mesh(cyl(0.014, 0.022, 0.14, 8), hair);
    tineL.position.set(-0.04, jawY - 0.12, -0.06);
    const tineR = tineL.clone();
    tineR.position.x = 0.04;
    head.add(jaw, tineL, tineR);
    return;
  }
  const brush = new THREE.Mesh(cyl(0.016, 0.016, 0.18, 8), hair);
  brush.rotation.z = Math.PI / 2;
  brush.position.set(0, -0.045, -0.1);
  const hang = new THREE.Mesh(cyl(0.03, 0.05, 0.08, 8), hair);
  hang.position.set(0, -0.1, -0.1);
  const chin = new THREE.Mesh(cyl(0.028, 0.04, 0.07, 8), hair);
  chin.position.set(0, jawY - 0.04, -0.07);
  head.add(brush, hang, chin);
}

function dressAccessory(head: THREE.Mesh, id: AccessoryId, k: Kit, team: Team, cloth: THREE.Mesh[]) {
  if (id === "none") return;
  if (id === "glasses") {
    const frame = mat(0x1a1814, 0.35, 0.25);
    const lens = mat(0x3a4a58, 0.18, 0.55);
    const bridge = new THREE.Mesh(cyl(0.008, 0.008, 0.04, 8), frame);
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(0, 0.026, -0.118);
    const rimL = new THREE.Mesh(cyl(0.032, 0.032, 0.012, 10), frame);
    rimL.rotation.x = Math.PI / 2;
    rimL.position.set(-0.048, 0.026, -0.116);
    const rimR = rimL.clone();
    rimR.position.x = 0.048;
    const glassL = new THREE.Mesh(cyl(0.024, 0.024, 0.01, 10), lens);
    glassL.rotation.x = Math.PI / 2;
    glassL.position.set(-0.048, 0.026, -0.122);
    const glassR = glassL.clone();
    glassR.position.x = 0.048;
    const armL = taper(-0.072, 0.028, -0.11, -0.11, 0.03, -0.02, 0.007, 0.007, frame);
    const armR = taper(0.072, 0.028, -0.11, 0.11, 0.03, -0.02, 0.007, 0.007, frame);
    head.add(bridge, rimL, rimR, glassL, glassR, armL, armR);
    return;
  }
  if (id === "scarf") {
    const wrap = new THREE.Mesh(cyl(0.09, 0.1, 0.1), k.tunic);
    wrap.position.set(0, -0.24, 0.01);
    const tail = new THREE.Mesh(cyl(0.028, 0.045, 0.22, 8), k.tunic);
    tail.position.set(0.08, -0.36, 0.03);
    tail.rotation.z = -0.28;
    const knot = new THREE.Mesh(cyl(0.03, 0.036, 0.05, 8), mat(teamTrim(team), 0.5, 0.12));
    knot.position.set(0.02, -0.26, -0.08);
    head.add(wrap, tail, knot);
    cloth.push(wrap, tail);
    return;
  }
  if (id === "earpro") {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.022, 10, 1, false, 0, Math.PI), k.helm);
    band.rotation.z = Math.PI / 2;
    band.position.y = 0.05;
    const cupL = new THREE.Mesh(cyl(0.038, 0.048, 0.055, 8), k.helm);
    cupL.rotation.z = Math.PI / 2;
    cupL.position.set(-0.15, 0.018, 0);
    const cupR = cupL.clone();
    cupR.position.x = 0.15;
    const padL = new THREE.Mesh(cyl(0.028, 0.032, 0.02, 8), mat(0x2a241c, 0.9));
    padL.rotation.z = Math.PI / 2;
    padL.position.set(-0.125, 0.018, 0);
    const padR = padL.clone();
    padR.position.x = 0.125;
    head.add(band, cupL, cupR, padL, padR);
    cloth.push(band, cupL, cupR);
    return;
  }
  if (id === "mask") {
    const cover = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.085, 0.12, TURN, 1, false, Math.PI * 0.72, Math.PI * 0.56), mat(0x2a241c, 0.82));
    cover.position.set(0, -0.05, 0);
    const vent = new THREE.Mesh(cyl(0.028, 0.022, 0.04, 8), k.plate);
    vent.rotation.x = -Math.PI / 2;
    vent.position.set(0, -0.08, -0.11);
    const strapL = new THREE.Mesh(cyl(0.012, 0.012, 0.12, 8), mat(0x1a1814, 0.88));
    strapL.rotation.y = 0.55;
    strapL.position.set(-0.09, -0.03, -0.02);
    const strapR = strapL.clone();
    strapR.position.x = 0.09;
    strapR.rotation.y = -0.55;
    head.add(cover, vent, strapL, strapR);
    return;
  }
  const cup = new THREE.Mesh(cyl(0.028, 0.035, 0.05, 8), k.helm);
  cup.rotation.z = Math.PI / 2;
  cup.position.set(-0.155, 0.02, 0.02);
  const boom = new THREE.Mesh(cyl(0.007, 0.007, 0.16, 6), k.plate);
  boom.position.set(-0.1, -0.03, -0.07);
  boom.rotation.y = 0.5;
  boom.rotation.x = 0.85;
  const mic = new THREE.Mesh(cyl(0.014, 0.01, 0.028, 8), k.plate);
  mic.position.set(-0.04, -0.07, -0.14);
  mic.rotation.x = -Math.PI / 2;
  const cable = new THREE.Mesh(cyl(0.006, 0.006, 0.1, 6), mat(0x1a1814, 0.9));
  cable.position.set(-0.15, -0.08, 0.04);
  head.add(cup, boom, mic, cable);
  cloth.push(cup);
}

function dressHat(head: THREE.Mesh, id: HatId, k: Kit, cloth: THREE.Mesh[], cranium: number) {
  if (id === "none") {
    const helm = new THREE.Mesh(cyl(0.01, 0.01, 0.01, 6), k.helm);
    helm.visible = false;
    head.add(helm);
    return helm;
  }
  if (id === "watch") {
    const cap = new THREE.Mesh(cyl(cranium * 0.92, cranium + 0.028, 0.13), k.helm);
    cap.position.y = HEAD_H / 2 + 0.02;
    const lid = new THREE.Mesh(hemi(cranium * 0.92), k.helm);
    lid.position.y = 0.065;
    cap.add(lid);
    head.add(cap);
    cloth.push(cap, lid);
    return cap;
  }
  if (id === "ushanka") {
    const crown = new THREE.Mesh(cyl(cranium + 0.03, cranium + 0.04, 0.14), k.helm);
    crown.position.y = HEAD_H / 2 + 0.02;
    const lid = new THREE.Mesh(hemi(cranium + 0.03), k.helm);
    lid.position.y = 0.07;
    crown.add(lid);
    const flapL = new THREE.Mesh(cyl(0.04, 0.05, 0.14, 8), k.helm);
    flapL.position.set(-(cranium + 0.05), -0.04, 0);
    const flapR = flapL.clone();
    flapR.position.x = cranium + 0.05;
    crown.add(flapL, flapR);
    head.add(crown);
    cloth.push(crown, lid, flapL, flapR);
    return crown;
  }
  if (id === "boonie") {
    const dome = new THREE.Mesh(hemi(cranium + 0.02), k.helm);
    dome.position.y = HEAD_H / 2 + 0.01;
    const brim = new THREE.Mesh(cyl(cranium + 0.12, cranium + 0.12, 0.018), k.helm);
    brim.position.y = -0.01;
    dome.add(brim);
    head.add(dome);
    cloth.push(dome, brim);
    return dome;
  }
  const helm = new THREE.Mesh(hemi(cranium + 0.035), k.helm);
  helm.position.y = HEAD_H / 2 - 0.01;
  const rim = new THREE.Mesh(cyl(cranium + 0.04, cranium + 0.05, 0.04, 10), k.helm);
  rim.position.y = -0.02;
  const bill = new THREE.Mesh(cyl(0.06, 0.08, 0.03, 8), k.helm);
  bill.rotation.x = Math.PI / 2;
  bill.position.set(0, -0.03, -0.1);
  helm.add(rim, bill);
  head.add(helm);
  cloth.push(helm, rim, bill);
  return helm;
}

function makeLeg(side: 1 | -1, k: Kit, extras: THREE.Mesh[], look: Appearance) {
  const hip = new THREE.Group();
  hip.position.set(side * 0.11, 0.88, 0);
  hip.rotation.z = side * 0.028;
  const thighLen = 0.4;
  const cargo = look.pants === "cargo";
  const slim = look.pants === "slim";
  const tHi = slim ? 0.07 : cargo ? 0.1 : 0.088;
  const tLo = slim ? 0.055 : cargo ? 0.078 : 0.068;
  const thigh = taper(0, 0, 0, 0, -thighLen, 0, tHi, tLo, k.pants);
  hip.add(thigh);
  const cloth: THREE.Mesh[] = [thigh];
  if (cargo) {
    const flare = new THREE.Mesh(cyl(tHi * 1.14, tHi * 0.92, 0.12, 8), k.pants);
    flare.position.y = -thighLen * 0.42;
    hip.add(flare);
    cloth.push(flare);
  }
  const knee = new THREE.Group();
  knee.position.y = -thighLen;
  hip.add(knee);
  const shinLen = 0.42;
  const shinMat = look.pants === "shorts" ? k.flesh : k.pants;
  const sHi = slim ? 0.052 : look.pants === "shorts" ? 0.055 : cargo ? 0.075 : 0.068;
  const sLo = slim ? 0.04 : look.pants === "shorts" ? 0.042 : 0.048;
  const shin = taper(0, 0, 0, 0, -shinLen, 0, sHi, sLo, shinMat);
  knee.add(shin);
  if (look.pants !== "shorts") cloth.push(shin);
  if (look.pants === "wrap") {
    const puttee = new THREE.Mesh(cyl(sHi * 1.12, sLo * 1.2, 0.22, 8), k.pants);
    puttee.position.y = -shinLen * 0.45;
    knee.add(puttee);
    cloth.push(puttee);
  }
  if (look.pants === "armor") {
    const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.05, 0.22, 8, 1, false, -0.55, Math.PI * 1.1), k.plate);
    guard.position.set(0, -shinLen * 0.42, 0.015);
    knee.add(guard);
    extras.push(guard);
  }
  const foot = makeShoe(look.shoes, k, shinLen);
  knee.add(foot);
  return { hip, knee, cloth, hits: [thigh, shin, foot] };
}

function makeShoe(id: ShoesId, k: Kit, shinLen: number) {
  const y = -shinLen - 0.03;
  if (id === "sneaker") {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.055, 0.2), k.boot);
    foot.position.set(0, y, -0.07);
    const upper = new THREE.Mesh(cyl(0.04, 0.048, 0.055, 8), k.boot);
    upper.position.y = 0.028;
    const stripe = new THREE.Mesh(cyl(0.05, 0.05, 0.018, 8), mat(0xd8d0c4, 0.7));
    stripe.position.y = 0.012;
    foot.add(upper, stripe);
    foot.castShadow = true;
    return foot;
  }
  if (id === "wrap") {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.045, 0.16), k.boot);
    foot.position.set(0, y + 0.006, -0.05);
    const wrap = new THREE.Mesh(cyl(0.038, 0.042, 0.05, 8), k.boot);
    wrap.position.y = 0.022;
    foot.add(wrap);
    foot.castShadow = true;
    return foot;
  }
  if (id === "steel") {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.24), k.boot);
    foot.position.set(0, y - 0.012, -0.08);
    const cap = new THREE.Mesh(cyl(0.05, 0.058, 0.07, 8), k.plate);
    cap.rotation.x = Math.PI / 2;
    cap.position.set(0, 0.01, -0.08);
    foot.add(cap);
    foot.castShadow = true;
    return foot;
  }
  if (id === "bare") {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.04, 0.16), k.flesh);
    foot.position.set(0, y + 0.008, -0.05);
    const instep = new THREE.Mesh(cyl(0.028, 0.04, 0.05, 8), k.flesh);
    instep.position.y = 0.02;
    foot.add(instep);
    foot.castShadow = true;
    return foot;
  }
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.22), k.boot);
  foot.position.set(0, y - 0.008, -0.075);
  const shaft = new THREE.Mesh(cyl(0.045, 0.052, 0.08, 8), k.boot);
  shaft.position.y = 0.04;
  foot.add(shaft);
  foot.castShadow = true;
  return foot;
}

function taper(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  rA: number,
  rB: number,
  material: THREE.Material,
) {
  _a.set(ax, ay, az);
  _b.set(bx, by, bz);
  const dist = Math.max(0.02, _a.distanceTo(_b));
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rB, rA, dist, 10), material);
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
