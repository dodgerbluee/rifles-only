import { tuning } from "./tuning";

export type Team = "ember" | "stone";
export type Phase = "freeze" | "live" | "planted" | "settle" | "bestplay" | "ending" | "matchover";
export type SiteId = "loft" | "well";

export type Slot = {
  id: number;
  team: Team;
  kind: "human" | "bot";
  name: string;
  alive: boolean;
  occupant?: string;
};

export type WireState = {
  mode: "carried" | "ground" | "planted";
  carrierId: number | null;
  site: SiteId | null;
  x: number;
  y: number;
  z: number;
  plantHold: number;
  cutHold: number;
};

export type Match = {
  phase: Phase;
  round: number;
  emberScore: number;
  stoneScore: number;
  swapped: boolean;
  timeLeft: number;
  bombTime: number;
  slots: Slot[];
  wire: WireState;
  endText: string;
  endT: number;
  lastJoin: string;
  matchOverPending: boolean;
  lastWinner: Team | null;
  mapTitle: string;
  firstTo: number;
  swapAfter: number;
  freezeTime: number;
  championsHold: number;
  perTeam: number;
};

export const FREEZE_TIME = 2.8;
export const END_HOLD = 4.2;
export const BESTPLAY_HOLD = 10;
export const FIRST_TO = 6;
export const SWAP_AFTER = 5;
export const CHAMPIONS_HOLD = 20;

const EMBER_NAMES = ["Reed", "Cal", "Ivo", "Nesh", "Bram", "Holt", "Venn", "Mira"];
const STONE_NAMES = ["Osa", "Pell", "Kade", "Wren", "Sol", "Nash", "Sal", "Quin"];

export function createMatch(opts?: {
  claimLocal?: boolean;
  perTeam?: number;
  firstTo?: number;
  swapAfter?: number;
  freezeTime?: number;
  championsHold?: number;
  mapTitle?: string;
}): Match {
  const per = Math.max(1, Math.min(8, opts?.perTeam ?? 5));
  nextSlotId = per * 2;
  nameSeq.ember = per;
  nameSeq.stone = per;
  const slots: Slot[] = [];
  for (let i = 0; i < per; i++) {
    slots.push({ id: i, team: "ember", kind: "bot", name: botName("ember", i), alive: true });
  }
  for (let i = 0; i < per; i++) {
    slots.push({ id: per + i, team: "stone", kind: "bot", name: botName("stone", i), alive: true });
  }
  const m: Match = {
    phase: "freeze",
    round: 1,
    emberScore: 0,
    stoneScore: 0,
    swapped: false,
    timeLeft: opts?.freezeTime ?? FREEZE_TIME,
    bombTime: tuning.fuse,
    slots,
    wire: groundWire(-22, 0.2, 0),
    endText: "",
    endT: 0,
    lastJoin: "",
    matchOverPending: false,
    lastWinner: null,
    mapTitle: opts?.mapTitle ?? "Wharf",
    firstTo: opts?.firstTo ?? FIRST_TO,
    swapAfter: opts?.swapAfter ?? SWAP_AFTER,
    freezeTime: opts?.freezeTime ?? FREEZE_TIME,
    championsHold: opts?.championsHold ?? CHAMPIONS_HOLD,
    perTeam: per,
  };
  if (opts?.claimLocal !== false) claimSlot(m, "ember", "You");
  giveWireToPlanter(m);
  return m;
}

export function plantingTeam(m: Match): Team {
  return m.swapped ? "stone" : "ember";
}

export function watchingTeam(m: Match): Team {
  return plantingTeam(m) === "ember" ? "stone" : "ember";
}

export function humanCount(m: Match) {
  return m.slots.filter((s) => s.kind === "human").length;
}

/** Bodies that can still plant or cut — not leftover seat flags after takeover. */
export function countLiving(team: Team, bodies: Array<{ team: Team; alive: boolean }>) {
  return bodies.filter((b) => b.team === team && b.alive).length;
}

/** Live fight plus the gap after a win, before freeze / recap / match over. */
export function roundCombatOpen(phase: Phase) {
  return phase === "live" || phase === "planted" || phase === "settle" || phase === "ending";
}

export function roundFrozen(phase: Phase) {
  return phase === "freeze" || phase === "bestplay" || phase === "matchover";
}

