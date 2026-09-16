export const MESH_IDS = ["current", "cs2"] as const;

export type MeshId = (typeof MESH_IDS)[number];

export const MESH_STYLES: { id: MeshId; label: string; blurb: string }[] = [
  { id: "cs2", label: "Operator", blurb: "Plate carrier, deltoids, mag pouches" },
  { id: "current", label: "Current", blurb: "Old capsule limbs — keep this to pivot back" },
];

export function parseMeshId(raw: unknown): MeshId | undefined {
  return MESH_IDS.includes(raw as MeshId) ? (raw as MeshId) : undefined;
}
