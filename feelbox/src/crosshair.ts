/**
 * CS2-style crosshair. Settings use the same knobs; pixels match 1080p CS units.
 */
export type CrosshairStyle = "classic" | "static";

export type Crosshair = {
  style: CrosshairStyle;
  length: number;
  thickness: number;
  gap: number;
  outline: boolean;
  outlineThickness: number;
  dot: boolean;
  t: boolean;
  r: number;
  g: number;
  b: number;
  a: number;
};

export type CrosshairMetrics = {
  length: number;
  thick: number;
  gap: number;
  dot: number;
  outline: number;
  color: string;
  alpha: number;
  t: boolean;
  arms: boolean;
};

export const CROSSHAIR_SLOT_COUNT = 5;

export const CROSSHAIR_COLORS: { id: string; label: string; r: number; g: number; b: number }[] = [
  { id: "white", label: "White", r: 255, g: 255, b: 255 },
  { id: "green", label: "Green", r: 50, g: 250, b: 50 },
  { id: "yellow", label: "Yellow", r: 250, g: 250, b: 50 },
  { id: "blue", label: "Blue", r: 50, g: 50, b: 250 },
  { id: "cyan", label: "Cyan", r: 50, g: 250, b: 250 },
  { id: "red", label: "Red", r: 250, g: 50, b: 50 },
];

export const DEFAULT_CROSSHAIR: Crosshair = {
  style: "classic",
  length: 4,
  thickness: 1,
  gap: 1.5,
  outline: true,
  outlineThickness: 1,
  dot: false,
  t: false,
  r: 255,
  g: 255,
  b: 255,
  a: 255,
};

export const FACTORY_CROSSHAIRS: Crosshair[] = [
  { ...DEFAULT_CROSSHAIR },
  {
    style: "classic",
    length: 2.5,
    thickness: 0.5,
    gap: -2.2,
    outline: true,
    outlineThickness: 1,
    dot: false,
    t: false,
    r: 50,
    g: 250,
    b: 50,
    a: 200,
  },
  {
    style: "static",
    length: 1.8,
    thickness: 0.4,
    gap: -3,
    outline: true,
    outlineThickness: 1,
    dot: false,
    t: false,
    r: 50,
    g: 250,
    b: 250,
    a: 255,
  },
  {
    style: "static",
    length: 0,
    thickness: 1.6,
    gap: 0,
    outline: true,
    outlineThickness: 1,
    dot: true,
    t: false,
    r: 255,
    g: 255,
    b: 255,
    a: 255,
  },
  {
    style: "static",
    length: 3.2,
    thickness: 1.2,
    gap: -1,
    outline: true,
    outlineThickness: 1,
    dot: false,
    t: true,
    r: 250,
    g: 50,
    b: 50,
    a: 255,
  },
];

const DRAW_HTML =
  '<span class="ch-arm ch-n"></span><span class="ch-arm ch-e"></span><span class="ch-arm ch-s"></span><span class="ch-arm ch-w"></span><span class="ch-dot"></span>';

export function cloneCrosshair(ch: Crosshair): Crosshair {
  return { ...ch };
}

export function currentCrosshair(bank: { crosshairs: Crosshair[]; crosshairSlot: number }): Crosshair {
  return bank.crosshairs[bank.crosshairSlot] ?? bank.crosshairs[0] ?? cloneCrosshair(DEFAULT_CROSSHAIR);
}

export function parseCrosshair(raw: unknown, fallback: Crosshair = DEFAULT_CROSSHAIR): Crosshair {
  if (!raw || typeof raw !== "object") return cloneCrosshair(fallback);
  const p = raw as Partial<Crosshair>;
  return {
    style: p.style === "classic" || p.style === "static" ? p.style : fallback.style,
    length: num(p.length, 0, 10, fallback.length),
    thickness: num(p.thickness, 0.1, 6, fallback.thickness),
    gap: num(p.gap, -5, 5, fallback.gap),
    outline: flag(p.outline, fallback.outline),
    outlineThickness: num(p.outlineThickness, 0.5, 3, fallback.outlineThickness),
    dot: flag(p.dot, fallback.dot),
    t: flag(p.t, fallback.t),
    r: Math.round(num(p.r, 0, 255, fallback.r)),
    g: Math.round(num(p.g, 0, 255, fallback.g)),
    b: Math.round(num(p.b, 0, 255, fallback.b)),
    a: Math.round(num(p.a, 0, 255, fallback.a)),
  };
}

