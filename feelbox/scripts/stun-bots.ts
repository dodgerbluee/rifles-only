/**
 * Stun nades must stop bots firing, including on the dedicated sim.
 */
import * as THREE from "three";
import { createBots, updateBots, type Bot } from "../src/bots.ts";
import { createMatch } from "../src/match.ts";
import { buildMap } from "../src/maps/index.ts";
import { createSim } from "../src/sim.ts";
import { serverGone, SERVER_GONE_MS } from "../src/net.ts";

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
}

const scene = new THREE.Scene();
const world = buildMap(scene, "wharf");
const match = createMatch({ claimLocal: false, freezeTime: 0 });
match.phase = "live";
const bots = createBots(scene, world, match);
const b = bots.find((bot) => bot.hp > 0)!;
const foeTeam = b.team === "ember" ? "stone" : "ember";
const enemy = {
  id: 99,
  team: foeTeam as "ember" | "stone",
  x: b.x + 2,
  y: b.y + 1.5,
  z: b.z,
  alive: true,
};

function fireCount(bot: Bot, stunned: boolean) {
  let shots = 0;
  bot.stunUntil = stunned ? 99 : 0;
  bot.seeT = 2;
  bot.lastShot = -10;
  for (let i = 0; i < 90; i++) {
    const t = 2 + i / 30;
    updateBots(
      [bot],
      1 / 30,
      t,
      world.colliders,
      world,
      match,
      [
        enemy,
        { id: bot.id, team: bot.team, x: bot.x, y: bot.y + 1.5, z: bot.z, alive: true },
      ],
      false,
      () => {
        shots += 1;
      },
      () => false,
      [],
      "hard",
    );
  }
  return shots;
}

const hot = fireCount(b, false);
check("a close bot fires", hot > 0, `shots=${hot}`);
const cold = fireCount(b, true);
check("a stunned bot does not fire", cold === 0, `shots=${cold}`);

const sim = createSim({ freezeTime: 0.02, botSkill: "hard" });
sim.join(1, "Reed", "ember");
for (let i = 0; i < 8; i++) sim.tick(1 / 30);
const before = sim.snapshot();
const target = before.pawns.find((p) => p.alive && (p.netId ?? 0) === 0);
check("sim has a bot to stun", !!target);
if (target) {
  sim.event(1, {
    kind: "throwSmoke",
    ox: target.x,
    oy: target.y + 0.3,
    oz: target.z,
    dx: 0,
    dy: -1,
    dz: 0,
    power: 0,
    nade: "stun",
  });
  for (let i = 0; i < 40; i++) sim.tick(1 / 30);
  const after = sim.snapshot();
  const stunned = after.pawns.find((p) => p.id === target.id);
  check("sim stun marks the bot", !!stunned?.stun, `stun=${stunned?.stun}`);
}

check("30s of silence in a match drops to lobby", serverGone(true, 1, 1 + SERVER_GONE_MS + 1));
check("5s of silence stays in the match", !serverGone(true, 1, 5_001));
check("the server list does not time out", !serverGone(false, 1, 60_000));
check("studio without a match does not time out", !serverGone(true, 0, 60_000));

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\nstun hits bots; silence returns to the server list");
