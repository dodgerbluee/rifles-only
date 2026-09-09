/**
 * Studio stamps must round-trip through compileLayout.
 */
import * as THREE from "three";
import { compileLayout, COVER_SIZE, STOREY } from "../src/maps/layout.ts";
import { T } from "../src/maps/kit.ts";
import {
  blankSpec,
  ghostSize,
  paletteOf,
  toolsFor,
  place,
  eraseNear,
  addOpening,
  nearestBuildingWall,
  pickItem,
  moveItem,
  deleteItem,
  setLotEdge,
  surfaceAt,
  snapFloor,
  playableSpec,
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
spec = place(spec, "jumpCrate", 6, 4);
spec = place(spec, "fullCrate", 8, 4);
spec = place(spec, "climb", 0, 8, { yaw: 0 });
spec = place(spec, "siteA", -10, 10);

check("building snapped to grid", spec.buildings?.[0]?.x === 2 && spec.buildings?.[0]?.z === 0);
check("building has no default door", (spec.buildings?.[0]?.doors?.length ?? 0) === 0);
check("studio building is one storey", spec.buildings?.[0]?.h === STOREY);
check("cover stamped", spec.cover?.some((c) => c.kind === "crate") === true);
check("jump crate stamped", spec.cover?.some((c) => c.kind === "jumpCrate" && c.x === 6 && c.z === 4) === true);
check("full crate stamped", spec.cover?.some((c) => c.kind === "fullCrate" && c.x === 8 && c.z === 4) === true);
check("climb faces -z when looking north", spec.climbs?.[0]?.dir === "-z");
check("site A moved", spec.sites.find((s) => s.id === "loft")?.x === -10);

const roof = surfaceAt(spec, 2, 0);
spec = place(spec, "floor", 2, 0, { bw: 12, bd: 10, y: roof });
check("floor sits on the building", spec.slabs?.[0]?.y === roof && roof === STOREY);

const onTop = surfaceAt(spec, 2, 0);
spec = placeBuildingRect(spec, -4, -4, 8, 6, "building", 0, onTop);
const stacked = spec.buildings?.find((b) => (b.y ?? 0) > 0);
check("second building sits on the floor", !!stacked && stacked.y === onTop);

const house = spec.buildings?.find((b) => (b.y ?? 0) === 0 && b.x === 2);
const deck = snapFloor(spec, 2, 0, 3, 1, 0);
check(
  "floor snaps to the building outer faces",
  !!house && deck.x === house.x && deck.z === house.z && deck.w === house.w + T && deck.d === house.d + T,
  `deck=${deck.w}x${deck.d} house=${house?.w}x${house?.d}`,
);
check("floor sits on the first-storey wall top", !!house && deck.y === (house.h ?? STOREY));

const play = playableSpec(blankSpec());
check("playable sketch has bot routes", play.routes.length >= 2);

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

check("hand palette owns the grabber", paletteOf("select") === "hand");
check("build palette owns walls", paletteOf("building") === "build" && paletteOf("door") === "build");
check("accessories stay on kit", paletteOf("crate") === "kit" && paletteOf("jumpCrate") === "kit");
check("build tools do not include grab", toolsFor("build").every((t) => t.id !== "select"));
check("hand tools are grab only", toolsFor("hand").length === 1 && toolsFor("hand")[0]?.id === "select");

const world = compileLayout(new THREE.Scene(), spec);
check("compiled draft has colliders", world.colliders.length > 8);
check("compiled title", world.title === "Draft");
check("stacked walk slabs exist", world.colliders.some((c) => c.walk && c.max.y > 2));

function coverHit(x: number, z: number) {
  return world.colliders.filter(
    (c) => c.max.y > 0.2 && c.min.x < x && c.max.x > x && c.min.z < z && c.max.z > z,
  );
}
const jumpHits = coverHit(6, 4);
const fullHits = coverHit(8, 4);
const midHits = coverHit(10, 6);
const jumpBox = jumpHits.find((c) => Math.abs(c.max.y - COVER_SIZE.jumpCrate[1]) < 0.02);
const fullBox = fullHits.find((c) => Math.abs(c.max.y - COVER_SIZE.fullCrate[1]) < 0.02);
const midBox = midHits.find((c) => Math.abs(c.max.y - COVER_SIZE.crate[1]) < 0.02);
check("jump crate is 0.9m and walkable", !!jumpBox && jumpBox.walk === true && jumpBox.max.y === 0.9);
check("full crate is 2.2m over stand eye", !!fullBox && fullBox.max.y === 2.2 && fullBox.max.y > 1.64 && fullBox.walk === true);
check("legacy crate is standable", !!midBox && midBox.max.y === 1.1 && midBox.walk === true);
check("ghost matches compiler jump crate", ghostSize("jumpCrate", 12, 10).join() === COVER_SIZE.jumpCrate.join());
check("ghost matches compiler full crate", ghostSize("fullCrate", 12, 10).join() === COVER_SIZE.fullCrate.join());
check("jump crate is under jump lip", COVER_SIZE.jumpCrate[1] < 0.97);
check("full crate is over stand body", COVER_SIZE.fullCrate[1] > 1.78);
check(
  "building walls are standable on top",
  world.colliders.some((c) => c.walk && c.max.y - c.min.y > 2 && Math.min(c.max.x - c.min.x, c.max.z - c.min.z) < 0.5),
);

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
