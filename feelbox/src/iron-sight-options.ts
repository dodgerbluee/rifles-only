import * as THREE from "three";
import { makeKar98, type RifleView } from "./weapons";

/**
 * Iron Kar sight pictures only. Every option keeps makeKar98()'s adsPos / adsPitch /
 * adsFov — no cups, no pitch-down, no closer eye.
 *
 * Base: previous option 3 U-leaf, width and height cut by 40%, plus a vertical
 * rectangle on the bore line whose top is the bullet point of aim.
 */
export type IronOptionId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type IronPreview = {
  id: IronOptionId | "current";
  name: string;
  blurb: string;
  root: THREE.Group;
  adsPos: THREE.Vector3;
  adsPitch: number;
};

/** Option 3 leaf was the main rear * 1.85. These are that size * 0.6. */
const OPT3 = 1.85;
const SHRINK = 0.6;
const LEAF_W = 0.048 * OPT3 * SHRINK;
const LEAF_H = 0.026 * OPT3 * SHRINK;
const NOTCH_W = 0.016 * OPT3 * SHRINK;
const REAR_Z = -0.08;
const POST_Z = -0.5;
const AXIS_Y = 0.034;
const REC_R = 0.013;
const REC_TOP = AXIS_Y + REC_R;
const POST_H = 0.01 * 0.5;
const AIM_Y = REC_TOP + POST_H;

export const IRON_OPTION_META: { id: IronOptionId; name: string; blurb: string }[] = [
  {
    id: 1,
    name: "Thin bar in rounded U",
    blurb: "Option 3’s U, 40% smaller. Thin vertical rectangle in the notch; top is the point of aim.",
  },
  {
    id: 2,
    name: "Medium bar in rounded U",
    blurb: "Same U. Wider aiming rectangle so the bullet line is easier to pick up.",
  },
  {
    id: 3,
    name: "Thick bar in rounded U",
    blurb: "Same U. Chunky center rectangle — the whole bar is the aiming reference.",
  },
  {
    id: 4,
    name: "Square notch + bar",
    blurb: "Square-cut notch instead of a rounded U. Medium rectangle in the middle.",
  },
  {
    id: 5,
    name: "V-notch + bar",
    blurb: "V-cut ears. Medium rectangle centered in the V.",
  },
  {
    id: 6,
    name: "Bar with square bead",
    blurb: "Thin rectangle with a small square on top. The bead is the bullet spot.",
  },
  {
    id: 7,
    name: "Tight slot + bar",
    blurb: "Narrower notch hugging the rectangle so the bar fills the opening.",
  },
  {
    id: 8,
    name: "Two ears + bar",
    blurb: "Separate left/right ears and a floor, option-3 size, with the aiming rectangle between them.",
  },
  {
    id: 9,
    name: "Clean U, front rectangle",
    blurb: "Open rounded U with no rear bar. The aiming rectangle is the front post, top = POI.",
  },
  {
    id: 10,
    name: "Rear and front bars",
    blurb: "Aligned rectangles at the rear notch and the front post. Same line as the bullet.",
  },
];

type Notch = "round" | "square" | "vee" | "tight" | "ears";

type SightSpec = {
  notch: Notch;
  barW: number;
  rearBar: boolean;
  frontBar: boolean;
  bead: boolean;
  frontScale: number;
};

const SPECS: Record<IronOptionId, SightSpec> = {
  1: { notch: "round", barW: 0.0022, rearBar: true, frontBar: true, bead: false, frontScale: 0.72 },
  2: { notch: "round", barW: 0.0034, rearBar: true, frontBar: true, bead: false, frontScale: 0.72 },
  3: { notch: "round", barW: 0.005, rearBar: true, frontBar: true, bead: false, frontScale: 0.72 },
  4: { notch: "square", barW: 0.0034, rearBar: true, frontBar: true, bead: false, frontScale: 0.72 },
  5: { notch: "vee", barW: 0.0034, rearBar: true, frontBar: true, bead: false, frontScale: 0.72 },
  6: { notch: "round", barW: 0.0022, rearBar: true, frontBar: true, bead: true, frontScale: 0.72 },
  7: { notch: "tight", barW: 0.0034, rearBar: true, frontBar: true, bead: false, frontScale: 0.72 },
  8: { notch: "ears", barW: 0.0034, rearBar: true, frontBar: true, bead: false, frontScale: 0.72 },
  9: { notch: "round", barW: 0.0034, rearBar: false, frontBar: true, bead: false, frontScale: 1 },
  10: { notch: "round", barW: 0.0034, rearBar: true, frontBar: true, bead: false, frontScale: 1 },
};

function extrude(shape: THREE.Shape, depth: number, mat: THREE.Material, curveSegments = 8) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: depth * 0.1,
    bevelSize: depth * 0.08,
    bevelSegments: 1,
    curveSegments,
  });
  geo.translate(0, 0, -depth / 2);
  return new THREE.Mesh(geo, mat);
}

function roundU(width: number, height: number, notchW: number, notchFloor: number) {
  const hw = width * 0.5;
  const nw = notchW * 0.5;
  const leaf = new THREE.Shape();
  leaf.moveTo(-hw, 0);
  leaf.lineTo(-hw, height);
  leaf.lineTo(-nw, height);
  leaf.lineTo(-nw, notchFloor + (height - notchFloor) * 0.32);
  leaf.quadraticCurveTo(-nw, notchFloor, 0, notchFloor);
  leaf.quadraticCurveTo(nw, notchFloor, nw, notchFloor + (height - notchFloor) * 0.32);
  leaf.lineTo(nw, height);
  leaf.lineTo(hw, height);
  leaf.lineTo(hw, 0);
  leaf.closePath();
  return leaf;
}

