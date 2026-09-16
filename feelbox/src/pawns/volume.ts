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

// STYLE: human volume study
//
// Discrete rounded-box masses at correct human proportions (~7.5 heads
// tall): skull, ribcage, pelvis, upper arm, forearm, thigh, calf are each
// their own volume. The shoulder mass is wider than the pelvis mass, the
// neck is a cylinder, the skull is taller than it is wide, and the face
// reads as planes (forehead slab, cheek volumes, chin block) rather than a
// sphere with bits glued on. Hair is stacked slabs that follow the skull.

/** Half the shoulder-to-shoulder span for each shirt mass (metres from spine). */
const SHOULDER_W: Record<ShirtId, number> = {
  tee: 0.22,
  henley: 0.23,
  vest: 0.22,
  parka: 0.27,
  plate: 0.25,
};

/** Skull-box scale per face id. Every variant stays taller than it is wide. */
const FACE_SKULL_SCALE: Record<Appearance["face"], THREE.Vector3> = {
  pale: new THREE.Vector3(1, 1, 1),
  tan: new THREE.Vector3(1.02, 0.98, 1),
  olive: new THREE.Vector3(0.94, 1.06, 0.96),
  umber: new THREE.Vector3(1.03, 0.99, 1.04),
  square: new THREE.Vector3(1.06, 0.94, 1.06),
};

function limbsPawn(team: Team, look: Appearance): PawnParts {
  const k = kitFor(team, look);
  const cloth: THREE.Mesh[] = [];
  const hits: THREE.Mesh[] = [];
  const extras: THREE.Mesh[] = [];

  // Ribcage mass.
  const body = makeTorso(look.shirt, k, team, cloth, extras);
  body.position.y = 1.18;

  const shoulderW = SHOULDER_W[look.shirt];

  // Pelvis mass, kept narrower than the shoulder span below.
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.24), k.pants);
  pelvis.position.y = 0.92;
  pelvis.scale.copy(pelvisScale(look.pants));
  cloth.push(pelvis);
  hits.push(pelvis);

  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.26), look.shirt === "plate" ? k.plate : mat(0x2a2218, 0.9));
  belt.position.y = 0.98;

  // Neck cylinder bridging the ribcage top and the skull.
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.16, 8), k.flesh);
  neck.position.y = 1.46;
  neck.castShadow = true;

  const sash = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.44, 0.05), mat(teamTrim(team), 0.45, 0.2));
  sash.position.set(team === "ember" ? 0.15 : -0.15, 1.2, -0.05);
  sash.rotation.z = team === "ember" ? -0.26 : 0.26;
  cloth.push(sash);

  // Deltoid masses push the shoulder line past the ribcage box itself,
  // so the silhouette is unmistakably shoulders > hips.
  const shoulderL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.11, 0.2), k.tunic);
  shoulderL.position.set(-shoulderW, 1.34, 0);
  shoulderL.castShadow = true;
  const shoulderR = shoulderL.clone();
  shoulderR.position.x = shoulderW;
  if (look.shirt !== "tee") cloth.push(shoulderL, shoulderR);
  hits.push(shoulderL, shoulderR);

  const lLeg = makeLeg(-1, k, extras, look);
  const rLeg = makeLeg(1, k, extras, look);
  cloth.push(...lLeg.cloth, ...rLeg.cloth);
  hits.push(...lLeg.hits, ...rLeg.hits);

  // Upper-arm and forearm masses. Capsules read as rounded volumes here.
  const armR = look.shirt === "parka" ? 0.088 : look.shirt === "tee" ? 0.062 : 0.074;
  const lArm = bone(-shoulderW, 1.33, 0, -0.17, 1.16, -0.13, armR, look.shirt === "tee" ? k.flesh : k.tunic);
  const lFore = bone(-0.17, 1.16, -0.13, 0.02, 1.14, -0.4, armR * 0.82, look.shirt === "tee" || look.shirt === "vest" ? k.flesh : k.tunic);
  const rArm = bone(shoulderW, 1.33, 0, 0.21, 1.17, -0.08, armR, look.shirt === "tee" ? k.flesh : k.tunic);
  const rFore = bone(0.21, 1.17, -0.08, 0.14, 1.12, -0.3, armR * 0.82, look.shirt === "tee" || look.shirt === "vest" ? k.flesh : k.tunic);
  if (look.shirt !== "tee") cloth.push(lArm, rArm);
  if (look.shirt !== "tee" && look.shirt !== "vest") cloth.push(lFore, rFore);
  hits.push(lArm, lFore, rArm, rFore);

  // Fist masses, boxy like the rest of the figure rather than stray balls.
  const lHand = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.07, 0.09), k.flesh);
  lHand.position.set(0.02, 1.14, -0.4);
  lHand.castShadow = true;
  const rHand = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.07, 0.09), k.flesh);
  rHand.position.set(0.14, 1.12, -0.3);
  rHand.castShadow = true;

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
    hits: [...hits, lHand, rHand, belt, neck, ...extras],
    walk: { lHip: lLeg.hip, rHip: rLeg.hip, lKnee: lLeg.knee, rKnee: rLeg.knee },
  };
}

