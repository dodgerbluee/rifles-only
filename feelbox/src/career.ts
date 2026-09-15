import { accountKey, isPlayerKey, loadAccount } from "./account";

export type CareerVs = {
  key: string;
  username: string;
  kills: number;
  deaths: number;
  damage: number;
  rounds: number;
  roundWins: number;
};

export type CareerView = {
  playerKey: string;
  kills: number;
  assists: number;
  deaths: number;
  matches: number;
  matchWins: number;
  rounds: number;
  roundWins: number;
  shots: number;
  hits: number;
  headKills: number;
  rifleKills: number;
  damage: number;
  nadeDamage: number;
  nadesFrag: number;
  nadeKills: number;
  nadesSmoke: number;
  nadesStun: number;
  nadesFlash: number;
  plants: number;
  cuts: number;
  knifeKills: number;
  firstBloods: number;
  aces: number;
  kd: number;
  accuracy: number;
  hsPct: number;
  roundWinPct: number;
  matchWinPct: number;
  adr: number;
  nadeAvg: number;
  vs: CareerVs[];
};

export type BoardSnippet = {
  kills: number;
  deaths: number;
  kd: number;
  roundWinPct: number;
  matches: number;
};

const TTL_MS = 30_000;
let mine: CareerView | null = null;
let mineAt = 0;
let mineKey = "";
const board = new Map<string, BoardSnippet>();
let boardAt = 0;
let boardSig = "";

