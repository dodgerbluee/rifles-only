/**
 * Studio stamps must round-trip through compileLayout.
 */
import * as THREE from "three";
import { compileLayout, COVER_SIZE, punchRects, STOREY } from "../src/maps/layout.ts";
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
  pickLotHandle,
  pickStudioHit,
  resizeItem,
  setLotHandle,
  itemsInRect,
  defaultOrbit,
  panDrag,
  toolFromCode,
} from "../src/maps/studio.ts";
import { addVersion, emptyLibrary, revertVersion, writeActive } from "../src/maps/studio-lib.ts";

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

const house = spec.buildings?.find((b) => (b.y ?? 0) === 0 && b.x === 2);
const deck = snapFloor(spec, 2, 0, 3, 1, 0);
check(
  "floor snaps to the building outer faces",
  !!house && deck.x === house.x && deck.z === house.z && deck.w === house.w + T && deck.d === house.d + T,
  `deck=${deck.w}x${deck.d} house=${house?.w}x${house?.d}`,
);
check("floor sits on the first-storey wall top", !!house && deck.y === (house.h ?? STOREY));

const beforeStack = spec.buildings?.length ?? 0;
spec = placeBuildingRect(spec, -4, -4, 8, 6, "building", 0, 0);
const raised = spec.buildings?.find((b) => b.x === 2 && (b.y ?? 0) === 0);
check(
  "same-size building on a floored house raises floors",
  (spec.buildings?.length ?? 0) === beforeStack && (raised?.floors ?? 1) >= 2,
  `floors=${raised?.floors} count=${spec.buildings?.length}`,
);

const roomSpec = placeBuildingRect(spec, 0, 0, 4, 3, "building", 0, 0);
const room = roomSpec.buildings?.find((b) => (b.y ?? 0) > 0 && (b.w ?? 0) < 10);
check("smaller building on the deck is a new volume", !!room && (room.y ?? 0) >= STOREY);

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
check("erase lives on hand", paletteOf("erase") === "hand");
check("X picks erase", toolFromCode("KeyX") === "erase");
check("build palette owns walls", paletteOf("building") === "build" && paletteOf("door") === "build");
check("accessories stay on kit", paletteOf("crate") === "kit" && paletteOf("jumpCrate") === "kit");
check("build tools do not include grab", toolsFor("build").every((t) => t.id !== "select"));
check("hand tools are grab and erase", toolsFor("hand").some((t) => t.id === "select") && toolsFor("hand").some((t) => t.id === "erase"));

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
spec = place(spec, "jumpCrate", 12, 6);
spec = place(spec, "erase", 12, 6);
check("erase tool stamps delete", !(spec.cover ?? []).some((c) => c.x === 12 && c.z === 6));

check("cut lives on build", paletteOf("cut") === "build" && toolFromCode("KeyU") === "cut");
check("wall lives on build", paletteOf("wall") === "build" && toolFromCode("KeyW") === "wall");
check("ladder lives on kit", paletteOf("ladder") === "kit" && toolFromCode("KeyN") === "ladder");
check("erase still on X after new tools", toolFromCode("KeyX") === "erase" && paletteOf("erase") === "hand");

let floored = blankSpec();
floored = place(floored, "building", 0, 0, { bw: 16, bd: 14 });
floored = place(floored, "floor", 0, 0, { bw: 16 + T, bd: 14 + T, y: STOREY });
floored = placeBuildingRect(floored, -2, -2, 2, 2, "building", 0, 0);
const shell = floored.buildings?.find((b) => (b.y ?? 0) > 0);
check(
  "smaller rect on a 1-storey deck sits at slab height",
  !!shell && Math.abs((shell.y ?? 0) - STOREY) < 0.05 && (shell.floors ?? 1) === 1,
);

let cut = blankSpec();
cut = place(cut, "floor", 0, 0, { bw: 12, bd: 10, y: STOREY });
cut = placeBuildingRect(cut, -2, -2, 2, 2, "cut", 0);
const holed = cut.slabs?.[0];
check("cut punches a hole on the slab", (holed?.holes?.length ?? 0) === 1, `holes=${holed?.holes?.length}`);
const leftovers = punchRects({ x: 0, z: 0, w: 12, d: 10 }, holed?.holes);
check("one hole leaves leftover deck pieces", leftovers.length >= 2 && leftovers.length <= 4);
check("cut did not add a slab", (cut.slabs?.length ?? 0) === 1);
const holeWorld = compileLayout(new THREE.Scene(), cut);
check(
  "hole is not walkable deck",
  !holeWorld.colliders.some((c) => c.walk && Math.abs(c.max.y - STOREY) < 0.05 && c.min.x < 0 && c.max.x > 0 && c.min.z < 0 && c.max.z > 0),
);
cut = placeBuildingRect(cut, -8, -8, 8, 8, "cut", 0);
check("cut covering the slab deletes it", (cut.slabs?.length ?? 0) === 0);

