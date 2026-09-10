/**
 * Lobby/game account book: credentials own a server-side playerKey used for
 * bans and join. Name + opaque look hang off that key.
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const KEY_RE = /^rk_[a-f0-9]{32}$/;
const USER_RE = /^[a-z0-9_]{3,18}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LOOK = 64;
const MAX_NAME = 18;
const MAX_EMAIL = 120;
const MAX_PASSWORD = 200;
const MIN_PASSWORD = 8;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 32;

export function isPlayerKey(value) {
  return typeof value === "string" && KEY_RE.test(value);
}

export function generatePlayerKey() {
  return `rk_${randomBytes(16).toString("hex")}`;
}

export function cleanName(value) {
  if (typeof value !== "string") return "You";
  return value.trim().slice(0, MAX_NAME) || "You";
}

export function cleanUsername(value) {
  if (typeof value !== "string") return "";
  const s = value.trim().toLowerCase();
  return USER_RE.test(s) ? s : "";
}

export function cleanEmail(value) {
  if (typeof value !== "string") return "";
  const s = value.trim().toLowerCase().slice(0, MAX_EMAIL);
  return EMAIL_RE.test(s) ? s : "";
}

export function checkPassword(value) {
  return typeof value === "string" && value.length >= MIN_PASSWORD && value.length <= MAX_PASSWORD;
}

/** Opaque packed look. Do not parse slots. */
export function cleanLook(value) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, MAX_LOOK);
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }).toString("hex");
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  if (typeof password !== "string" || typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = parts[4];
  const expected = Buffer.from(parts[5], "hex");
  if (!salt || !expected.length) return false;
  const check = scryptSync(password, salt, expected.length, { N, r, p });
  if (check.length !== expected.length) return false;
  return timingSafeEqual(check, expected);
}

export function publicAccount(rec) {
  if (!rec || !isPlayerKey(rec.playerKey)) return null;
  return {
    playerKey: rec.playerKey,
    username: typeof rec.username === "string" ? rec.username : "",
    name: cleanName(rec.name),
    look: cleanLook(rec.look),
    looks: Array.isArray(rec.looks) ? rec.looks.map(cleanLook).filter(Boolean) : [],
  };
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

function findByUsername(data, username) {
  const want = cleanUsername(username);
  if (!want) return null;
  for (const rec of Object.values(data.accounts)) {
    if (cleanUsername(rec?.username) === want) return rec;
  }
  return null;
}

function findByEmail(data, email) {
  const want = cleanEmail(email);
  if (!want) return null;
  for (const rec of Object.values(data.accounts)) {
    if (cleanEmail(rec?.email) === want) return rec;
  }
  return null;
}

/**
 * Join needs a well-formed, unbanned key. Credentials live on the lobby;
 * lobby and game often do not share a disk, so do not require this book
 * to already contain the key.
 */
export function admitPlayer(book, playerKey) {
  if (!isPlayerKey(playerKey)) return { ok: false, reason: "register" };
  if (book.isBanned(playerKey)) return { ok: false, reason: "banned" };
  return { ok: true };
}

export function createAccountBook(filePath) {
  const reload = () => readStore(filePath);
  const save = (data) => writeStore(filePath, data);

  return {
    signup(input) {
      const username = cleanUsername(input?.username);
      const email = cleanEmail(input?.email);
      if (!email) return { ok: false, reason: "email-invalid" };
      if (!username) return { ok: false, reason: "username-invalid" };
      if (!checkPassword(input?.password)) return { ok: false, reason: "password" };
      const data = reload();
      if (findByUsername(data, username)) return { ok: false, reason: "username" };
      if (findByEmail(data, email)) return { ok: false, reason: "email" };
      let playerKey = generatePlayerKey();
      while (data.accounts[playerKey]) playerKey = generatePlayerKey();
      const look = cleanLook(input?.look);
      const rec = {
        playerKey,
        username,
        email,
        passwordHash: hashPassword(input.password),
        name: cleanName(input?.name ?? username),
        look,
        looks: look ? [look] : [],
      };
      data.accounts[playerKey] = rec;
      save(data);
      return { ok: true, rec };
    },
    login(input) {
      const password = input?.password;
      if (typeof password !== "string") return { ok: false, reason: "auth" };
      const data = reload();
      const identity = typeof input?.user === "string" ? input.user : "";
      const rec = findByUsername(data, identity) || findByEmail(data, identity);
      if (!rec?.passwordHash || !verifyPassword(password, rec.passwordHash)) {
        return { ok: false, reason: "auth" };
      }
      return { ok: true, rec };
    },
    register(input) {
      if (!isPlayerKey(input?.playerKey)) return null;
      const data = reload();
      const prev = data.accounts[input.playerKey];
      if (!prev) return null;
      const look = cleanLook(input.look);
      const looks = Array.isArray(prev.looks) ? prev.looks.map(cleanLook).filter(Boolean) : [];
      if (look && !looks.includes(look)) looks.unshift(look);
      const rec = {
        ...prev,
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
