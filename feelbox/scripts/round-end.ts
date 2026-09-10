/**
 * End-of-round rules through the same createSim → tickMatch path as the dedicated server.
 */
import { createSim } from "../src/sim.ts";
import {
  combatBodies,
  countLiving,
  createMatch,
  markDead,
  markSeatsFromBodies,
  plantingTeam,
  plantWire,
  tickMatch,
  watchingTeam,
} from "../src/match.ts";
import { tuning } from "../src/tuning.ts";

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
}

function ended(phase: string) {
  return phase === "settle" || phase === "bestplay" || phase === "ending" || phase === "matchover";
}

function goLive(sim: ReturnType<typeof createSim>) {
  for (let i = 0; i < 30; i++) sim.tick(0.05);
}

function slayTeam(sim: ReturnType<typeof createSim>, team: "ember" | "stone") {
  const snap = sim.snapshot();
  for (const p of snap.pawns) {
    if (p.team === team) sim.slay(p.id);
  }
}

function dummy(living: (team: "ember" | "stone") => number) {
  return {
    living,
    inSite: () => false as const,
    holdingUse: false,
    actor: { id: 0, team: "ember" as const, x: 0, y: 0, z: 0, alive: true },
    spawnPlant: { x: 0, y: 0, z: 0 },
  };
}

const empty = createSim({ name: "Last Wire", freezeTime: 0.4, highlights: false });
for (let i = 0; i < 40; i++) empty.tick(0.05);
check("empty server stays in freeze", empty.snapshot().phase === "freeze", `phase=${empty.snapshot().phase}`);
check("empty arm does not plant", empty.armWire("loft") === false);

const beforePlant = createSim({ name: "Last Wire", freezeTime: 0.05, perTeam: 2, highlights: false, botSkill: "easy" });
beforePlant.join(1, "Reed", "ember");
goLive(beforePlant);
check("human in the room goes live", beforePlant.snapshot().phase === "live", `phase=${beforePlant.snapshot().phase}`);
slayTeam(beforePlant, "ember");
beforePlant.tick(0.05);
{
  const snap = beforePlant.snapshot();
  check("wipe planters before plant ends now", ended(snap.phase), `phase=${snap.phase} text=${snap.endText}`);
  check("watchers win when the Wire never sat", snap.lastWinner === "stone", `winner=${snap.lastWinner}`);
}

const plantHold = createSim({ name: "Last Wire", freezeTime: 0.05, perTeam: 2, highlights: false, botSkill: "easy" });
plantHold.join(1, "Reed", "ember");
goLive(plantHold);
check("arm sits the Wire", plantHold.armWire("loft") === true, `phase=${plantHold.snapshot().phase}`);
{
  const planted = plantHold.snapshot();
  check("phase is planted after arm", planted.phase === "planted", `phase=${planted.phase}`);
  const fuse = planted.wireTime;
  slayTeam(plantHold, "ember");
  plantHold.tick(0.05);
  const snap = plantHold.snapshot();
  check(
    "plant then wipe planters does not end while a watcher is up",
    snap.phase === "planted",
    `phase=${snap.phase} text=${snap.endText}`,
  );
  check("fuse still has time after planter wipe", snap.wireTime > fuse - 1, `bomb=${snap.wireTime}`);
}

const plantWipe = createSim({ name: "Last Wire", freezeTime: 0.05, perTeam: 3, highlights: false, botSkill: "easy" });
plantWipe.join(1, "Reed", "ember");
goLive(plantWipe);
check("plant for watcher wipe", plantWipe.armWire("well") === true);
{
  const planted = plantWipe.snapshot();
  const fuse = planted.wireTime;
  const watch = planted.swapped ? "ember" : "stone";
  const plant = planted.swapped ? "stone" : "ember";
  slayTeam(plantWipe, watch);
  plantWipe.tick(0.05);
  const snap = plantWipe.snapshot();
  const stillUp = snap.pawns.filter((p) => p.team === watch && p.alive && !p.absent).length;
  check("every watcher body is down", stillUp === 0, `up=${stillUp}`);
  check("plant then wipe watchers ends this tick", ended(snap.phase), `phase=${snap.phase} text=${snap.endText}`);
  check("planters win without waiting for the fuse", snap.lastWinner === plant, `winner=${snap.lastWinner} text=${snap.endText}`);
  check("fuse still remaining when the wipe landed", snap.wireTime > fuse - 1 || ended(snap.phase), `bomb=${snap.wireTime} fuse0=${fuse}`);
  check("end text is a cut-wipe, not a detonation", /cut|watch/i.test(snap.endText ?? ""), `text=${snap.endText}`);
}

const leftover = createSim({ name: "Last Wire", freezeTime: 0.05, perTeam: 3, highlights: false, botSkill: "easy" });
leftover.join(1, "Reed", "ember");
leftover.join(2, "Osa", "stone");
goLive(leftover);
check("two humans planted", leftover.armWire("loft") === true);
{
  const planted = leftover.snapshot();
  const fuse = planted.wireTime;
  const osa = planted.pawns.find((p) => p.netId === 2);
  check("stone human is seated", !!osa);
  if (osa) leftover.slay(osa.id);
  leftover.tick(0.05);
  const mate = leftover.snapshot().pawns.find((p) => p.team === "stone" && p.alive && !p.absent && (p.netId ?? 0) === 0);
  check("a stone bot remains for takeover", !!mate);
  if (mate) leftover.event(2, { kind: "takeover", slotId: mate.id });
  leftover.tick(0.05);
  slayTeam(leftover, "stone");
  leftover.tick(0.05);
  const snap = leftover.snapshot();
  const stoneUp = snap.pawns.filter((p) => p.team === "stone" && p.alive && !p.absent).length;
  check("takeover leftover seats are not living watchers", stoneUp === 0, `stoneUp=${stoneUp}`);
  check(
    "plant + wipe watchers after takeover ends now",
    ended(snap.phase),
    `phase=${snap.phase} text=${snap.endText}`,
  );
  check("planters win after vacated-seat wipe", snap.lastWinner === "ember", `winner=${snap.lastWinner}`);
  check("fuse did not have to run out after takeover wipe", snap.wireTime > fuse - 2 || ended(snap.phase), `bomb=${snap.wireTime}`);
}

const seats = createMatch({ claimLocal: true, perTeam: 2 });
seats.phase = "live";
plantWire(seats, "loft", -9, 3.4, 20.5);
const watch = watchingTeam(seats);
for (const s of seats.slots) {
  if (s.team === watch) markDead(seats, s.id, 0, 0, 0);
}
const ghost = seats.slots.find((s) => s.team === watch);
if (ghost) ghost.alive = true;
const bodies = combatBodies({
  local: { team: "ember", alive: true },
  bots: seats.slots.filter((s) => s.kind === "bot").map((s) => ({ id: s.id, team: s.team, hp: s.team === watch ? 0 : 100 })),
  remotes: [],
});
tickMatch(seats, 0.05, dummy((team) => countLiving(team, bodies)));
check("leftover watcher seat does not keep a planted round up", seats.phase === "settle", `phase=${seats.phase}`);
check("planters win that leftover-seat wipe", seats.lastWinner === plantingTeam(seats), `winner=${seats.lastWinner}`);

const marked = createMatch({ claimLocal: true, perTeam: 2 });
markSeatsFromBodies(marked, [0]);
check(
  "markSeatsFromBodies drops vacated seats",
  marked.slots.filter((s) => s.alive).length === 1 && marked.slots.some((s) => s.id === 0 && s.alive),
);

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\nround-end rules hold");
