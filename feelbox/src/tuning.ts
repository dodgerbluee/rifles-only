export const tuning = {
  walk: 5.85,
  jumpH: 1.05,
  gravity: 9.81,
  adsSlow: 0.62,
  leanM: 0.7,
  melee: 1.92,
  hipStand: 0.018,
  hipMove: 0.046,
  plant: 5,
  cut: 7,
  round: 120,
  recoil: 1,
  blastR: 9,
  fuse: 40,
};

export function jumpSpeed() {
  return Math.sqrt(2 * tuning.jumpH * tuning.gravity);
}

export const TUNING_FIELDS: { key: keyof typeof tuning; label: string; min: number; max: number; step: number }[] = [
  { key: "walk", label: "Run speed", min: 2, max: 12, step: 0.1 },
  { key: "jumpH", label: "Jump height", min: 0.2, max: 4, step: 0.05 },
  { key: "gravity", label: "Gravity", min: 4, max: 24, step: 0.1 },
  { key: "adsSlow", label: "ADS move scale", min: 0.2, max: 1, step: 0.02 },
  { key: "leanM", label: "Lean distance", min: 0, max: 1.4, step: 0.05 },
  { key: "melee", label: "Melee reach", min: 0.8, max: 4, step: 0.05 },
  { key: "hipStand", label: "Hip spread still", min: 0, max: 0.08, step: 0.001 },
  { key: "hipMove", label: "Hip spread move", min: 0, max: 0.12, step: 0.001 },
  { key: "plant", label: "Plant seconds", min: 1, max: 12, step: 0.5 },
  { key: "cut", label: "Cut seconds", min: 1, max: 15, step: 0.5 },
  { key: "round", label: "Round seconds", min: 30, max: 240, step: 5 },
  { key: "fuse", label: "Wire fuse", min: 10, max: 90, step: 1 },
  { key: "recoil", label: "Recoil", min: 0, max: 3, step: 0.05 },
  { key: "blastR", label: "Wire blast radius", min: 2, max: 20, step: 0.5 },
];
