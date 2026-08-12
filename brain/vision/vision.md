# Vision — the portfolio

> *Rebuilt 2026-08-12.* This file previously held the Muretabi product vision,
> copied wholesale from another repo. None of it applied here. It has been
> replaced, not edited.

Ideas land in the [Inbox](#inbox). Triaged ideas get filed in the
[Idea catalog](#idea-catalog). The ones being built now are scoped in
[todo.md](todo.md).

## What this is

A personal portfolio for **Pranav Upadhyay, Product Manager**, at
`lilithfactor.github.io` — a desk made of paper that a visitor explores, with an
ink-drawn figure walking them through it. **Notion stays the CMS**, so updating
it is still one tap on a phone.

## Who it is for

In priority order, because they want different things and the design must not
pretend otherwise:

1. **A hiring manager or founder evaluating Pranav.** Forty seconds, often on a
   phone, often from a LinkedIn link. Needs: what has he shipped, what moved,
   can he write. **This visitor's needs are never traded away for the others'.**
2. **A recruiter or referrer.** Needs to skim, then send one deep link to a
   colleague. This is why every section is its own URL.
3. **A peer PM or collaborator.** Curious, will actually read a teardown, may
   come back. This is who the Library, the Product Dives, and the desk's details
   are for.
4. **Pranav.** Has to be able to update it in thirty seconds from a phone or it
   will rot — which is exactly what happened to the last one.

## The job to be done

> *"Show me you can take something messy and make it obvious — and prove it with
> something you actually shipped."*

The site is not a document *about* that claim. The site **is** the claim. A dense,
personal, perfectly navigable desk is a live demonstration of the skill being
sold. If the portfolio is confusing, no case study inside it will be believed.

## What it must prove

| Claim | The evidence on the page |
|---|---|
| Ships real things at real scale | 5 case studies, 1M+ buyers, 2–3× benchmark conversion, named brands |
| Owns outcomes, not features | Every case study titled by its result; the four-H2 structure |
| Thinks in products unprompted | 7 Product Dives — teardowns nobody asked for |
| Builds, not just briefs | 5 shipped side projects, live links and repos |
| Trusted by the people he worked with | 2 recommendations, from an EM and a founder |
| Sustained curiosity | 37 books with dates and status — a habit, not a list |
| Is a person | Beyond the Routine: cubing, chess, music, film |
| Has taste and judgment | The site itself |

## Principles

1. **The site is live and useful from Phase 1.** Content ships before the desk.
   There is never a period where the portfolio is worse than the Notion page it
   replaces. Every phase after is added *over* a working site.
2. **Updating must stay a one-tap job.** Any change that makes Pranav open a
   laptop to fix a typo is a regression, no matter what it buys.
3. **Substance sets the ceiling; craft removes the discount.** The case studies
   decide whether he gets the call. The desk decides whether they finish reading.
   Neither substitutes for the other.
4. **Delight is never a toll.** Every animation is skippable, every path has a
   keyboard equivalent. See [ux-rules.md](../design/ux-rules.md).
5. **Deletion is a feature.** This is a portfolio, not a CMS product. When a
   choice appears between a general mechanism and a specific one that works, take
   the specific one.

## Success

Measured, not vibed. Instrumented in Phase 4.

| Signal | Target |
|---|---|
| Bounce from a shared link | < 45% |
| Median time on page | > 90s (the Notion page's baseline is the comparison) |
| Reach at least one case study | > 60% of sessions |
| Mobile Lighthouse Performance | ≥ 90 |
| Time to publish a Notion edit | < 2 min, zero code |
| Deep links shared by others | Any at all. It is the clearest signal the site did its job. |

The honest anti-metric: **if desktop sessions rise but case-study reads fall, the
desk is winning against the content and must be tuned down.**

---

## Phases

### Phase 0 — Foundation
Repo cleared of the 2019 site, Vite + TS, tokens, self-hosted fonts, Pages
deploying, the paper CSS proven on one static sheet.
*Exit: a warm paper page live at `lilithfactor.github.io`.*

### Phase 1 — Content pipeline ← **the one that matters**
Notion integration, `sync-notion.mjs`, the JSON contract, the content proxy, all
eight sections rendering real content on the stack layout, deep links, the
sync workflow on cron + manual + webhook.
*Exit: the site fully replaces the Notion page, and a Notion edit is live in
under two minutes. **From here on the site is real** — everything after is
enhancement.*

### Phase 2 — The desk
Three.js scene: desk, lamp, the eight artifacts, camera framings, DOM overlays
anchored to 3D positions, stage selection, auto-degrade.
*Exit: desktop gets the desk; mobile is untouched and downloads none of it.*

### Phase 3 — The figure
oil-motion pipeline: key frames, seven clips, alpha WebP sheets, the billboard
runtime, distance-driven walking, interruption, the state machine.
*Exit: clicking an artifact sends him walking; a second click skips him.*

### Phase 4 — Polish & launch
Case-study bodies (the four-H2 convention), OG images, analytics, the perf pass,
a11y audit, the About paragraph fixed, recommendation photos, custom domain
decision.
*Exit: shared publicly, and the old Notion link redirects here.*

---

## Idea catalog

`[ ]` = idea · `[~]` = in a phase above · `[x]` = shipped.

### Content
- [~] The four-H2 case-study body convention — the highest-value content work available.
- [ ] **Fix the About paragraph.** It currently ends `"trusted by brands like"` and stops. Add the logos or cut the clause. *(Also in [todo.md](todo.md) — it is a bug, not an idea.)*
- [ ] Photos + LinkedIn links on the two recommendations.
- [ ] A third and fourth recommendation. Two is thin for the strongest social proof on the site.
- [ ] A one-page PDF résumé generated from the same JSON — one source, two artifacts.
- [ ] "Now" line on the desk — what he is working on this month, from a single Notion field.
- [ ] Case-study bodies for the two Nissan/Chevrolet configurator links (live products, currently just URLs).

### The desk
- [~] Chess board set to a real position from a real game.
- [ ] The Rubik's cube is actually solvable — drag to turn a face. Small, self-contained, and a perfect throwaway detail for the peer-PM visitor.
- [ ] A visitor counter as a tally scratched into the desk.
- [ ] Seasonal desk dressing (a chai in winter). Cheap warmth, zero content cost.
- [ ] The lamp is clickable and dims — this is the honest path to the night-desk theme.

### The figure
- [~] The seven core clips.
- [ ] He reacts to the cursor when idle — turns his head. oil-motion's mouse-follow mapping is built for exactly this.
- [ ] He carries the sheet he just opened.
- [ ] A rare idle: solves the cube, badly.

### Distribution
- [ ] Decide `pranavupadhyay.com` vs staying on `lilithfactor.github.io`. A custom domain is the single cheapest credibility upgrade.
- [ ] OG image per section, generated at build from the JSON.
- [ ] Redirect the Notion page here once launched.
- [ ] `llms.txt` — a clean text digest for the AI tools that increasingly do the first screening pass.

### Measurement
- [~] Privacy-respecting analytics, no cookie banner.
- [ ] Track which artifact is opened first — it reveals what the hero should be.
- [ ] Track skip-rate on the walk. If it is high, the walk is too slow.

---

## Inbox

*Raw thoughts go here. Triage into the catalog above.*

- *(empty — 2026-08-12)*
