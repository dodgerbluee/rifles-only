/**
 * Studio stamps must round-trip through compileLayout.
 */
import * as THREE from "three";
import { compileLayout } from "../src/maps/layout.ts";
import { blankSpec, place, eraseNear, growLot, addOpening, nearestBuildingWall, LOT_STEP } from "../src/maps/studio.ts";

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
}

let spec = blankSpec();
spec = place(spec, "building", 1.2, -0.4);
spec = place(spec, "crate", 4, 4);
spec = place(spec, "climb", 0, 8, { yaw: 0 });
spec = place(spec, "siteA", -10, 10);

check("building snapped to grid", spec.buildings?.[0]?.x === 2 && spec.buildings?.[0]?.z === 0);
check("building has no default door", (spec.buildings?.[0]?.doors?.length ?? 0) === 0);
check("cover stamped", spec.cover?.some((c) => c.kind === "crate") === true);
check("climb faces -z when looking north", spec.climbs?.[0]?.dir === "-z");
check("site A moved", spec.sites.find((s) => s.id === "loft")?.x === -10);

spec = place(spec, "third", 20, 4);
check("3F stamp", spec.buildings?.some((b) => b.floors === 3) === true);

const wall = nearestBuildingWall(spec, 2, -5);
check("picks a wall near the building", !!wall);
if (wall) {
  spec = addOpening(spec, "door", wall);
  spec = addOpening(spec, "window", { ...wall, at: (wall.at ?? 0) + 3 });
}
check("door stamped", (spec.buildings?.[0]?.doors?.length ?? 0) >= 1);
check("window stamped", (spec.buildings?.[0]?.windows?.length ?? 0) >= 1);

const grown = growLot(spec, LOT_STEP);
check("lot grows", grown.bounds.maxX - grown.bounds.minX > spec.bounds.maxX - spec.bounds.minX);

const world = compileLayout(new THREE.Scene(), spec);
check("compiled draft has colliders", world.colliders.length > 8);
check("compiled title", world.title === "Draft");
check("3F walk slabs exist", world.colliders.some((c) => c.walk && c.max.y > 5));

spec = eraseNear(spec, 2, 0);
check("erase removes the building", !(spec.buildings ?? []).some((b) => b.x === 2 && b.z === 0));

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\nstudio spec round-trips");
