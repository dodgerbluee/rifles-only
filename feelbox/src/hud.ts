import type { World } from "./world";
import { actorTag, displayName, formatTime, plantedTag, plantingTeam, waitingForPlayers, type Match } from "./match";
import { radarHeading, worldToRadar } from "./radar";
import { tuning } from "./tuning";
import { holdScoreboard, kd, line, topThree } from "./stats";
import { currentCrosshair, paintCrosshair } from "./crosshair";
import { prefs } from "./prefs";

export { holdScoreboard };
import { killWayIcons, type KillFeedItem } from "./net";

const deathEl = document.querySelector<HTMLElement>("#death")!;
const deathBy = document.querySelector("#death-by")!;
const deathAt = document.querySelector("#death-at")!;
const deathCount = document.querySelector("#death-count")!;
const deathWhere = document.querySelector("#death-where")!;
const spawnBanner = document.querySelector<HTMLElement>("#spawn-banner")!;
const hpFill = document.querySelector<HTMLElement>("#hp-fill")!;
const hpNum = document.querySelector("#hp-num")!;
const hpStatus = document.querySelector<HTMLElement>("#hp-status")!;
const hpMaxEl = document.querySelector("#hp-max")!;
const stanceEl = document.querySelector("#stance")!;
const locEl = document.querySelector("#loc")!;
const lastDmgEl = document.querySelector("#last-dmg")!;
const ammoEl = document.querySelector("#ammo-count") ?? document.querySelector("#ammo")!;
const ammoRounds = document.querySelector<HTMLElement>("#ammo-rounds");
const nadeEl = document.querySelector("#nades")!;
const scoreEl = document.querySelector("#score")!;
const mapCanvas = document.querySelector<HTMLCanvasElement>("#minimap")!;
const mapCtx = mapCanvas.getContext("2d")!;
const emberScoreEl = document.querySelector("#ember-score")!;
const stoneScoreEl = document.querySelector("#stone-score")!;
const clockEl = document.querySelector("#clock")!;
const roundTag = document.querySelector("#round-tag")!;
const roundResult = document.querySelector<HTMLElement>("#round-result");
const promptEl = document.querySelector("#prompt")!;
const useBar = document.querySelector<HTMLElement>("#use-bar")!;
const useFill = document.querySelector<HTMLElement>("#use-fill")!;
const cookBar = document.querySelector<HTMLElement>("#cook-bar")!;
const cookFill = document.querySelector<HTMLElement>("#cook-fill")!;
const specEl = document.querySelector<HTMLElement>("#spec")!;
const rosterEl = document.querySelector("#roster")!;
const joinNote = document.querySelector("#join-note")!;
const killFeedEl = document.querySelector<HTMLElement>("#killfeed");

const MAP_W = 220;
const MAP_H = 176;

export const RESPAWN_DELAY = 4.2;

export function placeName(x: number, z: number, y = 0) {
  if (x > -18.2 && x < 0.4 && z > 12 && z < 25.2 && y > 2.4) return "Ice";
  if (x > -18.2 && x < 0.4 && z > 12 && z < 25.2) return "Ice floor";
  if (x > 2 && x < 18 && z < -10 && z > -22) return "Slip";
  if (x > 16 && x < 27.6 && z > 6.4 && z < 18.2 && y > 2.4) return "Shed 2F";
  if (x > 16 && x < 27.6 && z > 6.4 && z < 18.2) return "Shed";
  if (x > -26.2 && x < -15.8 && z > -9.2 && z < 1.2) return "Nets";
  if (x < -32) return "Ember dock";
  if (x > 32) return "Stone dock";
  if (z < -6) return "Quay";
  if (z > 16) return "Factory";
  if (Math.abs(x) < 10 && z > 2 && z < 14) return "Yard";
  return "Wharf";
}

export function healthStatus(hp: number, alive: boolean) {
  if (!alive || hp <= 0) return "Down";
  if (hp <= 34) return "Critical";
  if (hp <= 66) return "Wounded";
  if (hp < 100) return "Hurt";
  return "Stable";
}

let spawnBannerUntil = 0;

export function showSpawn(place: string, time: number) {
  spawnBanner.textContent = `Deployed · ${place}`;
  spawnBanner.classList.add("on");
  spawnBannerUntil = time + 2.4;
}

