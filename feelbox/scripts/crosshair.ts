/**
 * CS2-style crosshair settings: white default, five saved slots, classic vs static gap.
 */
import {
  CROSSHAIR_SLOT_COUNT,
  DEFAULT_CROSSHAIR,
  FACTORY_CROSSHAIRS,
  cloneCrosshair,
  crosshairMetrics,
  currentCrosshair,
  parseCrosshair,
  parseCrosshairBank,
} from "../src/crosshair.ts";

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
}

check("five saved slots", CROSSHAIR_SLOT_COUNT === 5 && FACTORY_CROSSHAIRS.length === 5);
check(
  "default is white",
  DEFAULT_CROSSHAIR.r === 255 && DEFAULT_CROSSHAIR.g === 255 && DEFAULT_CROSSHAIR.b === 255,
);
check("default is not cream", DEFAULT_CROSSHAIR.r === DEFAULT_CROSSHAIR.g);
check("slot 0 is the white default", FACTORY_CROSSHAIRS[0]!.r === 255 && FACTORY_CROSSHAIRS[0]!.g === 255);

const parsed = parseCrosshair({
  style: "static",
  length: 99,
  thickness: -2,
  gap: 40,
  outline: "yes",
  dot: true,
  t: false,
  r: 12.4,
  g: 300,
  b: -4,
  a: 80,
});
check("length clamps to 10", parsed.length === 10);
check("thickness clamps to 0.1", parsed.thickness === 0.1);
check("gap clamps to 5", parsed.gap === 5);
check("junk outline keeps default on", parsed.outline === true);
check("dot flag is kept", parsed.dot === true);
check("rgb clamps and rounds", parsed.r === 12 && parsed.g === 255 && parsed.b === 0);
check("alpha keeps 80", parsed.a === 80);
check("unknown style falls back", parseCrosshair({ style: "legacy" }).style === "classic");
check("empty parse is the white default", parseCrosshair(null).r === 255 && parseCrosshair(null).length === 4);

const bank = parseCrosshairBank([{ r: 10, g: 20, b: 30, length: 2 }], 9);
check("bank always has five", bank.crosshairs.length === 5);
check("slot 0 reads saved color", bank.crosshairs[0]!.r === 10 && bank.crosshairs[0]!.length === 2);
check("missing slots fill from factory", bank.crosshairs[1]!.g === 250 && bank.crosshairs[3]!.dot === true);
check("slot index clamps", bank.crosshairSlot === 4);
check("junk bank still factories", parseCrosshairBank("nope", "x").crosshairs[0]!.r === 255);

const a = cloneCrosshair(DEFAULT_CROSSHAIR);
a.length = 8;
check("clone is independent", DEFAULT_CROSSHAIR.length === 4 && a.length === 8);

const cur = currentCrosshair({ crosshairs: bank.crosshairs, crosshairSlot: 3 });
check("current slot is the white dot", cur.dot === true && cur.length === 0);

const rest = crosshairMetrics(DEFAULT_CROSSHAIR, 0, 1);
check("1080p length is 8px", rest.length === 8);
check("1080p thickness is 2px", rest.thick === 2);
check("1080p rest gap is 7px", rest.gap === 7);
check("default color css is white", rest.color === "rgb(255, 255, 255)");
check("default draws arms", rest.arms === true && rest.t === false && rest.dot === 0);

const opened = crosshairMetrics(DEFAULT_CROSSHAIR, 40, 1);
check("classic opens past rest gap", opened.gap === 20);
check("classic stays at rest when tight", crosshairMetrics(DEFAULT_CROSSHAIR, 10, 1).gap === 7);

const frozen = parseCrosshair({ ...DEFAULT_CROSSHAIR, style: "static" });
check("static ignores hip spread", crosshairMetrics(frozen, 40, 1).gap === 7);

const t = parseCrosshair({ ...DEFAULT_CROSSHAIR, t: true, dot: true, outline: false, a: 128 });
const tm = crosshairMetrics(t, 0, 1);
check("t-style keeps a T flag", tm.t === true && tm.dot === 2);
check("outline off is 0", tm.outline === 0);
check("alpha 128 is half", tm.alpha === 128 / 255);

const green = FACTORY_CROSSHAIRS[1]!;
check("green slot is CS green", green.r === 50 && green.g === 250 && green.b === 50);
check("slots are distinct", new Set(FACTORY_CROSSHAIRS.map((c) => `${c.r},${c.g},${c.b},${c.t},${c.dot}`)).size === 5);

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\ncrosshair settings round-trip");
