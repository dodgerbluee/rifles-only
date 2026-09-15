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
  joint: THREE.MeshStandardMaterial;
  darkWood: THREE.MeshStandardMaterial;
  boot: THREE.MeshStandardMaterial;
  helm: THREE.MeshStandardMaterial;
  plate: THREE.MeshStandardMaterial;
  hair: THREE.MeshStandardMaterial;
};

function tint(hex: number, f: number) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return c.getHex();
}

function kitFor(team: Team, look: Appearance): Kit {
  const ember = team === "ember";
  const plate = look.shirt === "plate";
  return {
    tunic: mat(teamCloth(team), plate ? 0.42 : 0.82, plate ? 0.45 : 0.04),
    pants: mat(ember ? 0x5a2410 : 0x1a3a58, look.pants === "armor" ? 0.4 : 0.9, look.pants === "armor" ? 0.45 : 0.04),
    flesh: mat(FACE_HEX[look.face], 0.70, 0.03),
    joint: mat(tint(FACE_HEX[look.face], 0.82), 0.65, 0.05),
    darkWood: mat(0x1a120c, 0.45, 0.08),
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

function ballJoint(x: number, y: number, z: number, r: number, material: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

function makeMannequinShoe(id: ShoesId, k: Kit) {
  if (id === "sneaker") {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.065, 0.20), k.boot);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.116, 0.02, 0.21), mat(0xd8d0c4, 0.7));
    sole.position.set(0, -0.04, -0.005);
    foot.add(sole);
    foot.castShadow = true;
    return foot;
  }
  if (id === "wrap") {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.06, 0.18), k.boot);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 12), k.boot);
    strap.position.set(0, 0.01, -0.02);
    foot.add(strap);
    foot.castShadow = true;
    return foot;
  }
  if (id === "steel") {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.075, 0.21), k.boot);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.122, 0.055, 0.065), k.plate);
    cap.position.set(0, 0.01, -0.08);
    foot.add(cap);
    foot.castShadow = true;
    return foot;
  }
  if (id === "bare") {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.055, 0.18), k.flesh);
    for (let i = -2; i <= 2; i++) {
      const toe = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), k.flesh);
      toe.position.set(i * 0.021, -0.012, -0.095);
      foot.add(toe);
    }
    foot.castShadow = true;
    return foot;
  }
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.075, 0.20), k.boot);
  const toeCap = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 8), k.boot);
  toeCap.scale.set(1.0, 0.7, 1.0);
  toeCap.position.set(0, -0.005, -0.08);
  foot.add(toeCap);
  foot.castShadow = true;
  return foot;
}

