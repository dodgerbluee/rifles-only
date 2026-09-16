export const MESH_IDS = ["current", "silhouette", "civilian", "lathe", "cs2"] as const;

export type MeshId = (typeof MESH_IDS)[number];

export const MESH_STYLES: { id: MeshId; label: string; blurb: string }[] = [
  { id: "current", label: "Current", blurb: "Today's capsule limbs — keep this to pivot back" },
  { id: "silhouette", label: "Neck & skull", blurb: "Same capsules, with a neck, jaw, and shoulders" },
  { id: "civilian", label: "Street clothes", blurb: "A person in a shirt and boots, holding a rifle" },
  { id: "lathe", label: "Lathe anatomy", blurb: "Turned-wood skull, ribcage, and pelvis" },
  { id: "cs2", label: "Operator", blurb: "Chunky plate carrier, deltoids, mag pouches" },
];

export function parseMeshId(raw: unknown): MeshId | undefined {
  return MESH_IDS.includes(raw as MeshId) ? (raw as MeshId) : undefined;
}
