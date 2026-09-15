import * as THREE from "three";
import { makeKar98, type RifleView } from "./weapons";

/** ADS pictures for the iron Kar98k. Zoom, scoped Kar, and hip fire stay on main. */
export type IronOptionId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type IronPreview = {
  id: IronOptionId | "current";
  name: string;
  blurb: string;
  root: THREE.Group;
  adsPos: THREE.Vector3;
  adsPitch: number;
};

export const IRON_OPTION_META: { id: IronOptionId; name: string; blurb: string }[] = [
  {
    id: 1,
    name: "CoD1 barrel cup",
    blurb: "Faceted barrel in your face, T-ears on the near band, wrap hands, walnut left. Closest copy of the reference.",
  },
  {
    id: 2,
    name: "Open U on the cup",
    blurb: "Same close barrel mass, but a deep rounded Kar98k U-leaf instead of T-ears. World shows through the notch.",
  },
  {
    id: 3,
    name: "Bigger leaf, same rifle",
    blurb: "Keeps the slim Kar. Scales up the tangent rear leaf and sits the eye closer so the U fills more of the view.",
  },
  {
    id: 4,
    name: "Open pipe",
    blurb: "Thick-walled octagon you look down. T-ears on the rim, world in the bore — a tube, not a plugged muzzle.",
  },
  {
    id: 5,
    name: "Protective V-ears",
    blurb: "Two tall ears, no floor bar. You aim through the V with the front blade in the gap.",
  },
  {
    id: 6,
    name: "GoldSrc chunky",
    blurb: "Fewer sides, fatter barrel, bigger hands, darker metal. The low-poly CoD1 read, pushed further.",
  },
  {
    id: 7,
    name: "Receiver close-up",
    blurb: "You sit over a faceted receiver, not inside a giant muzzle. U-leaf on top, barrel running away smaller.",
  },
  {
    id: 8,
    name: "Semi-hooded U",
    blurb: "Rounded hood around the rear notch on a close barrel. Still an iron, not ZF glass — open at the top.",
  },
  {
    id: 9,
    name: "Classic FPS irons",
    blurb: "No cup. A large close U and a small distant post, world filling the rest of the screen.",
  },
  {
    id: 10,
    name: "Metal only",
    blurb: "Option 1’s barrel and T-ears, no wrap hands and no stock. Tests whether the CoD1 look is the metal or the whole pose.",
  },
];

type RearKind = "t-ears" | "u-leaf" | "v-ears" | "hood";
type BoreKind = "pinhole" | "open" | "plug";

type CupSpec = {
  segs: number;
  nearR: number;
  lookLift: number;
  pitch: number;
  eye: number;
  rear: RearKind;
  bore: BoreKind;
  hands: boolean;
  stock: boolean;
  lug: boolean;
  slimBarrel: boolean;
};

function mats() {
  const blued = new THREE.MeshLambertMaterial({ color: 0x2a2c26, flatShading: true });
  const worn = new THREE.MeshLambertMaterial({ color: 0x3a3c36, flatShading: true });
  const dark = new THREE.MeshLambertMaterial({ color: 0x141512, flatShading: true });
  const face = new THREE.MeshLambertMaterial({ color: 0x32342e, flatShading: true });
  const skin = new THREE.MeshLambertMaterial({ color: 0xb08968, flatShading: true });
  const stock = new THREE.MeshLambertMaterial({ color: 0x5a3824, flatShading: true });
  return { blued, worn, dark, face, skin, stock };
}

function place(parent: THREE.Object3D, mesh: THREE.Mesh, x: number, y: number, z: number) {
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function cylZ(r: number, len: number, mat: THREE.Material, segs: number) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, segs), mat);
  m.rotation.x = Math.PI / 2;
  return m;
}

function pipeZ(r: number, len: number, mat: THREE.Material, segs: number) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, segs, 1, true), mat.clone());
  m.rotation.x = Math.PI / 2;
  (m.material as THREE.Material).side = THREE.DoubleSide;
  return m;
}

function extrude(shape: THREE.Shape, depth: number, mat: THREE.Material, curveSegments = 8) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: depth * 0.12,
    bevelSize: depth * 0.1,
    bevelSegments: 1,
    curveSegments,
  });
  geo.translate(0, 0, -depth / 2);
  return new THREE.Mesh(geo, mat);
}

