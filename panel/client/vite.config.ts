import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { execSync } from "child_process";

// Stamped into the JS bundle; rendered in the sidebar footer so a stale
// deployment (old server process, cached page) is instantly recognizable.
let buildId = "";
try {
  buildId = execSync("git rev-parse --short HEAD").toString().trim();
} catch {
  /* not a git checkout */
}
if (!buildId) buildId = new Date().toISOString().slice(11, 19).replace(":", "");

export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
