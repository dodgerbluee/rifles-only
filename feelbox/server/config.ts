/**
 * Dedicated match settings. File: feelbox/server.json
 * Env overrides: GAME_NAME, GAME_MAP, GAME_PER_TEAM, SERVER_CONFIG
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MAPS, type MapId } from "../src/maps";
import type { BotSkill } from "../src/bots";

export type ServerConfig = {
  name: string;
  map: MapId;
  perTeam: number;
  rotation: MapId[];
  championsHold: number;
  firstTo: number;
  swapAfter: number;
  freezeTime: number;
  botSkill: BotSkill;
  highlights: boolean;
  friendlyFire: boolean;
  oneShot: boolean;
};

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAP_IDS = MAPS.map((m) => m.id);

const DEFAULTS: ServerConfig = {
  name: "Last Wire",
  map: "wharf",
  perTeam: 5,
  rotation: ["wharf", "cove", "parish", "cut"],
  championsHold: 20,
  firstTo: 6,
  swapAfter: 5,
  freezeTime: 2.8,
  botSkill: "normal",
  highlights: true,
  friendlyFire: false,
  oneShot: false,
};

function asMap(id: unknown): MapId | undefined {
  return typeof id === "string" && MAP_IDS.includes(id as MapId) ? (id as MapId) : undefined;
}

function asSkill(v: unknown): BotSkill | undefined {
  return v === "easy" || v === "normal" || v === "hard" ? v : undefined;
}

function num(v: unknown, fallback: number, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function loadServerConfig(): ServerConfig {
  const file = process.env.SERVER_CONFIG
    ? path.resolve(process.env.SERVER_CONFIG)
    : path.join(ROOT, "server.json");
  let raw: Record<string, unknown> = {};
  if (existsSync(file)) {
    try {
      raw = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
    } catch {
      raw = {};
    }
  }
  const rotation = Array.isArray(raw.rotation)
    ? (raw.rotation.map(asMap).filter(Boolean) as MapId[])
    : DEFAULTS.rotation;
  const map = asMap(process.env.GAME_MAP) ?? asMap(raw.map) ?? rotation[0] ?? DEFAULTS.map;
  return {
    name: (process.env.GAME_NAME || String(raw.name || DEFAULTS.name)).trim() || DEFAULTS.name,
    map,
    perTeam: num(process.env.GAME_PER_TEAM ?? raw.perTeam, DEFAULTS.perTeam, 1, 8),
    rotation: rotation.length ? rotation : DEFAULTS.rotation,
    championsHold: num(raw.championsHold, DEFAULTS.championsHold, 8, 60),
    firstTo: num(raw.firstTo, DEFAULTS.firstTo, 1, 16),
    swapAfter: num(raw.swapAfter, DEFAULTS.swapAfter, 1, 16),
    freezeTime: num(raw.freezeTime, DEFAULTS.freezeTime, 0.5, 12),
    botSkill: asSkill(process.env.GAME_BOT_SKILL) ?? asSkill(raw.botSkill) ?? DEFAULTS.botSkill,
    highlights: raw.highlights !== false,
    friendlyFire: raw.friendlyFire === true,
    oneShot: raw.oneShot === true,
  };
}
