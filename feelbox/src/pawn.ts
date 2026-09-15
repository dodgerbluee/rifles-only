import * as THREE from "three";
import type { Team } from "./match";
import {
  packLook,
  resolveLook,
  skinFromLook,
  type AccessoryId,
  type Appearance,
  type BeardId,
  type FaceId,
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
  shade: THREE.MeshStandardMaterial;
  boot: THREE.MeshStandardMaterial;
  helm: THREE.MeshStandardMaterial;
  plate: THREE.MeshStandardMaterial;
  hair: THREE.MeshStandardMaterial;
  under: THREE.MeshStandardMaterial;
};

function kitFor(team: Team, look: Appearance): Kit {
  const ember = team === "ember";
  const plate = look.shirt === "plate";
  return {
    tunic: mat(teamCloth(team), plate ? 0.42 : 0.82, plate ? 0.45 : 0.04),
    pants: mat(ember ? 0x5a2410 : 0x1a3a58, look.pants === "armor" ? 0.4 : 0.9, look.pants === "armor" ? 0.45 : 0.04),
    flesh: mat(FACE_HEX[look.face], 0.72),
    shade: mat(tint(FACE_HEX[look.face], 0.62), 0.86),
    boot: shoeMat(look.shoes),
    helm: mat(teamHelm(team), look.hat === "helmet" ? 0.5 : 0.72, look.hat === "helmet" ? 0.22 : 0.06),
    plate: mat(STEEL, 0.48, 0.35),
    hair: mat(HAIR_HEX[look.hair], 0.88),
    under: mat(0x2a241c, 0.9),
  };
}

function shoeMat(id: ShoesId) {
  if (id === "sneaker") return mat(0x3a342c, 0.78);
  if (id === "wrap") return mat(0x4a3a28, 0.9);
  if (id === "steel") return mat(0x4a4e52, 0.38, 0.62);
  if (id === "bare") return mat(0xc4a07a, 0.74);
  return mat(BOOT, 0.92);
}

/* -------------------------------------------------------------------- *
 * Turned-profile primitives. Every load-bearing mass on this figure is a
 * silhouette curve spun around its own axis, the way a bowl or a chess
 * piece is turned. Limbs are capsules plugged into those masses.
 * -------------------------------------------------------------------- */

type P2 = [number, number];

