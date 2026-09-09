# Rifles Only

Rifles-only competitive shooter. The 1.0 mode is **Last Wire** on **Wharf**: Ember vs Stone, first to six rounds, sides swap after five. One team plants the Wire at **Ice** (A) or **Slip** (B); the other cuts it or holds the clock. This repo’s playable build is the browser feelbox — 5v5, bots fill empty seats, a joining human takes a bot’s slot.

The Unity project under `game/` is reference / later work. **Play and deploy the feelbox.**

## Play the same match together

Everyone must hit the **same host** (not each person running a private `npm run dev` without the WebSocket server). The first connected browser is the simulation **host**; other tabs send input and render the host’s snapshots. Empty seats stay bots.

## Local (dev)

```bash
cd feelbox
npm ci
npm run dev:full
```

That starts the match WebSocket on port **8081** and Vite on **5173** (LAN-reachable). On this machine open `http://localhost:5173`. On the LAN, open `http://HOST_IP:5173` (same Wi-Fi; use the host’s IP, not `localhost`).

Client-only (no shared match): `npm run dev` — still Vite on 5173.

## Docker (one port, shared match)

From the repo root or `feelbox/`:

```bash
docker compose up --build
```

Serves the built client **and** the WebSocket match server in one container, bound to `0.0.0.0`.

- Default play URL: `http://HOST_IP:8080`
- Override the published port: `FEELBOX_PORT=9090 docker compose up --build` → `http://HOST_IP:9090`
- WebSocket path: `/ws` (same origin)

Find `HOST_IP` with `ipconfig` / `ifconfig` / `ip addr`. Friends on the LAN use that address, not `127.0.0.1`. For the public internet, forward the play port to this machine.

Pushes to `main` build and publish `ghcr.io/dodgerbluee/rifles-only:latest`. Deploy that image instead of building on the box:

```bash
docker pull ghcr.io/dodgerbluee/rifles-only:latest
docker run --rm -p 8080:8080 ghcr.io/dodgerbluee/rifles-only:latest
```

## Ports

| What | Port |
| --- | --- |
| Docker play (HTTP + `/ws`) | `8080` (`FEELBOX_PORT`) |
| Vite dev | `5173` |
| Dev WebSocket (when using `dev:full`) | `8081` (proxied as `/ws`) |

See [feelbox/README.md](feelbox/README.md) for scripts and wiring notes.
