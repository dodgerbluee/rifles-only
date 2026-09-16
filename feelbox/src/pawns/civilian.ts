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

function limbsPawn(team: Team, look: Appearance): PawnParts {
  // STYLE: civilian streetwear
  const k = kitFor(team, look);
  const cloth: THREE.Mesh[] = [];
  const hits: THREE.Mesh[] = [];

  const body = makeShirt(look.shirt, k, cloth);
  body.position.y = 1.18;

  const hips = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), k.pants);
  hips.position.y = 0.86;
  hips.scale.copy(hipScale(look.pants));
  cloth.push(hips);
  hits.push(hips);

  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.215, 0.042, 12), mat(0x2a2218, 0.9));
  belt.position.y = 0.94;
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.045, 0.018), mat(0x9a8458, 0.45, 0.52));
  buckle.position.set(0, 0.94, -0.214);
  const fly = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.18, 0.012), k.pants);
  fly.position.set(0, 0.81, -0.184);

  const lLeg = makeLeg(-1, k, look);
  const rLeg = makeLeg(1, k, look);
  cloth.push(...lLeg.cloth, ...rLeg.cloth);
  hits.push(...lLeg.hits, ...rLeg.hits);

  const sleeveR = look.shirt === "parka" ? 0.087 : look.shirt === "tee" ? 0.075 : 0.08;
  const lSleeve = bone(-0.23, 1.38, 0, -0.18, 1.27, -0.07, sleeveR, k.tunic);
  const rSleeve = bone(0.23, 1.38, 0, 0.21, 1.25, -0.07, sleeveR, k.tunic);
  const lFore = bone(-0.18, 1.27, -0.07, 0.02, 1.14, -0.38, 0.057, k.flesh);
  const rFore = bone(0.21, 1.25, -0.07, 0.14, 1.12, -0.3, 0.057, k.flesh);
  const lCuff = sleeveCuff(-0.18, 1.27, -0.07, -0.08, 0.91, -0.31, k.tunic);
  const rCuff = sleeveCuff(0.21, 1.25, -0.07, -0.14, 0.88, -0.23, k.tunic);
  cloth.push(lSleeve, rSleeve, lCuff, rCuff);
  hits.push(lSleeve, rSleeve, lFore, rFore);

  const lHand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), k.flesh);
  lHand.position.set(0.02, 1.14, -0.4);
  const rHand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), k.flesh);
  rHand.position.set(0.14, 1.12, -0.3);

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
    hits: [...hits, lHand, rHand, belt, buckle, fly],
    walk: { lHip: lLeg.hip, rHip: rLeg.hip, lKnee: lLeg.knee, rKnee: rLeg.knee },
  };
}

function hipScale(id: PantsId) {
  if (id === "slim") return new THREE.Vector3(1.02, 0.56, 0.78);
  if (id === "shorts") return new THREE.Vector3(1.15, 0.62, 0.9);
  if (id === "wrap") return new THREE.Vector3(1.08, 0.6, 0.84);
  if (id === "armor") return new THREE.Vector3(1.12, 0.64, 0.88);
  return new THREE.Vector3(1.16, 0.62, 0.9);
}

function makeShirt(id: ShirtId, k: Kit, cloth: THREE.Mesh[]) {
  const radius = id === "parka" ? 0.235 : id === "vest" ? 0.205 : 0.215;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(radius, 0.27, 6, 12), k.tunic);
  body.scale.z = id === "parka" ? 0.94 : 0.8;
  cloth.push(body);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.095, 0.095, 12), k.flesh);
  neck.position.set(0, 0.33, 0);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.018, 6, 16), k.tunic);
  collar.position.set(0, 0.285, -0.005);
  collar.rotation.x = Math.PI / 2;
  body.add(neck, collar);
  cloth.push(collar);

  const clavicleL = bone(-0.135, 0.22, -0.155, -0.018, 0.2, -0.185, 0.014, k.flesh);
  const clavicleR = bone(0.135, 0.22, -0.155, 0.018, 0.2, -0.185, 0.014, k.flesh);
  body.add(clavicleL, clavicleR);

  if (id === "henley") {
    const placket = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.14, 0.012), mat(0xeee2d0, 0.75));
    placket.position.set(0, 0.19, -0.177);
    body.add(placket);
  } else if (id === "vest") {
    const openL = new THREE.Mesh(new THREE.CapsuleGeometry(0.037, 0.27, 4, 8), mat(0x28231e, 0.88));
    openL.position.set(-0.075, -0.005, -0.178);
    const openR = openL.clone();
    openR.position.x = 0.075;
    body.add(openL, openR);
  } else if (id === "parka") {
    const hood = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.035, 6, 14), k.tunic);
    hood.position.set(0, 0.31, 0.06);
    hood.rotation.x = Math.PI / 2;
    body.add(hood);
    cloth.push(hood);
  } else if (id === "plate") {
    const overshirt = new THREE.Mesh(new THREE.CapsuleGeometry(0.185, 0.22, 5, 10), k.plate);
    overshirt.scale.z = 0.45;
    overshirt.position.set(0, -0.01, -0.14);
    body.add(overshirt);
  }
  return body;
}

