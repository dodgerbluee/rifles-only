import { packLook, parseLook } from "./look";
import { onPrefsSaved, prefs, savePrefs } from "./prefs";

export const ACCOUNT_KEY = "rifles-only-account";

export type AccountRecord = {
  playerKey: string;
  username: string;
  name: string;
  look: string;
  looks: string[];
};

export type KV = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
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

export function cleanName(value: unknown): string {
  if (typeof value !== "string") return "";
  const n = value.trim().slice(0, MAX_NAME);
  return !n || /^you$/i.test(n) ? "" : n;
}

export function cleanUsername(value: unknown): string {
  if (typeof value !== "string") return "";
  const s = value.trim().toLowerCase();
  return /^[a-z0-9_]{3,18}$/.test(s) ? s : "";
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
    return {
      playerKey: p.playerKey,
      username: cleanUsername(p.username),
      name: cleanName(p.name),
      look,
      looks,
    };
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
): AccountRecord | null {
  const prev = store ? loadAccount(store) : null;
  const playerKey = isPlayerKey(patch.playerKey) ? patch.playerKey : prev?.playerKey;
  if (!isPlayerKey(playerKey)) return null;
  const name = patch.name != null ? cleanName(patch.name) : prev?.name ?? "";
  const username = patch.username != null ? cleanUsername(patch.username) : prev?.username ?? "";
  const look = patch.look != null ? cleanLook(patch.look) : prev?.look ?? "";
  let looks = prev?.looks ? [...prev.looks] : [];
  if (Array.isArray(patch.looks)) looks = patch.looks.map(cleanLook).filter(Boolean);
  if (look && !looks.includes(look)) looks.unshift(look);
  const rec: AccountRecord = { playerKey, username, name, look, looks };
  store?.setItem(ACCOUNT_KEY, JSON.stringify(rec));
  return rec;
}

export function applySession(
  input: { playerKey: string; username?: string; name?: string; look?: string; looks?: string[] },
  store: KV | null = defaultStore(),
): AccountRecord | null {
  if (!isPlayerKey(input.playerKey)) return null;
  const look = cleanLook(input.look);
  const looks = Array.isArray(input.looks) ? input.looks.map(cleanLook).filter(Boolean) : look ? [look] : [];
  return persistAccount(
    {
      playerKey: input.playerKey,
      username: cleanUsername(input.username),
      name: cleanName(input.name),
      look,
      looks,
    },
    store,
  );
}

export function saveCharacter(look: string, store: KV | null = defaultStore()): AccountRecord | null {
  const prev = store ? loadAccount(store) : null;
  if (!prev) return null;
  return persistAccount({ ...prev, look: cleanLook(look) }, store);
}

export function clearAccount(store: KV | null = defaultStore()) {
  store?.removeItem?.(ACCOUNT_KEY);
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
  if (!loadAccount() && !prefs.playerKey) return;
  persistAccount({
    playerKey: prefs.playerKey || accountKey(),
    name: prefs.name,
    look: prefs.lookId || packLook(prefs.look),
  });
}

onPrefsSaved(persistPrefsAccount);

type AuthBody = {
  ok?: boolean;
  reason?: string;
  playerKey?: string;
  username?: string;
  name?: string;
  look?: string;
  looks?: string[];
};

async function postAuth(path: string, body: Record<string, string>): Promise<AuthBody> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  let data: AuthBody = {};
  try {
    data = (await res.json()) as AuthBody;
  } catch {
    data = {};
  }
  if (!res.ok || !data.ok) return { ok: false, reason: data.reason || (res.status === 401 ? "auth" : "invalid") };
  return data;
}

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

function setErr(sel: string, message: string) {
  const el = document.querySelector<HTMLElement>(sel);
  if (!el) return;
  el.textContent = message;
  el.hidden = !message;
}

function authCopy(mode: "register" | "login") {
  const kicker = document.querySelector("#auth-kicker");
  if (kicker) kicker.textContent = mode === "login" ? "Log in" : "Register";
}

function showAuth(mode: "register" | "login") {
  const reg = document.querySelector<HTMLElement>("#auth-register");
  const login = document.querySelector<HTMLElement>("#auth-login");
  if (reg) reg.hidden = mode !== "register";
  if (login) login.hidden = mode !== "login";
  authCopy(mode);
}

function fillIdentity(rec: AccountRecord | null) {
  const panel = document.querySelector<HTMLElement>("#register");
  if (panel) panel.hidden = !!rec;
  document.body.classList.toggle("register", !rec);
  const home = document.querySelector<HTMLElement>("#home-id");
  if (home) home.classList.toggle("on", !!rec);
  if (!rec) {
    const login = document.querySelector<HTMLElement>("#auth-login");
    showAuth(login && !login.hidden ? "login" : "register");
  }
  const name = rec?.username || rec?.name || "";
  const nameEls = ["#locker-name", "#set-name", "#home-id-name"] as const;
  for (const sel of nameEls) {
    const el = document.querySelector<HTMLInputElement | HTMLElement>(sel);
    if (!el) continue;
    if (el instanceof HTMLInputElement) {
      if (el !== document.activeElement) el.value = name;
    } else {
      el.textContent = name;
    }
  }
}

