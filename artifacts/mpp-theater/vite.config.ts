import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const rawPort = process.env.PORT || "5173";
const port = Number(rawPort);
const projectRoot = path.resolve(import.meta.dirname);
const sdkRoot = path.resolve(import.meta.dirname, "..", "..", "..", "sdk");
const attachedAssetsRoot = path.resolve(import.meta.dirname, "..", "..", "attached_assets");

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "src"),
      "@assets": attachedAssetsRoot,
      "lightning-mpp-extension-sdk": path.resolve(sdkRoot, "src", "index.ts"),
    },
  },
  build: {
    outDir: path.resolve(projectRoot, "dist"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: process.env.API_BASE_URL || "http://localhost:5000",
        changeOrigin: true,
      },
    },
    fs: {
      strict: true,
      allow: [projectRoot, sdkRoot, attachedAssetsRoot],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