function uLeaf(width: number, height: number, notchW: number, notchFloor: number) {
  const hw = width * 0.5;
  const nw = notchW * 0.5;
  const leaf = new THREE.Shape();
  leaf.moveTo(-hw, 0);
  leaf.lineTo(-hw, height);
  leaf.lineTo(-nw, height);
  leaf.lineTo(-nw, notchFloor + (height - notchFloor) * 0.35);
  leaf.quadraticCurveTo(-nw, notchFloor, 0, notchFloor);
  leaf.quadraticCurveTo(nw, notchFloor, nw, notchFloor + (height - notchFloor) * 0.35);
  leaf.lineTo(nw, height);
  leaf.lineTo(hw, height);
  leaf.lineTo(hw, 0);
  leaf.closePath();
  return leaf;
}

function wrapHands(
  g: THREE.Group,
  axisY: number,
  nearR: number,
  faceZ: number,
  skin: THREE.Material,
  chunk = 1,
) {
  const r = nearR;
  function hand(side: 1 | -1) {
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.016 * chunk, 6, 5), skin);
    palm.scale.set(0.85, 1.05, 1.3);
    palm.position.set(side * (r + 0.012 * chunk), axisY + 0.004, faceZ - 0.042);
    g.add(palm);
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.006 * chunk, 0.015 * chunk, 2, 5), skin);
    thumb.position.set(side * r * 0.82, axisY + r * 0.85, faceZ - 0.018);
    thumb.rotation.z = -side * 0.85;
    thumb.rotation.x = 0.25;
    g.add(thumb);
    for (let i = 0; i < 4; i++) {
      const t = i / 3;
      const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.0048 * chunk, 0.016 * chunk, 2, 5), skin);
      f.position.set(
        side * (r + 0.004 - t * 0.004),
        axisY + r * 0.35 - t * 0.008,
        faceZ - 0.028 - t * 0.008,
      );
      f.rotation.z = -side * 0.95;
      f.rotation.x = 0.45;
      g.add(f);
    }
  }
  hand(-1);
  hand(1);
}

function rearOnCup(
  g: THREE.Group,
  kind: RearKind,
  axisY: number,
  nearR: number,
  faceZ: number,
  blued: THREE.Material,
  worn: THREE.Material,
) {
  const earZ = faceZ - 0.005;
  const top = axisY + nearR - 0.003;
  if (kind === "t-ears") {
    const earH = 0.028;
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.007, earH, 0.012), worn);
    left.position.set(-0.007, top + earH * 0.5, earZ);
    g.add(left);
    const right = new THREE.Mesh(new THREE.BoxGeometry(0.007, earH, 0.012), worn);
    right.position.set(0.007, top + earH * 0.5, earZ);
    g.add(right);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.005, 0.012), blued);
    bar.position.set(0, top, earZ);
    g.add(bar);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.0032, 0.018, 0.006), worn);
    blade.position.set(0, top + 0.016, earZ - 0.01);
    g.add(blade);
    return;
  }
  if (kind === "v-ears") {
    const earH = 0.034;
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.006, earH, 0.011), worn);
    left.position.set(-0.01, top + earH * 0.45, earZ);
    left.rotation.z = 0.18;
    g.add(left);
    const right = new THREE.Mesh(new THREE.BoxGeometry(0.006, earH, 0.011), worn);
    right.position.set(0.01, top + earH * 0.45, earZ);
    right.rotation.z = -0.18;
    g.add(right);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.0028, 0.02, 0.006), worn);
    blade.position.set(0, top + 0.014, faceZ - 0.22);
    g.add(blade);
    return;
  }
  if (kind === "u-leaf") {
    const leaf = extrude(uLeaf(0.046, 0.028, 0.016, 0.007), 0.01, worn, 8);
    place(g, leaf, 0, top, earZ);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.0028, 0.016, 0.006), worn);
    blade.position.set(0, top + 0.02, faceZ - 0.28);
    g.add(blade);
    return;
  }
  const leaf = extrude(uLeaf(0.04, 0.022, 0.014, 0.006), 0.01, worn, 8);
  place(g, leaf, 0, top, earZ);
  const hood = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0036, 6, 10, Math.PI), blued);
  hood.rotation.x = Math.PI / 2;
  hood.rotation.z = Math.PI;
  hood.position.set(0, top + 0.01, earZ);
  g.add(hood);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.0028, 0.016, 0.006), worn);
  blade.position.set(0, top + 0.018, faceZ - 0.26);
  g.add(blade);
}

