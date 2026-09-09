# Rifles Only — feelbox

Browser Three.js Last Wire on Wharf. **5v5**, Ember / Stone. Bots fill empty seats; a human join claims a bot slot (`claimSlot`). Wire is planted or cut at **Ice** (A) and **Slip** (B).

The **lobby** serves the client and lists servers. A separate **game** process simulates the match. Browsers only send input and draw snapshots. Restarting the game process starts a fresh match.

## Scripts

```bash
npm ci
npm run dev          # Vite only, port 5173 — server list empty without the game process
npm run dev:full     # game 8081 + lobby API 8080 + Vite 5173
npm start            # same as dev:full
npm run build        # client dist + dedicated game bundle
npm run server       # ROLE=lobby|game via server/start.mjs
npm run docker       # docker compose up --build
```

Dev Vite proxies `/play/ws` → game `:8081/ws` and `/api` → lobby `:8080`.

## LAN / public

1. Run `npm run dev:full` or Docker on the machine that hosts the match.
2. Other players open `http://HOST_IP:PORT` — `5173` in dev, `8080` in Docker.
3. Pick Ember or Stone, join the listed server, then click to play.

```bash
docker compose up --build
# http://192.168.x.x:8080

FEELBOX_PORT=9090 docker compose up --build
```

## Multiplayer

`fetchServers()` fills the start-screen list. Join opens `/play/ws` (lobby proxies to the game). `src/sim.ts` is the authority. Empty seats stay bots.

## Production

`ROLE=lobby` serves `dist/` and proxies `/play/ws`. `ROLE=game` runs `dist-game/game.js`. Same image, two containers.
