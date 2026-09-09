import * as THREE from "three";
import { compileLayout, type LayoutSpec } from "./layout";
import type { World } from "../world";

/** Winter warehouse row. Ember from the west road, Stone from the east lot. */
export const SIDING_SPEC: LayoutSpec = {
  id: "siding",
  title: "Siding",
  blurb: "Winter warehouse row. Plant the Wire at A or B.",
  theme: "winter",
  bounds: { minX: -36, maxX: 36, minZ: -22, maxZ: 24 },
  buildings: [
    { x: 8, z: 10, w: 12, d: 10, floors: 2, doors: [{ wall: "s" }, { wall: "w" }], stairs: "s", mat: "brick" },
    { x: -26, z: 16, w: 12, d: 10, floors: 1, doors: [{ wall: "s" }, { wall: "e" }] },
    { x: -12, z: 16, w: 12, d: 10, floors: 1, doors: [{ wall: "s" }, { wall: "w" }] },
    { x: -14, z: -16, w: 12, d: 10, floors: 1, doors: [{ wall: "n" }] },
    { x: -2, z: -16, w: 12, d: 10, floors: 1, doors: [{ wall: "n" }] },
    { x: 18, z: -12, w: 12, d: 10, floors: 1, doors: [{ wall: "w" }, { wall: "s" }] },
    { x: 18, z: -2, w: 12, d: 10, floors: 1, doors: [{ wall: "w" }, { wall: "n" }] },
    { x: -6, z: -4, w: 12, d: 10, floors: 1, doors: [{ wall: "n" }, { wall: "s" }, { wall: "w" }] },
    { x: -28, z: -18, w: 12, d: 10, floors: 1, doors: [{ wall: "n" }, { wall: "e" }] },
  ],
  cover: [
    { x: -16, z: 6, kind: "crate" },
    { x: -8, z: 8, kind: "low" },
    { x: 2, z: 4, kind: "crate" },
    { x: 4, z: -8, kind: "truck" },
    { x: 22, z: 8, kind: "high" },
  ],
  climbs: [
    { x: 8, z: 2, dir: "-z", height: 2.8, width: 2.2 },
    { x: 1, z: 10, dir: "-x", height: 2.8, width: 2.2 },
  ],
  sites: [
    { id: "loft", call: "A", name: "Gable", x: -12, z: 16 },
    { id: "well", call: "B", name: "Lean", x: -30, z: -18 },
  ],
  plantSpawns: [
    [-30, 0],
    [-30, 4],
    [-32, 2],
    [-30, -6],
    [-26, 2],
  ],
  watchSpawns: [
    [32, 6],
    [30, 8],
    [32, 10],
    [28, 6],
    [34, 4],
  ],
  routes: [
    [
      [-30, 2],
      [-20, 6],
      [-12, 9],
    ],
    [
      [-30, 2],
      [-30, -8],
      [-30, -12],
    ],
    [
      [32, 6],
      [20, 4],
      [8, 3],
      [0, 3],
      [-12, 9],
    ],
    [
      [32, 6],
      [20, 4],
      [10, 3],
      [-16, 3],
      [-22, -8],
      [-30, -12],
    ],
    [
      [-12, 9],
      [-8, 6],
      [-18, 2],
      [-22, -8],
      [-30, -12],
    ],
  ],
  lamps: [
    [12, 6],
    [-2, -8],
    [-4, 16],
    [18, 14],
    [-34, -12],
    [-22, 8],
  ],
  trees: [
    [0, 4],
    [6, -10],
    [-22, 8],
    [-22, -8],
  ],
};

export function buildSiding(scene: THREE.Scene): World {
  return compileLayout(scene, SIDING_SPEC);
}
