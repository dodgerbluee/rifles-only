/**
 * Dev: dedicated game on 8081, lobby API on 8080, Vite on 5173.
 * The browser never hosts.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, args, env) {
  const child = spawn(cmd, args, {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  child.on("exit", (code) => {
    if (code) process.exit(code ?? 1);
  });
  return child;
}

const kids = [
  run("npx", ["tsx", "server/game.ts"], {
    PORT: "8081",
    HOST: "0.0.0.0",
    LOBBY_URL: "http://127.0.0.1:8080",
    GAME_NAME: "Last Wire",
  }),
  run("node", ["server/lobby.mjs"], {
    PORT: "8080",
    HOST: "0.0.0.0",
    GAME_STATIC: "",
    GAME_WS: "ws://127.0.0.1:8081/ws",
  }),
  run("npx", ["vite", "--open"], {}),
];

function stop() {
  for (const k of kids) {
    try {
      k.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  }
}

process.on("SIGINT", () => {
  stop();
  process.exit(0);
});
process.on("SIGTERM", () => {
  stop();
  process.exit(0);
});
