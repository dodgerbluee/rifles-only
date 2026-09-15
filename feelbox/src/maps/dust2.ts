import * as THREE from "three";
import spec from "./maindust2.json";
import { compileLayout, type LayoutSpec } from "./layout";
import type { World } from "../world";

/** Sandstone lanes. Ember from the west yard, Stone from mid. */
export const DUST2_SPEC = spec as LayoutSpec;

export function buildDust2(scene: THREE.Scene): World {
  return compileLayout(scene, DUST2_SPEC);
}
