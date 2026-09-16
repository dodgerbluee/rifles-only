import { buildPawn as buildCivilian } from "./civilian";
import { buildPawn as buildCs2 } from "./cs2";
import type { MeshId } from "./ids";
import { buildPawn as buildLathe } from "./lathe";
import { buildPawn as buildSilhouette } from "./silhouette";

export { MESH_IDS, MESH_STYLES, parseMeshId, type MeshId } from "./ids";

type Build = typeof buildLathe;

/** Every replacement except `current`, which stays in pawn.ts. */
export const MESH_BUILDERS: Record<Exclude<MeshId, "current">, Build> = {
  silhouette: buildSilhouette,
  civilian: buildCivilian,
  lathe: buildLathe,
  cs2: buildCs2,
};
