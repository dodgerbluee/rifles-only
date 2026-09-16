import { buildPawn as buildCivilian } from "./civilian";
import { buildPawn as buildClay } from "./clay";
import { buildPawn as buildCs2 } from "./cs2";
import type { MeshId } from "./ids";
import { buildPawn as buildLathe } from "./lathe";
import { buildPawn as buildMannequin } from "./mannequin";
import { buildPawn as buildPlate } from "./plate";
import { buildPawn as buildPs1 } from "./ps1";
import { buildPawn as buildSilhouette } from "./silhouette";
import { buildPawn as buildTapered } from "./tapered";
import { buildPawn as buildVolume } from "./volume";

export { MESH_IDS, MESH_STYLES, parseMeshId, type MeshId } from "./ids";

type Build = typeof buildLathe;

/** Every replacement except `current`, which stays in pawn.ts. */
export const MESH_BUILDERS: Record<Exclude<MeshId, "current">, Build> = {
  silhouette: buildSilhouette,
  civilian: buildCivilian,
  lathe: buildLathe,
  cs2: buildCs2,
  plate: buildPlate,
  mannequin: buildMannequin,
  volume: buildVolume,
  clay: buildClay,
  ps1: buildPs1,
  tapered: buildTapered,
};
