/**
 * Player kits round-trip through buildPawn.
 */
import * as THREE from "three";
import { buildPawn, parseSkin, SKINS, skinFor } from "../src/pawn.ts";

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
}

check("parseSkin keeps rifle", parseSkin("rifle") === "rifle");
check("parseSkin drops junk", parseSkin("hat") === undefined);
check("bot id 0 is rifle", skinFor(0) === "rifle");
check("bot id 1 is field", skinFor(1) === "field");

for (const k of SKINS) {
  const root = new THREE.Group();
  const parts = buildPawn(root, "ember", 0, k.id);
  check(`${k.id} has a body`, !!parts.body);
  check(`${k.id} stamps skin`, root.userData.skin === k.id);
}

const unit = new THREE.Group();
buildPawn(unit, "stone", 99, "unit");
check("override beats bot id", unit.userData.skin === "unit");

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\nlocker kits round-trip");
