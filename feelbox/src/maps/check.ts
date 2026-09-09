import * as THREE from "three";
import { collideXZ, type World } from "../world";

const R = 0.32;

export type MapIssue = { ok: boolean; name: string; detail?: string };

function walk(world: World, x: number, z: number, dx: number, dz: number, steps: number) {
  let px = x;
  let pz = z;
  const len = Math.hypot(dx, dz) || 1;
  const sx = (dx / len) * 0.35;
  const sz = (dz / len) * 0.35;
  for (let i = 0; i < steps; i++) {
    const n = collideXZ(world.colliders, px + sx, pz + sz, R, 0.08, 1.7);
    if (Math.hypot(n.x - px, n.z - pz) < 0.04) break;
    px = n.x;
    pz = n.z;
  }
  return { x: px, z: pz };
}

function near(points: THREE.Vector3[], x: number, z: number, r: number) {
  return points.some((p) => Math.hypot(p.x - x, p.z - z) <= r);
}

export function checkWorld(world: World): MapIssue[] {
  const issues: MapIssue[] = [];
  const push = (ok: boolean, name: string, detail?: string) => issues.push({ ok, name, detail });

  push(!!world.sites.find((s) => s.id === "loft") && !!world.sites.find((s) => s.id === "well"), "two sites (loft + well)");
  push(world.plantSpawns.length >= 5, "five planter spawns", `n=${world.plantSpawns.length}`);
  push(world.watchSpawns.length >= 5, "five watcher spawns", `n=${world.watchSpawns.length}`);
  push(world.waypoints.length >= 3, "at least three bot routes", `n=${world.waypoints.length}`);

  const boxed = (label: string, spawns: THREE.Vector3[], toward: THREE.Vector3[]) => {
    const tx = toward.reduce((s, p) => s + p.x, 0) / Math.max(1, toward.length);
    const tz = toward.reduce((s, p) => s + p.z, 0) / Math.max(1, toward.length);
    for (const [i, s] of spawns.entries()) {
      const stuck = collideXZ(world.colliders, s.x, s.z, R, 0.08, 1.7);
      push(
        Math.hypot(stuck.x - s.x, stuck.z - s.z) < 0.2,
        `${label} spawn ${i} is not inside a wall`,
        `d=${Math.hypot(stuck.x - s.x, stuck.z - s.z).toFixed(2)}`,
      );
      const out = walk(world, s.x, s.z, tx - s.x, tz - s.z, 48);
      push(
        Math.hypot(out.x - s.x, out.z - s.z) > 6,
        `${label} spawn ${i} walks out`,
        `moved=${Math.hypot(out.x - s.x, out.z - s.z).toFixed(1)}`,
      );
    }
  };
  boxed("plant", world.plantSpawns, world.watchSpawns);
  boxed("watch", world.watchSpawns, world.plantSpawns);

  const starts = world.waypoints.map((r) => r[0]).filter((p): p is THREE.Vector3 => !!p);
  push(starts.some((p) => near(world.plantSpawns, p.x, p.z, 10)), "a route starts near planter spawn");
  push(starts.some((p) => near(world.watchSpawns, p.x, p.z, 10)), "a route starts near watcher spawn");

  return issues;
}