export function parseCrosshairBank(
  raw: unknown,
  slotRaw: unknown,
): { crosshairs: Crosshair[]; crosshairSlot: number } {
  const src = Array.isArray(raw) ? raw : [];
  const crosshairs = FACTORY_CROSSHAIRS.map((factory, i) => parseCrosshair(src[i], factory));
  const n = Number(slotRaw);
  const slot = Number.isFinite(n) ? Math.max(0, Math.min(CROSSHAIR_SLOT_COUNT - 1, Math.floor(n))) : 0;
  return { crosshairs, crosshairSlot: slot };
}

export function viewScale() {
  return typeof window === "undefined" ? 1 : window.innerHeight / 1080;
}

/** CS2 units at the given scale. `spreadPx` is the full hip-spread gap from the HUD. */
export function crosshairMetrics(ch: Crosshair, spreadPx = 0, scale = 1): CrosshairMetrics {
  const length = Math.max(0, ch.length * 2 * scale);
  const thick = Math.max(0, ch.thickness * 2 * scale);
  const rest = Math.max(0, (4 + ch.gap * 2) * scale);
  const gap = ch.style === "classic" ? Math.max(rest, spreadPx / 2) : rest;
  const dot = ch.dot ? Math.max(1 * scale, thick) : 0;
  const outline = ch.outline ? Math.max(0.5, ch.outlineThickness * scale) : 0;
  return {
    length,
    thick,
    gap,
    dot,
    outline,
    color: `rgb(${ch.r}, ${ch.g}, ${ch.b})`,
    alpha: ch.a / 255,
    t: ch.t,
    arms: length > 0.2,
  };
}

export function fillCrosshairDraw(el: HTMLElement) {
  if (!el.querySelector(".ch-arm")) el.innerHTML = DRAW_HTML;
}

export function paintCrosshair(el: HTMLElement, ch: Crosshair, spreadPx = 0, scale = viewScale()) {
  fillCrosshairDraw(el);
  const m = crosshairMetrics(ch, spreadPx, scale);
  el.style.setProperty("--ch-length", `${m.length}px`);
  el.style.setProperty("--ch-thick", `${m.thick}px`);
  el.style.setProperty("--ch-gap", `${m.gap}px`);
  el.style.setProperty("--ch-dot", `${m.dot}px`);
  el.style.setProperty("--ch-outline", `${m.outline}px`);
  el.style.setProperty("--ch-color", m.color);
  el.style.setProperty("--ch-alpha", String(m.alpha));
  el.classList.toggle("ch-t", m.t);
  el.classList.toggle("ch-no-arms", !m.arms);
  el.classList.toggle("ch-no-dot", m.dot <= 0);
}

type Bank = { crosshairs: Crosshair[]; crosshairSlot: number };

