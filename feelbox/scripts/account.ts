/**
 * Register persists name + opaque look by playerKey; banned keys cannot join.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  generatePlayerKey,
  isPlayerKey,
  loadAccount,
  persistAccount,
  registerAccount,
  saveCharacter,
  type KV,
} from "../src/account.ts";
import { admitPlayer, createAccountBook } from "../server/accounts.mjs";

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
}

function memory(): KV {
  const data = new Map<string, string>();
  return {
    getItem: (k) => (data.has(k) ? data.get(k)! : null),
    setItem: (k, v) => {
      data.set(k, v);
    },
  };
}

const look = "2144032";
const store = memory();
const rec = registerAccount({ name: "Reed", look }, store);
check("register yields a long player key", isPlayerKey(rec.playerKey) && rec.playerKey.length >= 24);
check("register keeps the display name", rec.name === "Reed");
check("register stores the look string as-is", rec.look === look);

const again = loadAccount(store);
check("reload keeps the same key", again?.playerKey === rec.playerKey);
check("reload keeps the same name", again?.name === "Reed");
check("reload keeps the same look string", again?.look === look);

const otherLook = "xx-look-v2";
const saved = saveCharacter(otherLook, store);
check("save character keeps an opaque look", saved?.look === otherLook);
check("reload after save still has the new look", loadAccount(store)?.look === otherLook);
check("name does not become the ban identity", loadAccount(store)?.playerKey !== "Reed");

const fresh = memory();
persistAccount({ playerKey: generatePlayerKey(), name: "Cal", look: "0000000" }, fresh);
const cal = loadAccount(fresh);
check("persist then load returns Cal / 0000000", cal?.name === "Cal" && cal?.look === "0000000");

const dir = mkdtempSync(join(tmpdir(), "rifles-account-"));
const file = join(dir, "accounts.json");
try {
  const book = createAccountBook(file);
  const key = rec.playerKey;
  book.register({ playerKey: key, name: "Reed", look });
  const fromDisk = book.get(key);
  check("lobby register writes name and look", fromDisk?.name === "Reed" && fromDisk?.look === look);

  const reopened = createAccountBook(file);
  const reloaded = reopened.get(key);
  check("lobby reload keeps name", reloaded?.name === "Reed");
  check("lobby reload keeps opaque look", reloaded?.look === look);

  check("unbanned key may join", admitPlayer(reopened, key).ok === true);
  reopened.ban(key);
  const denied = admitPlayer(reopened, key);
  check("banned key cannot join", denied.ok === false && denied.reason === "banned");

  const later = createAccountBook(file);
  check("ban survives lobby reload", admitPlayer(later, key).ok === false && admitPlayer(later, key).reason === "banned");
  check("a different key may still join", admitPlayer(later, generatePlayerKey()).ok === true);
  check("name is not enough to join after ban", admitPlayer(later, "Reed").ok === false);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\naccount persist and ban path");
