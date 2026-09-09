const KEY = "rifles-only-prefs";

export type Prefs = {
  name: string;
  sens: number;
  volume: number;
  team?: "ember" | "stone";
};

const defaults: Prefs = { name: "You", sens: 1, volume: 0.7 };

export const prefs: Prefs = load();

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults };
    const p = JSON.parse(raw) as Partial<Prefs>;
    return {
      name: typeof p.name === "string" && p.name.trim() ? p.name.trim().slice(0, 18) : defaults.name,
      sens: clamp(Number(p.sens) || 1, 0.15, 4),
      volume: clamp(Number(p.volume) ?? 0.7, 0, 1),
      team: p.team === "stone" || p.team === "ember" ? p.team : undefined,
    };
  } catch {
    return { ...defaults };
  }
}

export function savePrefs() {
  prefs.name = prefs.name.trim().slice(0, 18) || "You";
  prefs.sens = clamp(prefs.sens, 0.15, 4);
  prefs.volume = clamp(prefs.volume, 0, 1);
  localStorage.setItem(KEY, JSON.stringify(prefs));
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
