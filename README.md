# Rifles Only

Rifles-only competitive shooter. The 1.0 mode is **Last Wire** on **Wharf**: Ember vs Stone, first to six rounds, sides swap after five. One team plants the Wire at **Ice** (A) or **Slip** (B); the other cuts it or holds the clock. This repo’s playable build is the browser feelbox — 5v5, bots fill empty seats, a joining human takes a bot’s slot.

The Unity project under `game/` is reference / later work. **Play and deploy the feelbox.**

## Play the same match together

Two processes: a **lobby** that serves the client and lists servers, and a **game** instance that actually simulates Last Wire. Browsers never host. Restarting the game container starts a fresh match.

## Local (dev)

```bash
cd feelbox
npm ci
npm run dev:full
```

That starts the dedicated match on **8081**, the lobby API on **8080**, and Vite on **5173**. Open `http://localhost:5173`, pick Ember/Stone, join the listed server, then click to play. On the LAN, open `http://HOST_IP:5173`.

Client-only (`npm run dev`) still opens Vite, but the server list stays empty until the game process is running.

## Docker (one public port)

From the repo root (pulls the published image):

```bash
docker compose up -d
```

- Lobby: `http://HOST_IP:8080` (static client + `/api/servers` + `/play/ws` proxy)
- Game: internal `8081` (simulation). Restart this container to reset the match.
- Logins, bans, and saved studio maps persist in `./data` (`accounts.json`). Override with `FEELBOX_DATA=/path`.
- Override the published port: `FEELBOX_PORT=9090 docker compose -f feelbox/docker-compose.yml up --build`

Build from source: `docker compose -f feelbox/docker-compose.yml up --build`.

## Ports

| What | Port |
| --- | --- |
| Docker lobby (HTTP + `/play/ws`) | `8080` (`FEELBOX_PORT`) |
| Dedicated game (internal) | `8081` |
| Vite dev | `5173` |
| Dev lobby API | `8080` |
| Dev game WebSocket | `8081` |

See [feelbox/README.md](feelbox/README.md) for scripts and wiring notes.
