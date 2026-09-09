import { consumeStride, GAIT_PER_DIST, type Stride } from "./pawn";

let own: AudioContext | null = null;
let volume = 0.7;
let gait = 0;
let lastX = 0;
let lastZ = 0;
let primed = false;

export function setStepVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
}

export function playStep(side: Stride, intensity = 1, ctx?: AudioContext | null) {
  const audio = ctx ?? own ?? (own = new AudioContext());
  if (audio.state === "suspended") void audio.resume();
  const dur = 0.1;
  const n = audio.createBufferSource();
  const buf = audio.createBuffer(1, Math.max(1, Math.floor(audio.sampleRate * dur)), audio.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / data.length;
    data[i] = (Math.random() * 2 - 1) * (1 - t) * (1 - t);
  }
  n.buffer = buf;
  const f = audio.createBiquadFilter();
  f.type = "bandpass";
  const hz = (side === "left" ? 200 : 248) + Math.random() * 36;
  f.frequency.value = hz;
  f.Q.value = 0.85;
  const g = audio.createGain();
  const gain = 0.048 * volume * Math.max(0.15, intensity);
  g.gain.value = gain;
  const pan = audio.createStereoPanner();
  pan.pan.value = side === "left" ? -0.18 : 0.18;
  n.connect(f);
  f.connect(g);
  g.connect(pan);
  pan.connect(audio.destination);
  f.frequency.exponentialRampToValueAtTime(Math.max(80, hz * 0.42), audio.currentTime + 0.075);
  g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
  n.start();
  n.stop(audio.currentTime + dur);
}

export function tickSteps(state: {
  x: number;
  z: number;
  grounded: boolean;
  moving: boolean;
  crouch?: boolean;
  ads?: boolean;
  prone?: boolean;
  ctx?: AudioContext | null;
}) {
  if (!primed) {
    lastX = state.x;
    lastZ = state.z;
    primed = true;
    return;
  }
  let dist = Math.hypot(state.x - lastX, state.z - lastZ);
  lastX = state.x;
  lastZ = state.z;
  if (dist > 1.2) {
    gait = 0;
    return;
  }
  dist = Math.min(dist, 0.22);
  const stepping = state.grounded && state.moving && dist > 0.003;
  if (!stepping) return;
  const prev = gait;
  gait += dist * GAIT_PER_DIST;
  const side = consumeStride(prev, gait);
  if (!side) return;
  playStep(side, stepGain(state), state.ctx);
}

function stepGain(state: { crouch?: boolean; ads?: boolean; prone?: boolean }) {
  if (state.prone) return 0.32;
  if (state.crouch && state.ads) return 0.4;
  if (state.crouch || state.ads) return 0.52;
  return 1.18;
}
