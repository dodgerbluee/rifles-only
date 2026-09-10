/** Plant/cut hold cues. Cut progress can linger; the loop must not. */

export const CUT_REACH = 1.35;
export const CUT_REACH_Y = 1.6;

export type HoldSoundState = {
  plantCue: boolean;
  holdTick: number;
  cutting: boolean;
};

export function createHoldSound(): HoldSoundState {
  return { plantCue: false, holdTick: 0, cutting: false };
}

export function inCutReach(ax: number, ay: number, az: number, wx: number, wy: number, wz: number) {
  return Math.hypot(ax - wx, az - wz) < CUT_REACH && Math.abs(ay - wy) < CUT_REACH_Y;
}

/** True only while someone is actually cutting this frame — leftover cutHold does not count. */
export function isActivelyCutting(opts: {
  phase: string;
  wireMode: string;
  holdingUse: boolean;
  alive: boolean;
  cutterTeam: string;
  watchTeam: string;
  x: number;
  y: number;
  z: number;
  wx: number;
  wy: number;
  wz: number;
}) {
  if (opts.phase !== "planted" || opts.wireMode !== "planted") return false;
  if (!opts.alive || !opts.holdingUse) return false;
  if (opts.cutterTeam !== opts.watchTeam) return false;
  return inCutReach(opts.x, opts.y, opts.z, opts.wx, opts.wy, opts.wz);
}

export function stopCutSound(state: HoldSoundState) {
  state.plantCue = false;
  state.holdTick = 0;
  state.cutting = false;
}

export function tickHoldSound(
  state: HoldSoundState,
  hold: { holdingPlant: boolean; holdingCut: boolean; dt: number },
  cues: {
    playCutStart: () => void;
    playPlantStart: () => void;
    playHoldTick: (cutting: boolean) => void;
    stopCut?: () => void;
  },
) {
  if (hold.holdingPlant || hold.holdingCut) {
    if (!state.plantCue) {
      state.plantCue = true;
      state.cutting = hold.holdingCut;
      if (hold.holdingCut) cues.playCutStart();
      else cues.playPlantStart();
    }
    state.holdTick += hold.dt;
    const period = hold.holdingCut ? 0.26 : 0.36;
    if (state.holdTick >= period) {
      state.holdTick = 0;
      cues.playHoldTick(hold.holdingCut);
    }
    return;
  }
  const wasOn = state.plantCue || state.cutting;
  stopCutSound(state);
  if (wasOn) cues.stopCut?.();
}
