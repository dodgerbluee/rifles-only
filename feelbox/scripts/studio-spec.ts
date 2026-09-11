/**
 * Studio stamps must round-trip through compileLayout.
 */
import * as THREE from "three";
import { compileLayout, COVER_SIZE, DECK_H, punchRects, priorWallGaps, resolveWalkDecks, STOREY } from "../src/maps/layout.ts";
import { T } from "../src/maps/kit.ts";
import {
  blankSpec,
  cellRect,
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
  interiorYAt,
  snapFloor,
  snapRect,
  playableSpec,
  placeBuildingRect,
  pickLotHandle,
  setBuildingInterior,
  setBuildingStoreys,
  pickStudioHit,
  resizeItem,
  setLotHandle,
  itemsInRect,
  defaultOrbit,
  GRID,
  panDrag,
  toolFromCode,
  walkKeepsTool,
} from "../src/maps/studio.ts";
import { addVersion, emptyLibrary, revertVersion, seedCatalog, writeActive } from "../src/maps/studio-lib.ts";
import { SIDING_SPEC } from "../src/maps/siding.ts";
import { HARBOR_SPEC } from "../src/maps/harbor.ts";

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
}

function deckCovers(pieces: { x: number; z: number; w: number; d: number }[], x: number, z: number) {
  return pieces.some((p) => p.x - p.w / 2 < x && p.x + p.w / 2 > x && p.z - p.d / 2 < z && p.z + p.d / 2 > z);
}

const house12 = { x: 0, z: 0, w: 12, d: 10, h: STOREY };
const roofDeck = { x: 0, z: 0, w: 12 - T, d: 10 - T, y: STOREY, owner: 0 };
const overFloor = resolveWalkDecks(
  [roofDeck, { x: 0, z: 0, w: 16, d: 14, y: STOREY }],
  [house12],
);
check("overlapping floor keeps the roof", deckCovers(overFloor, 0, 0));
check("overlapping floor leftover stays outside", deckCovers(overFloor, 7, 0));
check("overlapping floor is punched off the wall band", !deckCovers(overFloor, 6, 0));
const throughFloor = resolveWalkDecks([{ x: 0, z: 0, w: 8, d: 8, y: DECK_H }], [house12]);
check("ground floor does not run through a house", throughFloor.length === 0);
const abut = { x: 4, z: 0, w: 4, d: 4 };
const shared = priorWallGaps({ x: 0, z: 0, w: 4, d: 4, h: STOREY }, "e", [abut], 0, STOREY);
check("shared building face is a wall gap", shared.some((g) => g.w > 3.5));

let spec = blankSpec();
const cell = cellRect(1.2, -0.4);
spec = place(spec, "building", 1.2, -0.4);
spec = place(spec, "crate", 4.1, 4.1);
spec = place(spec, "jumpCrate", 6, 4);
spec = place(spec, "fullCrate", 8, 4);
spec = place(spec, "climb", 0, 8, { yaw: 0 });
spec = place(spec, "siteA", -10.1, 10.1);

const clickHouse = spec.buildings?.[0];
check("click building fills one cell", clickHouse?.w === GRID && clickHouse?.d === GRID);
check("click building sits in the cell", clickHouse?.x === cell.x && clickHouse?.z === cell.z);
check("building has no default door", (spec.buildings?.[0]?.doors?.length ?? 0) === 0);
check("studio building is one storey", spec.buildings?.[0]?.h === STOREY);
const little = spec.cover?.find((c) => c.kind === "crate");
check("little crate sits on a cell center", little?.x === 4.25 && little?.z === 4.25);
check("jump crate stamped", spec.cover?.some((c) => c.kind === "jumpCrate" && c.x === 6 && c.z === 4) === true);
check("full crate stamped", spec.cover?.some((c) => c.kind === "fullCrate" && c.x === 8 && c.z === 4) === true);
check("climb faces -z when looking north", spec.climbs?.[0]?.dir === "-z");
check("site A snapped to a cell", spec.sites.find((s) => s.id === "loft")?.x === -10.25);

spec = place(blankSpec(), "building", 0, 0, { bw: 12, bd: 10 });
spec = place(spec, "crate", 4.1, 4.1);
spec = place(spec, "jumpCrate", 6, 4);
spec = place(spec, "fullCrate", 8, 4);
spec = place(spec, "climb", 0, 8, { yaw: 0 });
spec = place(spec, "siteA", -10, 10);

const roof = surfaceAt(spec, 0, 0);
spec = place(spec, "floor", 0, 0, { bw: 12, bd: 10, y: roof });
check("floor sits on the building", spec.slabs?.[0]?.y === roof && roof === STOREY);

