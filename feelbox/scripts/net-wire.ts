/**
 * Home-host snapshot budget. Fat 60 Hz JSON to four friends saturates a
 * typical upload; packed 30 Hz snaps must stay under HOME_BUDGET_KBPS.
 */
import { SNAP_HZ } from "../src/netFeel.ts";
import type { Pawn, PlayerInput, Snapshot } from "../src/net.ts";
import {
  HOME_BUDGET_KBPS,
  HOME_FRIENDS,
  SNAP_BUFFER_HARD,
  SNAP_BUFFER_SOFT,
  createWireBuf,
  fatSnapBytes,
  isDroppableSnapHead,
  packSnap,
  shouldDropSnap,
  shouldSendInput,
  unpackSnap,
  wireKbps,
} from "../src/netWire.ts";

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
}

function pawn(id: number, netId: number, name: string, team: "ember" | "stone"): Pawn {
  return {
    id,
    netId,
    name,
    team,
    x: -12.4 + id,
    y: 1.64,
    z: 8.2 - id * 0.4,
    yaw: 1.12,
    pitch: -0.08,
    hp: 100,
    alive: true,
    weapon: "kar",
    ads: false,
    crouch: false,
    prone: false,
    nades: { smoke: 2, frag: 1, stun: 1, flash: 1 },
    kills: id,
    assists: 0,
    deaths: 0,
    ping: netId ? 24 + id : undefined,
    look: "1234567",
    skin: "rifle",
  };
}

const snap: Snapshot = {
  phase: "live",
  round: 3,
  emberScore: 2,
  stoneScore: 1,
  swapped: false,
  clock: 97.4,
  time: 41.2,
  wireTime: 35,
  wire: { mode: "carried", carrierId: 2, site: null, x: -10, y: 1.2, z: 4, plantHold: 0, cutHold: 0 },
  pawns: [
    pawn(0, 1, "Reed", "ember"),
    pawn(1, 2, "Cal", "ember"),
    pawn(2, 3, "June", "ember"),
    pawn(3, 0, "Bot 3", "ember"),
    pawn(4, 0, "Bot 4", "ember"),
    pawn(5, 4, "Ash", "stone"),
    pawn(6, 5, "Pim", "stone"),
    pawn(7, 0, "Bot 7", "stone"),
    pawn(8, 0, "Bot 8", "stone"),
    pawn(9, 0, "Bot 9", "stone"),
  ],
  feed: [
    {
      t: 12.4,
      killerId: 0,
      killerName: "Reed",
      killerTeam: "ember",
      victimId: 5,
      victimName: "Ash",
      victimTeam: "stone",
      way: "aimed",
      head: true,
      rifle: "kar",
    },
  ],
  events: [],
  clouds: [{ x: 4, y: 1, z: -2, radius: 3.2, opacity: 0.7 }],
  nades: [{ x: 1, y: 2, z: 3, kind: "frag" }],
  pops: [],
  headPops: [],
  mapId: "wharf",
  nextMap: "harbor",
  endText: "",
  lastWinner: null,
};

const fat = fatSnapBytes(snap);
const fatKbps = wireKbps(fat, 60, HOME_FRIENDS);
const buf = createWireBuf();
const packedFull = packSnap(snap, buf, true);
const fullLen = JSON.stringify(packedFull).length;
const hot = packSnap({ ...snap, time: 41.22, pawns: snap.pawns.map((p) => ({ ...p, x: p.x + 0.08 })) }, buf);
const hotLen = JSON.stringify(hot).length;
const round = unpackSnap(packedFull, null);
const hotUn = unpackSnap(hot, round);
const fourHot = wireKbps(hotLen, SNAP_HZ, HOME_FRIENDS);

const blank: PlayerInput = {
  keys: ["KeyW"],
  yaw: 1,
  pitch: 0,
  fire: false,
  ads: false,
  lean: 0,
  weapon: "kar",
  crouch: false,
  prone: false,
  jump: false,
  use: false,
  mx: 0,
  my: 0,
};

check("fat 60 Hz JSON to 4 friends blows a home upload", fatKbps > HOME_BUDGET_KBPS, `kbps=${fatKbps.toFixed(0)} bytes=${fat}`);
check("packed full snap is smaller than fat JSON", fullLen < fat * 0.7, `full=${fullLen} fat=${fat}`);
check("hot snap is much smaller than fat JSON", hotLen < fat * 0.45, `hot=${hotLen} fat=${fat}`);
check("packed 30 Hz to 4 friends fits the home budget", fourHot <= HOME_BUDGET_KBPS, `kbps=${fourHot.toFixed(0)} budget=${HOME_BUDGET_KBPS}`);
check("unpack keeps names", round.pawns[0]?.name === "Reed" && round.pawns[5]?.name === "Ash");
check("hot snap still knows who Reed is", hotUn.pawns[0]?.name === "Reed");
check("hot snap moved Reed", Math.abs((hotUn.pawns[0]?.x ?? 0) - (snap.pawns[0]!.x + 0.08)) < 0.02);
check("kill feed survives a full pack", round.feed.length === 1 && round.feed[0]?.killerName === "Reed");
check("hot snap is droppable", hot.u === 1 && packedFull.u === 0);
check("droppable head sniffs packed snaps", isDroppableSnapHead(JSON.stringify(hot)));
check("full snap is not droppable", !isDroppableSnapHead(JSON.stringify(packedFull)));
check("soft buffer drops droppable snaps", shouldDropSnap(SNAP_BUFFER_SOFT + 1, true));
check("soft buffer keeps oneshots", !shouldDropSnap(SNAP_BUFFER_SOFT + 1, false));
check("hard buffer drops even oneshots", shouldDropSnap(SNAP_BUFFER_HARD + 1, false));
check("first input always sends", shouldSendInput(null, blank, 0, 0));
check("144 Hz look is capped to tick rate", !shouldSendInput(blank, { ...blank, yaw: 1.02 }, 4, 0));
check("next tick may send look", shouldSendInput(blank, { ...blank, yaw: 1.02 }, 17, 0));
check("fire edge sends immediately", shouldSendInput(blank, { ...blank, fire: true }, 2, 0));

const emptyClouds = packSnap({ ...snap, clouds: [], nades: [], feed: [] }, createWireBuf(), true);
const unEmpty = unpackSnap(emptyClouds, round);
check("full snap with no clouds clears previous smoke", (unEmpty.clouds ?? []).length === 0);
const hotClearBuf = createWireBuf();
packSnap(snap, hotClearBuf, true);
const hotClear = packSnap({ ...snap, clouds: [], nades: [] }, hotClearBuf);
const unHotClear = unpackSnap(hotClear, round);
check("hot snap with no clouds clears previous smoke", (unHotClear.clouds ?? []).length === 0);

console.log(
  JSON.stringify(
    { fat, fullLen, hotLen, fatKbps: Math.round(fatKbps), packedKbps: Math.round(fourHot), snapHz: SNAP_HZ },
    null,
    2,
  ),
);

if (failed) {
  console.error(`${failed} net-wire checks failed`);
  process.exit(10);
}
console.log("probe: packed snaps fit a 4-friend home host");
