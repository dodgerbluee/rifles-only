import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      "/ws": {
        target: "ws://127.0.0.1:8081",
        ws: true,
      },
      "/play/ws": {
        target: "ws://127.0.0.1:8081",
        ws: true,
        rewrite: () => "/ws",
      },
      "/api": {
        target: "http://127.0.0.1:8080",
      },
    },
  },
  preview: {
    host: true,
  },
});
