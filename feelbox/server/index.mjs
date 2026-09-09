/**
 * One room. Relays host snapshots to everyone and client inputs/events to the host.
 * Does not simulate physics. First living socket is host; disconnect promotes the next.
 */
import { spawn } from "node:child_process";
import { createReadStream, existsSync, statSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocket, WebSocketServer } from "ws";

const DEV = process.argv.includes("--dev");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOST = process.env.HOST ?? "0.0.0.0";
const PORT = Number(process.env.PORT ?? (DEV ? 8081 : 8080));
const STATIC_ENV = process.env.GAME_STATIC;
const STATIC_DIR = DEV || STATIC_ENV === ""
  ? ""
  : path.resolve(ROOT, STATIC_ENV || "dist");

const HEARTBEAT_MS = 15_000;
const DEAD_MS = 45_000;
const HELLO_MS = 5_000;
const MAX_NAME = 24;

const MIME = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".map": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

/** @typedef {{ id: number, name: string, ws: import("ws").WebSocket, role: "host" | "client", lastSeen: number, helloed: boolean }} Peer */

/** @type {Map<number, Peer>} */
const peers = new Map();
let nextId = 1;
let hostId = 0;

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

function promote() {
  const open = living();
  const keep = open.find((p) => p.id === hostId) ?? open[0] ?? null;
  const next = keep?.id ?? 0;
  if (next === hostId) return;
  hostId = next;
  for (const p of open) {
    const role = p.id === hostId ? "host" : "client";
    if (p.role !== role) {
      p.role = role;
      send(p.ws, { type: "welcome", id: p.id, role });
    }
  }
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
    for (const o of living()) send(o.ws, { type: "peerLeave", id });
  }
  if (id === hostId) promote();
}

function parseJson(raw) {
  if (typeof raw !== "string" && !Buffer.isBuffer(raw)) return null;
  try {
    const msg = JSON.parse(typeof raw === "string" ? raw : raw.toString("utf8"));
    return msg && typeof msg === "object" ? msg : null;
  } catch {
    return null;
  }
}

function cleanName(value, id) {
  if (typeof value !== "string") return `Rifle ${id}`;
  const n = value.trim().slice(0, MAX_NAME);
  return n || `Rifle ${id}`;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname === "/health") {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end("ok");
    return;
  }
  if (!STATIC_DIR || !existsSync(STATIC_DIR)) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end(DEV ? "dev ws — use Vite on 5173" : "no static");
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405);
    res.end();
    return;
  }
  const file = resolveStatic(STATIC_DIR, url.pathname);
  if (!file) {
    res.writeHead(403);
    res.end();
    return;
  }
  if (!existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404);
    res.end();
    return;
  }
  const ext = path.extname(file);
  res.writeHead(200, { "content-type": MIME[ext] ?? "application/octet-stream" });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  createReadStream(file).pipe(res);
});

function resolveStatic(root, pathname) {
  let rel = decodeURIComponent(pathname.split("?")[0] || "/");
  if (rel === "/") rel = "/index.html";
  const full = path.normalize(path.join(root, rel));
  const rootN = path.normalize(root + path.sep);
  if (full !== path.normalize(root) && !full.startsWith(rootN)) return null;
  if (existsSync(full) && statSync(full).isDirectory()) {
    return path.join(full, "index.html");
  }
  if (existsSync(full) && statSync(full).isFile()) return full;
  if (!path.extname(rel)) return path.join(root, "index.html");
  return full;
}

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
  /** @type {Peer} */
  const peer = { id, name: `Rifle ${id}`, ws, role: "client", lastSeen: Date.now(), helloed: false };
  peers.set(id, peer);

  const helloTimer = setTimeout(() => {
    if (!peer.helloed) drop(id, "no hello");
  }, HELLO_MS);

  ws.on("message", (raw) => {
    peer.lastSeen = Date.now();
    const msg = parseJson(raw);
    if (!msg || typeof msg.type !== "string") return;

    if (msg.type === "pong") return;

    if (msg.type === "hello") {
      if (peer.helloed) return;
      peer.helloed = true;
      clearTimeout(helloTimer);
      peer.name = cleanName(msg.name, id);
      if (!living().some((p) => p.id !== id && p.role === "host")) {
        hostId = id;
        peer.role = "host";
      } else {
        peer.role = "client";
      }
      send(ws, { type: "welcome", id, role: peer.role });
      for (const o of living()) {
        if (o.id === id) continue;
        send(ws, { type: "peerJoin", id: o.id, name: o.name });
        send(o.ws, { type: "peerJoin", id, name: peer.name });
      }
      return;
    }

    if (!peer.helloed) return;

    if (msg.type === "snapshot") {
      if (id !== hostId) return;
      const snap = msg.snapshot ?? msg;
      for (const o of living()) send(o.ws, { type: "snapshot", snapshot: snap });
      return;
    }

    if (msg.type === "input") {
      if (id === hostId) return;
      const host = peers.get(hostId);
      if (!host) return;
      send(host.ws, { type: "input", peerId: id, input: msg.input ?? msg });
      return;
    }

    if (msg.type === "event") {
      const host = peers.get(hostId);
      if (!host) return;
      send(host.ws, { type: "event", peerId: id, event: msg.event });
      return;
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

const beat = setInterval(() => {
  const now = Date.now();
  for (const p of [...peers.values()]) {
    if (now - p.lastSeen > DEAD_MS) {
      drop(p.id, "timeout");
      continue;
    }
    send(p.ws, { type: "ping", t: now });
  }
}, HEARTBEAT_MS);
beat.unref?.();

function shutdown() {
  clearInterval(beat);
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
  const mode = STATIC_DIR && existsSync(STATIC_DIR) ? `static ${STATIC_DIR}` : "ws only";
  console.log(`Rifles Only ${mode} on http://${HOST}:${PORT}  (/ws)`);
});

if (DEV) {
  const vite = path.join(ROOT, "node_modules", ".bin", "vite");
  const child = spawn(vite, ["--open"], { stdio: "inherit", cwd: ROOT });
  child.on("exit", (code) => {
    if (code) process.exit(code);
  });
}
