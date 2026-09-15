/**
 * Login and the server list must not wait on WebGL. Brave on Linux often
 * throws while creating the game renderer; the home screen still has to work.
 */
import { bindIdentity, isRegistered, openLogin } from "./account";
import { fetchServers, type ListedServer } from "./servers";

export type JoinHandler = (name: string) => void;

export const GL_BOOT_ERROR =
  "Graphics failed to start. In Brave on Linux, disable Shields for this site, turn on hardware acceleration (brave://settings/system), and check brave://gpu.";

let joinHandler: JoinHandler | null = null;
let pendingJoin: string | null = null;
let identityOnChange: (() => void) | null = null;
let identityOnRegistered: (() => void) | null = null;
let bootError = "";
let started = false;

export function setJoinHandler(fn: JoinHandler | null) {
  joinHandler = fn;
  if (fn && pendingJoin) {
    const name = pendingJoin;
    pendingJoin = null;
    fn(name);
  }
}

export function setIdentityHandlers(handlers: { onChange?: () => void; onRegistered?: () => void }) {
  if (handlers.onChange) identityOnChange = handlers.onChange;
  if (handlers.onRegistered) identityOnRegistered = handlers.onRegistered;
}

export function showBootError(message = GL_BOOT_ERROR) {
  bootError = message;
  const list = document.querySelector("#server-list");
  if (list) ensureBootNotice(list);
}

export function requestJoin(name: string) {
  if (!isRegistered()) {
    openLogin();
    return;
  }
  if (joinHandler) {
    joinHandler(name);
    return;
  }
  pendingJoin = name;
}

export function paintServerList(list: HTMLElement, servers: ListedServer[], onJoin: (name: string) => void) {
  list.replaceChildren();
  if (bootError) ensureBootNotice(list);
  if (!servers.length) {
    const p = document.createElement("p");
    p.className = "server-empty";
    p.textContent = "No servers · start the game process";
    list.append(p);
    return;
  }
  for (const s of servers) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "server-row";
    if (!s.online) {
      row.disabled = true;
      row.dataset.offline = "1";
    }
    const name = document.createElement("span");
    name.className = "s-name";
    name.textContent = s.name;
    const map = document.createElement("span");
    map.className = "s-map";
    map.textContent = s.mapTitle;
    const pop = document.createElement("span");
    pop.className = "s-pop";
    pop.textContent = `${s.players}/${s.max}`;
    const phase = document.createElement("span");
    phase.className = "s-phase";
    phase.textContent = s.online ? s.phase : "offline";
    const join = document.createElement("span");
    join.className = "s-join";
    join.textContent = s.online ? "Join" : "Offline";
    row.append(name, map, pop, phase, join);
    row.addEventListener("click", (ev) => {
      ev.stopPropagation();
      onJoin(s.name);
    });
    list.append(row);
  }
}

function ensureBootNotice(list: Element) {
  if (!bootError) return;
  const existing = list.querySelector(".boot-error");
  if (existing) {
    existing.textContent = bootError;
    return;
  }
  const p = document.createElement("p");
  p.className = "server-empty boot-error";
  p.textContent = bootError;
  list.prepend(p);
}

export async function refreshLobby() {
  const list = document.querySelector<HTMLElement>("#server-list");
  if (!list || list.hidden) return;
  const servers = await fetchServers();
  if (list.hidden) return;
  paintServerList(list, servers, requestJoin);
}

export function startLobby() {
  if (started) return;
  started = true;
  bindIdentity({
    onChange: () => identityOnChange?.(),
    onRegistered: () => identityOnRegistered?.(),
  });
  const list = document.querySelector<HTMLElement>("#server-list");
  list?.addEventListener("click", (e) => e.stopPropagation());
  void refreshLobby();
  window.setInterval(() => {
    void refreshLobby();
  }, 2000);
}

export function __resetLobbyForTests() {
  joinHandler = null;
  pendingJoin = null;
  identityOnChange = null;
  identityOnRegistered = null;
  bootError = "";
  started = false;
}