/** Sample a control polygon as a spline so a turned mass reads as flesh, not facets. */
function curvePts(pts: P2[], steps: number) {
  const spline = new THREE.SplineCurve(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  return spline.getPoints(steps).map((p) => new THREE.Vector2(Math.max(0.0025, p.x), p.y));
}

/** Closed turned mass. The seam is offset so the pawn centre line never lands on it. */
function turned(pts: P2[], material: THREE.Material, seg = 14, steps = 14) {
  const mesh = new THREE.Mesh(new THREE.LatheGeometry(curvePts(pts, steps), seg, Math.PI / seg), material);
  mesh.castShadow = true;
  return mesh;
}

/**
 * Arc of a turned mass — panels, plates, hat flaps, beards. `faceAt` is the arc
 * centre. An arc is an open skin, so it takes its own two-sided material copy.
 */
function shellOf(pts: P2[], material: THREE.MeshStandardMaterial, faceAt: number, sweep: number, seg = 10, steps = 10) {
  const geo = new THREE.LatheGeometry(curvePts(pts, steps), seg, faceAt - sweep / 2, sweep);
  const skin = material.clone();
  skin.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(geo, skin);
  mesh.castShadow = true;
  return mesh;
}

/** Lathe angles: the pawn faces −Z. */
const FRONT = Math.PI;
const BACK = 0;
const RIGHT = Math.PI / 2;
const LEFT = -Math.PI / 2;

/* ----------------------------- profiles ------------------------------ */

const TORSO: Record<ShirtId, { pts: P2[]; wide: number; deep: number }> = {
  tee: {
    pts: [
      [0.002, 0.3], [0.088, 0.294], [0.152, 0.262], [0.184, 0.204], [0.196, 0.12],
      [0.19, 0.03], [0.17, -0.058], [0.152, -0.15], [0.158, -0.235], [0.142, -0.296], [0.002, -0.312],
    ],
    wide: 1.3,
    deep: 0.8,
  },
  henley: {
    pts: [
      [0.002, 0.302], [0.092, 0.296], [0.156, 0.266], [0.19, 0.206], [0.202, 0.12],
      [0.196, 0.024], [0.178, -0.07], [0.164, -0.16], [0.172, -0.24], [0.154, -0.3], [0.002, -0.316],
    ],
    wide: 1.28,
    deep: 0.82,
  },
  vest: {
    pts: [
      [0.002, 0.296], [0.084, 0.29], [0.146, 0.258], [0.178, 0.2], [0.189, 0.116],
      [0.184, 0.026], [0.166, -0.062], [0.15, -0.152], [0.155, -0.232], [0.14, -0.292], [0.002, -0.308],
    ],
    wide: 1.24,
    deep: 0.78,
  },
  parka: {
    pts: [
      [0.002, 0.314], [0.104, 0.308], [0.172, 0.278], [0.206, 0.216], [0.219, 0.124],
      [0.216, 0.022], [0.206, -0.076], [0.202, -0.168], [0.221, -0.256], [0.212, -0.33], [0.002, -0.348],
    ],
    wide: 1.24,
    deep: 0.9,
  },
  plate: {
    pts: [
      [0.002, 0.304], [0.094, 0.298], [0.158, 0.266], [0.192, 0.206], [0.204, 0.12],
      [0.198, 0.026], [0.18, -0.066], [0.164, -0.156], [0.17, -0.238], [0.152, -0.3], [0.002, -0.316],
    ],
    wide: 1.3,
    deep: 0.84,
  },
};

const PELVIS: P2[] = [
  [0.002, 0.138], [0.086, 0.13], [0.142, 0.1], [0.17, 0.05], [0.178, -0.012],
  [0.17, -0.072], [0.146, -0.118], [0.1, -0.15], [0.002, -0.162],
];

const PELVIS_FIT: Record<PantsId, [number, number]> = {
  cargo: [1.26, 0.92],
  slim: [1.14, 0.84],
  shorts: [1.24, 0.94],
  wrap: [1.2, 0.88],
  armor: [1.32, 0.98],
};

const BELT: P2[] = [
  [0.166, 0.036], [0.181, 0.024], [0.185, 0.0], [0.181, -0.024], [0.166, -0.036],
];

const NECK: P2[] = [
  [0.002, 0.118], [0.052, 0.112], [0.058, 0.07], [0.063, 0.018], [0.078, -0.032],
  [0.108, -0.078], [0.152, -0.112], [0.002, -0.126],
];

const SKULL: P2[] = [
  [0.002, 0.162], [0.062, 0.157], [0.112, 0.141], [0.148, 0.108], [0.166, 0.062],
  [0.172, 0.01], [0.168, -0.036], [0.152, -0.074], [0.126, -0.1], [0.002, -0.114],
];

const SKULL_SQ: P2[] = [
  [0.002, 0.155], [0.086, 0.152], [0.14, 0.144], [0.166, 0.118], [0.176, 0.07],
  [0.179, 0.014], [0.176, -0.036], [0.166, -0.076], [0.142, -0.102], [0.002, -0.114],
];

const JAW: P2[] = [
  [0.002, 0.022], [0.086, 0.012], [0.124, -0.02], [0.127, -0.062], [0.112, -0.1],
  [0.08, -0.13], [0.04, -0.15], [0.002, -0.158],
];

const JAW_SQ: P2[] = [
  [0.002, 0.024], [0.098, 0.014], [0.136, -0.018], [0.14, -0.062], [0.134, -0.104],
  [0.112, -0.134], [0.06, -0.152], [0.002, -0.158],
];

/** Heads are narrower across than front-to-back, the way a real skull is. */
const FACE_FIT: Record<FaceId, [number, number, number]> = {
  pale: [0.87, 1.0, 1.07],
  tan: [0.9, 1.0, 1.09],
  olive: [0.83, 1.06, 1.07],
  umber: [0.94, 0.96, 1.11],
  square: [0.95, 0.99, 1.06],
};

/* ----------------------------- the figure ----------------------------- */

// STYLE: lathe-profile anatomy
function limbsPawn(team: Team, look: Appearance): PawnParts {
  const k = kitFor(team, look);
  const cloth: THREE.Mesh[] = [];
  const hits: THREE.Mesh[] = [];
  const extras: THREE.Mesh[] = [];

  const body = makeShirt(look.shirt, k, team, cloth, extras);
  body.position.y = 1.18;

  const [pw, pd] = PELVIS_FIT[look.pants];
  const pelvis = turned(PELVIS, k.pants, 14, 14);
  pelvis.position.y = 0.97;
  pelvis.scale.set(pw, 1, pd);
  cloth.push(pelvis);
  hits.push(pelvis);

  const belt = turned(BELT, look.pants === "armor" || look.shirt === "plate" ? k.plate : k.under, 14, 8);
  belt.position.y = 1.008;
  belt.scale.set(pw * 1.02, 1, pd * 1.04);
  hits.push(belt);

  const neck = turned(NECK, k.flesh, 12, 12);
  neck.position.y = 1.43;
  neck.scale.set(1.04, 1, 0.94);
  hits.push(neck);

  const lLeg = makeLeg(-1, k, extras, look);
  const rLeg = makeLeg(1, k, extras, look);
  cloth.push(...lLeg.cloth, ...rLeg.cloth);
  hits.push(...lLeg.hits, ...rLeg.hits);

  hits.push(...makeArms(look, k, cloth));

  const head = makeHead(look, k);
  head.position.y = 1.62;
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
    hits: [...hits, ...extras],
    walk: { lHip: lLeg.hip, rHip: rLeg.hip, lKnee: lLeg.knee, rKnee: rLeg.knee },
  };
}

/** Shoulder girdle, arms, hands. Root space, so they stay married to the rifle. */
function makeArms(look: Appearance, k: Kit, cloth: THREE.Mesh[]) {
  const out: THREE.Mesh[] = [];
  const shirt = look.shirt;
  const sleeveMat = shirt === "tee" ? k.flesh : shirt === "vest" ? k.under : k.tunic;
  const foreMat = shirt === "parka" || shirt === "plate" ? k.tunic : k.flesh;
  const r = shirt === "parka" ? 0.084 : shirt === "tee" ? 0.058 : shirt === "plate" ? 0.076 : 0.066;
  const dressed = shirt !== "tee" && shirt !== "vest";

  for (const side of [-1, 1] as const) {
    const sx = side * 0.205;
    const shoulder = turned(
      [[0.002, 0.075], [0.048, 0.07], [0.075, 0.04], [0.082, -0.006], [0.072, -0.05], [0.044, -0.078], [0.002, -0.086]],
      sleeveMat,
      10,
      10,
    );
    shoulder.position.set(sx, 1.352, -0.008);
    shoulder.scale.set(1.05, 1, 1.12);
    out.push(shoulder);
    if (dressed) cloth.push(shoulder);

    const ex = side < 0 ? -0.178 : 0.226;
    const ez = side < 0 ? -0.17 : -0.112;
    const hx = side < 0 ? 0.008 : 0.148;
    const hy = side < 0 ? 1.136 : 1.114;
    const hz = side < 0 ? -0.4 : -0.286;

    const upper = bone(sx, 1.336, -0.008, ex, 1.186, ez, r, sleeveMat);
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(r * 0.92, 8, 6), foreMat);
    elbow.position.set(ex, 1.186, ez);
    const fore = bone(ex, 1.186, ez, hx, hy, hz, r * 0.82, foreMat);
    out.push(upper, elbow, fore);
    if (dressed) cloth.push(upper);
    if (shirt === "parka" || shirt === "plate") cloth.push(fore);

    if (shirt === "tee") {
      const cap = bone(
        sx,
        1.352,
        -0.008,
        sx + (ex - sx) * 0.44,
        1.352 - 0.073,
        -0.008 + (ez + 0.008) * 0.44,
        r * 1.34,
        k.tunic,
      );
      out.push(cap);
      cloth.push(cap);
    }
    if (shirt === "parka") {
      const cuff = turned([[0.082, 0.03], [0.096, 0.012], [0.096, -0.016], [0.082, -0.032]], k.tunic, 10, 6);
      cuff.position.set(hx + (ex - hx) * 0.26, hy + (1.186 - hy) * 0.26, hz + (ez - hz) * 0.26);
      cuff.rotation.x = -1.05;
      out.push(cuff);
      cloth.push(cuff);
    }
    if (shirt === "plate") {
      const pauldron = shellOf(
        [[0.086, 0.062], [0.112, 0.036], [0.12, -0.004], [0.114, -0.05], [0.094, -0.082]],
        k.plate,
        side < 0 ? LEFT : RIGHT,
        2.5,
        8,
        8,
      );
      pauldron.position.set(sx, 1.356, -0.008);
      out.push(pauldron);
    }

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.052, 8, 6), k.flesh);
    hand.position.set(hx, hy, hz);
    hand.scale.set(0.8, 0.98, 1.22);
    hand.rotation.y = side * 0.3;
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.036, 3, 5), k.flesh);
    thumb.position.set(hx - side * 0.03, hy + 0.026, hz + 0.02);
    thumb.rotation.x = 1.1;
    out.push(hand, thumb);
  }
  return out;
}