const house = spec.buildings?.find((b) => (b.y ?? 0) === 0 && b.x === 0);
const deck = snapFloor(spec, 0, 0, 1, 1, 0);
check(
  "floor snaps to the building outer faces",
  !!house && deck.x === house.x && deck.z === house.z && deck.w === house.w + T && deck.d === house.d + T,
  `deck=${deck.w}x${deck.d} house=${house?.w}x${house?.d}`,
);
check("floor sits on the first-storey wall top", !!house && deck.y === (house.h ?? STOREY));

const beforeStack = spec.buildings?.length ?? 0;
spec = placeBuildingRect(spec, -6, -5, 6, 5, "building", 0, roof);
const raised = spec.buildings?.find((b) => b.x === 0 && (b.y ?? 0) === 0);
check(
  "same-size building on a floored house raises floors",
  (spec.buildings?.length ?? 0) === beforeStack && (raised?.floors ?? 1) >= 2,
  `floors=${raised?.floors} count=${spec.buildings?.length}`,
);
check("raising a storey does not invent stairs", !(raised?.stairs));

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
check("a door does not invent stairs", !(spec.buildings?.[0]?.stairs));

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
check("full crate is 1.96m, covers stand heads", !!fullBox && fullBox.max.y === 1.96 && fullBox.max.y > 1.64 && fullBox.walk === true);
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
check("delete removes the ground building", !(spec.buildings ?? []).some((b) => (b.y ?? 0) === 0 && b.x === 0));

spec = eraseNear(spec, 10, 6);
check("erase still removes cover", !(spec.cover ?? []).some((c) => c.x === 10 && c.z === 6));
spec = place(spec, "jumpCrate", 12, 6);
spec = place(spec, "erase", 12, 6);
check("erase tool stamps delete", !(spec.cover ?? []).some((c) => c.x === 12 && c.z === 6));

check("cut lives on build", paletteOf("cut") === "build" && toolFromCode("KeyU") === "cut");
check("wall lives on build", paletteOf("wall") === "build" && toolFromCode("KeyI") === "wall");
check("wall does not steal W", toolFromCode("KeyW") !== "wall");
check("door does not steal D", toolFromCode("KeyD") !== "door" && toolFromCode("KeyO") === "door");
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
check("dragged cut can still be larger than a cell", Math.abs((holed?.holes?.[0]?.w ?? 0) - 4) < 0.05);
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

let cellCut = blankSpec();
cellCut = place(cellCut, "floor", 0, 0, { bw: 12, bd: 10, y: STOREY });
cellCut = place(cellCut, "cut", 0, 0);
const cellHole = cellCut.slabs?.[0]?.holes?.[0];
check(
  "stamp cut is one grid square",
  Math.abs((cellHole?.w ?? 0) - GRID) < 0.02 && Math.abs((cellHole?.d ?? 0) - GRID) < 0.02,
  `hole=${cellHole?.w}x${cellHole?.d}`,
);
check("cut stays in walk", walkKeepsTool("cut") && walkKeepsTool("floor") && walkKeepsTool("wall"));
check("building still leaves walk", !walkKeepsTool("building"));
check("cut ghost is one grid square", ghostSize("cut", 12, 10).join() === `${GRID},0.16,${GRID}`);

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

const walkWall = place(blankSpec(), "wall", 0, 0, { yaw: 0 });
const walkPart = walkWall.partitions?.[0];
check(
  "walk wall faces the look direction",
  !!walkPart && Math.abs((walkPart.w ?? 0) - GRID) < 0.02 && Math.abs((walkPart.d ?? 0) - T) < 0.02,
);

