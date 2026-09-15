/**
 * Home is servers-only with a Servers header. Auth is modal/page.
 * Settings is a two-pane page (nav + section content); Player is default.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
}

const root = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(root, "../src/style.css"), "utf8");
const html = readFileSync(join(root, "../index.html"), "utf8");

check("logged-out home does not hide the server list", !/body\.register\s+#server-list[\s\S]*?display:\s*none/.test(css));
check("settings page hides the home start shell", /body\.settings\s+#start/.test(css));

check("home chrome has Map studio before settings", html.indexOf('id="home-studio"') < html.indexOf('id="open-settings"'));
check("home chrome has Log in after settings", html.indexOf('id="open-settings"') < html.indexOf('id="home-login"'));
check("servers page has a header section", html.includes('class="servers-header"') && html.includes('id="home-servers"'));
check("login is a modal", html.includes('id="login-modal"'));
check("register is its own page", html.includes('id="register-page"'));
check("settings uses two-pane shell", html.includes('class="settings-shell"') && html.includes('class="settings-nav"'));
check("settings nav is ~15% in CSS", /settings-nav[\s\S]*?flex:\s*0\s+0\s+15%/.test(css) || /settings-nav[\s\S]*?15%/.test(css));
check("player settings pane is default on", /id="settings-pane-player"/.test(html) && /class="settings-pane on"[^>]*id="settings-pane-player"|id="settings-pane-player"[^>]*class="[^"]*\bon\b/.test(html));
check("model section exists", html.includes('data-settings-section="model"') && html.includes('id="settings-pane-model"'));
check("crosshair is its own section", html.includes('data-settings-section="crosshair"'));
check("controls section exists", html.includes('data-settings-section="controls"'));
check("name lives under player settings", html.includes('id="locker-name"') && html.indexOf('settings-pane-player') < html.indexOf('id="locker-name"'));
check("locker pip still exists", html.includes('id="locker-pip"'));
check("model uses full-page layout", html.includes('class="model-layout"') && html.includes('class="model-catalog"') && html.includes('id="locker-detail-stage"'));
check("crosshair has a live preview stage", html.includes('id="ch-preview"') && html.includes('ch-preview-stage') && html.includes('id="ch-preview-draw"'));
check("model shell leaves detail view clear", /body\.settings-model\s+\.settings-shell[\s\S]*?background:\s*transparent/.test(css));

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\nservers header + two-pane settings checks passed");
