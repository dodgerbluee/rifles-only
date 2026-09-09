/**
 * Radar chevron must follow the east-up projection: +X is up, +Z is left.
 */
import { radarLook, worldToRadar } from "../src/radar.ts";

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
}

const bounds = { minX: -44.5, maxX: 44.5, minZ: -24.5, maxZ: 32.5 };
const a = worldToRadar(10, 0, bounds, 220, 176);
const b = worldToRadar(-10, 0, bounds, 220, 176);
const c = worldToRadar(0, 10, bounds, 220, 176);
const d = worldToRadar(0, -10, bounds, 220, 176);
check("world +X is toward the top of the radar", a.y < b.y);
check("world +Z is toward the left of the radar", c.x < d.x);

const east = radarLook(-Math.PI / 2);
check("looking +X points up the radar", east.y < -0.9 && Math.abs(east.x) < 0.1, `look=${east.x.toFixed(2)},${east.y.toFixed(2)}`);

const north = radarLook(Math.PI);
check("looking +Z points left on the radar", north.x < -0.9 && Math.abs(north.y) < 0.1, `look=${north.x.toFixed(2)},${north.y.toFixed(2)}`);

const south = radarLook(0);
check("looking -Z points right on the radar", south.x > 0.9 && Math.abs(south.y) < 0.1, `look=${south.x.toFixed(2)},${south.y.toFixed(2)}`);

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\nradar chevron follows the east-up map");
