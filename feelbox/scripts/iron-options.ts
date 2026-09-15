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
const fore = findFlag(iron.root, "karIronForeU");
const stockY = -0.052;
const stockZ = -0.15;

check("ADS x unchanged", Math.abs(iron.adsPos.x) < 1e-9);
check("ADS y unchanged", Math.abs(iron.adsPos.y - stockY) < 1e-9, `y=${iron.adsPos.y}`);
check("ADS z unchanged", Math.abs(iron.adsPos.z - stockZ) < 1e-9, `z=${iron.adsPos.z}`);
check("no extra pitch", iron.adsPitch == null || iron.adsPitch === 0);
check("no wrap grips", !iron.adsGrip);
check("has sunk rear leaf", !!rear);
check("has option-3 aiming bar", !!bar);
check("has square fore U", !!fore);
if (rear && rear instanceof THREE.Mesh) {
  rear.geometry.computeBoundingBox();
  const box = rear.geometry.boundingBox!;
  check("rear is smaller than the old plate", box.max.x - box.min.x < 0.04, `w=${box.max.x - box.min.x}`);
  check("rear sinks below the receiver top", box.min.y < -0.004, `minY=${box.min.y}`);
  check("U is 35% shorter", box.max.y > 0.008 && box.max.y < 0.012, `maxY=${box.max.y}`);
}
if (bar && bar instanceof THREE.Mesh && rear) {
  bar.geometry.computeBoundingBox();
  const barBox = bar.geometry.boundingBox!;
  const barW = barBox.max.x - barBox.min.x;
  const barH = barBox.max.y - barBox.min.y;
  const notchW = Number(rear.userData.karIronNotchW);
  check("U cutout is 2× the aiming rectangle on each side", notchW >= barW + 2 * (2 * barW) - 1e-9, `notchW=${notchW} barW=${barW}`);
  check("U top is wider than the bottom cutout", Number(rear.userData.karIronTopW) > notchW + 1e-6, `topW=${rear.userData.karIronTopW} botW=${notchW}`);
  check("aiming bar is 35% shorter", barH > 0.0055 && barH < 0.008, `barH=${barH}`);
}
if (fore && fore instanceof THREE.Mesh && rear && rear instanceof THREE.Mesh) {
  fore.geometry.computeBoundingBox();
  rear.geometry.computeBoundingBox();
  const foreW = fore.geometry.boundingBox!.max.x - fore.geometry.boundingBox!.min.x;
  check("boxy U sits inside the rounded cutout", foreW < Number(rear.userData.karIronTopW), `foreW=${foreW} cutW=${rear.userData.karIronTopW}`);
  check("boxy U sits in front of the rounded U", fore.position.z < rear.position.z, `roundZ=${rear.position.z} boxyZ=${fore.position.z}`);
  const roundDepth = Number(rear.userData.karIronDepth);
  const boxyDepth = Number(fore.userData.karIronDepth);
  const boxyBack = fore.position.z + boxyDepth / 2;
  const roundFront = rear.position.z - roundDepth / 2;
  check("boxy U is nested inside the rounded U", boxyBack > roundFront, `boxyBack=${boxyBack} roundFront=${roundFront}`);
  check("boxy U is taller than the rounded U", fore.geometry.boundingBox!.max.y > rear.geometry.boundingBox!.max.y, `boxyH=${fore.geometry.boundingBox!.max.y} roundH=${rear.geometry.boundingBox!.max.y}`);
  check("boxy U is 1.5× fatter than the rounded U", boxyDepth >= roundDepth * 1.45, `boxyD=${boxyDepth} roundD=${roundDepth}`);
}

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\niron Kar keeps the live ADS pose; U is smaller and sunk into the receiver");
