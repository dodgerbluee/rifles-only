export type FaceId = "pale" | "tan" | "olive" | "umber" | "square";
export type BeardId = "none" | "stubble" | "goatee" | "full" | "braid";
export type HairId = "buzz" | "crew" | "mop" | "fade" | "bun";
export type HatId = "none" | "watch" | "ushanka" | "boonie" | "helmet";
export type ShirtId = "tee" | "henley" | "vest" | "parka" | "plate";
export type PantsId = "cargo" | "slim" | "shorts" | "wrap" | "armor";
export type ShoesId = "boot" | "sneaker" | "wrap" | "steel" | "bare";

export type Appearance = {
  face: FaceId;
  beard: BeardId;
  hair: HairId;
  hat: HatId;
  shirt: ShirtId;
  pants: PantsId;
  shoes: ShoesId;
};

export type LookSlot = keyof Appearance;

export type LookOption<Id extends string> = { id: Id; label: string; blurb: string };

export const FACES: LookOption<FaceId>[] = [
  { id: "pale", label: "Pale", blurb: "Fair skin" },
  { id: "tan", label: "Tan", blurb: "Warm skin" },
  { id: "olive", label: "Olive", blurb: "Olive skin" },
  { id: "umber", label: "Umber", blurb: "Deep skin" },
  { id: "square", label: "Square", blurb: "Box jaw" },
];

export const BEARDS: LookOption<BeardId>[] = [
  { id: "none", label: "None", blurb: "Clean-shaven" },
  { id: "stubble", label: "Stubble", blurb: "Short scruff" },
  { id: "goatee", label: "Goatee", blurb: "Chin patch" },
  { id: "full", label: "Full", blurb: "Thick beard" },
  { id: "braid", label: "Braid", blurb: "Chin braid" },
];

export const HAIRS: LookOption<HairId>[] = [
  { id: "buzz", label: "Buzz", blurb: "Short crop" },
  { id: "crew", label: "Crew", blurb: "High fade" },
  { id: "mop", label: "Mop", blurb: "Shaggy top" },
  { id: "fade", label: "Fade", blurb: "Side fade" },
  { id: "bun", label: "Bun", blurb: "Top knot" },
];

export const HATS: LookOption<HatId>[] = [
  { id: "none", label: "None", blurb: "Bare head" },
  { id: "watch", label: "Watch cap", blurb: "Knit beanie" },
  { id: "ushanka", label: "Ushanka", blurb: "Fur flaps" },
  { id: "boonie", label: "Boonie", blurb: "Brim hat" },
  { id: "helmet", label: "Helmet", blurb: "Bowl helm" },
];

export const SHIRTS: LookOption<ShirtId>[] = [
  { id: "tee", label: "Tee", blurb: "Short sleeve" },
  { id: "henley", label: "Henley", blurb: "Collar knit" },
  { id: "vest", label: "Vest", blurb: "Open vest" },
  { id: "parka", label: "Parka", blurb: "Heavy coat" },
  { id: "plate", label: "Plate", blurb: "Chest plate" },
];

export const PANTS: LookOption<PantsId>[] = [
  { id: "cargo", label: "Cargo", blurb: "Baggy legs" },
  { id: "slim", label: "Slim", blurb: "Tight cut" },
  { id: "shorts", label: "Shorts", blurb: "Knee cut" },
  { id: "wrap", label: "Wrap", blurb: "Puttees" },
  { id: "armor", label: "Armor", blurb: "Shin plates" },
];

export const SHOES: LookOption<ShoesId>[] = [
  { id: "boot", label: "Boot", blurb: "Work boot" },
  { id: "sneaker", label: "Sneaker", blurb: "Soft sole" },
  { id: "wrap", label: "Wrap", blurb: "Foot wrap" },
  { id: "steel", label: "Steel", blurb: "Toe cap" },
  { id: "bare", label: "Bare", blurb: "No shoe" },
];

export const LOOK_SLOTS: { key: LookSlot; label: string; options: LookOption<string>[] }[] = [
  { key: "face", label: "Face", options: FACES },
  { key: "beard", label: "Beard", options: BEARDS },
  { key: "hair", label: "Hair", options: HAIRS },
  { key: "hat", label: "Hat", options: HATS },
  { key: "shirt", label: "Shirt", options: SHIRTS },
  { key: "pants", label: "Pants", options: PANTS },
  { key: "shoes", label: "Shoes", options: SHOES },
];