function pelvisScale(id: PantsId) {
  if (id === "slim") return new THREE.Vector3(0.94, 0.85, 0.86);
  if (id === "shorts") return new THREE.Vector3(1.22, 0.88, 1.0);
  if (id === "wrap") return new THREE.Vector3(1.08, 0.82, 0.94);
  if (id === "armor") return new THREE.Vector3(1.12, 0.9, 0.98);
  return new THREE.Vector3(1.28, 0.78, 1.02);
}

/** Ribcage mass. A single boxy torso volume; its shape varies with the shirt id. */
function makeTorso(id: ShirtId, k: Kit, team: Team, cloth: THREE.Mesh[], extras: THREE.Mesh[]) {
  if (id === "parka") {
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.46, 0.32), k.tunic);
    torso.castShadow = true;
    cloth.push(torso);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.16), k.tunic);
    hood.position.set(0, 0.32, 0.05);
    hood.castShadow = true;
    extras.push(hood);
    cloth.push(hood);
    return torso;
  }
  if (id === "vest") {
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.42, 0.26), mat(0x2a241c, 0.88));
    torso.castShadow = true;
    extras.push(torso);
    const flapL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.34, 0.07), k.tunic);
    flapL.position.set(-0.11, 0, -0.11);
    const flapR = flapL.clone();
    flapR.position.x = 0.11;
    extras.push(flapL, flapR);
    cloth.push(flapL, flapR);
    return torso;
  }
  if (id === "plate") {
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.28), k.tunic);
    torso.castShadow = true;
    cloth.push(torso);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.1), k.plate);
    plate.position.set(0, 0.02, -0.15);
    plate.castShadow = true;
    extras.push(plate);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.04), mat(teamTrim(team), 0.4, 0.25));
    trim.position.set(0, 0.16, -0.2);
    extras.push(trim);
    cloth.push(trim);
    return torso;
  }
  const w = id === "henley" ? 0.42 : 0.4;
  const h = id === "henley" ? 0.44 : 0.42;
  const d = id === "henley" ? 0.26 : 0.24;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), k.tunic);
  torso.castShadow = true;
  cloth.push(torso);
  if (id === "henley") {
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.05), k.tunic);
    collar.position.set(0, 0.19, -0.12);
    extras.push(collar);
    cloth.push(collar);
  }
  return torso;
}

/** Skull mass with facial planes: forehead slab, cheek volumes, chin block. */
function makeHead(look: Appearance, k: Kit) {
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.26), k.flesh);
  skull.scale.copy(FACE_SKULL_SCALE[look.face]);
  skull.castShadow = true;

  const forehead = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.09, 0.05), k.flesh);
  forehead.position.set(0, 0.1, -0.15);

  const chin = new THREE.Mesh(new THREE.BoxGeometry(look.face === "square" ? 0.16 : 0.12, 0.08, 0.09), k.flesh);
  chin.position.set(0, -0.15, -0.14);

  const cheekL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.11, 0.09), k.flesh);
  cheekL.position.set(-0.15, -0.01, -0.09);
  const cheekR = cheekL.clone();
  cheekR.position.x = 0.15;

  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.06, 0.05), k.flesh);
  nose.position.set(0, -0.02, -0.16);

  skull.add(forehead, chin, cheekL, cheekR, nose);

  // Eyes: dark spheres recessed behind the forehead/cheek planes.
  const eyeM = mat(0x120e0a, 0.35);
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), eyeM);
  eyeL.position.set(-0.06, 0.03, -0.09);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.06;
  skull.add(eyeL, eyeR);

  const earL = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.08, 0.05), k.flesh);
  earL.position.set(-0.155, 0, 0);
  const earR = earL.clone();
  earR.position.x = 0.155;
  skull.add(earL, earR);

  return skull;
}

