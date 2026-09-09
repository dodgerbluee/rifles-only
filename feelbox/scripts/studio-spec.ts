/**
 * Studio stamps must round-trip through compileLayout.
 */
import * as THREE from "three";
import { compileLayout, STOREY } from "../src/maps/layout.ts";
import {
  blankSpec,
  place,
  eraseNear,
  addOpening,
  nearestBuildingWall,
  pickItem,
  moveItem,
  deleteItem,
  setLotEdge,
  surfaceAt,
  placeBuildingRect,
} from "../src/maps/studio.ts";

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
check("studio building is one storey", spec.buildings?.[0]?.h === STOREY);
check("cover stamped", spec.cover?.some((c) => c.kind === "crate") === true);
check("climb faces -z when looking north", spec.climbs?.[0]?.dir === "-z");
check("site A moved", spec.sites.find((s) => s.id === "loft")?.x === -10);

const roof = surfaceAt(spec, 2, 0);
spec = place(spec, "floor", 2, 0, { bw: 12, bd: 10, y: roof });
check("floor sits on the building", spec.slabs?.[0]?.y === roof && roof === STOREY);

const onTop = surfaceAt(spec, 2, 0);
spec = placeBuildingRect(spec, -4, -4, 8, 6, "building", 0, onTop);
const stacked = spec.buildings?.find((b) => (b.y ?? 0) > 0);
check("second building sits on the floor", !!stacked && stacked.y === onTop);

const wall = nearestBuildingWall(spec, 2, -5);
check("picks a wall near the building", !!wall);
if (wall) {
  spec = addOpening(spec, "door", wall);
  spec = addOpening(spec, "window", { ...wall, at: (wall.at ?? 0) + 3 });
  spec = addOpening(spec, "door", { ...wall, at: (wall.at ?? 0) + 2.4 });
}
check("door stamped", (spec.buildings?.[0]?.doors?.length ?? 0) >= 1);
check("second door sits beside the first", (spec.buildings?.[0]?.doors?.length ?? 0) >= 2);
check("window stamped", (spec.buildings?.[0]?.windows?.length ?? 0) >= 1);

const grown = setLotEdge(spec, "e", spec.bounds.maxX + 8);
check("east rim grows on its own", grown.bounds.maxX > spec.bounds.maxX && grown.bounds.minX === spec.bounds.minX);

const crate = pickItem(spec, 4, 4);
check("select finds the crate", crate?.kind === "cover");
if (crate) {
  spec = moveItem(spec, crate, 10, 6);
  check("moved crate", spec.cover?.some((c) => c.x === 10 && c.z === 6) === true);
}

const world = compileLayout(new THREE.Scene(), spec);
check("compiled draft has colliders", world.colliders.length > 8);
check("compiled title", world.title === "Draft");
check("stacked walk slabs exist", world.colliders.some((c) => c.walk && c.max.y > 2));

const groundB = spec.buildings?.find((b) => (b.y ?? 0) === 0);
check("ground building still there", !!groundB);
if (groundB) {
  const item = { kind: "building" as const, i: spec.buildings!.indexOf(groundB) };
  spec = deleteItem(spec, item);
}
check("delete removes the ground building", !(spec.buildings ?? []).some((b) => (b.y ?? 0) === 0 && b.x === 2));

spec = eraseNear(spec, 10, 6);
check("erase still removes cover", !(spec.cover ?? []).some((c) => c.x === 10 && c.z === 6));

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\nstudio spec round-trips");
