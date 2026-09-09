/**
 * Kill labels, team-switch stats, and planted copy without naming the site.
 */
import * as THREE from "three";
import { actorTag, createMatch, formatTime, plantedTag, plantWire, slotById } from "../src/match.ts";
import { killWayIcons, killWayLabel } from "../src/net.ts";
import { buildMap } from "../src/maps/index.ts";
import { createBots } from "../src/bots.ts";
import { reseatPeer, seatPeer } from "../src/peers.ts";
import { line, noteKill, swapLines } from "../src/stats.ts";

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
}

check("plain names stay plain", actorTag("Reed") === "Reed");
check("aimed kill is labeled aimed", killWayLabel("aimed") === "aimed");
check("hip fire is labeled no scope", killWayLabel("noscope") === "no scope");
check("frag is labeled nade", killWayLabel("nade") === "nade");
check("melee is labeled knife", killWayLabel("knife") === "knife");
check("detonation is labeled wire", killWayLabel("bomb") === "wire");
check("admin cow is labeled cow'd", killWayLabel("cow") === "cow'd");
check("aimed headshot names both", killWayLabel("aimed", true) === "aimed headshot");
check("aimed icon is a scope ring", killWayIcons("aimed").html.includes("circle"));
check("headshot icon includes a bullet path", killWayIcons("noscope", true).html.includes("M18 6.2"));
check("nade icon is not text", !killWayIcons("nade").html.includes("nade"));
check(
  "taken bot shows bot then player",
  actorTag("Cal", "Reed") === "Cal (Reed)",
);
check("same name is not doubled", actorTag("Reed", "Reed") === "Reed");

const planted = createMatch({ claimLocal: true });
planted.phase = "live";
plantWire(planted, "loft", -9, 3.4, 20.5);
const tag = plantedTag(planted);
check(
  "planted copy omits the site name",
  tag.includes(formatTime(planted.bombTime)) && !/Ice|Slip/.test(tag),
  `tag=${tag}`,
);

const a = { ...line(1) };
noteKill(1, 2, 1);
noteKill(1, 3, 2);
swapLines(1, 10);
check("swap moves kills onto the new seat", line(10).kills === 2 && line(1).kills === a.kills);

const scene = new THREE.Scene();
const world = buildMap(scene, "wharf");
const match = createMatch({ claimLocal: false });
const bots = createBots(scene, world, match);
const remotes = new Map();
const r = seatPeer(scene, world, match, bots, remotes, 1, "Mina");
const from = r.slotId;
noteKill(from, 99, 1);
noteKill(from, 98, 2);
const fromK = line(from).kills;
const other: "ember" | "stone" = r.team === "ember" ? "stone" : "ember";
const beforeOther = match.slots.find((s) => s.team === other && s.kind === "bot")!;
const botK = line(beforeOther.id).kills;
reseatPeer(scene, world, match, bots, remotes, 1, "Mina", other);
const seated = remotes.get(1)!;
check("player is on the new team", seated.team === other);
check("stats follow the player", line(seated.slotId).kills === fromK);
check("old seat does not keep the player line", line(from).kills === botK);
check("old seat is a bot again", slotById(match, from)?.kind === "bot");
check("old seat does not still show the player name", slotById(match, from)?.name !== "Mina");

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\nkill labels, team stats, and plant copy check out");
