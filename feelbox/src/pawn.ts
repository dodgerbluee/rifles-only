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

// STYLE: plate-carrier infantry
//
// Construction language: a human armature (ellipsoid skull, neck, tapered
// ribcage, capsule limbs) buried under a modern plate carrier. Identity comes
// from the kit layer -- collar, front/rear plate, deltoid protectors,
// cummerbund, groin flap, pouches, belt, drop-leg rig, brimmed helmet with a
// chin strap, heeled boots. Team colour lives on the carrier panels, deltoids
// and helmet cover so the silhouette reads at medium distance.

type Kit = {
  shirt: THREE.MeshStandardMaterial;
  carrier: THREE.MeshStandardMaterial;
  pouch: THREE.MeshStandardMaterial;
  hard: THREE.MeshStandardMaterial;
  webbing: THREE.MeshStandardMaterial;
  pants: THREE.MeshStandardMaterial;
  flesh: THREE.MeshStandardMaterial;
  glove: THREE.MeshStandardMaterial;
  boot: THREE.MeshStandardMaterial;
  helm: THREE.MeshStandardMaterial;
  hair: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
  sclera: THREE.MeshStandardMaterial;
  iris: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
};

function underHex(team: Team, shirt: ShirtId) {
  const ember = team === "ember";
  if (shirt === "parka") return ember ? 0x6a5638 : 0x39474f;
  if (shirt === "tee") return ember ? 0x8a7150 : 0x51616a;
  if (shirt === "vest") return ember ? 0x6f5c3e : 0x415058;
  return ember ? 0x776449 : 0x465459;
}

function kitFor(team: Team, look: Appearance): Kit {
  const ember = team === "ember";
  const plate = look.shirt === "plate";
  return {
    shirt: mat(underHex(team, look.shirt), 0.88),
    carrier: mat(teamCloth(team), plate ? 0.52 : 0.82, plate ? 0.22 : 0.05),
    pouch: mat(teamCloth(team), 0.86, 0.04),
    hard: mat(STEEL, 0.46, 0.38),
    webbing: mat(0x201c18, 0.9),
    pants: mat(ember ? 0x5a4630 : 0x2c3a44, look.pants === "armor" ? 0.44 : 0.9, look.pants === "armor" ? 0.4 : 0.04),
    flesh: mat(FACE_HEX[look.face], 0.74),
    glove: mat(0x2a2420, 0.86),
    boot: shoeMat(look.shoes),
    helm: mat(teamHelm(team), look.hat === "helmet" ? 0.54 : 0.86, look.hat === "helmet" ? 0.2 : 0.05),
    hair: mat(HAIR_HEX[look.hair], 0.92),
    trim: mat(teamTrim(team), 0.5, 0.18),
    sclera: mat(0xd8cdc0, 0.5),
    iris: mat(0x241a12, 0.42),
    dark: mat(0x17120e, 0.9),
  };
}

function shoeMat(id: ShoesId) {
  if (id === "sneaker") return mat(0x3a342c, 0.78);
  if (id === "wrap") return mat(0x4a3a28, 0.9);
  if (id === "steel") return mat(0x4a4e52, 0.38, 0.62);
  if (id === "bare") return mat(0xc4a07a, 0.74);
  return mat(BOOT, 0.92);
}

/** BoxGeometry with an explicit name so the walk test can find toes. */
function slab(w: number, h: number, d: number, material: THREE.Material) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
}

/** Squashed sphere -- geometry scale so children keep unit space. */
function blob(r: number, sx: number, sy: number, sz: number, material: THREE.Material, seg = 10) {
  const geo = new THREE.SphereGeometry(r, seg, Math.max(6, seg - 2));
  geo.scale(sx, sy, sz);
  return new THREE.Mesh(geo, material);
}

/** Upper half of a squashed sphere -- shells, caps, domes. */
function dome(r: number, sx: number, sy: number, sz: number, material: THREE.Material, sweep = 0.56, seg = 12) {
  const geo = new THREE.SphereGeometry(r, seg, 9, 0, Math.PI * 2, 0, Math.PI * sweep);
  geo.scale(sx, sy, sz);
  return new THREE.Mesh(geo, material);
}

/** Squashed capsule trunk -- oval cross-section, never a lathe profile. */
function trunk(r: number, len: number, sx: number, sz: number, material: THREE.Material) {
  const geo = new THREE.CapsuleGeometry(r, len, 5, 12);
  geo.scale(sx, 1, sz);
  return new THREE.Mesh(geo, material);
}

/** Open cylinder band -- collars, belts, cuffs. */
function band(rTop: number, rBot: number, h: number, sz: number, material: THREE.Material) {
  const geo = new THREE.CylinderGeometry(rTop, rBot, h, 14, 1, true);
  geo.scale(1, 1, sz);
  return new THREE.Mesh(geo, material);
}

type Torso = { r: number; len: number; sx: number; sz: number };

function torsoShape(id: ShirtId): Torso {
  if (id === "parka") return { r: 0.174, len: 0.33, sx: 1.2, sz: 0.88 };
  if (id === "tee") return { r: 0.148, len: 0.37, sx: 1.26, sz: 0.76 };
  if (id === "vest") return { r: 0.156, len: 0.35, sx: 1.24, sz: 0.79 };
  if (id === "plate") return { r: 0.152, len: 0.34, sx: 1.24, sz: 0.8 };
  return { r: 0.158, len: 0.35, sx: 1.24, sz: 0.78 };
}

