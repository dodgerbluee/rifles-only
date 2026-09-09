/**
 * Client smokes used to copy radius from the snapshot but never posed the
 * puff meshes, so they sat as tiny spheres instead of pluming.
 */
import * as THREE from "three";
import { applyCloudSnap, billowClouds, clearNades } from "../src/smoke.ts";

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
}

const scene = new THREE.Scene();
clearNades(scene);

applyCloudSnap(scene, [{ x: 0, y: 0.2, z: 0, radius: 6.9, opacity: 1 }]);

function puffMeshes() {
  const out: THREE.Mesh[] = [];
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshLambertMaterial && o.material.transparent) {
      out.push(o);
    }
  });
  return out;
}

const first = puffMeshes();
const maxScale = Math.max(0, ...first.map((m) => m.scale.x));
const spread = Math.max(
  0,
  ...first.map((m) => Math.hypot(m.position.x, m.position.y, m.position.z)),
);
check("a snapped cloud has many puffs", first.length >= 12, `n=${first.length}`);
check("puffs scale up with the cloud radius", maxScale > 0.8, `maxScale=${maxScale.toFixed(3)}`);
check("puffs spread off the nade origin", spread > 0.6, `spread=${spread.toFixed(3)}`);

const y0 = first.map((m) => m.position.y);
billowClouds(0.25);
const y1 = puffMeshes().map((m) => m.position.y);
const drifted = y0.some((y, i) => Math.abs(y - (y1[i] ?? y)) > 0.01);
check("puffs keep billowing after the snap", drifted);

clearNades(scene);

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\nclient smokes plume instead of sitting as a blob");
