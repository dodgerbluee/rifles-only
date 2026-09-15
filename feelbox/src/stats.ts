export type Line = {
  kills: number;
  assists: number;
  deaths: number;
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
  firstBloods: number;
  aces: number;
};

export type VsRound = { kills: number; deaths: number; damage: number };

export type KillStatWay = "aimed" | "noscope" | "nade" | "knife" | "bomb" | "cow";

export function emptyLine(): Line {
  return {
    kills: 0,
    assists: 0,
    deaths: 0,
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
  };
}

const lines = new Map<number, Line>();
const roundLines = new Map<number, Line>();
const hits: { victim: number; attacker: number; t: number }[] = [];
/** attacker -> victim -> this-round vs */
const roundVs = new Map<number, Map<number, VsRound>>();
let roundFirstBlood = false;

export function line(id: number): Line {
  let l = lines.get(id);
  if (!l) {
    l = emptyLine();
    lines.set(id, l);
  }
  return l;
}

export function roundLine(id: number): Line {
  let l = roundLines.get(id);
  if (!l) {
    l = emptyLine();
    roundLines.set(id, l);
  }
  return l;
}

function bump(id: number, field: keyof Line, n = 1) {
  if (n === 0) return;
  line(id)[field] += n;
  roundLine(id)[field] += n;
}

function vsOf(attacker: number, victim: number): VsRound {
  let row = roundVs.get(attacker);
  if (!row) {
    row = new Map();
    roundVs.set(attacker, row);
  }
  let cell = row.get(victim);
  if (!cell) {
    cell = { kills: 0, deaths: 0, damage: 0 };
    row.set(victim, cell);
  }
  return cell;
}

export function noteHit(attacker: number, victim: number, t: number) {
  if (attacker === victim) return;
  hits.push({ attacker, victim, t });
  if (hits.length > 80) hits.splice(0, hits.length - 80);
}

export function noteShot(id: number) {
  bump(id, "shots");
}

export function noteRifleHit(id: number, head = false) {
  bump(id, "hits");
  if (head) bump(id, "headHits");
}

export function noteDamage(attacker: number, victim: number, amount: number, nade = false) {
  if (attacker < 0 || amount <= 0) return;
  bump(attacker, "damage", amount);
  if (nade) bump(attacker, "nadeDamage", amount);
  if (attacker !== victim) vsOf(attacker, victim).damage += amount;
}

export function noteNadeThrow(id: number, kind: "smoke" | "frag" | "stun" | "flash") {
  if (kind === "frag") bump(id, "nadesFrag");
  else if (kind === "smoke") bump(id, "nadesSmoke");
  else if (kind === "stun") bump(id, "nadesStun");
  else bump(id, "nadesFlash");
}

export function notePlant(id: number) {
  if (id < 0) return;
  bump(id, "plants");
}

export function noteCut(id: number) {
  if (id < 0) return;
  bump(id, "cuts");
}

export function noteDeath(victim: number) {
  bump(victim, "deaths");
}

export function noteKill(killer: number, victim: number, t: number, opts?: { head?: boolean; way?: KillStatWay }) {
  if (killer !== victim) {
    bump(killer, "kills");
    const roundKills = roundLine(killer).kills;
    if (roundKills === 5) bump(killer, "aces");
    if (!roundFirstBlood) {
      roundFirstBlood = true;
      bump(killer, "firstBloods");
    }
    const way = opts?.way;
    if (opts?.head && (way === "aimed" || way === "noscope" || way == null)) bump(killer, "headKills");
    if (way === "aimed" || way === "noscope") bump(killer, "rifleKills");
    if (way === "knife") bump(killer, "knifeKills");
    if (way === "nade") bump(killer, "nadeKills");
    if (killer >= 0 && victim >= 0 && killer !== victim) {
      vsOf(killer, victim).kills += 1;
      vsOf(victim, killer).deaths += 1;
    }
  }
  bump(victim, "deaths");
  const seen = new Set<number>();
  for (const h of hits) {
    if (h.victim !== victim || h.attacker === killer || t - h.t > 5.5) continue;
    if (seen.has(h.attacker)) continue;
    seen.add(h.attacker);
    bump(h.attacker, "assists");
  }
}

export function resetRoundStats() {
  roundLines.clear();
  roundVs.clear();
  roundFirstBlood = false;
}

export function resetStats() {
  lines.clear();
  hits.length = 0;
  resetRoundStats();
}

export function applyLine(id: number, kills: number, assists: number, deaths: number) {
  const l = line(id);
  l.kills = kills;
  l.assists = assists;
  l.deaths = deaths;
}

function swapMap<T>(map: Map<number, T>, a: number, b: number) {
  const left = map.get(a);
  const right = map.get(b);
  if (right) map.set(a, right);
  else map.delete(a);
  if (left) map.set(b, left);
  else map.delete(b);
}

function remapVsVictims(a: number, b: number) {
  for (const row of roundVs.values()) {
    const left = row.get(a);
    const right = row.get(b);
    if (right) row.set(a, right);
    else row.delete(a);
    if (left) row.set(b, left);
    else row.delete(b);
  }
}

export function swapLines(a: number, b: number) {
  if (a === b) return;
  swapMap(lines, a, b);
  swapMap(roundLines, a, b);
  swapMap(roundVs, a, b);
  remapVsVictims(a, b);
}

export function roundIds(): number[] {
  const ids = new Set<number>();
  for (const id of roundLines.keys()) ids.add(id);
  for (const id of lines.keys()) ids.add(id);
  return [...ids];
}

export function vsAgainst(attacker: number): { victim: number; kills: number; deaths: number; damage: number }[] {
  const row = roundVs.get(attacker);
  if (!row) return [];
  return [...row.entries()].map(([victim, v]) => ({ victim, ...v }));
}

export function kd(l: Pick<Line, "kills" | "deaths">) {
  if (l.deaths <= 0) return l.kills === 0 ? "0.00" : l.kills.toFixed(2);
  return (l.kills / l.deaths).toFixed(2);
}

export function podiumStat(p?: Pick<Line, "kills" | "assists" | "deaths"> | null) {
  if (!p) return "";
  return `${p.kills} K · ${p.assists} A · ${p.deaths} D · ${kd(p)}`;
}

export function topThree<T extends { id: number; name: string }>(ids: T[]) {
  return [...ids]
    .map((p) => ({ ...p, ...line(p.id) }))
    .sort((a, b) => b.kills - a.kills || b.assists - a.assists || a.deaths - b.deaths)
    .slice(0, 3);
}

/** Hold-Tab scoreboard, like CS. Off in studio / locker / settings / home. */
export function holdScoreboard(
  keys: ReadonlySet<string>,
  ui: {
    started?: boolean;
    studio?: boolean;
    locker?: boolean;
    settings?: boolean;
    admin?: boolean;
    podium?: boolean;
  } = {},
): boolean {
  if (ui.started === false || ui.studio || ui.locker || ui.settings || ui.admin || ui.podium) return false;
  return keys.has("Tab") || keys.has("KeyTab");
}
