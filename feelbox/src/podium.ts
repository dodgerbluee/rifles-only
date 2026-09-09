import * as THREE from "three";
import type { Team } from "./match";
import { buildPawn, poseStance, type PawnSkin } from "./pawn";
import type { World } from "./world";

export type PodiumPlace = {
  id: number;
  name: string;
  team: Team;
  kills: number;
  assists: number;
  deaths: number;
  skin?: PawnSkin;
};

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
    buildPawn(fig, s.place.team, s.place.id, s.place.skin);
    poseStance(fig, "stand");
    fig.position.set(s.x, s.h, 0);
    fig.rotation.y = Math.PI;
    fig.scale.setScalar(1.35);
    group.add(fig);
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

export function clearPodium(scene: THREE.Scene) {
  if (!group) return;
  scene.remove(group);
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) obj.geometry.dispose();
  });
  group = null;
}
