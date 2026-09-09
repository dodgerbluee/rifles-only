/**
 * Simulate clicks vs bolt cooldown.
 * Old: mouseDown only while held → tap during cycle/reload is eaten.
 * New: queue survives mouseup until one shot (or hold repeats).
 */
const CYCLE = 0.74;
const DT = 1 / 60;

function simOld({ clickAt, holdFor, lastFire0, blockedUntil = 0 }) {
  let lastFire = lastFire0;
  let shots = 0;
  for (let t = 0; t < 2.5; t += DT) {
    const held = t >= clickAt && t < clickAt + holdFor;
    const blocked = t < blockedUntil;
    if (held && !blocked && t - lastFire >= CYCLE) {
      shots += 1;
      lastFire = t;
    }
  }
  return shots;
}

function simNew({ clickAt, holdFor, lastFire0, blockedUntil = 0, dropOnReloadRelease = false }) {
  let lastFire = lastFire0;
  let queued = false;
  let held = false;
  let firedThisPress = false;
  let shots = 0;
  let wasHeld = false;
  let reloading = blockedUntil;
  for (let t = 0; t < 2.5; t += DT) {
    const down = t >= clickAt && t < clickAt + holdFor;
    if (down && !wasHeld) {
      queued = true;
      held = true;
      firedThisPress = false;
    } else if (!down && wasHeld) {
      held = false;
      if (firedThisPress || (dropOnReloadRelease && reloading > 0)) queued = false;
    }
    wasHeld = down;
    if (held) queued = true;
    const blocked = reloading > 0 || t - lastFire < CYCLE;
    if (queued && !blocked) {
      shots += 1;
      lastFire = t;
      queued = false;
      firedThisPress = true;
    }
    if (reloading > 0) {
      reloading -= DT;
      if (reloading <= 0) {
        reloading = 0;
        if (!held) queued = false;
      }
    }
  }
  return shots;
}

const cases = [
  {
    name: "tap during bolt (0.50s after shot)",
    clickAt: 0.5,
    holdFor: 0.05,
    lastFire0: 0,
    old: 0,
    queued: 1,
  },
  {
    name: "tap during reload then release",
    clickAt: 0.2,
    holdFor: 0.05,
    lastFire0: -10,
    blockedUntil: 1.45,
    dropOnReloadRelease: true,
    old: 0,
    queued: 0,
  },
  {
    name: "hold through reload",
    clickAt: 0.2,
    holdFor: 2,
    lastFire0: -10,
    blockedUntil: 1.45,
    dropOnReloadRelease: true,
    old: 1,
    queued: 1,
  },
  {
    name: "tap when ready",
    clickAt: 0.8,
    holdFor: 0.05,
    lastFire0: 0,
    old: 1,
    queued: 1,
  },
  {
    name: "hold 2s when ready (bolt repeat)",
    clickAt: 0.8,
    holdFor: 2,
    lastFire0: 0,
    old: 3,
    queued: 3,
  },
];

let failed = 0;
for (const c of cases) {
  const oldShots = simOld(c);
  const newShots = simNew(c);
  const ok = oldShots === c.old && newShots === c.queued;
  if (!ok) failed += 1;
  console.log(
    `${ok ? "ok" : "FAIL"}  ${c.name}\n     old=${oldShots} (want ${c.old})  queued=${newShots} (want ${c.queued})`,
  );
}

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\ntap-during-cooldown was eaten without a queue; queue keeps one shot");