export function waitingForPlayers(m: Match) {
  return humanCount(m) === 0;
}

export function trySkipBestPlay(m: Match) {
  if (m.phase !== "bestplay") return false;
  if (humanCount(m) > 1) return false;
  concludeBestPlay(m);
  return true;
}

export function claimSlot(m: Match, team: Team, name: string): Slot | null {
  const bot = m.slots.find((s) => s.team === team && s.kind === "bot");
  if (!bot) return null;
  const left = bot.name;
  bot.kind = "human";
  bot.name = name;
  bot.occupant = undefined;
  m.lastJoin = `${name} took ${team === "ember" ? "Ember" : "Stone"} · ${left} left`;
  return bot;
}

export function vacateSlot(m: Match, slot: Slot) {
  slot.kind = "bot";
  slot.occupant = undefined;
  slot.name = restBotName(slot, m.perTeam);
}

function restBotName(slot: Slot, perTeam = 5) {
  const i = slot.team === "ember" ? slot.id : slot.id - perTeam;
  return botName(slot.team, Math.max(0, i));
}

export function actorTag(name: string | undefined | null, occupant?: string | null) {
  const n = (name ?? "").trim() || "Rifle";
  const o = occupant?.trim();
  if (o && o !== n) return `${n} (${o})`;
  return n;
}

export function slotTag(slot: Slot | undefined, occupant?: string | null) {
  if (!slot) return actorTag("Rifle", occupant);
  return actorTag(slot.name, occupant ?? slot.occupant);
}

export function humanSlot(m: Match): Slot | undefined {
  return m.slots.find((s) => s.kind === "human");
}

export function slotById(m: Match, id: number): Slot | undefined {
  return m.slots.find((s) => s.id === id);
}

let nextSlotId = 10;
const nameSeq = { ember: 5, stone: 5 };

function botName(team: Team, n: number) {
  const pool = team === "ember" ? EMBER_NAMES : STONE_NAMES;
  const base = pool[n % pool.length]!;
  const gen = Math.floor(n / pool.length);
  return gen === 0 ? base : `${base} ${gen + 1}`;
}

export function addBotSlot(m: Match, team: Team): Slot {
  const n = nameSeq[team]++;
  const slot: Slot = {
    id: nextSlotId++,
    team,
    kind: "bot",
    name: botName(team, n),
    alive: m.phase === "freeze" || m.phase === "live" || m.phase === "planted",
  };
  m.slots.push(slot);
  m.lastJoin = `Added ${slot.name} to ${team === "ember" ? "Ember" : "Stone"}`;
  return slot;
}

export function removeBotSlot(m: Match, team: Team): Slot | null {
  for (let i = m.slots.length - 1; i >= 0; i--) {
    const s = m.slots[i]!;
    if (s.team === team && s.kind === "bot") {
      m.slots.splice(i, 1);
      m.lastJoin = `Removed ${s.name} from ${team === "ember" ? "Ember" : "Stone"}`;
      return s;
    }
  }
  return null;
}

export function teamBotCount(m: Match, team: Team) {
  return m.slots.filter((s) => s.team === team && s.kind === "bot").length;
}

export function giveWireToPlanter(m: Match) {
  const plant = plantingTeam(m);
  const human = m.slots.find((s) => s.kind === "human" && s.team === plant && s.alive);
  const carrier = human ?? m.slots.find((s) => s.team === plant && s.alive);
  if (!carrier) {
    m.wire = groundWire(-22, 0.2, 0);
    return;
  }
  m.wire = {
    mode: "carried",
    carrierId: carrier.id,
    site: null,
    x: 0,
    y: 0,
    z: 0,
    plantHold: 0,
    cutHold: 0,
  };
}

function groundWire(x: number, y: number, z: number): WireState {
  return {
    mode: "ground",
    carrierId: null,
    site: null,
    x,
    y,
    z,
    plantHold: 0,
    cutHold: 0,
  };
}

export function plantWire(m: Match, site: SiteId, x: number, y: number, z: number) {
  if (m.phase !== "live" || m.wire.mode !== "carried") return;
  m.phase = "planted";
  m.bombTime = tuning.fuse;
  m.wire.mode = "planted";
  m.wire.site = site;
  m.wire.carrierId = null;
  m.wire.x = x;
  m.wire.y = y;
  m.wire.z = z;
  m.wire.plantHold = 0;
}

