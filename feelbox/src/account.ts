import { packLook, parseLook } from "./look";
import { onPrefsSaved, prefs, savePrefs } from "./prefs";

export const ACCOUNT_KEY = "rifles-only-account";

export type AccountRecord = {
  playerKey: string;
  name: string;
  look: string;
  looks: string[];
};

export type KV = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

const KEY_RE = /^rk_[a-f0-9]{32}$/;
const MAX_LOOK = 64;
const MAX_NAME = 18;

function defaultStore(): KV | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function isPlayerKey(value: unknown): value is string {
  return typeof value === "string" && KEY_RE.test(value);
}

export function generatePlayerKey(): string {
  const bytes = new Uint8Array(16);
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj?.getRandomValues) {
    throw new Error("crypto unavailable");
  }
  cryptoObj.getRandomValues(bytes);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return `rk_${hex}`;
}

export function cleanName(value: unknown): string {
  if (typeof value !== "string") return "You";
  return value.trim().slice(0, MAX_NAME) || "You";
}

/** Opaque packed look. Do not parse slots. */
export function cleanLook(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, MAX_LOOK);
}

function readRecord(raw: string | null): AccountRecord | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<AccountRecord>;
    if (!isPlayerKey(p.playerKey)) return null;
    const look = cleanLook(p.look);
    const looks = Array.isArray(p.looks)
      ? p.looks.map(cleanLook).filter(Boolean)
      : look
        ? [look]
        : [];
    if (look && !looks.includes(look)) looks.unshift(look);
    return { playerKey: p.playerKey, name: cleanName(p.name), look, looks };
  } catch {
    return null;
  }
}

export function loadAccount(store: KV | null = defaultStore()): AccountRecord | null {
  if (!store) return null;
  return readRecord(store.getItem(ACCOUNT_KEY));
}

export function persistAccount(
  patch: Partial<AccountRecord> & { playerKey?: string },
  store: KV | null = defaultStore(),
): AccountRecord {
  const prev = store ? loadAccount(store) : null;
  const playerKey = isPlayerKey(patch.playerKey) ? patch.playerKey : prev?.playerKey ?? generatePlayerKey();
  const name = patch.name != null ? cleanName(patch.name) : prev?.name ?? "You";
  const look = patch.look != null ? cleanLook(patch.look) : prev?.look ?? "";
  let looks = prev?.looks ? [...prev.looks] : [];
  if (Array.isArray(patch.looks)) looks = patch.looks.map(cleanLook).filter(Boolean);
  if (look && !looks.includes(look)) looks.unshift(look);
  const rec: AccountRecord = { playerKey, name, look, looks };
  store?.setItem(ACCOUNT_KEY, JSON.stringify(rec));
  return rec;
}

export function registerAccount(
  input: { name?: string; look?: string; playerKey?: string },
  store: KV | null = defaultStore(),
): AccountRecord {
  const playerKey = isPlayerKey(input.playerKey) ? input.playerKey : generatePlayerKey();
  return persistAccount(
    { playerKey, name: cleanName(input.name), look: cleanLook(input.look), looks: cleanLook(input.look) ? [cleanLook(input.look)] : [] },
    store,
  );
}

export function saveCharacter(look: string, store: KV | null = defaultStore()): AccountRecord | null {
  const prev = store ? loadAccount(store) : null;
  if (!prev) return null;
  return persistAccount({ ...prev, look: cleanLook(look) }, store);
}

export function isRegistered(store: KV | null = defaultStore()): boolean {
  return !!loadAccount(store);
}

export function accountKey(store: KV | null = defaultStore()): string {
  return loadAccount(store)?.playerKey ?? "";
}

export function accountLook(store: KV | null = defaultStore()): string {
  return loadAccount(store)?.look ?? "";
}

function copyText(value: string) {
  if (!value) return;
  void navigator.clipboard?.writeText(value).catch(() => {
    /* ignore */
  });
}

function currentLook(): string {
  const saved = accountLook();
  if (saved) return saved;
  return packLook(prefs.look);
}

export function syncAccountToPrefs() {
  const rec = loadAccount();
  if (!rec) return;
  prefs.playerKey = rec.playerKey;
  prefs.name = rec.name;
  if (rec.look) {
    prefs.lookId = rec.look;
    const parsed = parseLook(rec.look);
    if (parsed) prefs.look = parsed;
  }
}

export function persistPrefsAccount() {
  if (!prefs.playerKey && !loadAccount()) return;
  persistAccount({
    playerKey: prefs.playerKey || accountKey(),
    name: prefs.name,
    look: prefs.lookId || packLook(prefs.look),
  });
}

