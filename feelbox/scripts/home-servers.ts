/**
 * The start screen lists matches even before login. Join still requires an account.
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
const hideLoggedOutList = /body\.register\s+#server-list[\s\S]*?display:\s*none/;
check("logged-out home does not hide the server list", !hideLoggedOutList.test(css));
check("locker still hides the server list", /body\.locker\s+#server-list/.test(css) || /body\.locker\s+#home-servers/.test(css));

check("home has a Log in button", html.includes('id="home-login"') && html.includes(">Log in<"));
check("home has Preferences entry", html.includes('id="home-locker"') && html.includes(">Preferences<"));
check("home Account section exists", html.includes('id="home-account"') && html.includes(">Account<"));
check("home Servers section exists", html.includes('id="home-servers"') && html.includes(">Servers<"));
check("settings has no display-name field", !html.includes('id="set-name"'));
check("locker has full-body pip", html.includes('id="locker-pip"'));
check("register continues into preferences", html.includes(">Continue<") && html.includes('id="auth-steps"'));

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\nhome server list stays visible before login");
