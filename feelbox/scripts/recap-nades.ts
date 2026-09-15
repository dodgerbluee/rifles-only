/**
 * Best-play must hold for the recap, and thrown nades must show up in snapshots.
 */
import { createSim } from "../src/sim.ts";
import { BESTPLAY_HOLD, claimSlot, createMatch, recapHoldFromReel, tickMatch, trySkipBestPlay } from "../src/match.ts";
import {
  FAST_RATE,
  LAST_POST,
  PLAY_RATE,
  POST_SLOW,
  PRE_SLOW,
  TAPE_MIN_DT,
  advancePlayT,
  createTape,
  inSlowWindow,
  killcamWindow,
  lerpTapeWeapon,
  playBounds,
  pushFrame,
  pushKill,
  recapWindow,
  reelDrivesBotMeshes,
  reelWallTime,
  reelWorldPawnVisible,
  samplePoses,
  sampleTape,
  type Pose,
} from "../src/replay.ts";
import { fullNades, nextHeldNade, spendNade, throwProgress } from "../src/smoke.ts";

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

check("reel wall shorter than the 22s fallback ends Best Play with the reel", recapHoldFromReel(8) < 9 && recapHoldFromReel(8) > 8);
check("long reels still cannot exceed the fallback hold", recapHoldFromReel(40) === BESTPLAY_HOLD);
check("empty reel still gets a short hold, not the 22s leftover", recapHoldFromReel(0) <= 2.4);

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
const botGuns = seated.pawns.filter((p) => p.netId === 0);
check(
  "dedicated bot snapshots use the iron Kar, never scoped glass",
  botGuns.length > 0 && botGuns.every((p) => p.weapon === "kar"),
  `weapons=${botGuns.map((p) => p.weapon).join(",")}`,
);
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

const nadeTape = createTape();
pushFrame(nadeTape, 0, [poseAt(1, 0)], { nades: [{ x: 0, y: 1, z: 0, kind: "frag" }], clouds: [] });
pushFrame(nadeTape, 0.2, [poseAt(1, 1)], { nades: [{ x: 4, y: 1, z: 0, kind: "frag" }], clouds: [] });
pushFrame(nadeTape, 0.4, [poseAt(1, 2)], { nades: [], clouds: [{ x: 4, y: 1, z: 0, radius: 3, opacity: 0.8 }] });
const midNade = sampleTape(nadeTape, 0.1).nades[0];
check("tape nades interpolate along the throw", !!midNade && midNade.x > 1.5 && midNade.x < 2.5, `x=${midNade?.x}`);
check("later tape frame drops the airborne nade", sampleTape(nadeTape, 0.4).nades.length === 0);
check("later tape frame keeps the cloud that existed then", sampleTape(nadeTape, 0.4).clouds.length === 1);

const killsTape = createTape();
for (let i = 0; i <= 40; i++) pushFrame(killsTape, i * 0.25, [poseAt(2, i)]);
pushKill(killsTape, { t: 2, killerId: 2, victimId: 3, victimName: "A" });
pushKill(killsTape, { t: 8, killerId: 2, victimId: 4, victimName: "B" });
const clips = [
  { t: 2, killerId: 2, victimId: 3, victimName: "A" },
  { t: 8, killerId: 2, victimId: 4, victimName: "B" },
];
const bounds = playBounds(clips, killsTape);
check("reel hangs past the last kill", bounds.end >= 8 + LAST_POST, `end=${bounds.end} lastPost=${LAST_POST}`);
check("last kill is still in the slow window after old post", inSlowWindow(8 + POST_SLOW + 0.4, clips));
check("gap before the last kill is not slow", !inSlowWindow(5.5, clips));

let playT = 4;
playT = advancePlayT(playT, 0.05, clips);
check("FAST_RATE does not skip into the last kill", playT <= 8 - 1.55 + 1e-9, `playT=${playT}`);
playT = 8 - 1.55 - 0.01;
playT = advancePlayT(playT, 0.05, clips);
check("advance lands on the next kill window instead of jumping over it", Math.abs(playT - (8 - 1.55)) < 1e-6, `playT=${playT}`);

const wall = reelWallTime(clips, killsTape);
check("multi-kill reel wall time covers the last kill hang", wall > LAST_POST + PRE_SLOW, `wall=${wall.toFixed(2)}`);

const cam = killcamWindow(killsTape, 4, 8);
check("killcam follows the killer", cam.killerId === 2);
check("killcam lasts 3-5 seconds", cam.end - cam.start >= 3 && cam.end - cam.start <= 5, `span=${(cam.end - cam.start).toFixed(2)}`);

const bag = fullNades();
check("full bag starts with one frag", bag.frag === 1 && bag.smoke === 2);
spendNade(bag, "frag");
check("spending the last frag would otherwise swap to smoke", nextHeldNade(bag, "frag") === "smoke");
check("killcam still holds the frag until the toss finishes", throwProgress(0.4, 0.4) < 0.02);
check("mid-toss is a real throw pose, not a rest hold", throwProgress(0.2, 0.4) > 0.45 && throwProgress(0.2, 0.4) < 0.55);

const tossTape = createTape();
pushFrame(tossTape, 0, [{ ...poseAt(2, 0), weapon: "frag", throw: 0.2 }]);
pushFrame(tossTape, 0.2, [{ ...poseAt(2, 0.2), weapon: "smoke", throw: 0 }]);
const midToss = sampleTape(tossTape, 0.05).poses.get(2);
check("tape interpolates throw progress", (midToss?.throw ?? 0) > 0.1, `throw=${midToss?.throw}`);
check(
  "killcam keeps the frag during the toss instead of swapping to smoke",
  lerpTapeWeapon(
    { ...poseAt(2, 0), weapon: "frag", throw: 0.35 },
    { ...poseAt(2, 1), weapon: "smoke", throw: 0 },
    0.8,
  ) === "frag",
);

const leftover = createSim({ name: "Last Wire", freezeTime: 0.05, perTeam: 2, botSkill: "easy" });
leftover.join(1, "Reed", "ember");
leftover.join(2, "Pal", "stone");
for (let i = 0; i < 40; i++) leftover.tick(0.05);
check("duo reached live", leftover.snapshot().phase === "live", `phase=${leftover.snapshot().phase}`);
for (const p of leftover.snapshot().pawns) {
  if (p.team === "ember") leftover.slay(p.id);
}
leftover.tick(0.05);
for (let i = 0; i < 120; i++) leftover.tick(0.05);
check("duo entered bestplay", leftover.snapshot().phase === "bestplay", `phase=${leftover.snapshot().phase}`);
leftover.event(1, { kind: "skipRecap" });
leftover.tick(0.05);
check(
  "reel-end skipRecap concludes even with two humans",
  leftover.snapshot().phase !== "bestplay",
  `phase=${leftover.snapshot().phase}`,
);

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\nrecap holds and nades replicate");
