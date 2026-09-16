import * as THREE from "three";
import { DEFAULT_LOOK } from "./look";
import { MESH_STYLES, meshStyle, buildPawn } from "./pawn";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x14160f);
scene.add(new THREE.HemisphereLight(0xe8e0d0, 0x2a2820, 1.25));
const sun = new THREE.DirectionalLight(0xfff2e0, 1.45);
sun.position.set(6, 12, 8);
scene.add(sun);
scene.add(new THREE.DirectionalLight(0x88a0c0, 0.55)).position.set(-8, 4, -6);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(22, 48),
  new THREE.MeshStandardMaterial({ color: 0x24261c, roughness: 0.94 }),
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const cols = 6;
const gapX = 2.2;
const gapZ = 2.7;

MESH_STYLES.forEach((style, i) => {
  const col = i % cols;
  const row = Math.floor(i / cols);
  const root = new THREE.Group();
  meshStyle.current = style.id;
  buildPawn(root, i % 2 === 0 ? "ember" : "stone", i, DEFAULT_LOOK);
  root.position.set((col - (cols - 1) / 2) * gapX, 0, (row - 0.35) * gapZ);
  root.rotation.y = Math.PI + 0.35;
  scene.add(root);

  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.6, 0.05, 20),
    new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? 0x6a2c14 : 0x1c4468, roughness: 0.52 }),
  );
  plate.position.set(root.position.x, 0.025, root.position.z);
  scene.add(plate);

  const label = sprite(style.label);
  label.position.set(root.position.x, 2.08, root.position.z + 0.25);
  scene.add(label);
});
meshStyle.current = "silhouette";

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
camera.position.set(1.1, 1.68, 9.4);
camera.lookAt(0, 0.98, 0.35);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = false;
document.body.append(renderer.domElement);

function resize() {
  camera.aspect = innerWidth / Math.max(1, innerHeight);
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
addEventListener("resize", resize);
resize();
function tick() {
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

function sprite(text: string) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "rgba(12,14,10,0.78)";
  g.fillRect(16, 28, 480, 76);
  g.font = "600 44px ui-sans-serif, system-ui, sans-serif";
  g.fillStyle = "#f0ead8";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  s.scale.set(1.85, 0.46, 1);
  return s;
}
