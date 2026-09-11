/**
 * Packed snapshots for a home host. Fat JSON at 60 Hz saturates a typical
 * upload (~7 Mbps to four friends) and bufferbloats the host too.
 *
 * Wire snaps are compact arrays. Identity/feed go on full snaps; hot snaps
 * are poses + match clock. The lobby drops droppable snaps when a socket backs up.
 */
import { SNAP_HZ, TICK_HZ } from "./netFeel";
import type {
  KillFeedItem,
  Pawn,
  PlayerInput,
  Snapshot,
  Weapon,
  WireSnap,
} from "./net";

export const HOME_FRIENDS = 4;
/** Total WAN budget for snapshots to friends. 1.5 Mbps leaves headroom on a 10 Mbps upload. */
export const HOME_BUDGET_KBPS = 1500;
export const SNAP_BUFFER_SOFT = 24 * 1024;
export const SNAP_BUFFER_HARD = 96 * 1024;
const FULL_EVERY = 45;

const WEAPONS: Weapon[] = ["kar", "mosin", "rifle", "knife", "smoke", "frag", "stun", "flash"];
const PHASES = ["freeze", "live", "planted", "settle", "bestplay", "ending", "matchover"] as const;
const TEAMS = ["ember", "stone"] as const;
const WIRE_MODES = ["carried", "ground", "planted"] as const;
const NADES = ["smoke", "frag", "stun", "flash"] as const;

export type PackedSnap = {
  type: "snap";
  u: 0 | 1;
  t: number;
  m: number[];
  p: number[][];
  i?: unknown[][];
  f?: KillFeedItem[];
  c?: number[][];
  n?: number[][];
  o?: { kind: "smoke" | "frag" | "stun" | "flash"; x: number; y: number; z: number }[];
  h?: number[];
  x?: [string, string, number, number, string];
};

export type WireBuf = {
  seq: number;
  ident: Map<number, string>;
  feedSig: string;
  extraSig: string;
};

export function createWireBuf(): WireBuf {
  return { seq: 0, ident: new Map(), feedSig: "", extraSig: "" };
}

export function wireKbps(bytes: number, hz: number, peers: number) {
  return (bytes * hz * peers * 8) / 1000;
}

export function shouldDropSnap(buffered: number, droppable: boolean) {
  if (!droppable) return buffered > SNAP_BUFFER_HARD;
  return buffered > SNAP_BUFFER_SOFT;
}

export function isDroppableSnapHead(head: string) {
  return head.includes('"type":"snap"') && head.includes('"u":1');
}

export function shouldSendInput(prev: PlayerInput | null, next: PlayerInput, now: number, lastAt: number) {
  if (!prev) return true;
  if (next.fire !== prev.fire || next.jump !== prev.jump || next.use !== prev.use) return true;
  return now - lastAt >= 1000 / TICK_HZ - 0.25;
}

function q(n: number, s: number) {
  return Math.round(n * s) / s;
}

function idx(list: readonly string[], v: string | null | undefined, fallback = 0) {
  const i = v ? list.indexOf(v) : -1;
  return i >= 0 ? i : fallback;
}

function flags(p: Pawn) {
  return (
    (p.alive ? 1 : 0) |
    (p.ads ? 2 : 0) |
    (p.crouch ? 4 : 0) |
    (p.prone ? 8 : 0) |
    (p.stun ? 16 : 0) |
    (p.cow ? 32 : 0) |
    (p.absent ? 64 : 0)
  );
}

function packNades(p: Pawn) {
  const n = p.nades;
  if (!n) return 0;
  return (n.smoke & 15) | ((n.frag & 15) << 4) | ((n.stun & 15) << 8) | ((n.flash & 15) << 12);
}

function unpackNades(v: number): Pawn["nades"] {
  return {
    smoke: v & 15,
    frag: (v >> 4) & 15,
    stun: (v >> 8) & 15,
    flash: (v >> 12) & 15,
  };
}

function identSig(p: Pawn) {
  return `${p.netId ?? 0}|${p.name}|${p.team}|${p.occupant ?? ""}|${p.look ?? ""}|${p.skin ?? ""}|${p.kills ?? 0}|${p.assists ?? 0}|${p.deaths ?? 0}|${p.playerKey ?? ""}|${packNades(p)}`;
}

function extraSig(s: Snapshot) {
  return `${s.endText ?? ""}|${s.lastWinner ?? ""}|${s.mapId ?? ""}|${s.nextMap ?? ""}|${s.mapCustom ? 1 : 0}|${s.endT ?? 0}`;
}

function feedSig(feed: KillFeedItem[]) {
  if (!feed.length) return "";
  const last = feed[feed.length - 1]!;
  return `${feed.length}|${last.t ?? 0}|${last.killerId}|${last.victimId}`;
}

