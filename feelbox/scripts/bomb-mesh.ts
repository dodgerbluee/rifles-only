/**
 * Bomb mesh is a satchel (not a crate), and planted copy says Bomb live.
 */
import { makeBomb } from "../src/bomb.ts";
import { createMatch, formatTime, plantedTag, plantWire } from "../src/match.ts";
import { killWayLabel } from "../src/net.ts";

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
}

const bomb = makeBomb();
check("bomb root is a group, not a box", bomb.root.type === "Group" && bomb.root.children.length >= 12, `kids=${bomb.root.children.length}`);
check("named bomb", bomb.root.name === "bomb");

const canvas = bomb.root.children[0] as { material?: { emissiveIntensity?: number } };
const before = canvas.material?.emissiveIntensity ?? -1;
bomb.pulse(0.25, "planted");
const planted = canvas.material?.emissiveIntensity ?? -1;
bomb.pulse(0.25, "carried");
const carried = canvas.material?.emissiveIntensity ?? -1;
check("planted pulse lights the pack", planted > before && planted > 0, `planted=${planted.toFixed(2)}`);
check("carried pack is dark", carried === 0, `carried=${carried}`);

const match = createMatch({ claimLocal: true });
match.phase = "live";
plantWire(match, "loft", -9, 3.4, 20.5);
const tag = plantedTag(match);
check("planted tag says Bomb live", tag.startsWith("Bomb live") && tag.includes(formatTime(match.bombTime)), `tag=${tag}`);
check("kill feed says bomb", killWayLabel("bomb") === "bomb");

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\nbomb mesh pulses and copy says Bomb");