function makeHead(look: Appearance, k: Kit) {
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), k.flesh);
  const width = look.face === "square" ? 1.06 : look.face === "olive" ? 0.94 : 1;
  head.scale.set(width, look.face === "pale" ? 1.06 : 1.02, 0.94);

  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.125, 12, 8), k.flesh);
  jaw.scale.set(look.face === "square" ? 1.12 : 0.98, 0.62, 0.82);
  jaw.position.set(0, -0.125, -0.012);
  const brow = new THREE.Mesh(new THREE.SphereGeometry(0.105, 10, 6), k.flesh);
  brow.scale.set(1.35, 0.23, 0.28);
  brow.position.set(0, 0.07, -0.151);
  head.add(jaw, brow);

  const socket = mat(0x4a3528, 0.85);
  const eyeM = mat(0x15120f, 0.38);
  for (const side of [-1, 1]) {
    const socketMesh = new THREE.Mesh(new THREE.SphereGeometry(0.043, 8, 6), socket);
    socketMesh.scale.z = 0.42;
    socketMesh.position.set(side * 0.06, 0.015, -0.155);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), eyeM);
    eye.position.set(side * 0.06, 0.015, -0.171);
    head.add(socketMesh, eye);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 6), k.flesh);
  nose.scale.set(0.72, 1, 1.1);
  nose.position.set(0, -0.018, -0.184);
  const earL = new THREE.Mesh(new THREE.SphereGeometry(0.047, 8, 6), k.flesh);
  earL.scale.set(0.45, 1, 0.72);
  earL.position.set(-0.174, -0.005, 0);
  const earR = earL.clone();
  earR.position.x = 0.174;
  head.add(nose, earL, earR);
  return head;
}

function hairCap(radius: number, hair: THREE.Material) {
  const cap = new THREE.Mesh(new THREE.SphereGeometry(radius, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.53), hair);
  cap.position.y = 0.035;
  return cap;
}

function dressHair(head: THREE.Mesh, id: HairId, k: Kit) {
  const cap = hairCap(id === "mop" ? 0.19 : 0.176, k.hair);
  if (id === "buzz") {
    head.add(cap);
    return;
  }
  if (id === "fade") {
    cap.scale.y = 0.72;
    const sideL = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), k.hair);
    sideL.scale.set(0.38, 1, 0.75);
    sideL.position.set(-0.165, 0.035, 0);
    const sideR = sideL.clone();
    sideR.position.x = 0.165;
    head.add(cap, sideL, sideR);
    return;
  }
  const fringe = new THREE.Mesh(new THREE.SphereGeometry(id === "mop" ? 0.052 : 0.04, 8, 6), k.hair);
  fringe.scale.set(1.25, 0.55, 0.55);
  fringe.position.set(0, id === "mop" ? 0.075 : 0.1, -0.164);
  head.add(cap, fringe);
  if (id === "mop") {
    for (const x of [-0.115, 0.115]) {
      const curl = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), k.hair);
      curl.position.set(x, 0.055, -0.12);
      head.add(curl);
    }
  }
  if (id === "bun") {
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), k.hair);
    bun.position.set(0, 0.125, 0.14);
    head.add(bun);
  }
}