function fmt(n: number, digits = 2) {
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(digits);
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

export function myCareer() {
  return mine;
}

export function careerBoard() {
  return board;
}

export function vsRecord(opponentKey?: string) {
  if (!opponentKey || !mine?.vs) return null;
  const row = mine.vs.find((v) => v.key === opponentKey);
  if (!row || row.rounds <= 0) return null;
  return { wins: row.roundWins, losses: Math.max(0, row.rounds - row.roundWins) };
}

export async function loadCareer(key: string): Promise<CareerView | null> {
  if (!isPlayerKey(key)) return null;
  if (mine && mineKey === key && Date.now() - mineAt < TTL_MS) return mine;
  try {
    const res = await fetch(`/api/career?key=${encodeURIComponent(key)}`);
    if (!res.ok) return mine;
    const data = (await res.json()) as CareerView & { ok?: boolean };
    if (!data?.ok) return mine;
    mine = data;
    mineKey = key;
    mineAt = Date.now();
    return mine;
  } catch {
    return mine;
  }
}

export async function loadBoard(keys: string[]): Promise<Map<string, BoardSnippet>> {
  const want = [...new Set(keys.filter(isPlayerKey))].slice(0, 16);
  const sig = want.slice().sort().join(",");
  if (sig === boardSig && Date.now() - boardAt < TTL_MS) return board;
  if (!want.length) {
    board.clear();
    boardSig = "";
    return board;
  }
  try {
    const res = await fetch(`/api/career/board?keys=${encodeURIComponent(want.join(","))}`);
    if (!res.ok) return board;
    const data = (await res.json()) as { ok?: boolean; board?: Record<string, BoardSnippet> };
    if (!data?.ok || !data.board) return board;
    board.clear();
    for (const [k, v] of Object.entries(data.board)) board.set(k, v);
    boardSig = sig;
    boardAt = Date.now();
  } catch {
    /* keep cache */
  }
  return board;
}

function hero(label: string, value: string, note = "") {
  return `<div class="stats-hero-card"><p class="stats-hero-label">${label}</p><p class="stats-hero-value">${value}</p>${
    note ? `<p class="stats-hero-note">${note}</p>` : ""
  }</div>`;
}

function cell(label: string, value: string) {
  return `<div class="stats-cell"><span class="stats-cell-label">${label}</span><span class="stats-cell-value">${value}</span></div>`;
}

function paintPage(view: CareerView | null) {
  const title = document.querySelector("#stats-title");
  const lead = document.querySelector("#stats-lead");
  const empty = document.querySelector<HTMLElement>("#stats-empty");
  const body = document.querySelector<HTMLElement>("#stats-body");
  const overview = document.querySelector("#stats-overview");
  const combat = document.querySelector("#stats-combat");
  const utility = document.querySelector("#stats-utility");
  const rivals = document.querySelector("#stats-rivals");
  if (!title || !lead || !empty || !body || !overview || !combat || !utility || !rivals) return;

  const rec = loadAccount();
  const who = rec?.username || rec?.name || "Player";
  title.textContent = who;
  lead.textContent = "Career across every Last Wire box on this lobby.";

  if (!view || (view.rounds <= 0 && view.matches <= 0)) {
    empty.hidden = false;
    body.hidden = true;
    return;
  }

  empty.hidden = true;
  body.hidden = false;

  const matchLosses = Math.max(0, view.matches - view.matchWins);
  const roundLosses = Math.max(0, view.rounds - view.roundWins);
  overview.innerHTML = [
    hero("Matches", `${view.matchWins}–${matchLosses}`, pct(view.matchWinPct)),
    hero("Rounds", `${view.roundWins}–${roundLosses}`, pct(view.roundWinPct)),
    hero("K / D", fmt(view.kd), `${view.kills} / ${view.deaths}`),
    hero("ADR", fmt(view.adr, 1), `${Math.round(view.damage)} total damage`),
  ].join("");

  combat.innerHTML = [
    cell("Kills", String(view.kills)),
    cell("Assists", String(view.assists)),
    cell("Deaths", String(view.deaths)),
    cell("Accuracy", view.shots > 0 ? pct(view.accuracy) : "—"),
    cell("Headshot %", view.rifleKills > 0 ? pct(view.hsPct) : "—"),
    cell("Rifle kills", String(view.rifleKills)),
    cell("Head kills", String(view.headKills)),
    cell("Shots", String(view.shots)),
    cell("Hits", String(view.hits)),
    cell("Aces", String(view.aces)),
    cell("First blood", String(view.firstBloods)),
    cell("Knife kills", String(view.knifeKills)),
  ].join("");

  utility.innerHTML = [
    cell("Nade damage", String(Math.round(view.nadeDamage))),
    cell("Avg / frag", view.nadesFrag > 0 ? fmt(view.nadeAvg, 1) : "—"),
    cell("Nade kills", String(view.nadeKills)),
    cell("Frags thrown", String(view.nadesFrag)),
    cell("Smokes", String(view.nadesSmoke)),
    cell("Stuns", String(view.nadesStun)),
    cell("Flashes", String(view.nadesFlash)),
    cell("Plants", String(view.plants)),
    cell("Cuts", String(view.cuts)),
  ].join("");

  const list = (view.vs ?? []).filter((v) => v.key !== "bot" && v.rounds > 0).slice(0, 12);
  if (!list.length) {
    rivals.innerHTML = `<p class="stats-muted">No head-to-head record yet.</p>`;
    return;
  }
  rivals.innerHTML = `<div class="stats-rivals">${list
    .map((v) => {
      const name = v.username || "Rifle";
      const lost = Math.max(0, v.rounds - v.roundWins);
      const kd = v.deaths <= 0 ? (v.kills === 0 ? "0.00" : v.kills.toFixed(2)) : (v.kills / v.deaths).toFixed(2);
      return `<div class="stats-rival"><span class="stats-rival-name">${name}</span><span class="stats-rival-wl">${v.roundWins}–${lost}</span><span class="stats-rival-kd">${kd} K/D</span></div>`;
    })
    .join("")}</div>`;
}

export function openStatsPage() {
  const page = document.querySelector<HTMLElement>("#stats-page");
  if (page) page.hidden = false;
  document.body.classList.add("stats-page");
  void paintStatsPage();
}

export function closeStatsPage() {
  const page = document.querySelector<HTMLElement>("#stats-page");
  if (page) page.hidden = true;
  document.body.classList.remove("stats-page");
}

export function statsPageOpen() {
  return document.body.classList.contains("stats-page");
}

export async function paintStatsPage() {
  const key = accountKey();
  const view = key ? await loadCareer(key) : null;
  paintPage(view);
}

/** Keep chrome button in sync with login state. */
export function paintStatsChrome() {
  const btn = document.querySelector<HTMLButtonElement>("#home-stats");
  if (!btn) return;
  btn.hidden = !accountKey();
}
