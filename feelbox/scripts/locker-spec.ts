/**
 * Player appearance slots round-trip through buildPawn.
 */
import * as THREE from "three";
import {
  ACCESSORIES,
  BEARDS,
  DEFAULT_LOOK,
  HAIR_UNDER_HAT,
  LOOK_SLOTS,
  MELEES,
  applyLookChoice,
  isPackedLook,
  lookFor,
  lookView,
  packLook,
  parseLook,
  unpackLook,
  resolveLook,
} from "../src/look.ts";
import { buildPawn, parseSkin, SKINS, skinFor } from "../src/pawn.ts";
import { meleeReach, tuning } from "../src/tuning.ts";

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
}

check("nine locker slots", LOOK_SLOTS.length === 9);
check("accessory slot exists", LOOK_SLOTS.some((s) => s.key === "accessory"));
check("melee slot exists", LOOK_SLOTS.some((s) => s.key === "melee"));
check("ten beards including none", BEARDS.length === 10 && BEARDS[0]!.id === "none");
check("six accessories including none", ACCESSORIES.length === 6 && ACCESSORIES[0]!.id === "none");
check("eleven melees including bat", MELEES.length === 11 && MELEES[10]!.id === "bat" && MELEES[0]!.id === "clip");
check("shared melee reach", meleeReach() === tuning.melee);

for (const slot of LOOK_SLOTS) {
  const ids = new Set(slot.options.map((o) => o.id));
  check(`${slot.label} ids unique`, ids.size === slot.options.length);
  check(`${slot.label} has options`, slot.options.length >= 5);
}

check("head slots use portrait cam", lookView("face") === "portrait" && lookView("accessory") === "portrait");
check("kit slots use body cam", lookView("shirt") === "body" && lookView("shoes") === "body");
check("melee slot uses melee cam", lookView("melee") === "melee");

check("parseSkin keeps rifle", parseSkin("rifle") === "rifle");
check("parseSkin drops junk", parseSkin("hat") === undefined);
check("bot id 0 is rifle", skinFor(0) === "rifle");
check("bot id 1 is field", skinFor(1) === "field");

for (const k of SKINS) {
  const root = new THREE.Group();
  const parts = buildPawn(root, "ember", 0, k.id);
  check(`${k.id} has a body`, !!parts.body);
  check(`${k.id} stamps a v3 look`, typeof root.userData.lookId === "string" && root.userData.lookId.length === 9);
}

const unit = new THREE.Group();
buildPawn(unit, "stone", 99, "unit");
check("legacy unit kit still dresses", !!unit.userData.look);

const packed = packLook(DEFAULT_LOOK);
check("default packs to 9 chars", /^[0-4][0-9][0-4]{5}[0-9][0-9aA]$/.test(packed) && packed.length === 9);
check("default pack is 101000000", packed === "101000000");
check("unpack round-trips default", packLook(unpackLook(packed)!) === packed);
check("parseLook reads packed ids", packLook(parseLook(packed)!) === packed);
check("v1 seven-digit still unpacks", unpackLook("1010000")?.accessory === "none" && unpackLook("1010000")?.face === "tan" && unpackLook("1010000")?.melee === "clip");
check("v1 pack upgrades to v3", packLook(unpackLook("1010000")!) === "101000000");
check("v2 eight-digit still unpacks", unpackLook("10100000")?.accessory === "none" && unpackLook("10100000")?.melee === "clip");
check("v2 pack upgrades to v3", packLook(unpackLook("10100000")!) === "101000000");
check("isPackedLook accepts v1 v2 v3", isPackedLook("1010000") && isPackedLook("10100000") && isPackedLook("101000000"));
check("isPackedLook accepts bat pack", isPackedLook("10100000a"));
check("isPackedLook drops junk", !isPackedLook("look") && !isPackedLook("9999999"));
check("parseLook reads objects", parseLook({ face: "umber", hat: "ushanka" })?.face === "umber");
check("object look defaults accessory", parseLook({ face: "umber" })?.accessory === "none");
check("object look defaults melee", parseLook({ face: "umber" })?.melee === "clip");

check("hair other than buzz clears hat", applyLookChoice({ ...DEFAULT_LOOK, hat: "helmet", hair: "buzz" }, "hair", "mop").hat === "none");
check("hat other than none forces buzz", applyLookChoice({ ...DEFAULT_LOOK, hair: "mop" }, "hat", "boonie").hair === HAIR_UNDER_HAT);
check("buzz keeps a hat", applyLookChoice({ ...DEFAULT_LOOK, hat: "helmet", hair: "buzz" }, "hair", "buzz").hat === "helmet");
check("packed mop+helmet keeps the hat", unpackLook("2144032")?.hat === "helmet" && unpackLook("2144032")?.hair === "buzz");

for (const slot of LOOK_SLOTS) {
  for (const opt of slot.options) {
    const look = applyLookChoice(DEFAULT_LOOK, slot.key, opt.id);
    const root = new THREE.Group();
    const parts = buildPawn(root, "ember", 0, look);
    check(`${slot.key}:${opt.id} builds`, !!parts.body && !!parts.head && !!parts.helm);
    check(`${slot.key}:${opt.id} stamps look`, packLook(root.userData.look) === packLook(look));
    check(`${slot.key}:${opt.id} has hit meshes`, parts.hits.length > 0 || parts.head != null);
  }
}

const mix = resolveLook("2144032");
const mixed = new THREE.Group();
buildPawn(mixed, "stone", 3, mix);
check("legacy mixed look dresses", mixed.userData.lookId === packLook(mix));
check("legacy mixed look is v3", mixed.userData.lookId === "210403200");

const newBeard = packLook({ ...DEFAULT_LOOK, beard: "walrus" });
check("new beard uses digit 9", newBeard[1] === "9");
check("new beard round-trips", unpackLook(newBeard)?.beard === "walrus");

const glasses = packLook({ ...DEFAULT_LOOK, accessory: "glasses" });
check("accessory sits before melee", glasses.length === 9 && glasses[7] === "1" && glasses.endsWith("0"));
check("accessory round-trips", unpackLook(glasses)?.accessory === "glasses");

const bat = packLook({ ...DEFAULT_LOOK, melee: "bat" });
check("bat pack uses a", bat.endsWith("a"));
check("bat round-trips", unpackLook(bat)?.melee === "bat");
check("melee choice does not change reach", meleeReach() === tuning.melee);

const a = lookFor(4);
const b = lookFor(4);
check("bot looks are stable", packLook(a) === packLook(b));
check("bot looks differ by id", packLook(lookFor(0)) !== packLook(lookFor(1)));
check("bot looks obey hair/hat", a.hat === "none" || a.hair === HAIR_UNDER_HAT);

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\nlocker kits round-trip");
