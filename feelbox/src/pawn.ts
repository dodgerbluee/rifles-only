import * as THREE from "three";
import type { Team } from "./match";

/** Cylinder body (current). Keep so we can revert from admin. */
export type PawnStyle = "classic" | "limbs";
export type PawnSkin = "rifle" | "field" | "unit" | "frame";

export const pawnStyle: { current: PawnStyle } = { current: "limbs" };

export type PawnParts = {
  body: THREE.Mesh;
  head: THREE.Mesh;
  helm: THREE.Mesh;
  rifle: THREE.Mesh;
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

const EMBER = 0x6a3a28;
const STONE = 0x3a4a58;
const SKIN = 0xc4a07a;
const BOOT = 0x1c1814;
const STEEL = 0x1c1e18;
const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

export function teamCloth(team: Team) {
  return team === "ember" ? EMBER : STONE;
}

export function teamHelm(team: Team) {
  return team === "ember" ? 0x3a2018 : 0x1c2830;
}

export function skinFor(id?: number): PawnSkin {
  if (id == null) return "rifle";
  return (["rifle", "field", "unit", "frame"] as const)[Math.abs(id) % 4]!;
}

export function setPawnCloth(cloth: THREE.Mesh[], color: number) {
  for (const m of cloth) (m.material as THREE.MeshStandardMaterial).color.set(color);
}

export function buildPawn(root: THREE.Group, team: Team, botId?: number): PawnParts {
  clearGroup(root);
  const parts = pawnStyle.current === "classic" ? classicPawn(team) : limbsPawn(team, skinFor(botId));
  stamp(parts, team, botId);
  root.add(parts.body, parts.head, parts.helm, parts.rifle);
  if (parts.walk) root.add(parts.walk.lHip, parts.walk.rHip);
  for (const m of parts.hits) {
    if (!m.parent) root.add(m);
  }
  root.userData.body = parts.body;
  root.userData.cloth = parts.cloth;
  root.userData.head = parts.head;
  root.userData.helm = parts.helm;
  root.userData.walk = parts.walk ?? null;
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

export function stepWalk(root: THREE.Group, dist: number, moving: boolean) {
  const rig = root.userData.walk as WalkRig | null | undefined;
  if (!rig) return;
  let gait = Number(root.userData.gait) || 0;
  if (moving) gait += dist * 2.2;
  root.userData.gait = gait;
  poseWalk(rig, gait, moving, root.userData.body instanceof THREE.Mesh ? root.userData.body : undefined);
}

function poseWalk(rig: WalkRig, phase: number, moving: boolean, body?: THREE.Mesh) {
  if (!moving) {
    rig.lHip.rotation.x *= 0.72;
    rig.rHip.rotation.x *= 0.72;
    rig.lKnee.rotation.x *= 0.72;
    rig.rKnee.rotation.x *= 0.72;
    if (body) body.position.y += (BODY_REST_Y - body.position.y) * 0.35;
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
  mark(parts.head, "head");
  mark(parts.helm, "head");
  for (const m of parts.hits) mark(m, "body");
}

function classicPawn(team: Team): PawnParts {
  const color = teamCloth(team);
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.3, 1.38, 10),
    mat(color, 0.85),
  );
  body.position.y = 0.78;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), mat(SKIN, 0.7));
  head.position.y = 1.68;
  const helm = new THREE.Mesh(
    new THREE.SphereGeometry(0.255, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    mat(teamHelm(team), 0.6, 0.15),
  );
  helm.position.y = 1.74;
  const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.62), mat(STEEL, 0.5, 0.3));
  rifle.position.set(0.22, 1.18, -0.3);
  return { body, head, helm, rifle, cloth: [body], hits: [] };
}

type Kit = {
  robot: boolean;
  tunic: THREE.MeshStandardMaterial;
  pants: THREE.MeshStandardMaterial;
  flesh: THREE.MeshStandardMaterial;
  boot: THREE.MeshStandardMaterial;
  helm: THREE.MeshStandardMaterial;
  plate: THREE.MeshStandardMaterial;
};

