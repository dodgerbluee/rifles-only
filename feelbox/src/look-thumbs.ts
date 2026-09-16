/**
 * Small WebGL snapshots for Model option tiles (shirt / hat / melee / …).
 */
import * as THREE from "three";
import { makeMelee } from "./knife-variants";
import {
  applyLookChoice,
  lookDetailCam,
  packLook,
  type Appearance,
  type LookSlot,
} from "./look";
import type { Team } from "./match";
import { buildPawn, pawnStyle, meshStyle } from "./pawn";

const SIZE = 112;
const cache = new Map<string, string>();

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let cam: THREE.PerspectiveCamera | null = null;
let root: THREE.Group | null = null;

function ensure() {
  if (renderer && scene && cam && root) return;
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: "low-power",
  });
  renderer.setSize(SIZE, SIZE);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1c14);
  scene.add(new THREE.HemisphereLight(0xe8e0d0, 0x2a2820, 1.35));
  const sun = new THREE.DirectionalLight(0xfff2e0, 1.25);
  sun.position.set(2.6, 7.5, 4.2);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xb0c0d8, 0.5);
  fill.position.set(-3, 2.4, -2);
  scene.add(fill);
  cam = new THREE.PerspectiveCamera(36, 1, 0.08, 40);
  root = new THREE.Group();
  scene.add(root);
}

function frameCam(slot: LookSlot) {
  const base = lookDetailCam(slot);
  const dist = base.dist * 0.92;
  const theta = 1.02;
  const phi = Math.PI * 0.92;
  cam!.fov = base.fov;
  cam!.near = 0.08;
  cam!.far = 40;
  cam!.position.set(
    dist * Math.sin(theta) * Math.sin(phi),
    base.aimY + dist * Math.cos(theta),
    dist * Math.sin(theta) * Math.cos(phi),
  );
  cam!.lookAt(0, base.aimY, 0);
  cam!.updateProjectionMatrix();
}

export function lookOptionThumb(team: Team, base: Appearance, slot: LookSlot, optionId: string): string {
  const look = applyLookChoice(base, slot, optionId);
  const key = `${meshStyle.current}|${team}|${slot}|${optionId}|${packLook(look)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  ensure();
  const prevStyle = pawnStyle.current;
  pawnStyle.current = "limbs";
  buildPawn(root!, team, 0, look);
  if (slot === "melee") {
    const held = makeMelee(look.melee);
    held.scale.setScalar(4.2);
    held.position.set(0.4, 1.02, 0.1);
    held.rotation.set(0.2, 0.35, -0.2);
    root!.add(held);
  }
  pawnStyle.current = prevStyle;
  frameCam(slot);
  renderer!.render(scene!, cam!);
  const url = renderer!.domElement.toDataURL("image/png");
  cache.set(key, url);
  return url;
}

export function clearLookThumbs() {
  cache.clear();
}
