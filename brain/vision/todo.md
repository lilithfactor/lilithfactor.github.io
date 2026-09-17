# TODO

Build-scoped tasks. Ideas live in [vision.md](vision.md); the flow is in
[workflow.md](../work/workflow.md).

**State, 2026-08-15.** Local is several commits ahead of the live site by
design: changes are verified on `localhost:4321` first now, because people may
be reading the deployed page. Live is on `898595e`.

**State, 2026-08-14: the live desk is shipped.** https://lilithfactor.github.io/
is a paper-craft desk with printed outcomes, click-to-open panels, an
adjustable lamp, sound, cursor parallax, and full STAR case-study pages.
Everything below the line is what remains.

## Next session — audit 2026-09-16

- [x] CASE STUDIES note's second line hidden behind the PROJECTS note (knob: note.case-studies.*)
- [x] Blueprint: note text low-contrast because buildLighting blends lights toward p.paper (dark there); light.ambient/light.fill lift it; proper fix is theme-aware light blending
- [x] Blueprint: page heading dark-on-blue over the canvas — document tokens (tokens.css) are not themed; decide whether themes reach the DOM page (masthead/hint/sound now themed directly in stage.css)
- [ ] Blueprint: the sketched head has the same contrast problem and no token to remap (it is a bitmap) — whatever fixes the name has to cover it too: a second sheet, or an SVG filter
- [x] `?sky=…` debug path always passes day:true, so `?sky=clear&hour=22` cannot preview night daylight
- [ ] `.link-row a` min-height kept at 2.75rem because case-studies/[slug].astro still uses a bare .link-row; move it to chip-link there
- [ ] IP → city weather lookup (ipwho.is / geojs) privacy trade still needs Pranav's yes/no (weather.ts header)
- [ ] Window sill contents undefined; WindowRig.sill publishes centre/width
- [ ] PLAY MUSIC is the last 2D control; proposed home: headphones on the desk
- [ ] Per-object scale sliders exist but "realistic relative scale" pass not done
- [ ] Legal pad, pencil, post-its, mug open nothing
- [ ] Theme picker reloads the page; live re-palette would need materials/outline/print to re-read
- [ ] Themes need a visitor-facing entry point decision (URL only today, plus tuner)
- [x] ownOutline: fourth instance of ink left behind; outline.ts should detect subtree matrix changes if it happens again
- [ ] `dump/` (2019 portfolio) still in repo; README says delete after Phase 4
- [x] Lamp ink drifted (5th ownOutline case) — fixed by flag; the guard now warns in dev
- [ ] `.link-row` in case-studies/[slug].astro → chip-link (file has uncommitted user edits; do it when they land)
- [x] Hit regions/clickability: only a note was clickable, not the object it sits on — `pick.ts`'s raycaster now routes a click anywhere on an artifact's mesh to the same `panels.activate()` the handle button calls; lamp is structurally excluded, picking is disabled while a panel is open (dec1ddc)
- [x] Lamp beam position AND direction: `apply()` split into `pose()` (every frame, so tuner drags and `applyTuned` can't slide the lamp out from under its own light — bf2a2ac) and a re-aimed cone read off the shade mesh's own axis instead of a picked-by-eye offset (6ea13c4)
- [x] Note yaw knob: `note.<id>.yaw` in the tuner, stored as an offset added to the per-frame computed yaw since scene.ts squares every note to the view each frame (89adcc3)
- [x] Parallax/gaze knobs: cursor-follow orbit widened (2.1° → 9°/5.5°) with the look-at point now sliding across the desk instead of staying pinned (dce7705); `view.parallax`/`view.gaze`/`view.parallaxSpeed` tuner sliders raised from a ceiling of 1 to 2.5 (c335dd3)
- [x] Bookcase top cleared for RECOMMENDATIONS: the downloaded books row/stack that used to sit there is gone, along with their MODEL_SPECS entries (ca6ac1c)
- [x] Beyond links: Music, Chess and Reading cards in "Beyond the routine" now carry a chip-link to the matching Connect URL (matched by label, not hardcoded) — Films/Series and Speedcubing correctly carry none (a09b08d)

# Idea Dump
- should be able to change weather, this would change the sound and also what can be seen outside the window.

---

## The rule: every object means something

*Set 2026-08-14.* Every 3D object on the desk is clickable and carries
significance. Nothing is set dressing — an object that opens nothing is a
texture pretending to be a control. Models chosen and fetched; see
[models.md](../design/models.md) for the object → section mapping.

- [ ] **Where did `lamp-hifi.glb` and `record-player-hifi.glb` come from?**
  Both are now the desk's two hero models (see [models.md](../design/models.md)),
  and neither has a recorded source, author or licence. CC-BY needs a credit;
  a non-commercial or no-derivatives licence would rule them out entirely.
  Until this is filled into `public/models/ATTRIBUTION.md`, the models must not
  ship. Drop-in replacements are named in `scripts/fetch-models.mjs`.

Content still needed before the two new objects can be wired:

- [ ] **Rubik's cube → speedcubing scores.** What should the panel show — PBs by
  event, an average, a competition history? Cleanest home is a new WareHouse
  database so it syncs like everything else.
- [ ] **Turntable → Spotify.** Which URL: a profile, a specific playlist, or the
  same playlist that already scores the desk? It is also the music control, so
  clicking it should probably do both.
- [ ] **Legal pad, pencil, post-its, mug** — placed but meaningless, which the
  rule forbids. Either give each one a job (a now/next note, a
  currently-reading aside) or leave them off the desk.

## Blocked on Pranav

- [ ] **The head by the name** (`src/components/Mascot.astro`) ships with the
  page-mascot repo's `fox-ink` as stand-in art. Drawing the likeness needs two
  things: credit on the OpenAI account (key added to `.env` 2026-09-16 and
  valid, but the balance is exhausted — the pipeline makes two to six image
  calls), and a clear head-and-shoulders photo at `characters/pranav/photo.jpg`
  (the 2019 `dump/pp.png` is a silhouette). Then, from the repo root:
  ```
  OPENAI_API_KEY=… python3 ~/.claude/skills/page-mascot/scripts/mascot.py pranav \
    --style ink --reference characters/pranav/photo.jpg \
    --describe "hair, glasses, facial hair, top colour — only what the photo shows" \
    --dest public/mascots
  ```
  It draws, keys, builds and verifies both sheets, and writes
  `public/mascots/pranav-{directions,reactions}.webp`; swap the two paths in
  `index.astro`, delete the fox files, and crop the `left` cell to confirm it
  faces the viewer's left (a mirrored sheet passes every check). The source
  PNGs land in `characters/pranav/` — keep or delete, not a build input.
  The build saves 1080px sheets at WebP q92 (~290 KB each); the head is at most
  96px on screen, so re-encode both to 720px q80 (~110 KB each, alpha is
  lossless either way) before committing — the fox sheets were.
- [ ] **ZenMux key** — saved correctly (`sk-mg-…`, 73 chars) but the API
  rejects every inference call with the same 403 a fake key gets. Most likely
  unfunded; possibly video not enabled. Until a call succeeds, oil-motion
  cannot generate a frame, which blocks the **walking figure** (and it also
  needs a reference image of you — `video_job.py` is image→video).
- [ ] **Recommendation photos + LinkedIn URLs** in the WareHouse database —
  the highest-leverage content addition available.
- [ ] **Custom domain decision** (`pranavupadhyay.com` vs staying on
  `lilithfactor.github.io`).
- [ ] **Notion webhook** for instant publish (cron is the 30-min guarantee):
  a Notion automation POSTing `repository_dispatch` needs a GitHub PAT.
- [ ] Write STAR bodies for the two sparse case studies (Configurator,
  Brand-led agent) — the other three now render in full.
- [ ] **Connect's icon set.** `lucide-react` has no brand logos, so six of the
  seven Connect marks (everything but a generic mail/link glyph) cannot come
  from it. Decide: `simple-icons` (already a devDependency) for the brand
  marks + lucide for anything generic, or drop icons entirely and go
  text-only.
- [ ] **Where the plant's like count lives.** A small, cheap, always-on
  counter — Cloudflare Worker + KV, or a Supabase table — needs picking before
  it's wired to anything on the desk.
- [ ] **The weather IP → third-party trade**, restated: `weather.ts` sends a
  visitor's IP to ipwho.is/geojs and then Open-Meteo on every load. Reversible
  in one line (`locate()`) but still needs a yes/no.
- [ ] **`recommendations` and `connect` sit off the left edge at rest** in
  `tuned.json` (`artifact.recommendations.x -1.35`, `artifact.connect.x
  -0.99`) — both need to be re-centred onto the visible desk, not just
  reachable via parallax.

## Next build

- [ ] **Confirm the weather trade.** The window now asks ipwho.is (then
  get.geojs.io) what city the visitor's IP is in, and Open-Meteo what the sky
  is doing there. That is the project's only runtime fetch and it sends a
  visitor's IP to a third party — a deliberate, reversible choice. Falling back
  to the desk's own city needs one line: see `locate()` in `weather.ts`.
- [ ] Place the chess set. Five matched pieces are fetched and credited but
  nothing puts them on the board; the printed diagram is still doing the job.
  Mark them `noOutline` or they collapse into black blobs at that size.
- [ ] The bookcase reads as a ladder. Kenney has a low open bookcase and a
  closed one; either may sit better than the current one.
- [ ] **Wire the models into the scene.** 19 models sit in `public/models/`
  fetched, salvaged and verified — and *nothing renders them yet*. The desk is
  still entirely procedural. Needs: a loader that strips incoming materials and
  applies the paper Lambert + cut colours, bounding-box normalisation (authored
  scale is meaningless across sources — surveyed models ranged 0.005 to 48 units
  for similar real-world objects), placement against `PLACEMENTS`, and
  re-pointing `lamp.ts` at the new `head` node.
- [ ] Desk explorables: drag-to-turn cube face, chess board with a real
  position *(cut from the finished-desk push — the two stalled agents never
  reached them)*.
- [ ] Turntable object on the desk wired to the same audio as the corner
  control (the control works everywhere; the 3D object is not yet clickable).
- [ ] OG images per page, generated at build.
- [ ] Cookieless analytics + the two tracking questions in vision.md.
- [ ] Real-device pass: one mid-tier Android + one iPhone, cellular.
- [ ] Lighthouse CI gate in deploy.yml.

## Done (this arc)

- [x] Phases 0–4 as originally scoped — see git history from `b79e3bd`.
- [x] Live desk pivot: paper-craft scene, panels, handles, no raycaster.
- [x] STAR bodies synced recursively + images downloaded; outcome-first pages.
- [x] Printed outcomes on the desk sheets; adjustable lamp driving real light;
  night desk; cursor parallax; paper fibre/deckle skin.
- [x] Soundscape (opt-in, one switch) + mobile chip + warm corner.
- [x] Ops: read-only Notion token, timestamp-only sync commits killed,
  workflows pinned, brain docs corrected (STAR, ids, schema types).
- [x] Desk leaking onto case-study pages fixed (StageMount was in the shared
  layout; now homepage-only — article pages ship zero JS). See learning.md.