function poseRow(p: Pawn): number[] {
  return [
    p.id,
    p.netId ?? 0,
    q(p.x, 100),
    q(p.y, 100),
    q(p.z, 100),
    q(p.yaw, 1000),
    q(p.pitch, 1000),
    Math.round(p.hp),
    flags(p),
    idx(WEAPONS, p.weapon),
    Math.round(p.ping ?? 0),
    packNades(p),
  ];
}

function identRow(p: Pawn): unknown[] {
  return [
    p.id,
    p.netId ?? 0,
    idx(TEAMS, p.team),
    p.name,
    p.look ?? "",
    p.skin ?? "",
    p.occupant ?? "",
    p.kills ?? 0,
    p.assists ?? 0,
    p.deaths ?? 0,
    p.playerKey ?? "",
  ];
}

function packMatch(s: Snapshot): number[] {
  const w = s.wire;
  return [
    idx(PHASES, s.phase),
    s.round,
    s.emberScore,
    s.stoneScore,
    s.swapped ? 1 : 0,
    q(s.clock, 100),
    q(s.wireTime, 100),
    idx(WIRE_MODES, w.mode),
    w.carrierId ?? -1,
    w.site === "ice" ? 1 : w.site === "slip" ? 2 : 0,
    q(w.x, 100),
    q(w.y, 100),
    q(w.z, 100),
    q(w.plantHold, 100),
    q(w.cutHold, 100),
    q(s.time ?? 0, 1000),
  ];
}

function unpackMatch(m: number[]): Pick<Snapshot, "phase" | "round" | "emberScore" | "stoneScore" | "swapped" | "clock" | "wireTime" | "wire" | "time"> {
  const siteIdx = m[9] ?? 0;
  const site = siteIdx === 1 ? "ice" : siteIdx === 2 ? "slip" : null;
  const carrier = m[8] ?? -1;
  return {
    phase: PHASES[m[0] ?? 0] ?? "freeze",
    round: m[1] ?? 1,
    emberScore: m[2] ?? 0,
    stoneScore: m[3] ?? 0,
    swapped: !!m[4],
    clock: m[5] ?? 0,
    wireTime: m[6] ?? 0,
    time: m[15] ?? 0,
    wire: {
      mode: WIRE_MODES[m[7] ?? 0] ?? "carried",
      carrierId: carrier >= 0 ? carrier : null,
      site,
      x: m[10] ?? 0,
      y: m[11] ?? 0,
      z: m[12] ?? 0,
      plantHold: m[13] ?? 0,
      cutHold: m[14] ?? 0,
    } satisfies WireSnap,
  };
}

function applyIdent(p: Pawn, row: unknown[]) {
  p.netId = Number(row[1]) || 0;
  p.team = TEAMS[Number(row[2]) || 0] ?? p.team;
  p.name = typeof row[3] === "string" && row[3] ? row[3] : p.name;
  p.look = typeof row[4] === "string" && row[4] ? row[4] : p.look;
  const skin = row[5];
  if (skin === "rifle" || skin === "field" || skin === "unit" || skin === "frame") p.skin = skin;
  p.occupant = typeof row[6] === "string" && row[6] ? row[6] : undefined;
  p.kills = Number(row[7]) || 0;
  p.assists = Number(row[8]) || 0;
  p.deaths = Number(row[9]) || 0;
  p.playerKey = typeof row[10] === "string" && row[10] ? row[10] : undefined;
}

function applyPose(p: Pawn, row: number[]) {
  p.id = row[0] ?? p.id;
  p.netId = row[1] ?? p.netId ?? 0;
  p.x = row[2] ?? p.x;
  p.y = row[3] ?? p.y;
  p.z = row[4] ?? p.z;
  p.yaw = row[5] ?? p.yaw;
  p.pitch = row[6] ?? p.pitch;
  p.hp = row[7] ?? p.hp;
  const f = row[8] ?? 0;
  p.alive = !!(f & 1);
  p.ads = !!(f & 2);
  p.crouch = !!(f & 4);
  p.prone = !!(f & 8);
  p.stun = !!(f & 16);
  p.cow = !!(f & 32);
  p.absent = !!(f & 64);
  p.weapon = WEAPONS[row[9] ?? 0] ?? p.weapon;
  p.ping = row[10] ?? p.ping;
  p.nades = unpackNades(row[11] ?? 0);
}

function blankPawn(id: number): Pawn {
  return {
    id,
    netId: 0,
    name: `Rifle ${id}`,
    team: "ember",
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    pitch: 0,
    hp: 0,
    alive: false,
    weapon: "kar",
    ads: false,
  };
}