function boreOnCup(
  g: THREE.Group,
  kind: BoreKind,
  axisY: number,
  nearR: number,
  faceZ: number,
  segs: number,
  dark: THREE.Material,
  worn: THREE.Material,
  face: THREE.Material,
) {
  const inner = nearR * 0.55;
  const lip = new THREE.Mesh(new THREE.RingGeometry(inner, nearR, segs), face);
  lip.material.side = THREE.DoubleSide;
  lip.position.set(0, axisY, faceZ + 0.0008);
  g.add(lip);
  const step = new THREE.Mesh(new THREE.RingGeometry(inner * 1.08, nearR * 0.82, segs), worn);
  step.material.side = THREE.DoubleSide;
  step.position.set(0, axisY, faceZ - 0.006);
  g.add(step);
  place(g, pipeZ(inner, 0.04, dark, segs), 0, axisY, faceZ - 0.02);
  if (kind === "open") {
    place(g, pipeZ(inner * 0.92, 0.18, dark, segs), 0, axisY, faceZ - 0.1);
    return;
  }
  const hole = kind === "pinhole" ? inner * 0.32 : inner * 0.14;
  const plug = new THREE.Mesh(new THREE.RingGeometry(hole, inner * 0.98, segs), dark);
  plug.material.side = THREE.DoubleSide;
  plug.position.set(0, axisY, faceZ - 0.036);
  g.add(plug);
}

function buildCup(spec: CupSpec) {
  const g = new THREE.Group();
  const { blued, worn, dark, face, skin, stock } = mats();
  const axisY = 0.034;
  const faceZ = 0.024;
  const nearR = spec.nearR;
  const segs = spec.segs;
  const barrelY = axisY - 0.012;

  place(g, pipeZ(nearR, 0.055, blued, segs), 0, barrelY, faceZ - 0.024);
  place(g, pipeZ(nearR * 0.82, 0.04, worn, segs), 0, barrelY, faceZ - 0.062);
  if (spec.slimBarrel) {
    place(g, pipeZ(0.016, 0.2, blued, segs), 0, axisY + 0.004, faceZ - 0.18);
  } else {
    place(g, pipeZ(nearR * 0.55, 0.18, blued, segs), 0, axisY + 0.002, faceZ - 0.15);
  }

  boreOnCup(g, spec.bore, barrelY, nearR, faceZ, segs, dark, worn, face);
  rearOnCup(g, spec.rear, barrelY, nearR, faceZ, blued, worn);

  if (spec.lug) {
    const lug = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.018, 0.028), worn);
    lug.position.set(-nearR * 0.65, axisY - nearR * 0.45, faceZ - 0.02);
    g.add(lug);
  }
  if (spec.stock) {
    const wood = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.042, 0.2), stock);
    wood.position.set(-0.062, axisY - 0.05, faceZ - 0.02);
    wood.rotation.z = 0.28;
    g.add(wood);
  }
  if (spec.hands) wrapHands(g, axisY - 0.012, nearR, faceZ, skin, spec.segs <= 6 ? 1.18 : 1);

  const lookY = axisY - 0.012 + spec.lookLift;
  return {
    group: g,
    adsPos: new THREE.Vector3(0, -lookY, -(faceZ + spec.eye)),
    adsPitch: spec.pitch,
  };
}

function scaleRearLeaf(root: THREE.Object3D, s: number) {
  root.traverse((c) => {
    if (c.userData.karIronRear) c.scale.set(s, s, 1.15);
  });
}

function fromRifle(closerZ: number, leafScale: number, pitch: number) {
  const view = makeKar98();
  view.flash.visible = false;
  scaleRearLeaf(view.root, leafScale);
  const adsPos = view.adsPos.clone();
  adsPos.z = closerZ;
  return { root: view.root, adsPos, adsPitch: pitch, view };
}

