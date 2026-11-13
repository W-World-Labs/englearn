import path from "node:path";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";

export default defineConfig({
  // Only these explicitly public bootstrap settings enter the browser bundle.
  define: {
    "process.env.W_RADAR_SDK_CODE": JSON.stringify(process.env.W_RADAR_SDK_CODE ?? ""),
    "process.env.W_RADAR_BOOTSTRAP_URL": JSON.stringify(process.env.W_RADAR_BOOTSTRAP_URL ?? ""),
    "process.env.W_RADAR_WORKSPACE_ID": JSON.stringify(process.env.W_RADAR_WORKSPACE_ID ?? ""),
    "process.env.W_RADAR_PROJECT_ID": JSON.stringify(process.env.W_RADAR_PROJECT_ID ?? ""),
  },
  server: {
    port: 3000,
    host: "127.0.0.1",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  plugins: [
    tanstackStart({
      srcDirectory: "src",
      router: {
        routesDirectory: "app",
      },
    }),
    viteReact(),
    nitro({ plugins: ["./plugins/radar-telemetry.ts", "./plugins/asset-cache.ts"] }),
  ],
});
