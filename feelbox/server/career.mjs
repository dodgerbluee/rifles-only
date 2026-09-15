/**
 * Lobby career book: playerKey → counters across matches on this lobby.
 * Game boxes POST deltas; the lobby merges. Do not shard by GAME_ID.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { defaultDataDir, isPlayerKey } from "./accounts.mjs";

const VS_CAP = 32;
const SEEN_CAP = 200;
const BOT_KEY = "bot";

export const CAREER_BOT = BOT_KEY;

export function defaultCareerPath(root) {
  return process.env.CAREER_PATH ?? path.join(defaultDataDir(root), "career.json");
}

function emptyVs() {
  return { kills: 0, deaths: 0, damage: 0, rounds: 0, roundWins: 0 };
}

export function emptyCareer(playerKey = "") {
  return {
    playerKey,
    kills: 0,
    assists: 0,
    deaths: 0,
    matches: 0,
    matchWins: 0,
    rounds: 0,
    roundWins: 0,
    shots: 0,
    hits: 0,
    headHits: 0,
    headKills: 0,
    rifleKills: 0,
    damage: 0,
    nadeDamage: 0,
    nadesFrag: 0,
    nadesSmoke: 0,
    nadesStun: 0,
    nadesFlash: 0,
    nadeKills: 0,
    plants: 0,
    cuts: 0,
    knifeKills: 0,
    firstBloods: 0,
    aces: 0,
    vs: {},
  };
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function cleanVsKey(value) {
  if (value === BOT_KEY) return BOT_KEY;
  return isPlayerKey(value) ? value : "";
}

function addVs(line, key, delta) {
  const id = cleanVsKey(key);
  if (!id) return;
  const prev = line.vs[id] ?? emptyVs();
  line.vs[id] = {
    kills: prev.kills + num(delta.kills),
    deaths: prev.deaths + num(delta.deaths),
    damage: prev.damage + num(delta.damage),
    rounds: prev.rounds + num(delta.rounds),
    roundWins: prev.roundWins + num(delta.roundWins),
  };
}

function trimVs(line) {
  const keys = Object.keys(line.vs);
  if (keys.length <= VS_CAP) return;
  const ranked = keys
    .map((k) => ({ k, v: line.vs[k] }))
    .sort((a, b) => a.v.rounds - b.v.rounds || a.v.kills - b.v.kills || a.v.damage - b.v.damage);
  for (const row of ranked.slice(0, keys.length - VS_CAP)) {
    if (row.k === BOT_KEY) continue;
    delete line.vs[row.k];
  }
  const leftover = Object.keys(line.vs);
  if (leftover.length > VS_CAP) {
    const drop = leftover.filter((k) => k !== BOT_KEY).sort((a, b) => line.vs[a].rounds - line.vs[b].rounds);
    for (const k of drop.slice(0, leftover.length - VS_CAP)) delete line.vs[k];
  }
}

const COUNTERS = [
  "kills",
  "assists",
  "deaths",
  "shots",
  "hits",
  "headHits",
  "headKills",
  "rifleKills",
  "damage",
  "nadeDamage",
  "nadesFrag",
  "nadesSmoke",
  "nadesStun",
  "nadesFlash",
  "nadeKills",
  "plants",
  "cuts",
  "knifeKills",
  "firstBloods",
  "aces",
];

function applyRound(line, delta) {
  for (const k of COUNTERS) line[k] += num(delta[k]);
  line.rounds += 1;
  if (delta.won) line.roundWins += 1;
  const vs = Array.isArray(delta.vs) ? delta.vs : [];
  for (const row of vs) addVs(line, row.key, { ...row, rounds: 1, roundWins: delta.won ? 1 : 0 });
  trimVs(line);
}

function applyMatch(line, delta) {
  line.matches += 1;
  if (delta.matchWon) line.matchWins += 1;
}

function pct(n, d) {
  if (!d) return 0;
  return n / d;
}

export function careerRatios(line) {
  const rounds = Math.max(0, line.rounds);
  const shots = Math.max(0, line.shots);
  const rifleKills = Math.max(0, line.rifleKills);
  const nadesFrag = Math.max(0, line.nadesFrag);
  return {
    kd: line.deaths <= 0 ? (line.kills === 0 ? 0 : line.kills) : line.kills / line.deaths,
    accuracy: pct(line.hits, shots),
    hsPct: pct(line.headKills, rifleKills),
    roundWinPct: pct(line.roundWins, rounds),
    matchWinPct: pct(line.matchWins, line.matches),
    adr: rounds ? line.damage / rounds : 0,
    nadeAvg: nadesFrag ? line.nadeDamage / nadesFrag : 0,
  };
}

export function publicCareer(line, names = {}) {
  if (!line) return null;
  const r = careerRatios(line);
  const vs = Object.entries(line.vs)
    .map(([key, v]) => ({
      key,
      username: key === BOT_KEY ? "Bots" : names[key] || "",
      kills: v.kills,
      deaths: v.deaths,
      damage: v.damage,
      rounds: v.rounds,
      roundWins: v.roundWins,
    }))
    .sort((a, b) => b.rounds - a.rounds || b.kills - a.kills)
    .slice(0, 8);
  return {
    playerKey: line.playerKey,
    kills: line.kills,
    assists: line.assists,
    deaths: line.deaths,
    matches: line.matches,
    matchWins: line.matchWins,
    rounds: line.rounds,
    roundWins: line.roundWins,
    shots: line.shots,
    hits: line.hits,
    headHits: line.headHits,
    headKills: line.headKills,
    rifleKills: line.rifleKills,
    damage: line.damage,
    nadeDamage: line.nadeDamage,
    nadesFrag: line.nadesFrag,
    nadesSmoke: line.nadesSmoke,
    nadesStun: line.nadesStun,
    nadesFlash: line.nadesFlash,
    nadeKills: line.nadeKills,
    plants: line.plants,
    cuts: line.cuts,
    knifeKills: line.knifeKills,
    firstBloods: line.firstBloods,
    aces: line.aces,
    kd: r.kd,
    accuracy: r.accuracy,
    hsPct: r.hsPct,
    roundWinPct: r.roundWinPct,
    matchWinPct: r.matchWinPct,
    adr: r.adr,
    nadeAvg: r.nadeAvg,
    vs,
  };
}

export function boardSnippet(line) {
  if (!line) return null;
  const r = careerRatios(line);
  return {
    kills: line.kills,
    deaths: line.deaths,
    kd: r.kd,
    roundWinPct: r.roundWinPct,
    matches: line.matches,
  };
}

function emptyStore() {
  return { players: {}, seen: [] };
}

function readStore(filePath) {
  if (!existsSync(filePath)) return emptyStore();
  try {
    const raw = JSON.parse(readFileSync(filePath, "utf8"));
    const players = raw && typeof raw.players === "object" && raw.players ? raw.players : {};
    const seen = Array.isArray(raw?.seen) ? raw.seen.filter((s) => typeof s === "string") : [];
    return { players, seen };
  } catch {
    return emptyStore();
  }
}

function writeStore(filePath, data) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(data)}\n`);
}

function ingestId(body) {
  const gameId = typeof body?.gameId === "string" && body.gameId ? body.gameId : "";
  const matchId = typeof body?.matchId === "string" && body.matchId ? body.matchId : "";
  const round = Number(body?.round);
  const kind = body?.kind === "match" ? "match" : "round";
  if (!gameId || !matchId || !Number.isFinite(round)) return "";
  return `${gameId}:${matchId}:${round}:${kind}`;
}

export function ingestCareer(data, body) {
  const id = ingestId(body);
  if (!id) return { ok: false, reason: "id" };
  if (data.seen.includes(id)) return { ok: true, duplicate: true };
  const kind = body?.kind === "match" ? "match" : "round";
  const lines = Array.isArray(body?.lines) ? body.lines : [];
  for (const delta of lines) {
    if (!isPlayerKey(delta?.playerKey)) continue;
    const prev = data.players[delta.playerKey] ?? emptyCareer(delta.playerKey);
    prev.playerKey = delta.playerKey;
    if (kind === "round") applyRound(prev, delta);
    else applyMatch(prev, delta);
    data.players[delta.playerKey] = prev;
  }
  data.seen.push(id);
  if (data.seen.length > SEEN_CAP) data.seen.splice(0, data.seen.length - SEEN_CAP);
  return { ok: true, duplicate: false };
}

export function createCareerBook(filePath) {
  const reload = () => readStore(filePath);
  const save = (data) => writeStore(filePath, data);

  return {
    ingest(body) {
      const data = reload();
      const result = ingestCareer(data, body);
      if (result.ok && !result.duplicate) save(data);
      return result;
    },
    get(playerKey) {
      if (!isPlayerKey(playerKey)) return null;
      return reload().players[playerKey] ?? null;
    },
    board(keys) {
      const data = reload();
      const out = {};
      for (const key of keys) {
        if (!isPlayerKey(key)) continue;
        const line = data.players[key];
        if (line) out[key] = line;
      }
      return out;
    },
  };
}