export function tickBanners(time: number) {
  if (time > spawnBannerUntil) spawnBanner.classList.remove("on");
}

export function showDeath(opts: {
  killer: string;
  place: string;
  spawnName: string;
  remain: number;
}) {
  deathEl.classList.add("on");
  deathEl.classList.remove("dim");
  document.body.classList.add("dead");
  deathBy.textContent = opts.killer.startsWith("by ") ? opts.killer : `by ${opts.killer}`;
  deathAt.textContent = `Went down at ${opts.place}`;
  const secs = Math.max(0, Math.ceil(opts.remain));
  deathCount.textContent =
    opts.remain < 0 ? "Out this round" : secs <= 0 ? "Deploying now" : `Deploying in ${secs}`;
  deathWhere.textContent =
    opts.remain < 0
      ? "Click next teammate · E take over a bot"
      : `${opts.spawnName} · full health · 5 rounds · 2 smokes`;
  if (opts.remain < 0) window.setTimeout(() => deathEl.classList.add("dim"), 2400);
}

export function hideDeath() {
  deathEl.classList.remove("on");
  deathEl.classList.remove("dim");
  document.body.classList.remove("dead");
  specEl.classList.remove("on");
}

export function setRoundResult(text: string | null, win = false) {
  if (!roundResult) return;
  roundResult.classList.toggle("on", !!text);
  roundResult.classList.toggle("win", !!text && win);
  roundResult.classList.toggle("loss", !!text && !win);
  roundResult.textContent = text ?? "";
}

export function setCook(on: boolean, k = 0) {
  cookBar.classList.toggle("on", on && k > 0.02);
  cookFill.style.width = `${Math.min(100, k * 100)}%`;
}

export function setSpec(line: string | null) {
  specEl.classList.toggle("on", !!line);
  if (line) specEl.textContent = line;
}

export function updateHud(opts: {
  hp: number;
  hpMax: number;
  alive: boolean;
  stance: string;
  x: number;
  z: number;
  y?: number;
  lastDamage: string;
  mag: number;
  magMax: number;
  reloading: number;
  kills: number;
  deaths: number;
  yaw: number;
  bots: { x: number; z: number; team: string; hp: number }[];
  youTeam?: string;
  minimapEnemies?: boolean;
  bomb?: { x: number; z: number; mode: "carried" | "ground" | "planted" };
  world: World;
  smokes: number;
  smokeMax: number;
  nades?: { smoke: number; frag: number; stun: number; flash: number };
  nadeKind?: "smoke" | "frag" | "stun" | "flash";
  clouds: { x: number; z: number; radius: number; opacity: number }[];
  air?: { x: number; z: number }[];
  weapon?: "rifle" | "kar" | "karscope" | "mosin" | "knife" | "smoke" | "frag" | "stun" | "flash";
  rifleName?: string;
  loadoutKeys?: string;
  spread?: number;
}) {
  const { hp, hpMax, alive } = opts;
  hpFill.style.width = `${Math.max(0, (hp / hpMax) * 100)}%`;
  hpFill.classList.toggle("low", hp <= 34 && alive);
  hpFill.classList.toggle("mid", hp > 34 && hp <= 66 && alive);
  hpNum.textContent = String(Math.max(0, Math.round(hp)));
  hpMaxEl.textContent = `/ ${hpMax}`;
  hpStatus.textContent = healthStatus(hp, alive);
  hpStatus.dataset.state = healthStatus(hp, alive);
  stanceEl.textContent = opts.stance;
  locEl.textContent = opts.world.placeName?.(opts.x, opts.z, opts.y) ?? placeName(opts.x, opts.z, opts.y);
  lastDmgEl.textContent = opts.lastDamage;
  const nade = opts.nadeKind ?? "smoke";
  const bag = opts.nades ?? { smoke: opts.smokes, frag: 0, stun: 0, flash: 0 };
  if (opts.weapon === "knife") ammoEl.textContent = "KNIFE";
  else if (opts.weapon === "smoke" || opts.weapon === "frag" || opts.weapon === "stun" || opts.weapon === "flash") {
    ammoEl.textContent = `${opts.weapon.toUpperCase()} ${bag[opts.weapon]}`;
  } else ammoEl.textContent = `${opts.mag} / ${opts.magMax}`;
  if (ammoRounds) {
    const filling =
      opts.reloading > 0 && opts.weapon !== "knife" && opts.weapon !== "smoke" && opts.weapon !== "frag"
        ? Math.round((1 - Math.min(1, opts.reloading / 1.45)) * opts.magMax)
        : opts.mag;
    const slots = opts.weapon === "knife" || opts.weapon === "smoke" || opts.weapon === "frag" || opts.weapon === "stun" || opts.weapon === "flash" ? 0 : opts.magMax;
    while (ammoRounds.childElementCount < slots) {
      const s = document.createElement("span");
      s.className = "rd";
      ammoRounds.append(s);
    }
    while (ammoRounds.childElementCount > slots) ammoRounds.lastElementChild?.remove();
    const kids = ammoRounds.children;
    for (let i = 0; i < kids.length; i++) {
      const el = kids[i] as HTMLElement;
      const on = i < (opts.reloading > 0 ? Math.max(opts.mag, filling) : opts.mag);
      el.classList.toggle("on", on && (opts.reloading <= 0 || i < opts.mag || i < filling));
      el.classList.toggle("filling", opts.reloading > 0 && i >= opts.mag && i < filling);
    }
  }
  nadeEl.textContent =
    opts.loadoutKeys ??
    `1 KAR · 2 KNIFE · 3 KNIFE · 4 ${nade.toUpperCase()}  S${bag.smoke} F${bag.frag} T${bag.stun} H${bag.flash}`;
  nadeEl.classList.toggle("empty", bag[nade] <= 0);
  scoreEl.textContent = `${opts.kills} / ${opts.deaths}`;
  const ch = document.querySelector<HTMLElement>("#crosshair");
  if (ch) paintCrosshair(ch, currentCrosshair(prefs), opts.spread ?? 0);
  const mapTitle = document.querySelector(".map-head span");
  if (mapTitle && opts.world.title) mapTitle.textContent = opts.world.title;
  drawMinimap(opts.world, opts.x, opts.z, opts.yaw, opts.bots, alive, opts.clouds, opts.air, {
    youTeam: opts.youTeam,
    enemies: opts.minimapEnemies !== false,
    bomb: opts.bomb,
  });
}