export function packSnap(snap: Snapshot, buf: WireBuf, forceFull = false): PackedSnap {
  buf.seq += 1;
  const pops = snap.pops ?? [];
  const heads = snap.headPops ?? [];
  const full = forceFull || buf.seq === 1 || buf.seq % FULL_EVERY === 0;
  const packed: PackedSnap = {
    type: "snap",
    u: full || pops.length || heads.length ? 0 : 1,
    t: q(snap.time ?? 0, 1000),
    m: packMatch(snap),
    p: snap.pawns.map(poseRow),
  };

  const identRows: unknown[][] = [];
  for (const p of snap.pawns) {
    const sig = identSig(p);
    if (full || buf.ident.get(p.id) !== sig) {
      identRows.push(identRow(p));
      buf.ident.set(p.id, sig);
    }
  }
  const live = new Set(snap.pawns.map((p) => p.id));
  for (const id of buf.ident.keys()) {
    if (!live.has(id)) buf.ident.delete(id);
  }
  if (identRows.length) packed.i = identRows;

  const fSig = feedSig(snap.feed);
  if (full || fSig !== buf.feedSig) {
    packed.f = snap.feed;
    buf.feedSig = fSig;
  }

  packed.c = (snap.clouds ?? []).map((c) => [q(c.x, 100), q(c.y, 100), q(c.z, 100), q(c.radius, 100), q(c.opacity, 100)]);
  packed.n = (snap.nades ?? []).map((n) => [q(n.x, 100), q(n.y, 100), q(n.z, 100), idx(NADES, n.kind)]);
  if (pops.length) packed.o = pops;
  if (heads.length) packed.h = heads;

  const eSig = extraSig(snap);
  if (full || eSig !== buf.extraSig) {
    packed.x = [snap.endText ?? "", snap.lastWinner ?? "", snap.mapCustom ? 1 : 0, snap.endT ?? 0, `${snap.mapId ?? ""}|${snap.nextMap ?? ""}`];
    buf.extraSig = eSig;
  }
  return packed;
}

export function unpackSnap(msg: PackedSnap, prev: Snapshot | null): Snapshot {
  const match = unpackMatch(msg.m);
  const byId = new Map<number, Pawn>();
  if (prev) {
    for (const p of prev.pawns) byId.set(p.id, { ...p, nades: p.nades ? { ...p.nades } : p.nades });
  }
  if (msg.i) {
    for (const row of msg.i) {
      const id = Number(row[0]);
      if (!Number.isFinite(id)) continue;
      const p = byId.get(id) ?? blankPawn(id);
      applyIdent(p, row);
      byId.set(id, p);
    }
  }
  const pawns: Pawn[] = [];
  const seen = new Set<number>();
  for (const row of msg.p) {
    const id = row[0] ?? 0;
    const p = byId.get(id) ?? blankPawn(id);
    applyPose(p, row);
    pawns.push(p);
    seen.add(id);
  }
  if (msg.u === 0) {
    /* full pose list replaces the set */
  } else if (prev) {
    for (const p of prev.pawns) {
      if (!seen.has(p.id)) pawns.push(p);
    }
  }

  let extra = {
    endText: prev?.endText,
    lastWinner: prev?.lastWinner,
    mapId: prev?.mapId,
    nextMap: prev?.nextMap,
    mapCustom: prev?.mapCustom,
    endT: prev?.endT,
  };
  if (msg.x) {
    const [endText, lastWinner, custom, endT, maps] = msg.x;
    const [mapId, nextMap] = String(maps).split("|");
    extra = {
      endText: endText || undefined,
      lastWinner: lastWinner === "ember" || lastWinner === "stone" ? lastWinner : lastWinner === "" ? null : prev?.lastWinner,
      mapCustom: !!custom,
      endT: Number(endT) || 0,
      mapId: mapId || undefined,
      nextMap: nextMap || undefined,
    };
  }

  return {
    ...match,
    pawns,
    feed: msg.f ?? prev?.feed ?? [],
    events: [],
    clouds: msg.c
      ? msg.c.map((c) => ({ x: c[0] ?? 0, y: c[1] ?? 0, z: c[2] ?? 0, radius: c[3] ?? 0, opacity: c[4] ?? 0 }))
      : msg.u === 0
        ? []
        : (prev?.clouds ?? []),
    nades: msg.n
      ? msg.n.map((n) => ({
          x: n[0] ?? 0,
          y: n[1] ?? 0,
          z: n[2] ?? 0,
          kind: NADES[n[3] ?? 0] ?? "smoke",
        }))
      : msg.u === 0
        ? []
        : (prev?.nades ?? []),
    pops: msg.o ?? [],
    headPops: msg.h ?? [],
    endText: extra.endText,
    lastWinner: extra.lastWinner,
    mapId: extra.mapId,
    nextMap: extra.nextMap,
    mapCustom: extra.mapCustom,
    endT: extra.endT,
  };
}

export function fatSnapBytes(snap: Snapshot) {
  return JSON.stringify({ type: "snapshot", snapshot: snap }).length;
}

export function packedSnapBytes(snap: Snapshot, buf = createWireBuf(), full = false) {
  return JSON.stringify(packSnap(snap, buf, full)).length;
}

export { SNAP_HZ, TICK_HZ };
