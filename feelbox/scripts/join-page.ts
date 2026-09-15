/**
 * Joined-server page: sky view, team + weapon overlay, spectate, pause menu.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");
const css = readFileSync(join(root, "src/style.css"), "utf8");
const main = readFileSync(join(root, "src/main.ts"), "utf8");
const game = readFileSync(join(root, "server/game.ts"), "utf8");
const net = readFileSync(join(root, "src/net.ts"), "utf8");

check("join overlay has a spectate control", html.includes('id="join-spec"') && html.includes(">Spectate<"));
check("join overlay has a weapon preview canvas", html.includes('id="gun-preview-view"') && html.includes('id="gun-preview-glass"'));
check("pause menu lists disconnect, team, and settings", html.includes('id="pause-disconnect"') && html.includes('id="pause-team"') && html.includes('id="pause-settings"'));
check("join overlay is transparent over the map", /#join-team\s*\{[^}]*background:\s*transparent/.test(css));
check("team sides are translucent washes", css.includes("rgba(178, 74, 24") && css.includes("rgba(42, 104, 168"));
check("hello does not seat a pawn", !/msg\.type === "hello"[\s\S]{0,900}sim\.join\(/.test(game));
check("clients can send spectate", net.includes('{ kind: "spectate" }'));
check("sky orbit is applied on the join screen", main.includes("onJoinScreen()") && main.includes("applyOrbit(camera, joinCam)"));
check("picking a side enters play", main.includes("sendJoinTeam(team)") && main.includes("enterPlay()"));
check("escape opens the pause menu while joined", main.includes("openPause()") && main.includes("leavePauseToGame()"));

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\njoined-server page keeps the map in view");
