import * as THREE from "three";
import { KNIFE_KINDS, makeKnifeVariant } from "./knife-variants";
import { knifeWrist, makeRightArm, poseArm, poseKnifeRest, poseKnifeSlash } from "./weapons";

const params = new URLSearchParams(location.search);
let index = clampIndex(Number(params.get("v") ?? params.get("k") ?? "0"));
let slashing = params.get("slash") === "1" || params.get("slash") === "true";
let orbitYaw = 0;
let orbitPitch = 0;

const canvas = document.querySelector<HTMLCanvasElement>("#view")!;
const titleEl = document.querySelector("#title")!;
const blurbEl = document.querySelector("#blurb")!;
const restBtn = document.querySelector("#rest")!;
const slashBtn = document.querySelector("#slash")!;
const picks = document.querySelector("#picks")!;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x1c1d18, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
renderer.autoClear = false;

const heroScene = new THREE.Scene();
const heroCam = new THREE.PerspectiveCamera(90, 1, 0.04, 8);
heroScene.add(heroCam);
addLights(heroCam);
const card = new THREE.Mesh(
  new THREE.PlaneGeometry(2.4, 1.6),
  new THREE.MeshStandardMaterial({ color: 0x2c2e26, roughness: 1, metalness: 0 }),
);
card.position.set(0.02, -0.02, -0.85);
heroCam.add(card);

const arm = makeRightArm();
arm.root.visible = true;
heroCam.add(arm.root);

let knife = makeKnifeVariant(index);
heroCam.add(knife);

const catalogScene = new THREE.Scene();
addLights(catalogScene);
const catalogCam = new THREE.OrthographicCamera(-1.2, 1.2, 1.15, -1.15, 0.1, 8);
catalogCam.position.set(0.15, 0.04, 3.2);
catalogCam.lookAt(0.15, 0.02, 0);

const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _center = new THREE.Vector3();
const thumbs: THREE.Group[] = [];
for (let i = 0; i < KNIFE_KINDS.length; i++) {
  const g = new THREE.Group();
  const hold = new THREE.Group();
  const mesh = makeKnifeVariant(i);
  mesh.rotation.set(-0.12, 0.15, 0.08);
  hold.add(mesh);
  hold.updateWorldMatrix(true, true);
  _box.setFromObject(hold);
  _box.getSize(_size);
  _box.getCenter(_center);
  mesh.position.sub(_center);
  hold.scale.setScalar(0.28 / Math.max(_size.x, _size.y, _size.z, 0.001));
  g.add(hold);
  const col = i % 2;
  const row = Math.floor(i / 2);
  g.position.set(col * 0.78 - 0.08, 1.0 - row * 0.36, 0);
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.36),
    new THREE.MeshStandardMaterial({ color: i === index ? 0x4a4c40 : 0x32342b, roughness: 1, metalness: 0 }),
  );
  plate.position.set(0, 0, -0.12);
  plate.userData.plate = true;
  g.add(plate);
  catalogScene.add(g);
  thumbs.push(g);
}

for (let i = 0; i < KNIFE_KINDS.length; i++) {
  const kind = KNIFE_KINDS[i]!;
  const b = document.createElement("button");
  b.type = "button";
  b.dataset.i = String(i);
  const key = i === 10 ? "B" : i === 9 ? "0" : String(i + 1);
  b.innerHTML = `<span class="n">${key}</span><span class="name">${kind.name}</span>`;
  b.addEventListener("click", () => select(i));
  picks.append(b);
}

restBtn.addEventListener("click", () => setSlash(false));
slashBtn.addEventListener("click", () => setSlash(true));

window.addEventListener("keydown", (e) => {
  if (e.code === "Digit0" || e.code === "Numpad0") select(9);
  if (e.code === "KeyB") select(10);
  const n = Number(e.key);
  if (n >= 1 && n <= 9) select(n - 1);
  if (e.code === "KeyS" || e.code === "Space") {
    e.preventDefault();
    setSlash(!slashing);
  }
});

let dragging = false;
let lastX = 0;
let lastY = 0;
canvas.addEventListener("pointerdown", (e) => {
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointerup", () => {
  dragging = false;
});
canvas.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  orbitYaw += (e.clientX - lastX) * 0.008;
  orbitPitch = Math.max(-0.7, Math.min(0.7, orbitPitch + (e.clientY - lastY) * 0.006));
  lastX = e.clientX;
  lastY = e.clientY;
});