/* -------------------------------- torso -------------------------------- */

function makeShirt(id: ShirtId, k: Kit, team: Team, cloth: THREE.Mesh[], extras: THREE.Mesh[]) {
  const spec = TORSO[id];
  const body = turned(spec.pts, id === "vest" ? k.under : k.tunic, 14, 13);
  body.scale.set(spec.wide, 1, spec.deep);
  if (id !== "vest") cloth.push(body);
  // Detail rides the ribcage, so it is authored against the same profile radius
  // and inherits the oval chest scale for free.
  const dress = (m: THREE.Mesh, recolor = false) => {
    body.add(m);
    extras.push(m);
    if (recolor) cloth.push(m);
    return m;
  };

  if (id === "henley") {
    const collar = turned([[0.088, 0.052], [0.106, 0.03], [0.108, 0.0], [0.096, -0.026]], k.tunic, 14, 8);
    collar.position.y = 0.264;
    dress(collar, true);
    const placket = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.14, 3, 6), mat(tint(teamCloth(team), 0.72), 0.86));
    placket.position.set(0, 0.17, -0.178);
    dress(placket);
  }
  if (id === "vest") {
    for (const side of [-1, 1] as const) {
      const panel = shellOf(
        [[0.188, 0.244], [0.202, 0.15], [0.206, 0.04], [0.198, -0.07], [0.202, -0.18], [0.19, -0.272]],
        k.tunic,
        FRONT + side * 0.62,
        1.15,
        8,
        12,
      );
      dress(panel, true);
    }
    const yoke = shellOf([[0.19, 0.258], [0.204, 0.2], [0.202, 0.14]], k.tunic, BACK, 2.6, 10, 6);
    dress(yoke, true);
  }
  if (id === "parka") {
    const hood = shellOf(
      [[0.07, 0.36], [0.14, 0.325], [0.176, 0.26], [0.186, 0.18], [0.178, 0.11]],
      k.tunic,
      BACK,
      3.4,
      12,
      10,
    );
    hood.position.z = 0.03;
    dress(hood, true);
    const ruff = turned([[0.152, 0.032], [0.18, 0.012], [0.182, -0.02], [0.158, -0.042]], mat(0x4a4038, 0.95), 14, 8);
    ruff.position.set(0, 0.318, 0.02);
    dress(ruff);
    const hem = turned([[0.2, 0.022], [0.232, -0.008], [0.23, -0.044], [0.202, -0.058]], k.tunic, 14, 8);
    hem.position.y = -0.302;
    dress(hem, true);
  }
  if (id === "plate") {
    const carrier = shellOf(
      [[0.196, 0.238], [0.218, 0.15], [0.226, 0.04], [0.218, -0.07], [0.212, -0.172]],
      k.plate,
      FRONT,
      2.35,
      12,
      12,
    );
    dress(carrier);
    const back = shellOf([[0.196, 0.228], [0.214, 0.12], [0.216, 0.0], [0.208, -0.132]], k.plate, BACK, 2.1, 10, 10);
    dress(back);
    const trim = turned([[0.09, 0.018], [0.104, 0.006], [0.104, -0.01], [0.09, -0.02]], mat(teamTrim(team), 0.4, 0.25), 12, 6);
    trim.position.set(0, 0.198, -0.19);
    trim.rotation.x = 1.3;
    dress(trim, true);
    for (const side of [-1, 1] as const) {
      const strap = new THREE.Mesh(new THREE.CapsuleGeometry(0.024, 0.19, 3, 6), k.plate);
      strap.position.set(side * 0.116, 0.228, -0.07);
      strap.rotation.x = -0.3;
      strap.rotation.z = side * 0.16;
      dress(strap);
    }
  }
  if (id === "tee" || id === "henley") {
    const hem = turned([[0.148, 0.016], [0.166, 0.0], [0.164, -0.03], [0.146, -0.042]], k.tunic, 14, 6);
    hem.position.y = -0.284;
    dress(hem, true);
  }
  return body;
}

/* --------------------------------- legs -------------------------------- */

const THIGH_LEN = 0.42;
const SHIN_LEN = 0.42;

