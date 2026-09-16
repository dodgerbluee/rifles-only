export const MESH_IDS = [
  "current",
  "silhouette",
  "civilian",
  "lathe",
  "cs2",
  "plate",
  "mannequin",
  "volume",
  "clay",
  "ps1",
  "tapered",
] as const;

export type MeshId = (typeof MESH_IDS)[number];

export const MESH_STYLES: { id: MeshId; label: string; blurb: string }[] = [
  { id: "current", label: "Current", blurb: "Today's capsule limbs — the goofy baseline" },
  { id: "silhouette", label: "Neck & skull", blurb: "Same capsules, with a neck, jaw, and shoulders" },
  { id: "civilian", label: "Street clothes", blurb: "A person in a shirt and boots, holding a rifle" },
  { id: "lathe", label: "Lathe anatomy", blurb: "Turned-wood skull, ribcage, and pelvis" },
  { id: "cs2", label: "Operator", blurb: "Chunky plate carrier, deltoids, mag pouches" },
  { id: "plate", label: "Infantry kit", blurb: "Full IOTV, helmet, dump pouch, drop-leg holster" },
  { id: "mannequin", label: "Mannequin", blurb: "Artist dummy — ball joints and capsule limbs" },
  { id: "volume", label: "Volume study", blurb: "Block-out masses with real facial planes" },
  { id: "clay", label: "Clay", blurb: "Soft ellipsoid masses, like a vinyl figure" },
  { id: "ps1", label: "PS1", blurb: "Faceted low-poly soldier, still a person" },
  { id: "tapered", label: "Chess piece", blurb: "Tapered cylinders — turned chess-piece person" },
];

export function parseMeshId(raw: unknown): MeshId | undefined {
  return MESH_IDS.includes(raw as MeshId) ? (raw as MeshId) : undefined;
}
