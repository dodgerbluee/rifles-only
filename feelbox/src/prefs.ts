import { DEFAULT_LOOK, parseLook, packLook, skinFromLook, type Appearance } from "./look";

const KEY = "rifles-only-prefs";

export type Prefs = {
  name: string;
  sens: number;
  volume: number;
  team?: "ember" | "stone";
  skin: "rifle" | "field" | "unit" | "frame";
  look: Appearance;
};

const defaults: Prefs = { name: "You", sens: 1, volume: 0.7, skin: "rifle", look: { ...DEFAULT_LOOK } };

export const prefs: Prefs = load();

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults, look: { ...DEFAULT_LOOK } };
    const p = JSON.parse(raw) as Partial<Prefs>;
    const look = parseLook(p.look) ?? parseLook(p.skin) ?? { ...DEFAULT_LOOK };
    return {
      name: typeof p.name === "string" && p.name.trim() ? p.name.trim().slice(0, 18) : defaults.name,
      sens: clamp(Number(p.sens) || 1, 0.15, 4),
      volume: clamp(Number(p.volume) ?? 0.7, 0, 1),
      team: p.team === "stone" || p.team === "ember" ? p.team : undefined,
      look,
      skin: skinFromLook(look),
    };
  } catch {
    return { ...defaults, look: { ...DEFAULT_LOOK } };
  }
}

export function savePrefs() {
  prefs.name = prefs.name.trim().slice(0, 18) || "You";
  prefs.sens = clamp(prefs.sens, 0.15, 4);
  prefs.volume = clamp(prefs.volume, 0, 1);
  prefs.skin = skinFromLook(prefs.look);
  localStorage.setItem(KEY, JSON.stringify({ ...prefs, look: prefs.look, lookId: packLook(prefs.look) }));
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