const CUPS: Record<1 | 2 | 4 | 5 | 6 | 7 | 8 | 10, CupSpec> = {
  1: {
    segs: 8,
    nearR: 0.039,
    lookLift: 0.013,
    pitch: -0.22,
    eye: 0.082,
    rear: "t-ears",
    bore: "pinhole",
    hands: true,
    stock: true,
    lug: true,
    slimBarrel: false,
  },
  2: {
    segs: 8,
    nearR: 0.039,
    lookLift: 0.02,
    pitch: -0.18,
    eye: 0.1,
    rear: "u-leaf",
    bore: "open",
    hands: true,
    stock: true,
    lug: true,
    slimBarrel: false,
  },
  4: {
    segs: 8,
    nearR: 0.04,
    lookLift: 0.01,
    pitch: -0.16,
    eye: 0.095,
    rear: "t-ears",
    bore: "open",
    hands: true,
    stock: true,
    lug: true,
    slimBarrel: false,
  },
  5: {
    segs: 8,
    nearR: 0.038,
    lookLift: 0.018,
    pitch: -0.14,
    eye: 0.1,
    rear: "v-ears",
    bore: "open",
    hands: true,
    stock: true,
    lug: true,
    slimBarrel: false,
  },
  6: {
    segs: 6,
    nearR: 0.05,
    lookLift: 0.012,
    pitch: -0.26,
    eye: 0.072,
    rear: "t-ears",
    bore: "pinhole",
    hands: true,
    stock: true,
    lug: true,
    slimBarrel: false,
  },
  7: {
    segs: 8,
    nearR: 0.022,
    lookLift: 0.016,
    pitch: -0.1,
    eye: 0.12,
    rear: "u-leaf",
    bore: "open",
    hands: true,
    stock: true,
    lug: true,
    slimBarrel: true,
  },
  8: {
    segs: 8,
    nearR: 0.037,
    lookLift: 0.018,
    pitch: -0.17,
    eye: 0.1,
    rear: "hood",
    bore: "pinhole",
    hands: true,
    stock: true,
    lug: true,
    slimBarrel: false,
  },
  10: {
    segs: 8,
    nearR: 0.039,
    lookLift: 0.013,
    pitch: -0.22,
    eye: 0.082,
    rear: "t-ears",
    bore: "pinhole",
    hands: false,
    stock: false,
    lug: true,
    slimBarrel: false,
  },
};

function currentPreview(): IronPreview {
  const view = makeKar98();
  view.flash.visible = false;
  return {
    id: "current",
    name: "Current (main)",
    blurb: "Broad rounded U-leaf on the slim rifle. Unchanged until you pick an option.",
    root: view.root,
    adsPos: view.adsPos.clone(),
    adsPitch: view.adsPitch ?? 0,
  };
}

export function makeIronPreview(id: IronOptionId | "current"): IronPreview {
  if (id === "current") return currentPreview();
  const meta = IRON_OPTION_META.find((m) => m.id === id)!;
  if (id === 3) {
    const built = fromRifle(-0.1, 1.85, -0.08);
    return { id, name: meta.name, blurb: meta.blurb, root: built.root, adsPos: built.adsPos, adsPitch: built.adsPitch };
  }
  if (id === 9) {
    const built = fromRifle(-0.055, 2.45, -0.05);
    return { id, name: meta.name, blurb: meta.blurb, root: built.root, adsPos: built.adsPos, adsPitch: built.adsPitch };
  }
  const cup = buildCup(CUPS[id]);
  return {
    id,
    name: meta.name,
    blurb: meta.blurb,
    root: cup.group,
    adsPos: cup.adsPos,
    adsPitch: cup.adsPitch,
  };
}

/** Attach a cup option onto an existing iron Kar. No-op for rifle-mesh options 3 and 9 (those mutate ads pose only). */
export function applyIronOption(view: RifleView, id: IronOptionId) {
  if (id === 3) {
    scaleRearLeaf(view.root, 1.85);
    view.adsPos.z = -0.1;
    view.adsPitch = -0.08;
    return;
  }
  if (id === 9) {
    scaleRearLeaf(view.root, 2.45);
    view.adsPos.z = -0.055;
    view.adsPitch = -0.05;
    return;
  }
  const cup = buildCup(CUPS[id]);
  cup.group.userData.karIronSight = true;
  cup.group.visible = false;
  view.root.add(cup.group);
  view.adsPos.copy(cup.adsPos);
  view.adsPitch = cup.adsPitch;
  view.adsGrip = {
    left: new THREE.Vector3(-0.05, 0.03, 0.0),
    right: new THREE.Vector3(0.05, 0.03, 0.0),
  };
}