function limbsPawn(team: Team, look: Appearance): PawnParts {
  const k = kitFor(team, look);
  const cloth: THREE.Mesh[] = [];
  const hits: THREE.Mesh[] = [];
  const shape = torsoShape(look.shirt);

  // Ribcage. Everything on the upper body hangs off this so the walk bob and
  // the crouch drop carry the whole rig together.
  const body = trunk(shape.r, shape.len, shape.sx, shape.sz, k.shirt);
  body.position.y = 1.18;
  cloth.push(body);
  dressUnder(body, look, k);
  dressCarrier(body, look, k, team, cloth, hits);

  const hips = blob(0.2, 1.18, 0.74, 0.88, k.pants, 10);
  hips.position.y = 0.92;
  cloth.push(hips);
  hits.push(hips);

  const beltM = look.shirt === "plate" ? k.webbing : mat(0x2c2620, 0.9);
  const belt = band(0.222, 0.226, 0.07, 0.8, beltM);
  belt.position.y = 0.945;
  const buckle = slab(0.07, 0.055, 0.03, k.hard);
  buckle.position.set(0, 0, -0.178);
  belt.add(buckle);
  const canteen = slab(0.085, 0.13, 0.07, k.pouch);
  canteen.position.set(-0.19, -0.035, 0.1);
  canteen.rotation.y = -0.4;
  belt.add(canteen);
  cloth.push(canteen);

  const lLeg = makeLeg(-1, k, look, cloth);
  const rLeg = makeLeg(1, k, look, cloth);
  hits.push(...lLeg.hits, ...rLeg.hits);

  const sleeve = look.shirt === "tee" ? k.flesh : k.shirt;
  const fore = look.shirt === "tee" || look.shirt === "vest" ? k.flesh : k.shirt;
  const upperR = look.shirt === "parka" ? 0.078 : look.shirt === "tee" ? 0.055 : 0.064;
  const foreR = upperR * 0.84;

  const lArm = bone(-0.232, 1.348, 0.0, -0.176, 1.196, -0.158, upperR, sleeve);
  const lFore = bone(-0.176, 1.196, -0.158, 0.008, 1.144, -0.386, foreR, fore);
  const rArm = bone(0.232, 1.346, 0.004, 0.232, 1.186, -0.072, upperR, sleeve);
  const rFore = bone(0.232, 1.186, -0.072, 0.136, 1.122, -0.288, foreR, fore);
  if (look.shirt !== "tee") cloth.push(lArm, rArm);
  if (look.shirt !== "tee" && look.shirt !== "vest") cloth.push(lFore, rFore);
  hits.push(lArm, lFore, rArm, rFore);

  const lElbow = blob(foreR * 1.18, 1, 1, 1, look.shirt === "plate" || look.pants === "armor" ? k.hard : fore, 8);
  lElbow.position.set(-0.176, 1.196, -0.158);
  const rElbow = lElbow.clone();
  rElbow.position.set(0.232, 1.186, -0.072);

  const lHand = makeGlove(0.008, 1.144, -0.398, -0.34, k);
  const rHand = makeGlove(0.136, 1.12, -0.298, 0.22, k);

  const head = makeHead(look, k);
  head.position.y = 1.64;
  dressHair(head, look.hair, look.face, k);
  dressBeard(head, look.beard, k);
  const helm = dressHat(head, look.hat, k, team, cloth);
  dressAccessory(head, look.accessory, k, team, cloth);

  const rifle = makeWorldKar();
  rifle.position.set(0.12, 1.14, -0.3);
  rifle.rotation.x = 0.05;
  rifle.rotation.y = 0.09;

  return {
    body,
    head,
    helm,
    rifle,
    cloth,
    hits: [...hits, belt, canteen, lElbow, rElbow, lHand, rHand],
    walk: { lHip: lLeg.hip, rHip: rLeg.hip, lKnee: lLeg.knee, rKnee: rLeg.knee },
  };
}

/** Neck, trapezius and whatever the shirt slot adds under the carrier. */
function dressUnder(body: THREE.Mesh, look: Appearance, k: Kit) {
  const traps = blob(0.128, 1.36, 0.5, 0.96, k.shirt, 10);
  traps.position.set(0, 0.222, 0.004);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.075, 0.16, 12), k.flesh);
  neck.position.set(0, 0.316, 0.012);
  neck.rotation.x = -0.06;
  body.add(traps, neck);

  if (look.shirt === "parka") {
    const hoodRoll = blob(0.104, 1.25, 0.72, 0.9, k.shirt, 10);
    hoodRoll.position.set(0, 0.3, 0.104);
    const skirt = trunk(0.168, 0.06, 1.16, 0.88, k.shirt);
    skirt.position.set(0, -0.212, 0);
    body.add(hoodRoll, skirt);
    return;
  }
  if (look.shirt === "henley") {
    const placket = slab(0.05, 0.16, 0.03, k.shirt);
    placket.position.set(0, 0.2, -0.128);
    const collarL = slab(0.075, 0.05, 0.035, k.shirt);
    collarL.position.set(-0.062, 0.268, -0.098);
    collarL.rotation.z = 0.35;
    const collarR = collarL.clone();
    collarR.position.x = 0.062;
    collarR.rotation.z = -0.35;
    body.add(placket, collarL, collarR);
    return;
  }
  if (look.shirt === "vest") {
    const cutL = slab(0.085, 0.3, 0.03, k.shirt);
    cutL.position.set(-0.115, 0.07, -0.118);
    const cutR = cutL.clone();
    cutR.position.x = 0.115;
    body.add(cutL, cutR);
  }
}

