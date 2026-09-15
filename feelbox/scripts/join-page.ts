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
check("join overlay deploys after both guns are picked", html.includes('id="loadout-hint"') && main.includes("tryEnterFromLoadout()") && main.includes("pickedPrimary") && main.includes("pickedSecondary"));
check("pause menu lists disconnect, team, weapons, and settings", html.includes('id="pause-disconnect"') && html.includes('id="pause-team"') && html.includes('id="pause-guns"') && html.includes("Switch Weapon") && html.includes('id="pause-settings"'));
check("join overlay is transparent over the map", /#join-team\s*\{[^}]*background:\s*transparent/.test(css));
check("team sides are translucent washes", css.includes("rgba(178, 74, 24") && css.includes("rgba(42, 104, 168"));
check("team and rifle selectors share the three-fifths frame", /#join-team-pick,\s*#join-loadout\s*\{[^}]*width:\s*60%/.test(css) && /#join-team-pick,\s*#join-loadout\s*\{[^}]*height:\s*60%/.test(css) && /#join-team-pick,\s*#join-loadout\s*\{[^}]*left:\s*20%/.test(css) && /#join-team-pick,\s*#join-loadout\s*\{[^}]*top:\s*20%/.test(css));
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
check("selected gun cards are labeled", main.includes('gun-selected') && css.includes(".loadout-row button .gun-selected"));
check("picking both guns enters play", main.includes("tryEnterFromLoadout()") && /pickedPrimary = true[\s\S]{0,200}tryEnterFromLoadout\(\)/.test(main));
check("escape opens the pause menu while joined", main.includes("openPause()") && main.includes("leavePauseToGame()") && main.includes("openChooseGuns("));

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\njoined-server page looks down from the high summary camera");
