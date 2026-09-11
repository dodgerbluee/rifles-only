/**
 * Best-play must hold for the recap, and thrown nades must show up in snapshots.
 */
import { createSim } from "../src/sim.ts";
import { BESTPLAY_HOLD, claimSlot, createMatch, tickMatch, trySkipBestPlay } from "../src/match.ts";
import {
  FAST_RATE,
  PLAY_RATE,
  TAPE_MIN_DT,
  createTape,
  pushFrame,
  recapWindow,
  reelDrivesBotMeshes,
  reelWorldPawnVisible,
  samplePoses,
  type Pose,
} from "../src/replay.ts";

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
claimSlot(match, "ember", "Reed");
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
claimSlot(skipped, "ember", "Reed");
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

const youId = 3;
const botId = 8;
check("offline recap drives bot meshes", reelDrivesBotMeshes("offline"));
check("host recap drives bot meshes", reelDrivesBotMeshes("host"));
check("dedicated client uses client pawns, not leftover bots", !reelDrivesBotMeshes("client"));
check("bot MVP hides its world pawn/rifle", !reelWorldPawnVisible(botId, botId));
check("other pawns stay visible while watching a bot", reelWorldPawnVisible(youId, botId));
check("human MVP still hides only the subject", !reelWorldPawnVisible(youId, youId) && reelWorldPawnVisible(botId, youId));

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

function poseAt(id: number, x: number): Pose {
  return {
    id,
    x,
    y: 0,
    z: 0,
    yaw: 0,
    pitch: 0,
    eye: 1.64,
    alive: true,
    weapon: "kar",
    ads: false,
    bash: 0,
    fov: 90,
    kick: 0,
    punchP: 0,
    punchY: 0,
    flash: false,
  };
}

const hz60 = 1 / 60;
check("tape min gap is under a 60 Hz tick", TAPE_MIN_DT < hz60, `min=${TAPE_MIN_DT} tick=${hz60}`);
check("FAST_RATE is 10× playback, not a tick rate", FAST_RATE === 10);

const tape60 = createTape();
for (let i = 0; i < 120; i++) pushFrame(tape60, i * hz60, [poseAt(1, i * hz60)]);
check("60 Hz tape keeps more than one frame", tape60.frames.length > 100, `frames=${tape60.frames.length}`);
const recap60 = recapWindow(tape60);
check("60 Hz tape still has a recap window", !!recap60);
const mid = samplePoses(tape60, 0.5).get(1);
check("recap pawns interpolate between 60 Hz poses", !!mid && mid.x > 0.4 && mid.x < 0.6, `x=${mid?.x}`);

if (recap60) {
  let playT = recap60.start;
  let steps = 0;
  while (playT < recap60.end - 1e-9 && steps < 20_000) {
    playT += hz60 * PLAY_RATE;
    steps += 1;
  }
  const wall = steps * hz60;
  const span = recap60.end - recap60.start;
  check("60 Hz recap plays at 1×, not 30/60 fast-forward", Math.abs(wall - span) < 0.08, `wall=${wall.toFixed(3)} span=${span.toFixed(3)}`);
}

const tape30 = createTape();
for (let i = 0; i < 60; i++) pushFrame(tape30, i / 30, [poseAt(1, i / 30)]);
const recap30 = recapWindow(tape30);
check("30 Hz tape recap span matches 60 Hz", !!recap30 && !!recap60 && Math.abs(recap30.end - recap30.start - ((recap60.end - recap60.start))) < 0.05);

let skipT = 0;
let skipWall = 0;
while (skipT < 4 && skipWall < 20) {
  skipT += hz60 * FAST_RATE;
  skipWall += hz60;
}
check("FAST_RATE skip is 10× wall time", Math.abs(skipWall - 4 / FAST_RATE) < 0.05, `wall=${skipWall.toFixed(3)}`);

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\nrecap holds and nades replicate");
