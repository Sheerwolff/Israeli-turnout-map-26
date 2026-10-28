/// <reference types="vitest" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// BASE lets the build be served from a sub-path (e.g. GitHub Pages: BASE=/Israeli-turnout-map-26/).
export default defineConfig({
  base: process.env.BASE ?? "/",
  plugins: [react()],
  test: { include: ["tests/**/*.test.ts"] },
});
