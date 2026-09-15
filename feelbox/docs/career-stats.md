# Career stats (lobby)

Plan for tracking registered players across matches and showing them their data.
Identity is the account `playerKey` (`rk_` + 32 hex), not the display name and
not the match seat id.

This is the design. Implementation should follow the phases at the bottom.
Do not start with extra Tab columns or a live event stream.

## Why the lobby

Two containers already exist:

| Process | Role | Disk |
| --- | --- | --- |
| **lobby** (`ROLE=lobby`, `server/lobby.mjs`) | Static client, `/api/*`, `/play/ws` proxy, `accounts.json` | `/data` |
| **game** (`ROLE=game`, `server/game.ts`) | Last Wire sim, 60 Hz tick, 30 Hz packed snaps | same `/data` in Docker, often **not** shared in other deploys |

The game process is disposable: restarting it starts a fresh match. Accounts
already live on the lobby. Career must too.

Do **not** let the game write `career.json` even when `/data` is shared. Two
processes rewriting the same JSON will race. The game already POSTs
`/api/heartbeat` every 2s; career ingest is the same direction, a different
endpoint, and much rarer.

The client talks to the lobby for register/login/account. Career reads use that
same HTTP path. Career never rides the snapshot wire.

```
sim (slot id)  --round settle-->  POST /api/career/ingest  -->  lobby career.json
client Tab     <-- ident K/A/D --  packed snap (this match only)
client locker  <-- GET /api/career?key=rk_... ------------  lobby
```

## Many game servers

Career is **one record per `playerKey` on one lobby**. Playing on two Last Wire
boxes must add into the same K/D. That is the point of a registration id. Do
not shard `career.json` by server.

A **game server id already exists**: `GAME_ID` (env, default `"default"`). The
lobby’s `/api/heartbeat` Map is already keyed by it. Career ingest sends that
same id. Do not mint a second identifier.

| Key | Whose | Lifetime | Job |
| --- | --- | --- | --- |
| `playerKey` | account / lobby | forever | Career primary key. Your record. |
| `GAME_ID` | this game container | as long as the compose service | Which box sent the round. Server list, ingest idempotency, optional per-box rollup. |
| `matchId` | this match | until `restartMatch` or process restart | Round 3 on box A ≠ round 3 on box B, and ≠ the next match on the same box. |

`GAME_ID` is **instance identity**. Put it on the **game service in compose**,
not as the only copy inside `server.json`. `server.json` is match rules (map,
first-to, friendly fire) and can be shared or pointed at with `SERVER_CONFIG`.
Two containers from the same image need two ids; env is how you tell them
apart:

```yaml
# today
game:
  environment:
    GAME_ID: default
    GAME_NAME: Last Wire

# later, still one lobby, two matches
game-wharf:
  environment:
    GAME_ID: wharf-1
    GAME_NAME: Wharf 1
    LOBBY_URL: http://lobby:8080
game-ice:
  environment:
    GAME_ID: ice-1
    GAME_NAME: Ice 1
    LOBBY_URL: http://lobby:8080
```

Slug: lowercase `a-z0-9-`, stable. Changing `GAME_ID` on a live box makes the
lobby treat it as a new row; old heartbeat key goes stale. Optional later:
`id` in `server.json` as a default, overridden by `GAME_ID` (same pattern as
`GAME_NAME` / `GAME_MAP`). Compose remains the source of truth for “this
container is box X”.

Idempotency is `"${gameId}:${matchId}:${round}:${kind}"`. Two boxes can both
finish round 3 in the same second; without `gameId` those ingest ids collide
and one round is dropped. `matchId` is still required because `GAME_ID` is
stable across match restarts.

**Do not** give two game services the same `GAME_ID`. Heartbeats already
overwrite each other in `servers.set(id, …)`. Career would then be the smaller
problem.

Optional later, not phase 1: a compact `byServer[gameId]` rollup on the career
line (kills / deaths / rounds / wins, cap ~8 boxes). Locker still shows the
merged totals. Per-box stats are a filter, not a second dataset.

The real partition is **lobby**, not game. A second lobby is a second
`accounts.json` and a second `career.json`. Player keys do not transfer.
Community servers that share this lobby share career; a private lobby does not
mix with yours.