let stackedHouse = blankSpec();
stackedHouse = place(stackedHouse, "building", 0, 0, { bw: 12, bd: 10 });
stackedHouse = place(stackedHouse, "floor", 0, 0, { bw: 12 + T, bd: 10 + T, y: STOREY });
stackedHouse = placeBuildingRect(stackedHouse, -6, -5, 6, 5, "building", 0, 0);
const stacked = stackedHouse.buildings?.[0];
check("2F house has no default stairs", !!stacked && (stacked.floors ?? 1) >= 2 && !stacked.stairs);
const south = nearestBuildingWall(stackedHouse, 0, -6);
if (south) stackedHouse = addOpening(stackedHouse, "door", { ...south, floor: 1 });
check("2F door stays a single opening", (stackedHouse.buildings?.[0]?.doors?.length ?? 0) === 1);
check("2F door still does not set stairs", !(stackedHouse.buildings?.[0]?.stairs));
const noAuto = compileLayout(new THREE.Scene(), stackedHouse);
const withStairs: typeof stackedHouse = {
  ...stackedHouse,
  buildings: stackedHouse.buildings?.map((b) => ({ ...b, stairs: "s" as const })),
};
const auto = compileLayout(new THREE.Scene(), withStairs);
check(
  "explicit stairs add climb geometry",
  auto.colliders.length > noAuto.colliders.length,
  `none=${noAuto.colliders.length} stairs=${auto.colliders.length}`,
);

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
check("ghost erase still small", ghostSize("erase", 12, 10).join() === `${GRID},0.2,${GRID}`);
check("ghost ladder is tall and thin", ghostSize("ladder", 12, 10)[1] === STOREY);
check("little crate fills one studio cell", COVER_SIZE.crate[0] === GRID && COVER_SIZE.crate[2] === GRID);

function thinWalkAt(
  w: { colliders: { walk?: boolean; min: THREE.Vector3; max: THREE.Vector3 }[] },
  x: number,
  z: number,
  y: number,
) {
  return w.colliders.filter(
    (c) =>
      c.walk &&
      c.max.y - c.min.y < 0.25 &&
      Math.abs(c.max.y - y) < 0.1 &&
      c.min.x < x &&
      c.max.x > x &&
      c.min.z < z &&
      c.max.z > z,
  );
}

let tall = place(blankSpec(), "building", 0, 0, { bw: 12, bd: 10 });
tall = setBuildingStoreys(tall, 0, 10);
check(
  "storeys 10 writes floors and drops h",
  tall.buildings?.[0]?.floors === 10 && tall.buildings?.[0]?.h === undefined,
);
check("raising via control defaults empty", tall.buildings?.[0]?.interior === "empty");
const tallWorld = compileLayout(new THREE.Scene(), tall);
check(
  "10-storey compiles tall",
  tallWorld.colliders.some((c) => Math.abs(c.max.y - 10 * STOREY) < 0.2),
  `max=${Math.max(...tallWorld.colliders.map((c) => c.max.y)).toFixed(2)}`,
);

let empty3 = setBuildingStoreys(place(blankSpec(), "building", 0, 0, { bw: 12, bd: 10 }), 0, 3);
const empty3World = compileLayout(new THREE.Scene(), empty3);
check("empty 3F has no walkable interior slab", thinWalkAt(empty3World, 0, 0, STOREY).length === 0);
check("empty 3F invents no stairs", !(empty3.buildings?.[0]?.stairs));
check("empty 3F still has a roof", thinWalkAt(empty3World, 0, 0, 3 * STOREY).length === 1);

let floors3 = setBuildingInterior(setBuildingStoreys(place(blankSpec(), "building", 0, 0, { bw: 12, bd: 10 }), 0, 3), 0, "floors");
const floors3World = compileLayout(new THREE.Scene(), floors3);
check("floors 3F has walkable deck at STOREY", thinWalkAt(floors3World, 0, 0, STOREY).length === 1);
check("floors 3F still has no auto stairs", !(floors3.buildings?.[0]?.stairs));
check("floors 3F has a roof", thinWalkAt(floors3World, 0, 0, 3 * STOREY).length === 1);

const omitted = { ...blankSpec(), buildings: [{ x: 0, z: 0, w: 12, d: 10, floors: 2 }] };
check(
  "omitted interior still has decks",
  thinWalkAt(compileLayout(new THREE.Scene(), omitted), 0, 0, STOREY).length >= 1,
);

const overlapHouse = {
  ...blankSpec(),
  buildings: [
    { x: 0, z: 0, w: 12, d: 10, floors: 2 },
    { x: 6, z: 0, w: 12, d: 10, floors: 2 },
  ],
};
check(
  "overlapping 2F houses share one walk deck",
  thinWalkAt(compileLayout(new THREE.Scene(), overlapHouse), 3, 0, STOREY).length === 1,
);

const housePlusFloor = {
  ...blankSpec(),
  buildings: [{ x: 0, z: 0, w: 12, d: 10, floors: 2 }],
  slabs: [{ x: 0, z: 0, w: 16, d: 14, y: STOREY }],
};
const hpf = compileLayout(new THREE.Scene(), housePlusFloor);
check("house + overlapping floor is one walk at center", thinWalkAt(hpf, 0, 0, STOREY).length === 1);
check("floor leftover outside the house is still walkable", thinWalkAt(hpf, 7, 0, STOREY).length === 1);
check("floor leftover is not on the wall", thinWalkAt(hpf, 6, 0, STOREY).length === 0);