function squareU(width: number, height: number, notchW: number, notchFloor: number) {
  const hw = width * 0.5;
  const nw = notchW * 0.5;
  const leaf = new THREE.Shape();
  leaf.moveTo(-hw, 0);
  leaf.lineTo(-hw, height);
  leaf.lineTo(-nw, height);
  leaf.lineTo(-nw, notchFloor);
  leaf.lineTo(nw, notchFloor);
  leaf.lineTo(nw, height);
  leaf.lineTo(hw, height);
  leaf.lineTo(hw, 0);
  leaf.closePath();
  return leaf;
}

function veeU(width: number, height: number, notchW: number, notchFloor: number) {
  const hw = width * 0.5;
  const nw = notchW * 0.5;
  const leaf = new THREE.Shape();
  leaf.moveTo(-hw, 0);
  leaf.lineTo(-hw, height);
  leaf.lineTo(-nw, height);
  leaf.lineTo(0, notchFloor);
  leaf.lineTo(nw, height);
  leaf.lineTo(hw, height);
  leaf.lineTo(hw, 0);
  leaf.closePath();
  return leaf;
}

function steelOf(root: THREE.Object3D) {
  let mat: THREE.Material | undefined;
  root.traverse((c) => {
    if (mat) return;
    const mesh = c as THREE.Mesh;
    if (mesh.userData.karIronRear && mesh.isMesh) mat = mesh.material as THREE.Material;
  });
  return (mat ?? new THREE.MeshStandardMaterial({ color: 0x1c1e1a, roughness: 0.3, metalness: 0.7 })).clone();
}

function hideDefaultSights(root: THREE.Object3D) {
  const hide: THREE.Object3D[] = [];
  root.traverse((c) => {
    if (c.userData.karIronRear) hide.push(c);
    if (!(c instanceof THREE.Mesh)) return;
    if (Math.abs(c.position.z - POST_Z) > 1e-4) return;
    const geo = c.geometry as THREE.CylinderGeometry;
    if (geo.type !== "CylinderGeometry") return;
    if ((geo.parameters.radiusTop ?? 1) >= 0.003) return;
    hide.push(c);
  });
  for (const o of hide) o.visible = false;
}

function poiBar(mat: THREE.Material, width: number, height: number, depth: number, z: number, bead: boolean) {
  const g = new THREE.Group();
  g.userData.karPoiBar = true;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat);
  bar.position.set(0, AIM_Y, z);
  g.add(bar);
  if (bead) {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(width * 1.7, width * 1.7, depth * 1.15), mat);
    cap.position.set(0, AIM_Y, z + 0.0005);
    g.add(cap);
  }
  return g;
}

function addEars(root: THREE.Group, mat: THREE.Material) {
  const thick = 0.0032;
  const gap = NOTCH_W * 0.5;
  const left = new THREE.Mesh(new THREE.BoxGeometry(thick, LEAF_H, 0.01), mat);
  left.position.set(-gap - thick * 0.5, REC_TOP + LEAF_H * 0.5, REAR_Z);
  root.add(left);
  const right = new THREE.Mesh(new THREE.BoxGeometry(thick, LEAF_H, 0.01), mat);
  right.position.set(gap + thick * 0.5, REC_TOP + LEAF_H * 0.5, REAR_Z);
  root.add(right);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(LEAF_W, thick, 0.01), mat);
  floor.position.set(0, REC_TOP + thick * 0.5, REAR_Z);
  root.add(floor);
}

function installSight(root: THREE.Group, spec: SightSpec) {
  hideDefaultSights(root);
  const steel = steelOf(root);
  const notchW = spec.notch === "tight" ? Math.max(spec.barW + 0.0024, NOTCH_W * 0.55) : NOTCH_W;
  const notchFloor = 0.0016;
  if (spec.notch === "ears") {
    addEars(root, steel);
  } else {
    const shape =
      spec.notch === "square"
        ? squareU(LEAF_W, LEAF_H, notchW, notchFloor)
        : spec.notch === "vee"
          ? veeU(LEAF_W, LEAF_H, notchW, notchFloor)
          : roundU(LEAF_W, LEAF_H, notchW, notchFloor);
    const leaf = extrude(shape, 0.01, steel, spec.notch === "round" || spec.notch === "tight" ? 8 : 2);
    leaf.userData.karIronRear = true;
    leaf.position.set(0, REC_TOP, REAR_Z);
    root.add(leaf);
  }
  if (spec.rearBar) root.add(poiBar(steel, spec.barW, LEAF_H * 0.68, 0.008, REAR_Z + 0.001, spec.bead));
  if (spec.frontBar) root.add(poiBar(steel, spec.barW * spec.frontScale, POST_H + 0.008, 0.005, POST_Z, spec.bead && !spec.rearBar));
}

function riflePreview(id: IronOptionId | "current", name: string, blurb: string): IronPreview {
  const view = makeKar98();
  view.flash.visible = false;
  if (id !== "current") installSight(view.root, SPECS[id]);
  return {
    id,
    name,
    blurb,
    root: view.root,
    adsPos: view.adsPos.clone(),
    adsPitch: view.adsPitch ?? 0,
  };
}

export function makeIronPreview(id: IronOptionId | "current"): IronPreview {
  if (id === "current") {
    return riflePreview("current", "Current (main)", "Main’s U-leaf and post. Aim pose unchanged.");
  }
  const meta = IRON_OPTION_META.find((m) => m.id === id)!;
  return riflePreview(id, meta.name, meta.blurb);
}

/** Swap only the iron meshes. Never touches adsPos, adsPitch, adsGrip, or FOV. */
export function applyIronOption(view: RifleView, id: IronOptionId) {
  installSight(view.root, SPECS[id]);
}
