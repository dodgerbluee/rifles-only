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

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../src/style.css"), "utf8");
const hideLoggedOutList = /body\.register\s+#server-list[\s\S]*?display:\s*none/;
check("logged-out home does not hide the server list", !hideLoggedOutList.test(css));
check("locker still hides the server list", /body\.locker\s+#server-list/.test(css));

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\nhome server list stays visible before login");
