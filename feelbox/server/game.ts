/**
 * Dedicated Last Wire instance. All browsers are clients. Restarting this
 * process starts a fresh match.
 */
import http from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { createSim } from "../src/sim";
import { loadServerConfig } from "./config";

const HOST = process.env.HOST ?? "0.0.0.0";
const PORT = Number(process.env.PORT ?? 8081);
const LOBBY_URL = process.env.LOBBY_URL ?? "";
const GAME_ID = process.env.GAME_ID ?? "default";
const cfg = loadServerConfig();
const GAME_NAME = process.env.GAME_NAME ?? cfg.name;
const HEARTBEAT_MS = 15_000;
const DEAD_MS = 45_000;
const HELLO_MS = 5_000;
const SNAP_HZ = 30;
const TICK_HZ = 30;
const LOBBY_BEAT_MS = 2000;
const MAX_NAME = 24;

/** @typedef {{ id: number, name: string, ws: import("ws").WebSocket, helloed: boolean, lastSeen: number }} Peer */

const sim = createSim({
  id: GAME_ID,
  name: GAME_NAME,
  mapId: cfg.map,
  perTeam: cfg.perTeam,
  rotation: cfg.rotation,
  firstTo: cfg.firstTo,
  swapAfter: cfg.swapAfter,
  freezeTime: cfg.freezeTime,
  championsHold: cfg.championsHold,
  botSkill: cfg.botSkill,
  highlights: cfg.highlights,
  friendlyFire: cfg.friendlyFire,
  oneShot: cfg.oneShot,
});
/** @type {Map<number, any>} */
const peers = new Map();
let nextId = 1;

function send(ws, obj) {
  if (ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(obj));
  } catch {
    /* ignore */
  }
}

function living() {
  return [...peers.values()].filter((p) => p.helloed && p.ws.readyState === WebSocket.OPEN);
}

function cleanName(value, id) {
  if (typeof value !== "string") return `Rifle ${id}`;
  const n = value.trim().slice(0, MAX_NAME);
  return n || `Rifle ${id}`;
}

function drop(id, reason) {
  const p = peers.get(id);
  if (!p) return;
  peers.delete(id);
  try {
    p.ws.close(1000, reason);
  } catch {
    /* ignore */
  }
  if (p.helloed) {
    sim.leave(id);
    for (const o of living()) send(o.ws, { type: "peerLeave", id });
  }
}

function parseJson(raw) {
  if (typeof raw !== "string" && !Buffer.isBuffer(raw)) return null;
  try {
    const msg = JSON.parse(typeof raw === "string" ? raw.toString("utf8") : raw.toString("utf8"));
    return msg && typeof msg === "object" ? msg : null;
  } catch {
    return null;
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname === "/health" || url.pathname === "/status") {
    const body = url.pathname === "/health" ? "ok" : JSON.stringify(sim.status());
    res.writeHead(200, { "content-type": url.pathname === "/health" ? "text/plain; charset=utf-8" : "application/json" });
    res.end(body);
    return;
  }
  res.writeHead(404);
  res.end("game ws");
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 });

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname !== "/ws") {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
});

wss.on("connection", (ws) => {
  const id = nextId++;
  const peer = { id, name: `Rifle ${id}`, ws, helloed: false, lastSeen: Date.now() };
  peers.set(id, peer);

  const helloTimer = setTimeout(() => {
    if (!peer.helloed) drop(id, "no hello");
  }, HELLO_MS);

  ws.on("message", (raw) => {
    peer.lastSeen = Date.now();
    const msg = parseJson(raw);
    if (!msg || typeof msg.type !== "string") return;
    if (msg.type === "pong") return;
    if (msg.type === "rtt") {
      const t = Number(msg.t);
      if (Number.isFinite(t)) send(ws, { type: "rtt", t });
      return;
    }

    if (msg.type === "hello") {
      if (peer.helloed) return;
      peer.helloed = true;
      clearTimeout(helloTimer);
      peer.name = cleanName(msg.name, id);
      sim.join(id, peer.name);
      send(ws, { type: "welcome", id, role: "client" });
      for (const o of living()) {
        if (o.id === id) continue;
        send(ws, { type: "peerJoin", id: o.id, name: o.name });
        send(o.ws, { type: "peerJoin", id, name: peer.name });
      }
      return;
    }

    if (!peer.helloed) return;

    if (msg.type === "input") {
      sim.setInput(id, msg.input ?? msg);
      return;
    }
    if (msg.type === "event") {
      sim.event(id, msg.event);
    }
  });

  ws.on("close", () => {
    clearTimeout(helloTimer);
    if (peers.has(id)) drop(id, "closed");
  });
  ws.on("error", () => {
    clearTimeout(helloTimer);
    if (peers.has(id)) drop(id, "error");
  });
});

let last = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  sim.tick(dt);
}, 1000 / TICK_HZ).unref?.();

setInterval(() => {
  const snap = sim.snapshot();
  for (const p of living()) send(p.ws, { type: "snapshot", snapshot: snap });
}, 1000 / SNAP_HZ).unref?.();

setInterval(() => {
  const now = Date.now();
  for (const p of [...peers.values()]) {
    if (now - p.lastSeen > DEAD_MS) {
      drop(p.id, "timeout");
      continue;
    }
    send(p.ws, { type: "ping", t: now });
  }
}, HEARTBEAT_MS).unref?.();

async function beatLobby() {
  if (!LOBBY_URL) return;
  try {
    await fetch(new URL("/api/heartbeat", LOBBY_URL), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sim.status()),
    });
  } catch {
    /* lobby may be restarting */
  }
}

if (LOBBY_URL) {
  setInterval(() => {
    void beatLobby();
  }, LOBBY_BEAT_MS).unref?.();
  void beatLobby();
}

function shutdown() {
  for (const p of peers.values()) {
    try {
      p.ws.close();
    } catch {
      /* ignore */
    }
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref?.();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

server.listen(PORT, HOST, () => {
  console.log(`Rifles Only game ${GAME_NAME} on http://${HOST}:${PORT}  (/ws)`);
});