const CATS: { [K in LookSlot]: LookOption<Appearance[K]>[] } = {
  face: FACES,
  beard: BEARDS,
  hair: HAIRS,
  hat: HATS,
  shirt: SHIRTS,
  pants: PANTS,
  shoes: SHOES,
};

const ORDER: LookSlot[] = ["face", "beard", "hair", "hat", "shirt", "pants", "shoes"];

export const DEFAULT_LOOK: Appearance = {
  face: "tan",
  beard: "none",
  hair: "crew",
  hat: "none",
  shirt: "tee",
  pants: "cargo",
  shoes: "boot",
};

type LegacySkin = "rifle" | "field" | "unit" | "frame";

const SKIN_LOOK: Record<LegacySkin, Appearance> = {
  rifle: { ...DEFAULT_LOOK, hat: "helmet", hair: "buzz" },
  field: { face: "olive", beard: "stubble", hair: "mop", hat: "boonie", shirt: "henley", pants: "cargo", shoes: "boot" },
  unit: { face: "square", beard: "none", hair: "buzz", hat: "helmet", shirt: "plate", pants: "armor", shoes: "steel" },
  frame: { face: "square", beard: "none", hair: "buzz", hat: "none", shirt: "plate", pants: "armor", shoes: "steel" },
};

function inCat<K extends LookSlot>(slot: K, id: string | undefined): Appearance[K] | undefined {
  return CATS[slot].some((o) => o.id === id) ? (id as Appearance[K]) : undefined;
}

export function mapSkinToLook(skin?: LegacySkin): Appearance | undefined {
  if (!skin) return undefined;
  return { ...SKIN_LOOK[skin] };
}

export function skinFromLook(look: Appearance): LegacySkin {
  if (look.shirt === "plate" && look.pants === "armor") return look.hat === "none" ? "frame" : "unit";
  if (look.hat === "boonie" || look.shirt === "henley") return "field";
  return "rifle";
}

export function lookFor(id?: number): Appearance {
  const n = Math.abs(id ?? 0);
  return {
    face: FACES[n % 5]!.id,
    beard: BEARDS[n % 5]!.id,
    hair: HAIRS[(n * 2) % 5]!.id,
    hat: HATS[(n * 3) % 5]!.id,
    shirt: SHIRTS[(n + 2) % 5]!.id,
    pants: PANTS[(n + 3) % 5]!.id,
    shoes: SHOES[(n + 4) % 5]!.id,
  };
}

export function packLook(look: Appearance): string {
  return ORDER.map((k) => String(Math.max(0, CATS[k].findIndex((o) => o.id === look[k])))).join("");
}

export function unpackLook(raw: unknown): Appearance | undefined {
  if (typeof raw !== "string" || !/^[0-4]{7}$/.test(raw)) return undefined;
  const next = { ...DEFAULT_LOOK };
  ORDER.forEach((k, i) => {
    const opt = CATS[k][Number(raw[i])];
    if (opt) (next as Appearance)[k] = opt.id as never;
  });
  return next;
}

export function parseLook(raw: unknown): Appearance | undefined {
  const packed = unpackLook(raw);
  if (packed) return packed;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Partial<Record<LookSlot, string>>;
    return {
      face: inCat("face", o.face) ?? DEFAULT_LOOK.face,
      beard: inCat("beard", o.beard) ?? DEFAULT_LOOK.beard,
      hair: inCat("hair", o.hair) ?? DEFAULT_LOOK.hair,
      hat: inCat("hat", o.hat) ?? DEFAULT_LOOK.hat,
      shirt: inCat("shirt", o.shirt) ?? DEFAULT_LOOK.shirt,
      pants: inCat("pants", o.pants) ?? DEFAULT_LOOK.pants,
      shoes: inCat("shoes", o.shoes) ?? DEFAULT_LOOK.shoes,
    };
  }
  return mapSkinToLook(raw === "rifle" || raw === "field" || raw === "unit" || raw === "frame" ? raw : undefined);
}

export function resolveLook(kit?: LegacySkin | Appearance | string, botId?: number): Appearance {
  return parseLook(kit) ?? lookFor(botId);
}

export function looksEqual(a?: Appearance, b?: Appearance) {
  if (!a || !b) return false;
  return packLook(a) === packLook(b);
}
