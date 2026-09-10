/**
 * Stance, recap skip, takeover nades, and dummy pawns.
 */
import { createSim } from "../src/sim.ts";
import {
  BESTPLAY_HOLD,
  claimSlot,
  createMatch,
  markDead,
  plantingTeam,
  tickMatch,
} from "../src/match.ts";
import { fillAbsentSlots } from "../src/peers.ts";
import { NADE_MAX } from "../src/smoke.ts";

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

const hold = createMatch({ claimLocal: false });
claimSlot(hold, "ember", "Reed");
hold.phase = "settle";
hold.endT = 0.01;
tickMatch(hold, 0.02, dummy);
check("highlights on still recap", hold.phase === "bestplay" && Math.abs(hold.endT - BESTPLAY_HOLD) < 0.001);

const skip = createMatch({ claimLocal: false });
claimSlot(skip, "ember", "Reed");
skip.phase = "settle";
skip.endT = 0.01;
tickMatch(skip, 0.02, { ...dummy, skipRecap: true });
check("highlights off skips recap hold", skip.phase === "ending" || skip.phase === "matchover", `phase=${skip.phase}`);

const vacant = createMatch({ claimLocal: false });
vacant.phase = "live";
vacant.timeLeft = 40;
tickMatch(vacant, 0.5, dummy);
check("empty server parks in freeze", vacant.phase === "freeze", `phase=${vacant.phase}`);
const held = vacant.timeLeft;
tickMatch(vacant, 8, dummy);
check("empty freeze does not go live", vacant.phase === "freeze" && vacant.timeLeft === held);
claimSlot(vacant, "ember", "Reed");
tickMatch(vacant, 0.4, dummy);
check("a human starts the freeze countdown", vacant.phase === "freeze" && vacant.timeLeft < held - 0.3);
tickMatch(vacant, vacant.freezeTime + 0.2, dummy);
check("round goes live once someone is in", vacant.phase === "live", `phase=${vacant.phase}`);

const sim = createSim({ name: "Last Wire" });
sim.join(1, "Reed");
for (let i = 0; i < 4; i++) sim.tick(1 / 30);
sim.setInput(1, {
  keys: [],
  yaw: 0,
  pitch: 0,
  fire: false,
  ads: false,
  lean: 0,
  weapon: "kar",
  crouch: false,
  prone: true,
  jump: false,
  use: false,
  mx: 0,
  my: 0,
});
sim.tick(1 / 30);
const posed = sim.snapshot();
const me = posed.pawns.find((p) => p.netId === 1);
check("snapshot sends prone", me?.prone === true, `prone=${me?.prone}`);
check("joined pawn has a full nade bag", me?.nades?.smoke === NADE_MAX.smoke && me?.nades?.frag === NADE_MAX.frag);

sim.event(1, {
  kind: "throwSmoke",
  ox: me!.x,
  oy: me!.y + 1.5,
  oz: me!.z,
  dx: 0.2,
  dy: 0.4,
  dz: 0.8,
  power: 0.8,
  nade: "smoke",
});
sim.tick(1 / 30);
const thrown = sim.snapshot().pawns.find((p) => p.netId === 1);
check("throw spends a smoke", thrown?.nades?.smoke === NADE_MAX.smoke - 1, `smoke=${thrown?.nades?.smoke}`);

const wiped = createMatch({ claimLocal: true });
wiped.phase = "live";
wiped.timeLeft = 80;
const plantSide = plantingTeam(wiped);
for (const s of wiped.slots) {
  if (s.team === plantSide) markDead(wiped, s.id, 0, 0, 0);
}
const deadHuman = wiped.slots.find((s) => s.kind === "human");
check("human is still seated after dying", !!deadHuman && deadHuman.alive === false && deadHuman.kind === "human");
tickMatch(wiped, 0.05, {
  ...dummy,
  living: (team) => wiped.slots.filter((s) => s.team === team && s.alive).length,
});
check("wiping planters with a dead human ends the round", wiped.phase === "settle", `phase=${wiped.phase}`);
check("watchers win when the Wire never sat", wiped.lastWinner !== plantSide, `winner=${wiped.lastWinner}`);

const fight = createSim({ name: "Last Wire", freezeTime: 0.05, perTeam: 3, highlights: false, botSkill: "easy" });
fight.join(1, "Reed", "ember");
for (let i = 0; i < 20; i++) fight.tick(0.05);
let snap = fight.snapshot();
check("human in the room goes live", snap.phase === "live", `phase=${snap.phase}`);
const self = snap.pawns.find((p) => p.netId === 1);
const mate = snap.pawns.find((p) => p.team === "ember" && (p.netId ?? 0) === 0 && p.alive);
check("a teammate bot is up for takeover", !!self && !!mate);
if (self && mate) {
  fight.event(1, { kind: "cow", slotId: self.id });
  for (let i = 0; i < 120; i++) fight.tick(0.05);
  fight.event(1, { kind: "takeover", slotId: mate.id });
  for (let i = 0; i < 4; i++) fight.tick(0.05);
  snap = fight.snapshot();
  for (const p of snap.pawns) {
    if (p.team === "ember") fight.event(1, { kind: "cow", slotId: p.id });
  }
  for (let i = 0; i < 140; i++) fight.tick(0.05);
  snap = fight.snapshot();
  const emberUp = snap.pawns.filter((p) => p.team === "ember" && p.alive && !p.absent).length;
  check("takeover wipe still shows no living planters", emberUp === 0, `emberUp=${emberUp}`);
  check(
    "takeover wipe ends the round instead of ticking live",
    snap.phase === "settle" || snap.phase === "bestplay" || snap.phase === "ending" || snap.phase === "matchover",
    `phase=${snap.phase} text=${snap.endText}`,
  );
}

const watchWipe = createSim({ name: "Last Wire", freezeTime: 0.05, perTeam: 2, highlights: false, botSkill: "easy" });
watchWipe.join(1, "Reed", "ember");
for (let i = 0; i < 20; i++) watchWipe.tick(0.05);
const watchSnap = watchWipe.snapshot();
for (const p of watchSnap.pawns) {
  if (p.team === "stone") watchWipe.event(1, { kind: "cow", slotId: p.id });
}
for (let i = 0; i < 140; i++) watchWipe.tick(0.05);
const afterWatch = watchWipe.snapshot();
check(
  "wiping watchers ends the live round",
  afterWatch.phase === "settle" || afterWatch.phase === "bestplay" || afterWatch.phase === "ending" || afterWatch.phase === "matchover",
  `phase=${afterWatch.phase} text=${afterWatch.endText}`,
);

const idle = createSim({ name: "Last Wire", freezeTime: 0.4, highlights: false });
for (let i = 0; i < 40; i++) idle.tick(0.05);
check("empty sim stays in freeze", idle.snapshot().phase === "freeze", `phase=${idle.snapshot().phase}`);

const absentPawns: { absent?: boolean }[] = [];
fillAbsentSlots(
  { slots: [{ id: 99, team: "ember", kind: "bot", name: "Cal", alive: false }] } as never,
  absentPawns as never,
);
check("dummy pawn is absent", absentPawns[0]?.absent === true);

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\nfeel fixes hold");