function dressBeard(head: THREE.Mesh, id: BeardId, k: Kit) {
  if (id === "none") return;
  const hair = mat(BEARD_HEX, 0.9);
  const chin = (r = 0.07, y = -0.15) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 9, 7), hair);
    mesh.scale.set(1.05, 0.8, 0.6);
    mesh.position.set(0, y, -0.13);
    head.add(mesh);
    return mesh;
  };
  if (id === "stubble") {
    chin(0.1, -0.1);
  } else if (id === "goatee" || id === "soul") {
    chin(id === "goatee" ? 0.06 : 0.035, -0.15);
  } else if (id === "stache" || id === "walrus") {
    const brush = new THREE.Mesh(new THREE.SphereGeometry(id === "walrus" ? 0.1 : 0.08, 10, 6), hair);
    brush.scale.set(1.3, 0.32, 0.36);
    brush.position.set(0, -0.065, -0.164);
    head.add(brush);
    if (id === "walrus") chin(0.075, -0.13);
  } else {
    chin(id === "full" ? 0.12 : 0.09);
    for (const side of [-1, 1]) {
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), hair);
      cheek.scale.set(0.6, 1.25, 0.7);
      cheek.position.set(side * 0.12, -0.075, -0.08);
      head.add(cheek);
    }
    if (id === "braid" || id === "forked") {
      for (const x of id === "forked" ? [-0.04, 0.04] : [0]) {
        const braid = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.11, 4, 6), hair);
        braid.position.set(x, -0.245, -0.115);
        head.add(braid);
      }
    }
  }
}

function dressAccessory(head: THREE.Mesh, id: AccessoryId, k: Kit, team: Team, cloth: THREE.Mesh[]) {
  if (id === "none") return;
  if (id === "glasses") {
    const frame = mat(0x1a1814, 0.35, 0.25);
    const lens = mat(0x3a4a58, 0.18, 0.55);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.02), frame);
    bridge.position.set(0, 0.02, -0.16);
    const rimL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.02), frame);
    rimL.position.set(-0.06, 0.02, -0.155);
    const rimR = rimL.clone();
    rimR.position.x = 0.06;
    const glassL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.035, 0.012), lens);
    glassL.position.set(-0.06, 0.02, -0.162);
    const glassR = glassL.clone();
    glassR.position.x = 0.06;
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.015, 0.12), frame);
    armL.position.set(-0.1, 0.025, -0.08);
    const armR = armL.clone();
    armR.position.x = 0.1;
    head.add(bridge, rimL, rimR, glassL, glassR, armL, armR);
    return;
  }
  if (id === "scarf") {
    const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.042, 6, 12), k.tunic);
    wrap.position.set(0, -0.26, 0.02);
    wrap.rotation.x = 1.15;
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.04), k.tunic);
    tail.position.set(0.1, -0.36, 0.04);
    tail.rotation.z = -0.25;
    const knot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.06), mat(teamTrim(team), 0.5, 0.12));
    knot.position.set(0.02, -0.28, -0.1);
    head.add(wrap, tail, knot);
    cloth.push(wrap, tail);
    return;
  }
  if (id === "earpro") {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.018, 5, 12, Math.PI), k.helm);
    band.position.y = 0.04;
    band.rotation.z = Math.PI;
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
    cover.position.set(0, -0.08, -0.12);
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.04), k.plate);
    vent.position.set(0, -0.1, -0.17);
    const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.14), mat(0x1a1814, 0.88));
    strapL.position.set(-0.12, -0.04, -0.02);
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
  const mic = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5), k.plate);
  mic.position.set(-0.04, -0.08, -0.16);
  const cable = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.1, 0.012), mat(0x1a1814, 0.9));
  cable.position.set(-0.16, -0.1, 0.04);
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
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.185, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.58), k.helm);
    cap.position.y = 0.055;
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 6, 14), k.helm);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = 0.01;
    cap.add(cuff);
    head.add(cap);
    cloth.push(cap, cuff);
    return cap;
  }
  if (id === "ushanka") {
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), k.helm);
    crown.position.y = 0.055;
    const flapL = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.11, 4, 6), k.helm);
    flapL.position.set(-0.185, -0.045, 0.01);
    const flapR = flapL.clone();
    flapR.position.x = 0.185;
    crown.add(flapL, flapR);
    head.add(crown);
    cloth.push(crown, flapL, flapR);
    return crown;
  }
  if (id === "boonie") {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.175, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.52), k.helm);
    dome.position.y = 0.08;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.02, 12), k.helm);
    brim.position.y = -0.02;
    dome.add(brim);
    head.add(dome);
    cloth.push(dome, brim);
    return dome;
  }
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58), k.helm);
  helm.position.y = 0.04;
  const brim = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 6), k.helm);
  brim.scale.set(1.1, 0.18, 0.55);
  brim.position.set(0, -0.035, -0.11);
  helm.add(brim);
  head.add(helm);
  cloth.push(helm, brim);
  return helm;
}