const walkway = {
  ...blankSpec(),
  buildings: [
    { x: 0, z: 0, w: 12, d: 10, floors: 2 },
    { x: 4, z: 0, w: 12, d: 10, floors: 2, interior: "empty" as const },
  ],
};
check(
  "empty walkway does not stack a second deck",
  thinWalkAt(compileLayout(new THREE.Scene(), walkway), 2, 0, STOREY).length === 1,
);

const hut = placeBuildingRect(blankSpec(), 0, 0, GRID, GRID, "building", 0);
check(
  "1 block building stays 1 block",
  hut.buildings?.[0]?.w === GRID && hut.buildings?.[0]?.d === GRID,
  `size=${hut.buildings?.[0]?.w}x${hut.buildings?.[0]?.d}`,
);
const hutWorld = compileLayout(new THREE.Scene(), hut);
check(
  "1 block building compiles walls",
  hutWorld.colliders.some((c) => Math.min(c.max.x - c.min.x, c.max.z - c.min.z) < 0.5 && c.max.y > 1),
);
check(
  "1F has a walkable roof",
  thinWalkAt(hutWorld, hut.buildings![0]!.x, hut.buildings![0]!.z, STOREY).length === 1,
);
const hutMid = pickStudioHit(hut, hut.buildings![0]!.x, hut.buildings![0]!.z, [{ kind: "building", i: 0 }]);
check("selected 1-block body is a grab, not a resize", hutMid.type === "item");

let neighbor = place(blankSpec(), "building", 0.1, 0);
neighbor = place(neighbor, "building", 0.7, 0);
const left = neighbor.buildings![0]!;
const pickLeft = pickItem(neighbor, left.x, left.z);
check("adjacent 1-block picks the cell under the cursor", pickLeft?.kind === "building" && pickLeft.i === 0);

const clickWall = place(blankSpec(), "wall", 1.3, 2.1, { yaw: 0 });
const wp = clickWall.partitions?.[0];
check("click wall fills one cell", (wp?.w === GRID && Math.abs((wp?.d ?? 0) - T) < 0.02) || (wp?.d === GRID && Math.abs((wp?.w ?? 0) - T) < 0.02));
check("click wall edges sit on grid lines", Math.abs(((wp?.x ?? 0) - (wp?.w ?? 0) / 2) / GRID - Math.round(((wp?.x ?? 0) - (wp?.w ?? 0) / 2) / GRID)) < 1e-6);

const shrunken = resizeItem(place(blankSpec(), "building", 0, 0, { bw: 12, bd: 10 }), { kind: "building", i: 0 }, "e", -6, 0);
check("resize can shrink to one block", (shrunken.buildings?.[0]?.w ?? 0) === GRID, `w=${shrunken.buildings?.[0]?.w}`);

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
check("unselected building body is a grab, not a resize", ptr.type === "item" && ptr.item.kind === "building");
const southKnob = pickStudioHit(sized, 0, -5, [{ kind: "building", i: 0 }]);
check(
  "selected south knob resizes",
  southKnob.type === "resize" && southKnob.handle.includes("s"),
  `hit=${southKnob.type}`,
);

const aligned = snapRect(0.2, 0.1, 4.2, 3.3);
check("drag width is a whole number of cells", Math.abs(aligned.w / GRID - Math.round(aligned.w / GRID)) < 1e-6);
check("drag depth is a whole number of cells", Math.abs(aligned.d / GRID - Math.round(aligned.d / GRID)) < 1e-6);

let inside = place(blankSpec(), "building", 0, 0, { bw: 16, bd: 12 });
inside = placeBuildingRect(inside, -3, 0, 3, 0.1, "wall", 0);
const inner = inside.partitions?.[0];
check("interior wall sits on the floor", (inner?.y ?? -1) === 0);
check("interior wall is not on the roof", (inner?.y ?? 9) < surfaceAt(inside, 0, 0) - 1);
check("interior wall is not snapped to an outer face", Math.abs(inner?.z ?? 9) < 1);
check("interiorYAt is ground inside a 1F house", interiorYAt(inside, 0, 0) === 0);

const catalog = seedCatalog(emptyLibrary(blankSpec()), [HARBOR_SPEC, SIDING_SPEC]);
check("siding is in the studio catalog", catalog.docs.some((d) => d.id === "siding"));
check("harbor is in the studio catalog", catalog.docs.some((d) => d.id === "harbor"));

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
