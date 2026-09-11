/**
 * Cut (and Cove/Parish) climbs used to act as XZ walls. Walking onto a tread
 * should lift you.
 */
import * as THREE from "three";
import { buildMap } from "../src/maps/index.ts";
import { collideXZ, groundHeight } from "../src/world.ts";

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
}

const R = 0.32;

function walk3(
  colliders: { min: THREE.Vector3; max: THREE.Vector3; walk?: boolean }[],
  x: number,
  z: number,
  y: number,
  dx: number,
  dz: number,
  steps: number,
) {
  const len = Math.hypot(dx, dz) || 1;
  const sx = (dx / len) * 0.28;
  const sz = (dz / len) * 0.28;
  let peak = y;
  for (let i = 0; i < steps; i++) {
    const n = collideXZ(colliders, x + sx, z + sz, R, y + 0.08, y + 1.7);
    if (Math.hypot(n.x - x, n.z - z) < 0.02) break;
    x = n.x;
    z = n.z;
    y = groundHeight(colliders, x, z, R, y);
    peak = Math.max(peak, y);
  }
  return { x, z, y, peak };
}

const cut = buildMap(new THREE.Scene(), "cut");

const pit = walk3(cut.colliders, -14.2, 4, 0, -1, 0, 48);
check("Cut pit ramp climbs to the terrace", pit.peak >= 3, `y=${pit.peak.toFixed(2)} x=${pit.x.toFixed(1)}`);

const rim = walk3(cut.colliders, -24.2, 8, 3.2, -1, 0, 48);
check("Cut terrace ramp climbs to the rim", rim.peak >= 6, `y=${rim.peak.toFixed(2)} x=${rim.x.toFixed(1)}`);

const north = walk3(cut.colliders, 0, 26, 0, 0, 1, 40);
check("Cut north wall still blocks", north.z < 32, `z=${north.z.toFixed(2)}`);

const cove = buildMap(new THREE.Scene(), "cove");
const dock = walk3(cove.colliders, -15.6, -16.2, 0, 0, 1, 30);
check("Depot dock climb is walkable", dock.peak >= 2.4, `y=${dock.peak.toFixed(2)}`);

const parish = buildMap(new THREE.Scene(), "parish");
const chapel = walk3(parish.colliders, -22.4, -1.5, 0, 1, 0, 30);
check("Parish climb is walkable", chapel.peak >= 2.4, `y=${chapel.peak.toFixed(2)}`);

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\nstairs are walkable");
