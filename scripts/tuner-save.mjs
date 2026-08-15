import { writeFileSync } from "node:fs";

/**
 * THE TUNER'S SAVE BUTTON, and the only server-side code in this project.
 *
 * The loop it kills: drag a slider, read the number off the panel, tell Claude,
 * wait for an edit, reload, find it is a bit too much, repeat. Now the panel
 * POSTs its values here and they land in src/stages/desk/tuned.json, which the
 * scene replays at mount — so a number moved with a slider is a number that
 * survives a reload, a restart and a build, with nobody transcribing anything.
 *
 * `apply: "serve"` is doing real work: this exists in `npm run dev` and does
 * not exist in the build, which is what keeps the site a folder of static files
 * with no endpoints. In a built site the Save button gets a network error and
 * says so rather than pretending.
 *
 * No auth and no path handling because it binds to localhost, writes one fixed
 * filename and takes no filename from the request.
 */
const tunerSave = {
  name: "desk-tuner-save",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use("/__tune", (request, response, next) => {
      if (request.method !== "POST") return next();
      let body = "";
      request.on("data", (chunk) => {
        body += chunk;
        // A tuning file is a few kilobytes. Anything larger is not this.
        if (body.length > 1e6) request.destroy();
      });
      request.on("end", () => {
        try {
          // Parsed before it is written, so a malformed body cannot leave a
          // broken import behind that stops the whole scene from building.
          const values = JSON.parse(body);
          writeFileSync(
            new URL("./src/stages/desk/tuned.json", import.meta.url),
            `${JSON.stringify(values, null, 2)}\n`,
          );
          response.statusCode = 200;
          response.end("saved");
        } catch (error) {
          response.statusCode = 400;
          response.end(String(error));
        }
      });
    });
  },
};

// The repo is `lilithfactor.github.io`, so Pages serves from the domain root.
// No `base` — adding one is the classic GitHub Pages trap that breaks every
// absolute asset path. If a custom domain is bought, only `site` changes.

export default tunerSave;
