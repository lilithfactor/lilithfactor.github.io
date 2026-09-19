// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tunerSave from "./scripts/tuner-save.mjs";

export default defineConfig({
  site: "https://lilithfactor.github.io",

  // Everything prerenders. There is no server. See eng/architecture.md.
  output: "static",

  // The 404 is the only prerendered page that must not be listed: GitHub Pages
  // serves /404.html with a 200, so a crawler that finds it in the sitemap
  // indexes a soft 404. (Base.astro also sends it `noindex`.) Non-HTML routes
  // like /meta.json are not pages and are excluded by the integration itself.
  integrations: [sitemap({ filter: (page) => !page.endsWith("/404/") })],

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
