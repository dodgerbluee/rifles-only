/**
 * Join-screen inspect of the selected rifle / knife, including an ADS / glass view.
 */
import * as THREE from "three";
import { makeMelee } from "./knife-variants";
import { gunName, type SecondaryId } from "./loadout";
import { prefs } from "./prefs";
import { RIFLES, makeKar98, makeKar98Scoped, makeMosin, isRifleId } from "./weapons";

export type PreviewMode = "inspect" | "sight";

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
camera.position.set(0.38, 0.14, 0.52);
camera.lookAt(0, 0.02, -0.08);

let renderer: THREE.WebGLRenderer | null = null;
let canvas: HTMLCanvasElement | null = null;
let glassEl: HTMLElement | null = null;
let nameEl: HTMLElement | null = null;
let modeBtn: HTMLButtonElement | null = null;
let gun: SecondaryId = "kar";
let mode: PreviewMode = "inspect";
let spin = 0.6;
let visible = false;

function refreshKnife() {
  const on = knife.visible;
  knife.removeFromParent();
  knife = makeMelee(prefs.look.melee);
  knife.visible = on;
  stage.add(knife);
}

export function previewGun() {
  return gun;
}

export function previewMode() {
  return mode;
}

export function setGunPreviewVisible(on: boolean) {
  visible = on;
  if (canvas) canvas.style.visibility = on ? "visible" : "hidden";
}

export function setPreviewGun(id: SecondaryId, nextMode?: PreviewMode) {
  gun = id;
  if (nextMode) mode = nextMode;
  else if (id === "knife") mode = "inspect";
  else if (isRifleId(id) && RIFLES[id].glass) mode = "sight";
  else mode = "inspect";
  paint();
}

export function togglePreviewMode() {
  if (gun === "knife") {
    mode = "inspect";
  } else {
    mode = mode === "inspect" ? "sight" : "inspect";
  }
  paint();
}

function paint() {
  if (nameEl) nameEl.textContent = gunName(gun);
  if (modeBtn) {
    modeBtn.hidden = gun === "knife";
    modeBtn.textContent = mode === "inspect" ? "View sights" : "View rifle";
  }
  const glassOn = visible && mode === "sight" && gun !== "knife" && isRifleId(gun) && RIFLES[gun].glass;
  if (glassEl) glassEl.classList.toggle("on", glassOn);
}

export function bindGunPreview(opts: {
  canvas: HTMLCanvasElement | null;
  glass?: HTMLElement | null;
  name?: HTMLElement | null;
  modeBtn?: HTMLButtonElement | null;
}) {
  canvas = opts.canvas;
  glassEl = opts.glass ?? null;
  nameEl = opts.name ?? null;
  modeBtn = opts.modeBtn ?? null;
  if (!canvas) return;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  canvas.addEventListener("click", (e) => {
    e.stopPropagation();
    togglePreviewMode();
  });
  modeBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    togglePreviewMode();
  });
  setPreviewGun(gun);
  sizeRenderer();
}

export function tickGunPreview(dt: number) {
  if (!visible || mode !== "inspect") return;
  spin += dt * 0.55;
}

function sizeRenderer() {
  if (!renderer || !canvas) return;
  const w = Math.max(2, canvas.clientWidth);
  const h = Math.max(2, canvas.clientHeight);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

export function renderGunPreview() {
  if (!renderer || !canvas || !visible) return;
  if (knife.userData.melee !== prefs.look.melee) refreshKnife();
  sizeRenderer();
  for (const id of ["kar", "karscope", "mosin"] as const) rifles[id].root.visible = false;
  knife.visible = false;
  if (gun === "knife") {
    knife.visible = true;
    knife.position.set(0, 0.02, 0);
    knife.rotation.set(0.18, spin, -0.08);
    camera.fov = 36;
    camera.position.set(0.22, 0.1, 0.28);
    camera.near = 0.02;
    camera.lookAt(0, 0.02, 0);
  } else if (isRifleId(gun)) {
    const hold = rifles[gun];
    hold.root.visible = true;
    if (mode === "sight") {
      hold.root.position.copy(hold.adsPos);
      hold.root.rotation.set(0, 0, 0);
      camera.fov = RIFLES[gun].adsFov;
      camera.near = 0.02;
      camera.position.set(0, 0, 0);
      camera.rotation.set(0, 0, 0);
      camera.rotation.order = "YXZ";
    } else {
      hold.root.position.set(0, 0, 0);
      hold.root.rotation.set(0.12, spin, 0.04);
      camera.fov = 38;
      camera.near = 0.05;
      camera.position.set(0.42, 0.16, 0.58);
      camera.lookAt(0, 0.02, -0.12);
    }
  }
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  paint();
}
