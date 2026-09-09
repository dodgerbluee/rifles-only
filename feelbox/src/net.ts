/**
 * Browser is always a client of a dedicated game process. Input goes out;
 * snapshots come in.
 */
export type NetRole = "host" | "client" | "offline";

export type Team = "ember" | "stone";
export type Phase = "freeze" | "live" | "planted" | "settle" | "bestplay" | "ending" | "matchover";
export type SiteId = "ice" | "slip";
export type Weapon = "kar" | "mosin" | "rifle" | "knife" | "smoke" | "frag" | "stun" | "flash";

export type PlayerInput = {
  keys: string[];
  yaw: number;
  pitch: number;
  fire: boolean;
  ads: boolean;
  lean: number;
  weapon: Weapon;
  crouch: boolean;
  prone?: boolean;
  jump: boolean;
  use: boolean;
  mx: number;
  my: number;
  ping?: number;
};

export type Pawn = {
  id: number;
  netId?: number;
  name: string;
  occupant?: string;
  team: Team;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  hp: number;
  alive: boolean;
  weapon: Weapon;
  ads: boolean;
  crouch?: boolean;
  prone?: boolean;
  absent?: boolean;
  nades?: { smoke: number; frag: number; stun: number; flash: number };
  kills?: number;
  assists?: number;
  deaths?: number;
  ping?: number;
  stun?: boolean;
  skin?: "rifle" | "field" | "unit" | "frame";
};

export type WireSnap = {
  mode: "carried" | "ground" | "planted";
  carrierId: number | null;
  site: SiteId | null;
  x: number;
  y: number;
  z: number;
  plantHold: number;
  cutHold: number;
};

export type KillWay = "aimed" | "noscope" | "nade" | "knife" | "bomb" | "cow";

export function killWayLabel(way?: KillWay, head = false) {
  if (head) return way === "aimed" ? "aimed headshot" : "headshot";
  if (way === "aimed") return "aimed";
  if (way === "noscope") return "no scope";
  if (way === "nade") return "nade";
  if (way === "knife") return "knife";
  if (way === "bomb") return "bomb";
  if (way === "cow") return "cow'd";
  return "kill";
}

function svg(body: string) {
  return `<svg viewBox="0 0 20 20" aria-hidden="true">${body}</svg>`;
}

const ICONS: Record<KillWay, string> = {
  aimed: svg(
    `<circle cx="10" cy="10" r="6.2" fill="none" stroke="currentColor" stroke-width="1.5"/>` +
      `<circle cx="10" cy="10" r="2.1" fill="none" stroke="currentColor" stroke-width="1.3"/>` +
      `<path d="M10 2.2v2.4M10 15.4v2.4M2.2 10h2.4M15.4 10h2.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>`,
  ),
  noscope: svg(
    `<path d="M10 1v5M10 14v5M1 10h5M14 10h5" fill="none" stroke="currentColor" stroke-width="0.75" stroke-linecap="round"/>`,
  ),
  nade: svg(
    `<path d="M6.4 8.5c0-1.35 1.55-2.15 3.6-2.15s3.6.8 3.6 2.15v6.5c0 1.75-1.55 2.65-3.6 2.65s-3.6-.9-3.6-2.65Z" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linejoin="round"/>` +
      `<path d="M6.55 11h6.9M6.55 13.7h6.9M10 6.5v11.4" fill="none" stroke="currentColor" stroke-width="1.1"/>` +
      `<path d="M8.7 6.4V4.9h2.6V6.4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>` +
      `<circle cx="13.6" cy="4.2" r="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/>`,
  ),
  knife: svg(
    `<path d="M8.8 12.1 11.4 5.6 14.8 2.2 18 1.4 14.6 5.5 11.4 11.1 9.2 13.1Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>` +
      `<circle cx="12.3" cy="6.5" r="1.2" fill="none" stroke="currentColor" stroke-width="1.15"/>` +
      `<path d="M6.6 13.4Q4.2 16.2 3 19.2" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round"/>` +
      `<path d="M10.8 13Q8.4 15.8 7.2 18.8" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round"/>` +
      `<path d="M6.6 13.4 10.8 13M3 19.2 7.2 18.8M5.4 16.3 8.6 15.9" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>` +
      `<circle cx="8.4" cy="12.4" r=".55" fill="currentColor"/>` +
      `<circle cx="9.8" cy="11.8" r=".55" fill="currentColor"/>`,
  ),
  bomb: svg(
    `<rect x="4.6" y="8.2" width="10.8" height="7.4" rx="1.3" fill="none" stroke="currentColor" stroke-width="1.45"/>` +
      `<path d="M10 8.2V4.1M10 4.1l1.6-1.3" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/>` +
      `<path d="M7.1 11.2h5.8M7.1 13.6h3.6" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>`,
  ),
  cow: svg(
    `<path d="M5 8.5 3.2 5.2 6.4 6.8h7.2L16.8 5.2 15 8.5v5.2H5V8.5Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>` +
      `<circle cx="8" cy="10.4" r="0.8" fill="currentColor"/>` +
      `<circle cx="12" cy="10.4" r="0.8" fill="currentColor"/>`,
  ),
};

