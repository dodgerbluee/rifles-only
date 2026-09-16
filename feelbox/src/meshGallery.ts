import * as THREE from "three";
import { DEFAULT_LOOK } from "./look";
import { MESH_STYLES, meshStyle, buildPawn, type MeshId } from "./pawn";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x14160f);
scene.fog = new THREE.Fog(0x14160f, 18, 42);
scene.add(new THREE.HemisphereLight(0xe8e0d0, 0x2a2820, 1.2));
const sun = new THREE.DirectionalLight(0xfff2e0, 1.35);
sun.position.set(4, 10, 6);
sun.castShadow = true;
scene.add(sun);
scene.add(new THREE.DirectionalLight(0x88a0c0, 0.4)).position.set(-6, 3, -4);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 28),
  new THREE.MeshStandardMaterial({ color: 0x2a2c22, roughness: 0.92 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const cols = 6;
const gapX = 2.35;
const gapZ = 3.1;
const figures: { id: MeshId; root: THREE.Group }[] = [];

MESH_STYLES.forEach((style, i) => {
  const col = i % cols;
  const row = Math.floor(i / cols);
  const root = new THREE.Group();
  meshStyle.current = style.id;
  buildPawn(root, i % 2 === 0 ? "ember" : "stone", i, DEFAULT_LOOK);
  root.position.set((col - (cols - 1) / 2) * gapX, 0, row * gapZ);
  root.rotation.y = Math.PI;
  scene.add(root);
  figures.push({ id: style.id, root });

  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.62, 0.06, 20),
    new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? 0x5a2410 : 0x1a3a58, roughness: 0.55 }),
  );
  plate.position.set(root.position.x, 0.03, root.position.z);
  scene.add(plate);

  const label = sprite(style.label);
  label.position.set(root.position.x, 2.05, root.position.z + 0.2);
  scene.add(label);
});

meshStyle.current = "silhouette";

const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 80);
const pivot = new THREE.Vector3(0, 0.95, 1.4);
let dist = 13.5;
let theta = 0.92;
let phi = 0.18;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
document.body.append(renderer.domElement);

function placeCam() {
  camera.position.set(
    pivot.x + dist * Math.sin(theta) * Math.sin(phi),
    pivot.y + dist * Math.cos(theta),
    pivot.z + dist * Math.sin(theta) * Math.cos(phi),
  );
  camera.lookAt(pivot);
}

function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  placeCam();
}
addEventListener("resize", resize);
resize();

let drag = false;
let lx = 0;
let ly = 0;
addEventListener("pointerdown", (e) => {
  drag = true;
  lx = e.clientX;
  ly = e.clientY;
});
addEventListener("pointerup", () => {
  drag = false;
});
addEventListener("pointermove", (e) => {
  if (!drag) return;
  phi -= (e.clientX - lx) * 0.005;
  theta = Math.max(0.25, Math.min(1.25, theta - (e.clientY - ly) * 0.005));
  lx = e.clientX;
  ly = e.clientY;
  placeCam();
});
addEventListener("wheel", (e) => {
  dist = Math.max(8, Math.min(22, dist + e.deltaY * 0.01));
  placeCam();
}, { passive: true });

function tick() {
  const t = performance.now() * 0.001;
  for (const fig of figures) fig.root.rotation.y = Math.PI + Math.sin(t * 0.35) * 0.22;
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

function sprite(text: string) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "rgba(12,14,10,0.72)";
  g.fillRect(0, 20, 512, 88);
  g.font = "600 48px ui-sans-serif, system-ui, sans-serif";
  g.fillStyle = "#f0ead8";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 256, 64);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const s = new THREE.Sprite(mat);
  s.scale.set(1.7, 0.42, 1);
  return s;
}
