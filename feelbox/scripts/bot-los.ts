/**
 * Bot sight used to stop 0.4m short and skip walk boxes, so cover next to you
 * did not block. They also fired at your exact point, not along their look.
 */
import * as THREE from "three";
import { hasLos, type Aabb } from "../src/trace.ts";

const wall: Aabb = {
  min: new THREE.Vector3(-2, 0, -5.2),
  max: new THREE.Vector3(2, 3, -4.8),
  walk: false,
  shot: true,
};
const hugCover: Aabb = {
  min: new THREE.Vector3(-1, 0, -8.35),
  max: new THREE.Vector3(1, 2.2, -8.15),
  walk: false,
  shot: true,
};

function oldHasLos(x0, y0, z0, x1, y1, z1, colliders) {
  const origin = new THREE.Vector3(x0, y0, z0);
  const dest = new THREE.Vector3(x1, y1, z1);
  const dir = dest.clone().sub(origin);
  const dist = dir.length();
  if (dist < 0.2) return true;
  dir.multiplyScalar(1 / dist);
  let best = dist - 0.4;
  const skipFloors = true;
  for (const b of colliders) {
    if (b.shot === false) continue;
    if (skipFloors && b.walk && b.max.y - b.min.y < 0.35 && b.max.y < origin.y - 0.4) continue;
    const invX = dir.x !== 0 ? 1 / dir.x : 1e12;
    const invY = dir.y !== 0 ? 1 / dir.y : 1e12;
    const invZ = dir.z !== 0 ? 1 / dir.z : 1e12;
    const tx1 = (b.min.x - origin.x) * invX;
    const tx2 = (b.max.x - origin.x) * invX;
    const ty1 = (b.min.y - origin.y) * invY;
    const ty2 = (b.max.y - origin.y) * invY;
    const tz1 = (b.min.z - origin.z) * invZ;
    const tz2 = (b.max.z - origin.z) * invZ;
    const tmin = Math.max(Math.min(tx1, tx2), Math.min(ty1, ty2), Math.min(tz1, tz2));
    const tmax = Math.min(Math.max(tx1, tx2), Math.max(ty1, ty2), Math.max(tz1, tz2));
    if (tmax < 0 || tmin > tmax || tmin > best || tmin < 0.04) continue;
    return false;
  }
  return true;
}

let failed = 0;
function check(name, ok) {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}`);
}

check("wall between bots blocks new LOS", !hasLos(0, 1.5, 0, 0, 1.5, -10, [wall]));
check("open air is visible", hasLos(0, 1.5, 0, 0, 1.5, -3, [wall]));

const hug = [hugCover];
check("cover 0.2m in front of you blocks new LOS", !hasLos(0, 1.5, 0, 0, 1.0, -8.45, hug));
check("old LOS punched through that cover", oldHasLos(0, 1.5, 0, 0, 1.0, -8.45, hug));

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\nbots cannot see through walls or the crate you are hugging");
