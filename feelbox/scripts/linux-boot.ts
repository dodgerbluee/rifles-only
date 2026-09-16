/**
 * Home screen must boot without WebGL. Linux Brave often fails the first
 * high-performance context and used to take the login + server list with it.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createGameRenderer, GL_CONTEXT_TRIES, type RendererFactory } from "../src/gl.ts";
import { __resetLobbyForTests, requestJoin, setJoinHandler } from "../src/lobby.ts";

let failed = 0;
function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${extra ? `  ${extra}` : ""}`);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");
const css = readFileSync(join(root, "src/style.css"), "utf8");
const boot = readFileSync(join(root, "src/boot.ts"), "utf8");
const main = readFileSync(join(root, "src/main.ts"), "utf8");

check("html boots the lobby module first", html.includes('src="/src/boot.ts"'));
check("html does not wait on main.ts as the only entry", !html.includes('src="/src/main.ts"'));
check("boot catches a failed game module", boot.includes("import(\"./main\")") && boot.includes("showBootError"));
check("logged-out Log in is not gated on body.register", !/body:not\(\.register\)\s+#home-login/.test(css));
check("logged-in Log in is hidden via the hidden attribute", /#home-login\[hidden\]/.test(css));
check("lobby still hides the list in the locker", /body\.locker\s+#server-list/.test(css));
check("WebGL retries without high-performance", GL_CONTEXT_TRIES.some((t) => t.powerPreference === "default"));
check("WebGL retries without antialias", GL_CONTEXT_TRIES.some((t) => !t.antialias));
check("game still starts the lobby before creating the renderer", /startLobby\(\);\s*const gl = createGameRenderer/.test(main));

class FakeRenderer {
  static calls: { powerPreference?: string; antialias?: boolean }[] = [];
  static failUntil = 0;
  constructor(params: { powerPreference?: string; antialias?: boolean }) {
    FakeRenderer.calls.push(params);
    if (FakeRenderer.calls.length <= FakeRenderer.failUntil) {
      throw new Error("Error creating WebGL context.");
    }
  }
}

const Renderer = FakeRenderer as unknown as RendererFactory;

function canvas(id = "view") {
  return { id } as HTMLCanvasElement;
}

{
  FakeRenderer.calls = [];
  FakeRenderer.failUntil = 0;
  let replaced = 0;
  const out = createGameRenderer(canvas(), Renderer, () => {
    replaced += 1;
    return canvas("view-2");
  });
  check("first WebGL try can succeed", out.tryIndex === 0 && replaced === 0);
}

{
  FakeRenderer.calls = [];
  FakeRenderer.failUntil = 1;
  let replaced = 0;
  const out = createGameRenderer(canvas(), Renderer, (old) => {
    replaced += 1;
    return canvas(`${old.id}-next`);
  });
  check("high-performance failure falls back", out.tryIndex === 1);
  check("fallback replaces the poisoned canvas", replaced === 1);
  check("fallback drops high-performance", FakeRenderer.calls[1]?.powerPreference === "default");
}

{
  FakeRenderer.calls = [];
  FakeRenderer.failUntil = 99;
  let threw = false;
  try {
    createGameRenderer(canvas(), Renderer, (old) => canvas(`${old.id}-x`));
  } catch {
    threw = true;
  }
  check("exhausted WebGL tries still throw", threw);
  check("every fallback was attempted", FakeRenderer.calls.length === GL_CONTEXT_TRIES.length);
}

{
  const mem = new Map<string, string>();
  const local = {
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string) => {
      mem.set(k, v);
    },
    removeItem: (k: string) => {
      mem.delete(k);
    },
  };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: local });
  mem.set(
    "rifles-only-account",
    JSON.stringify({
      playerKey: `rk_${"ab".repeat(16)}`,
      username: "reed",
      name: "Reed",
      look: "2144032",
      looks: ["2144032"],
    }),
  );
  __resetLobbyForTests();
  let joined = "";
  requestJoin("Wharf");
  check("join waits until the game module is ready", joined === "");
  setJoinHandler((name) => {
    joined = name;
  });
  check("queued join runs after the renderer boots", joined === "Wharf");
}

{
  const vite = readFileSync(join(root, "vite.config.ts"), "utf8");
  check("production build keeps Three.js off the lobby entry", vite.includes("manualChunks") && vite.includes("node_modules/three"));
  check("production build does not preload Three.js on the home screen", vite.includes("modulePreload") && vite.includes('!dep.includes("three")'));
}

{
  const src = readFileSync(join(root, "src/main.ts"), "utf8");
  check(
    "locker scissor view puts the camera aspect back",
    src.includes("const prevAspect = cam.aspect") && src.includes("cam.aspect = prevAspect"),
  );
  check(
    "leaving the locker restores the window aspect",
    /function restorePlayCamera[\s\S]*?camera\.aspect = innerWidth/.test(src),
  );
  check(
    "in-match locker hides the world instead of wiping it",
    src.includes("if (playWorldMustStay()) hidePlayWorldForLocker()") && src.includes("function teardownLockerWorld"),
  );
  check(
    "round start snaps the play viewmodel and camera",
    src.includes("function resetPlayViewmodel") &&
      /function roundSpawn\([\s\S]*?resetPlayViewmodel\(\)/.test(src) &&
      src.includes("resetPlayViewmodel();"),
  );
  check(
    "first-person play restores the hip near plane",
    /camera\.near = 0\.05;\s*camera\.far = 85;\s*camera\.fov = fov/.test(src),
  );
}

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\nlobby boots before WebGL; Linux Brave gets a fallback context");