function takeSession(data: AuthBody): AccountRecord | null {
  if (!isPlayerKey(data.playerKey)) return null;
  const next = applySession({
    playerKey: data.playerKey,
    username: data.username,
    name: data.name,
    look: data.look || currentLook(),
    looks: data.looks,
  });
  if (!next) return null;
  prefs.playerKey = next.playerKey;
  prefs.name = next.username || next.name;
  if (next.look) prefs.lookId = next.look;
  savePrefs();
  return next;
}

export function paintIdentity() {
  const rec = loadAccount();
  document.body.classList.toggle("register", !rec);
  fillIdentity(rec);
}

export function bindIdentity(opts?: { onChange?: () => void; onRegistered?: () => void }) {
  const rec = loadAccount();
  if (rec) {
    prefs.playerKey = rec.playerKey;
    prefs.name = rec.username || rec.name;
  }
  document.body.classList.toggle("register", !rec);
  fillIdentity(rec);

  const notify = () => {
    syncAccountToPrefs();
    fillIdentity(loadAccount());
    opts?.onChange?.();
  };

  const logout = () => {
    prefs.playerKey = "";
    clearAccount();
    savePrefs();
    showAuth("login");
    notify();
  };

  document.querySelector("#home-logout")?.addEventListener("click", (e) => {
    e.stopPropagation();
    logout();
  });

  document.querySelector("#auth-to-login")?.addEventListener("click", (e) => {
    e.stopPropagation();
    setErr("#reg-err", "");
    showAuth("login");
  });
  document.querySelector("#auth-to-register")?.addEventListener("click", (e) => {
    e.stopPropagation();
    setErr("#login-err", "");
    showAuth("register");
  });

  document.querySelector("#auth-register")?.addEventListener("submit", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const email = document.querySelector<HTMLInputElement>("#reg-email")?.value ?? "";
    const username = document.querySelector<HTMLInputElement>("#reg-user")?.value ?? "";
    const password = document.querySelector<HTMLInputElement>("#reg-pass")?.value ?? "";
    const go = document.querySelector<HTMLButtonElement>("#reg-go");
    if (go) go.disabled = true;
    setErr("#reg-err", "");
    void (async () => {
      try {
        const data = await postAuth("/api/register", {
          email,
          username,
          password,
          name: username.trim().slice(0, 18),
          look: currentLook(),
        });
        if (!data.ok) {
          const reason = data.reason;
          setErr(
            "#reg-err",
            reason === "username"
              ? "That username is taken."
              : reason === "email"
                ? "That email is already registered."
                : reason === "password"
                  ? "Password must be at least 8 characters."
                  : reason === "username-invalid"
                    ? "Username must be 3–18 letters, numbers, or _."
                    : reason === "email-invalid"
                      ? "Enter a valid email."
                      : "Could not create the account.",
          );
          return;
        }
        const next = takeSession(data);
        if (!next) {
          setErr("#reg-err", "Could not create the account.");
          return;
        }
        document.body.classList.remove("register");
        notify();
        opts?.onRegistered?.();
      } catch {
        setErr("#reg-err", "Could not reach the server.");
      } finally {
        if (go) go.disabled = false;
      }
    })();
  });

  document.querySelector("#auth-login")?.addEventListener("submit", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const user = document.querySelector<HTMLInputElement>("#login-user")?.value ?? "";
    const password = document.querySelector<HTMLInputElement>("#login-pass")?.value ?? "";
    const go = document.querySelector<HTMLButtonElement>("#login-go");
    if (go) go.disabled = true;
    setErr("#login-err", "");
    void (async () => {
      try {
        const data = await postAuth("/api/login", { user, password });
        if (!data.ok) {
          setErr("#login-err", "Wrong username or password.");
          return;
        }
        const next = takeSession(data);
        if (!next) {
          setErr("#login-err", "Wrong username or password.");
          return;
        }
        document.body.classList.remove("register");
        notify();
      } catch {
        setErr("#login-err", "Could not reach the server.");
      } finally {
        if (go) go.disabled = false;
      }
    })();
  });

  document.querySelector("#locker-save-look")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const look = packLook(prefs.look);
    const next = saveCharacter(look);
    if (!next) return;
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
      const body = (await res.json()) as { name?: string; look?: string; username?: string };
      if (typeof body.look === "string" && body.look && body.look !== rec.look) {
        persistAccount({
          playerKey: key,
          username: typeof body.username === "string" ? body.username : rec.username,
          name: typeof body.name === "string" ? body.name : rec.name,
          look: body.look,
        });
        notify();
      }
    } catch {
      /* local cache is enough */
    }
  })();
}