Joining more than one box is a **proxy** change, not a career change. Today
`GAME_WS` is a single upstream (`ws://game:8081/ws`). A second game service
needs the lobby to route `/play/ws?server=wharf-1` (or similar) from the
server-list id. Heartbeat should carry that ws URL (or the lobby keeps a
compose map of `GAME_ID` → `ws://…`). Career ingest does not wait on that:
every game already knows `LOBBY_URL` and POSTs.

## Two layers

### Match board (game, already exists)

`src/stats.ts` is keyed by **slot id**. Kills / assists / deaths reset on
`restartMatch`. Snapshots already send those three on identity rows
(`netWire.ts` `identRow`), plus `playerKey` stamped in `server/game.ts`.

Tab (`renderScoreboard` in `src/hud.ts`) is this match: Player, K, A, D, K/D, Ping.

Expand the match `Line` with extra **integers** (damage, shots, nade damage,
…). Keep them on identity rows. Identity is not on hot pose snaps; it is resent
when the signature changes (a kill already does this) or every 45 snaps. A
handful of extra ints is cheap. Do not add maps, strings, or head-to-head onto
the snap.

Stamp `playerKey` onto the **slot** at join, not only the peer. `stampKeys`
today looks up `peers.get(pawn.netId)`. A disconnect drops the key before the
round can be ingested.

### Career (lobby, new)

Keyed by **playerKey**. Survives game restarts, match restarts, and hopping
between game boxes on this lobby. Bots are never written. Unregistered clients
cannot join (`admitPlayer` already requires a well-formed key).

Derived ratios (K/D, accuracy, HS%, round-win %, ADR, avg nade damage) are
computed on read. Store only counters.

## Do not make the match slower

Allowed in the 60 Hz sim:

- `n++` / `n += dmg` on combat paths that already run (`remoteFireAt`,
  `shotPeople`, `hurtRemote`, `hurtBot`, `applyNadePop`, `frag`, `finish`).
- One compact JSON POST at **round settle**, fire-and-forget. Never await it
  on the tick.

Forbidden:

- Disk I/O from `game.ts` / `sim.ts`.
- Per-shot network, heatmaps, traces, or replay logs for stats.
- Career blobs on 30 Hz snaps.
- Piggybacking career on `/api/heartbeat` (2s, public, already unauthenticated).
- Client-reported increments (the browser is not the authority).

Ingest body target: a few KB, at most ten humans, once per round (~90s), not
per tick.

## Data

Persist `/data/career.json` next to `accounts.json`. Keep it out of the account
record so looks / password hashes stay small and head-to-head maps do not
rewrite the login book.

```ts
type CareerLine = {
  playerKey: string;
  // scoreboard
  kills: number;
  assists: number;
  deaths: number;
  // rounds / matches
  matches: number;
  matchWins: number;
  rounds: number;
  roundWins: number;
  // aiming
  shots: number;      // rifle cycle actually fired
  hits: number;       // rifle hit a body
  headHits: number;   // rifle mesh part === "head"
  headKills: number;  // rifle kill with head flag
  rifleKills: number; // aimed + noscope, not knife/nade/wire
  // damage
  damage: number;     // HP actually applied (rifle + knife + frag)
  nadeDamage: number; // frag HP only
  nadesFrag: number;  // frags thrown
  nadesSmoke: number;
  nadesStun: number;
  nadesFlash: number;
  nadeKills: number;
  // Last Wire
  plants: number;
  cuts: number;
  knifeKills: number;
  firstBloods: number;
  aces: number;       // 5 kills in one round
  // head-to-head, bounded
  vs: Record<string, VsLine>; // opponent playerKey, or "bot"
};

type VsLine = {
  kills: number;
  deaths: number;
  damage: number;
  rounds: number;
  roundWins: number; // rounds you won while both were in the match
};
```

Cap `vs` at **32** opponents per player (drop the least-`rounds` entry, then
oldest). All bots collapse to the synthetic key `"bot"`. Do not store bot
display names.

Idempotency on ingest:

```ts
type Ingest = {
  token: string;          // shared INGEST_TOKEN, header or body
  gameId: string;         // GAME_ID — unique per game service, not a career shard
  matchId: string;        // new uuid (or start ms) on process start / restartMatch
  round: number;
  kind: "round" | "match";
  lines: Array<{
    playerKey: string;
    // deltas for this round only, not career totals
    kills: number;
    assists: number;
    deaths: number;
    won: boolean;         // their team == lastWinner
    matchOver: boolean;
    matchWon: boolean;
    shots: number;
    hits: number;
    headHits: number;
    headKills: number;
    rifleKills: number;
    damage: number;
    nadeDamage: number;
    nadesFrag: number;
    nadesSmoke: number;
    nadesStun: number;
    nadesFlash: number;
    nadeKills: number;
    plants: number;
    cuts: number;
    knifeKills: number;
    firstBlood: boolean;
    aces: number;
    vs: Array<{ key: string } & Omit<VsLine, "rounds" | "roundWins"> & {
      rounds?: number;
      roundWins?: number;
    }>;
  }>;
};
```