function makeLeg(side: 1 | -1, k: Kit, extras: THREE.Mesh[], look: Appearance) {
  const hip = new THREE.Group();
  hip.position.set(side * 0.105, 0.9, side > 0 ? -0.02 : 0.02);
  hip.rotation.z = side * 0.025;
  const cloth: THREE.Mesh[] = [];
  const pants = look.pants;
  const thighR = pants === "slim" ? 0.074 : pants === "cargo" ? 0.098 : 0.09;

  const thigh = bone(0, 0.02, 0, 0, -THIGH_LEN, 0, thighR, k.pants);
  hip.add(thigh);
  cloth.push(thigh);

  if (pants === "cargo") {
    const pocket = turned([[0.002, 0.0], [0.05, 0.012], [0.062, 0.036], [0.054, 0.058], [0.002, 0.068]], k.pants, 8, 8);
    pocket.position.set(side * thighR * 0.92, -0.19, 0.01);
    pocket.rotation.z = side * Math.PI * 0.5;
    pocket.scale.set(1.9, 1, 1.5);
    hip.add(pocket);
    extras.push(pocket);
    cloth.push(pocket);
  }
  if (pants === "shorts") {
    const cuff = turned([[0.098, 0.055], [0.114, 0.02], [0.114, -0.02], [0.096, -0.04]], k.pants, 10, 8);
    cuff.position.y = -THIGH_LEN * 0.66;
    hip.add(cuff);
    extras.push(cuff);
    cloth.push(cuff);
  }

  const knee = new THREE.Group();
  knee.position.y = -THIGH_LEN;
  hip.add(knee);

  const bare = pants === "shorts";
  const shinMat = bare ? k.flesh : k.pants;
  const shinR = pants === "slim" ? 0.06 : 0.07;

  const cap = turned(
    [[0.002, 0.055], [0.04, 0.05], [0.062, 0.025], [0.066, -0.01], [0.056, -0.04], [0.002, -0.052]],
    shinMat,
    10,
    8,
  );
  cap.position.set(0, 0.01, -0.012);
  cap.scale.set(1.1, 1, 1.15);
  knee.add(cap);
  if (!bare) cloth.push(cap);

  const shin = bone(0, -0.02, 0, 0, -SHIN_LEN, 0.012, shinR, shinMat);
  knee.add(shin);
  if (!bare) cloth.push(shin);

  const calf = turned([[0.002, 0.06], [0.05, 0.04], [0.062, -0.012], [0.048, -0.07], [0.002, -0.1]], shinMat, 10, 10);
  calf.position.set(0, -0.15, 0.036);
  calf.scale.set(1.0, 1.35, 0.9);
  knee.add(calf);
  if (!bare) cloth.push(calf);

  if (pants === "wrap") {
    const puttee = turned(
      [
        [0.078, -0.03], [0.092, -0.06], [0.08, -0.09], [0.094, -0.12], [0.082, -0.15],
        [0.096, -0.18], [0.084, -0.21], [0.096, -0.24], [0.082, -0.27],
      ],
      k.pants,
      12,
      20,
    );
    knee.add(puttee);
    extras.push(puttee);
    cloth.push(puttee);
  }
  if (pants === "armor") {
    const cop = turned([[0.002, 0.07], [0.05, 0.062], [0.078, 0.028], [0.084, -0.02], [0.07, -0.058], [0.002, -0.076]], k.plate, 10, 10);
    cop.position.set(0, 0.0, -0.022);
    cop.scale.set(1.05, 1, 1.15);
    knee.add(cop);
    extras.push(cop);
    const greave = shellOf([[0.082, -0.05], [0.098, -0.12], [0.096, -0.22], [0.082, -0.3]], k.plate, FRONT, 2.2, 8, 8);
    knee.add(greave);
    extras.push(greave);
  }

  const foot = makeShoe(look.shoes, k, SHIN_LEN);
  knee.add(foot);
  return { hip, knee, cloth, hits: [thigh, shin, foot] };
}

/**
 * The sole is the one box on the figure — the walk rig measures it, toes point
 * −Z. Everything stacked on it is turned, so no other box sits under a hip.
 */
function makeShoe(id: ShoesId, k: Kit, shinLen: number) {
  const ankle = -shinLen - 0.005;
  if (id === "sneaker") {
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.126, 0.042, 0.245), mat(0xd8d0c4, 0.7));
    sole.position.set(0, ankle - 0.014, -0.055);
    const upper = turned([[0.002, 0.086], [0.045, 0.082], [0.062, 0.05], [0.07, 0.012], [0.068, -0.02]], k.boot, 10, 10);
    upper.position.set(0, 0.0, 0.028);
    upper.scale.set(0.94, 1, 1.2);
    const toe = turned([[0.002, 0.058], [0.04, 0.054], [0.058, 0.03], [0.062, 0.0], [0.058, -0.02]], k.boot, 10, 8);
    toe.position.set(0, 0.008, -0.085);
    toe.scale.set(0.94, 1, 1.6);
    sole.add(upper, toe);
    sole.castShadow = true;
    return sole;
  }
  if (id === "wrap") {
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.108, 0.03, 0.215), k.boot);
    sole.position.set(0, ankle - 0.012, -0.048);
    const bind = turned([[0.06, 0.088], [0.074, 0.062], [0.062, 0.036], [0.076, 0.008], [0.064, -0.014]], k.boot, 10, 12);
    bind.position.set(0, 0.0, 0.03);
    bind.scale.set(0.94, 1, 1.25);
    const toe = turned([[0.002, 0.05], [0.042, 0.046], [0.056, 0.022], [0.056, -0.008]], k.boot, 10, 8);
    toe.position.set(0, 0.012, -0.078);
    toe.scale.set(0.92, 1, 1.5);
    sole.add(bind, toe);
    sole.castShadow = true;
    return sole;
  }
  if (id === "steel") {
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.146, 0.055, 0.265), k.boot);
    sole.position.set(0, ankle - 0.018, -0.062);
    const shaft = turned([[0.002, 0.14], [0.055, 0.132], [0.078, 0.08], [0.086, 0.02], [0.084, -0.024]], k.boot, 10, 10);
    shaft.position.set(0, 0.0, 0.034);
    shaft.scale.set(0.94, 1, 1.1);
    const toeCap = turned([[0.002, 0.07], [0.05, 0.064], [0.07, 0.034], [0.074, 0.0], [0.07, -0.026]], k.plate, 10, 8);
    toeCap.position.set(0, 0.008, -0.095);
    toeCap.scale.set(0.94, 1, 1.5);
    sole.add(shaft, toeCap);
    sole.castShadow = true;
    return sole;
  }
  if (id === "bare") {
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.094, 0.026, 0.2), k.flesh);
    sole.position.set(0, ankle - 0.01, -0.042);
    const instep = turned([[0.002, 0.075], [0.042, 0.07], [0.056, 0.038], [0.06, 0.004], [0.056, -0.016]], k.flesh, 10, 10);
    instep.position.set(0, 0.0, 0.03);
    instep.scale.set(0.9, 1, 1.5);
    const toes = turned([[0.002, 0.03], [0.034, 0.028], [0.044, 0.008], [0.04, -0.012]], k.flesh, 10, 6);
    toes.position.set(0, 0.008, -0.082);
    toes.scale.set(1.2, 1, 1.0);
    const heel = turned([[0.002, 0.045], [0.032, 0.04], [0.042, 0.014], [0.036, -0.012]], k.flesh, 8, 6);
    heel.position.set(0, 0.0, 0.082);
    sole.add(instep, toes, heel);
    sole.castShadow = true;
    return sole;
  }
  const sole = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.05, 0.245), k.boot);
  sole.position.set(0, ankle - 0.016, -0.058);
  const shaft = turned([[0.002, 0.115], [0.05, 0.11], [0.074, 0.068], [0.082, 0.018], [0.08, -0.022]], k.boot, 10, 10);
  shaft.position.set(0, 0.0, 0.03);
  shaft.scale.set(0.94, 1, 1.15);
  const toe = turned([[0.002, 0.062], [0.046, 0.058], [0.064, 0.03], [0.068, 0.0], [0.062, -0.024]], k.boot, 10, 8);
  toe.position.set(0, 0.006, -0.088);
  toe.scale.set(0.94, 1, 1.55);
  const laces = turned([[0.032, 0.062], [0.042, 0.03], [0.04, -0.006]], mat(0x6a5a44, 0.94), 8, 6);
  laces.position.set(0, 0.026, -0.024);
  sole.add(shaft, toe, laces);
  sole.castShadow = true;
  return sole;
}

