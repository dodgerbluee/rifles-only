/** Semi-auto click buffer. A tap during bolt/freeze still fires once ready. Reload drops the queue on release. */

export type FireQueue = {
  queued: boolean;
  held: boolean;
  firedThisPress: boolean;
};

export function emptyQueue(): FireQueue {
  return { queued: false, held: false, firedThisPress: false };
}

export function pressFire(q: FireQueue) {
  q.queued = true;
  q.held = true;
  q.firedThisPress = false;
}

export function releaseFire(q: FireQueue) {
  q.held = false;
  if (q.firedThisPress) q.queued = false;
}

export function fireWantsShot(q: FireQueue) {
  if (q.held) q.queued = true;
  return q.queued;
}

export function consumeFire(q: FireQueue) {
  q.queued = false;
  q.firedThisPress = true;
}

export function cycleReady(now: number, lastFire: number, cycle: number) {
  return now - lastFire >= cycle;
}

export function clearFire(q: FireQueue) {
  q.queued = false;
  q.held = false;
  q.firedThisPress = false;
}
