import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The Group B API runs on http://127.0.0.1:3000 (see ../server/.env → PORT). Proxying
// /api lets the client call same-origin relative URLs in dev, so no CORS setup
// is needed while developing.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@scoring": fileURLToPath(new URL("../server/src/validation/scoring.mts", import.meta.url)),
      "@evaluation-demo": fileURLToPath(new URL("../server/src/demo/evaluation-data.mts", import.meta.url)),
      "@resume-policy": fileURLToPath(new URL("../server/src/validation/resume-file.mts", import.meta.url)),
      "@validation": fileURLToPath(new URL("../server/src/validation/field-rules.mts", import.meta.url)),
      "@ds": fileURLToPath(new URL("./src/design-system", import.meta.url)),
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