function makeLeg(side: 1 | -1, k: Kit, look: Appearance) {
  const hip = new THREE.Group();
  hip.position.set(side * 0.11, 0.88, side > 0 ? -0.01 : 0.01);
  hip.rotation.z = side * 0.02;

  const cloth: THREE.Mesh[] = [];
  const hits: THREE.Mesh[] = [];

  // Explicit SphereGeometry ball joint at hip
  const hipBall = ballJoint(0, 0, 0, 0.052, k.pants);
  hip.add(hipBall);
  cloth.push(hipBall);
  hits.push(hipBall);

  // Smooth capsule thigh between hip and knee
  const thighLen = 0.40;
  const thighR = look.pants === "slim" ? 0.044 : look.pants === "cargo" ? 0.056 : 0.050;
  const thigh = bone(0, 0, 0, 0, -thighLen, 0, thighR, k.pants);
  hip.add(thigh);
  cloth.push(thigh);
  hits.push(thigh);

  if (look.pants === "cargo") {
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.08), k.pants);
    pocket.position.set(side * (thighR + 0.015), -0.20, 0.01);
    hip.add(pocket);
    cloth.push(pocket);
    hits.push(pocket);
  }

  const knee = new THREE.Group();
  knee.position.set(0, -thighLen, 0);
  hip.add(knee);

  // Explicit SphereGeometry ball joint at knee
  const isShorts = look.pants === "shorts";
  const kneeBall = ballJoint(0, 0, 0, 0.046, isShorts ? k.flesh : k.pants);
  knee.add(kneeBall);
  if (!isShorts) cloth.push(kneeBall);
  hits.push(kneeBall);

  // Smooth capsule shin between knee and ankle
  const shinLen = 0.38;
  const shinR = look.pants === "slim" ? 0.038 : 0.044;
  const shin = bone(0, 0, 0, 0, -shinLen, 0, shinR, isShorts ? k.flesh : k.pants);
  knee.add(shin);
  if (!isShorts) cloth.push(shin);
  hits.push(shin);

  if (look.pants === "wrap") {
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(shinR + 0.006, 0.008, 6, 14), k.pants);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -0.16 - i * 0.07;
      knee.add(ring);
      cloth.push(ring);
      hits.push(ring);
    }
  }

  if (look.pants === "armor") {
    const shinGuard = new THREE.Mesh(
      new THREE.CylinderGeometry(shinR + 0.018, shinR + 0.014, 0.20, 10, 1, false, -Math.PI * 0.35, Math.PI * 0.7),
      k.plate,
    );
    shinGuard.position.set(0, -0.20, 0);
    shinGuard.rotation.y = Math.PI;
    knee.add(shinGuard);
    hits.push(shinGuard);
  }

  // Explicit SphereGeometry ball joint at ankle
  const ankleBall = ballJoint(0, -shinLen, 0, 0.036, look.shoes === "bare" ? k.flesh : k.boot);
  knee.add(ankleBall);
  hits.push(ankleBall);

  // Articulated wooden shoe with BoxGeometry pointing -Z
  const foot = makeMannequinShoe(look.shoes, k);
  foot.position.set(0, -shinLen - 0.04, -0.065);
  knee.add(foot);
  hits.push(foot);

  return { hip, knee, cloth, hits };
}

function makeHead(look: Appearance, k: Kit) {
  // Skull is an ellipsoid
  const skullGeo = new THREE.SphereGeometry(0.16, 18, 14);
  skullGeo.scale(0.94, 1.12, 1.04);
  const head = new THREE.Mesh(skullGeo, k.flesh);
  head.castShadow = true;

  if (look.face === "pale") head.scale.set(0.96, 1.0, 0.98);
  else if (look.face === "olive") head.scale.set(0.93, 1.04, 0.98);
  else if (look.face === "umber") head.scale.set(1.03, 0.98, 1.02);
  else if (look.face === "square") {
    head.scale.set(1.02, 0.98, 1.0);
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), k.flesh);
    jaw.scale.set(1.18, 0.65, 0.85);
    jaw.position.set(0, -0.12, -0.06);
    head.add(jaw);
  }

  // Face is simplified but human: two dark sphere eyes in sockets, a small cone nose, no box features
  for (const s of [-1, 1]) {
    const socket = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), k.joint);
    socket.scale.set(1.0, 0.85, 0.25);
    socket.position.set(s * 0.052, 0.015, -0.155);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), k.darkWood);
    eye.position.set(s * 0.052, 0.015, -0.162);
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), k.flesh);
    ear.scale.set(0.35, 1.0, 0.65);
    ear.position.set(s * 0.150, 0.005, -0.01);
    head.add(socket, eye, ear);
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.046, 10), k.flesh);
  nose.position.set(0, -0.022, -0.170);
  nose.rotation.x = -Math.PI / 2 - 0.22;
  head.add(nose);

  return head;
}