/** Hair is stacked slabs stepping down over the skull, never one floating box. */
function dressHair(head: THREE.Mesh, id: HairId, k: Kit) {
  const hair = k.hair;
  if (id === "buzz") {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.05, 0.27), hair);
    cap.position.y = 0.155;
    head.add(cap);
    return;
  }
  if (id === "crew") {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.06, 0.27), hair);
    base.position.y = 0.14;
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.2), hair);
    top.position.y = 0.2;
    head.add(base, top);
    return;
  }
  if (id === "mop") {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.07, 0.29), hair);
    base.position.y = 0.14;
    const mid = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.26), hair);
    mid.position.y = 0.21;
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.2), hair);
    top.position.y = 0.26;
    const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.05), hair);
    fringe.position.set(0, 0.1, -0.15);
    head.add(base, mid, top, fringe);
    return;
  }
  if (id === "fade") {
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.18), hair);
    top.position.y = 0.17;
    const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.16), hair);
    sideL.position.set(-0.145, 0.06, 0);
    const sideR = sideL.clone();
    sideR.position.x = 0.145;
    head.add(top, sideL, sideR);
    return;
  }
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.22), hair);
  base.position.y = 0.14;
  const crown = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.16), hair);
  crown.position.set(0, 0.19, 0.03);
  const bun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.09), hair);
  bun.position.set(0, 0.2, 0.15);
  head.add(base, crown, bun);
}

function dressBeard(head: THREE.Mesh, id: BeardId, k: Kit) {
  if (id === "none") return;
  const beard = mat(BEARD_HEX, 0.9);
  if (id === "stubble") {
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.12), beard);
    jaw.position.set(0, -0.12, -0.1);
    head.add(jaw);
    return;
  }
  if (id === "goatee") {
    const chin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.08), beard);
    chin.position.set(0, -0.18, -0.14);
    head.add(chin);
    return;
  }
  if (id === "full") {
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.16), beard);
    jaw.position.set(0, -0.15, -0.08);
    const cheekL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.1), beard);
    cheekL.position.set(-0.13, -0.09, -0.1);
    const cheekR = cheekL.clone();
    cheekR.position.x = 0.13;
    head.add(jaw, cheekL, cheekR);
    return;
  }
  if (id === "braid") {
    const chin = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.07), beard);
    chin.position.set(0, -0.18, -0.14);
    const braid = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.18, 0.045), beard);
    braid.position.set(0, -0.3, -0.14);
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.06), k.helm);
    tie.position.set(0, -0.24, -0.14);
    head.add(chin, braid, tie);
    return;
  }
  if (id === "stache") {
    const stache = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.06), beard);
    stache.position.set(0, -0.07, -0.17);
    const tipL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.025, 0.04), beard);
    tipL.position.set(-0.09, -0.09, -0.16);
    const tipR = tipL.clone();
    tipR.position.x = 0.09;
    head.add(stache, tipL, tipR);
    return;
  }
  if (id === "mutton") {
    const chopL = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.18, 0.1), beard);
    chopL.position.set(-0.15, -0.09, -0.04);
    const chopR = chopL.clone();
    chopR.position.x = 0.15;
    const burnL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.06), beard);
    burnL.position.set(-0.16, 0.04, 0);
    const burnR = burnL.clone();
    burnR.position.x = 0.16;
    head.add(chopL, chopR, burnL, burnR);
    return;
  }
  if (id === "soul") {
    const patch = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.055, 0.04), beard);
    patch.position.set(0, -0.13, -0.175);
    head.add(patch);
    return;
  }
  if (id === "forked") {
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.12), beard);
    jaw.position.set(0, -0.15, -0.09);
    const tineL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.06), beard);
    tineL.position.set(-0.06, -0.28, -0.1);
    const tineR = tineL.clone();
    tineR.position.x = 0.06;
    head.add(jaw, tineL, tineR);
    return;
  }
  const brush = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.08), beard);
  brush.position.set(0, -0.08, -0.17);
  const hang = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.07), beard);
  hang.position.set(0, -0.14, -0.17);
  const chin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.08), beard);
  chin.position.set(0, -0.19, -0.13);
  head.add(brush, hang, chin);
}