const HEAD_ICON = svg(
  `<circle cx="7.2" cy="8.2" r="3.1" fill="none" stroke="currentColor" stroke-width="1.45"/>` +
    `<path d="M4.4 12.6c.6-1.5 1.6-2.2 2.8-2.2s2.2.7 2.8 2.2" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/>` +
    `<path d="M18 6.2l-5.6 3.1 1.1 1.1 1.5-.4" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<circle cx="12.6" cy="9.2" r="0.7" fill="currentColor"/>`,
);

export function killWayIcons(way?: KillWay, head = false, _rifle?: "kar" | "mosin") {
  const parts: string[] = [];
  if (way === "aimed") parts.push(ICONS.aimed);
  else if (way === "noscope" && !head) parts.push(ICONS.noscope);
  else if (way && way !== "noscope") parts.push(ICONS[way]);
  if (head) parts.push(HEAD_ICON);
  if (!parts.length) parts.push(ICONS.noscope);
  return { html: parts.join(""), label: killWayLabel(way, head) };
}

export type KillFeedItem = {
  t?: number;
  killerId: number;
  killerName: string;
  killerTeam?: Team;
  victimId: number;
  victimName: string;
  victimTeam?: Team;
  way?: KillWay;
  head?: boolean;
  rifle?: "kar" | "mosin";
};

/** Occasional client → host actions (join seat, throw smoke, plant/cut). */
export type ClientEvent =
  | { kind: "joinTeam"; team: Team; name: string; skin?: "rifle" | "field" | "unit" | "frame" }
  | {
      kind: "throwSmoke";
      ox: number;
      oy: number;
      oz: number;
      dx: number;
      dy: number;
      dz: number;
      power?: number;
      nade?: "smoke" | "frag" | "stun" | "flash";
    }
  | { kind: "plant" }
  | { kind: "cut" }
  | { kind: "dropWire" }
  | { kind: "pickupWire" }
  | { kind: "changeMap"; mapId: string }
  | { kind: "restart" }
  | { kind: "addBot"; team: Team }
  | { kind: "removeBot"; team: Team }
  | { kind: "kick"; slotId: number }
  | { kind: "takeover"; slotId: number }
  | { kind: "cow"; slotId: number }
  | {
      kind: "rules";
      highlights?: boolean;
      friendlyFire?: boolean;
      oneShot?: boolean;
      botSkill?: "easy" | "normal" | "hard";
    }
  | { kind: "shot"; ox: number; oy: number; oz: number; dx: number; dy: number; dz: number }
  | { kind: "melee"; ox: number; oy: number; oz: number; dx: number; dy: number; dz: number; bash?: boolean }
  | { kind: "skipRecap" };

export type NetEvent = ClientEvent & { peerId?: number };

export type Snapshot = {
  phase: Phase;
  round: number;
  emberScore: number;
  stoneScore: number;
  swapped: boolean;
  clock: number;
  time?: number;
  wireTime: number;
  wire: WireSnap;
  pawns: Pawn[];
  feed: KillFeedItem[];
  events: NetEvent[];
  clouds?: { x: number; y: number; z: number; radius: number; opacity: number }[];
  nades?: { x: number; y: number; z: number; kind: "smoke" | "frag" | "stun" | "flash" }[];
  pops?: { kind: "smoke" | "frag" | "stun" | "flash"; x: number; y: number; z: number }[];
  headPops?: number[];
  endText?: string;
  lastWinner?: Team | null;
  mapId?: string;
  nextMap?: string;
  endT?: number;
};

