/**
 * Dead player taking a teammate bot must move their remote onto that seat.
 */
import * as THREE from "three";
import { createBots } from "../src/bots.ts";
import { buildMap } from "../src/maps/index.ts";
import { createMatch, markDead } from "../src/match.ts";
import { seatPeer, snapWalkSpeed, takeoverPeer } from "../src/peers.ts";

let failed = 0;
function check(name: string, ok: boolean) {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}`);
}

const scene = new THREE.Scene();
const world = buildMap(scene, "wharf");
const match = createMatch({ claimLocal: false });
const bots = createBots(scene, world, match);
const remotes = new Map();

const r = seatPeer(scene, world, match, bots, remotes, 1, "Reed");
const teamBots = bots.filter((b) => b.team === r.team && b.hp > 0);
check("teammate bots exist after seating", teamBots.length > 0);

const bot = teamBots[0]!;
const oldSlot = r.slotId;
check("alive player cannot take a bot", takeoverPeer(scene, match, bots, remotes, 1, bot.id) === false);

r.alive = false;
r.hp = 0;
markDead(match, r.slotId, r.x, r.y, r.z);
const ok = takeoverPeer(scene, match, bots, remotes, 1, bot.id);
check("dead player takes the bot seat", ok === true);
check("remote is alive on the bot slot", r.alive === true && r.slotId === bot.id);
check("old seat is no longer this remote", r.slotId !== oldSlot);
check("taken bot is gone", !bots.some((b) => b.id === bot.id));

check("still walk is zero speed", snapWalkSpeed(0, 0, 0, 0, 1 / 30) === 0);
check("walk speed follows snapshot delta", Math.abs(snapWalkSpeed(0, 0, 0.195, 0, 1 / 30) - 5.85) < 0.2);
check("teleport does not count as a step", snapWalkSpeed(0, 0, 20, 0, 1 / 30) === 0);

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\ntakeover moves a dead remote onto a living teammate bot");
