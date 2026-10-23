import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Builds for the site root (Vercel). The GitHub Pages workflow passes --base=/hospital_map/.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The app chunk embeds ~730 hospitals/clinics and 23 polygons; MapLibre is its own ~1 MB chunk.
  build: { chunkSizeWarningLimit: 1200 },
});
