import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The Group B API runs on http://127.0.0.1:3000 (see ../.env → PORT). Proxying
// /api lets the client call same-origin relative URLs in dev, so no CORS setup
// is needed while developing.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@ds": fileURLToPath(new URL("../design-system", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:3000",
    },
  },
});
