import { DEFAULT_LOOK, parseLook, packLook, skinFromLook, type Appearance } from "./look";
import { DEFAULT_LOADOUT, parseLoadout, type Loadout } from "./loadout";
import {
  FACTORY_CROSSHAIRS,
  parseCrosshairBank,
  type Crosshair,
} from "./crosshair";

const KEY = "rifles-only-prefs";
const KEY_RE = /^rk_[a-f0-9]{32}$/;

export type Prefs = {
  name: string;
  playerKey: string;
  sens: number;
  volume: number;
  team?: "ember" | "stone";
  skin: "rifle" | "field" | "unit" | "frame";
  look: Appearance;
  /** Opaque packed look string. Do not parse slots here. */
  lookId: string;
  loadout: Loadout;
  crosshairSlot: number;
  crosshairs: Crosshair[];
};

const factoryBank = parseCrosshairBank(FACTORY_CROSSHAIRS, 0);

const defaults: Prefs = {
  name: "",
  playerKey: "",
  sens: 1,
  volume: 0.7,
  skin: "rifle",
  look: { ...DEFAULT_LOOK },
  lookId: packLook(DEFAULT_LOOK),
  loadout: { ...DEFAULT_LOADOUT },
  crosshairSlot: factoryBank.crosshairSlot,
  crosshairs: factoryBank.crosshairs,
};

export const prefs: Prefs = load();

const saveHooks: Array<() => void> = [];

export function onPrefsSaved(fn: () => void) {
  saveHooks.push(fn);
}

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults, look: { ...DEFAULT_LOOK }, crosshairs: parseCrosshairBank(FACTORY_CROSSHAIRS, 0).crosshairs };
    const p = JSON.parse(raw) as Partial<Prefs> & { lookId?: string };
    const lookId = typeof p.lookId === "string" ? p.lookId.trim().slice(0, 64) : "";
    const look = parseLook(lookId || p.look) ?? parseLook(p.look) ?? parseLook(p.skin) ?? { ...DEFAULT_LOOK };
    const bank = parseCrosshairBank(p.crosshairs, p.crosshairSlot);
    return {
      name: typeof p.name === "string" && p.name.trim() && !/^you$/i.test(p.name.trim()) ? p.name.trim().slice(0, 18) : "",
      playerKey: typeof p.playerKey === "string" && KEY_RE.test(p.playerKey) ? p.playerKey : "",
      sens: clamp(Number(p.sens) || 1, 0.15, 4),
      volume: clamp(Number(p.volume) ?? 0.7, 0, 1),
      team: p.team === "stone" || p.team === "ember" ? p.team : undefined,
      look,
      lookId: lookId || packLook(look),
      skin: skinFromLook(look),
      loadout: parseLoadout(p.loadout),
      crosshairSlot: bank.crosshairSlot,
      crosshairs: bank.crosshairs,
    };
  } catch {
    return {
      ...defaults,
      look: { ...DEFAULT_LOOK },
      lookId: packLook(DEFAULT_LOOK),
      loadout: { ...DEFAULT_LOADOUT },
      crosshairs: parseCrosshairBank(FACTORY_CROSSHAIRS, 0).crosshairs,
    };
  }
}

export function savePrefs() {
  prefs.name = prefs.name.trim().slice(0, 18);
  if (/^you$/i.test(prefs.name)) prefs.name = "";
  prefs.sens = clamp(prefs.sens, 0.15, 4);
  prefs.volume = clamp(prefs.volume, 0, 1);
  prefs.skin = skinFromLook(prefs.look);
  prefs.lookId = packLook(prefs.look);
  if (prefs.playerKey && !KEY_RE.test(prefs.playerKey)) prefs.playerKey = "";
  localStorage.setItem(KEY, JSON.stringify({ ...prefs, look: prefs.look, lookId: prefs.lookId }));
  for (const fn of saveHooks) fn();
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
