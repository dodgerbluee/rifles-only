/**
 * Dedicated-server headshots never called popHead. Client pawns are Groups,
 * not Bot objects, so lethal head hits have to hide userData.part === "head"
 * and the snapshot has to carry the victim id.
 */
import * as THREE from "three";
import { popPawnHead, restorePawnHead } from "../src/bots.ts";
import { pawnHitMeshes } from "../src/combat.ts";
import { buildPawn } from "../src/pawn.ts";
import { watchLabel } from "../src/replay.ts";
import { createSim } from "../src/sim.ts";

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
}

check("watching yourself is You", watchLabel(3, 3, "Reed") === "You");
check("watching a named rifleman uses their name", watchLabel(7, 3, "Cal") === "Cal");
check("missing name falls back to Rifle", watchLabel(7, 3, "  ") === "Rifle");

const scene = new THREE.Scene();
const root = new THREE.Group();
const fig = buildPawn(root, "stone", 7);
root.position.set(0, 0, -8);
root.updateMatrixWorld(true);
scene.add(root);

const origin = new THREE.Vector3(0, 1.64, 0);
const dir = new THREE.Vector3(0, 0, -1);
const hit = new THREE.Raycaster(origin, dir).intersectObjects(pawnHitMeshes(root), false)[0];
check("horizontal rifle shot at head height hits the head", hit?.object.userData.part === "head");
check("head mesh names the pawn", hit?.object.userData.botId === 7);

const popped = popPawnHead(root, scene);
check("first pop hides the head", popped && !fig.head.visible && !fig.helm.visible);
check("gore bits spawn in the scene", scene.children.some((c) => c !== root));
check("second pop does not double", popPawnHead(root, scene) === false);

restorePawnHead(root);
check("restore brings the head back", fig.head.visible && fig.helm.visible);
check("restore allows another pop", popPawnHead(root, scene) === true);

const sim = createSim({ name: "Last Wire" });
sim.join(1, "Reed");
for (let i = 0; i < 4; i++) sim.tick(1 / 30);
const snap = sim.snapshot();
check("snapshot carries head pop ids", Array.isArray(snap.headPops), `headPops=${snap.headPops}`);

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\nhead pops hide the skull and replicate on the snapshot");
