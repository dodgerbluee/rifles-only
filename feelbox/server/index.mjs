/**
 * Back-compat: production image uses start.mjs. Bare `node server/index.mjs`
 * is the lobby (static + proxy). `--dev` still boots the full local stack.
 */
if (process.argv.includes("--dev")) {
  await import("./dev.mjs");
} else if ((process.env.ROLE ?? "").toLowerCase() === "game") {
  await import("./start.mjs");
} else {
  await import("./lobby.mjs");
}