/** The plate carrier itself -- the thing that makes this a soldier. */
function dressCarrier(
  body: THREE.Mesh,
  look: Appearance,
  k: Kit,
  team: Team,
  cloth: THREE.Mesh[],
  hits: THREE.Mesh[],
) {
  const hard = look.shirt === "plate";
  const shellM = hard ? k.hard : k.carrier;

  // Ballistic collar around the base of the neck.
  const collar = band(0.128, 0.156, 0.105, 0.94, k.carrier);
  collar.position.set(0, 0.272, 0.012);
  const bib = slab(0.15, 0.075, 0.05, k.carrier);
  bib.position.set(0, 0.258, -0.128);
  bib.rotation.x = 0.16;
  body.add(collar, bib);
  cloth.push(collar, bib);

  // Front and rear plate bags.
  const front = slab(0.33, 0.42, 0.085, shellM);
  front.position.set(0, 0.018, -0.152);
  const rear = slab(0.33, 0.44, 0.08, shellM);
  rear.position.set(0, 0.022, 0.148);
  body.add(front, rear);
  cloth.push(front, rear);
  hits.push(front, rear);

  // Shoulder yokes bridging the two plates.
  const yokeL = slab(0.092, 0.06, 0.32, k.carrier);
  yokeL.position.set(-0.102, 0.242, -0.004);
  yokeL.rotation.x = -0.04;
  const yokeR = yokeL.clone();
  yokeR.position.x = 0.102;
  body.add(yokeL, yokeR);
  cloth.push(yokeL, yokeR);

  // Deltoid protectors -- layered shoulder caps, the loudest kit read.
  for (const side of [-1, 1] as const) {
    const cap = dome(0.113, 1.06, 0.94, 1.16, k.carrier, 0.62, 10);
    cap.position.set(side * 0.224, 0.186, -0.008);
    cap.rotation.z = side * -0.34;
    const lap = slab(0.12, 0.105, 0.2, k.carrier);
    lap.position.set(side * 0.252, 0.076, -0.008);
    lap.rotation.z = side * -0.2;
    body.add(cap, lap);
    cloth.push(cap, lap);
    hits.push(cap, lap);
  }

  // Cummerbund wrapping the ribs onto the belt line.
  const cummer = slab(0.415, 0.17, 0.298, k.carrier);
  cummer.position.set(0, -0.19, 0.002);
  const sideL = slab(0.06, 0.15, 0.29, k.pouch);
  sideL.position.set(-0.21, -0.19, 0.002);
  const sideR = sideL.clone();
  sideR.position.x = 0.21;
  body.add(cummer, sideL, sideR);
  cloth.push(cummer, sideL, sideR);
  hits.push(cummer);

  // Triple mag shingle on the front plate.
  for (let i = -1; i <= 1; i++) {
    const magP = slab(0.08, 0.135, 0.072, k.pouch);
    magP.position.set(i * 0.092, -0.09, -0.228);
    const flap = slab(0.082, 0.028, 0.06, k.webbing);
    flap.position.set(0, 0.078, 0.004);
    magP.add(flap);
    body.add(magP);
    cloth.push(magP);
    hits.push(magP);
  }

  // Radio on the left, admin pouch high right, dump pouch slung off the right hip.
  const radio = slab(0.095, 0.15, 0.085, k.pouch);
  radio.position.set(-0.192, 0.0, 0.112);
  const antenna = slab(0.014, 0.16, 0.014, k.webbing);
  antenna.position.set(0, 0.145, 0.02);
  antenna.rotation.x = -0.18;
  radio.add(antenna);
  const admin = slab(0.11, 0.085, 0.055, k.pouch);
  admin.position.set(0.14, 0.15, -0.188);
  const dump = slab(0.145, 0.165, 0.12, k.pouch);
  dump.position.set(0.212, -0.29, 0.072);
  dump.rotation.z = 0.14;
  body.add(radio, admin, dump);
  cloth.push(radio, admin, dump);
  hits.push(radio, dump);

  // Groin protector hanging off the cummerbund.
  const groin = slab(0.205, 0.215, 0.055, hard ? k.hard : k.carrier);
  groin.position.set(0, -0.385, -0.146);
  groin.rotation.x = 0.13;
  body.add(groin);
  cloth.push(groin);

  // Unit tape / IR tab -- a patch, not a sash.
  const tape = slab(0.13, 0.032, 0.02, k.trim);
  tape.position.set(0, 0.17, -0.198);
  const tab = slab(0.032, 0.032, 0.02, k.trim);
  tab.position.set(-0.122, 0.2, 0.192);
  body.add(tape, tab);
  cloth.push(tape, tab);

  if (look.shirt === "plate") {
    const quick = slab(0.055, 0.045, 0.028, k.trim);
    quick.position.set(0, -0.13, -0.202);
    const cable = slab(0.014, 0.19, 0.014, k.webbing);
    cable.position.set(-0.14, 0.12, -0.13);
    cable.rotation.z = -0.3;
    body.add(quick, cable);
    cloth.push(quick);
  }
}

