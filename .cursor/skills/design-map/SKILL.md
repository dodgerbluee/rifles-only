---
name: design-map
description: Design and implement Rifles Only maps through a compact LayoutSpec and compiler. Use when the user wants a new map, a map redesign, layout, bombsite, spawn, rotation map, or says maps are bad / look like box piles. Also use when they saved a Map studio draft or ask you to finalize a sketch.
---

# Design a map

The human **paints the lot**. You **finalize**. Do not start from a pile of `box()` calls.

## Map studio

Home (server list) → **Map studio**. **Hand** grabs existing pieces or **Erase** (X) click/drag-deletes them. **Build** stamps buildings, floors, **Cut** (U) holes in a deck, thin **Wall** (W) room dividers, doors, and windows. **Accessories** stamps cover, stair **Climb** (C), and **Ladder** (N) against a wall. Drawing a same-size building on a floored 1-storey house raises that house; a smaller rect on the deck is a new room shell at that height. **Play** runs the sketch against bots (no finalize). **Save for agent** if you want a rotation map.

That writes `feelbox/studio-draft.json` (and a download + localStorage). **Play** does not need that file. If the file exists and they ask you to finalize, skip ASCII and start at **Finalize**.

## Steps

1. **Intake** — get four facts before any geometry (skip if the studio draft already has them):
   - Planting side enters from where (compass + one landmark)
   - A and B are what (one-word names)
   - One mid fight
   - Mood in one clause (winter dock, limestone pit, …) plus at most one real reference
   If the ask is “make a cool map” and there is no draft, ask for the card.

2. **Studio or ASCII**
   - Prefer `feelbox/studio-draft.json`. The human already placed the lot.
   - Only draw ASCII (12–16 columns) if there is no draft and they are not in studio.
     `E` planter  `S` watcher  `A`/`B` sites  `#` building  `=` cover  `.` open

3. **Finalize** — write `feelbox/src/maps/<id>.ts` as a `LayoutSpec` plus `return compileLayout(scene, SPEC);`.
   - Start from the studio spec (or the ASCII). Do not invent a crate maze.
   - Give the map a real `id` / `title` / `blurb` (not `draft`).
   - Site names from the intake card. Keep two sites `loft` (A) and `well` (B).
   - 5 planter + 5 watcher spawns, open to mid
   - ≥3 bot `routes`; at least one starts near each spawn side. You write routes — studio does not.
   - 2F only where they laid a floor and built on it, or the ASCII showed a climb
   - Recipes live in `feelbox/src/maps/layout.ts` (`buildings`, `slabs` + `holes`, `partitions`, `cover`, `climbs` with `kind: "stairs" | "ladder"`, `sites`, `spawns`, `routes`).
   Done when the file has no raw `box()` / `climb()` except what `compileLayout` emits.

4. **Register** — add the id to `MapId` in `kit.ts`, `MAPS` + `buildMap` in `maps/index.ts`, and `rotation` in `feelbox/server.json`.

5. **Check** — `npx tsx scripts/map-check.ts <id>` from `feelbox/`. Every issue must go green. Fix the **spec**, not the compiled mesh.

6. **Playtest once** — one freeze as planter, one as watcher. If a spawn is boxed, a site is unreachable, or mid is a corridor of crates, change 2–3 spec fields and re-check. Then stop. No prop dressing pass.

## Bounds

- Playable area about 60–80m on the long axis. Bigger is not better.
- Cover is a handful of `jumpCrate` / `crate` / `fullCrate` / `low` / `high` / `truck` entries, not a crate maze. Jump crate (0.9m) is the standable CS box; crate (1.1m) is the legacy stamp; full crate (2.2m) hides a standing player.
- Existing hand maps (Wharf, Harbor, Parish, Cut) stay until someone redesigns them through this process. Do not “improve” them by dumping boxes.

## LayoutSpec

See `feelbox/src/maps/layout.ts` (`LayoutSpec`, `YARD_SPEC`) and `feelbox/src/maps/studio.ts` (`blankSpec`). Copy the studio draft or `YARD_SPEC` — do not start from Cove.

- **Stacking** — a building drawn on a deck uses `y` from `surfaceAt` (center + corners). Same footprint on a 1-storey roof increments `floors`.
- **Cut / holes** — `SlabSpec.holes` are world-space rects. The compiler `punchRects` / `subtractRect` leftover-splits the deck (min ~0.12m). A hole that covers the slab deletes it. Cut never stamps a new slab.
- **Wall / partitions** — `partitions[]` are T-thick (0.32) room shells, height `STOREY`, `y` from the surface. Drag: longer axis is length, the other is T.
- **Ladder** — `climbs[].kind: "ladder"` (default stairs). `kit.ladder` is steep walkable rungs (rise ~0.3, run ~0.15). Studio snaps to the nearest building wall. Do not replace existing Siding / multi-floor stair climbs.
