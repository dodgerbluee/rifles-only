# Rifles Only — feelbox

Browser Three.js Last Wire on Wharf. **5v5**, Ember / Stone. Bots fill empty seats; a human join claims a bot slot (`claimSlot`). Wire is planted or cut at **Ice** (A) and **Slip** (B).

This is a **shared match**: one WebSocket room. The first living client is the simulation host (the existing game loop stays in that tab). Everyone else sends input and draws the host snapshot. Opening only `npm run dev` without the Node server is a private solo session.

## Scripts

```bash
npm ci
npm run dev          # Vite only, port 5173, --open (solo unless a server is already up)
npm run dev:full     # WebSocket on 8081 + Vite on 5173 (LAN-reachable)
npm start            # same as dev:full
npm run build        # tsc --noEmit && vite build
npm run server       # production: static dist/ + /ws on PORT (default 8080)
npm run docker       # docker compose up --build
```

Dev Vite proxies `/ws` → `ws://127.0.0.1:8081`. The client default URL is `ws://${location.host}/ws`, so Docker (`:8080/ws`) and Vite (`:5173/ws`) both work.

## LAN / public

1. Run `npm run dev:full` or Docker on the **host** machine.
2. Other players open `http://HOST_IP:PORT` — `5173` in dev, `8080` in Docker.
3. Do not give them `localhost` unless they are on the same machine.

```bash
# Docker, default
docker compose up --build
# http://192.168.x.x:8080

FEELBOX_PORT=9090 docker compose up --build
# http://192.168.x.x:9090
```

The process listens on `0.0.0.0`. Publish that port through your router if you want the public internet.

## Multiplayer

`connectNet()` in `src/net.ts` is wired from `main.ts`. The first browser is the **host** (simulates the match). Later browsers send input and draw the host snapshot. Bots fill empty seats. `npm run dev` without the Node server is solo (WebSocket reconnects quietly in the background).

## Production server

`node server/index.mjs` serves `dist/` when it exists (or `GAME_STATIC`) and upgrades `/ws`. Unset `GAME_STATIC` in `--dev` so only the socket listens (Vite serves the page).
