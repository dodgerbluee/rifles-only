/**
 * Image entry: ROLE=game runs the dedicated match, anything else is the lobby.
 */
const role = (process.env.ROLE ?? "lobby").toLowerCase();

if (role === "game") {
  await import("../dist-game/game.js");
} else {
  await import("./lobby.mjs");
}
