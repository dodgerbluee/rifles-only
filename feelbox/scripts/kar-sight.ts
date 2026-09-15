/**
 * Kar98k keeps a simple open rear U and front post; Scoped Kar uses 2D glass.
 */
import * as THREE from "three";
import { makeKar98, makeKar98Scoped, makeWorldKar, RIFLES } from "../src/weapons.ts";

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
const scoped = makeKar98Scoped();
const ironOcular = findFlag(iron.root, "karOcular");
const scopedOcular = findFlag(scoped.root, "karOcular");
const ironRear = findFlag(iron.root, "karIronRear");

check("iron Kar has no scope ocular", !ironOcular);
check("scoped Kar keeps the tube ocular", !!scopedOcular);
check("ocular is a torus on the ZF tube", scopedOcular instanceof THREE.Mesh && scopedOcular.geometry.type === "TorusGeometry");
check("scoped ocular is a direct child", !!scopedOcular && scoped.root.children.includes(scopedOcular));
check("iron ADS is centered", Math.abs(iron.adsPos.x) < 1e-6);
check("iron ADS sits on the barrel height", iron.adsPos.y < -0.03 && iron.adsPos.y > -0.07, `y=${iron.adsPos.y}`);
check("iron ADS sits behind the barrel face", iron.adsPos.z < -0.06, `z=${iron.adsPos.z}`);
check("iron Kar is not glass", RIFLES.kar.glass === false);
check("Kar98k Scoped is glass", RIFLES.karscope.glass === true);
check("iron zooms less than scoped", RIFLES.kar.adsFov > RIFLES.karscope.adsFov);
check("names split", RIFLES.kar.name === "Kar98k" && RIFLES.karscope.name === "Kar98k Scoped");
check("scoped ADS sits behind the ocular", scoped.adsPos.z < -0.12, `z=${scoped.adsPos.z}`);
check("scoped ADS is centered on X", Math.abs(scoped.adsPos.x) < 1e-6);
check("scoped ADS sits on the tube height", scopedOcular ? Math.abs(scoped.adsPos.y + scopedOcular.position.y) < 1e-6 : false, `y=${scoped.adsPos.y}`);
check("scoped has no wrap grips", !scoped.adsGrip);
check("iron ADS uses the standard rifle pose", !iron.adsGrip);
check("iron uses the integrated rear leaf", !!ironRear);
check("iron has the option-3 aiming bar", !!findFlag(iron.root, "karPoiBar"));
check("scoped has no iron aiming bar", !findFlag(scoped.root, "karPoiBar"));
const ironFore = findFlag(iron.root, "karIronForeU");
check("iron has a square boxy U", !!ironFore);
check("scoped has no iron fore U", !findFlag(scoped.root, "karIronForeU"));
{
  const mesh = ironRear as THREE.Mesh;
  mesh.geometry.computeBoundingBox();
  const minY = mesh.geometry.boundingBox!.min.y;
  check("iron rear sinks into the receiver", minY < -0.004, `minY=${minY}`);
  const maxY = mesh.geometry.boundingBox!.max.y;
  check("iron U is 35% shorter", maxY > 0.008 && maxY < 0.012, `maxY=${maxY}`);
  const notchW = Number(mesh.userData.karIronNotchW);
  const bar = findFlag(iron.root, "karPoiBar") as THREE.Mesh;
  bar.geometry.computeBoundingBox();
  const barW = bar.geometry.boundingBox!.max.x - bar.geometry.boundingBox!.min.x;
  const barH = bar.geometry.boundingBox!.max.y - bar.geometry.boundingBox!.min.y;
  check("iron U cutout is 2× the aiming rectangle on each side", notchW >= barW + 2 * (2 * barW) - 1e-9, `notchW=${notchW} barW=${barW}`);
  check("iron U top is wider than the bottom cutout", Number(mesh.userData.karIronTopW) > notchW + 1e-6, `topW=${mesh.userData.karIronTopW} botW=${notchW}`);
  check("iron aiming bar is 35% shorter", barH > 0.0055 && barH < 0.008, `barH=${barH}`);
}
if (ironFore && ironFore instanceof THREE.Mesh && ironRear) {
  ironFore.geometry.computeBoundingBox();
  const foreBox = ironFore.geometry.boundingBox!;
  const rearMesh = ironRear as THREE.Mesh;
  rearMesh.geometry.computeBoundingBox();
  const rearBox = rearMesh.geometry.boundingBox!;
  check("boxy U black is outside the rounded U", foreBox.max.x - foreBox.min.x > rearBox.max.x - rearBox.min.x, `foreW=${foreBox.max.x - foreBox.min.x} rearW=${rearBox.max.x - rearBox.min.x}`);
  check("boxy U is closer to the eye than the rounded U", ironFore.position.z > ironRear.position.z, `roundZ=${ironRear.position.z} boxyZ=${ironFore.position.z}`);
  const roundDepth = Number(rearMesh.userData.karIronDepth);
  const boxyDepth = Number(ironFore.userData.karIronDepth);
  const boxyEye = ironFore.position.z + boxyDepth / 2;
  const boxyMuzzle = ironFore.position.z - boxyDepth / 2;
  const roundFront = ironRear.position.z - roundDepth / 2;
  const roundBack = ironRear.position.z + roundDepth / 2;
  check("boxy U starts inside the rounded U", boxyMuzzle > roundFront && boxyMuzzle < roundBack, `boxyMuzzle=${boxyMuzzle} roundFront=${roundFront} roundBack=${roundBack}`);
  check("boxy U finishes outside the rounded U", boxyEye - roundBack >= 0.018, `stickOut=${boxyEye - roundBack}`);
  check("boxy U is taller than the rounded U", foreBox.max.y > rearBox.max.y, `boxyH=${foreBox.max.y} roundH=${rearBox.max.y}`);
}

let ironFacets = 0;
iron.root.traverse((c) => {
  const mesh = c as THREE.Mesh;
  if (!mesh.isMesh) return;
  const geo = mesh.geometry as THREE.CylinderGeometry;
  if (geo.type === "CylinderGeometry" && (geo.parameters.radialSegments ?? 0) <= 8) ironFacets += 1;
});
check("iron barrel is faceted 8-sided metal", ironFacets >= 1, `cyls=${ironFacets}`);

let scopedPipes = 0;
scoped.root.traverse((c) => {
  const mesh = c as THREE.Mesh;
  if (!mesh.isMesh) return;
  const geo = mesh.geometry as THREE.CylinderGeometry;
  if (geo.type === "CylinderGeometry" && geo.parameters.openEnded) scopedPipes += 1;
});
check("scoped tube is solid, not an ADS cup", scopedPipes === 0, `pipes=${scopedPipes}`);

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
console.log("\niron Kar uses a U-and-post sight; scoped stays the glass gun");
