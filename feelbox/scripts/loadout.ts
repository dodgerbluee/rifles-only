import { parseLoadout, secondaryChoices, hudWeaponLine, bindKeys, DEFAULT_LOADOUT } from "../src/loadout.ts";

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
}

check("empty parse is Kar + knife", parseLoadout(undefined).primary === "kar" && parseLoadout(undefined).secondary === "knife");
const same = parseLoadout({ primary: "mosin", secondary: "mosin" });
check("primary cannot equal secondary", same.primary === "mosin" && same.secondary === "knife");
check("karscope is a legal primary", parseLoadout({ primary: "karscope", secondary: "kar" }).primary === "karscope");
const secs = secondaryChoices("kar");
check("Kar secondary omits Kar", !secs.includes("kar") && secs.includes("karscope") && secs.includes("mosin") && secs.includes("knife"));
const line = hudWeaponLine({ primary: "kar", secondary: "karscope" }, "smoke", { smoke: 1, frag: 1, stun: 1, flash: 1 });
check("HUD lists both rifles and knife", line.includes("1 KAR") && line.includes("2 KAR 4X") && line.includes("3 KNIFE"));
const knifeLine = hudWeaponLine(DEFAULT_LOADOUT, "frag", { smoke: 1, frag: 2, stun: 0, flash: 0 });
check("knife secondary drops the 3 slot", knifeLine.includes("2 KNIFE") && !knifeLine.includes("3 KNIFE"));
const keys = bindKeys({ primary: "mosin", secondary: "karscope" });
check("1/2/3 bind primary, secondary, knife", keys.digit1 === "mosin" && keys.digit2 === "karscope" && keys.digit3 === "knife");

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\nloadout keeps primary and secondary from colliding");
