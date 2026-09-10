/**
 * Planting must charge, then the fuse clock has to tick while the Bomb is live.
 */
import {
  createHoldSound,
  isActivelyCutting,
  stopCutSound,
  tickHoldSound,
} from "../src/holdSound.ts";
import {
  countLiving,
  createMatch,
  formatTime,
  interruptPlant,
  isPlanting,
  markDead,
  plantedTag,
  plantingTeam,
  plantWire,
  roundCombatOpen,
  tickMatch,
  watchingTeam,
} from "../src/match.ts";
import { createSim } from "../src/sim.ts";
import { tuning } from "../src/tuning.ts";

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
}

const dummy = {
  living: () => 5,
  inSite: (site: string, _x?: number, _z?: number, _y?: number) => site === "loft",
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
check(
  "carrier holding F in site is planting",
  isPlanting(match, { id: 0, x: -9, y: 3.4, z: 20.5, holdingUse: true }, dummy.inSite),
);

const shot = createMatch({ claimLocal: true });
shot.phase = "live";
shot.timeLeft = 90;
shot.wire.mode = "carried";
shot.wire.carrierId = 0;
tickMatch(shot, 0.8, dummy);
check("plant was charging before the shot", shot.wire.plantHold > 0.7, `hold=${shot.wire.plantHold.toFixed(2)}`);
tickMatch(shot, 0.02, { ...dummy, actor: { ...dummy.actor, fired: true } });
check("a shot dumps plant progress", shot.wire.plantHold === 0, `hold=${shot.wire.plantHold}`);
check("a shot breaks the plant", shot.plantBreak);
check(
  "broken plant is not planting even while F is held",
  !isPlanting(shot, { id: 0, x: -9, y: 3.4, z: 20.5, holdingUse: true }, dummy.inSite),
);
tickMatch(shot, 0.5, dummy);
check("holding F after a shot does not recharge", shot.wire.plantHold === 0, `hold=${shot.wire.plantHold}`);
tickMatch(shot, 0.02, { ...dummy, holdingUse: false });
check("releasing F clears the plant break", !shot.plantBreak);
tickMatch(shot, 0.5, dummy);
check("re-pressing F starts a new plant", shot.wire.plantHold > 0.4, `hold=${shot.wire.plantHold.toFixed(2)}`);

interruptPlant(shot, 0);
check("interruptPlant zeros the hold", shot.wire.plantHold === 0 && shot.plantBreak);

tickMatch(match, tuning.plant, dummy);
check("finished plant goes live", match.phase === "planted", `phase=${match.phase}`);
check("fuse starts at the full timer", Math.abs(match.bombTime - tuning.fuse) < 0.05, `bomb=${match.bombTime}`);

const tag = plantedTag(match);
check("planted tag says Bomb live", tag.startsWith("Bomb live"), `tag=${tag}`);
check("planted tag is the fuse without a site name", tag.includes(formatTime(match.bombTime)) && !/Ice|Slip/.test(tag), `tag=${tag}`);

const before = match.bombTime;
tickMatch(match, 1.25, { ...dummy, holdingUse: false });
check("fuse ticks down while planted", match.bombTime < before - 1, `bomb=${match.bombTime.toFixed(2)}`);
check("clock text is a countdown", formatTime(match.bombTime).includes(":"));

const cut = createMatch({ claimLocal: true });
cut.phase = "planted";
cut.wire.mode = "planted";
cut.wire.cutHold = tuning.cut;
cut.wire.plantHold = 0.4;
tickMatch(cut, 0.02, { ...dummy, holdingUse: false });
check("cut finish zeros the hold ticks", cut.wire.cutHold === 0 && cut.wire.plantHold === 0, `cut=${cut.wire.cutHold} plant=${cut.wire.plantHold}`);
check("cut finish settles the round", cut.phase === "settle", `phase=${cut.phase}`);
check("settle still allows combat", roundCombatOpen(cut.phase));

const wipe = createMatch({ claimLocal: true });
wipe.phase = "live";
wipe.timeLeft = 90;
plantWire(wipe, "loft", -9, 3.4, 20.5);
const fuseAtPlant = wipe.bombTime;
for (const s of wipe.slots) {
  if (s.team === watchingTeam(wipe)) markDead(wipe, s.id, 0, 0, 0);
}
tickMatch(wipe, 0.05, {
  ...dummy,
  holdingUse: false,
  living: (team) => wipe.slots.filter((s) => s.team === team && s.alive).length,
});
check("plant then wipe watchers ends before the fuse", wipe.phase === "settle", `phase=${wipe.phase}`);
check("planters win when no one can cut", wipe.lastWinner === plantingTeam(wipe), `winner=${wipe.lastWinner}`);
check("fuse did not have to run out", wipe.bombTime > fuseAtPlant - 1, `bomb=${wipe.bombTime}`);

const phantom = createMatch({ claimLocal: true });
phantom.phase = "live";
plantWire(phantom, "well", 10, 0.2, -16);
const watch = watchingTeam(phantom);
const bodies = phantom.slots.map((s) => ({ team: s.team, alive: s.team !== watch }));
tickMatch(phantom, 0.05, {
  ...dummy,
  holdingUse: false,
  living: (team) => countLiving(team, bodies),
});
check("empty watcher bodies end a planted round even if seats look up", phantom.phase === "settle", `phase=${phantom.phase}`);

const grab = createMatch({ claimLocal: true });
grab.phase = "live";
grab.timeLeft = 90;
grab.wire.mode = "ground";
grab.wire.carrierId = null;
grab.wire.x = 4;
grab.wire.y = 0.2;
grab.wire.z = -3;
const grabKeys = { holdingUse: false };
tickMatch(grab, 0.05, {
  ...dummy,
  ...grabKeys,
  actor: { id: 0, team: "ember", x: 4.2, y: 0.2, z: -2.9, alive: true },
});
check("walk-over picks up the grounded wire without F", grab.wire.mode === "carried" && grab.wire.carrierId === 0, `mode=${grab.wire.mode} carrier=${grab.wire.carrierId}`);
check("pickup tick did not hold use", grabKeys.holdingUse === false);

const walk = createSim({ name: "Last Wire", freezeTime: 0.05, perTeam: 1, highlights: false, botSkill: "easy" });
walk.join(1, "Reed", "ember");
for (let i = 0; i < 10; i++) walk.tick(1 / 30);
walk.event(1, { kind: "dropWire" });
const noF = {
  keys: [] as string[],
  yaw: 0,
  pitch: 0,
  fire: false,
  ads: false,
  lean: 0,
  weapon: "kar" as const,
  crouch: false,
  jump: false,
  use: false,
  mx: 0,
  my: 0,
};
walk.setInput(1, noF);
walk.tick(1 / 30);
const taken = walk.snapshot();
const reed = taken.pawns.find((p) => p.netId === 1);
check(
  "sim walk-over picks up without KeyF",
  taken.wire.mode === "carried" && taken.wire.carrierId === reed?.id,
  `mode=${taken.wire.mode} carrier=${taken.wire.carrierId}`,
);
check("sim pickup input has no KeyF", !noF.keys.includes("KeyF") && noF.use === false);

const wireAt = { wx: -9, wy: 3.4, wz: 20.5 };
const cutter = {
  phase: "planted",
  wireMode: "planted",
  holdingUse: true,
  alive: true,
  cutterTeam: "stone",
  watchTeam: "stone",
  x: -9,
  y: 3.4,
  z: 20.5,
  ...wireAt,
};
check("hold-F in range is actively cutting", isActivelyCutting(cutter));
check(
  "leftover cutHold does not count as cutting",
  !isActivelyCutting({ ...cutter, holdingUse: false }),
);
check("release use is not actively cutting", !isActivelyCutting({ ...cutter, holdingUse: false }));
check("walk away is not actively cutting", !isActivelyCutting({ ...cutter, x: 4, z: 0 }));
check("dead is not actively cutting", !isActivelyCutting({ ...cutter, alive: false }));
check("round not planted is not actively cutting", !isActivelyCutting({ ...cutter, phase: "live" }));

const sound = createHoldSound();
let starts = 0;
let ticks = 0;
let stops = 0;
const cues = {
  playCutStart: () => {
    starts += 1;
  },
  playPlantStart: () => {},
  playHoldTick: () => {
    ticks += 1;
  },
  stopCut: () => {
    stops += 1;
  },
};
tickHoldSound(sound, { holdingPlant: false, holdingCut: true, dt: 0.02 }, cues);
check("start cut turns the hold sound on", sound.cutting && sound.plantCue && starts === 1, `starts=${starts}`);
tickHoldSound(sound, { holdingPlant: false, holdingCut: true, dt: 0.3 }, cues);
check("cut hold keeps ticking while held", ticks >= 1 && stops === 0, `ticks=${ticks} stops=${stops}`);
tickHoldSound(sound, { holdingPlant: false, holdingCut: false, dt: 0.02 }, cues);
check("release use turns the hold sound off", !sound.cutting && !sound.plantCue && stops === 1, `stops=${stops}`);
stopCutSound(sound);
check("stopCutSound leaves the loop idle", !sound.cutting && sound.holdTick === 0);

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\nplant charges and the fuse clock ticks");
