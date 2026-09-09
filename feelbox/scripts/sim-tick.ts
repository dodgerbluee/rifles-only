/**
 * Headless sim boots, ticks, and reports ten pawns without a browser host.
 */
import { createSim } from "../src/sim.ts";

const sim = createSim({ name: "Last Wire" });
for (let i = 0; i < 60; i++) sim.tick(1 / 30);
const snap = sim.snapshot();
const st = sim.status();
if (snap.pawns.length < 10) {
  console.error("expected 10 bot seats, got", snap.pawns.length);
  process.exit(1);
}
if (!st.map) {
  console.error("missing map");
  process.exit(1);
}
console.log("ok", st.map, "pawns", snap.pawns.length, "phase", snap.phase);
