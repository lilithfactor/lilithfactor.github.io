# TODO

Build-scoped tasks. Ideas live in [vision.md](vision.md); the flow is in
[workflow.md](../work/workflow.md).

> *Rebuilt 2026-08-12.* Previously the Muretabi app's todo list — EAS builds,
> LiveKit quotas, Play Console. None of it applied. Replaced wholesale.

**Current phase: 0 → 1.** Nothing has been built yet. The repo contains the old
2019 site in `dump/` and these docs.

---

## Needs your decision

- [ ] **Custom domain or not.** `lilithfactor.github.io` works today and costs
  nothing. `pranavupadhyay.com` (~₹1000/yr) is the cheapest credibility upgrade
  available and it is what goes on a CV. **Recommend buying it now** — it only
  gets more annoying to change after the link is shared. Blocks nothing; needed
  before Phase 4.

- [x] ~~Notion integration token created~~ *(2026-08-12)* — connection
  `lilithfactor.git…`, access-token auth. `NOTION_TOKEN` is in `.env` (gitignored)
  and in Actions secrets. Verified: the token authenticates.
- [x] ~~Share the page with the integration~~ *(2026-08-12)* — **all seven objects
  reachable**, verified with `node --env-file=.env scripts/check-notion-access.mjs`.
  The databases are authored in **Portfolio WareHouse**
  (`2f2be508-b291-8043-b9a1-e17593459950`) and surfaced on the portfolio page via
  synced blocks; sharing reaches both. *(The 404 that looked like a permissions
  failure was the wrong id space — see [learning.md](../work/learning.md).)*
- [x] ~~Reduce the integration's capabilities to read-only~~ *(2026-08-13)* —
  trimmed by Pranav; verified the read-only token still reaches all seven objects.

- [ ] **⏳ PENDING PRANAV — where does the music come from?** Must be owned or
  licensed for public web use (CC0 / CC-BY with attribution rendered). Recommend
  **3 instrumental ambient loops, 60–90s, ~1MB each at 64kbps Opus** —
  instrumental because lyrics compete with reading. Options: your own · Free
  Music Archive / Uppbeat · AI-generated. Blocks the record player, nothing else.

- [ ] **The About paragraph is broken in production right now.** It ends
  `"…and trusted by brands like"` and stops mid-clause, on the first thing anyone
  reads. Either name the brands or cut the clause — it is a two-minute Notion
  edit and it is currently the worst thing on the live site.

---

## Phase 0 — Foundation

- [ ] Delete the tracked root files from the 2019 site; keep `dump/` untracked
      until launch, then remove. *(Part of the first commit.)*
- [x] Scaffold *(2026-08-13)* — **Astro 7** + TS strict, Three.js pinned exact,
      `.nvmrc` = 24.15.0, Prettier, no ESLint. Builds clean in ~150ms.
- [x] Fonts *(2026-08-13)* — subset, self-hosted, 8 woff2 files, **135KB latin
      initial load.** Fraunces keeps `opsz` (the reason to pick it); Source
      Serif 4 drops it (70KB for a difference invisible at 17px). Measured, in
      [fonts.css](../../src/styles/fonts.css) comments.
- [x] `src/styles/tokens.css` *(2026-08-13)* — hand-written from
      [design-system.md](../design/design-system.md), including the
      reduced-motion block.
- [x] Paper primitive *(2026-08-13)* — sheet + grain + contact shadow + dog-ear
      + askew (card-width only) in [paper.css](../../src/styles/paper.css).
      **Verified:** zero horizontal overflow at 320/390/768/1100 (element-level
      probe), desktop screenshot reviewed. Two real bugs found and fixed: a 44px
      display floor + `&nbsp;` name overflowed true-390px, and `clip-path`
      swallowed its own dog-ear `::after`.
- [x] `.github/workflows/deploy.yml` *(2026-08-13)* — build → `deploy-pages`,
      concurrency-guarded.
- [ ] **First commit + push + enable Pages (source = GitHub Actions).**
      ⚠ Outward-facing: this replaces whatever the domain currently serves with
      the Phase 0 specimen. Waiting on Pranav's go.

**Exit:** a warm paper page live at `lilithfactor.github.io`.

## Phase 1 — Content pipeline

- [ ] `src/content.config.ts` — Astro collections + **Zod schemas** over
      `content/*.json`, from [content-model.md](../content/content-model.md).
      A malformed sync must **fail the build**, never publish a broken section.
- [ ] `src/content/index.ts` — the proxy. **Nothing outside this folder may
      mention Notion.**
- [ ] `scripts/sync-notion.mjs`:
  - [ ] Query all six databases via the official API.
  - [ ] Filter `Visibility === "Highlight"` on the four that have it.
  - [ ] Normalise Notion shapes → the contract (multi-selects to `string[]`,
        rich text to plain strings, comma-split the `Link`/`Links` text fields).
  - [ ] Derive `id`, `slug`, `order`.
  - [ ] **Download every Notion asset into `public/`** — their signed URLs expire
        in about an hour, so hot-linking means every image breaks by lunchtime.
  - [ ] Write `content/*.json` + `meta.json` with counts and warnings.
  - [ ] Fail loudly on a missing required field. A silent partial sync that
        publishes an empty portfolio is the worst possible failure here.
- [ ] `.github/workflows/sync-content.yml` — cron `*/30`, `workflow_dispatch`
      (so it can be run from the GitHub mobile app), and `repository_dispatch`.
- [ ] Notion database automation → webhook → `repository_dispatch`, for instant
      publish. *(Cron is the guarantee; the webhook is the speed.)*
