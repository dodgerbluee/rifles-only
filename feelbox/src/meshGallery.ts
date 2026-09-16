import * as THREE from "three";
import { DEFAULT_LOOK } from "./look";
import { MESH_STYLES, meshStyle, buildPawn, packLook } from "./pawn";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1c14);
scene.add(new THREE.HemisphereLight(0xf0e8d8, 0x3a382c, 1.15));
const key = new THREE.DirectionalLight(0xfff4e4, 1.7);
key.position.set(-1.2, 4.5, -5.5);
scene.add(key);
const fill = new THREE.DirectionalLight(0xa8bdd8, 0.7);
fill.position.set(4, 2.2, -2);
scene.add(fill);
scene.add(new THREE.AmbientLight(0x6a6860, 0.35));

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(16, 40),
  new THREE.MeshStandardMaterial({ color: 0x2c2e24, roughness: 0.92 }),
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const gap = 2.7;
const n = MESH_STYLES.length;
const look = packLook(DEFAULT_LOOK);

MESH_STYLES.forEach((style, i) => {
  const root = new THREE.Group();
  meshStyle.current = style.id;
  buildPawn(root, i === 0 ? "ember" : "stone", 0, look);
  root.position.x = (i - (n - 1) / 2) * gap;
  root.rotation.y = 0.38;
  scene.add(root);

  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.62, 0.05, 24),
    new THREE.MeshStandardMaterial({
      color: i % 2 === 0 ? 0x7a3418 : 0x245078,
      roughness: 0.5,
    }),
  );
  plate.position.set(root.position.x, 0.025, 0);
  scene.add(plate);

  const label = sprite(style.label);
  label.position.set(root.position.x, 2.12, -0.55);
  scene.add(label);
});
meshStyle.current = "cs2";

const camera = new THREE.PerspectiveCamera(34, 1, 0.08, 40);
camera.position.set(0, 1.48, -6.4);
camera.lookAt(0, 0.95, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
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
  g.fillStyle = "rgba(10,12,8,0.82)";
  g.fillRect(12, 24, 488, 80);
  g.font = "700 46px ui-sans-serif, system-ui, sans-serif";
  g.fillStyle = "#f4eedc";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 256, 64);
  const tex = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  s.scale.set(2.05, 0.51, 1);
  return s;
}