export type NetHandle = {
  role: NetRole;
  status: "offline" | "connecting" | "client";
  attempt: number;
  peerId: number | null;
  pingMs: number;
  sendInput(input: PlayerInput): void;
  sendSnapshot(snap: Snapshot): void;
  sendEvent(event: ClientEvent): void;
  onRole(cb: (role: NetRole, peerId: number) => void): void;
  onStatus(cb: (status: NetHandle["status"], attempt: number) => void): void;
  onInput(cb: (peerId: number, input: PlayerInput) => void): void;
  onSnapshot(cb: (snap: Snapshot) => void): void;
  onEvent(cb: (peerId: number, event: ClientEvent) => void): void;
  onPeerJoin(cb: (peer: { id: number; name: string }) => void): void;
  onPeerLeave(cb: (id: number) => void): void;
  destroy(): void;
};

const BACKOFF = [400, 800, 1600, 3200, 5000];

export const SERVER_GONE_MS = 30_000;

export function serverGone(started: boolean, lastBeat: number, now: number, timeout = SERVER_GONE_MS) {
  return started && lastBeat > 0 && now - lastBeat >= timeout;
}

export function defaultNetUrl(): string {
  return playWsUrl();
}

export function playWsUrl(): string {
  if (typeof location === "undefined" || !location.host) return "ws://127.0.0.1:8081/ws";
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/play/ws`;
}

export type ListedServer = {
  id: string;
  name: string;
  map: string;
  mapTitle: string;
  phase: string;
  players: number;
  max: number;
  online: boolean;
};

export async function fetchServers(): Promise<ListedServer[]> {
  try {
    const res = await fetch("/api/servers");
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    return Array.isArray(data) ? (data as ListedServer[]) : [];
  } catch {
    return [];
  }
}

let helloName = "You";
let helloSkin: "rifle" | "field" | "unit" | "frame" = "rifle";

export function setNetName(name: string) {
  helloName = name.trim().slice(0, 18) || "You";
}

export function setNetSkin(skin: "rifle" | "field" | "unit" | "frame") {
  helloSkin = skin;
}

export function connectNet(url?: string): NetHandle {
  const target = url ?? playWsUrl();
  let ws: WebSocket | null = null;
  let dead = false;
  let tries = 0;
  let reconnectTimer = 0;
  let rttTimer = 0;

  const statusCbs: Array<(status: NetHandle["status"], attempt: number) => void> = [];
  const roleCbs: Array<(role: NetRole, peerId: number) => void> = [];
  const inputCbs: Array<(peerId: number, input: PlayerInput) => void> = [];
  const snapCbs: Array<(snap: Snapshot) => void> = [];
  const eventCbs: Array<(peerId: number, event: ClientEvent) => void> = [];
  const joinCbs: Array<(peer: { id: number; name: string }) => void> = [];
  const leaveCbs: Array<(id: number) => void> = [];

  const handle: NetHandle = {
    role: "offline",
    status: "connecting",
    attempt: 1,
    peerId: null,
    pingMs: 0,
    sendInput(input) {
      if (handle.role !== "client") return;
      rawSend({ type: "input", input });
    },
    sendSnapshot() {
      /* dedicated game process is the authority */
    },
    sendEvent(event) {
      rawSend({ type: "event", event });
    },
    onRole(cb) {
      roleCbs.push(cb);
    },
    onStatus(cb) {
      statusCbs.push(cb);
    },
    onInput(cb) {
      inputCbs.push(cb);
    },
    onSnapshot(cb) {
      snapCbs.push(cb);
    },
    onEvent(cb) {
      eventCbs.push(cb);
    },
    onPeerJoin(cb) {
      joinCbs.push(cb);
    },
    onPeerLeave(cb) {
      leaveCbs.push(cb);
    },
    destroy() {
      dead = true;
      clearTimeout(reconnectTimer);
      clearInterval(rttTimer);
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
      ws = null;
      setOffline();
    },
  };

  function emitStatus() {
    for (const cb of statusCbs) cb(handle.status, handle.attempt);
  }

  function setConnecting() {
    handle.status = "connecting";
    handle.role = "offline";
    handle.peerId = null;
    emitStatus();
  }

  function setOffline() {
    const wasClient = handle.role === "client";
    handle.status = "offline";
    handle.role = "offline";
    handle.peerId = null;
    emitStatus();
    if (wasClient) {
      for (const cb of roleCbs) cb("offline", 0);
    }
  }

  function setRole(role: NetRole, peerId: number) {
    handle.role = role;
    handle.status = role === "client" ? "client" : "offline";
    handle.peerId = role === "offline" ? null : peerId;
    emitStatus();
    for (const cb of roleCbs) cb(role, role === "offline" ? 0 : peerId);
  }

  function rawSend(obj: unknown) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(JSON.stringify(obj));
    } catch {
      /* ignore */
    }
  }

  function parse(raw: string): Record<string, unknown> | null {
    try {
      const msg = JSON.parse(raw) as unknown;
      return msg && typeof msg === "object" ? (msg as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }

  function onMessage(ev: MessageEvent) {
    const msg = parse(typeof ev.data === "string" ? ev.data : "");
    if (!msg || typeof msg.type !== "string") return;

    if (msg.type === "ping") {
      rawSend({ type: "pong" });
      return;
    }
    if (msg.type === "rtt") {
      const t = Number(msg.t);
      if (Number.isFinite(t)) handle.pingMs = Math.max(0, performance.now() - t);
      return;
    }
    if (msg.type === "welcome") {
      const id = Number(msg.id);
      const role = "client";
      if (!Number.isFinite(id)) return;
      tries = 0;
      handle.attempt = 1;
      setRole(role, id);
      return;
    }
    if (msg.type === "snapshot") {
      const snap = (msg.snapshot ?? msg) as Snapshot;
      if (!snap || !Array.isArray(snap.pawns)) return;
      for (const cb of snapCbs) cb(snap);
      return;
    }
    if (msg.type === "input") {
      const peerId = Number(msg.peerId);
      const input = msg.input as PlayerInput;
      if (!Number.isFinite(peerId) || !input) return;
      for (const cb of inputCbs) cb(peerId, input);
      return;
    }
    if (msg.type === "event") {
      const peerId = Number(msg.peerId);
      const event = msg.event as ClientEvent;
      if (!Number.isFinite(peerId) || !event) return;
      for (const cb of eventCbs) cb(peerId, event);
      return;
    }
    if (msg.type === "peerJoin") {
      const id = Number(msg.id);
      const name = typeof msg.name === "string" ? msg.name : `Rifle ${id}`;
      if (!Number.isFinite(id)) return;
      for (const cb of joinCbs) cb({ id, name });
      return;
    }
    if (msg.type === "peerLeave") {
      const id = Number(msg.id);
      if (!Number.isFinite(id)) return;
      for (const cb of leaveCbs) cb(id);
    }
  }

  function open() {
    if (dead) return;
    handle.attempt = Math.max(1, tries + 1);
    setConnecting();
    try {
      ws = new WebSocket(target);
    } catch {
      schedule();
      return;
    }
    ws.addEventListener("open", () => {
      rawSend({ type: "hello", name: helloName, skin: helloSkin });
    });
    ws.addEventListener("message", onMessage);
    ws.addEventListener("close", () => {
      ws = null;
      if (dead) return;
      const wasClient = handle.role === "client";
      handle.role = "offline";
      handle.peerId = null;
      if (wasClient) {
        for (const cb of roleCbs) cb("offline", 0);
      }
      setConnecting();
      schedule();
    });
    ws.addEventListener("error", () => {
      /* close handler reconnects */
    });
  }

  function schedule() {
    if (dead) return;
    const wait = BACKOFF[Math.min(tries, BACKOFF.length - 1)]!;
    tries += 1;
    handle.attempt = tries + 1;
    emitStatus();
    reconnectTimer = window.setTimeout(open, wait);
  }

  rttTimer = window.setInterval(() => {
    if (handle.role !== "client") return;
    rawSend({ type: "rtt", t: performance.now() });
  }, 2000);

  open();
  return handle;
}