function makeLeg(side: 1 | -1, k: Kit, look: Appearance) {
  const hip = new THREE.Group();
  hip.position.set(side * 0.105, 0.86, 0);
  hip.rotation.z = side * 0.03;
  const thighR = look.pants === "slim" ? 0.075 : look.pants === "shorts" ? 0.09 : 0.098;
  const thighLen = 0.33;
  const thigh = new THREE.Mesh(new THREE.CylinderGeometry(thighR * 0.86, thighR, thighLen, 12), k.pants);
  thigh.position.y = -thighLen / 2;
  hip.add(thigh);
  const cloth: THREE.Mesh[] = [thigh];
  const knee = new THREE.Group();
  knee.position.y = -thighLen;
  hip.add(knee);
  const shinLen = look.pants === "shorts" ? 0.34 : 0.36;
  const shinMat = look.pants === "shorts" ? k.flesh : k.pants;
  const shinR = look.pants === "slim" ? 0.06 : look.pants === "shorts" ? 0.065 : 0.076;
  const shin = new THREE.Mesh(new THREE.CylinderGeometry(shinR * 0.82, shinR, shinLen, 12), shinMat);
  shin.position.y = -shinLen / 2;
  knee.add(shin);
  if (look.pants !== "shorts") cloth.push(shin);
  if (look.pants === "wrap") {
    const puttee = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.011, 5, 12), k.pants);
    puttee.position.y = -shinLen * 0.45;
    puttee.rotation.x = Math.PI / 2;
    knee.add(puttee);
    cloth.push(puttee);
  }
  if (look.pants === "armor") {
    const plate = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 6), k.plate);
    plate.scale.set(0.8, 1.15, 0.38);
    plate.position.set(0, -shinLen * 0.45, -0.075);
    knee.add(plate);
  }
  const foot = makeShoe(look.shoes, k, shinLen);
  knee.add(foot);
  return { hip, knee, cloth, hits: [thigh, shin, foot] };
}

function makeShoe(id: ShoesId, k: Kit, shinLen: number) {
  const soleColor = id === "sneaker" ? 0xd8d0c4 : 0x15130f;
  const bootMat = id === "bare" ? k.flesh : k.boot;
  const foot = new THREE.Mesh(new THREE.BoxGeometry(id === "steel" ? 0.15 : 0.135, 0.09, 0.22), bootMat);
  foot.position.set(0, -shinLen - 0.045, -0.08);
  const sole = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.025, 0.235), mat(soleColor, 0.78));
  sole.position.set(0, -0.052, -0.005);
  const heel = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.045, 0.07), bootMat);
  heel.position.set(0, -0.065, 0.065);
  foot.add(sole, heel);
  if (id === "sneaker") {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.138, 0.018, 0.07), mat(0xd8d0c4, 0.7));
    stripe.position.set(0, 0.015, -0.075);
    foot.add(stripe);
  } else if (id === "wrap") {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.009, 5, 12), k.boot);
    band.rotation.x = Math.PI / 2;
    band.position.set(0, 0.025, -0.01);
    foot.add(band);
  } else if (id === "steel") {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.078, 10, 6), k.plate);
    cap.scale.set(0.92, 0.62, 0.68);
    cap.position.set(0, 0.015, -0.11);
    foot.add(cap);
  }
  foot.castShadow = true;
  return foot;
}

function sleeveCuff(ax: number, ay: number, az: number, dx: number, dy: number, dz: number, material: THREE.Material) {
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.077, 0.013, 6, 12), material);
  _dir.set(dx, dy, dz).normalize();
  cuff.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), _dir);
  cuff.position.set(ax, ay, az);
  return cuff;
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
