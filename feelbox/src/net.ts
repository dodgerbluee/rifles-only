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
  kills?: number;
  assists?: number;
  deaths?: number;
  ping?: number;
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

export type KillFeedItem = {
  killerId: number;
  killerName: string;
  victimId: number;
  victimName: string;
};

/** Occasional client → host actions (join seat, throw smoke, plant/cut). */
export type ClientEvent =
  | { kind: "joinTeam"; team: Team; name: string }
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
  | { kind: "shot"; ox: number; oy: number; oz: number; dx: number; dy: number; dz: number };

export type NetEvent = ClientEvent & { peerId?: number };

export type Snapshot = {
  phase: Phase;
  round: number;
  emberScore: number;
  stoneScore: number;
  swapped: boolean;
  clock: number;
  wireTime: number;
  wire: WireSnap;
  pawns: Pawn[];
  feed: KillFeedItem[];
  events: NetEvent[];
  clouds?: { x: number; y: number; z: number; radius: number; opacity: number }[];
  mapId?: string;
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

export function setNetName(name: string) {
  helloName = name.trim().slice(0, 18) || "You";
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
      rawSend({ type: "hello", name: helloName });
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
