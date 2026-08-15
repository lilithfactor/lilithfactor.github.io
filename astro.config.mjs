// @ts-check
import { defineConfig } from "astro/config";
import tunerSave from "./scripts/tuner-save.mjs";

export default defineConfig({
  site: "https://lilithfactor.github.io",

  // Everything prerenders. There is no server. See eng/architecture.md.
  output: "static",

  build: {
    // One stylesheet rather than per-page <style> tags — the paper system is
    // shared by every page, so inlining it per route would ship it many times.
    inlineStylesheets: "auto",
  },

  // Astro's own image handling for the assets the Notion sync downloads.
  image: {
    responsiveStyles: true,
  },

  devToolbar: {
    enabled: false,
  },

  vite: {
    plugins: [tunerSave],
  },
});
