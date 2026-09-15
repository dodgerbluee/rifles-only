/**
 * Spectators stay off the pawn list. joinTeam seats them; spectate vacates.
 */
import { createSim } from "../src/sim.ts";

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
}

const sim = createSim({ name: "Last Wire" });
for (let i = 0; i < 8; i++) sim.tick(1 / 30);

const idle = sim.snapshot();
check("unseated peer is not in the snap", idle.pawns.every((p) => (p.netId ?? 0) === 0));
check("server player count ignores spectators", sim.status().players === 0);

sim.event(7, { kind: "joinTeam", team: "ember", name: "Reed" });
sim.tick(1 / 30);
const seated = sim.snapshot();
const reed = seated.pawns.find((p) => p.netId === 7);
check("joinTeam seats a human", !!reed && reed.team === "ember" && reed.name === "Reed");
check("player count counts the seated human", sim.status().players === 1);

sim.event(7, { kind: "spectate" });
sim.tick(1 / 30);
const ghost = sim.snapshot();
check("spectate drops the pawn", ghost.pawns.every((p) => p.netId !== 7));
check("spectate frees the seat", sim.status().players === 0);

sim.event(7, { kind: "joinTeam", team: "stone", name: "Reed" });
sim.tick(1 / 30);
const back = sim.snapshot().pawns.find((p) => p.netId === 7);
check("they can join Stone after spectating", !!back && back.team === "stone");

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\nspectators stay invisible to the match");
