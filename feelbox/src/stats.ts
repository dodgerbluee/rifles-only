export type Line = { kills: number; assists: number; deaths: number };

const lines = new Map<number, Line>();
const hits: { victim: number; attacker: number; t: number }[] = [];

export function line(id: number): Line {
  let l = lines.get(id);
  if (!l) {
    l = { kills: 0, assists: 0, deaths: 0 };
    lines.set(id, l);
  }
  return l;
}

export function noteHit(attacker: number, victim: number, t: number) {
  if (attacker === victim) return;
  hits.push({ attacker, victim, t });
  if (hits.length > 80) hits.splice(0, hits.length - 80);
}

export function noteKill(killer: number, victim: number, t: number) {
  if (killer !== victim) line(killer).kills += 1;
  line(victim).deaths += 1;
  const seen = new Set<number>();
  for (const h of hits) {
    if (h.victim !== victim || h.attacker === killer || t - h.t > 5.5) continue;
    if (seen.has(h.attacker)) continue;
    seen.add(h.attacker);
    line(h.attacker).assists += 1;
  }
}

export function resetStats() {
  lines.clear();
  hits.length = 0;
}

export function applyLine(id: number, kills: number, assists: number, deaths: number) {
  const l = line(id);
  l.kills = kills;
  l.assists = assists;
  l.deaths = deaths;
}

export function swapLines(a: number, b: number) {
  if (a === b) return;
  const left = { ...line(a) };
  const right = { ...line(b) };
  applyLine(a, right.kills, right.assists, right.deaths);
  applyLine(b, left.kills, left.assists, left.deaths);
}

export function kd(l: Line) {
  if (l.deaths <= 0) return l.kills === 0 ? "0.00" : l.kills.toFixed(2);
  return (l.kills / l.deaths).toFixed(2);
}

export function topThree(ids: { id: number; name: string }[]) {
  return [...ids]
    .map((p) => ({ ...p, ...line(p.id) }))
    .sort((a, b) => b.kills - a.kills || b.assists - a.assists || a.deaths - b.deaths)
    .slice(0, 3);
}
