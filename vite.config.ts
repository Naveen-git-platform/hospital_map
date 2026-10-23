import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  // GitHub Pages serves the site from /<repo>/.
  base: command === "build" ? "/hyderabad-healthcare/" : "/",
  plugins: [react(), tailwindcss()],
  // The app chunk embeds ~730 hospitals/clinics and 23 polygons; MapLibre is its own ~1 MB chunk.
  build: { chunkSizeWarningLimit: 1200 },
}));