export function dropWire(m: Match, x: number, y: number, z: number) {
  if (m.wire.mode !== "carried") return;
  m.wire = groundWire(x, y + 0.15, z);
}

export function pickupWire(m: Match, id: number, team: Team) {
  if (m.wire.mode !== "ground") return false;
  if (team !== plantingTeam(m)) return false;
  if (!slotById(m, id)?.alive) return false;
  m.wire.mode = "carried";
  m.wire.carrierId = id;
  return true;
}

function holdEmptyServer(m: Match, spawn: { x: number; y: number; z: number }) {
  if (m.phase !== "freeze") {
    m.phase = "freeze";
    m.bombTime = tuning.fuse;
    m.endText = "";
    m.endT = 0;
    m.matchOverPending = false;
    for (const s of m.slots) s.alive = true;
    m.wire = groundWire(spawn.x, spawn.y + 0.2, spawn.z);
    giveWireToPlanter(m);
  }
  m.timeLeft = m.freezeTime;
}

export function tickMatch(
  m: Match,
  dt: number,
  ctx: {
    living: (team: Team) => number;
    inSite: (site: SiteId, x: number, z: number, y: number) => boolean;
    holdingUse: boolean;
    actor: { id: number; team: Team; x: number; y: number; z: number; alive: boolean };
    actors?: Array<{
      id: number;
      team: Team;
      x: number;
      y: number;
      z: number;
      alive: boolean;
      holdingUse: boolean;
    }>;
    spawnPlant: { x: number; y: number; z: number };
    onDetonate?: (x: number, y: number, z: number) => void;
    botCutting?: boolean;
    skipRecap?: boolean;
    onRotate?: () => void;
  },
) {
  if (waitingForPlayers(m)) {
    holdEmptyServer(m, ctx.spawnPlant);
    return;
  }

  if (m.phase === "settle") {
    m.endT -= dt;
    if (m.endT <= 0) {
      m.phase = "bestplay";
      if (ctx.skipRecap) {
        m.endT = 0;
        concludeBestPlay(m);
      } else {
        m.endT = BESTPLAY_HOLD;
      }
    }
    return;
  }

  if (m.phase === "bestplay") {
    m.endT -= dt;
    if (m.endT <= 0) concludeBestPlay(m);
    return;
  }

  if (m.phase === "matchover") {
    m.endT -= dt;
    if (m.endT <= 0) ctx.onRotate?.();
    return;
  }

  if (m.phase === "ending") {
    m.endT -= dt;
    if (m.endT <= 0) nextRound(m, ctx.spawnPlant);
    return;
  }

  if (m.phase === "freeze") {
    m.timeLeft -= dt;
    if (m.timeLeft <= 0) {
      m.phase = "live";
      m.timeLeft = tuning.round;
    }
    return;
  }

  if (m.phase === "live") {
    m.timeLeft -= dt;
    const planters = ctx.living(plantingTeam(m));
    const watchers = ctx.living(watchingTeam(m));
    if (watchers <= 0) return finish(m, plantingTeam(m), "No one left to watch the Bomb");
    if (planters <= 0 && m.wire.mode !== "planted")
      return finish(m, watchingTeam(m), "The Bomb never left the dock");
    if (m.timeLeft <= 0) return finish(m, watchingTeam(m), "Time died. The Bomb never sat");
  }

  if (m.phase === "planted") {
    m.bombTime -= dt;
    if (m.bombTime <= 0) {
      ctx.onDetonate?.(m.wire.x, m.wire.y, m.wire.z);
      return finish(m, plantingTeam(m), "The Bomb ran out");
    }
    const watchers = ctx.living(watchingTeam(m));
    if (watchers <= 0) return finish(m, plantingTeam(m), "No one left to cut");
    if (m.wire.cutHold >= tuning.cut) return finish(m, watchingTeam(m), "The Bomb was cut");
  }

  const people =
    ctx.actors ??
    (ctx.actor
      ? [{ ...ctx.actor, holdingUse: ctx.holdingUse }]
      : []);

  for (const a of people) {
    if (!a.alive) continue;
    if (m.wire.mode === "ground") {
      const d = Math.hypot(a.x - m.wire.x, a.z - m.wire.z);
      if (d < 1.15 && a.team === plantingTeam(m) && a.holdingUse) pickupWire(m, a.id, a.team);
    }
  }

  const carrier = people.find((a) => a.id === m.wire.carrierId);
  if (m.wire.mode === "carried" && m.phase === "live" && carrier?.alive) {
    if (carrier.holdingUse) {
      const site = ctx.inSite("loft", carrier.x, carrier.z, carrier.y)
        ? "loft"
        : ctx.inSite("well", carrier.x, carrier.z, carrier.y)
          ? "well"
          : null;
      if (site) {
        m.wire.plantHold += dt;
        if (m.wire.plantHold >= tuning.plant) plantWire(m, site, carrier.x, carrier.y, carrier.z);
      } else m.wire.plantHold = 0;
    } else m.wire.plantHold = 0;
  }

  if (m.wire.mode === "planted" && m.phase === "planted" && !ctx.botCutting) {
    let cutting = false;
    for (const a of people) {
      if (!a.alive || a.team !== watchingTeam(m) || !a.holdingUse) continue;
      const d = Math.hypot(a.x - m.wire.x, a.z - m.wire.z);
      if (d < 1.35 && Math.abs(a.y - m.wire.y) < 1.6) cutting = true;
    }
    if (cutting) {
      m.wire.cutHold += dt;
      if (m.wire.cutHold >= tuning.cut) finish(m, watchingTeam(m), "The Bomb was cut");
    }
  }
}

