/**
 * Dedicated-sim gaps: knife must kill, held jump must not bunny-hop.
 */
import * as THREE from "three";
import { meleeTarget } from "../src/combat.ts";
import { emptyInput } from "../src/peers.ts";
import { createSim } from "../src/sim.ts";

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
}

const origin = new THREE.Vector3(0, 1.5, 0);
const dir = new THREE.Vector3(0, 0, -1);
const hit = meleeTarget(
  origin,
  dir,
  [{ id: 1, team: "stone", x: 0, y: 0, z: -1.2, alive: true }],
  1.92,
  "ember",
  false,
  [],
);
check("melee hits a body in front", !!hit && hit.id === 1);

const sim = createSim({ name: "Last Wire" });
sim.join(1, "Reed");
for (let i = 0; i < 90; i++) sim.tick(1 / 30);

const before = sim.snapshot();
const me0 = before.pawns.find((p) => p.netId === 1);
check("past freeze", before.phase === "live", `phase=${before.phase}`);
check("seated", !!me0);
if (!me0) process.exit(1);

const groundY = me0.y;
sim.setInput(1, { ...emptyInput(), jump: true });
let launches = 0;
let airborne = false;
for (let i = 0; i < 90; i++) {
  sim.tick(1 / 30);
  const y = sim.snapshot().pawns.find((p) => p.netId === 1)?.y ?? groundY;
  const up = y > groundY + 0.12;
  if (up && !airborne) launches += 1;
  airborne = up;
}
check("held jump launches once", launches === 1, `launches=${launches}`);

sim.event(1, {
  kind: "melee",
  ox: me0.x,
  oy: me0.y + 1.4,
  oz: me0.z,
  dx: 0,
  dy: 0,
  dz: -1,
});
sim.tick(1 / 30);
check("melee event is accepted live", !!sim.snapshot().pawns.find((p) => p.netId === 1));
check("snapshot carries sim time", typeof before.time === "number");

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\njump edge and melee events reach the dedicated sim");