// STYLE: wooden mannequin
function limbsPawn(team: Team, look: Appearance): PawnParts {
  const k = kitFor(team, look);
  const cloth: THREE.Mesh[] = [];
  const hits: THREE.Mesh[] = [];

  // Head: ellipsoid skull
  const head = makeHead(look, k);
  head.position.set(0, 1.64, -0.01);

  // Torso: flattened capsule ribcage
  const ribGeo = new THREE.CapsuleGeometry(0.138, 0.17, 6, 14);
  ribGeo.scale(1.22, 1.0, 0.76);
  const body = new THREE.Mesh(ribGeo, k.tunic);
  body.position.y = BODY_REST_Y; // 1.18
  body.castShadow = true;
  cloth.push(body);

  // Waist connector capsule linking ribcage and pelvis
  const waistGeo = new THREE.CapsuleGeometry(0.075, 0.05, 4, 12);
  waistGeo.scale(1.15, 1.0, 0.80);
  const waist = new THREE.Mesh(waistGeo, k.joint);
  waist.position.set(0, -0.18, 0);
  waist.castShadow = true;
  body.add(waist);
  hits.push(waist);

  // Pelvis: flattened capsule cradling the hips
  const pelGeo = new THREE.CapsuleGeometry(0.128, 0.065, 6, 14);
  pelGeo.scale(1.20, 0.90, 0.82);
  const pelvis = new THREE.Mesh(pelGeo, k.pants);
  pelvis.position.set(0, -0.28, 0);
  pelvis.castShadow = true;
  body.add(pelvis);
  cloth.push(pelvis);
  hits.push(pelvis);

  // Shirt kit pieces
  if (look.shirt === "henley") {
    for (let i = 0; i < 3; i++) {
      const btn = new THREE.Mesh(new THREE.SphereGeometry(0.010, 8, 6), k.flesh);
      btn.position.set(0, 0.08 - i * 0.05, -0.115);
      body.add(btn);
    }
  } else if (look.shirt === "vest") {
    const vestShell = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.144, 0.17, 6, 14),
      mat(0x2a221a, 0.88),
    );
    vestShell.geometry.scale(1.23, 1.0, 0.78);
    body.add(vestShell);
    hits.push(vestShell);
  } else if (look.shirt === "parka") {
    const hood = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.032, 6, 14), k.tunic);
    hood.position.set(0, 0.18, 0.05);
    hood.rotation.x = 0.6;
    body.add(hood);
    cloth.push(hood);
    hits.push(hood);
  } else if (look.shirt === "plate") {
    const plateMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.45),
      k.plate,
    );
    plateMesh.scale.set(1.15, 0.9, 0.4);
    plateMesh.position.set(0, 0.04, -0.10);
    plateMesh.rotation.x = Math.PI / 2;
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.025, 0.02), mat(teamTrim(team), 0.4, 0.25));
    trim.position.set(0, 0.08, -0.125);
    body.add(plateMesh, trim);
    cloth.push(trim);
    hits.push(plateMesh, trim);
  }

  // Neck: a real cylinder with a ball joint at the base of the skull
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.048, 0.10, 12), k.flesh);
  neck.position.set(0, 0.28, 0); // world y: 1.46
  neck.castShadow = true;
  body.add(neck);
  hits.push(neck);

  const skullJoint = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), k.joint);
  skullJoint.position.set(0, 0.35, 0); // world y: 1.53
  skullJoint.castShadow = true;
  body.add(skullJoint);
  hits.push(skullJoint);

  // Arms: explicit SphereGeometry ball joints at shoulder, elbow, wrist with smooth capsules
  const isVest = look.shirt === "vest";
  const isTee = look.shirt === "tee";
  const isSleeveless = isVest || isTee;

  // Left Arm (supports rifle fore-end)
  const lShoulder = ballJoint(-0.22, 0.17, 0.0, 0.046, isVest ? k.flesh : k.tunic);
  const lElbow = ballJoint(-0.16, 0.01, -0.16, 0.040, isSleeveless ? k.flesh : k.tunic);
  const lWrist = ballJoint(0.02, -0.06, -0.38, 0.032, k.flesh);
  const lHand = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), k.flesh);
  lHand.scale.set(0.9, 0.7, 1.2);
  lHand.position.set(0.02, -0.06, -0.41);
  lHand.castShadow = true;

  body.add(lShoulder, lElbow, lWrist, lHand);
  hits.push(lShoulder, lElbow, lWrist, lHand);
  if (!isVest) cloth.push(lShoulder);
  if (!isSleeveless) cloth.push(lElbow);

  if (isTee) {
    const lUpperSleeve = bone(-0.22, 0.17, 0.0, -0.19, 0.09, -0.08, 0.044, k.tunic);
    const lUpperBare = bone(-0.19, 0.09, -0.08, -0.16, 0.01, -0.16, 0.041, k.flesh);
    body.add(lUpperSleeve, lUpperBare);
    cloth.push(lUpperSleeve);
    hits.push(lUpperSleeve, lUpperBare);
  } else {
    const lUpper = bone(-0.22, 0.17, 0.0, -0.16, 0.01, -0.16, 0.043, isVest ? k.flesh : k.tunic);
    body.add(lUpper);
    if (!isVest) cloth.push(lUpper);
    hits.push(lUpper);
  }

  const lFore = bone(-0.16, 0.01, -0.16, 0.02, -0.06, -0.38, 0.036, isSleeveless ? k.flesh : k.tunic);
  body.add(lFore);
  if (!isSleeveless) cloth.push(lFore);
  hits.push(lFore);

  // Right Arm (grips trigger / stock)
  const rShoulder = ballJoint(0.22, 0.17, 0.0, 0.046, isVest ? k.flesh : k.tunic);
  const rElbow = ballJoint(0.22, 0.00, -0.10, 0.040, isSleeveless ? k.flesh : k.tunic);
  const rWrist = ballJoint(0.13, -0.08, -0.27, 0.032, k.flesh);
  const rHand = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), k.flesh);
  rHand.scale.set(0.9, 0.7, 1.2);
  rHand.position.set(0.13, -0.08, -0.30);
  rHand.castShadow = true;

  body.add(rShoulder, rElbow, rWrist, rHand);
  hits.push(rShoulder, rElbow, rWrist, rHand);
  if (!isVest) cloth.push(rShoulder);
  if (!isSleeveless) cloth.push(rElbow);

  if (isTee) {
    const rUpperSleeve = bone(0.22, 0.17, 0.0, 0.22, 0.085, -0.05, 0.044, k.tunic);
    const rUpperBare = bone(0.22, 0.085, -0.05, 0.22, 0.00, -0.10, 0.041, k.flesh);
    body.add(rUpperSleeve, rUpperBare);
    cloth.push(rUpperSleeve);
    hits.push(rUpperSleeve, rUpperBare);
  } else {
    const rUpper = bone(0.22, 0.17, 0.0, 0.22, 0.00, -0.10, 0.043, isVest ? k.flesh : k.tunic);
    body.add(rUpper);
    if (!isVest) cloth.push(rUpper);
    hits.push(rUpper);
  }

  const rFore = bone(0.22, 0.00, -0.10, 0.13, -0.08, -0.27, 0.036, isSleeveless ? k.flesh : k.tunic);
  body.add(rFore);
  if (!isSleeveless) cloth.push(rFore);
  hits.push(rFore);

  // Legs with WalkRig
  const lLeg = makeLeg(-1, k, look);
  const rLeg = makeLeg(1, k, look);
  cloth.push(...lLeg.cloth, ...rLeg.cloth);

  dressHair(head, look.hair, k);
  dressBeard(head, look.beard, k);
  const helm = dressHat(head, look.hat, k, team, cloth);
  dressAccessory(head, look.accessory, k, team, cloth);

  // Rifle
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
    hits: [...hits, ...lLeg.hits, ...rLeg.hits],
    walk: { lHip: lLeg.hip, rHip: rLeg.hip, lKnee: lLeg.knee, rKnee: rLeg.knee },
  };
}

