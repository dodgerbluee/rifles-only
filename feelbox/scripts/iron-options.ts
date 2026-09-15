import { makeKar98 } from "../src/weapons.ts";
import * as THREE from "three";

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
}

function findFlag(root: THREE.Object3D, key: string) {
  let found: THREE.Object3D | undefined;
  root.traverse((c) => {
    if (!found && c.userData[key]) found = c;
  });
  return found;
}

const iron = makeKar98();
const rear = findFlag(iron.root, "karIronRear");
const bar = findFlag(iron.root, "karPoiBar");
const stockY = -0.052;
const stockZ = -0.15;

check("ADS x unchanged", Math.abs(iron.adsPos.x) < 1e-9);
check("ADS y unchanged", Math.abs(iron.adsPos.y - stockY) < 1e-9, `y=${iron.adsPos.y}`);
check("ADS z unchanged", Math.abs(iron.adsPos.z - stockZ) < 1e-9, `z=${iron.adsPos.z}`);
check("no extra pitch", iron.adsPitch == null || iron.adsPitch === 0);
check("no wrap grips", !iron.adsGrip);
check("has sunk rear leaf", !!rear);
check("has option-3 aiming bar", !!bar);
if (rear && rear instanceof THREE.Mesh) {
  rear.geometry.computeBoundingBox();
  const box = rear.geometry.boundingBox!;
  check("rear is smaller than the old plate", box.max.x - box.min.x < 0.04, `w=${box.max.x - box.min.x}`);
  check("rear sinks below the receiver top", box.min.y < -0.004, `minY=${box.min.y}`);
  check("U is half as tall", box.max.y < 0.011, `maxY=${box.max.y}`);
}
if (bar && bar instanceof THREE.Mesh && rear) {
  bar.geometry.computeBoundingBox();
  const barBox = bar.geometry.boundingBox!;
  const barW = barBox.max.x - barBox.min.x;
  const barH = barBox.max.y - barBox.min.y;
  const notchW = Number(rear.userData.karIronNotchW);
  check("U cutout is 2× the aiming rectangle on each side", notchW >= barW + 2 * (2 * barW) - 1e-9, `notchW=${notchW} barW=${barW}`);
  check("aiming bar is half as tall", barH < 0.007, `barH=${barH}`);
}

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\niron Kar keeps the live ADS pose; U is smaller and sunk into the receiver");