function drawMinimap(
  world: World,
  px: number,
  pz: number,
  yaw: number,
  bots: { x: number; z: number; team: string; hp: number }[],
  alive: boolean,
  clouds: { x: number; z: number; radius: number; opacity: number }[],
  air: { x: number; z: number }[] = [],
  radar?: { youTeam?: string; enemies?: boolean; bomb?: { x: number; z: number; mode: "carried" | "ground" | "planted" } },
) {
  const dpr = Math.min(2, devicePixelRatio || 1);
  if (mapCanvas.width !== MAP_W * dpr) {
    mapCanvas.width = MAP_W * dpr;
    mapCanvas.height = MAP_H * dpr;
    mapCanvas.style.width = `${MAP_W}px`;
    mapCanvas.style.height = `${MAP_H}px`;
  }
  mapCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const to = (x: number, z: number) => worldToRadar(x, z, world.bounds, MAP_W, MAP_H);

  mapCtx.clearRect(0, 0, MAP_W, MAP_H);
  mapCtx.fillStyle = "#2a2e30";
  mapCtx.fillRect(0, 0, MAP_W, MAP_H);

  for (const b of world.colliders) {
    const tall = b.max.y - b.min.y > 0.35;
    if (!tall && b.walk) continue;
    const a = to(b.min.x, b.max.z);
    const c = to(b.max.x, b.min.z);
    const x = Math.min(a.x, c.x);
    const y = Math.min(a.y, c.y);
    const w = Math.abs(c.x - a.x);
    const h = Math.abs(c.y - a.y);
    mapCtx.fillStyle = b.max.y - b.min.y > 1.4 ? "#5c5648" : "#7a7058";
    mapCtx.fillRect(x, y, Math.max(1.2, w), Math.max(1.2, h));
  }

  mapCtx.font = "bold 11px ui-sans-serif, system-ui";
  mapCtx.textAlign = "center";
  mapCtx.textBaseline = "middle";
  for (const site of world.sites) {
    const p = to(site.x, site.z);
    mapCtx.fillStyle = "rgba(20,18,12,0.7)";
    mapCtx.fillRect(p.x - 8, p.y - 8, 16, 16);
    mapCtx.strokeStyle = "#e8d9a8";
    mapCtx.lineWidth = 1.2;
    mapCtx.strokeRect(p.x - 8, p.y - 8, 16, 16);
    mapCtx.fillStyle = "#e8d9a8";
    mapCtx.fillText(site.call, p.x, p.y + 0.5);
  }

  const spawn = to(world.playerSpawn.x, world.playerSpawn.z);
  mapCtx.fillStyle = "#8aa4c4";
  mapCtx.beginPath();
  mapCtx.arc(spawn.x, spawn.y, 3.2, 0, Math.PI * 2);
  mapCtx.fill();

  for (const cloud of clouds) {
    const p = to(cloud.x, cloud.z);
    const r = Math.max(4, cloud.radius * to(cloud.x, cloud.z).scale);
    mapCtx.beginPath();
    mapCtx.arc(p.x, p.y, r, 0, Math.PI * 2);
    mapCtx.fillStyle = `rgba(200, 194, 176, ${0.18 + cloud.opacity * 0.28})`;
    mapCtx.fill();
  }

  for (const nade of air) {
    const p = to(nade.x, nade.z);
    mapCtx.beginPath();
    mapCtx.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
    mapCtx.fillStyle = "rgba(232, 210, 120, 0.95)";
    mapCtx.fill();
  }

  for (const bot of bots) {
    if (radar?.youTeam && radar.enemies === false && bot.team !== radar.youTeam) continue;
    const p = to(bot.x, bot.z);
    mapCtx.fillStyle =
      bot.hp <= 0 ? "#5a4038" : bot.team === "ember" ? "#e85a22" : "#3a90e8";
    mapCtx.fillRect(p.x - 2.4, p.y - 2.4, 4.8, 4.8);
  }

  const bomb = radar?.bomb;
  if (bomb && (bomb.mode === "ground" || bomb.mode === "planted")) {
    drawBombMarker(to(bomb.x, bomb.z), bomb.mode);
  }

  const me = to(px, pz);
  mapCtx.save();
  mapCtx.translate(me.x, me.y);
  mapCtx.rotate(radarHeading(yaw));
  mapCtx.beginPath();
  mapCtx.moveTo(0, -7);
  mapCtx.lineTo(5, 6);
  mapCtx.lineTo(0, 3);
  mapCtx.lineTo(-5, 6);
  mapCtx.closePath();
  mapCtx.fillStyle = alive ? "#e8f0d8" : "#8a8a80";
  mapCtx.fill();
  mapCtx.restore();

  mapCtx.strokeStyle = "rgba(232,217,168,0.35)";
  mapCtx.lineWidth = 1;
  mapCtx.strokeRect(0.5, 0.5, MAP_W - 1, MAP_H - 1);
}

