/**
 * Master lobby: static client, server list, and a WebSocket proxy onto the
 * dedicated game process. Never simulates the match.
 */
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocket, WebSocketServer } from "ws";
import { createAccountBook, isPlayerKey, publicAccount } from "./accounts.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOST = process.env.HOST ?? "0.0.0.0";
const PORT = Number(process.env.PORT ?? 8080);
const STATIC_ENV = process.env.GAME_STATIC;
const STATIC_DIR = STATIC_ENV === ""
  ? ""
  : path.resolve(ROOT, STATIC_ENV || "dist");
const GAME_WS = process.env.GAME_WS ?? "ws://127.0.0.1:8081/ws";
const STALE_MS = 5000;
const DRAFT_PATH = path.join(ROOT, "studio-draft.json");
const MAPS_DIR = path.join(ROOT, "studio-maps");

function mapFileName(id) {
  const slug = String(id || "draft").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || "draft";
  return `${slug}.json`;
}
const ACCOUNT_PATH = process.env.ACCOUNTS_PATH ?? path.join(ROOT, "accounts.json");
const accounts = createAccountBook(ACCOUNT_PATH);

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

/** @type {Map<string, { id: string, name: string, map: string, mapTitle: string, phase: string, players: number, max: number, online: boolean, seen: number }>} */
const servers = new Map();

function json(res, code, body) {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function readJson(req, max = 16 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let n = 0;
    req.on("data", (c) => {
      n += c.length;
      if (n > max) {
        req.destroy();
        reject(new Error("too large"));
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("bad json"));
      }
    });
    req.on("error", reject);
  });
}

function authPayload(rec) {
  const pub = publicAccount(rec);
  if (!pub) return null;
  return { ok: true, ...pub };
}

function listServers() {
  const now = Date.now();
  const out = [];
  for (const s of servers.values()) {
    out.push({
      id: s.id,
      name: s.name,
      map: s.map,
      mapTitle: s.mapTitle,
      phase: s.phase,
      players: s.players,
      max: s.max,
      online: now - s.seen < STALE_MS,
    });
  }
  return out;
}

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

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (url.pathname === "/health") {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end("ok");
    return;
  }

  if (url.pathname === "/api/servers" && req.method === "GET") {
    json(res, 200, listServers());
    return;
  }

  if (url.pathname === "/api/studio-maps" && req.method === "GET") {
    if (!existsSync(MAPS_DIR)) {
      json(res, 200, []);
      return;
    }
    try {
      const files = readdirSync(MAPS_DIR).filter((f) => f.endsWith(".json"));
      const list = [];
      for (const f of files) {
        try {
          const spec = JSON.parse(readFileSync(path.join(MAPS_DIR, f), "utf8"));
          if (spec?.id && spec.bounds) list.push({ id: spec.id, title: spec.title || spec.id });
        } catch {
          /* skip */
        }
      }
      json(res, 200, list);
    } catch {
      json(res, 200, []);
    }
    return;
  }

  if (url.pathname.startsWith("/api/studio-maps/") && req.method === "GET") {
    const id = decodeURIComponent(url.pathname.slice("/api/studio-maps/".length));
    const file = path.join(MAPS_DIR, mapFileName(id));
    if (!existsSync(file)) {
      json(res, 404, { ok: false });
      return;
    }
    try {
      json(res, 200, JSON.parse(readFileSync(file, "utf8")));
    } catch {
      json(res, 400, { ok: false });
    }
    return;
  }

  if (url.pathname === "/api/studio-maps" && req.method === "POST") {
    const chunks = [];
    let n = 0;
    req.on("data", (c) => {
      n += c.length;
      if (n > 256 * 1024) req.destroy();
      else chunks.push(c);
    });
    req.on("end", () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (!body || typeof body.id !== "string" || !body.bounds) {
          json(res, 400, { ok: false });
          return;
        }
        mkdirSync(MAPS_DIR, { recursive: true });
        const file = path.join(MAPS_DIR, mapFileName(body.id));
        writeFileSync(file, `${JSON.stringify(body, null, 2)}\n`);
        writeFileSync(DRAFT_PATH, `${JSON.stringify(body, null, 2)}\n`);
        json(res, 200, { ok: true, id: body.id });
      } catch {
        json(res, 400, { ok: false });
      }
    });
    return;
  }

  if (url.pathname === "/api/studio-draft" && req.method === "GET") {
    if (!existsSync(DRAFT_PATH)) {
      json(res, 404, { ok: false });
      return;
    }
    try {
      json(res, 200, JSON.parse(readFileSync(DRAFT_PATH, "utf8")));
    } catch {
      json(res, 400, { ok: false });
    }
    return;
  }

  if (url.pathname === "/api/studio-draft" && req.method === "POST") {
    const chunks = [];
    let n = 0;
    req.on("data", (c) => {
      n += c.length;
      if (n > 256 * 1024) req.destroy();
      else chunks.push(c);
    });
    req.on("end", () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (!body || typeof body.id !== "string" || !body.bounds) {
          json(res, 400, { ok: false });
          return;
        }
        writeFileSync(DRAFT_PATH, `${JSON.stringify(body, null, 2)}\n`);
        json(res, 200, { ok: true, path: "studio-draft.json" });
      } catch {
        json(res, 400, { ok: false });
      }
    });
    return;
  }

  if (url.pathname === "/api/register" && req.method === "POST") {
    void readJson(req)
      .then((body) => {
        const result = accounts.signup({
          email: body?.email,
          username: body?.username,
          password: body?.password,
          name: body?.name,
          look: typeof body?.look === "string" ? body.look : "",
        });
        if (!result.ok) {
          const code = result.reason === "username" || result.reason === "email" ? 409 : 400;
          json(res, code, { ok: false, reason: result.reason });
          return;
        }
        const payload = authPayload(result.rec);
        if (!payload) {
          json(res, 500, { ok: false });
          return;
        }
        json(res, 200, payload);
      })
      .catch(() => json(res, 400, { ok: false }));
    return;
  }

  if (url.pathname === "/api/login" && req.method === "POST") {
    void readJson(req)
      .then((body) => {
        const result = accounts.login({
          user: body?.user ?? body?.username ?? body?.email,
          password: body?.password,
        });
        if (!result.ok) {
          json(res, 401, { ok: false, reason: "auth" });
          return;
        }
        const payload = authPayload(result.rec);
        if (!payload) {
          json(res, 401, { ok: false, reason: "auth" });
          return;
        }
        json(res, 200, payload);
      })
      .catch(() => json(res, 400, { ok: false }));
    return;
  }

  if (url.pathname === "/api/account" && req.method === "GET") {
    const key = url.searchParams.get("key") ?? "";
    if (!isPlayerKey(key)) {
      json(res, 400, { ok: false });
      return;
    }
    const rec = accounts.get(key);
    if (!rec) {
      json(res, 404, { ok: false });
      return;
    }
    json(res, 200, { ok: true, name: rec.name, look: rec.look, looks: rec.looks ?? [], username: rec.username ?? "" });
    return;
  }

  if (url.pathname === "/api/account" && req.method === "POST") {
    void readJson(req)
      .then((body) => {
        const rec = accounts.register({
          playerKey: body?.playerKey,
          name: body?.name,
          look: typeof body?.look === "string" ? body.look : "",
        });
        if (!rec) {
          json(res, 400, { ok: false });
          return;
        }
        json(res, 200, { ok: true, name: rec.name, look: rec.look });
      })
      .catch(() => json(res, 400, { ok: false }));
    return;
  }

  if (url.pathname === "/api/heartbeat" && req.method === "POST") {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        const id = typeof body.id === "string" && body.id ? body.id : "default";
        servers.set(id, {
          id,
          name: typeof body.name === "string" ? body.name : "Last Wire",
          map: typeof body.map === "string" ? body.map : "wharf",
          mapTitle: typeof body.mapTitle === "string" ? body.mapTitle : "Wharf",
          phase: typeof body.phase === "string" ? body.phase : "live",
          players: Number(body.players) || 0,
          max: Number(body.max) || 10,
          online: true,
          seen: Date.now(),
        });
        json(res, 200, { ok: true });
      } catch {
        json(res, 400, { ok: false });
      }
    });
    return;
  }

  if (!STATIC_DIR || !existsSync(STATIC_DIR)) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("lobby — no static");
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

const wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 });
const SNAP_SOFT = 24 * 1024;

function droppableSnap(data) {
  const head =
    typeof data === "string"
      ? data.slice(0, 40)
      : Buffer.isBuffer(data)
        ? data.toString("utf8", 0, 40)
        : "";
  return head.includes('"type":"snap"') && head.includes('"u":1');
}

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname !== "/play/ws" && url.pathname !== "/ws") {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
});

wss.on("connection", (client) => {
  const up = new WebSocket(GAME_WS);
  const pending = [];
  let open = false;

  const flush = () => {
    open = true;
    for (const d of pending) {
      if (up.readyState === WebSocket.OPEN) up.send(d);
    }
    pending.length = 0;
  };

  up.on("open", flush);
  up.on("message", (data, isBinary) => {
    if (client.readyState !== WebSocket.OPEN) return;
    if (droppableSnap(data) && client.bufferedAmount > SNAP_SOFT) return;
    client.send(data, { binary: isBinary });
  });
  up.on("close", (code, reason) => {
    try {
      client.close(code, reason.toString());
    } catch {
      /* ignore */
    }
  });
  up.on("error", () => {
    try {
      client.close(1011, "game down");
    } catch {
      /* ignore */
    }
  });

  client.on("message", (data, isBinary) => {
    if (!open) {
      pending.push(data);
      return;
    }
    if (up.readyState === WebSocket.OPEN) up.send(data, { binary: isBinary });
  });
  client.on("close", () => {
    try {
      up.close();
    } catch {
      /* ignore */
    }
  });
  client.on("error", () => {
    try {
      up.close();
    } catch {
      /* ignore */
    }
  });
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref?.();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

server.listen(PORT, HOST, () => {
  const mode = STATIC_DIR && existsSync(STATIC_DIR) ? `static ${STATIC_DIR}` : "api only";
  console.log(`Rifles Only lobby ${mode} on http://${HOST}:${PORT}  (proxy ${GAME_WS})`);
});