Lobby remembers `"${gameId}:${matchId}:${round}:${kind}"` (last ~200 ids) and
ignores duplicates. Game may retry. Do not ingest the same round twice.

`kind: "match"` only bumps `matches` / `matchWins`. Round counters are only
on `kind: "round"`.

## Where to increment (game)

All of this already happens. Add counters next to the existing call.

| Event | Hook | Notes |
| --- | --- | --- |
| Rifle fired | `remoteFireAt` / `botShoot` after cycle check | `shots++`. Bots can count for the match board; career only if the seat has a `playerKey` (humans). |
| Rifle hit | `shotPeople` when a body is hit | `hits++`. If `userData.part === "head"`, `headHits++`. |
| Damage | `hurtRemote` / `hurtBot` with the amount actually subtracted | Skip wire-blast (`way === "bomb"`) and admin cow from career damage. |
| Kill | `frag` | Existing `noteKill`. If `head`, `headKills++`. If `way` is aimed/noscope, `rifleKills++`. Knife / nade similarly. First kill of the round → `firstBlood`. |
| Frag pop | `applyNadePop` | Record damage from the falloff that is actually applied. `throwerId` already exists on nades. |
| Nade thrown | throw path (`kind: nade` event) | Per-kind thrown counts, including smokes that deal no damage. |
| Plant / cut | `plantWire` / cut finish | Credit `carrierId` / the cutter actor. |
| Round over | `finish()` in `match.ts` | Snapshot each human's match `Line` + `won` from `lastWinner`. Ace = 5+ kills that round (reset a per-round kill tally in `frag`). |
| Match over | `concludeBestPlay` when `matchOverPending` | One `kind: "match"` ingest. |

Takeover: keep using `creditId`. Career maps the **home seat** to that peer's
`playerKey`. Takeover kills stay on the bot seat and do not go to the human
career (same rule as the current scoreboard).

Do not count freeze-time shots (combat is already gated by `roundCombatOpen`).

## Lobby API

New module `server/career.mjs`, wired from `server/lobby.mjs`.

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| POST | `/api/career/ingest` | game | Apply round/match deltas. Requires `INGEST_TOKEN` (header `x-ingest-token`). 401 if the token is set and wrong. In Docker, set the same env on both services. Dev may leave it empty and only accept from loopback. |
| GET | `/api/career?key=rk_…` | client | Full public career for locker / home. Ratios included. `vs` resolved to `{ key, username, kills, deaths, … }` via the account book (no email). |
| GET | `/api/career/board?keys=rk_a,rk_b` | client | Tiny public snippets for Tab: `{ kills, deaths, kd, roundWinPct, matches }`. Max 16 keys. Cached in the browser ~30s. |

Do not authenticate GET with anything stronger than “knows the playerKey”.
That is already how `/api/account?key=` works. Do not return email, hash, or
ban lists.

Heartbeat stays as it is. Do not expand it.

## UI

### Tab (this match)

Keep K / A / D / K/D / Ping as the live match line. That is the CS hold-Tab
job. Do not add eight career columns; the board already shrinks on small
screens.

Phase 1 career use of Tab: after the board keys are known, GET
`/api/career/board` and paint a muted career K/D (or round-win %) after the
name. Optional later: a second compact row (ADR, HS%, Acc) using **match**
`Line` extras, not career.

Head-to-head on Tab: if you and that row both have keys, show a small `2–1`
from *your* career `vs[theirKey]` (kills–deaths, or round W–L — pick round W–L
and label it). Fetch once when Tab is first held this session.

### Player locker / home

This is where the fun sheet lives. Under the existing Player locker
(`#locker`), a **Season** block (name it “Record”, not a league):

- Matches W–L, round-win %
- K / A / D, K/D
- ADR (`damage / max(rounds,1)`), accuracy (`hits / shots`), HS% (`headKills / rifleKills`)
- Nades: frag damage, avg per frag thrown, nade kills, smokes/stuns thrown
- Last Wire: plants, cuts, aces, first bloods, knife kills
- Rivals: up to ~8 `vs` rows with username + W–L + K/D against them