onPrefsSaved(persistPrefsAccount);

async function pushLobby(rec: AccountRecord) {
  try {
    await fetch("/api/account", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerKey: rec.playerKey, name: rec.name, look: rec.look }),
    });
  } catch {
    /* lobby optional */
  }
}

function fillIdentity(rec: AccountRecord | null, pendingKey: string) {
  const panel = document.querySelector<HTMLElement>("#register");
  if (panel) panel.hidden = !!rec;
  document.body.classList.toggle("register", !rec);
  const home = document.querySelector<HTMLElement>("#home-id");
  if (home) home.classList.toggle("on", !!rec);
  if (!rec) {
    const title = document.querySelector("#start-title");
    const blurb = document.querySelector("#start-blurb");
    if (title) title.textContent = "Register";
    if (blurb) blurb.textContent = "Set a name and keep your primary key. We ban the key, not the name.";
  }
  const key = rec?.playerKey ?? pendingKey;
  const name = rec?.name ?? prefs.name;
  const nameEls = ["#reg-name", "#locker-name", "#set-name", "#home-id-name"] as const;
  for (const sel of nameEls) {
    const el = document.querySelector<HTMLInputElement | HTMLElement>(sel);
    if (!el) continue;
    if (el instanceof HTMLInputElement) {
      if (el !== document.activeElement) el.value = name;
    } else {
      el.textContent = name;
    }
  }
  for (const sel of ["#reg-key", "#locker-key"] as const) {
    const el = document.querySelector<HTMLInputElement>(sel);
    if (el && el !== document.activeElement) el.value = key;
  }
  const homeKey = document.querySelector("#home-id-key");
  if (homeKey) homeKey.textContent = key;
}

export function paintIdentity() {
  const rec = loadAccount();
  document.body.classList.toggle("register", !rec);
  fillIdentity(rec, rec?.playerKey ?? "");
}

export function bindIdentity(opts?: { onChange?: () => void }) {
  let pendingKey = generatePlayerKey();
  const rec = loadAccount();
  if (rec) {
    prefs.playerKey = rec.playerKey;
    prefs.name = rec.name;
  }
  document.body.classList.toggle("register", !rec);
  fillIdentity(rec, pendingKey);

  const notify = () => {
    syncAccountToPrefs();
    fillIdentity(loadAccount(), pendingKey);
    opts?.onChange?.();
  };

  document.querySelector("#reg-copy")?.addEventListener("click", (e) => {
    e.stopPropagation();
    copyText((document.querySelector<HTMLInputElement>("#reg-key")?.value || pendingKey).trim());
  });
  document.querySelector("#locker-copy")?.addEventListener("click", (e) => {
    e.stopPropagation();
    copyText(accountKey());
  });
  document.querySelector("#home-id-copy")?.addEventListener("click", (e) => {
    e.stopPropagation();
    copyText(accountKey());
  });

  document.querySelector("#reg-name")?.addEventListener("input", (e) => {
    const el = e.currentTarget as HTMLInputElement;
    prefs.name = el.value.slice(0, MAX_NAME);
  });

  document.querySelector("#reg-go")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const nameEl = document.querySelector<HTMLInputElement>("#reg-name");
    const keyEl = document.querySelector<HTMLInputElement>("#reg-key");
    const key = isPlayerKey(keyEl?.value) ? keyEl.value : pendingKey;
    const next = registerAccount({ name: nameEl?.value ?? prefs.name, look: currentLook(), playerKey: key });
    prefs.playerKey = next.playerKey;
    prefs.name = next.name;
    if (next.look) prefs.lookId = next.look;
    savePrefs();
    pendingKey = next.playerKey;
    document.body.classList.remove("register");
    void pushLobby(next);
    notify();
  });

  document.querySelector("#locker-save-look")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const look = packLook(prefs.look);
    const next = saveCharacter(look) ?? registerAccount({ name: prefs.name, look, playerKey: prefs.playerKey });
    prefs.playerKey = next.playerKey;
    prefs.lookId = next.look;
    savePrefs();
    void pushLobby(next);
    notify();
  });

  void (async () => {
    const key = rec?.playerKey;
    if (!key) return;
    try {
      const res = await fetch(`/api/account?key=${encodeURIComponent(key)}`);
      if (!res.ok) return;
      const body = (await res.json()) as { name?: string; look?: string };
      if (typeof body.look === "string" && body.look && body.look !== rec.look) {
        persistAccount({ playerKey: key, name: typeof body.name === "string" ? body.name : rec.name, look: body.look });
        notify();
      }
    } catch {
      /* local cache is enough */
    }
  })();
}