function dressAccessory(head: THREE.Mesh, id: AccessoryId, k: Kit, team: Team, cloth: THREE.Mesh[]) {
  if (id === "none") return;
  if (id === "glasses") {
    const frame = mat(0x1a1814, 0.35, 0.25);
    const lens = mat(0x3a4a58, 0.18, 0.55);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.02), frame);
    bridge.position.set(0, 0.03, -0.17);
    const rimL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.02), frame);
    rimL.position.set(-0.06, 0.03, -0.165);
    const rimR = rimL.clone();
    rimR.position.x = 0.06;
    const glassL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.035, 0.012), lens);
    glassL.position.set(-0.06, 0.03, -0.172);
    const glassR = glassL.clone();
    glassR.position.x = 0.06;
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.015, 0.12), frame);
    armL.position.set(-0.1, 0.032, -0.09);
    const armR = armL.clone();
    armR.position.x = 0.1;
    head.add(bridge, rimL, rimR, glassL, glassR, armL, armR);
    return;
  }
  if (id === "scarf") {
    const wrap = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.09, 0.24), k.tunic);
    wrap.position.set(0, -0.24, 0.02);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.04), k.tunic);
    tail.position.set(0.1, -0.38, -0.06);
    tail.rotation.z = -0.25;
    const knot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.06), mat(teamTrim(team), 0.5, 0.12));
    knot.position.set(0.02, -0.26, -0.12);
    head.add(wrap, tail, knot);
    cloth.push(wrap, tail);
    return;
  }
  if (id === "earpro") {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.03, 0.04), k.helm);
    band.position.y = 0.16;
    const cupL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.08), k.helm);
    cupL.position.set(-0.18, 0.02, 0);
    const cupR = cupL.clone();
    cupR.position.x = 0.18;
    const padL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.06), mat(0x2a241c, 0.9));
    padL.position.set(-0.14, 0.02, 0);
    const padR = padL.clone();
    padR.position.x = 0.14;
    head.add(band, cupL, cupR, padL, padR);
    cloth.push(band, cupL, cupR);
    return;
  }
  if (id === "mask") {
    const cover = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.1), mat(0x2a241c, 0.82));
    cover.position.set(0, -0.09, -0.14);
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.04), k.plate);
    vent.position.set(0, -0.11, -0.19);
    const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.14), mat(0x1a1814, 0.88));
    strapL.position.set(-0.12, -0.05, -0.04);
    const strapR = strapL.clone();
    strapR.position.x = 0.12;
    head.add(cover, vent, strapL, strapR);
    return;
  }
  const cup = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.05), k.helm);
  cup.position.set(-0.18, 0.02, 0.02);
  const boom = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, 0.16), k.plate);
  boom.position.set(-0.12, -0.04, -0.08);
  boom.rotation.y = 0.45;
  boom.rotation.x = 0.2;
  const mic = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 5), k.plate);
  mic.position.set(-0.04, -0.08, -0.16);
  const cable = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.1, 0.012), mat(0x1a1814, 0.9));
  cable.position.set(-0.16, -0.1, 0.04);
  head.add(cup, boom, mic, cable);
  cloth.push(cup);
}