/* --------------------------------- head -------------------------------- */

function makeHead(look: Appearance, k: Kit) {
  const square = look.face === "square";
  const head = turned(square ? SKULL_SQ : SKULL, k.flesh, 14, 13);
  const [fx, fy, fz] = FACE_FIT[look.face];
  head.scale.set(fx, fy, fz);

  const jaw = turned(square ? JAW_SQ : JAW, k.flesh, 12, 11);
  jaw.position.set(0, -0.014, -0.046);
  jaw.scale.set(square ? 1.08 : 1.0, 1, 1.16);
  head.add(jaw);

  for (const side of [-1, 1] as const) {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.044, 8, 6), k.flesh);
    cheek.position.set(side * 0.092, -0.012, -0.124);
    cheek.scale.set(1.0, 0.78, 0.62);
    head.add(cheek);

    const ear = turned([[0.002, 0.0], [0.024, 0.008], [0.03, 0.024], [0.024, 0.04], [0.002, 0.046]], k.flesh, 8, 8);
    ear.position.set(side * 0.158, -0.012, 0.004);
    ear.rotation.z = side * -Math.PI * 0.5;
    ear.scale.set(1.5, 1, 1.05);
    head.add(ear);
  }

  const brow = new THREE.Mesh(new THREE.CapsuleGeometry(square ? 0.03 : 0.023, 0.15, 3, 6), k.flesh);
  brow.position.set(0, square ? 0.056 : 0.05, -0.142);
  brow.rotation.z = Math.PI * 0.5;
  brow.rotation.x = -0.2;
  head.add(brow);

  const bridge = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.06, 3, 6), k.flesh);
  bridge.position.set(0, 0.012, -0.158);
  bridge.rotation.x = 0.22;
  head.add(bridge);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(square ? 0.038 : 0.033, 0.104, 8), k.flesh);
  nose.position.set(0, -0.018, -0.168);
  nose.rotation.x = -1.86;
  nose.scale.set(1.0, 1.0, 0.8);
  head.add(nose);

  for (const side of [-1, 1] as const) {
    const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5), k.shade);
    nostril.position.set(side * 0.021, -0.054, -0.196);
    nostril.scale.set(1, 0.7, 0.8);
    head.add(nostril);
  }

  eyePair(head, k, look);
  mouthLine(head, k, look);
  return head;
}

/** Sockets are inset spheres: a shadow ball sunk into the skull, the eye set in it. */
function eyePair(head: THREE.Mesh, k: Kit, look: Appearance) {
  const sclera = mat(0xd8d2c6, 0.42);
  const iris = mat(look.face === "pale" ? 0x3a5a6a : 0x2a1c12, 0.34);
  for (const side of [-1, 1] as const) {
    const x = side * 0.072;
    const socket = new THREE.Mesh(new THREE.SphereGeometry(0.046, 10, 8), k.shade);
    socket.position.set(x, 0.009, -0.138);
    socket.scale.set(1.02, 0.72, 0.4);
    head.add(socket);

    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), sclera);
    ball.position.set(x, 0.006, -0.144);
    ball.scale.set(1, 0.85, 0.66);
    head.add(ball);

    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 6), iris);
    pupil.position.set(x, 0.004, -0.152);
    head.add(pupil);

    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.44), k.flesh);
    lid.position.set(x, 0.014, -0.14);
    lid.rotation.x = -0.62;
    head.add(lid);
  }
}

function mouthLine(head: THREE.Mesh, k: Kit, look: Appearance) {
  const slot = new THREE.Mesh(
    new THREE.TorusGeometry(0.042, 0.0075, 4, 10, Math.PI * 0.82),
    mat(tint(FACE_HEX[look.face], 0.42), 0.68),
  );
  slot.position.set(0, -0.078, -0.184);
  slot.rotation.z = -Math.PI * 0.91;
  slot.scale.set(1, 0.52, 1);
  head.add(slot);

  const lip = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.05, 3, 5), k.flesh);
  lip.position.set(0, -0.062, -0.188);
  lip.rotation.z = Math.PI * 0.5;
  head.add(lip);
}

