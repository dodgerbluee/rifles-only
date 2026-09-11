/**
 * Credentials mint a server-side playerKey; banned keys cannot join.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applySession,
  isPlayerKey,
  loadAccount,
  persistAccount,
  saveCharacter,
  type KV,
} from "../src/account.ts";
import {
  admitPlayer,
  createAccountBook,
  defaultAccountPath,
  defaultDataDir,
  generatePlayerKey,
  publicAccount,
} from "../server/accounts.mjs";

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
    removeItem: (k) => {
      data.delete(k);
    },
  };
}

const look = "2144032";
const store = memory();
const minted = generatePlayerKey();
const rec = applySession({ playerKey: minted, username: "reed", name: "Reed", look }, store);
check("session stores a server player key", !!rec && rec.playerKey === minted && isPlayerKey(rec.playerKey));
check("session keeps the display name", rec?.name === "Reed");
check("session stores the look string as-is", rec?.look === look);
check("session keeps the username", rec?.username === "reed");

const again = loadAccount(store);
check("reload keeps the same key", again?.playerKey === rec?.playerKey);
check("reload keeps the same name", again?.name === "Reed");
check("reload keeps the same look string", again?.look === look);

const otherLook = "xx-look-v2";
const saved = saveCharacter(otherLook, store);
check("save character keeps an opaque look", saved?.look === otherLook);
check("reload after save still has the new look", loadAccount(store)?.look === otherLook);
check("name does not become the ban identity", loadAccount(store)?.playerKey !== "Reed");

const empty = memory();
check("client will not mint its own key", persistAccount({ name: "Cal", look: "0000000" }, empty) === null);

const fresh = memory();
persistAccount({ playerKey: generatePlayerKey(), name: "Cal", look: "0000000" }, fresh);
const cal = loadAccount(fresh);
check("persist then load returns Cal / 0000000", cal?.name === "Cal" && cal?.look === "0000000");

const dir = mkdtempSync(join(tmpdir(), "rifles-account-"));
const file = join(dir, "accounts.json");
try {
  const book = createAccountBook(file);
  const signed = book.signup({
    email: "reed@example.com",
    username: "Reed",
    password: "longrifle",
    name: "Reed",
    look,
  });
  check("signup succeeds", signed.ok === true);
  const key = signed.rec?.playerKey;
  check("signup mints a player key", isPlayerKey(key));
  check("signup stores name and look", signed.rec?.name === "Reed" && signed.rec?.look === look);
  check("public account hides the password hash", !("passwordHash" in (publicAccount(signed.rec) ?? {})) && !("email" in (publicAccount(signed.rec) ?? {})));

  const fromDisk = book.get(key);
  check("lobby signup writes name and look", fromDisk?.name === "Reed" && fromDisk?.look === look);

  const logged = book.login({ user: "reed", password: "longrifle" });
  check("login with username returns the same key", logged.ok === true && logged.rec?.playerKey === key);
  const emailed = book.login({ user: "Reed@example.com", password: "longrifle" });
  check("login with email returns the same key", emailed.ok === true && emailed.rec?.playerKey === key);
  const badPass = book.login({ user: "reed", password: "wrongpass" });
  check("wrong password cannot login", badPass.ok === false && badPass.reason === "auth");

  const taken = book.signup({
    email: "other@example.com",
    username: "reed",
    password: "longrifle",
  });
  check("duplicate username is rejected", taken.ok === false && taken.reason === "username");
  const takenEmail = book.signup({
    email: "reed@example.com",
    username: "other",
    password: "longrifle",
  });
  check("duplicate email is rejected", takenEmail.ok === false && takenEmail.reason === "email");

  const stray = generatePlayerKey();
  check("register cannot mint a new key", book.register({ playerKey: stray, name: "Ghost", look }) === null);

  const reopened = createAccountBook(file);
  const reloaded = reopened.get(key);
  check("lobby reload keeps name", reloaded?.name === "Reed");
  check("lobby reload keeps opaque look", reloaded?.look === look);

  check("registered key may join", admitPlayer(reopened, key).ok === true);
  check("a well-formed key may join even if this process has no copy", admitPlayer(reopened, generatePlayerKey()).ok === true);
  reopened.ban(key);
  const denied = admitPlayer(reopened, key);
  check("banned key cannot join", denied.ok === false && denied.reason === "banned");

  const later = createAccountBook(file);
  check("ban survives lobby reload", admitPlayer(later, key).ok === false && admitPlayer(later, key).reason === "banned");
  const other = later.signup({
    email: "cal@example.com",
    username: "cal",
    password: "longrifle",
  });
  check("a different account may still join", other.ok === true && admitPlayer(later, other.rec.playerKey).ok === true);
  check("name is not enough to join after ban", admitPlayer(later, "Reed").ok === false);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

{
  const prevData = process.env.DATA_DIR;
  const prevAcc = process.env.ACCOUNTS_PATH;
  delete process.env.DATA_DIR;
  delete process.env.ACCOUNTS_PATH;
  check("without a data dir, the book sits next to the app", defaultAccountPath("/app") === "/app/accounts.json");
  process.env.ACCOUNTS_PATH = "/docker/rifles/data/accounts.json";
  check("ACCOUNTS_PATH wins over the app root", defaultAccountPath("/app") === "/docker/rifles/data/accounts.json");
  delete process.env.ACCOUNTS_PATH;
  process.env.DATA_DIR = "/docker/rifles/data";
  check("DATA_DIR owns logins", defaultDataDir("/app") === "/docker/rifles/data");
  check("DATA_DIR owns the accounts file", defaultAccountPath("/app") === "/docker/rifles/data/accounts.json");
  if (prevData == null) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = prevData;
  if (prevAcc == null) delete process.env.ACCOUNTS_PATH;
  else process.env.ACCOUNTS_PATH = prevAcc;
}

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\naccount persist and ban path");
