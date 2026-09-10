/**
 * Player appearance slots round-trip through buildPawn.
 */
import * as THREE from "three";
import { LOOK_SLOTS, packLook, parseLook, unpackLook, lookFor, DEFAULT_LOOK, resolveLook } from "../src/look.ts";
import { buildPawn, parseSkin, SKINS, skinFor } from "../src/pawn.ts";

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
}

check("seven locker slots", LOOK_SLOTS.length === 7);
for (const slot of LOOK_SLOTS) {
  check(`${slot.label} has 5 looks`, slot.options.length === 5);
  const ids = new Set(slot.options.map((o) => o.id));
  check(`${slot.label} ids unique`, ids.size === 5);
}

check("parseSkin keeps rifle", parseSkin("rifle") === "rifle");
check("parseSkin drops junk", parseSkin("hat") === undefined);
check("bot id 0 is rifle", skinFor(0) === "rifle");
check("bot id 1 is field", skinFor(1) === "field");

for (const k of SKINS) {
  const root = new THREE.Group();
  const parts = buildPawn(root, "ember", 0, k.id);
  check(`${k.id} has a body`, !!parts.body);
  check(`${k.id} stamps a look`, typeof root.userData.lookId === "string" && root.userData.lookId.length === 7);
}

const unit = new THREE.Group();
buildPawn(unit, "stone", 99, "unit");
check("legacy unit kit still dresses", !!unit.userData.look);

const packed = packLook(DEFAULT_LOOK);
check("default packs to 7 digits", /^[0-4]{7}$/.test(packed));
check("unpack round-trips default", packLook(unpackLook(packed)!) === packed);
check("parseLook reads packed ids", packLook(parseLook(packed)!) === packed);
check("parseLook reads objects", parseLook({ face: "umber", hat: "ushanka" })?.face === "umber");

for (const slot of LOOK_SLOTS) {
  for (const opt of slot.options) {
    const look = { ...DEFAULT_LOOK, [slot.key]: opt.id };
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
check("mixed packed look dresses", mixed.userData.lookId === "2144032");

const a = lookFor(4);
const b = lookFor(4);
check("bot looks are stable", packLook(a) === packLook(b));
check("bot looks differ by id", packLook(lookFor(0)) !== packLook(lookFor(1)));

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\nlocker kits round-trip");
