import {
  addBotSlot,
  removeBotSlot,
  teamBotCount,
  type Match,
  type Slot,
  type Team,
} from "./match";
import { TUNING_FIELDS, tuning } from "./tuning";

export const rules = {
  godmode: false,
  friendlyFire: false,
  highlights: true,
  oneShot: false,
  classicPawn: false,
};

export function bindAdmin(opts: {
  match: Match;
  onAdd: (slot: Slot) => void;
  onRemove: (slot: Slot) => void;
  onRestart: () => void;
  onKick: (slot: Slot) => void;
  onCow: (slot: Slot) => void;
  onPawnStyle?: (classic: boolean) => void;
}) {
  const panel = document.querySelector<HTMLElement>("#admin")!;
  const god = document.querySelector<HTMLInputElement>("#admin-god")!;
  const ff = document.querySelector<HTMLInputElement>("#admin-ff")!;
  const hl = document.querySelector<HTMLInputElement>("#admin-hl")!;
  const one = document.querySelector<HTMLInputElement>("#admin-oneshot")!;
  const classicPawn = document.querySelector<HTMLInputElement>("#admin-classic-pawn");
  const emberN = document.querySelector("#admin-ember")!;
  const stoneN = document.querySelector("#admin-stone")!;
  const pick = document.querySelector<HTMLSelectElement>("#admin-player")!;
  const knobs = document.querySelector("#admin-knobs")!;

  knobs.replaceChildren();
  for (const f of TUNING_FIELDS) {
    const row = document.createElement("label");
    row.className = "admin-knob";
    const name = document.createElement("span");
    name.textContent = f.label;
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(f.min);
    input.max = String(f.max);
    input.step = String(f.step);
    input.value = String(tuning[f.key]);
    const val = document.createElement("b");
    val.textContent = String(tuning[f.key]);
    input.addEventListener("input", () => {
      const n = Number(input.value);
      (tuning[f.key] as number) = n;
      val.textContent = Number.isInteger(f.step) ? String(n) : n.toFixed(2);
    });
    row.append(name, input, val);
    knobs.append(row);
  }

  const selected = (): Slot | undefined => opts.match.slots.find((s) => String(s.id) === pick.value);

  const sync = () => {
    god.checked = rules.godmode;
    ff.checked = rules.friendlyFire;
    hl.checked = rules.highlights;
    one.checked = rules.oneShot;
    if (classicPawn) classicPawn.checked = rules.classicPawn;
    emberN.textContent = String(teamBotCount(opts.match, "ember"));
    stoneN.textContent = String(teamBotCount(opts.match, "stone"));
    const cur = pick.value;
    pick.replaceChildren();
    for (const s of opts.match.slots) {
      const o = document.createElement("option");
      o.value = String(s.id);
      o.textContent = `${s.name} · ${s.team === "ember" ? "Ember" : "Stone"}${s.kind === "human" ? " · human" : ""}`;
      pick.append(o);
    }
    if ([...pick.options].some((o) => o.value === cur)) pick.value = cur;
  };

  god.addEventListener("change", () => {
    rules.godmode = god.checked;
  });
  ff.addEventListener("change", () => {
    rules.friendlyFire = ff.checked;
  });
  hl.addEventListener("change", () => {
    rules.highlights = hl.checked;
  });
  one.addEventListener("change", () => {
    rules.oneShot = one.checked;
  });
  classicPawn?.addEventListener("change", () => {
    opts.onPawnStyle?.(classicPawn.checked);
  });

  const add = (team: Team) => {
    const slot = addBotSlot(opts.match, team);
    opts.onAdd(slot);
    sync();
  };
  const sub = (team: Team) => {
    const slot = removeBotSlot(opts.match, team);
    if (slot) opts.onRemove(slot);
    sync();
  };

  document.querySelector("#admin-ember-add")!.addEventListener("click", () => add("ember"));
  document.querySelector("#admin-ember-sub")!.addEventListener("click", () => sub("ember"));
  document.querySelector("#admin-stone-add")!.addEventListener("click", () => add("stone"));
  document.querySelector("#admin-stone-sub")!.addEventListener("click", () => sub("stone"));
  document.querySelector("#admin-restart")!.addEventListener("click", () => opts.onRestart());
  document.querySelector("#admin-kick")!.addEventListener("click", () => {
    const s = selected();
    if (s) opts.onKick(s);
    sync();
  });
  document.querySelector("#admin-cow")!.addEventListener("click", () => {
    const s = selected();
    if (s) opts.onCow(s);
  });

  addEventListener("keydown", (e) => {
    if (e.code !== "Backquote" && e.code !== "F10") return;
    e.preventDefault();
    const open = !document.body.classList.contains("admin");
    document.body.classList.toggle("admin", open);
    panel.classList.toggle("on", open);
    if (open) document.exitPointerLock();
    sync();
  });

  panel.addEventListener("mousedown", (e) => e.stopPropagation());
  sync();
  return { sync };
}