function drawBombMarker(p: { x: number; y: number }, mode: "ground" | "planted") {
  const hz = mode === "planted" ? 2.8 : 1.35;
  const wave = 0.5 + 0.5 * Math.sin((performance.now() / 1000) * hz * Math.PI * 2);
  const glow = 6.2 + wave * 3.4;
  mapCtx.beginPath();
  mapCtx.arc(p.x, p.y, glow, 0, Math.PI * 2);
  mapCtx.fillStyle = `rgba(255, 72, 28, ${0.16 + wave * 0.28})`;
  mapCtx.fill();

  mapCtx.beginPath();
  mapCtx.moveTo(p.x, p.y - 6.4);
  mapCtx.lineTo(p.x + 5.4, p.y);
  mapCtx.lineTo(p.x, p.y + 6.4);
  mapCtx.lineTo(p.x - 5.4, p.y);
  mapCtx.closePath();
  mapCtx.fillStyle = mode === "planted" ? "#ff3a18" : "#ff7a20";
  mapCtx.fill();
  mapCtx.strokeStyle = "#1a100c";
  mapCtx.lineWidth = 1.3;
  mapCtx.stroke();

  mapCtx.beginPath();
  mapCtx.moveTo(p.x, p.y - 6.4);
  mapCtx.lineTo(p.x + 1.6, p.y - 10.2);
  mapCtx.strokeStyle = "#f2e2b0";
  mapCtx.lineWidth = 1.6;
  mapCtx.stroke();
  mapCtx.beginPath();
  mapCtx.arc(p.x + 1.8, p.y - 10.6, 1.35, 0, Math.PI * 2);
  mapCtx.fillStyle = wave > 0.55 ? "#ffe8a0" : "#ff4a20";
  mapCtx.fill();
}

