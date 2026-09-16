import { RIFLES, isRifleId, type RifleId } from "./weapons";

export type SecondaryId = RifleId | "knife";

export type Loadout = {
  primary: RifleId;
  secondary: SecondaryId;
};

export const PRIMARY_IDS: RifleId[] = ["kar", "kar2", "karscope", "mosin"];

/** Join picker: rifles plus knife in one grid. First two clicks deploy. */
export const LOADOUT_IDS: SecondaryId[] = [...PRIMARY_IDS, "knife"];

/** Bots shoot the iron Kar. Killcam/recap must not fake a scope or Mosin. */
export function botRifle(_id?: number): RifleId {
  return "kar";
}

export const GUN_BLURB: Record<SecondaryId, string> = {
  kar: "Iron sights · the CoD1 rifle",
  kar2: "Two-piece U · same hold as Kar",
  karscope: "Glass zoom · hold the line",
  mosin: "Peep sight · planted shot",
  knife: "Close work when the bolt is open",
};

export const GUN_SHORT: Record<SecondaryId, string> = {
  kar: "KAR",
  kar2: "KAR 2",
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

/**
 * Pack two join picks into the in-match loadout.
 * Knife always sits in the 2 slot. Two rifles keep click order (first = 1).
 */
export function loadoutFromPicks(picks: readonly SecondaryId[]): Loadout | undefined {
  if (picks.length !== 2) return undefined;
  const [a, b] = picks;
  if (a === b) return undefined;
  if (isRifleId(a) && !isRifleId(b)) return { primary: a, secondary: b };
  if (!isRifleId(a) && isRifleId(b)) return { primary: b, secondary: a };
  if (isRifleId(a) && isRifleId(b)) return { primary: a, secondary: b };
  return undefined;
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
