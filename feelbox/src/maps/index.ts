import * as THREE from "three";
import { buildWorld, type World } from "../world";
import { buildCove } from "./cove";
import { buildParish } from "./parish";
import { buildCut } from "./cut";
import { buildSiding, SIDING_SPEC } from "./siding";
import type { MapId } from "./kit";
import type { LayoutSpec } from "./layout";

export type { MapId } from "./kit";

export const MAPS: { id: MapId; title: string; blurb: string }[] = [
  { id: "wharf", title: "Wharf", blurb: "Winter dockyard. Plant the Wire at A or B." },
  { id: "cove", title: "Harbor", blurb: "Industrial quay. Plant the Wire at A or B." },
  { id: "parish", title: "Parish", blurb: "Norman streets. Plant the Wire at A or B." },
  { id: "cut", title: "The Cut", blurb: "Limestone quarry at last light. Plant the Wire at A or B." },
  { id: "siding", title: "Siding", blurb: "Winter warehouse row. Plant the Wire at A or B." },
];

/** Rotation maps that already have a LayoutSpec and can open in studio. */
export const LAYOUT_SPECS: LayoutSpec[] = [SIDING_SPEC];

export function specForMap(id: string): LayoutSpec | undefined {
  return LAYOUT_SPECS.find((s) => s.id === id);
}

export function buildMap(scene: THREE.Scene, id: MapId): World {
  if (id === "cove") return buildCove(scene);
  if (id === "parish") return buildParish(scene);
  if (id === "cut") return buildCut(scene);
  if (id === "siding") return buildSiding(scene);
  return buildWorld(scene);
}

export { buildCove } from "./cove";
export { buildParish } from "./parish";
export { buildCut } from "./cut";
export { buildSiding } from "./siding";
export { compileLayout, YARD_SPEC, asLayoutSpec, type LayoutSpec, type ClimbSpec } from "./layout";
export { SIDING_SPEC } from "./siding";
export { blankSpec, type ToolId } from "./studio";