function dressHair(head: THREE.Mesh, id: HairId, k: Kit) {
  if (id === "buzz") {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.162, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), k.hair);
    cap.scale.set(0.95, 1.13, 1.05);
    cap.position.y = 0.01;
    head.add(cap);
    return;
  }
  if (id === "crew") {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.162, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), k.hair);
    cap.scale.set(0.95, 1.13, 1.05);
    cap.position.y = 0.01;
    const crest = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), k.hair);
    crest.scale.set(0.65, 0.35, 1.1);
    crest.position.set(0, 0.17, 0.01);
    head.add(cap, crest);
    return;
  }
  if (id === "mop") {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), k.hair);
    cap.scale.set(0.98, 1.12, 1.08);
    cap.position.y = 0.02;
    head.add(cap);
    for (let i = -2; i <= 2; i++) {
      const lock = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), k.hair);
      lock.scale.set(1.1, 0.7, 0.7);
      lock.position.set(i * 0.045, 0.08 - Math.abs(i) * 0.008, -0.155);
      head.add(lock);
    }
    return;
  }
  if (id === "fade") {
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), k.hair);
    top.scale.set(0.9, 0.5, 1.05);
    top.position.set(0, 0.16, 0.01);
    head.add(top);
    for (const s of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), k.hair);
      side.scale.set(0.3, 1.2, 0.9);
      side.position.set(s * 0.145, 0.04, 0.0);
      head.add(side);
    }
    return;
  }
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.162, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.48), k.hair);
  cap.scale.set(0.95, 1.13, 1.05);
  cap.position.y = 0.01;
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), k.hair);
  bun.position.set(0, 0.16, 0.12);
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.008, 6, 12), k.helm);
  tie.position.set(0, 0.13, 0.11);
  tie.rotation.x = 0.5;
  head.add(cap, bun, tie);
}