Home identity (`#home-id`): one line under the username,
`12–4 · 1.18 K/D`, fetched with the existing `/api/account` paint.

Podium can keep K/A/D for the match. Optional: ADR on the gold line from the
match `Line`, not career.

## Fun stats, cheap vs skip

Cheap (integer on an existing event):

- Scoreboard set + round-win %
- Accuracy, head-hit %, head-kill %
- Total damage, ADR
- Nade damage, avg per frag, nade kills, utility thrown
- Plants, cuts
- Knife kills, first blood, aces
- Head-to-head vs registered humans + one bot bucket
- Per-map W–L later (`maps: { wharf: { rounds, wins } }`) — few ids, still cheap
- Per-box rollup later (`byServer[gameId]`) — filter, not a second career file

Skip for now (cost or noise):

- Damage heatmaps, shot logs, distance buckets
- Stun “time blinded” (needs per-tick or extra timers)
- Average damage per nade *that dealt damage* as a second average — maybe later
- Per-rifle splits (Kar / Mosin / scoped) — add a 3-wide counter if it stays fun
- Time alive / survival % (doable at `finish`, not needed in phase 1)
- Client-side estimates when the lobby is down — show match numbers only

## Files

| File | Change |
| --- | --- |
| `src/stats.ts` | Expand `Line`; `noteShot` / `noteDamage` / `noteNade` / per-round reset helpers. `resetStats` still clears the match. |
| `src/sim.ts` | Call those helpers from fire/hit/frag/nade/plant. Export `boardLines()` for ingest. Detect settle → callback. |
| `src/match.ts` | Optional `onRoundEnd` / return winner + cutter/planter ids. Keep `finish` the single round-end chokepoint. |
| `src/hud.ts` / `index.html` | Career snippet on Tab; Record block in locker. |
| `src/account.ts` | Fetch career when identity paints. |
| `server/game.ts` | Slot `playerKey`; on settle/matchover POST ingest; `INGEST_TOKEN`; `matchId`. |
| `server/career.mjs` | Load/save/merge/idempotency/bounds. |
| `server/lobby.mjs` | Routes above. |
| `server/accounts.mjs` | Username lookup for `vs` display only. |
| `docker-compose.yml` + `feelbox/docker-compose.yml` | `INGEST_TOKEN` on lobby + every game service. Unique `GAME_ID` per game service (already `default`). |
| `scripts/career.ts` | Merge, duplicate ingest, vs cap, bot bucket, derived ratios. |
| `scripts/kill-hud.ts` | Tab still holds; extra snippet does not break layout tests. |
| `scripts/account.ts` | Career file does not leak into public account. |

## Tests

Follow the existing `npx tsx scripts/*.ts` style (see `scripts/account.ts`).

- Ingest twice with the same `matchId+round` → counters move once.
- Bot seats are omitted from `lines`.
- `vs` cap 32; `"bot"` is one entry.
- Frag falloff damage is what was applied, not a constant.
- Rifle miss increments `shots` and not `hits`.
- Head mesh kill increments `headKills` and `rifleKills`.
- Wire-blast / cow damage does not inflate career `damage`.
- GET board does not include `vs` (keep it small).
- Empty token rejected when `INGEST_TOKEN` is set.
- Two ingests, same `matchId+round`, different `gameId` → both apply.
- Two ingests, same `gameId+matchId+round` → counters move once.

## Phases

Ship in this order so Tab and locker are useful before the exotic stuff.

1. **Match extras + slot keys** — expand `Line`, hook fire/hit/damage/nade in
   `sim.ts`, stamp `playerKey` on slots. Tab can show match ADR/HS later; not
   required to merge this phase.
2. **Lobby career for the Tab set** — `career.mjs`, ingest on settle, GET for
   locker + home: K/A/D, matches W–L, round-win %. This is the first player-
   visible persistence.
3. **Aiming + damage + nades** — shots/hits/head, damage, ADR, frag averages.
   Record block in the locker.
4. **Head-to-head + Tab snippet** — bounded `vs`, rival list, muted career
   figures on Tab names.

Phase 2 is the one that makes “track by registration id on the lobby” real.
Phases 3–4 are additive counters and UI, not a new pipeline.
