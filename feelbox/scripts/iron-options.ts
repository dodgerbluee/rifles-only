import { IRON_OPTION_META, makeIronPreview, type IronOptionId } from "../src/iron-sight-options.ts";

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
}

check("ten options listed", IRON_OPTION_META.length === 10);
check("ids 1-10", IRON_OPTION_META.every((m, i) => m.id === i + 1));

const current = makeIronPreview("current");
check("current has a rifle mesh", current.root.children.length > 3);
check("current ADS is centered", Math.abs(current.adsPos.x) < 1e-6);

for (const m of IRON_OPTION_META) {
  const p = makeIronPreview(m.id as IronOptionId);
  check(`option ${m.id} builds`, p.root.children.length > 0, `parts=${p.root.children.length}`);
  check(`option ${m.id} ADS centered`, Math.abs(p.adsPos.x) < 1e-6);
  check(`option ${m.id} sits in front of the eye`, p.adsPos.z < -0.03, `z=${p.adsPos.z}`);
}

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\n10 iron options + current preview build");
