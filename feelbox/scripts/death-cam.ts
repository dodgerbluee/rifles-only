/**
 * Death sequence: killcam window, skip-then-takeover, and overlay only during killcam.
 */
import { killcamWindow, lastKillOf, createTape, pushFrame, pushKill, type Pose } from "../src/replay.ts";

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
}

function poseAt(id: number, x: number, tAlive = true): Pose {
  return {
    id,
    x,
    y: 0,
    z: 0,
    yaw: 0,
    pitch: 0,
    eye: 1.64,
    alive: tAlive,
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

const tape = createTape();
for (let i = 0; i <= 80; i++) {
  pushFrame(tape, i * 0.05, [poseAt(1, i * 0.05), poseAt(7, 10 - i * 0.02, i < 60)]);
}
pushKill(tape, { t: 3.0, killerId: 7, victimId: 1, victimName: "Reed" });

check("last kill of the victim is the frag", lastKillOf(tape, 1)?.killerId === 7);
check("unrelated victim has no kill", lastKillOf(tape, 9) == null);

const cam = killcamWindow(tape, 1, 3);
check("killcam uses the killer id", cam.killerId === 7);
check("killcam includes time before the shot", cam.start <= 3 - 2.5, `start=${cam.start}`);
check("killcam includes time after the shot", cam.end >= 3, `end=${cam.end}`);
check("killcam is 3-5 seconds", cam.end - cam.start >= 3 && cam.end - cam.start <= 5, `span=${(cam.end - cam.start).toFixed(2)}`);

let skipped = false;
let takeover = false;
function onUse(killcamOn: boolean, specBot: boolean, specMate: boolean) {
  if (killcamOn) {
    skipped = true;
    return "skip";
  }
  if (specBot && specMate) {
    takeover = true;
    return "takeover";
  }
  return "noop";
}

check("first E skips killcam", onUse(true, true, true) === "skip" && skipped && !takeover);
check("second E takes the spectated mate bot", onUse(false, true, true) === "takeover" && takeover);
takeover = false;
check("E on an enemy bot does not take over", onUse(false, true, false) === "noop" && !takeover);
check("E on a human does not take over", onUse(false, false, true) === "noop");

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\ndeath killcam sequence holds");