function makeGlove(x: number, y: number, z: number, yaw: number, k: Kit) {
  const hand = slab(0.072, 0.062, 0.1, k.glove);
  hand.position.set(x, y, z);
  hand.rotation.y = yaw;
  const knuckle = blob(0.032, 1.05, 0.7, 0.8, k.glove, 8);
  knuckle.position.set(0, 0.016, -0.046);
  const thumb = slab(0.026, 0.028, 0.05, k.glove);
  thumb.position.set(0.034, 0.008, -0.018);
  hand.add(knuckle, thumb);
  return hand;
}

type SkullScale = { x: number; y: number; z: number };

function skullScale(face: Appearance["face"]): SkullScale {
  if (face === "pale") return { x: 1.0, y: 1.16, z: 1.12 };
  if (face === "olive") return { x: 0.97, y: 1.2, z: 1.1 };
  if (face === "umber") return { x: 1.03, y: 1.12, z: 1.15 };
  if (face === "square") return { x: 1.1, y: 1.14, z: 1.09 };
  return { x: 1.02, y: 1.14, z: 1.12 };
}

/** Ellipsoid skull with a real face: brow, sockets, sphere eyes, nose, jaw, ears. */
function makeHead(look: Appearance, k: Kit) {
  const s = skullScale(look.face);
  const square = look.face === "square";
  const head = blob(0.108, s.x, s.y, s.z, k.flesh, 16);

  const brow = slab(square ? 0.185 : 0.172, square ? 0.036 : 0.028, 0.055, k.flesh);
  brow.position.set(0, 0.05, -0.096);
  brow.rotation.x = -0.12;
  head.add(brow);

  for (const side of [-1, 1] as const) {
    const eye = blob(0.0198, 1, 1, 1, k.sclera, 8);
    eye.position.set(side * 0.047, 0.012, -0.096);
    const iris = blob(0.0098, 1, 1, 0.8, k.iris, 6);
    iris.position.set(side * 0.049, 0.012, -0.112);
    const lid = slab(0.048, 0.018, 0.03, k.flesh);
    lid.position.set(side * 0.047, 0.033, -0.102);
    lid.rotation.x = -0.2;
    const under = slab(0.05, 0.02, 0.032, k.flesh);
    under.position.set(side * 0.048, -0.009, -0.099);
    const cheek = blob(0.03, 1.1, 0.72, 0.85, k.flesh, 8);
    cheek.position.set(side * 0.071, -0.014, -0.08);
    const ear = blob(0.029, 0.42, 1.05, 0.72, k.flesh, 8);
    ear.position.set(side * 0.111, -0.004, 0.014);
    const lobe = slab(0.012, 0.018, 0.024, k.flesh);
    lobe.position.set(side * 0.112, -0.03, 0.016);
    head.add(eye, iris, lid, under, cheek, ear, lobe);
  }

  const bridge = slab(0.03, 0.062, 0.042, k.flesh);
  bridge.position.set(0, 0.012, -0.116);
  bridge.rotation.x = 0.1;
  const tip = blob(0.02, 1, 0.86, 1.1, k.flesh, 8);
  tip.position.set(0, -0.028, -0.124);
  const jaw = slab(square ? 0.178 : 0.15, 0.088, 0.14, k.flesh);
  jaw.position.set(0, -0.068, -0.044);
  const chin = blob(0.036, square ? 1.5 : 1.25, 0.88, 0.9, k.flesh, 8);
  chin.position.set(0, -0.086, -0.096);
  const lip = slab(0.062, 0.02, 0.026, k.flesh);
  lip.position.set(0, -0.049, -0.111);
  const mouth = slab(0.052, 0.011, 0.018, k.dark);
  mouth.position.set(0, -0.062, -0.113);
  head.add(bridge, tip, jaw, chin, lip, mouth);
  return head;
}

function dressHair(head: THREE.Mesh, id: HairId, face: Appearance["face"], k: Kit) {
  const s = skullScale(face);
  if (id === "buzz") {
    const cap = dome(0.109, s.x, s.y * 0.99, s.z, k.hair, 0.54, 12);
    cap.position.y = 0.002;
    head.add(cap);
    return;
  }
  if (id === "crew") {
    const cap = dome(0.113, s.x, s.y * 0.94, s.z, k.hair, 0.5, 12);
    cap.position.y = 0.008;
    const tuft = blob(0.062, 1.35, 0.55, 0.7, k.hair, 8);
    tuft.position.set(0, 0.098, -0.05);
    head.add(cap, tuft);
    return;
  }
  if (id === "mop") {
    const cap = dome(0.126, s.x * 1.02, s.y * 0.96, s.z * 1.04, k.hair, 0.66, 12);
    cap.position.y = -0.01;
    const fringe = blob(0.07, 1.5, 0.42, 0.5, k.hair, 8);
    fringe.position.set(0, 0.048, -0.104);
    const flapL = blob(0.05, 0.5, 1.15, 0.9, k.hair, 8);
    flapL.position.set(-0.114, -0.014, 0.014);
    const flapR = flapL.clone();
    flapR.position.x = 0.114;
    head.add(cap, fringe, flapL, flapR);
    return;
  }
  if (id === "fade") {
    const sides = dome(0.111, s.x * 0.99, s.y * 0.86, s.z, k.hair, 0.62, 12);
    sides.position.y = -0.006;
    const top = blob(0.076, 1.25, 0.6, 1.15, k.hair, 10);
    top.position.set(0, 0.068, 0.004);
    head.add(sides, top);
    return;
  }
  const cap = dome(0.11, s.x, s.y * 0.95, s.z, k.hair, 0.52, 12);
  cap.position.y = 0.004;
  const knot = blob(0.05, 1, 0.9, 1, k.hair, 10);
  knot.position.set(0, 0.078, 0.098);
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.011, 6, 10), k.dark);
  tie.position.set(0, 0.058, 0.082);
  tie.rotation.x = 1.1;
  head.add(cap, knot, tie);
}

