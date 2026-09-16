import { buildPawn as buildCs2 } from "./cs2";
import type { MeshId } from "./ids";

export { MESH_IDS, MESH_STYLES, parseMeshId, type MeshId } from "./ids";

type Build = typeof buildCs2;

/** Operator mesh. `current` stays in pawn.ts as limbsPawn. */
export const MESH_BUILDERS: Record<Exclude<MeshId, "current">, Build> = {
  cs2: buildCs2,
};
