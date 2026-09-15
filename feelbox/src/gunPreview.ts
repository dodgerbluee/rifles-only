/**
 * Join-screen loadout: each rifle is shown twice — sights/scope and the gun body.
 * One WebGL renderer blits into the 2D canvases on the cards (context budget).
 */
import * as THREE from "three";
import { makeMelee } from "./knife-variants";
import { type SecondaryId } from "./loadout";
import { prefs } from "./prefs";
import { RIFLES, makeKar98, makeKar98Scoped, makeMosin, isRifleId } from "./weapons";

type PreviewKind = "sight" | "inspect";

type Pane = {
  id: SecondaryId;
  kind: PreviewKind;
  canvas: HTMLCanvasElement;
};

const rifles = {
  kar: makeKar98(),
  karscope: makeKar98Scoped(),
  mosin: makeMosin(),
} as const;

const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xe8e0d0, 0x3a3c34, 1.15));
const key = new THREE.DirectionalLight(0xfff6e8, 1.35);
key.position.set(0.6, 1.1, 0.8);
scene.add(key);
scene.add(new THREE.AmbientLight(0x6a6860, 0.35));

const stage = new THREE.Group();
scene.add(stage);
for (const id of ["kar", "karscope", "mosin"] as const) {
  rifles[id].flash.visible = false;
  rifles[id].root.position.set(0, 0, 0);
  rifles[id].root.visible = false;
  stage.add(rifles[id].root);
}

let knife = makeMelee(prefs.look.melee);
knife.visible = false;
stage.add(knife);

const camera = new THREE.PerspectiveCamera(42, 1, 0.02, 8);

let renderer: THREE.WebGLRenderer | null = null;
let panes: Pane[] = [];
let spin = 0.6;
let visible = false;

function refreshKnife() {
  const on = knife.visible;
  knife.removeFromParent();
  knife = makeMelee(prefs.look.melee);
  knife.visible = on;
  stage.add(knife);
}

export function setGunPreviewVisible(on: boolean) {
  visible = on;
}

export function bindGunPreview() {
  if (renderer) return;
  const canvas = document.createElement("canvas");
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
}

export function syncGunPreviews(root: HTMLElement | null) {
  panes = [];
  if (!root) return;
  for (const canvas of root.querySelectorAll<HTMLCanvasElement>("canvas[data-preview]")) {
    const id = canvas.closest("[data-gun]")?.getAttribute("data-gun");
    const kind = canvas.dataset.preview;
    if (!id || (kind !== "sight" && kind !== "inspect")) continue;
    if (id !== "knife" && !isRifleId(id)) continue;
    panes.push({ id: id as SecondaryId, kind, canvas });
  }
}

export function tickGunPreview(dt: number) {
  if (!visible) return;
  spin += dt * 0.55;
}

function pose(id: SecondaryId, kind: PreviewKind) {
  for (const rifleId of ["kar", "karscope", "mosin"] as const) rifles[rifleId].root.visible = false;
  knife.visible = false;
  if (id === "knife") {
    knife.visible = true;
    knife.position.set(0, 0.02, 0);
    knife.rotation.set(0.18, spin, -0.08);
    camera.fov = 36;
    camera.near = 0.02;
    camera.position.set(0.22, 0.1, 0.28);
    camera.lookAt(0, 0.02, 0);
    return;
  }
  if (!isRifleId(id)) return;
  const hold = rifles[id];
  hold.root.visible = true;
  if (kind === "sight") {
    hold.root.position.copy(hold.adsPos);
    hold.root.rotation.set(0, 0, 0);
    camera.fov = RIFLES[id].adsFov;
    camera.near = 0.02;
    camera.position.set(0, 0, 0);
    camera.rotation.set(0, 0, 0);
    camera.rotation.order = "YXZ";
    return;
  }
  hold.root.position.set(0, 0, 0);
  hold.root.rotation.set(0.12, spin, 0.04);
  camera.fov = 38;
  camera.near = 0.05;
  camera.position.set(0.42, 0.16, 0.58);
  camera.lookAt(0, 0.02, -0.12);
}

function blit(dest: HTMLCanvasElement) {
  if (!renderer) return;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const cssW = dest.clientWidth;
  const cssH = dest.clientHeight;
  if (cssW < 2 || cssH < 2) return;
  const w = Math.max(2, Math.floor(cssW * dpr));
  const h = Math.max(2, Math.floor(cssH * dpr));
  if (dest.width !== w || dest.height !== h) {
    dest.width = w;
    dest.height = h;
  }
  const gl = renderer.domElement;
  if (gl.width !== w || gl.height !== h) renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  const ctx = dest.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(gl, 0, 0, w, h);
}

export function renderGunPreview() {
  if (!renderer || !visible) return;
  if (knife.userData.melee !== prefs.look.melee) refreshKnife();
  for (const pane of panes) {
    pose(pane.id, pane.kind);
    blit(pane.canvas);
  }
}
