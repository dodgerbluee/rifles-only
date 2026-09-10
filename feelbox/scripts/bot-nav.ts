/**
 * Bots must walk around walls, not seek the far side through them.
 */
import * as THREE from "three";
import { clearWalk, walkPath } from "../src/nav.ts";
import type { Aabb } from "../src/world.ts";

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
}

const floor: Aabb = {
  min: new THREE.Vector3(-18, -0.12, -18),
  max: new THREE.Vector3(18, 0, 18),
  walk: true,
};
const wall: Aabb = {
  min: new THREE.Vector3(-7, 0, -0.45),
  max: new THREE.Vector3(7, 3.2, 0.45),
};
const bounds = { minX: -18, maxX: 18, minZ: -18, maxZ: 18 };
const colliders = [floor, wall];
const from = new THREE.Vector3(0, 0, -8);
const to = new THREE.Vector3(0, 0, 8);

check("straight line through the wall is blocked", !clearWalk(colliders, from.x, from.z, from.y, to.x, to.z));

const path = walkPath(colliders, bounds, from, to);
check("a path around the wall exists", !!path && path.length >= 3, `n=${path?.length ?? 0}`);

const swungWide = (path ?? []).some((p) => Math.abs(p.x) > 7.1);
check("the path goes around the wall, not through it", swungWide, path ? `maxX=${Math.max(...path.map((p) => Math.abs(p.x))).toFixed(1)}` : "no path");

let okHops = true;
if (path) {
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    if (!clearWalk(colliders, a.x, a.z, a.y, b.x, b.z)) okHops = false;
  }
}
check("every hop on that path is walkable", okHops);

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\nbots walk around walls");