export function bindCrosshairSettings(bank: Bank, save: () => void) {
  const slotsEl = document.querySelector<HTMLElement>("#ch-slots");
  const preview = document.querySelector<HTMLElement>("#ch-preview-draw");
  const hud = document.querySelector<HTMLElement>("#crosshair");
  if (!slotsEl || !preview) return;

  const styleEl = document.querySelector<HTMLSelectElement>("#ch-style")!;
  const dotEl = document.querySelector<HTMLInputElement>("#ch-dot")!;
  const outlineEl = document.querySelector<HTMLInputElement>("#ch-outline")!;
  const tEl = document.querySelector<HTMLInputElement>("#ch-t")!;
  const lengthEl = document.querySelector<HTMLInputElement>("#ch-length")!;
  const thickEl = document.querySelector<HTMLInputElement>("#ch-thick")!;
  const gapEl = document.querySelector<HTMLInputElement>("#ch-gap")!;
  const outwEl = document.querySelector<HTMLInputElement>("#ch-outw")!;
  const rEl = document.querySelector<HTMLInputElement>("#ch-r")!;
  const gEl = document.querySelector<HTMLInputElement>("#ch-g")!;
  const bEl = document.querySelector<HTMLInputElement>("#ch-b")!;
  const aEl = document.querySelector<HTMLInputElement>("#ch-a")!;
  const colorsEl = document.querySelector<HTMLElement>("#ch-colors")!;
  const resetEl = document.querySelector<HTMLButtonElement>("#ch-reset");

  const lengthV = document.querySelector("#ch-length-v")!;
  const thickV = document.querySelector("#ch-thick-v")!;
  const gapV = document.querySelector("#ch-gap-v")!;
  const outwV = document.querySelector("#ch-outw-v")!;
  const rV = document.querySelector("#ch-r-v")!;
  const gV = document.querySelector("#ch-g-v")!;
  const bV = document.querySelector("#ch-b-v")!;
  const aV = document.querySelector("#ch-a-v")!;

  slotsEl.replaceChildren();
  for (let i = 0; i < CROSSHAIR_SLOT_COUNT; i++) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ch-slot";
    b.dataset.slot = String(i);
    b.setAttribute("aria-label", `Crosshair ${i + 1}`);
    const draw = document.createElement("span");
    draw.className = "ch-draw";
    b.append(draw);
    b.addEventListener("click", () => {
      bank.crosshairSlot = i;
      save();
      paint();
    });
    slotsEl.append(b);
  }

  colorsEl.replaceChildren();
  for (const c of CROSSHAIR_COLORS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ch-swatch";
    b.dataset.color = c.id;
    b.title = c.label;
    b.setAttribute("aria-label", c.label);
    b.style.background = `rgb(${c.r}, ${c.g}, ${c.b})`;
    b.addEventListener("click", () => {
      const ch = currentCrosshair(bank);
      ch.r = c.r;
      ch.g = c.g;
      ch.b = c.b;
      save();
      paint();
    });
    colorsEl.append(b);
  }

  fillCrosshairDraw(preview);
  if (hud) fillCrosshairDraw(hud);

  const paint = () => {
    const ch = currentCrosshair(bank);
    styleEl.value = ch.style;
    dotEl.checked = ch.dot;
    outlineEl.checked = ch.outline;
    tEl.checked = ch.t;
    lengthEl.value = String(ch.length);
    thickEl.value = String(ch.thickness);
    gapEl.value = String(ch.gap);
    outwEl.value = String(ch.outlineThickness);
    rEl.value = String(ch.r);
    gEl.value = String(ch.g);
    bEl.value = String(ch.b);
    aEl.value = String(ch.a);
    lengthV.textContent = ch.length.toFixed(1);
    thickV.textContent = ch.thickness.toFixed(1);
    gapV.textContent = ch.gap.toFixed(1);
    outwV.textContent = ch.outlineThickness.toFixed(1);
    rV.textContent = String(ch.r);
    gV.textContent = String(ch.g);
    bV.textContent = String(ch.b);
    aV.textContent = String(ch.a);
    paintCrosshair(preview, ch, 0);
    if (hud) paintCrosshair(hud, ch, 0);
    slotsEl.querySelectorAll<HTMLElement>(".ch-slot").forEach((btn, i) => {
      btn.classList.toggle("on", i === bank.crosshairSlot);
      const draw = btn.querySelector<HTMLElement>(".ch-draw");
      if (draw && bank.crosshairs[i]) paintCrosshair(draw, bank.crosshairs[i]!, 0, 1.35);
    });
    colorsEl.querySelectorAll<HTMLElement>(".ch-swatch").forEach((btn, i) => {
      const c = CROSSHAIR_COLORS[i]!;
      btn.classList.toggle("on", ch.r === c.r && ch.g === c.g && ch.b === c.b);
    });
  };

  const edit = (fn: (ch: Crosshair) => void) => {
    fn(currentCrosshair(bank));
    save();
    paint();
  };

  styleEl.addEventListener("change", () =>
    edit((ch) => {
      ch.style = styleEl.value === "classic" ? "classic" : "static";
    }),
  );
  dotEl.addEventListener("change", () => edit((ch) => (ch.dot = dotEl.checked)));
  outlineEl.addEventListener("change", () => edit((ch) => (ch.outline = outlineEl.checked)));
  tEl.addEventListener("change", () => edit((ch) => (ch.t = tEl.checked)));
  lengthEl.addEventListener("input", () => edit((ch) => (ch.length = Number(lengthEl.value))));
  thickEl.addEventListener("input", () => edit((ch) => (ch.thickness = Number(thickEl.value))));
  gapEl.addEventListener("input", () => edit((ch) => (ch.gap = Number(gapEl.value))));
  outwEl.addEventListener("input", () => edit((ch) => (ch.outlineThickness = Number(outwEl.value))));
  rEl.addEventListener("input", () => edit((ch) => (ch.r = Number(rEl.value))));
  gEl.addEventListener("input", () => edit((ch) => (ch.g = Number(gEl.value))));
  bEl.addEventListener("input", () => edit((ch) => (ch.b = Number(bEl.value))));
  aEl.addEventListener("input", () => edit((ch) => (ch.a = Number(aEl.value))));
  resetEl?.addEventListener("click", () => {
    const i = bank.crosshairSlot;
    bank.crosshairs[i] = cloneCrosshair(FACTORY_CROSSHAIRS[i] ?? DEFAULT_CROSSHAIR);
    save();
    paint();
  });
  addEventListener("resize", paint);
  paint();
}

function num(v: unknown, min: number, max: number, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function flag(v: unknown, fallback: boolean) {
  return typeof v === "boolean" ? v : fallback;
}