function finish(m: Match, winner: Team, text: string) {
  if (winner === "ember") m.emberScore += 1;
  else m.stoneScore += 1;
  m.endText = text;
  m.endT = 1;
  m.lastWinner = winner;
  m.matchOverPending = m.emberScore >= m.firstTo || m.stoneScore >= m.firstTo;
  m.phase = "settle";
  m.wire.plantHold = 0;
  m.wire.cutHold = 0;
}

function nextRound(m: Match, spawn: { x: number; y: number; z: number }) {
  if (m.round === m.swapAfter) m.swapped = true;
  m.round += 1;
  m.phase = "freeze";
  m.timeLeft = m.freezeTime;
  m.bombTime = tuning.fuse;
  m.endText = "";
  m.matchOverPending = false;
  for (const s of m.slots) s.alive = true;
  m.wire = groundWire(spawn.x, spawn.y + 0.2, spawn.z);
  giveWireToPlanter(m);
}

export function restartMatch(m: Match, spawn: { x: number; y: number; z: number }) {
  m.round = 1;
  m.emberScore = 0;
  m.stoneScore = 0;
  m.swapped = false;
  m.phase = "freeze";
  m.timeLeft = m.freezeTime;
  m.bombTime = tuning.fuse;
  m.endText = "";
  m.endT = 0;
  m.matchOverPending = false;
  m.lastWinner = null;
  m.lastJoin = "Match restarted";
  for (const s of m.slots) s.alive = true;
  m.wire = groundWire(spawn.x, spawn.y + 0.2, spawn.z);
  giveWireToPlanter(m);
}

export function concludeBestPlay(m: Match) {
  if (m.phase !== "bestplay") return;
  if (m.matchOverPending) {
    m.phase = "matchover";
    m.endText = m.emberScore > m.stoneScore ? `Ember takes ${m.mapTitle}` : `Stone takes ${m.mapTitle}`;
    m.endT = m.championsHold;
    return;
  }
  m.phase = "ending";
  m.endT = 1.6;
}

export function markDead(m: Match, id: number, x: number, y: number, z: number) {
  const s = slotById(m, id);
  if (s) s.alive = false;
  if (m.wire.mode === "carried" && m.wire.carrierId === id) dropWire(m, x, y, z);
}

export function formatTime(seconds: number) {
  const s = Math.max(0, Math.ceil(seconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${ss.toString().padStart(2, "0")}`;
}

export function siteCall(site: SiteId | "ice" | "slip" | null | undefined) {
  if (site === "loft" || site === "ice") return "Ice";
  if (site === "well" || site === "slip") return "Slip";
  return "site";
}

export function plantedTag(m: Match) {
  return `Bomb live · ${formatTime(m.bombTime)}`;
}