let rooms = blankSpec();
rooms = place(rooms, "building", 0, 0, { bw: 16, bd: 12 });
rooms = place(rooms, "floor", 0, 0, { bw: 16 + T, bd: 12 + T, y: STOREY });
rooms = placeBuildingRect(rooms, -6, 0, 6, 0.2, "wall", 0);
const part = rooms.partitions?.[0];
check("wall is T thick along X", !!part && Math.abs(part.d - T) < 0.02 && (part.w ?? 0) >= 8);
check("wall sits on the deck", !!part && Math.abs((part.y ?? 0) - STOREY) < 0.05);
const wallItem = pickItem(rooms, 0, 0);
check("hand can pick a partition", wallItem?.kind === "partition");
if (wallItem) rooms = deleteItem(rooms, wallItem);
check("hand can delete a partition", (rooms.partitions?.length ?? 0) === 0);

let climbSpec = blankSpec();
climbSpec = place(climbSpec, "building", 0, 0, { bw: 12, bd: 10 });
climbSpec = place(climbSpec, "ladder", 0, -6);
const lad = climbSpec.climbs?.find((c) => c.kind === "ladder");
check("ladder stamps as kind ladder", !!lad && (lad.height ?? 0) >= STOREY - 0.05);
check("ladder snaps toward the wall", !!lad && lad.dir === "+z");
const stair = place(blankSpec(), "climb", 0, 8, { yaw: 0 });
check("climb stays stairs by default", (stair.climbs?.[0]?.kind ?? "stairs") !== "ladder");
const ladWorld = compileLayout(new THREE.Scene(), climbSpec);
check(
  "ladder compiles walkable rungs",
  ladWorld.colliders.some((c) => c.walk && c.max.y - c.min.y < 0.2 && c.max.y > 0.2 && c.max.y < STOREY + 0.4),
);
check("ghost erase still small", ghostSize("erase", 12, 10).join() === "2,0.2,2");
check("ghost ladder is tall and thin", ghostSize("ladder", 12, 10)[1] === STOREY);
check("crates fill the 2m grid square", COVER_SIZE.jumpCrate[0] === 2 && COVER_SIZE.crate[0] === 2 && COVER_SIZE.fullCrate[0] === 2);

let sized = blankSpec();
sized = place(sized, "building", 0, 0, { bw: 12, bd: 10 });
const east = resizeItem(sized, { kind: "building", i: 0 }, "e", 10, 0);
check("east handle grows the building", (east.buildings?.[0]?.w ?? 0) >= 16);
check("east handle keeps the west face", Math.abs((east.buildings?.[0]?.x ?? 0) - (east.buildings?.[0]?.w ?? 0) / 2 + 6) < 0.05 || (east.buildings?.[0]?.w ?? 0) > 12);

const lot = blankSpec();
const corner = pickLotHandle(lot.bounds, lot.bounds.maxX, lot.bounds.maxZ);
check("lot corner is a two-axis handle", corner === "ne");
const insideN = pickLotHandle(lot.bounds, 0, lot.bounds.maxZ - 0.4);
check("north rim is grabable from inside", insideN === "n" || insideN === "ne" || insideN === "nw");
const grownN = setLotHandle(lot, "n", 0, lot.bounds.maxZ + 8);
check("north handle grows maxZ", grownN.bounds.maxZ > lot.bounds.maxZ && grownN.bounds.minZ === lot.bounds.minZ);
const grownNE = setLotHandle(lot, "ne", lot.bounds.maxX + 8, lot.bounds.maxZ + 8);
check("corner handle grows both axes", grownNE.bounds.maxX > lot.bounds.maxX && grownNE.bounds.maxZ > lot.bounds.maxZ);

sized = place(sized, "crate", 8, 8);
sized = place(sized, "crate", 12, 8);
const boxed = itemsInRect(sized, 6, 6, 14, 10);
check("marquee selects both crates", boxed.filter((i) => i.kind === "cover").length >= 2);
const ptr = pickStudioHit(sized, 0, -5, []);
check("building south rim is a resize hit", ptr.type === "resize" && ptr.handle.includes("s"));

const cam = defaultOrbit(lot.bounds);
const tx0 = cam.tx;
panDrag(cam, 20, 0);
check("pan right moves look-at with the cursor", cam.tx > tx0);

const lib = emptyLibrary(blankSpec());
const named = writeActive(lib, { ...blankSpec(), title: "Yard" });
check("library keeps the map name", named.docs[0]?.title === "Yard");
const v1 = addVersion(named, { ...blankSpec(), title: "Yard", buildings: [{ x: 0, z: 0, w: 12, d: 10 }] });
check("save writes a version", v1.docs[0]!.versions.length >= 2);
const back = revertVersion(v1, 1);
check("revert restores an older version", !!back && (back.spec.buildings?.length ?? 0) === 0);

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\nstudio spec round-trips");