function dressBeard(head: THREE.Mesh, id: BeardId, k: Kit) {
  if (id === "none") return;
  const hair = mat(BEARD_HEX, 0.93);
  if (id === "stubble") {
    const jaw = slab(0.156, 0.06, 0.118, hair);
    jaw.position.set(0, -0.078, -0.058);
    const lipLine = slab(0.06, 0.016, 0.026, hair);
    lipLine.position.set(0, -0.047, -0.114);
    head.add(jaw, lipLine);
    return;
  }
  if (id === "goatee") {
    const chin = slab(0.058, 0.062, 0.05, hair);
    chin.position.set(0, -0.098, -0.1);
    const stache = slab(0.09, 0.02, 0.03, hair);
    stache.position.set(0, -0.046, -0.114);
    head.add(chin, stache);
    return;
  }
  if (id === "full") {
    const jaw = blob(0.088, 1.05, 0.7, 0.95, hair, 10);
    jaw.position.set(0, -0.082, -0.052);
    const chopL = slab(0.04, 0.115, 0.075, hair);
    chopL.position.set(-0.096, -0.04, -0.026);
    const chopR = chopL.clone();
    chopR.position.x = 0.096;
    const chin = slab(0.086, 0.07, 0.06, hair);
    chin.position.set(0, -0.114, -0.092);
    head.add(jaw, chopL, chopR, chin);
    return;
  }
  if (id === "braid") {
    const chin = slab(0.055, 0.06, 0.05, hair);
    chin.position.set(0, -0.098, -0.1);
    const braid = slab(0.03, 0.105, 0.03, hair);
    braid.position.set(0, -0.178, -0.1);
    const tie = slab(0.038, 0.02, 0.038, k.webbing);
    tie.position.set(0, -0.134, -0.1);
    head.add(chin, braid, tie);
    return;
  }
  if (id === "stache") {
    const bar = slab(0.104, 0.024, 0.036, hair);
    bar.position.set(0, -0.048, -0.112);
    const tipL = slab(0.03, 0.018, 0.03, hair);
    tipL.position.set(-0.058, -0.056, -0.104);
    const tipR = tipL.clone();
    tipR.position.x = 0.058;
    head.add(bar, tipL, tipR);
    return;
  }
  if (id === "mutton") {
    const chopL = slab(0.038, 0.12, 0.072, hair);
    chopL.position.set(-0.098, -0.042, -0.024);
    const chopR = chopL.clone();
    chopR.position.x = 0.098;
    const burnL = slab(0.028, 0.07, 0.05, hair);
    burnL.position.set(-0.102, 0.028, -0.006);
    const burnR = burnL.clone();
    burnR.position.x = 0.102;
    head.add(chopL, chopR, burnL, burnR);
    return;
  }
  if (id === "soul") {
    const patch = slab(0.03, 0.032, 0.026, hair);
    patch.position.set(0, -0.078, -0.112);
    head.add(patch);
    return;
  }
  if (id === "forked") {
    const jaw = slab(0.15, 0.07, 0.11, hair);
    jaw.position.set(0, -0.09, -0.06);
    const tineL = slab(0.04, 0.1, 0.04, hair);
    tineL.position.set(-0.038, -0.17, -0.078);
    const tineR = tineL.clone();
    tineR.position.x = 0.038;
    head.add(jaw, tineL, tineR);
    return;
  }
  const brush = slab(0.134, 0.044, 0.05, hair);
  brush.position.set(0, -0.046, -0.108);
  const hang = slab(0.12, 0.05, 0.045, hair);
  hang.position.set(0, -0.074, -0.108);
  const chin = slab(0.07, 0.05, 0.055, hair);
  chin.position.set(0, -0.104, -0.094);
  head.add(brush, hang, chin);
}