function dressBeard(head: THREE.Mesh, id: BeardId, k: Kit) {
  if (id === "none") return;
  const hair = k.hair;
  if (id === "stubble") {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.012, 6, 14, Math.PI), hair);
    rim.position.set(0, -0.11, -0.05);
    rim.rotation.x = 1.25;
    head.add(rim);
    return;
  }
  if (id === "goatee") {
    const chin = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.065, 8), hair);
    chin.position.set(0, -0.15, -0.11);
    chin.rotation.x = 0.3;
    head.add(chin);
    return;
  }
  if (id === "full") {
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), hair);
    jaw.scale.set(1.2, 0.85, 0.95);
    jaw.position.set(0, -0.11, -0.07);
    head.add(jaw);
    return;
  }
  if (id === "braid") {
    const base = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), hair);
    base.position.set(0, -0.14, -0.11);
    const strand = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.010, 0.14, 8), hair);
    strand.position.set(0, -0.22, -0.11);
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.006, 6, 10), k.helm);
    tie.position.set(0, -0.18, -0.11);
    tie.rotation.x = Math.PI / 2;
    head.add(base, strand, tie);
    return;
  }
  if (id === "stache") {
    const stache = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.008, 0.11, 8), hair);
    stache.rotation.z = Math.PI / 2;
    stache.position.set(0, -0.055, -0.16);
    head.add(stache);
    return;
  }
  if (id === "mutton") {
    for (const s of [-1, 1]) {
      const chop = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), hair);
      chop.scale.set(0.4, 1.4, 0.8);
      chop.position.set(s * 0.14, -0.05, -0.03);
      head.add(chop);
    }
    return;
  }
  if (id === "soul") {
    const patch = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), hair);
    patch.position.set(0, -0.09, -0.155);
    head.add(patch);
    return;
  }
  if (id === "forked") {
    for (const s of [-1, 1]) {
      const tine = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.07, 8), hair);
      tine.position.set(s * 0.035, -0.16, -0.10);
      tine.rotation.x = 0.25;
      head.add(tine);
    }
    return;
  }
  const brush = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.014, 0.13, 8), hair);
  brush.rotation.z = Math.PI / 2;
  brush.position.set(0, -0.065, -0.165);
  const hang = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), hair);
  hang.scale.set(1.4, 0.7, 0.6);
  hang.position.set(0, -0.095, -0.165);
  head.add(brush, hang);
}

