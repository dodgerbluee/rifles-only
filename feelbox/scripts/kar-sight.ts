/**
 * Kar ADS is CoD1 glass: tighter zoom, scope on the receiver, aim line through the tube.
 */
import { makeKar98, RIFLES } from "../src/weapons.ts";

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
}

const view = makeKar98();
const ocular = view.root.children.find((c) => c.userData.karOcular);
check("scope ocular sits on the gun", !!ocular);

const ads = view.adsPos;
check("ADS is centered on X", Math.abs(ads.x) < 1e-6);
check("ADS sits on the scope height", ocular ? Math.abs(ads.y + ocular.position.y) < 1e-6 : false, `y=${ads.y}`);
check("ADS sits behind the ocular", ads.z < -0.12, `z=${ads.z}`);

check("Kar zooms tighter than the Mosin peep", RIFLES.kar.adsFov < RIFLES.mosin.adsFov, `kar=${RIFLES.kar.adsFov} mosin=${RIFLES.mosin.adsFov}`);
check("Kar uses CoD1 screen glass", RIFLES.kar.glass === true);
check("Mosin stays a peep, no glass", RIFLES.mosin.glass === false);
check("Kar ADS mouse is slower than Mosin", RIFLES.kar.adsSens < RIFLES.mosin.adsSens);

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\nkar glass is the CoD1 zoom, mosin keeps the peep");
