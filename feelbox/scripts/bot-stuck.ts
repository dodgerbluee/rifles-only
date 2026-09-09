/**
 * Bots should leave spawn and keep moving along their route, not pin on the
 * same wall. Fail if anyone stays stuck far from their path.
 */
import * as THREE from "three";
import { createBots, updateBots } from "../src/bots.ts";
import { createMatch } from "../src/match.ts";
import { buildMap, MAPS, type MapId } from "../src/maps/index.ts";
import { collideXZ, groundHeight } from "../src/world.ts";

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
}

const R = 0.32;

function walkTo(
  colliders: { min: THREE.Vector3; max: THREE.Vector3; walk?: boolean }[],
  x: number,
  z: number,
  y: number,
  tx: number,
  tz: number,
  steps = 80,
) {
  for (let i = 0; i < steps; i++) {
    const dx = tx - x;
    const dz = tz - z;
    const len = Math.hypot(dx, dz);
    if (len < 0.55) return { x, z, y, ok: true, i };
    const n = collideXZ(colliders, x + (dx / len) * 0.28, z + (dz / len) * 0.28, R, y + 0.08, y + 1.7);
    if (Math.hypot(n.x - x, n.z - z) < 0.02) return { x, z, y, ok: false, i };
    x = n.x;
    z = n.z;
    y = groundHeight(colliders, x, z, R, y);
  }
  return { x, z, y, ok: Math.hypot(tx - x, tz - z) < 1.2, i: steps };
}

function runMap(id: MapId) {
  const scene = new THREE.Scene();
  const world = buildMap(scene, id);
  const match = createMatch({ claimLocal: false, freezeTime: 0 });
  match.phase = "live";
  const bots = createBots(scene, world, match);
  const start = bots.map((b) => ({ x: b.x, y: b.y, z: b.z }));
  const pin = bots.map(() => 0);

  let t = 1;
  for (let i = 0; i < 480; i++) {
    t += 1 / 30;
    const before = bots.map((b) => ({ x: b.x, z: b.z }));
    updateBots(bots, 1 / 30, t, world.colliders, world, match, [], false, () => {}, () => false, []);
    for (const [j, b] of bots.entries()) {
      const d = Math.hypot(b.x - before[j]!.x, b.z - before[j]!.z);
      if (d < 0.02) pin[j] += 1 / 30;
    }
  }

  const stuck: string[] = [];
  for (const [i, b] of bots.entries()) {
    const s = start[i]!;
    const moved = Math.hypot(b.x - s.x, b.z - s.z);
    const last = b.path[b.path.length - 1] ?? b.spawn;
    const left = Math.hypot(b.x - last.x, b.z - last.z);
    const first = b.path[0] ?? b.spawn;
    const toFirst = walkTo(world.colliders, s.x, s.z, s.y, first.x, first.z);
    const d0 = Math.hypot(first.x - s.x, first.z - s.z);
    const tgt = b.path[b.wp] ?? last;
    const line = `id=${b.id} ${b.team} pin=${pin[i]!.toFixed(1)}s moved=${moved.toFixed(1)} left=${left.toFixed(1)} wp=${b.wp}/${b.path.length} y=${b.y.toFixed(1)} tgtY=${tgt.y.toFixed(1)} d0=${d0.toFixed(1)} firstWalk=${toFirst.ok} pos=${b.x.toFixed(1)},${b.z.toFixed(1)}`;
    if (pin[i]! > 3 && left > 3) {
      const pts = b.path.map((p) => `${p.x.toFixed(0)},${p.z.toFixed(0)}`).join(">");
      stuck.push(`${line} path=${pts}`);
    }
  }

  console.log(`\n${id}  bots=${bots.length} stuck=${stuck.length}`);
  for (const line of stuck) console.log(`  PIN ${line}`);
  check(`${id}: bots do not pin on walls`, stuck.length === 0, `stuck=${stuck.length}/${bots.length}`);
}

for (const m of MAPS) runMap(m.id);

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\nbots do not pin on walls");