function kitFor(team: Team, skin: PawnSkin): Kit {
  const ember = team === "ember";
  if (skin === "rifle") {
    return {
      robot: false,
      tunic: mat(teamCloth(team), 0.86),
      pants: mat(ember ? 0x4a2c1e : 0x2c3844, 0.9),
      flesh: mat(SKIN, 0.72),
      boot: mat(BOOT, 0.92),
      helm: mat(teamHelm(team), 0.58, 0.18),
      plate: mat(STEEL, 0.48, 0.35),
    };
  }
  if (skin === "field") {
    return {
      robot: false,
      tunic: mat(ember ? 0x5a4a32 : 0x3a4840, 0.88),
      pants: mat(ember ? 0x2a2418 : 0x243038, 0.92),
      flesh: mat(0x8a6a48, 0.74),
      boot: mat(0x2a2018, 0.9),
      helm: mat(ember ? 0x4a3820 : 0x2a3030, 0.7, 0.08),
      plate: mat(STEEL, 0.48, 0.35),
    };
  }
  if (skin === "unit") {
    return {
      robot: true,
      tunic: mat(ember ? 0x6a4030 : 0x3a4a58, 0.42, 0.55),
      pants: mat(ember ? 0x4a3228 : 0x2c3848, 0.4, 0.5),
      flesh: mat(ember ? 0x8a7060 : 0x6a7888, 0.35, 0.7),
      boot: mat(0x1a1c1e, 0.4, 0.45),
      helm: mat(ember ? 0x3a2218 : 0x1c2830, 0.32, 0.65),
      plate: mat(ember ? 0x8a5a40 : 0x5a7080, 0.28, 0.72),
    };
  }
  return {
    robot: true,
    tunic: mat(ember ? 0x3a2a24 : 0x2a3238, 0.38, 0.62),
    pants: mat(0x1c1e20, 0.36, 0.58),
    flesh: mat(0x4a5054, 0.3, 0.75),
    boot: mat(0x121416, 0.35, 0.5),
    helm: mat(ember ? 0xc45a28 : 0x6a90b0, 0.25, 0.7),
    plate: mat(ember ? 0xb04a28 : 0x4a6a88, 0.22, 0.8),
  };
}

function limbsPawn(team: Team, skin: PawnSkin): PawnParts {
  const k = kitFor(team, skin);
  const cloth: THREE.Mesh[] = [];
  const hits: THREE.Mesh[] = [];
  const extras: THREE.Mesh[] = [];

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.36, 4, 8), k.tunic);
  body.position.y = 1.18;
  cloth.push(body);

  const hips = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), k.pants);
  hips.position.y = 0.92;
  hips.scale.set(1.22, 0.7, 0.95);
  cloth.push(hips);
  hits.push(hips);

  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.055, 8), k.robot ? k.plate : mat(0x2a2218, 0.9));
  belt.position.y = 0.98;

  const lLeg = makeLeg(-1, k, extras);
  const rLeg = makeLeg(1, k, extras);
  cloth.push(...lLeg.cloth, ...rLeg.cloth);
  hits.push(...lLeg.hits, ...rLeg.hits);

  const lArm = bone(-0.24, 1.36, 0.02, -0.16, 1.2, -0.16, 0.068, k.tunic);
  const lFore = bone(-0.16, 1.2, -0.16, 0.02, 1.14, -0.38, 0.058, k.tunic);
  const rArm = bone(0.24, 1.36, 0.02, 0.22, 1.18, -0.1, 0.068, k.tunic);
  const rFore = bone(0.22, 1.18, -0.1, 0.14, 1.12, -0.28, 0.058, k.tunic);
  cloth.push(lArm, lFore, rArm, rFore);
  hits.push(lArm, lFore, rArm, rFore);

  const lHand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), k.flesh);
  lHand.position.set(0.02, 1.14, -0.4);
  const rHand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), k.flesh);
  rHand.position.set(0.14, 1.12, -0.3);

  const head = new THREE.Mesh(
    k.robot ? new THREE.SphereGeometry(0.17, 10, 8) : new THREE.SphereGeometry(0.17, 12, 10),
    k.flesh,
  );
  head.position.y = 1.62;

  const helm = k.robot
    ? robotHelm(k, skin)
    : skin === "field"
      ? fieldCap(k)
      : bowlHelm(k);
  helm.position.y = k.robot ? 1.64 : skin === "field" ? 1.7 : 1.66;

  if (k.robot) extras.push(...robotBits(k, skin, team));
  else if (skin === "field") extras.push(...fieldBits(k));

  const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.72), k.plate);
  rifle.position.set(0.08, 1.15, -0.28);
  rifle.rotation.x = 0.08;
  rifle.rotation.y = 0.12;
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.16), mat(k.robot ? 0x2a2e32 : 0x5a3a22, 0.55, k.robot ? 0.4 : 0.08));
  rifle.add(stock);
  stock.position.set(0, -0.01, 0.28);

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

