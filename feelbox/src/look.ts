export type FaceId = "pale" | "tan" | "olive" | "umber" | "square";
export type BeardId = "none" | "stubble" | "goatee" | "full" | "braid" | "stache" | "mutton" | "soul" | "forked" | "walrus";
export type HairId = "buzz" | "crew" | "mop" | "fade" | "bun";
export type HatId = "none" | "watch" | "ushanka" | "boonie" | "helmet";
export type ShirtId = "tee" | "henley" | "vest" | "parka" | "plate";
export type PantsId = "cargo" | "slim" | "shorts" | "wrap" | "armor";
export type ShoesId = "boot" | "sneaker" | "wrap" | "steel" | "bare";
export type AccessoryId = "none" | "glasses" | "scarf" | "earpro" | "mask" | "comms";
export type MeleeId =
  | "clip"
  | "bayonet"
  | "kukri"
  | "fairbairn"
  | "cleaver"
  | "tanto"
  | "karambit"
  | "machete"
  | "spike"
  | "folder"
  | "bat";

export type Appearance = {
  face: FaceId;
  beard: BeardId;
  hair: HairId;
  hat: HatId;
  shirt: ShirtId;
  pants: PantsId;
  shoes: ShoesId;
  accessory: AccessoryId;
  melee: MeleeId;
};

export type LookSlot = keyof Appearance;
export type LookView = "portrait" | "body" | "melee";

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
  { id: "stache", label: "Stache", blurb: "Wide mustache" },
  { id: "mutton", label: "Mutton", blurb: "Side chops" },
  { id: "soul", label: "Soul", blurb: "Lip patch" },
  { id: "forked", label: "Forked", blurb: "Split beard" },
  { id: "walrus", label: "Walrus", blurb: "Heavy brush" },
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

export const ACCESSORIES: LookOption<AccessoryId>[] = [
  { id: "none", label: "None", blurb: "No extra" },
  { id: "glasses", label: "Glasses", blurb: "Box frames" },
  { id: "scarf", label: "Scarf", blurb: "Neck wrap" },
  { id: "earpro", label: "Ear pro", blurb: "Cup muffs" },
  { id: "mask", label: "Mask", blurb: "Face cover" },
  { id: "comms", label: "Comms", blurb: "Boom mic" },
];

export const MELEES: LookOption<MeleeId>[] = [
  { id: "clip", label: "Clip", blurb: "Clip Utility — brass guard, wrapped wood" },
  { id: "bayonet", label: "Bayonet", blurb: "Kar Bayonet — spear point, muzzle ring" },
  { id: "kukri", label: "Kukri", blurb: "Forward belly, cho notch, brass cap" },
  { id: "fairbairn", label: "Fairbairn", blurb: "Slim dagger, S-guard, ball pommel" },
  { id: "cleaver", label: "Cleaver", blurb: "Wide chopper, spine hole, short haft" },
  { id: "tanto", label: "Tanto", blurb: "Angular tip, tsuba, ito wrap" },
  { id: "karambit", label: "Karambit", blurb: "Small claw, spur, finger ring" },
  { id: "machete", label: "Machete", blurb: "Long wide blade, riveted wood" },
  { id: "spike", label: "Spike", blurb: "Trench spike, knuckle bow" },
  { id: "folder", label: "Folder", blurb: "Pocket folder, pivot, nail nick" },
  { id: "bat", label: "Bat", blurb: "Baseball bat — wood barrel, wrap, knob" },
];

/**
 * Hair / hat rule (locker + pack normalize):
 * Only buzz sits under a hat.
 * Picking any other hair clears the hat. Picking any hat forces hair to buzz.
 * Packed looks that violate this keep the hat and drop the hair to buzz.
 */
export const HAIR_UNDER_HAT: HairId = "buzz";

