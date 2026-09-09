/**
 * Best-play must hold for the recap, and thrown nades must show up in snapshots.
 */
import { createSim } from "../src/sim.ts";
import { BESTPLAY_HOLD, claimSlot, createMatch, tickMatch, trySkipBestPlay } from "../src/match.ts";

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
}

const dummy = {
  living: () => 5,
  inSite: () => false as const,
  holdingUse: false,
  actor: { id: 0, team: "ember" as const, x: 0, y: 0, z: 0, alive: true },
  spawnPlant: { x: 0, y: 0, z: 0 },
};

const match = createMatch({ claimLocal: false });
match.phase = "settle";
match.endT = 0.01;
tickMatch(match, 0.02, dummy);
check("settle promotes to bestplay", match.phase === "bestplay");
check("bestplay starts a hold", Math.abs(match.endT - BESTPLAY_HOLD) < 0.001, `endT=${match.endT}`);

tickMatch(match, BESTPLAY_HOLD - 0.2, dummy);
check("bestplay still holding near the end", match.phase === "bestplay");

tickMatch(match, 0.4, dummy);
check("bestplay concludes after the hold", match.phase === "ending" || match.phase === "matchover", `phase=${match.phase}`);

const skipped = createMatch({ claimLocal: false });
skipped.phase = "settle";
skipped.endT = 0.01;
tickMatch(skipped, 0.02, { ...dummy, skipRecap: true });
check("skipRecap leaves settle without a recap hold", skipped.phase !== "bestplay", `phase=${skipped.phase}`);

const solo = createMatch({ claimLocal: true });
solo.phase = "bestplay";
solo.endT = BESTPLAY_HOLD;
check("solo skip ends the recap", trySkipBestPlay(solo) && solo.phase === "ending", `phase=${solo.phase}`);

const duo = createMatch({ claimLocal: true });
claimSlot(duo, "stone", "Pal");
duo.phase = "bestplay";
duo.endT = BESTPLAY_HOLD;
check("two humans stay on the recap", !trySkipBestPlay(duo) && duo.phase === "bestplay", `phase=${duo.phase}`);

const sim = createSim({ name: "Last Wire" });
sim.join(1, "Reed");
for (let i = 0; i < 4; i++) sim.tick(1 / 30);
const seated = sim.snapshot();
const me = seated.pawns.find((p) => p.netId === 1);
check("joined pawn exists", !!me);
if (!me) {
  console.error("cannot throw without a seated pawn");
  process.exit(1);
}

sim.event(1, {
  kind: "throwSmoke",
  ox: me.x,
  oy: me.y + 1.5,
  oz: me.z,
  dx: 0.2,
  dy: 0.4,
  dz: 0.8,
  power: 0.8,
  nade: "smoke",
});
sim.tick(1 / 30);
const air = sim.snapshot();
check("thrown smoke is in the snapshot", (air.nades?.length ?? 0) > 0, `nades=${air.nades?.length ?? 0}`);

for (let i = 0; i < 16; i++) sim.tick(1 / 30);
sim.event(1, {
  kind: "throwSmoke",
  ox: me.x + 1,
  oy: me.y + 1.2,
  oz: me.z,
  dx: 0,
  dy: -1,
  dz: 0,
  power: 0,
  nade: "frag",
});
for (let i = 0; i < 45; i++) sim.tick(1 / 30);
const popped = sim.snapshot();
const clouds = popped.clouds?.length ?? 0;
const pops = popped.pops?.length ?? 0;
check(
  "nade pop or smoke cloud reaches the snapshot",
  clouds > 0 || pops > 0,
  `clouds=${clouds} pops=${pops} nades=${popped.nades?.length ?? 0}`,
);

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\nrecap holds and nades replicate");
