/**
 * Lobby/game account book: name + opaque look keyed by playerKey, plus bans.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const KEY_RE = /^rk_[a-f0-9]{32}$/;
const MAX_LOOK = 64;
const MAX_NAME = 18;

export function isPlayerKey(value) {
  return typeof value === "string" && KEY_RE.test(value);
}

export function cleanName(value) {
  if (typeof value !== "string") return "You";
  return value.trim().slice(0, MAX_NAME) || "You";
}

/** Opaque packed look. Do not parse slots. */
export function cleanLook(value) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, MAX_LOOK);
}

function emptyStore() {
  return { accounts: {}, banned: [] };
}

function readStore(filePath) {
  if (!existsSync(filePath)) return emptyStore();
  try {
    const raw = JSON.parse(readFileSync(filePath, "utf8"));
    const accounts = raw && typeof raw.accounts === "object" && raw.accounts ? raw.accounts : {};
    const banned = Array.isArray(raw?.banned) ? raw.banned.filter(isPlayerKey) : [];
    return { accounts, banned };
  } catch {
    return emptyStore();
  }
}

function writeStore(filePath, data) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

export function admitPlayer(book, playerKey) {
  if (!isPlayerKey(playerKey)) return { ok: false, reason: "register" };
  if (book.isBanned(playerKey)) return { ok: false, reason: "banned" };
  return { ok: true };
}

export function createAccountBook(filePath) {
  const reload = () => readStore(filePath);
  const save = (data) => writeStore(filePath, data);

  return {
    register(input) {
      if (!isPlayerKey(input?.playerKey)) return null;
      const data = reload();
      const look = cleanLook(input.look);
      const prev = data.accounts[input.playerKey] ?? {};
      const looks = Array.isArray(prev.looks) ? prev.looks.map(cleanLook).filter(Boolean) : [];
      if (look && !looks.includes(look)) looks.unshift(look);
      const rec = {
        playerKey: input.playerKey,
        name: cleanName(input.name ?? prev.name),
        look: look || cleanLook(prev.look),
        looks,
      };
      data.accounts[input.playerKey] = rec;
      save(data);
      return rec;
    },
    get(playerKey) {
      if (!isPlayerKey(playerKey)) return null;
      return reload().accounts[playerKey] ?? null;
    },
    saveLook(playerKey, look) {
      return this.register({ playerKey, look, name: this.get(playerKey)?.name });
    },
    ban(playerKey) {
      if (!isPlayerKey(playerKey)) return false;
      const data = reload();
      if (!data.banned.includes(playerKey)) data.banned.push(playerKey);
      save(data);
      return true;
    },
    isBanned(playerKey) {
      return isPlayerKey(playerKey) && reload().banned.includes(playerKey);
    },
    banned() {
      return [...reload().banned];
    },
  };
}
