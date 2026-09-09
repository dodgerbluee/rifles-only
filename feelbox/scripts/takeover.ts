/**
 * Dead player taking a teammate bot must move their remote onto that seat.
 */
import * as THREE from "three";
import { createBots } from "../src/bots.ts";
import { buildMap } from "../src/maps/index.ts";
import { createMatch, markDead, slotById } from "../src/match.ts";
import { buildSnapshot, creditId, restoreHomeSeat, seatPeer, snapWalkSpeed, takeoverPeer } from "../src/peers.ts";
import { line, noteKill } from "../src/stats.ts";

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
const botSlotName = slotById(match, bot.id)?.name ?? "";
check("alive player cannot take a bot", takeoverPeer(scene, match, bots, remotes, 1, bot.id) === false);

r.alive = false;
r.hp = 0;
r.nades.smoke = 0;
r.nades.frag = 0;
r.nades.stun = 0;
r.nades.flash = 0;
markDead(match, r.slotId, r.x, r.y, r.z);
const ok = takeoverPeer(scene, match, bots, remotes, 1, bot.id);
check("dead player takes the bot seat", ok === true);
check("takeover copies the bot nade bag", r.nades.smoke === 2 && r.nades.frag === 1);
check("remote is alive on the bot slot", r.alive === true && r.slotId === bot.id);
check("old seat is no longer this remote", r.slotId !== oldSlot);
check("taken bot is gone", !bots.some((b) => b.id === bot.id));
check("taken seat keeps the bot name", slotById(match, bot.id)?.name === botSlotName);
check("taken seat records the player as occupant", slotById(match, bot.id)?.occupant === "Reed");
check("player seat stays the player's", slotById(match, oldSlot)?.kind === "human");
check("old seat still has the player name", slotById(match, oldSlot)?.name === "Reed");

noteKill(creditId(remotes, r.slotId), 99, 1);
check("takeover kills credit the player", line(oldSlot).kills === 1);
check("bot line does not take those kills", line(bot.id).kills === 0);

const snap = buildSnapshot(
  match,
  {
    id: -1,
    netId: 0,
    name: "host",
    team: "ember",
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    pitch: 0,
    hp: 0,
    alive: false,
    weapon: "kar",
    ads: false,
  },
  bots,
  remotes,
  "wharf",
);
const mine = snap.pawns.find((p) => p.netId === 1);
check("snapshot keeps the player's seat id", mine?.id === oldSlot);
check("snapshot kill line is the player's", mine?.kills === 1);
check("snapshot does not publish the player as the bot", !snap.pawns.some((p) => p.netId === 1 && p.id === bot.id));

restoreHomeSeat(match, r);
check("next round puts the player back on their seat", r.slotId === oldSlot);
check("taken bot seat is a bot again", slotById(match, bot.id)?.kind === "bot");
check("taken bot is no longer occupied", slotById(match, bot.id)?.occupant == null);

noteKill(creditId(remotes, r.slotId), 98, 2);
check("respawn kills still credit the player", line(oldSlot).kills === 2);
check("bot still has none of the player's kills", line(bot.id).kills === 0);

check("still walk is zero speed", snapWalkSpeed(0, 0, 0, 0, 1 / 30) === 0);
check("walk speed follows snapshot delta", Math.abs(snapWalkSpeed(0, 0, 0.195, 0, 1 / 30) - 5.85) < 0.2);
check("teleport does not count as a step", snapWalkSpeed(0, 0, 20, 0, 1 / 30) === 0);

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\ntakeover moves a dead remote onto a living teammate bot");
