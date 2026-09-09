/**
 * Ember/Stone spawns on Wharf used to be walled boxes with a slit, so bots
 * walked into brick. They should be able to walk out, and still not see
 * through a wall.
 */
import * as THREE from "three";
import { createBots, updateBots } from "../src/bots.ts";
import { buildMap } from "../src/maps/index.ts";
import { createMatch } from "../src/match.ts";
import { collideXZ, hasLos } from "../src/world.ts";

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
}

const scene = new THREE.Scene();
const world = buildMap(scene, "wharf");
const R = 0.32;

function walk(x: number, z: number, dx: number, dz: number, steps: number) {
  let px = x;
  let pz = z;
  const len = Math.hypot(dx, dz) || 1;
  const sx = (dx / len) * 0.35;
  const sz = (dz / len) * 0.35;
  for (let i = 0; i < steps; i++) {
    const n = collideXZ(world.colliders, px + sx, pz + sz, R, 0.08, 1.7);
    if (Math.hypot(n.x - px, n.z - pz) < 0.04) break;
    px = n.x;
    pz = n.z;
  }
  return { x: px, z: pz };
}

const east = walk(-38, 8, 1, 0, 50);
check("ember spawn walks east into the yard", east.x > -28, `x=${east.x.toFixed(2)}`);

const westStreet = walk(38, 4, -1, 0, 50);
check("stone spawn walks west down the quay", westStreet.x < 26, `x=${westStreet.x.toFixed(2)}`);

const westDoor = walk(38, 11, -1, 0, 50);
check("boat shed east door is walkable", westDoor.x < 27, `x=${westDoor.x.toFixed(2)}`);

const wall: { min: THREE.Vector3; max: THREE.Vector3; walk?: boolean; shot?: boolean } = {
  min: new THREE.Vector3(-1, 0, -4.2),
  max: new THREE.Vector3(1, 3, -3.8),
  shot: true,
};
check("a wall still blocks sight", !hasLos(0, 1.5, 0, 0, 1.5, -8, [wall]));

const match = createMatch({ claimLocal: false });
match.phase = "live";
const bots = createBots(scene, world, match);
let t = 3;
for (let i = 0; i < 210; i++) {
  t += 1 / 30;
  updateBots(
    bots,
    1 / 30,
    t,
    world.colliders,
    world,
    match,
    [],
    false,
    () => {},
    () => false,
    [],
  );
}

const ember = bots.filter((b) => b.team === "ember" && b.hp > 0);
const stone = bots.filter((b) => b.team === "stone" && b.hp > 0);
const emberOut = ember.filter((b) => b.x > -32).length;
const stoneOut = stone.filter((b) => b.x < 32).length;
check(
  "ember bots leave the west dock",
  emberOut >= Math.max(1, ember.length - 1),
  `out=${emberOut}/${ember.length}`,
);
check(
  "stone bots leave the east dock",
  stoneOut >= Math.max(1, stone.length - 1),
  `out=${stoneOut}/${stone.length}`,
);

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\nwharf spawns are open and bots can leave without wallhacks");
