import { writeFileSync } from "node:fs";
import { join } from "node:path";

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
 *
 * THE TARGET IS RESOLVED FROM VITE'S ROOT, not from import.meta.url. It was
 * import.meta.url, which was correct exactly as long as this code lived in
 * astro.config.mjs — moving the file to scripts/ silently moved the write with
 * it, to scripts/src/stages/desk/tuned.json, and the Save button started
 * reporting "no dev server" because a 400 and an unreachable server look
 * identical from a fetch(). A path relative to the file is a path that breaks
 * when the file moves; server.config.root cannot.
 */
const tunerSave = {
  name: "desk-tuner-save",
  apply: "serve",
  configureServer(server) {
    const target = join(server.config.root, "src/stages/desk/tuned.json");
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
          writeFileSync(target, `${JSON.stringify(values, null, 2)}\n`);
          response.statusCode = 200;
          response.end("saved");
        } catch (error) {
          // Logged as well as returned: the browser only ever sees "not ok",
          // and the reason it is not ok belongs where someone will read it.
          server.config.logger.error(`[tuner] save failed: ${error}`);
          response.statusCode = 400;
          response.end(String(error));
        }
      });
    });
  },
};

export default tunerSave;
