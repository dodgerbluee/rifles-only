import * as THREE from "three";
import { buildWorld, type World } from "../world";
import { buildCove } from "./cove";
import { buildParish } from "./parish";
import { buildCut } from "./cut";
import type { MapId } from "./kit";

export type { MapId } from "./kit";

export const MAPS: { id: MapId; title: string; blurb: string }[] = [
  { id: "wharf", title: "Wharf", blurb: "Winter dockyard. Plant the Wire at A or B." },
  { id: "cove", title: "Harbor", blurb: "Industrial quay. Plant the Wire at A or B." },
  { id: "parish", title: "Parish", blurb: "Norman streets. Plant the Wire at A or B." },
  { id: "cut", title: "The Cut", blurb: "Limestone quarry at last light. Plant the Wire at A or B." },
];

export function buildMap(scene: THREE.Scene, id: MapId): World {
  if (id === "cove") return buildCove(scene);
  if (id === "parish") return buildParish(scene);
  if (id === "cut") return buildCut(scene);
  return buildWorld(scene);
}

export { buildCove } from "./cove";
export { buildParish } from "./parish";
export { buildCut } from "./cut";
export { compileLayout, YARD_SPEC, type LayoutSpec, type ClimbSpec } from "./layout";
export { blankSpec, type ToolId } from "./studio";
