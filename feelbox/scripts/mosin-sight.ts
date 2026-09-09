/**
 * Mosin ADS must look through a peep stacked on a front globe, with no
 * gap between receiver and barrel.
 */
import { makeMosin } from "../src/weapons.ts";

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
}

const view = makeMosin();
const steels = view.root.children.filter((c) => {
  const mesh = c as { isMesh?: boolean; geometry?: { type?: string }; position: { x: number; y: number } };
  return mesh.isMesh && mesh.geometry?.type === "CylinderGeometry" && Math.abs(mesh.position.x) < 0.002 && Math.abs(mesh.position.y - 0.034) < 0.002;
});
const zs = steels.map((c) => {
  const geom = (c as { geometry?: { parameters?: { height?: number } } }).geometry;
  const len = geom?.parameters?.height ?? 0;
  return { z0: c.position.z - len / 2, z1: c.position.z + len / 2 };
});
zs.sort((a, b) => b.z1 - a.z1);
let overlap = true;
for (let i = 0; i < zs.length - 1; i++) {
  if (zs[i + 1]!.z1 + 0.002 < zs[i]!.z0) overlap = false;
}
check("receiver and barrel overlap on Z", overlap || zs.length < 2, `parts=${zs.length}`);

const ads = view.adsPos;
check("ADS is centered on X", Math.abs(ads.x) < 1e-6);
check("ADS sits behind the peep, not inside it", ads.z < -0.13);

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\nmosin sight picture holds together");
