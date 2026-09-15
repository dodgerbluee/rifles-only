/**
 * Iron Kar has no glass. Scoped Kar looks into a faceted ZF ocular.
 */
import * as THREE from "three";
import { makeKar98, makeKar98Scoped, makeWorldKar, RIFLES } from "../src/weapons.ts";

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
}

function findOcular(root: THREE.Object3D) {
  let found: THREE.Mesh | undefined;
  root.traverse((c) => {
    if (!found && (c as THREE.Mesh).isMesh && c.userData.karOcular) found = c as THREE.Mesh;
  });
  return found;
}

const iron = makeKar98();
const scoped = makeKar98Scoped();
const ironOcular = findOcular(iron.root);
const scopedOcular = findOcular(scoped.root);

check("iron Kar has no scope ocular", !ironOcular);
check("scoped Kar keeps the tube ocular", !!scopedOcular);
check("iron ADS is centered", Math.abs(iron.adsPos.x) < 1e-6);
check("iron ADS sits behind the U", iron.adsPos.z < -0.14, `z=${iron.adsPos.z}`);
check("iron Kar is not glass", RIFLES.kar.glass === false);
check("Kar98k Scoped is glass", RIFLES.karscope.glass === true);
check("iron zooms less than scoped", RIFLES.kar.adsFov > RIFLES.karscope.adsFov);
check("names split", RIFLES.kar.name === "Kar98k" && RIFLES.karscope.name === "Kar98k Scoped");

const params = scopedOcular?.geometry as THREE.RingGeometry | undefined;
const outer = params?.parameters?.outerRadius ?? 0;
check("ocular is a faceted eyepiece ring", !!params && params.type === "RingGeometry", `type=${params?.type}`);
check("ocular is chunky, not a hairline tube", outer >= 0.024, `outer=${outer}`);
check("ADS sits on the tube height", scopedOcular ? Math.abs(scoped.adsPos.y + scopedOcular.parent!.position.y) < 1e-6 : false, `y=${scoped.adsPos.y}`);
check("ADS sits behind the ocular", scoped.adsPos.z < -0.12, `z=${scoped.adsPos.z}`);
check("scoped ADS is centered on X", Math.abs(scoped.adsPos.x) < 1e-6);
check("scoped ADS has wrap grips", !!scoped.scopeGrip);

let pipes = 0;
scoped.root.traverse((c) => {
  const mesh = c as THREE.Mesh;
  if (!mesh.isMesh) return;
  const geo = mesh.geometry as THREE.CylinderGeometry;
  if (geo.type === "CylinderGeometry" && geo.parameters.openEnded && (geo.parameters.radialSegments ?? 0) <= 8) pipes += 1;
});
check("scope body is an 8-sided open tube", pipes >= 4, `pipes=${pipes}`);

const world = makeWorldKar();
let worldOcular = false;
world.traverse((c) => {
  if (c.userData.karOcular) worldOcular = true;
});
check("world Kar is the iron rifle, not scoped glass", !worldOcular);
check("world Kar is held at the pawn, not the camera hip", world.position.length() < 1e-6);

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\niron Kar is the CoD1 rifle; scoped looks into the ZF ocular");
