import { IRON_OPTION_META, makeIronPreview, type IronOptionId } from "../src/iron-sight-options.ts";
import { makeKar98 } from "../src/weapons.ts";

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
}

const stock = makeKar98();
const current = makeIronPreview("current");

check("ten options listed", IRON_OPTION_META.length === 10);
check("ids 1-10", IRON_OPTION_META.every((m, i) => m.id === i + 1));
check("current matches live iron ADS x", Math.abs(current.adsPos.x - stock.adsPos.x) < 1e-9);
check("current matches live iron ADS y", Math.abs(current.adsPos.y - stock.adsPos.y) < 1e-9);
check("current matches live iron ADS z", Math.abs(current.adsPos.z - stock.adsPos.z) < 1e-9);
check("current has no extra pitch", current.adsPitch === 0);

for (const m of IRON_OPTION_META) {
  const p = makeIronPreview(m.id as IronOptionId);
  check(`option ${m.id} builds`, p.root.children.length > 0, `parts=${p.root.children.length}`);
  check(`option ${m.id} keeps ADS x`, Math.abs(p.adsPos.x - stock.adsPos.x) < 1e-9);
  check(`option ${m.id} keeps ADS y`, Math.abs(p.adsPos.y - stock.adsPos.y) < 1e-9, `y=${p.adsPos.y}`);
  check(`option ${m.id} keeps ADS z`, Math.abs(p.adsPos.z - stock.adsPos.z) < 1e-9, `z=${p.adsPos.z}`);
  check(`option ${m.id} has no extra pitch`, p.adsPitch === 0);
}

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\n10 sight-only options keep the live iron ADS pose");
