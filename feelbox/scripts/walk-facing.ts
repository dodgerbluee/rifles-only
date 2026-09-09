/**
 * Pawns face -Z (rifle and hands). Toes and the leading stride must also go -Z.
 */
import * as THREE from "three";
import { buildPawn, stepWalk } from "../src/pawn.ts";

let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

function boot(hip: THREE.Object3D) {
  let found: THREE.Mesh | undefined;
  hip.traverse((o) => {
    if (o instanceof THREE.Mesh && o.geometry instanceof THREE.BoxGeometry) found = o;
  });
  return found;
}

function wz(obj: THREE.Object3D) {
  const v = new THREE.Vector3();
  obj.getWorldPosition(v);
  return v.z;
}

const root = new THREE.Group();
const parts = buildPawn(root, "ember", 1);
const walk = parts.walk;
if (!walk) {
  console.error("no walk rig");
  process.exit(1);
}
root.updateMatrixWorld(true);

const lBoot = boot(walk.lHip);
const rBoot = boot(walk.rHip);
if (!lBoot || !rBoot) {
  console.error("no boots");
  process.exit(1);
}

check("toes sit in front of the left hip (-Z)", wz(lBoot) < wz(walk.lHip), `boot=${wz(lBoot).toFixed(3)} hip=${wz(walk.lHip).toFixed(3)}`);
check("toes sit in front of the right hip (-Z)", wz(rBoot) < wz(walk.rHip), `boot=${wz(rBoot).toFixed(3)} hip=${wz(walk.rHip).toFixed(3)}`);

root.userData.gait = Math.PI / 2;
stepWalk(root, 0, true);
root.updateMatrixWorld(true);
check(
  "at peak stride, left foot is ahead of right (toward -Z)",
  wz(lBoot) < wz(rBoot),
  `L=${wz(lBoot).toFixed(3)} R=${wz(rBoot).toFixed(3)}`,
);

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\ntoes and stride both face -Z");