export const LOOK_SLOTS: { key: LookSlot; label: string; view: LookView; options: LookOption<string>[] }[] = [
  { key: "face", label: "Face", view: "portrait", options: FACES },
  { key: "beard", label: "Beard", view: "portrait", options: BEARDS },
  { key: "hair", label: "Hair", view: "portrait", options: HAIRS },
  { key: "hat", label: "Hat", view: "portrait", options: HATS },
  { key: "accessory", label: "Acc", view: "portrait", options: ACCESSORIES },
  { key: "shirt", label: "Shirt", view: "body", options: SHIRTS },
  { key: "pants", label: "Pants", view: "body", options: PANTS },
  { key: "shoes", label: "Shoes", view: "body", options: SHOES },
  { key: "melee", label: "Melee", view: "melee", options: MELEES },
];

const CATS: { [K in LookSlot]: LookOption<Appearance[K]>[] } = {
  face: FACES,
  beard: BEARDS,
  hair: HAIRS,
  hat: HATS,
  shirt: SHIRTS,
  pants: PANTS,
  shoes: SHOES,
  accessory: ACCESSORIES,
  melee: MELEES,
};

/** v1 slots. v2 appends accessory. v3 appends melee. */
const ORDER_V1: LookSlot[] = ["face", "beard", "hair", "hat", "shirt", "pants", "shoes"];
const ORDER: LookSlot[] = [...ORDER_V1, "accessory"];

/**
 * Packed look string.
 *
 * v1 (7 digits, still accepted): FBH TSPE
 *   F face 0-4 · B beard 0-4 · H hair 0-4 · T hat 0-4 · S shirt 0-4 · P pants 0-4 · E shoes 0-4
 *   Accessory implied "none". Melee implied "clip".
 *
 * v2 (8 digits, still accepted): FBH TSPE A
 *   Same as v1, then A accessory 0-5.
 *   Beard digit is 0-9 (ten styles). Indices 0-4 match v1 (none, stubble, goatee, full, braid).
 *   Melee implied "clip".
 *
 * v3 (9 chars, current pack): FBH TSPE A M
 *   Same as v2, then M melee. 0-9 = first ten blades, a = baseball bat.
 *
 * packLook always emits v3 (9 chars) after normalizeLook.
 */
const PACK_V1 = /^[0-4]{7}$/;
const PACK_V2 = /^[0-4][0-9][0-4]{5}[0-9]$/;
const PACK_V3 = /^[0-4][0-9][0-4]{5}[0-9][0-9aA]$/;

export const DEFAULT_LOOK: Appearance = {
  face: "tan",
  beard: "none",
  hair: "crew",
  hat: "none",
  shirt: "tee",
  pants: "cargo",
  shoes: "boot",
  accessory: "none",
  melee: "clip",
};

type LegacySkin = "rifle" | "field" | "unit" | "frame";

const SKIN_LOOK: Record<LegacySkin, Appearance> = {
  rifle: { ...DEFAULT_LOOK, hat: "helmet", hair: "buzz" },
  field: { face: "olive", beard: "stubble", hair: "buzz", hat: "boonie", shirt: "henley", pants: "cargo", shoes: "boot", accessory: "none", melee: "clip" },
  unit: { face: "square", beard: "none", hair: "buzz", hat: "helmet", shirt: "plate", pants: "armor", shoes: "steel", accessory: "none", melee: "clip" },
  frame: { face: "square", beard: "none", hair: "buzz", hat: "none", shirt: "plate", pants: "armor", shoes: "steel", accessory: "none", melee: "clip" },
};

function inCat<K extends LookSlot>(slot: K, id: string | undefined): Appearance[K] | undefined {
  return CATS[slot].some((o) => o.id === id) ? (id as Appearance[K]) : undefined;
}

export function hairFitsHat(hair: HairId) {
  return hair === HAIR_UNDER_HAT;
}

export function lookView(slot: LookSlot): LookView {
  return LOOK_SLOTS.find((s) => s.key === slot)?.view ?? "portrait";
}

export function normalizeLook(look: Appearance): Appearance {
  const next = { ...look };
  if (next.hat !== "none") next.hair = HAIR_UNDER_HAT;
  return next;
}

