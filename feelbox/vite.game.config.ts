import { defineConfig } from "vite";

export default defineConfig({
  build: {
    ssr: "server/game.ts",
    outDir: "dist-game",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      external: ["ws"],
      output: {
        format: "es",
        entryFileNames: "game.js",
      },
    },
  },
  ssr: {
    noExternal: ["three"],
  },
});
