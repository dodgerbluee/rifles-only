/**
 * Planting must charge, then the fuse clock has to tick while the Wire is live.
 */
import { createMatch, formatTime, plantedTag, plantWire, tickMatch } from "../src/match.ts";
import { tuning } from "../src/tuning.ts";

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
}

const dummy = {
  living: () => 5,
  inSite: (site: string) => (site === "loft" ? ("loft" as const) : null),
  holdingUse: true,
  actor: { id: 0, team: "ember" as const, x: -9, y: 3.4, z: 20.5, alive: true },
  spawnPlant: { x: 0, y: 0, z: 0 },
};

const match = createMatch({ claimLocal: true });
match.phase = "live";
match.timeLeft = 90;
match.wire.mode = "carried";
match.wire.carrierId = 0;

tickMatch(match, 0.5, dummy);
check("holding plant charges the wire", match.wire.plantHold > 0.4, `hold=${match.wire.plantHold.toFixed(2)}`);

tickMatch(match, tuning.plant, dummy);
check("finished plant goes live", match.phase === "planted", `phase=${match.phase}`);
check("fuse starts at the full timer", Math.abs(match.bombTime - tuning.fuse) < 0.05, `bomb=${match.bombTime}`);

const tag = plantedTag(match);
check("planted tag is the fuse without a site name", tag.includes(formatTime(match.bombTime)) && !/Ice|Slip/.test(tag), `tag=${tag}`);

const before = match.bombTime;
tickMatch(match, 1.25, { ...dummy, holdingUse: false });
check("fuse ticks down while planted", match.bombTime < before - 1, `bomb=${match.bombTime.toFixed(2)}`);
check("clock text is a countdown", formatTime(match.bombTime).includes(":"));

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\nplant charges and the fuse clock ticks");
