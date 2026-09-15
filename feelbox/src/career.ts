import { accountKey, isPlayerKey } from "./account";

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

export function formatKd(n: number) {
  return fmt(n);
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

export function paintHomeRecord(view: CareerView | null) {
  const el = document.querySelector("#home-id-record");
  if (!el) return;
  if (!view || (view.rounds <= 0 && view.matches <= 0)) {
    el.textContent = "";
    return;
  }
  const losses = Math.max(0, view.matches - view.matchWins);
  el.textContent = `${view.matchWins}–${losses} · ${fmt(view.kd)} K/D`;
}

function row(label: string, value: string) {
  return `<span class="record-label">${label}</span><span class="record-val">${value}</span>`;
}

export function paintLockerRecord(view: CareerView | null) {
  const root = document.querySelector<HTMLElement>("#locker-record");
  const grid = document.querySelector("#locker-record-grid");
  const rivals = document.querySelector("#locker-record-rivals");
  if (!root || !grid) return;
  root.hidden = false;
  if (!view || (view.rounds <= 0 && view.matches <= 0)) {
    grid.innerHTML = `<p class="locker-hint">Play a match to start a record.</p>`;
    if (rivals) rivals.innerHTML = "";
    return;
  }
  const losses = Math.max(0, view.matches - view.matchWins);
  const acc = view.shots > 0 ? pct(view.accuracy) : "—";
  const hs = view.rifleKills > 0 ? pct(view.hsPct) : "—";
  const nadeAvg = view.nadesFrag > 0 ? fmt(view.nadeAvg, 1) : "—";
  grid.innerHTML = [
    row("Matches", `${view.matchWins}–${losses}`),
    row("Rounds", `${pct(view.roundWinPct)} · ${view.roundWins}/${view.rounds}`),
    row("K / A / D", `${view.kills} / ${view.assists} / ${view.deaths}`),
    row("K/D", fmt(view.kd)),
    row("ADR", fmt(view.adr, 1)),
    row("Accuracy", acc),
    row("HS%", hs),
    row("Nades", `${Math.round(view.nadeDamage)} dmg · ${nadeAvg} / frag`),
    row("Plants / cuts", `${view.plants} / ${view.cuts}`),
    row("Aces", String(view.aces)),
    row("First blood", String(view.firstBloods)),
    row("Knife", String(view.knifeKills)),
  ].join("");
  if (!rivals) return;
  const list = (view.vs ?? []).filter((v) => v.key !== "bot" && v.rounds > 0).slice(0, 8);
  if (!list.length) {
    rivals.innerHTML = "";
    return;
  }
  rivals.innerHTML = `<p class="locker-label">Rivals</p>${list
    .map((v) => {
      const name = v.username || "Rifle";
      const lost = Math.max(0, v.rounds - v.roundWins);
      return `<p class="record-rival"><span>${name}</span><span>${v.roundWins}–${lost}</span></p>`;
    })
    .join("")}`;
}

export async function paintCareer() {
  const key = accountKey();
  const view = key ? await loadCareer(key) : null;
  paintHomeRecord(view);
  paintLockerRecord(view);
}
