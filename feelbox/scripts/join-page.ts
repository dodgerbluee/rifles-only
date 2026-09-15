/**
 * Joined-server page: high match-summary camera, team then weapons, dual gun views.
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
const preview = readFileSync(join(root, "src/gunPreview.ts"), "utf8");
const game = readFileSync(join(root, "server/game.ts"), "utf8");
const net = readFileSync(join(root, "src/net.ts"), "utf8");

check("join overlay has a spectate control", html.includes('id="join-spec"') && html.includes(">Spectate<"));
check("join overlay has enter-match after weapons", html.includes('id="loadout-go"') && html.includes("Enter match"));
check("pause menu lists disconnect, team, and settings", html.includes('id="pause-disconnect"') && html.includes('id="pause-team"') && html.includes('id="pause-settings"'));
check("join overlay is transparent over the map", /#join-team\s*\{[^}]*background:\s*transparent/.test(css));
check("team sides are translucent washes", css.includes("rgba(178, 74, 24") && css.includes("rgba(42, 104, 168"));
check("team selector is three-fifths of the page", /#join-team-pick\s*\{[^}]*width:\s*60%/.test(css) && /#join-team-pick\s*\{[^}]*height:\s*60%/.test(css));
check("scoped preview glass is not a solid blackout", !css.includes("#080907 76%"));
check("hello does not seat a pawn", !/msg\.type === "hello"[\s\S]{0,900}sim\.join\(/.test(game));
check("clients can send spectate", net.includes('{ kind: "spectate" }'));
check(
  "join camera is the matchover high orbit",
  main.includes("onJoinScreen()") &&
    main.includes("applyMatchOverviewCam") &&
    /camera\.position\.set\([^;]*40/.test(main),
);
check("team pick is a first step, not enter play", main.includes('joinStep = "guns"') && !/sendJoinTeam\(team\);\s*enterPlay\(\)/.test(main));
check("each rifle card has sight and gun canvases", main.includes('gunPane("sight"') && main.includes('gunPane("inspect"') && main.includes("dataset.preview"));
check("preview renders both panes without a toggle", preview.includes('"sight"') && preview.includes('"inspect"') && !preview.includes("togglePreviewMode"));
check("join overlay has no inspect/sight toggle", !html.includes("gun-preview-mode"));
check("enter match starts play from the gun step", main.includes("#loadout-go") && /#loadout-go[\s\S]{0,400}enterPlay\(\)/.test(main));
check("escape opens the pause menu while joined", main.includes("openPause()") && main.includes("leavePauseToGame()"));

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\njoined-server page looks down from the high summary camera");