function bowlHelm(k: Kit) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(0.185, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58),
    k.helm,
  );
}

function fieldCap(k: Kit) {
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.175, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.52), k.helm);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.024, 0.14), k.helm);
  brim.position.set(0, -0.02, -0.1);
  dome.add(brim);
  return dome;
}

function robotHelm(k: Kit, skin: PawnSkin) {
  const helm = new THREE.Mesh(
    skin === "frame" ? new THREE.BoxGeometry(0.3, 0.2, 0.26) : new THREE.CylinderGeometry(0.155, 0.175, 0.18, 8),
    k.helm,
  );
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.05, 0.05),
    new THREE.MeshStandardMaterial({
      color: skin === "frame" ? 0x7ad0ff : 0xff6a32,
      emissive: skin === "frame" ? 0x226688 : 0x5a1808,
      emissiveIntensity: 0.85,
      roughness: 0.25,
      metalness: 0.4,
    }),
  );
  visor.position.set(0, 0.01, -0.12);
  helm.add(visor);
  return helm;
}

function robotBits(k: Kit, skin: PawnSkin, team: Team) {
  const bits: THREE.Mesh[] = [];
  const chest = new THREE.Mesh(
    skin === "frame" ? new THREE.BoxGeometry(0.4, 0.26, 0.24) : new THREE.BoxGeometry(0.36, 0.22, 0.22),
    k.plate,
  );
  chest.position.set(0, 1.22, 0.02);
  bits.push(chest);

  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.12), k.pants);
  pack.position.set(0, 1.2, 0.14);
  bits.push(pack);

  for (const [x, y, z] of [
    [-0.24, 1.36, 0.02],
    [0.24, 1.36, 0.02],
  ] as const) {
    const joint = new THREE.Mesh(new THREE.SphereGeometry(skin === "frame" ? 0.062 : 0.055, 8, 6), k.flesh);
    joint.position.set(x, y, z);
    bits.push(joint);
  }

  if (skin === "frame") {
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 6), k.plate);
    ant.position.set(0.06, 1.78, 0);
    bits.push(ant);
    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(0.022, 6, 6),
      new THREE.MeshStandardMaterial({
        color: team === "ember" ? 0xff6a32 : 0x7ad0ff,
        emissive: team === "ember" ? 0x5a1808 : 0x226688,
        emissiveIntensity: 0.9,
      }),
    );
    tip.position.set(0.06, 1.87, 0);
    bits.push(tip);
  } else {
    const lens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.04, 8),
      new THREE.MeshStandardMaterial({
        color: 0xff6a32,
        emissive: 0x5a1808,
        emissiveIntensity: 0.7,
        metalness: 0.4,
        roughness: 0.3,
      }),
    );
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0.08, 1.22, -0.1);
    bits.push(lens);
  }
  return bits;
}

function fieldBits(k: Kit) {
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.42, 0.02), k.boot);
  strap.position.set(0.1, 1.18, 0.02);
  strap.rotation.z = -0.35;
  const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.06), k.boot);
  pouch.position.set(-0.12, 1.0, 0.04);
  return [strap, pouch];
}

function makeLeg(side: 1 | -1, k: Kit, extras: THREE.Mesh[]) {
  const hip = new THREE.Group();
  hip.position.set(side * 0.1, 0.88, side > 0 ? -0.02 : 0.02);
  hip.rotation.z = side * 0.03;
  if (k.robot) {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), k.flesh);
    hip.add(ball);
    extras.push(ball);
  }
  const thighLen = 0.4;
  const thigh = bone(0, 0, 0, 0, -thighLen, 0, 0.088, k.pants);
  hip.add(thigh);
  const knee = new THREE.Group();
  knee.position.y = -thighLen;
  hip.add(knee);
  if (k.robot) {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), k.flesh);
    knee.add(ball);
    extras.push(ball);
  }
  const shinLen = 0.42;
  const shin = bone(0, 0, 0, 0, -shinLen, 0, 0.078, k.pants);
  knee.add(shin);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.22), k.boot);
  foot.position.set(0, -shinLen - 0.045, -0.08);
  foot.castShadow = true;
  knee.add(foot);
  return { hip, knee, cloth: [thigh, shin], hits: [thigh, shin, foot] };
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