export function updateMatchHud(m: Match, prompt: string, extra?: { nextMap?: string }) {
  emberScoreEl.textContent = String(m.emberScore);
  stoneScoreEl.textContent = String(m.stoneScore);
  const timed =
    m.phase === "planted"
      ? m.bombTime
      : m.phase === "ending" || m.phase === "matchover" || m.phase === "settle"
        ? m.endT
        : m.timeLeft;
  if (m.phase === "freeze") clockEl.textContent = waitingForPlayers(m) ? "WAIT" : `IN ${Math.max(0, Math.ceil(m.timeLeft))}`;
  else if (m.phase === "bestplay") clockEl.textContent = "REEL";
  else if (m.phase === "planted") clockEl.textContent = formatTime(m.bombTime);
  else clockEl.textContent = formatTime(timed);
  clockEl.classList.toggle("bomb", m.phase === "planted");
  const plant = plantingTeam(m);
  roundTag.textContent =
    waitingForPlayers(m)
      ? "Waiting for players"
      : m.phase === "planted"
      ? plantedTag(m)
      : m.phase === "bestplay"
      ? "Best play"
      : m.phase === "matchover"
        ? extra?.nextMap
          ? `${m.endText} · ${extra.nextMap} in ${Math.max(0, Math.ceil(m.endT))}s`
          : m.endText
      : m.phase === "ending" || m.phase === "settle"
        ? m.endText
        : `Round ${m.round} · ${plant === "ember" ? "Ember plants" : "Stone plants"}`;
  promptEl.textContent = prompt;
  const plantFrac = m.wire.plantHold / tuning.plant;
  const cutFrac = m.wire.cutHold / tuning.cut;
  const useFrac = cutFrac > 0 ? cutFrac : plantFrac;
  useBar.classList.toggle("on", useFrac > 0.02);
  useFill.style.width = `${Math.min(100, useFrac * 100)}%`;
  rosterEl.replaceChildren();
  for (const s of m.slots) {
    const el = document.createElement("span");
    el.className = `${s.team}${s.kind === "human" ? " you" : ""}${s.alive ? "" : " down"}`;
    el.textContent = displayName(s.name);
    rosterEl.append(el);
  }
  joinNote.textContent =
    m.phase === "bestplay"
      ? "Space to skip"
      : m.lastJoin || "Bots fill empty seats. A join takes a bot’s slot.";
}

export function renderScoreboard(
  m: Match,
  youId: number,
  pingOf: (id: number) => number | null,
) {
  const ember = document.querySelector("#board-ember")!;
  const stone = document.querySelector("#board-stone")!;
  const mapEl = document.querySelector("#board-map");
  const roundEl = document.querySelector("#board-round");
  const emberScore = document.querySelector("#board-ember-score");
  const stoneScore = document.querySelector("#board-stone-score");
  const emberLabel = document.querySelector("#board-ember-label");
  const stoneLabel = document.querySelector("#board-stone-label");
  if (mapEl) mapEl.textContent = m.mapTitle || "Wharf";
  if (roundEl) {
    roundEl.textContent =
      m.phase === "matchover"
        ? m.endText || "Match over"
        : `Round ${m.round} · First to ${m.firstTo}`;
  }
  if (emberScore) emberScore.textContent = String(m.emberScore);
  if (stoneScore) stoneScore.textContent = String(m.stoneScore);
  const emberSlots = m.slots.filter((s) => s.team === "ember");
  const stoneSlots = m.slots.filter((s) => s.team === "stone");
  const live = (slots: Match["slots"]) => slots.filter((s) => s.alive).length;
  if (emberLabel) emberLabel.textContent = `Ember · ${live(emberSlots)} live`;
  if (stoneLabel) stoneLabel.textContent = `Stone · ${live(stoneSlots)} live`;
  ember.replaceChildren();
  stone.replaceChildren();
  const rank = (a: Match["slots"][number], b: Match["slots"][number]) => {
    const la = line(a.id);
    const lb = line(b.id);
    return lb.kills - la.kills || lb.assists - la.assists || la.deaths - lb.deaths;
  };
  const row = (s: Match["slots"][number]) => {
    const l = line(s.id);
    const el = document.createElement("div");
    const you = s.id === youId;
    el.className = `board-row${you ? " you" : ""}${s.alive ? "" : " down"}`;
    const ping = pingOf(s.id);
    const tags = s.alive ? "" : '<em class="board-dead">Down</em>';
    const pingCls = ping == null ? "" : ping > 110 ? " ping-bad" : ping > 70 ? " ping-ok" : " ping-good";
    el.innerHTML = `<span class="board-name"><i class="board-pip"></i><span class="board-who">${actorTag(s.name, s.occupant)}</span>${tags}</span><span>${l.kills}</span><span>${l.assists}</span><span>${l.deaths}</span><span>${kd(l)}</span><span class="board-ping${pingCls}">${ping == null ? "—" : Math.round(ping)}</span>`;
    return el;
  };
  for (const s of emberSlots.sort(rank)) ember.append(row(s));
  for (const s of stoneSlots.sort(rank)) stone.append(row(s));
}