/* --------------------------------- hair -------------------------------- */

function dressHair(head: THREE.Mesh, id: HairId, k: Kit) {
  const hair = k.hair;
  if (id === "buzz") {
    const cap = turned(
      [[0.002, 0.169], [0.064, 0.164], [0.116, 0.148], [0.152, 0.114], [0.17, 0.066], [0.176, 0.012], [0.174, -0.02]],
      hair,
      16,
      12,
    );
    head.add(cap);
    return;
  }
  if (id === "crew") {
    const cap = turned(
      [[0.002, 0.196], [0.082, 0.192], [0.132, 0.178], [0.162, 0.148], [0.176, 0.102], [0.181, 0.05], [0.179, 0.004]],
      hair,
      16,
      14,
    );
    const sides = turned(
      [[0.176, 0.006], [0.178, -0.018], [0.172, -0.042], [0.16, -0.058]],
      mat(tint(HAIR_HEX.crew, 0.75), 0.9),
      16,
      8,
    );
    head.add(cap, sides);
    return;
  }
  if (id === "mop") {
    const dome = turned(
      [
        [0.002, 0.206], [0.086, 0.201], [0.142, 0.186], [0.176, 0.152], [0.196, 0.094],
        [0.202, 0.026], [0.198, -0.03], [0.186, -0.066], [0.166, -0.084],
      ],
      hair,
      14,
      12,
    );
    const fringe = shellOf([[0.176, 0.05], [0.19, 0.0], [0.192, -0.042], [0.18, -0.07]], hair, FRONT, 2.9, 12, 8);
    const tuftL = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.07, 3, 6), hair);
    tuftL.position.set(-0.15, -0.05, 0.09);
    tuftL.rotation.x = -0.4;
    const tuftR = tuftL.clone();
    tuftR.position.x = 0.15;
    head.add(dome, fringe, tuftL, tuftR);
    return;
  }
  if (id === "fade") {
    const crown = turned(
      [[0.002, 0.19], [0.07, 0.185], [0.118, 0.17], [0.15, 0.14], [0.163, 0.098], [0.166, 0.056]],
      hair,
      16,
      12,
    );
    const faded = turned(
      [[0.166, 0.058], [0.175, 0.02], [0.177, -0.016], [0.17, -0.05]],
      mat(tint(HAIR_HEX.fade, 1.9), 0.92),
      16,
      8,
    );
    const part = shellOf(
      [[0.15, 0.142], [0.164, 0.1], [0.169, 0.058]],
      mat(tint(HAIR_HEX.fade, 2.6), 0.9),
      LEFT,
      0.55,
      6,
      6,
    );
    head.add(crown, faded, part);
    return;
  }
  const cap = turned(
    [[0.002, 0.174], [0.07, 0.17], [0.12, 0.154], [0.155, 0.12], [0.172, 0.07], [0.178, 0.014], [0.176, -0.026]],
    hair,
    16,
    12,
  );
  const knot = turned([[0.002, 0.0], [0.04, 0.018], [0.058, 0.05], [0.05, 0.082], [0.002, 0.096]], hair, 12, 10);
  knot.position.set(0, 0.118, 0.098);
  knot.rotation.x = -0.75;
  knot.scale.set(1.2, 1, 1.2);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.01, 5, 10), mat(0x8a3420, 0.8));
  band.position.set(0, 0.128, 0.086);
  band.rotation.x = 0.85;
  head.add(cap, knot, band);
}

/* -------------------------------- beards ------------------------------- */

function dressBeard(head: THREE.Mesh, id: BeardId, k: Kit) {
  if (id === "none") return;
  const hair = mat(BEARD_HEX, 0.9);
  const jawShell = (thick: number, drop: number, sweep: number) => {
    const s = shellOf(
      [
        [0.098 + thick, 0.006], [0.128 + thick, -0.03], [0.138 + thick, -0.072],
        [0.126 + thick, -0.112], [0.098 + thick, -0.142 - drop], [0.05, -0.164 - drop],
      ],
      hair,
      FRONT,
      sweep,
      12,
      12,
    );
    s.position.set(0, -0.014, -0.046);
    s.scale.set(1.0, 1, 1.16);
    return s;
  };

  if (id === "stubble") {
    head.add(jawShell(0.004, 0.0, 2.9));
    return;
  }
  if (id === "goatee") {
    const chin = turned([[0.002, 0.03], [0.038, 0.02], [0.05, -0.02], [0.042, -0.06], [0.002, -0.084]], hair, 10, 10);
    chin.position.set(0, -0.148, -0.132);
    chin.scale.set(1.15, 1, 1.05);
    const strip = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.03, 3, 5), hair);
    strip.position.set(0, -0.108, -0.176);
    head.add(chin, strip);
    return;
  }
  if (id === "full") {
    const shell = jawShell(0.016, 0.02, 3.1);
    const hang = turned([[0.002, 0.04], [0.06, 0.02], [0.072, -0.03], [0.055, -0.08], [0.002, -0.106]], hair, 12, 12);
    hang.position.set(0, -0.158, -0.112);
    hang.scale.set(1.25, 1, 1.1);
    const stache = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.086, 3, 6), hair);
    stache.position.set(0, -0.058, -0.19);
    stache.rotation.z = Math.PI * 0.5;
    head.add(shell, hang, stache);
    return;
  }
  if (id === "braid") {
    const chin = turned([[0.002, 0.03], [0.044, 0.018], [0.056, -0.026], [0.046, -0.062], [0.002, -0.082]], hair, 10, 10);
    chin.position.set(0, -0.146, -0.13);
    const braid = turned(
      [
        [0.028, -0.01], [0.04, -0.045], [0.026, -0.08], [0.04, -0.115],
        [0.024, -0.15], [0.034, -0.185], [0.014, -0.212],
      ],
      hair,
      8,
      18,
    );
    braid.position.set(0, -0.204, -0.126);
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.009, 5, 8), k.helm);
    tie.position.set(0, -0.222, -0.126);
    tie.rotation.x = Math.PI * 0.5;
    head.add(chin, braid, tie);
    return;
  }
  if (id === "stache") {
    for (const side of [-1, 1] as const) {
      const wing = new THREE.Mesh(new THREE.CapsuleGeometry(0.017, 0.07, 3, 6), hair);
      wing.position.set(side * 0.042, -0.06, -0.19);
      wing.rotation.z = Math.PI * 0.5 + side * 0.26;
      wing.rotation.y = side * 0.32;
      const tip = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.03, 3, 5), hair);
      tip.position.set(side * 0.088, -0.042, -0.166);
      tip.rotation.z = side * 0.6;
      head.add(wing, tip);
    }
    return;
  }
  if (id === "mutton") {
    for (const side of [-1, 1] as const) {
      const chop = shellOf(
        [[0.1, 0.05], [0.12, -0.01], [0.126, -0.07], [0.106, -0.12]],
        hair,
        side < 0 ? LEFT : RIGHT,
        1.5,
        8,
        10,
      );
      chop.position.set(0, -0.012, -0.034);
      chop.scale.set(1.28, 1, 1.08);
      head.add(chop);
    }
    return;
  }
  if (id === "soul") {
    const patch = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), hair);
    patch.position.set(0, -0.106, -0.194);
    patch.scale.set(0.9, 1.1, 0.5);
    head.add(patch);
    return;
  }
  if (id === "forked") {
    head.add(jawShell(0.012, 0.005, 2.9));
    for (const side of [-1, 1] as const) {
      const tine = turned([[0.034, -0.01], [0.042, -0.06], [0.03, -0.115], [0.012, -0.15]], hair, 8, 10);
      tine.position.set(side * 0.05, -0.158, -0.114);
      tine.rotation.z = side * 0.18;
      head.add(tine);
    }
    return;
  }
  const brush = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.12, 4, 8), hair);
  brush.position.set(0, -0.064, -0.182);
  brush.rotation.z = Math.PI * 0.5;
  brush.scale.set(1, 1, 0.85);
  const droopL = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.07, 3, 6), hair);
  droopL.position.set(-0.062, -0.106, -0.166);
  droopL.rotation.z = 0.28;
  const droopR = droopL.clone();
  droopR.position.x = 0.062;
  droopR.rotation.z = -0.28;
  head.add(brush, droopL, droopR);
}

