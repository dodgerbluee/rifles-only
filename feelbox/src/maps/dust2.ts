import * as THREE from "three";
import spec from "./maindust2.json";
import { compileLayout, type LayoutSpec } from "./layout";
import type { World } from "../world";

/** Sandstone lanes. Ember from the west T-row roofs, Stone from the CT lane. */
export const DUST2_SPEC = spec as unknown as LayoutSpec;

export function buildDust2(scene: THREE.Scene): World {
  return compileLayout(scene, DUST2_SPEC);
}