function dressAccessory(head: THREE.Mesh, id: AccessoryId, k: Kit, team: Team, cloth: THREE.Mesh[]) {
  if (id === "none") return;
  if (id === "glasses") {
    const frame = mat(0x181512, 0.38, 0.28);
    const lens = mat(0x2e3c46, 0.2, 0.5);
    const core = slab(0.11, 0.036, 0.018, lens);
    core.position.set(0, 0.016, -0.118);
    const wingL = slab(0.055, 0.034, 0.018, lens);
    wingL.position.set(-0.082, 0.016, -0.106);
    wingL.rotation.y = -0.5;
    const wingR = wingL.clone();
    wingR.position.x = 0.082;
    wingR.rotation.y = 0.5;
    const brow = slab(0.19, 0.012, 0.02, frame);
    brow.position.set(0, 0.038, -0.11);
    const templeL = slab(0.016, 0.012, 0.11, frame);
    templeL.position.set(-0.102, 0.022, -0.056);
    const templeR = templeL.clone();
    templeR.position.x = 0.102;
    head.add(core, wingL, wingR, brow, templeL, templeR);
    return;
  }
  if (id === "scarf") {
    const wrap = blob(0.112, 1.12, 0.52, 1.0, k.shirt, 12);
    wrap.position.set(0, -0.176, 0.008);
    const knot = slab(0.07, 0.06, 0.055, k.shirt);
    knot.position.set(0.028, -0.184, -0.09);
    const tail = slab(0.085, 0.19, 0.038, k.shirt);
    tail.position.set(0.086, -0.27, -0.056);
    tail.rotation.z = -0.22;
    const pin = slab(0.03, 0.026, 0.02, k.trim);
    pin.position.set(0.028, -0.174, -0.116);
    head.add(wrap, knot, tail, pin);
    cloth.push(wrap, knot, tail);
    return;
  }
  if (id === "earpro") {
    const arch = new THREE.Mesh(new THREE.TorusGeometry(0.112, 0.014, 6, 14, Math.PI), k.webbing);
    arch.position.set(0, 0.052, 0.008);
    arch.rotation.z = Math.PI;
    const padTop = slab(0.05, 0.022, 0.05, k.dark);
    padTop.position.set(0, 0.128, 0.008);
    head.add(arch, padTop);
    for (const side of [-1, 1] as const) {
      const cup = slab(0.05, 0.088, 0.072, k.helm);
      cup.position.set(side * 0.132, -0.01, 0.012);
      const seal = slab(0.022, 0.072, 0.058, k.dark);
      seal.position.set(side * -0.032, 0, 0);
      cup.add(seal);
      head.add(cup);
      cloth.push(cup);
    }
    const boom = slab(0.012, 0.012, 0.1, k.webbing);
    boom.position.set(-0.094, -0.05, -0.062);
    boom.rotation.y = 0.5;
    boom.rotation.x = 0.22;
    const mic = blob(0.016, 1, 1, 1, k.dark, 6);
    mic.position.set(-0.05, -0.068, -0.112);
    head.add(boom, mic);
    return;
  }
  if (id === "mask") {
    const cover = blob(0.082, 1.02, 0.66, 0.9, mat(0x282320, 0.86), 10);
    cover.position.set(0, -0.058, -0.072);
    const bridge = slab(0.062, 0.028, 0.03, k.hard);
    bridge.position.set(0, -0.012, -0.112);
    const vent = slab(0.05, 0.03, 0.022, k.dark);
    vent.position.set(0, -0.07, -0.13);
    const strapL = slab(0.03, 0.026, 0.11, k.webbing);
    strapL.position.set(-0.104, -0.032, -0.024);
    const strapR = strapL.clone();
    strapR.position.x = 0.104;
    head.add(cover, bridge, vent, strapL, strapR);
    return;
  }
  const cup = slab(0.044, 0.07, 0.055, k.helm);
  cup.position.set(-0.13, -0.008, 0.014);
  const boom = slab(0.012, 0.012, 0.115, k.webbing);
  boom.position.set(-0.096, -0.052, -0.058);
  boom.rotation.y = 0.48;
  boom.rotation.x = 0.2;
  const mic = blob(0.018, 1, 1, 1, k.dark, 6);
  mic.position.set(-0.046, -0.072, -0.114);
  const cable = slab(0.011, 0.14, 0.011, k.webbing);
  cable.position.set(-0.134, -0.09, 0.05);
  cable.rotation.z = -0.16;
  const ptt = slab(0.024, 0.03, 0.016, k.trim);
  ptt.position.set(-0.134, -0.16, 0.048);
  head.add(cup, boom, mic, cable, ptt);
  cloth.push(cup, ptt);
}

