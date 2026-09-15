/**
 * Kill labels, team-switch stats, and planted copy without naming the site.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { actorTag, claimSlot, createMatch, displayName, formatTime, plantedTag, plantWire, podiumSide, podiumWho, slotById } from "../src/match.ts";
import { killWayIcons, killWayLabel } from "../src/net.ts";
import { buildMap } from "../src/maps/index.ts";
import { createBots } from "../src/bots.ts";
import { reseatPeer, seatPeer } from "../src/peers.ts";
import { holdScoreboard, line, noteKill, podiumStat, swapLines } from "../src/stats.ts";

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
}

check("plain names stay plain", actorTag("Reed") === "Reed");
check("You is not printed", actorTag("You") === "Rifle");
check("you is not printed", actorTag("you") === "Rifle");
check("blank name is Rifle", displayName("") === "Rifle");
const claimed = createMatch({ claimLocal: false });
const seat = claimSlot(claimed, "ember", "You");
check("claiming You stores Rifle", seat?.name === "Rifle");
check("aimed kill is labeled aimed", killWayLabel("aimed") === "aimed");
check("hip fire is labeled no scope", killWayLabel("noscope") === "no scope");
check("frag is labeled nade", killWayLabel("nade") === "nade");
check("melee is labeled knife", killWayLabel("knife") === "knife");
check("detonation is labeled bomb", killWayLabel("bomb") === "bomb");
check("admin cow is labeled cow'd", killWayLabel("cow") === "cow'd");
check("aimed headshot names both", killWayLabel("aimed", true) === "aimed headshot");
const aimedKar = killWayIcons("aimed").html;
const aimedMosin = killWayIcons("aimed", false, "mosin").html;
const noscope = killWayIcons("noscope").html;
const nade = killWayIcons("nade").html;
check(
  "aimed icon is the old scope ring",
  aimedKar.includes("circle") && aimedKar.includes("r=\"6.2\"") && aimedKar.includes("M10 2.2v2.4") && !aimedKar.includes("M4.2 5.4"),
);
check("aimed mosin uses the same scope ring", aimedMosin === aimedKar);
check(
  "noscope icon is a wide moving crosshair",
  noscope.includes("M10 1v5") && noscope.includes("M1 10h5") && noscope.includes("stroke-width=\"0.75\""),
);
check("headshot icon includes a bullet path", killWayIcons("noscope", true).html.includes("M18 6.2"));
check("nade icon is not text", !nade.includes("nade"));
check("nade icon is a pineapple frag", nade.includes("3.6-2.15") && nade.includes("circle"));
const knife = killWayIcons("knife").html;
check(
  "knife icon is an open butterfly",
  knife.includes("M8.8 12.1") && knife.includes("cx=\"12.3\"") && knife.includes("Q4.2 16.2") && !knife.includes("M4 14.5"),
);
check(
  "taken bot shows bot then player",
  actorTag("Cal", "Reed") === "Cal (Reed)",
);
check("same name is not doubled", actorTag("Reed", "Reed") === "Reed");

const planted = createMatch({ claimLocal: true });
planted.phase = "live";
plantWire(planted, "loft", -9, 3.4, 20.5);
const tag = plantedTag(planted);
check("planted tag says Bomb live", tag.startsWith("Bomb live"), `tag=${tag}`);
check(
  "planted copy omits the site name",
  tag.includes(formatTime(planted.bombTime)) && !/Ice|Slip/.test(tag),
  `tag=${tag}`,
);
check("bomb icon is a satchel", killWayIcons("bomb").html.includes("rect"));

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

check("Tab holds the scoreboard in a match", holdScoreboard(new Set(["Tab"]), { started: true }));
check("KeyTab also holds the scoreboard", holdScoreboard(new Set(["KeyTab"]), { started: true }));
check("release hides the scoreboard", !holdScoreboard(new Set(), { started: true }));
check("studio walk does not open the match board", !holdScoreboard(new Set(["Tab"]), { started: true, studio: true }));
check("locker does not steal Tab", !holdScoreboard(new Set(["Tab"]), { started: true, locker: true }));
check("settings does not steal Tab", !holdScoreboard(new Set(["Tab"]), { started: true, settings: true }));
check("home does not open a board", !holdScoreboard(new Set(["Tab"]), { started: false }));

check("podium blank is a dash", podiumWho() === "—");
check("podium uses actor tags", podiumWho("Cal", "Reed") === "Cal (Reed)");
check("podium does not print You", podiumWho("You") === "Rifle");
check("podium side names the faction", podiumSide("ember") === "Ember" && podiumSide("stone") === "Stone");
check("podium stats spell out K/A/D", podiumStat({ kills: 12, assists: 3, deaths: 4 }) === "12 K · 3 A · 4 D · 3.00");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");
const css = readFileSync(join(root, "src/style.css"), "utf8");
const main = readFileSync(join(root, "src/main.ts"), "utf8");
const podiumHtml = html.slice(html.indexOf('id="end-stack"'), html.indexOf('id="letterbox"'));
check("end stack wraps podium then scoreboard", /id="end-stack"[\s\S]*id="podium"[\s\S]*id="scoreboard"/.test(podiumHtml));
check("olympic plates carry the player name", podiumHtml.includes('class="who"') && podiumHtml.includes('class="you-tag"') && podiumHtml.includes('class="side"'));
check("matchover camera is a close podium view", main.includes("applyPodiumCam") && main.includes("podiumCam("));
check("join camera stays the high orbit", /camera\.position\.set\([^;]*40/.test(main) && main.includes("applyMatchOverviewCam"));
check(
  "end-game board sits under the medals",
  /body\.podium #end-stack\s*\{[^}]*flex-direction:\s*column/.test(css) &&
    /body\.podium #end-stack\s*\{[^}]*justify-content:\s*flex-end/.test(css) &&
    !/body\.podium #scoreboard\s*\{[^}]*right:\s*16px/.test(css),
);
check("narrow screens stack the end-game board columns", /@media \(max-width: 720px\)[\s\S]*body\.podium #scoreboard \.board-cols\s*\{[^}]*grid-template-columns:\s*1fr/.test(css));
check("olympic stands show gold silver bronze blocks", css.includes(".stand.gold .block") && css.includes(".stand.silver .block") && css.includes(".stand.bronze .block") && !css.includes(".stand .block {\n  display: none"));
const hud = readFileSync(join(root, "src/hud.ts"), "utf8");
check("scoreboard rows mark You", hud.includes('class="board-you">You'));

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\nkill labels, team stats, and plant copy check out");