/* ------------------------------ accessories ----------------------------- */

function dressAccessory(head: THREE.Mesh, id: AccessoryId, k: Kit, team: Team, cloth: THREE.Mesh[]) {
  if (id === "none") return;
  if (id === "glasses") {
    const frame = mat(0x1a1814, 0.35, 0.25);
    const lens = mat(0x3a4a58, 0.18, 0.55, true);
    for (const side of [-1, 1] as const) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.041, 0.007, 5, 12), frame);
      rim.position.set(side * 0.072, 0.008, -0.166);
      rim.scale.set(1, 0.86, 1);
      const glass = new THREE.Mesh(new THREE.CircleGeometry(0.038, 12), lens);
      glass.position.set(side * 0.072, 0.008, -0.166);
      glass.scale.set(1, 0.86, 1);
      glass.rotation.y = Math.PI;
      const temple = new THREE.Mesh(new THREE.CapsuleGeometry(0.006, 0.13, 2, 5), frame);
      temple.position.set(side * 0.118, 0.016, -0.09);
      temple.rotation.x = Math.PI * 0.5;
      temple.rotation.z = side * 0.24;
      head.add(rim, glass, temple);
    }
    const bridge = new THREE.Mesh(new THREE.CapsuleGeometry(0.006, 0.026, 2, 5), frame);
    bridge.position.set(0, 0.012, -0.182);
    bridge.rotation.z = Math.PI * 0.5;
    head.add(bridge);
    return;
  }
  if (id === "scarf") {
    const wrap = turned(
      [[0.13, 0.03], [0.156, -0.005], [0.162, -0.05], [0.15, -0.088], [0.128, -0.11]],
      k.tunic,
      14,
      12,
    );
    wrap.position.set(0, -0.188, 0.008);
    const knot = turned(
      [[0.002, 0.0], [0.034, 0.014], [0.044, 0.042], [0.03, 0.066], [0.002, 0.074]],
      mat(teamTrim(team), 0.5, 0.12),
      10,
      8,
    );
    knot.position.set(0.05, -0.236, -0.126);
    knot.rotation.x = -1.3;
    const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.16, 4, 8), k.tunic);
    tail.position.set(0.086, -0.33, -0.07);
    tail.rotation.z = -0.22;
    tail.scale.set(1.2, 1, 0.55);
    head.add(wrap, knot, tail);
    cloth.push(wrap, tail);
    return;
  }
  if (id === "earpro") {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.017, 6, 14, Math.PI * 0.9), k.helm);
    band.position.set(0, 0.03, 0.01);
    band.rotation.z = Math.PI * 0.05;
    head.add(band);
    cloth.push(band);
    for (const side of [-1, 1] as const) {
      const cup = turned([[0.002, 0.0], [0.05, 0.006], [0.062, 0.03], [0.058, 0.056], [0.002, 0.064]], k.helm, 12, 10);
      cup.position.set(side * 0.155, -0.008, 0.0);
      cup.rotation.z = side * -Math.PI * 0.5;
      cup.scale.set(1.25, 1, 1.1);
      const pad = turned([[0.05, 0.0], [0.062, 0.008], [0.06, 0.022], [0.048, 0.03]], mat(0x2a241c, 0.92), 12, 6);
      pad.position.set(side * 0.148, -0.008, 0.0);
      pad.rotation.z = side * -Math.PI * 0.5;
      pad.scale.set(1.25, 1, 1.1);
      head.add(cup, pad);
      cloth.push(cup);
    }
    return;
  }
  if (id === "mask") {
    const cover = shellOf(
      [[0.104, -0.012], [0.134, -0.05], [0.142, -0.096], [0.126, -0.136], [0.09, -0.162]],
      mat(0x2a241c, 0.82),
      FRONT,
      2.7,
      12,
      12,
    );
    cover.position.set(0, -0.014, -0.046);
    cover.scale.set(1.02, 1, 1.2);
    const filter = turned([[0.002, 0.0], [0.03, 0.006], [0.038, 0.024], [0.03, 0.04], [0.002, 0.046]], k.plate, 10, 8);
    filter.position.set(0, -0.084, -0.206);
    filter.rotation.x = -1.35;
    filter.scale.set(1.4, 1, 1.4);
    head.add(cover, filter);
    for (const side of [-1, 1] as const) {
      const strap = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.12, 2, 5), mat(0x1a1814, 0.88));
      strap.position.set(side * 0.132, -0.05, -0.01);
      strap.rotation.x = Math.PI * 0.5;
      strap.rotation.z = side * 0.18;
      head.add(strap);
    }
    return;
  }
  const cup = turned([[0.002, 0.0], [0.04, 0.008], [0.05, 0.03], [0.044, 0.05], [0.002, 0.056]], k.helm, 10, 8);
  cup.position.set(-0.152, 0.008, 0.012);
  cup.rotation.z = Math.PI * 0.5;
  cup.scale.set(1.2, 1, 1.1);
  const boom = new THREE.Mesh(new THREE.CapsuleGeometry(0.007, 0.15, 2, 5), k.plate);
  boom.position.set(-0.1, -0.05, -0.078);
  boom.rotation.x = 1.25;
  boom.rotation.z = -0.5;
  const mic = new THREE.Mesh(new THREE.SphereGeometry(0.019, 8, 6), k.plate);
  mic.position.set(-0.048, -0.086, -0.196);
  const lead = new THREE.Mesh(new THREE.CapsuleGeometry(0.006, 0.1, 2, 5), mat(0x1a1814, 0.9));
  lead.position.set(-0.146, -0.096, 0.036);
  lead.rotation.z = 0.28;
  head.add(cup, boom, mic, lead);
  cloth.push(cup);
}

