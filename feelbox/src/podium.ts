import * as THREE from "three";
import type { Team } from "./match";
import { podiumWho } from "./match";
import { buildPawn, poseStance, parseLook, type Appearance } from "./pawn";
import type { World } from "./world";

export type PodiumPlace = {
  id: number;
  name: string;
  team: Team;
  kills: number;
  assists: number;
  deaths: number;
  occupant?: string | null;
  you?: boolean;
  skin?: string;
  look?: string | Appearance;
};

/** Pawns face -Z. The match-end camera sits on -Z looking +Z, so yaw 0 shows faces. */
export const PODIUM_FACE_YAW = 0;

let group: THREE.Group | null = null;

export function mountPodium(scene: THREE.Scene, world: World, places: PodiumPlace[]) {
  clearPodium(scene);
  const { minX, maxX, minZ, maxZ } = world.bounds;
  const cx = (minX + maxX) * 0.5;
  const cz = (minZ + maxZ) * 0.5;
  group = new THREE.Group();
  group.name = "mvp-podium";
  const slots = [
    { place: places[1], x: -3.6, h: 2.6, color: 0xc8d0d8 },
    { place: places[0], x: 0, h: 4.2, color: 0xe8d090 },
    { place: places[2], x: 3.6, h: 1.8, color: 0xc4844a },
  ];
  for (const s of slots) {
    if (!s.place) continue;
    const stand = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, s.h, 2.2),
      new THREE.MeshStandardMaterial({ color: s.color, roughness: 0.42, metalness: 0.38 }),
    );
    stand.position.set(s.x, s.h * 0.5, 0);
    stand.castShadow = true;
    group.add(stand);
    const fig = new THREE.Group();
    buildPawn(fig, s.place.team, s.place.id, parseLook(s.place.look) ?? s.place.skin);
    poseStance(fig, "stand");
    fig.position.set(s.x, s.h, 0);
    fig.rotation.y = PODIUM_FACE_YAW;
    fig.scale.setScalar(1.35);
    group.add(fig);
    const plate = nameplate(s.place);
    if (plate) {
      plate.position.set(s.x, s.h + 2.55, -0.4);
      group.add(plate);
    }
  }
  group.position.set(cx, 0, cz);
  group.scale.setScalar(3.4);
  scene.add(group);
}

export function podiumLookAt(world: World) {
  const { minX, maxX, minZ, maxZ } = world.bounds;
  return {
    x: (minX + maxX) * 0.5,
    y: 8.5,
    z: (minZ + maxZ) * 0.5,
  };
}

/** Close front view of the gold/silver/bronze figures, above the bottom HUD. */
export function podiumCam(world: World, t: number) {
  const at = podiumLookAt(world);
  const swing = Math.sin(t * 0.16) * 4.8;
  return {
    x: at.x + swing,
    y: 16.5,
    z: at.z - 30,
    lookX: at.x,
    lookY: 17.5,
    lookZ: at.z,
  };
}

export function clearPodium(scene: THREE.Scene) {
  if (!group) return;
  scene.remove(group);
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Sprite) {
      obj.geometry.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (!m) continue;
        const map = "map" in m ? m.map : null;
        if (map && map instanceof THREE.Texture) map.dispose();
        m.dispose();
      }
    }
  });
  group = null;
}

function nameplate(place: PodiumPlace) {
  if (typeof document === "undefined") return null;
  const who = podiumWho(place.name, place.occupant);
  const c = document.createElement("canvas");
  c.width = 768;
  c.height = 192;
  const g = c.getContext("2d");
  if (!g) return null;
  g.fillStyle = "rgba(10, 11, 9, 0.86)";
  roundRect(g, 8, 16, 752, 160, 18);
  g.fill();
  g.fillStyle = place.team === "ember" ? "#c45a30" : "#6a90b4";
  g.fillRect(8, 16, 18, 160);
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = "700 64px sans-serif";
  g.fillStyle = "#efe8d8";
  g.fillText(who, 384, place.you ? 78 : 96, 680);
  if (place.you) {
    g.font = "800 32px sans-serif";
    g.fillStyle = "#e8d9a8";
    g.fillText("YOU", 384, 136);
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false }));
  sprite.scale.set(2.4, 0.6, 1);
  return sprite;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}