function dressHat(head: THREE.Mesh, id: HatId, k: Kit, team: Team, cloth: THREE.Mesh[]) {
  if (id === "none") {
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.01, 4, 4), k.helm);
    helm.visible = false;
    head.add(helm);
    return helm;
  }
  if (id === "watch") {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.168, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), k.helm);
    cap.scale.set(0.96, 1.10, 1.04);
    cap.position.y = 0.04;
    const brim = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.018, 6, 14), k.helm);
    brim.position.y = 0.03;
    brim.rotation.x = Math.PI / 2;
    cap.add(brim);
    head.add(cap);
    cloth.push(cap, brim);
    return cap;
  }
  if (id === "ushanka") {
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.175, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), k.helm);
    crown.scale.set(0.96, 0.95, 1.05);
    crown.position.y = 0.04;
    for (const s of [-1, 1]) {
      const flap = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), k.helm);
      flap.scale.set(0.4, 1.3, 0.9);
      flap.position.set(s * 0.165, -0.04, 0.01);
      crown.add(flap);
      cloth.push(flap);
    }
    head.add(crown);
    cloth.push(crown);
    return crown;
  }
  if (id === "boonie") {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.165, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), k.helm);
    dome.scale.set(0.96, 0.85, 1.02);
    dome.position.y = 0.05;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.015, 16), k.helm);
    brim.position.y = 0.02;
    dome.add(brim);
    head.add(dome);
    cloth.push(dome, brim);
    return dome;
  }
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.178, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), k.helm);
  helm.scale.set(0.97, 1.02, 1.04);
  helm.position.y = 0.035;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.172, 0.012, 6, 16), k.helm);
  rim.position.y = 0.00;
  rim.rotation.x = Math.PI / 2;
  helm.add(rim);
  head.add(helm);
  cloth.push(helm, rim);
  return helm;
}

function dressAccessory(head: THREE.Mesh, id: AccessoryId, k: Kit, team: Team, cloth: THREE.Mesh[]) {
  if (id === "none") return;
  if (id === "glasses") {
    const frameMat = mat(0x1a1814, 0.35, 0.25);
    const lensMat = mat(0x3a4a58, 0.18, 0.55);
    for (const s of [-1, 1]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.004, 6, 12), frameMat);
      rim.position.set(s * 0.052, 0.015, -0.168);
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.004, 10), lensMat);
      glass.rotation.x = Math.PI / 2;
      glass.position.set(s * 0.052, 0.015, -0.168);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.13, 4), frameMat);
      arm.rotation.x = Math.PI / 2;
      arm.position.set(s * 0.082, 0.018, -0.095);
      head.add(rim, glass, arm);
    }
    const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.035, 4), frameMat);
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(0, 0.018, -0.170);
    head.add(bridge);
    return;
  }
  if (id === "scarf") {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.10, 0.036, 6, 14), k.tunic);
    ring.position.set(0, -0.18, 0.02);
    ring.rotation.x = 1.15;
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.025, 0.18, 6), k.tunic);
    tail.position.set(0.08, -0.28, -0.02);
    tail.rotation.z = -0.25;
    head.add(ring, tail);
    cloth.push(ring, tail);
    return;
  }
  if (id === "earpro") {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.012, 5, 14, Math.PI), k.helm);
    band.position.y = 0.04;
    band.rotation.z = Math.PI;
    for (const s of [-1, 1]) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.04, 10), k.helm);
      cup.rotation.z = Math.PI / 2;
      cup.position.set(s * 0.17, 0.005, 0.0);
      band.add(cup);
      cloth.push(cup);
    }
    head.add(band);
    cloth.push(band);
    return;
  }
  if (id === "mask") {
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), mat(0x2a241c, 0.82));
    shell.scale.set(1.05, 0.7, 0.65);
    shell.position.set(0, -0.08, -0.10);
    head.add(shell);
    return;
  }
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.035, 10), k.helm);
  cup.rotation.z = Math.PI / 2;
  cup.position.set(-0.17, 0.01, 0.01);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.15, 4), k.plate);
  boom.position.set(-0.10, -0.04, -0.08);
  boom.rotation.y = 0.45;
  boom.rotation.x = 0.2;
  const mic = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 5), k.plate);
  mic.position.set(-0.03, -0.07, -0.15);
  head.add(cup, boom, mic);
  cloth.push(cup);
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
  const mid = Math.max(0.02, dist - r * 1.5);
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(r, mid, 4, 12), material);
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