- [ ] Render all eight sections on the stack layout from the JSON.
- [ ] Astro prerenders every page — verify the site reads with **JS disabled**.
- [ ] Real routes: `/case-studies/<slug>/` etc. as prerendered HTML files, not
      hash routes. Indexable, previewable, forwardable.
- [ ] `links.json` — add the Email link by hand (the Notion button uses an email
      action and exposes no URL).

**Exit:** the site fully replaces the Notion page; an edit in Notion is live in
under two minutes.

## Phase 2 — The desk

- [ ] `src/stage/choose.ts` — capability detection, not user-agent sniffing.
- [ ] Three.js scene behind a dynamic `import()`. **Verify on a phone that the
      chunk is never fetched** — this is the whole justification for choosing a
      full 3D desk, so it gets checked, not assumed.
- [ ] Desk, lamp (warm key), window (cool fill), contact shadows.
- [ ] The eight artifacts, modelled and placed — deliberately imperfect: 2–4°
      rotations, a cup ring, one uncapped pen.
- [ ] Camera framings: overview + one per artifact, `--m-camera` easing.
- [ ] **The anchor system** — project a 3D `Vector3` to screen space each frame,
      write `--x/--y/--scale` to the matching DOM node. This is the mechanism
      that keeps content as real text; get it right early.
- [ ] Raycast targets padded to ≥44px.
- [ ] Auto-degrade ladder: shadow maps → DPR 1.5 → DPR 1.0, stepped once, never
      oscillating.
- [ ] Draco-compress the geometry.

### The record player
Spans both stages, so it is built once and mounted twice. Rules in
[ux-rules.md](../design/ux-rules.md#13-audio-is-opt-in-always) — they outrank the
art direction.

- [ ] `Playlist` database in Notion + sync support (downloads the audio files,
      transcodes to Opus + AAC).
- [ ] Turntable + three paper sleeves on the desk; compact player card on stack.
- [ ] **Silent on load, and visibly so** — tonearm parked, record still.
- [ ] **No audio fetched until the visitor presses play.** Check the Network tab,
      don't assume.
- [ ] Click a sleeve → arm lifts, record swaps, arm drops.
- [ ] Record spins only while playing — the one permitted infinite animation,
      because it is a state indicator rather than decoration.
- [ ] Pause on `visibilitychange`; resume only on return, only if it was playing.
- [ ] Persistent, keyboard-operable mute on **both** stages. Never 3D-only.
- [ ] Start at ~30% volume. Remember the choice in `localStorage`.
- [ ] Render attribution for any CC-licensed track.
- [ ] `<audio loop>` first. If the loop seam is audible, move to a Web Audio
      `AudioBufferSourceNode` (genuinely gapless) — decoding only the active
      track, since a decoded 2-minute track is ~20MB of RAM.

**Exit:** desktop gets the desk; mobile downloads none of it; the site is silent
until asked.

## Phase 3 — The figure

- [ ] Character design pass — ink sketch of Pranav, single-weight ballpoint line.
- [ ] **Lock key frames first** (contact / passing / contact) and approve
      proportions before generating any video. Skipping this is how the figure
      quietly changes shape mid-stride.
- [ ] Generate the seven clips; review every frame for extra limbs, flicker,
      duplicates, and alpha eating the thin ink line.
- [ ] Compress to real display size (~256px tall, 512px frames at 2×).
      Budget ≤1.5MB desktop, ≤400KB mobile (`idle` + `point` only).
- [ ] Billboard plane in the desk scene with a contact-shadow blob.
- [ ] Distance-driven walk — one frame per fixed distance, mirrored sheet for the
      opposite direction.
- [ ] Path: straight line, one waypoint around obstacles. **No pathfinding
      library.**
- [ ] Interruptible mid-walk; redirect from current position, never restart or
      teleport.
- [ ] `open` syncs to the artifact opening on the hand-contact frame.
- [ ] Idle hint after 15s → `point` at the nearest unopened artifact.

**Exit:** clicking an artifact sends him walking; a second click skips him.

## Phase 4 — Polish & launch

- [ ] Case-study bodies in Notion using the four H2s: Problem · Insight ·
      What I shipped · Outcome.
- [ ] Body fetch in the sync (a `blocks.children.list` per row — ~56 extra calls,
      fine on a 30-minute cron).
- [ ] Recommendation photos + LinkedIn links.
- [ ] OG images per section, generated at build.
- [ ] Analytics, cookieless.
- [ ] Full a11y pass — keyboard, reduced motion, JS-off, screen reader.
- [ ] Perf pass against the [budget](../eng/architecture.md#performance-budget).
- [ ] Real-device check: one mid-tier Android, one iPhone, on cellular.
- [ ] Custom domain + redirect the Notion page here.

---

## Debt

Recorded deliberately, so "later" doesn't become "never".

- **Icons.** Sixteen hand-drawn ink marks are the design intent. Lucide at
  `stroke-width: 1.5` is the accepted stopgap — a geometric set beside a
  hand-drawn figure looks like two projects merged. Revisit in Phase 4.
- **`Link`/`Links` are rich-text fields** holding comma-separated URLs. The sync
  splits and validates them. It works and it is the one loose spot in the schema;
  proper URL properties or a relation would be cleaner if it ever misbehaves.
- **Row bodies are a second API call per row.** Acceptable at 56 rows. If the
  content grows past ~200 rows, the sync needs incremental fetching by
  `last_edited_time`.

---

## Done

*(nothing yet — the build starts at Phase 0)*

- [x] **Research + context rebuild** *(2026-08-12)* — live Notion page reverse-engineered
      via its public API (6 databases, 56 rows, 6 social links, the About copy),
      `brain/` rebuilt from the Muretabi copy into this project's docs, design
      system and art direction defined, architecture and content contract written.
