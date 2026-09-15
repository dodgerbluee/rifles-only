/**
 * Home is servers-only. Auth is modal/page. Settings is a full page with preferences.
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
check("home chrome has Log out after settings", html.indexOf('id="open-settings"') < html.indexOf('id="home-logout"'));
check("home body is servers only (no Account section)", !html.includes('id="home-account"'));
check("home body has no Preferences entry", !html.includes('id="home-locker"'));
check("login is a modal", html.includes('id="login-modal"'));
check("register is its own page", html.includes('id="register-page"'));
check("settings is a full page with Back", html.includes('id="settings"') && html.includes('id="settings-back"'));
check("preferences live under settings", html.includes('id="settings-prefs"') && html.includes('id="locker-name"'));
check("settings has no separate display-name field outside prefs", !html.includes('id="set-name"'));
check("locker pip still exists for full-body preview", html.includes('id="locker-pip"'));

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\nhome is servers-only; auth modal/page; settings full page with prefs");
