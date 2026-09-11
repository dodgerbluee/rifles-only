/**
 * Iron Kar has no glass. Scoped Kar keeps the CoD1 tube and overlay.
 */
import { makeKar98, makeKar98Scoped, RIFLES } from "../src/weapons.ts";

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
}

const iron = makeKar98();
const scoped = makeKar98Scoped();
const ironOcular = iron.root.children.find((c) => c.userData.karOcular);
const scopedOcular = scoped.root.children.find((c) => c.userData.karOcular);

check("iron Kar has no scope ocular", !ironOcular);
check("scoped Kar keeps the tube ocular", !!scopedOcular);
check("iron ADS is centered", Math.abs(iron.adsPos.x) < 1e-6);
check("iron ADS sits behind the U", iron.adsPos.z < -0.14, `z=${iron.adsPos.z}`);
check("iron Kar is not glass", RIFLES.kar.glass === false);
check("Kar98k Scoped is glass", RIFLES.karscope.glass === true);
check("iron zooms less than scoped", RIFLES.kar.adsFov > RIFLES.karscope.adsFov);
check("names split", RIFLES.kar.name === "Kar98k" && RIFLES.karscope.name === "Kar98k Scoped");

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\niron Kar is the CoD1 rifle; scoped stays the glass gun");
