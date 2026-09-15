import * as THREE from "three";
import { buildWorld, type World } from "../world";
import { buildCove, COVE_SPEC } from "./cove";
import { buildHarbor, HARBOR_SPEC } from "./harbor";
import { buildParish, PARISH_SPEC } from "./parish";
import { buildCut, CUT_SPEC } from "./cut";
import { buildSiding, SIDING_SPEC } from "./siding";
import { buildDust2, DUST2_SPEC } from "./dust2";
import { WHARF_SPEC } from "./wharf";
import type { MapId } from "./kit";
import type { LayoutSpec } from "./layout";

export type { MapId } from "./kit";

export const MAPS: { id: MapId; title: string; blurb: string }[] = [
  { id: "wharf", title: "Wharf", blurb: "Winter dockyard. Plant the Wire at A or B." },
  { id: "harbor", title: "Harbor", blurb: "Industrial quay. Plant the Wire at A or B." },
  { id: "cove", title: "Depot", blurb: "Watchers hold the east lot. Planters walk in from A Yard." },
  { id: "parish", title: "Parish", blurb: "Norman streets. Plant the Wire at A or B." },
  { id: "cut", title: "The Cut", blurb: "Limestone quarry at last light. Plant the Wire at A or B." },
  { id: "siding", title: "Siding", blurb: "Winter warehouse row. Plant the Wire at A or B." },
  { id: "dust2", title: "Dust2", blurb: "Sandstone lanes. Plant the Wire at A or B." },
];

/** Rotation maps that can open in studio. Hand-built matches still use their builders. */
export const LAYOUT_SPECS: LayoutSpec[] = [WHARF_SPEC, HARBOR_SPEC, COVE_SPEC, PARISH_SPEC, CUT_SPEC, SIDING_SPEC, DUST2_SPEC];

export function specForMap(id: string): LayoutSpec | undefined {
  return LAYOUT_SPECS.find((s) => s.id === id);
}

export function buildMap(scene: THREE.Scene, id: MapId): World {
  if (id === "harbor") return buildHarbor(scene);
  if (id === "cove") return buildCove(scene);
  if (id === "parish") return buildParish(scene);
  if (id === "cut") return buildCut(scene);
  if (id === "siding") return buildSiding(scene);
  if (id === "dust2") return buildDust2(scene);
  return buildWorld(scene);
}

export { buildCove, COVE_SPEC } from "./cove";
export { buildHarbor, HARBOR_SPEC } from "./harbor";
export { buildParish, PARISH_SPEC } from "./parish";
export { buildCut, CUT_SPEC } from "./cut";
export { buildSiding } from "./siding";
export { compileLayout, YARD_SPEC, asLayoutSpec, type LayoutSpec, type ClimbSpec } from "./layout";
export { SIDING_SPEC } from "./siding";
export { DUST2_SPEC, buildDust2 } from "./dust2";
export { WHARF_SPEC } from "./wharf";
export { blankSpec, type ToolId } from "./studio";