function addLights(host: THREE.Object3D) {
  host.add(new THREE.HemisphereLight(0xe4dcc8, 0x3a362c, 1.15));
  const key = new THREE.DirectionalLight(0xfff2d8, 1.35);
  key.position.set(0.55, 0.8, 0.65);
  host.add(key);
  const fill = new THREE.DirectionalLight(0x9aa8c0, 0.4);
  fill.position.set(-0.7, 0.15, 0.45);
  host.add(fill);
  host.add(new THREE.AmbientLight(0x7a7568, 0.28));
}

function clampIndex(n: number) {
  if (!Number.isFinite(n)) return 0;
  return ((Math.trunc(n) % KNIFE_KINDS.length) + KNIFE_KINDS.length) % KNIFE_KINDS.length;
}

function syncUrl() {
  const next = new URL(location.href);
  next.searchParams.set("v", String(index));
  if (slashing) next.searchParams.set("slash", "1");
  else next.searchParams.delete("slash");
  history.replaceState(null, "", next);
}

function select(i: number) {
  index = clampIndex(i);
  heroCam.remove(knife);
  disposeGroup(knife);
  knife = makeKnifeVariant(index);
  heroCam.add(knife);
  orbitYaw = 0;
  orbitPitch = 0;
  applyPose();
  syncChrome();
  syncUrl();
}

function setSlash(on: boolean) {
  slashing = on;
  applyPose();
  syncChrome();
  syncUrl();
}

function applyPose() {
  if (slashing) poseKnifeSlash(knife, 0.52);
  else poseKnifeRest(knife);
  knife.position.set(slashing ? -0.04 : 0.05, slashing ? 0.02 : -0.02, -0.32);
  if (slashing) knife.rotation.set(0.42 + orbitPitch, -0.35 + orbitYaw, 1.05);
  else knife.rotation.set(0.18 + orbitPitch, 0.12 + orbitYaw, -0.08);
  poseArm(arm, knifeWrist(knife), slashing ? 0.42 : 0);
}

function syncChrome() {
  const kind = KNIFE_KINDS[index]!;
  titleEl.textContent = `${index + 1}. ${kind.name}`;
  blurbEl.textContent = kind.blurb;
  restBtn.classList.toggle("on", !slashing);
  slashBtn.classList.toggle("on", slashing);
  picks.querySelectorAll("button").forEach((b, i) => b.classList.toggle("on", i === index));
  thumbs.forEach((g, i) => {
    g.scale.setScalar(i === index ? 1.08 : 1);
    g.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.userData.plate) {
        (obj.material as THREE.MeshStandardMaterial).color.set(i === index ? 0x5a5c4c : 0x32342b);
      }
    });
  });
}

function disposeGroup(root: THREE.Group) {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    obj.geometry.dispose();
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) m.dispose();
  });
}

function resize() {
  const w = Math.max(1, canvas.clientWidth);
  const h = Math.max(1, canvas.clientHeight);
  renderer.setSize(w, h, false);
}

function frame() {
  applyPose();
  resize();
  const w = canvas.width;
  const h = canvas.height;
  const split = Math.round(w * 0.62);
  renderer.clear();
  renderer.setScissorTest(true);

  renderer.setViewport(0, 0, split, h);
  renderer.setScissor(0, 0, split, h);
  heroCam.aspect = split / Math.max(1, h);
  heroCam.updateProjectionMatrix();
  renderer.render(heroScene, heroCam);

  renderer.setViewport(split, 0, w - split, h);
  renderer.setScissor(split, 0, w - split, h);
  const aspect = (w - split) / Math.max(1, h);
  const halfH = 1.28;
  catalogCam.left = -halfH * aspect;
  catalogCam.right = halfH * aspect;
  catalogCam.top = halfH;
  catalogCam.bottom = -halfH;
  catalogCam.updateProjectionMatrix();
  renderer.render(catalogScene, catalogCam);
  renderer.setScissorTest(false);
  requestAnimationFrame(frame);
}

syncChrome();
applyPose();
requestAnimationFrame(frame);
