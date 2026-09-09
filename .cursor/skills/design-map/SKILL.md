---
name: design-map
description: Design and implement Rifles Only maps through a compact LayoutSpec and compiler. Use when the user wants a new map, a map redesign, layout, bombsite, spawn, rotation map, or says maps are bad / look like box piles.
---

# Design a map

Hand-placed `box()` piles are the failure mode. The human sketches; you write a **LayoutSpec**; `compileLayout` builds it; `map-check` gates it.

## Steps

1. **Intake** — get four facts before any geometry. Done when you can fill this card:
   - Planting side enters from where (compass + one landmark)
   - A and B are what (one-word names)
   - One mid fight
   - Mood in one clause (winter dock, limestone pit, …) plus at most one real reference
   If the ask is “make a cool map”, ask for the card. Do not invent a 200-prop theme.

2. **ASCII** — one 12–16 column grid, then stop for approval if the human is in the loop.
   - `E` planter spawn  `S` watcher spawn  `A`/`B` sites  `#` building  `=` cover  `.` open
   - Two flanks plus mid. Spawns in the open, not in a U of walls.
   Done when A/B are split, E and S are opposite, and you can walk E→A, E→B, S→A, S→B on the grid.

3. **Spec** — translate the grid into one `LayoutSpec` in `feelbox/src/maps/<id>.ts`. The map file is the spec plus `return compileLayout(scene, SPEC);`. Recipes live in `feelbox/src/maps/layout.ts` (`buildings`, `cover`, `sites`, `spawns`, `routes`).
   - 5 planter + 5 watcher spawns, open to mid
   - sites `loft` (A) and `well` (B)
   - ≥3 bot routes; at least one starts near each spawn side
   - 2F only where the ASCII showed a climb
   Done when the file has no raw `box()` / `climb()` except what `compileLayout` emits.

4. **Register** — add the id to `MapId` in `kit.ts`, `MAPS` + `buildMap` in `maps/index.ts`, and `rotation` in `feelbox/server.json`.

5. **Check** — `npx tsx scripts/map-check.ts <id>` from `feelbox/`. Every issue must go green. Fix the **spec**, not the compiled mesh.

6. **Playtest once** — one freeze as planter, one as watcher. If a spawn is boxed, a site is unreachable, or mid is a corridor of crates, change 2–3 spec fields and re-check. Then stop. No prop dressing pass.

## Bounds

- Playable area about 60–80m on the long axis. Bigger is not better.
- Cover is a handful of `crate` / `low` / `high` / `truck` entries, not a crate maze.
- Existing hand maps (Wharf, Harbor, Parish, Cut) stay until someone redesigns them through this process. Do not “improve” them by dumping boxes.

## LayoutSpec

See `feelbox/src/maps/layout.ts` (`LayoutSpec`, `YARD_SPEC`). Copy `YARD_SPEC` and rename — do not start from Cove.
