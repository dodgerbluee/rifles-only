/** Tactical assignments should keep one bot on the Wire and spread the rest. */
import * as THREE from "three";
import { createBots, updateBots } from "../src/bots.ts";
import { createMatch } from "../src/match.ts";
import { buildMap } from "../src/maps/index.ts";

let failed = 0;
function check(name: string, ok: boolean) {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}`);
}

const scene = new THREE.Scene();
const world = buildMap(scene, "wharf");
const match = createMatch({ claimLocal: false, freezeTime: 0 });
match.phase = "live";
const bots = createBots(scene, world, match);
const tick = () => updateBots(bots, 1 / 60, 1, world.colliders, world, match, [], false, () => {}, () => false);
const sitePoint = (id: "loft" | "well") => {
  const site = world.sites.find((s) => s.id === id)!;
  return new THREE.Vector3(site.x, site.y, site.z);
};

tick();
const carrier = bots.find((b) => b.id === match.wire.carrierId);
check("one bot is assigned to plant", bots.filter((b) => b.role === "plant").length === 1);
check("the Wire carrier is the planter", carrier?.role === "plant");
check("planter has escorts", bots.filter((b) => b.role === "escort").length > 0);
const escorts = bots.filter((b) => b.role === "escort");
check("escorts route to their assigned support anchors", escorts.every((b) => b.routeGoal.distanceTo(b.anchor) < 0.01));
for (const team of ["ember", "stone"] as const) {
  const teamBots = bots.filter((b) => b.team === team);
  check(`${team} remains split between Ice and Slip`, new Set(teamBots.map((b) => b.site)).size === 2);
  check(`${team} routes to both sites`, new Set(teamBots.map((b) => b.routeGoal.distanceTo(sitePoint("loft")) < b.routeGoal.distanceTo(sitePoint("well")) ? "loft" : "well")).size === 2);
}

const site = world.sites.find((s) => s.id === carrier?.site)!;
match.wire.mode = "planted";
match.wire.carrierId = null;
match.wire.site = site.id;
match.wire.x = site.x;
match.wire.y = site.y;
match.wire.z = site.z;
tick();

check("one watcher is assigned to cut", bots.filter((b) => b.role === "cut").length === 1);
const holders = bots.filter((b) => b.role === "hold");
const anchors = new Set(holders.map((b) => `${b.anchor.x.toFixed(2)},${b.anchor.z.toFixed(2)}`));
check("holders use distinct support anchors", anchors.size > 1);
check("holders route to their assigned support anchors", holders.every((b) => b.routeGoal.distanceTo(b.anchor) < 0.01));

if (failed) process.exit(1);
console.log("bot tactics assignments are coordinated");
