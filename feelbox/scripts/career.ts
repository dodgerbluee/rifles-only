/**
 * Career merge, ingest idempotency, and sim round drain.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  boardSnippet,
  CAREER_BOT,
  createCareerBook,
  emptyCareer,
  ingestCareer,
  publicCareer,
} from "../server/career.mjs";
import { generatePlayerKey } from "../server/accounts.mjs";
import { noteKill, noteRifleHit, noteShot, resetStats, roundLine } from "../src/stats.ts";
import { createSim } from "../src/sim.ts";

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
}

resetStats();
noteShot(1);
noteShot(1);
noteRifleHit(1, true);
noteKill(1, 2, 1, { head: true, way: "aimed" });
const round = roundLine(1);
check("shots count misses and hits", round.shots === 2);
check("head hit and rifle kill", round.hits === 1 && round.headHits === 1 && round.headKills === 1 && round.rifleKills === 1);
check("first blood on first kill", round.firstBloods === 1);

const a = generatePlayerKey();
const b = generatePlayerKey();
const data = { players: {}, seen: [] as string[] };
const body = {
  gameId: "wharf-1",
  matchId: "m1",
  round: 1,
  kind: "round" as const,
  lines: [
    {
      playerKey: a,
      kills: 3,
      assists: 1,
      deaths: 1,
      won: true,
      shots: 10,
      hits: 4,
      damage: 250,
      vs: [{ key: b, kills: 2, deaths: 0, damage: 150 }],
    },
  ],
};
check("first ingest applies", ingestCareer(data, body).ok === true && data.players[a].kills === 3);
check("duplicate ingest is a no-op", ingestCareer(data, body).duplicate === true && data.players[a].kills === 3);
const otherBox = { ...body, gameId: "ice-1" };
check("same round on another GAME_ID still applies", ingestCareer(data, otherBox).ok === true && data.players[a].kills === 6);
check("bots are not stored as players", !data.players[CAREER_BOT]);

ingestCareer(data, {
  gameId: "wharf-1",
  matchId: "m1",
  round: 1,
  kind: "match",
  lines: [{ playerKey: a, matchWon: true }],
});
check("match bump is separate from rounds", data.players[a].matches === 1 && data.players[a].matchWins === 1 && data.players[a].rounds === 2);

const pub = publicCareer(data.players[a], { [b]: "osa" });
check("public ratios include K/D", !!pub && pub.kd > 0);
check("board omits vs", !("vs" in (boardSnippet(data.players[a]) ?? { vs: 1 })));

{
  const empty = { players: {}, seen: [] as string[] };
  const blank = {
    gameId: "wharf-1",
    matchId: "m-empty",
    round: 9,
    kind: "round" as const,
    lines: [{ playerKey: "not-a-key", kills: 1 }],
  };
  const miss = ingestCareer(empty, blank);
  check("empty/invalid lines do not burn seen", miss.ok === false && miss.reason === "lines" && empty.seen.length === 0);
  blank.lines = [{ playerKey: a, kills: 1, won: true }];
  check("retry after empty lines still applies", ingestCareer(empty, blank).ok === true && empty.players[a]?.kills === 1);
}

const many = emptyCareer(a);
for (let i = 0; i < 40; i++) {
  ingestCareer(
    { players: { [a]: many }, seen: [] },
    {
      gameId: "x",
      matchId: `m${i}`,
      round: 1,
      kind: "round",
      lines: [
        {
          playerKey: a,
          kills: 1,
          won: false,
          vs: [{ key: generatePlayerKey(), kills: 1, deaths: 0, damage: 10 }],
        },
      ],
    },
  );
}
check("vs cap stays at 32", Object.keys(many.vs).length <= 32);

const dir = mkdtempSync(join(tmpdir(), "rifles-career-"));
try {
  const book = createCareerBook(join(dir, "career.json"));
  const key = generatePlayerKey();
  book.ingest({
    gameId: "default",
    matchId: "disk",
    round: 2,
    kind: "round",
    lines: [{ playerKey: key, kills: 4, deaths: 1, won: true }],
  });
  check("disk round trip keeps kills", book.get(key)?.kills === 4);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

const reed = generatePlayerKey();
const osa = generatePlayerKey();
const sim = createSim({ name: "Last Wire", freezeTime: 0.05, perTeam: 2, highlights: false, botSkill: "easy", firstTo: 8 });
sim.join(1, "Reed", "ember", undefined, undefined, reed);
sim.join(2, "Osa", "stone", undefined, undefined, osa);
for (let i = 0; i < 40; i++) sim.tick(0.05);
const snap = sim.snapshot();
check("joined pawns carry playerKey", snap.pawns.some((p) => p.playerKey === reed) && snap.pawns.some((p) => p.playerKey === osa));
for (const p of snap.pawns) {
  if (p.team === "stone") sim.slay(p.id);
}
sim.tick(0.05);
const drain = sim.drainCareer();
const reedLine = drain.round?.lines.find((l) => l.playerKey === reed);
check("settle ingests registered humans", !!drain.round && drain.round.kind === "round");
check("bots are omitted from ingest", !drain.round?.lines.some((l) => !l.playerKey.startsWith("rk_")));
check("round win flags the living side", reedLine?.won === true, `won=${reedLine?.won} winner lines=${drain.round?.lines.map((l) => `${l.playerKey.slice(0, 8)}:${l.won}`)}`);
check("cow slay is not career damage", (reedLine?.damage ?? 0) === 0);

const again = sim.drainCareer();
check("drain is take-once", !again.round && !again.match);

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\ncareer ingest and round drain check out");
