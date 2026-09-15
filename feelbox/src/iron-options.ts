import * as THREE from "three";
import { RIFLES, makeKar98 } from "./weapons";

const IRON_FOV = RIFLES.kar.adsFov;

function worldBackdrop() {
  const g = new THREE.Group();
  g.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(10, 18, 12),
      new THREE.MeshBasicMaterial({ color: 0xc5c8c0, side: THREE.BackSide }),
    ),
  );
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshLambertMaterial({ color: 0x8e8a80 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.7;
  g.add(ground);
  const plaster = new THREE.MeshLambertMaterial({ color: 0x8a8478 });
  const brick = new THREE.MeshLambertMaterial({ color: 0x7a5a48 });
  const hut = (x: number, z: number, w: number, h: number, d: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, h * 0.5 - 0.7, z);
    g.add(m);
  };
  hut(-1.5, -5.2, 1.6, 1.2, 1.4, plaster);
  hut(1.8, -6.1, 2.0, 1.8, 1.5, brick);
  hut(0.2, -8.0, 2.8, 0.8, 2.0, plaster);
  return g;
}

function renderView(dest: HTMLCanvasElement, kind: "ads" | "side", width: number, height: number) {
  const renderer = new THREE.WebGLRenderer({
    canvas: dest,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.setClearColor(0x000000, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xd8d4c8, 0x2a2c26, 0.95));
  const key = new THREE.DirectionalLight(0xf0ece0, 0.9);
  key.position.set(-0.55, 0.7, 0.35);
  scene.add(key);
  scene.add(new THREE.AmbientLight(0x5a5850, 0.4));

  const view = makeKar98();
  view.flash.visible = false;
  const root = view.root;
  const camera = new THREE.PerspectiveCamera(IRON_FOV, width / height, 0.02, 24);

  if (kind === "ads") {
    scene.add(worldBackdrop());
    root.position.copy(view.adsPos);
    root.rotation.set(0, 0, 0);
    scene.add(root);
    camera.position.set(0, 0, 0);
    camera.rotation.set(0, 0, 0);
    camera.rotation.order = "YXZ";
    camera.fov = IRON_FOV;
    camera.near = 0.02;
    camera.far = 24;
  } else {
    renderer.setClearColor(0x1a1c18, 1);
    root.position.set(0, 0, 0);
    root.rotation.set(0, 0, 0);
    scene.add(root);
    camera.fov = 22;
    camera.near = 0.02;
    camera.far = 8;
    const rim = new THREE.DirectionalLight(0xf2eee4, 0.85);
    rim.position.set(0.4, 0.35, -0.55);
    scene.add(rim);
    camera.position.set(0.16, 0.05, -0.086);
    camera.lookAt(0, 0.046, -0.094);
  }
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
}

function card(kind: "ads" | "side", title: string, blurb: string) {
  const el = document.createElement("article");
  el.className = "card";
  el.innerHTML = `<h2>${title}</h2><p>${blurb}</p>`;
  const canvas = document.createElement("canvas");
  el.appendChild(canvas);
  renderView(canvas, kind, 960, 540);
  return el;
}

const params = new URLSearchParams(location.search);
const only = params.get("only");

if (only === "ads" || only === "side" || only === "current") {
  const kind = only === "side" ? "side" : "ads";
  document.body.classList.add("solo");
  const wrap = document.querySelector("#solo") as HTMLElement;
  wrap.hidden = false;
  const label = document.createElement("div");
  label.className = "solo-label";
  label.textContent = kind === "ads" ? "Iron ADS" : "Rear sight on the receiver";
  wrap.appendChild(label);
  const canvas = document.createElement("canvas");
  wrap.appendChild(canvas);
  renderView(canvas, kind, 1280, 720);
} else {
  const grid = document.querySelector("#grid")!;
  grid.appendChild(
    card("ads", "ADS", "Same zoom and eye pose. Taller boxy U starts in the rounded cutout and finishes past it."),
  );
  grid.appendChild(
    card("side", "On the rifle", "Boxy hood starts inside the rounded U and ends clearly outside it, toward the muzzle."),
  );
}