export function showPodium(
  m: Match,
  ranked?: { id: number; name: string; kills: number; assists: number; deaths: number }[],
) {
  const root = document.querySelector<HTMLElement>("#podium")!;
  document.body.classList.add("podium");
  const first = document.querySelector<HTMLElement>("#podium-first")!;
  first.classList.remove("on");
  const list =
    ranked && ranked.length
      ? ranked
      : topThree(m.slots.map((s) => ({ id: s.id, name: s.name })));
  const fill = (el: HTMLElement | null, p?: (typeof list)[0], place = "") => {
    if (!el) return;
    el.querySelector(".who")!.textContent = p?.name ?? "—";
    el.querySelector(".stat")!.textContent = p ? `${p.kills} / ${p.assists} / ${p.deaths}` : "";
    const tag = el.querySelector(".place");
    if (tag && place) tag.textContent = place;
  };
  fill(document.querySelector("#pod-1"), list[0], "1");
  fill(document.querySelector("#pod-2"), list[1], "2");
  fill(document.querySelector("#pod-3"), list[2], "3");
  const gold = list[0];
  document.querySelector("#podium-name")!.textContent = gold?.name ?? "—";
  document.querySelector("#podium-line")!.textContent = gold
    ? `${gold.kills} kills · ${gold.assists} assists · ${gold.deaths} deaths · ${kd(gold)} K/D`
    : "";
  window.setTimeout(() => first.classList.add("on"), 1600);
  return root;
}

export function hidePodium() {
  document.body.classList.remove("podium");
  document.querySelector("#podium-first")?.classList.remove("on");
}

export function paintNetMeter(opts: { ping: number; hz: number; kbps: number } | null) {
  const el = document.querySelector<HTMLElement>("#net-meter");
  if (!el) return;
  if (!opts) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  const ping = Math.max(0, Math.round(opts.ping));
  const hz = Math.max(0, Math.round(opts.hz));
  const kbps = Math.max(0, Math.round(opts.kbps));
  const tone = ping > 110 || (hz > 0 && hz < 18) ? "bad" : ping > 70 || kbps > 900 ? "ok" : "good";
  el.dataset.tone = tone;
  el.textContent = `${ping} ms · ${hz} Hz · ${kbps} kb/s`;
}

export function syncKillFeed(items: KillFeedItem[] | undefined, now: number) {
  if (!killFeedEl) return;
  const recent = (items ?? []).filter((k) => now - (k.t ?? now) < 6.5).slice(-6);
  killFeedEl.replaceChildren();
  for (const k of recent) {
    const row = document.createElement("div");
    row.className = "kill-row";
    const killer = document.createElement("span");
    killer.className = `who${k.killerTeam ? ` ${k.killerTeam}` : ""}`;
    killer.textContent = displayName(k.killerName);
    const way = document.createElement("span");
    const mark = killWayIcons(k.way, k.head, k.rifle);
    way.className = `sep way${k.way ? ` ${k.way}` : ""}${k.head ? " head" : ""}`;
    way.setAttribute("aria-label", mark.label);
    way.title = mark.label;
    way.innerHTML = mark.html;
    const victim = document.createElement("span");
    victim.className = `who${k.victimTeam ? ` ${k.victimTeam}` : ""}`;
    victim.textContent = displayName(k.victimName);
    row.append(killer, way, victim);
    killFeedEl.append(row);
  }
}