export function applyLookChoice(look: Appearance, slot: LookSlot, id: string): Appearance {
  const valid = inCat(slot, id);
  if (!valid) return normalizeLook(look);
  const next = { ...look, [slot]: valid };
  if (slot === "hair" && valid !== HAIR_UNDER_HAT) next.hat = "none";
  if (slot === "hat" && valid !== "none") next.hair = HAIR_UNDER_HAT;
  return normalizeLook(next);
}

export function mapSkinToLook(skin?: LegacySkin): Appearance | undefined {
  if (!skin) return undefined;
  return normalizeLook({ ...SKIN_LOOK[skin] });
}

export function skinFromLook(look: Appearance): LegacySkin {
  if (look.shirt === "plate" && look.pants === "armor") return look.hat === "none" ? "frame" : "unit";
  if (look.hat === "boonie" || look.shirt === "henley") return "field";
  return "rifle";
}

export function lookFor(id?: number): Appearance {
  const n = Math.abs(id ?? 0);
  return normalizeLook({
    face: FACES[n % FACES.length]!.id,
    beard: BEARDS[n % BEARDS.length]!.id,
    hair: HAIRS[(n * 2) % HAIRS.length]!.id,
    hat: HATS[(n * 3) % HATS.length]!.id,
    shirt: SHIRTS[(n + 2) % SHIRTS.length]!.id,
    pants: PANTS[(n + 3) % PANTS.length]!.id,
    shoes: SHOES[(n + 4) % SHOES.length]!.id,
    accessory: ACCESSORIES[n % ACCESSORIES.length]!.id,
    melee: MELEES[n % MELEES.length]!.id,
  });
}

function digit<K extends LookSlot>(slot: K, id: Appearance[K]) {
  return String(Math.max(0, CATS[slot].findIndex((o) => o.id === id)));
}

function packMelee(id: MeleeId) {
  const i = Math.max(0, MELEES.findIndex((o) => o.id === id));
  return i >= 10 ? "a" : String(i);
}

function unpackMelee(ch: string): MeleeId {
  if (ch === "a" || ch === "A") return "bat";
  return MELEES[Number(ch)]?.id ?? DEFAULT_LOOK.melee;
}

export function packLook(look: Appearance): string {
  const next = normalizeLook(look);
  return ORDER.map((k) => digit(k, next[k])).join("") + packMelee(next.melee);
}

export function isPackedLook(raw: unknown): raw is string {
  return typeof raw === "string" && (PACK_V1.test(raw) || PACK_V2.test(raw) || PACK_V3.test(raw));
}

export function unpackLook(raw: unknown): Appearance | undefined {
  if (!isPackedLook(raw)) return undefined;
  const next = { ...DEFAULT_LOOK };
  const keys = raw.length === 7 ? ORDER_V1 : ORDER;
  keys.forEach((k, i) => {
    const opt = CATS[k][Number(raw[i])];
    if (opt) (next as Appearance)[k] = opt.id as never;
  });
  if (raw.length >= 9) next.melee = unpackMelee(raw[8]!);
  return normalizeLook(next);
}

export function parseLook(raw: unknown): Appearance | undefined {
  const packed = unpackLook(raw);
  if (packed) return packed;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Partial<Record<LookSlot, string>>;
    return normalizeLook({
      face: inCat("face", o.face) ?? DEFAULT_LOOK.face,
      beard: inCat("beard", o.beard) ?? DEFAULT_LOOK.beard,
      hair: inCat("hair", o.hair) ?? DEFAULT_LOOK.hair,
      hat: inCat("hat", o.hat) ?? DEFAULT_LOOK.hat,
      shirt: inCat("shirt", o.shirt) ?? DEFAULT_LOOK.shirt,
      pants: inCat("pants", o.pants) ?? DEFAULT_LOOK.pants,
      shoes: inCat("shoes", o.shoes) ?? DEFAULT_LOOK.shoes,
      accessory: inCat("accessory", o.accessory) ?? DEFAULT_LOOK.accessory,
      melee: inCat("melee", o.melee) ?? DEFAULT_LOOK.melee,
    });
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