function dressHat(head: THREE.Mesh, id: HatId, k: Kit, team: Team, cloth: THREE.Mesh[]) {
  if (id === "none") {
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.01, 4, 4), k.helm);
    helm.visible = false;
    head.add(helm);
    return helm;
  }
  if (id === "watch") {
    const cap = dome(0.116, 1.02, 1.08, 1.04, k.helm, 0.62, 12);
    cap.position.y = -0.004;
    const roll = new THREE.Mesh(new THREE.TorusGeometry(0.104, 0.024, 7, 14), k.helm);
    roll.position.y = 0.006;
    roll.rotation.x = Math.PI / 2;
    cap.add(roll);
    head.add(cap);
    cloth.push(cap, roll);
    return cap;
  }
  if (id === "ushanka") {
    const crown = dome(0.124, 1.04, 1.02, 1.06, k.helm, 0.64, 12);
    crown.position.y = -0.008;
    const fur = new THREE.Mesh(new THREE.TorusGeometry(0.112, 0.03, 7, 14), k.helm);
    fur.position.y = 0.012;
    fur.rotation.x = Math.PI / 2;
    const flapL = slab(0.04, 0.115, 0.1, k.helm);
    flapL.position.set(-0.122, -0.048, 0.012);
    flapL.rotation.z = 0.1;
    const flapR = flapL.clone();
    flapR.position.x = 0.122;
    flapR.rotation.z = -0.1;
    const nape = slab(0.14, 0.075, 0.045, k.helm);
    nape.position.set(0, -0.052, 0.1);
    crown.add(fur, flapL, flapR, nape);
    head.add(crown);
    cloth.push(crown, fur, flapL, flapR, nape);
    return crown;
  }
  if (id === "boonie") {
    const crown = dome(0.118, 1.03, 0.95, 1.05, k.helm, 0.58, 12);
    crown.position.y = 0.006;
    const brimGeo = new THREE.CylinderGeometry(0.212, 0.196, 0.018, 16);
    const brim = new THREE.Mesh(brimGeo, k.helm);
    brim.position.set(0, -0.026, -0.006);
    brim.rotation.x = -0.05;
    const bandRing = new THREE.Mesh(new THREE.TorusGeometry(0.108, 0.013, 6, 14), k.webbing);
    bandRing.position.y = 0.004;
    bandRing.rotation.x = Math.PI / 2;
    crown.add(brim, bandRing);
    head.add(crown);
    cloth.push(crown, brim);
    return crown;
  }

  // Ballistic helmet: shell, front brim, side rails, NVG shroud, chin strap.
  const shell = dome(0.132, 1.06, 1.0, 1.1, k.helm, 0.6, 16);
  shell.position.y = 0.022;
  const brim = slab(0.196, 0.028, 0.088, k.helm);
  brim.position.set(0, -0.062, -0.126);
  brim.rotation.x = -0.2;
  const nape = slab(0.15, 0.06, 0.05, k.helm);
  nape.position.set(0, -0.058, 0.118);
  const shroud = slab(0.058, 0.03, 0.05, k.hard);
  shroud.position.set(0, -0.006, -0.138);
  const railL = slab(0.018, 0.024, 0.14, k.hard);
  railL.position.set(-0.138, -0.044, -0.008);
  const railR = railL.clone();
  railR.position.x = 0.138;
  const dial = blob(0.026, 1, 1, 0.7, k.hard, 8);
  dial.position.set(0, -0.05, 0.128);
  const stripe = slab(0.04, 0.02, 0.05, k.trim);
  stripe.position.set(0.09, -0.03, 0.098);
  shell.add(brim, nape, shroud, railL, railR, dial, stripe);
  head.add(shell);

  const strapL = slab(0.016, 0.115, 0.02, k.webbing);
  strapL.position.set(-0.108, -0.104, -0.026);
  strapL.rotation.z = 0.12;
  const strapR = strapL.clone();
  strapR.position.x = 0.108;
  strapR.rotation.z = -0.12;
  const rearL = slab(0.015, 0.1, 0.02, k.webbing);
  rearL.position.set(-0.1, -0.09, 0.062);
  rearL.rotation.z = 0.1;
  const rearR = rearL.clone();
  rearR.position.x = 0.1;
  const cup = slab(0.075, 0.036, 0.055, k.webbing);
  cup.position.set(0, -0.15, -0.082);
  cup.rotation.x = 0.2;
  head.add(strapL, strapR, rearL, rearR, cup);
  cloth.push(shell, brim, nape, stripe);
  return shell;
}

function makeLeg(side: 1 | -1, k: Kit, look: Appearance, cloth: THREE.Mesh[]) {
  const hip = new THREE.Group();
  hip.position.set(side * 0.102, 0.88, side > 0 ? -0.02 : 0.02);
  hip.rotation.z = side * 0.03;

  const thighR = look.pants === "slim" ? 0.072 : look.pants === "cargo" ? 0.094 : 0.086;
  const thighLen = 0.4;
  const thigh = bone(0, 0, 0, 0, -thighLen, 0, thighR, k.pants);
  hip.add(thigh);
  cloth.push(thigh);

  if (look.pants === "cargo" && side < 0) {
    const pocket = slab(0.105, 0.12, 0.085, k.pants);
    pocket.position.set(side * 0.075, -0.19, 0.02);
    const flap = slab(0.108, 0.026, 0.088, k.webbing);
    flap.position.set(0, 0.07, 0);
    pocket.add(flap);
    hip.add(pocket);
    cloth.push(pocket);
  }

  if (side > 0) {
    // Drop-leg holster rig.
    const strapHi = slab(0.024, 0.14, 0.018, k.webbing);
    strapHi.position.set(0.082, -0.1, 0.01);
    const holster = slab(0.085, 0.145, 0.07, k.pouch);
    holster.position.set(0.098, -0.225, 0.012);
    holster.rotation.z = -0.06;
    const hood = slab(0.088, 0.032, 0.074, k.webbing);
    hood.position.set(0, 0.078, 0);
    holster.add(hood);
    const legStrap = slab(0.118, 0.026, 0.104, k.webbing);
    legStrap.position.set(0.04, -0.29, 0.012);
    hip.add(strapHi, holster, legStrap);
    cloth.push(holster);
  }

  const knee = new THREE.Group();
  knee.position.y = -thighLen;
  hip.add(knee);

  const shinLen = 0.42;
  const shinMat = look.pants === "shorts" ? k.flesh : k.pants;
  const shinR = look.pants === "slim" ? 0.052 : look.pants === "shorts" ? 0.056 : 0.062;
  const shin = bone(0, 0, 0, 0, -shinLen, 0, shinR, shinMat);
  knee.add(shin);
  if (look.pants !== "shorts") cloth.push(shin);

  if (look.pants === "shorts") {
    const hem = band(thighR * 1.14, thighR * 1.2, 0.05, 1, k.pants);
    hem.position.y = -thighLen + 0.03;
    hip.add(hem);
    cloth.push(hem);
  }

  if (look.pants === "armor") {
    const pad = slab(0.115, 0.115, 0.075, k.hard);
    pad.position.set(0, -0.03, -0.055);
    const shinPlate = slab(0.11, 0.2, 0.06, k.hard);
    shinPlate.position.set(0, -shinLen * 0.55, -0.062);
    knee.add(pad, shinPlate);
  } else if (look.pants === "cargo" || look.pants === "slim") {
    const pad = slab(0.108, 0.1, 0.065, k.webbing);
    pad.position.set(0, -0.026, -0.05);
    knee.add(pad);
  } else if (look.pants === "wrap") {
    const puttee = band(0.088, 0.08, 0.2, 1, k.pants);
    puttee.position.y = -shinLen * 0.46;
    const tie = slab(0.026, 0.05, 0.026, k.webbing);
    tie.position.set(0.08, -shinLen * 0.36, 0);
    knee.add(puttee, tie);
    cloth.push(puttee);
  }

  // Boot last: the walk test grabs the deepest BoxGeometry under the hip.
  const foot = makeShoe(look.shoes, k, shinLen);
  knee.add(foot);
  return { hip, knee, hits: [thigh, shin, foot] };
}