function dressHat(head: THREE.Mesh, id: HatId, k: Kit, _team: Team, cloth: THREE.Mesh[]) {
  if (id === "none") {
    const helm = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), k.helm);
    helm.visible = false;
    head.add(helm);
    return helm;
  }
  if (id === "watch") {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.28), k.helm);
    cap.position.y = 0.06;
    head.add(cap);
    cloth.push(cap);
    return cap;
  }
  if (id === "ushanka") {
    const crown = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.18, 0.31), k.helm);
    crown.position.y = 0.11;
    const flapL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.17, 0.17), k.helm);
    flapL.position.set(-0.19, -0.02, 0);
    const flapR = flapL.clone();
    flapR.position.x = 0.19;
    crown.add(flapL, flapR);
    head.add(crown);
    cloth.push(crown, flapL, flapR);
    return crown;
  }
  if (id === "boonie") {
    const crown = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.28), k.helm);
    crown.position.y = 0.1;
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.03, 0.4), k.helm);
    brim.position.y = 0.01;
    crown.add(brim);
    head.add(crown);
    cloth.push(crown, brim);
    return crown;
  }
  const shell = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.32), k.helm);
  shell.position.y = 0.09;
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.13), k.helm);
  brim.position.set(0, -0.06, -0.18);
  shell.add(brim);
  head.add(shell);
  cloth.push(shell, brim);
  return shell;
}

function makeLeg(side: 1 | -1, k: Kit, extras: THREE.Mesh[], look: Appearance) {
  const hip = new THREE.Group();
  hip.position.set(side * 0.11, 0.88, 0);
  hip.rotation.z = side * 0.025;

  // Thigh mass.
  const thighR = look.pants === "slim" ? 0.072 : look.pants === "cargo" ? 0.1 : 0.09;
  const thighLen = 0.4;
  const thigh = bone(0, 0, 0, 0, -thighLen, 0, thighR, k.pants);
  hip.add(thigh);
  const cloth: THREE.Mesh[] = [thigh];
  if (look.pants === "cargo") {
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.08), k.pants);
    pouch.position.set(side * 0.08, -0.18, -0.02);
    hip.add(pouch);
    extras.push(pouch);
    cloth.push(pouch);
  }

  const knee = new THREE.Group();
  knee.position.y = -thighLen;
  hip.add(knee);

  // Calf mass.
  const shinLen = look.pants === "shorts" ? 0.32 : 0.42;
  const shinMat = look.pants === "shorts" ? k.flesh : k.pants;
  const shinR = look.pants === "slim" ? 0.06 : look.pants === "shorts" ? 0.062 : 0.08;
  const shin = bone(0, 0, 0, 0, -shinLen, 0, shinR, shinMat);
  knee.add(shin);
  if (look.pants !== "shorts") cloth.push(shin);
  if (look.pants === "wrap") {
    const puttee = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.084, 0.22, 8), k.pants);
    puttee.position.y = -shinLen * 0.45;
    knee.add(puttee);
    cloth.push(puttee);
  }
  if (look.pants === "armor") {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.1), k.plate);
    plate.position.set(0, -shinLen * 0.45, -0.05);
    knee.add(plate);
    extras.push(plate);
  }
  const foot = makeShoe(look.shoes, k, shinLen);
  knee.add(foot);
  return { hip, knee, cloth, hits: [thigh, shin, foot] };
}

/** Shoes are always a boxy foot mass under the hip, toes pointing -Z. */
function makeShoe(id: ShoesId, k: Kit, shinLen: number) {
  if (id === "sneaker") {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.07, 0.2), k.boot);
    foot.position.set(0, -shinLen - 0.035, -0.07);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.132, 0.02, 0.06), mat(0xd8d0c4, 0.7));
    stripe.position.set(0, 0.02, -0.02);
    foot.add(stripe);
    foot.castShadow = true;
    return foot;
  }
  if (id === "wrap") {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.16), k.boot);
    foot.position.set(0, -shinLen - 0.025, -0.05);
    foot.castShadow = true;
    return foot;
  }
  if (id === "steel") {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.24), k.boot);
    foot.position.set(0, -shinLen - 0.05, -0.08);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.08), k.plate);
    cap.position.set(0, 0.01, -0.1);
    foot.add(cap);
    foot.castShadow = true;
    return foot;
  }
  if (id === "bare") {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.2), k.flesh);
    foot.position.set(0, -shinLen - 0.03, -0.06);
    foot.castShadow = true;
    return foot;
  }
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.22), k.boot);
  foot.position.set(0, -shinLen - 0.045, -0.08);
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