/* --------------------------------- hats --------------------------------- */

function dressHat(head: THREE.Mesh, id: HatId, k: Kit, team: Team, cloth: THREE.Mesh[]) {
  if (id === "none") {
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.01, 4, 4), k.helm);
    helm.visible = false;
    head.add(helm);
    return helm;
  }
  if (id === "watch") {
    const cap = turned(
      [
        [0.002, 0.2], [0.072, 0.196], [0.126, 0.18], [0.162, 0.146], [0.18, 0.096],
        [0.188, 0.036], [0.19, -0.014], [0.203, -0.05], [0.208, -0.086], [0.196, -0.108], [0.184, -0.096],
      ],
      k.helm,
      14,
      13,
    );
    head.add(cap);
    cloth.push(cap);
    return cap;
  }
  if (id === "ushanka") {
    const crown = turned(
      [[0.002, 0.212], [0.086, 0.207], [0.142, 0.19], [0.178, 0.154], [0.196, 0.1], [0.202, 0.04], [0.2, -0.006]],
      k.helm,
      16,
      14,
    );
    const fur = mat(0x6a5a48, 0.96);
    const roll = shellOf([[0.19, 0.03], [0.216, -0.004], [0.218, -0.048], [0.196, -0.072]], fur, FRONT, 2.6, 12, 8);
    crown.add(roll);
    for (const side of [-1, 1] as const) {
      const flap = shellOf(
        [[0.196, 0.0], [0.208, -0.07], [0.202, -0.15], [0.18, -0.2]],
        fur,
        side < 0 ? LEFT : RIGHT,
        1.35,
        8,
        10,
      );
      flap.position.y = 0.02;
      crown.add(flap);
      const tie = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.05, 2, 5), fur);
      tie.position.set(side * 0.15, -0.18, -0.02);
      tie.rotation.z = side * -0.5;
      crown.add(tie);
    }
    head.add(crown);
    cloth.push(crown);
    return crown;
  }
  if (id === "boonie") {
    const dome = turned(
      [[0.002, 0.194], [0.078, 0.19], [0.13, 0.175], [0.164, 0.144], [0.182, 0.1], [0.19, 0.05], [0.19, 0.012]],
      k.helm,
      16,
      14,
    );
    const brim = turned(
      [
        [0.13, 0.024], [0.208, 0.006], [0.27, -0.022], [0.298, -0.056], [0.286, -0.07],
        [0.244, -0.048], [0.184, -0.022], [0.13, -0.006],
      ],
      k.helm,
      14,
      12,
    );
    brim.position.y = 0.022;
    const band = turned([[0.19, 0.03], [0.198, 0.014], [0.196, -0.004], [0.188, -0.014]], mat(0x3a3428, 0.92), 16, 6);
    band.position.y = 0.024;
    dome.add(brim, band);
    head.add(dome);
    cloth.push(dome, brim);
    return dome;
  }
  const helm = turned(
    [
      [0.002, 0.185], [0.062, 0.182], [0.118, 0.166], [0.157, 0.132], [0.182, 0.086],
      [0.198, 0.03], [0.208, -0.028], [0.222, -0.07], [0.226, -0.092], [0.21, -0.096],
      [0.198, -0.062], [0.19, -0.014], [0.182, 0.04],
    ],
    k.helm,
    14,
    15,
  );
  helm.position.y = 0.012;
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.203, 0.011, 5, 16), mat(teamTrim(team), 0.45, 0.2));
  band.position.y = -0.03;
  band.rotation.x = Math.PI * 0.5;
  helm.add(band);
  for (const side of [-1, 1] as const) {
    const strap = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.13, 2, 5), mat(0x3a3228, 0.9));
    strap.position.set(side * 0.158, -0.13, -0.02);
    strap.rotation.z = side * 0.22;
    helm.add(strap);
  }
  head.add(helm);
  cloth.push(helm, band);
  return helm;
}

/* -------------------------------- plumbing ------------------------------- */

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

function tint(hex: number, f: number) {
  return new THREE.Color(hex).multiplyScalar(f).getHex();
}

function mat(color: number, roughness: number, metalness = 0.04, twoSided = false) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    side: twoSided ? THREE.DoubleSide : THREE.FrontSide,
  });
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
