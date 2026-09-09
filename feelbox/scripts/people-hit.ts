/**
 * Host rifle fire used to raycast bots only, so a human in front never took a hit.
 */
import * as THREE from "three";
import { pawnHitMeshes, pickBodyVictim, remoteTargets } from "../src/combat.ts";
import { buildPawn } from "../src/pawn.ts";

const origin = new THREE.Vector3(0, 1.64, 0);
const dir = new THREE.Vector3(0, 0, -1);
const remoteBody = { id: 7, team: "stone" as const, x: 0, y: 0, z: -8, alive: true };

let failed = 0;
function check(name: string, ok: boolean) {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}`);
}

const chest = pickBodyVictim(origin, dir, [remoteBody], Infinity, "ember", false);
check("body scan hits the remote in front", chest?.body.id === 7);

const root = new THREE.Group();
buildPawn(root, "stone", 7);
root.position.set(0, 0, -8);
root.updateMatrixWorld(true);

const remoteMeshes = pawnHitMeshes(root);
check("remote pawn has hittable meshes", remoteMeshes.length > 0);

const oldRay = new THREE.Raycaster(origin, dir);
const oldHit = oldRay.intersectObjects([], false)[0];
check("old host scan (bots only) misses that remote", !oldHit);

const targets = remoteTargets([{ alive: true, team: "stone", slotId: 7, root }], "ember", []);
const meshHit = new THREE.Raycaster(origin, dir).intersectObjects(targets, false)[0];
check("mesh scan hits the remote pawn", meshHit?.object.userData.botId === 7);

const sameTeam = pickBodyVictim(origin, dir, [remoteBody], Infinity, "stone", false);
check("friendly fire off skips same team", sameTeam == null);

const walled = pickBodyVictim(origin, dir, [remoteBody], 1, "ember", false);
check("world wall in front blocks the remote", walled == null);

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\nhost fire has to scan remotes, not just bots");
