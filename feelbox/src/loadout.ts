import { RIFLES, isRifleId, type RifleId } from "./weapons";

export type SecondaryId = RifleId | "knife";

export type Loadout = {
  primary: RifleId;
  secondary: SecondaryId;
};

export const PRIMARY_IDS: RifleId[] = ["kar", "karscope", "mosin"];

export const GUN_BLURB: Record<SecondaryId, string> = {
  kar: "Iron sights · the CoD1 rifle",
  karscope: "Glass zoom · hold the line",
  mosin: "Peep sight · planted shot",
  knife: "Close work when the bolt is open",
};

export const GUN_SHORT: Record<SecondaryId, string> = {
  kar: "KAR",
  karscope: "KAR 4X",
  mosin: "MOSIN",
  knife: "KNIFE",
};

export const DEFAULT_LOADOUT: Loadout = { primary: "kar", secondary: "knife" };

export function parseRifleId(raw: unknown): RifleId | undefined {
  return typeof raw === "string" && isRifleId(raw) ? raw : undefined;
}

export function parseSecondaryId(raw: unknown): SecondaryId | undefined {
  if (raw === "knife") return "knife";
  return parseRifleId(raw);
}

export function parseLoadout(raw: unknown): Loadout {
  const src = raw && typeof raw === "object" ? (raw as Partial<Loadout>) : {};
  const primary = parseRifleId(src.primary) ?? DEFAULT_LOADOUT.primary;
  let secondary = parseSecondaryId(src.secondary) ?? DEFAULT_LOADOUT.secondary;
  if (secondary === primary) secondary = "knife";
  return { primary, secondary };
}

export function secondaryChoices(primary: RifleId): SecondaryId[] {
  return [...PRIMARY_IDS.filter((id) => id !== primary), "knife"];
}

export function gunName(id: SecondaryId) {
  return id === "knife" ? "Knife" : RIFLES[id].name;
}

export function bindKeys(loadout: Loadout) {
  return {
    digit1: loadout.primary,
    digit2: loadout.secondary,
    digit3: "knife" as const,
  };
}

export function hudWeaponLine(
  loadout: Loadout,
  nade: string,
  bag: { smoke: number; frag: number; stun: number; flash: number },
) {
  const knife = loadout.secondary === "knife" ? "" : " · 3 KNIFE";
  return `1 ${GUN_SHORT[loadout.primary]} · 2 ${GUN_SHORT[loadout.secondary]}${knife} · 4 ${nade.toUpperCase()}  S${bag.smoke} F${bag.frag} T${bag.stun} H${bag.flash}`;
}