/**
 * Every shoe is a BoxGeometry upper under the hip with a heel block and a
 * forward toe box, so the toe is always the last box in traversal order.
 */
function makeShoe(id: ShoesId, k: Kit, shinLen: number) {
  // Ankle sits at the shin end; every variant grounds its sole at world y ~0.
  if (id === "sneaker") {
    const foot = slab(0.122, 0.078, 0.172, k.boot);
    foot.position.set(0, -shinLen + 0.008, -0.035);
    const collar = slab(0.114, 0.05, 0.08, k.boot);
    collar.position.set(0, 0.048, 0.042);
    const sole = slab(0.13, 0.03, 0.238, mat(0xd6cec2, 0.72));
    sole.position.set(0, -0.045, -0.034);
    const heel = slab(0.126, 0.042, 0.062, mat(0xd6cec2, 0.72));
    heel.position.set(0, -0.039, 0.064);
    const toe = slab(0.116, 0.055, 0.076, k.boot);
    toe.position.set(0, -0.016, -0.118);
    foot.add(collar, sole, heel, toe);
    foot.castShadow = true;
    return foot;
  }
  if (id === "wrap") {
    const foot = slab(0.114, 0.062, 0.158, k.boot);
    foot.position.set(0, -shinLen - 0.005, -0.03);
    const lash = slab(0.118, 0.02, 0.032, k.webbing);
    lash.position.set(0, 0.024, -0.024);
    const shank = slab(0.108, 0.022, 0.2, k.boot);
    shank.position.set(0, -0.036, -0.03);
    const heel = slab(0.104, 0.038, 0.052, k.boot);
    heel.position.set(0, -0.042, 0.058);
    const toe = slab(0.102, 0.046, 0.062, k.boot);
    toe.position.set(0, -0.022, -0.102);
    foot.add(lash, shank, heel, toe);
    foot.castShadow = true;
    return foot;
  }
  if (id === "steel") {
    const foot = slab(0.138, 0.1, 0.186, k.boot);
    foot.position.set(0, -shinLen + 0.012, -0.04);
    const cuff = slab(0.13, 0.075, 0.115, k.boot);
    cuff.position.set(0, 0.08, 0.03);
    const sole = slab(0.142, 0.03, 0.252, k.dark);
    sole.position.set(0, -0.045, -0.038);
    const heel = slab(0.134, 0.055, 0.068, k.dark);
    heel.position.set(0, -0.0325, 0.068);
    const cap = slab(0.132, 0.072, 0.082, k.hard);
    cap.position.set(0, -0.008, -0.128);
    foot.add(cuff, sole, heel, cap);
    foot.castShadow = true;
    return foot;
  }
  if (id === "bare") {
    const foot = slab(0.104, 0.056, 0.152, k.flesh);
    foot.position.set(0, -shinLen - 0.022, -0.028);
    const ankle = blob(0.05, 1.0, 0.72, 1.0, k.flesh, 8);
    ankle.position.set(0, 0.022, 0.03);
    const pad = slab(0.098, 0.022, 0.13, k.flesh);
    pad.position.set(0, -0.032, -0.03);
    const heel = slab(0.09, 0.04, 0.052, k.flesh);
    heel.position.set(0, -0.038, 0.056);
    const toes = slab(0.098, 0.036, 0.05, k.flesh);
    toes.position.set(0, -0.03, -0.098);
    foot.add(ankle, pad, heel, toes);
    foot.castShadow = true;
    return foot;
  }
  const foot = slab(0.13, 0.095, 0.176, k.boot);
  foot.position.set(0, -shinLen, -0.036);
  const cuff = slab(0.124, 0.085, 0.118, k.boot);
  cuff.position.set(0, 0.075, 0.028);
  const laces = slab(0.058, 0.09, 0.03, k.webbing);
  laces.position.set(0, 0.05, -0.062);
  const sole = slab(0.134, 0.026, 0.248, k.dark);
  sole.position.set(0, -0.047, -0.036);
  const heel = slab(0.126, 0.055, 0.064, k.dark);
  heel.position.set(0, -0.0325, 0.066);
  const toe = slab(0.12, 0.062, 0.08, k.boot);
  toe.position.set(0, -0.019, -0.122);
  foot.add(cuff, laces, sole, heel, toe);
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
