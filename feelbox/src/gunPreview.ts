/**
 * Join-screen loadout: each rifle is shown twice — sights/scope and the gun body.
 * One WebGL renderer blits into the 2D canvases on the cards (context budget).
 */
import * as THREE from "three";
import { makeMelee } from "./knife-variants";
import { PRIMARY_IDS, type SecondaryId } from "./loadout";
import { prefs } from "./prefs";
import { RIFLES, makeKar98, makeKar98Two, makeKar98Scoped, makeMosin, isRifleId, poseAdsMask } from "./weapons";

type PreviewKind = "sight" | "inspect";

type Pane = {
  id: SecondaryId;
  kind: PreviewKind;
  canvas: HTMLCanvasElement;
};

const rifles = {
  kar: makeKar98(),
  kar2: makeKar98Two(),
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
for (const id of PRIMARY_IDS) {
  rifles[id].flash.visible = false;
  rifles[id].root.position.set(0, 0, 0);
  rifles[id].root.visible = false;
  stage.add(rifles[id].root);
}

const world = new THREE.Group();
world.visible = false;
world.add(
  new THREE.Mesh(
    new THREE.SphereGeometry(8, 20, 14),
    new THREE.MeshBasicMaterial({ color: 0xc8cbc4, side: THREE.BackSide }),
  ),
);
{
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 28),
    new THREE.MeshLambertMaterial({ color: 0x9a968c }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.55;
  world.add(ground);
  const plaster = new THREE.MeshLambertMaterial({ color: 0x8a8478 });
  const brick = new THREE.MeshLambertMaterial({ color: 0x7a5a48 });
  const hut = (x: number, z: number, w: number, h: number, d: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, h * 0.5 - 0.55, z);
    world.add(m);
  };
  hut(-1.4, -4.6, 1.5, 1.15, 1.3, plaster);
  hut(1.7, -5.4, 1.9, 1.7, 1.5, brick);
  hut(0.1, -7.2, 2.6, 0.72, 1.9, plaster);
}
scene.add(world);

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
  for (const rifleId of PRIMARY_IDS) rifles[rifleId].root.visible = false;
  knife.visible = false;
  world.visible = false;
  camera.far = 8;
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
  poseAdsMask(hold, false);
  if (kind === "sight") {
    world.visible = true;
    camera.far = 24;
    if (RIFLES[id].glass) {
      camera.fov = 26;
      camera.near = 0.08;
      camera.position.set(0, 0.14, 0.9);
      camera.lookAt(0.12, 0.02, -6);
      return;
    }
    hold.root.visible = true;
    hold.root.position.copy(hold.adsPos);
    hold.root.rotation.set(hold.adsPitch ?? 0, 0, 0);
    poseAdsMask(hold, !!hold.adsGrip);
    camera.fov = hold.adsGrip ? 80 : RIFLES[id].adsFov;
    camera.near = 0.02;
    camera.position.set(0, 0, 0);
    camera.rotation.set(0, 0, 0);
    camera.rotation.order = "YXZ";
    return;
  }
  hold.root.visible = true;
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
