/**
 * Layout compiler + walk-out checks. New maps must pass before they ship.
 *   npx tsx scripts/map-check.ts
 */
import * as THREE from "three";
import { checkWorld } from "../src/maps/check.ts";
import { compileLayout, YARD_SPEC } from "../src/maps/layout.ts";
import { buildMap, MAPS, type MapId } from "../src/maps/index.ts";

let failed = 0;
function report(title: string, issues: { ok: boolean; name: string; detail?: string }[]) {
  console.log(`\n${title}`);
  for (const i of issues) {
    if (!i.ok) failed += 1;
    console.log(`${i.ok ? "ok" : "FAIL"}  ${i.name}${i.detail ? `  ${i.detail}` : ""}`);
  }
}

const scene = new THREE.Scene();
const yard = compileLayout(scene, YARD_SPEC);
report("compiled Yard", checkWorld(yard));

const only = process.argv[2];
if (only && only !== "yard") {
  const id = only as MapId;
  if (!MAPS.some((m) => m.id === id)) {
    console.error(`unknown map ${only}`);
    process.exit(1);
  }
  report(id, checkWorld(buildMap(new THREE.Scene(), id)));
}

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nmap layout checks out");
