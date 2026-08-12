# Architecture

How the site is built. Design lives in [design/](../design/); the content contract
lives in [content-model.md](../content/content-model.md).

## The shape, in one diagram

```
  Notion (the dashboard — you edit here)
        │
        │  GitHub Action: cron 30m · manual · Notion webhook
        │  scripts/sync-notion.mjs   (Node, holds NOTION_TOKEN)
        ▼
  content/*.json          committed, versioned, diffable
        │
        │  Astro content collection + Zod schema
        │  → a bad sync FAILS THE BUILD, never publishes
        ▼
  src/content/            ◀── THE PROXY. The only door to content.
        │                     Nothing past this line knows Notion exists.
        ▼
  ┌─────────────────────────────────────────────┐
  │  Astro pages + components → static HTML     │  ← real text, prerendered
  │  /  /case-studies/<slug>/  /projects/…      │
  │  ─────────────────────────────────────────  │
  │  island: DeskStage      island: StackStage  │
  │  client:media ≥1024px   (CSS only)          │
  └─────────────────────────────────────────────┘
        │
        ▼
  GitHub Pages  (static, root domain, no base path)
```

## Stack

Chosen 2026-08-12 with a five-year horizon. The reasoning, including what was
rejected, is below the table.

| Layer | Choice | Pin |
|---|---|---|
| Framework | **Astro 7** | `^7` |
| Language | **TypeScript 7** | exact minor |
| Styling | **Plain CSS** — custom properties, `@layer`, native nesting | — |
| 3D | **Three.js** | **exact, no caret** |
| Content client | `@notionhq/client`, pinned `Notion-Version` header | `^5` |
| Tests | `node:test` (built in) | — |
| Format | Prettier (+ `prettier-plugin-astro`) | `^3` |
| Package manager | npm | — |
| Node | pinned in `.nvmrc` **and** the Action | `22.12+` |

**Why a framework at all.** The four things this site needs — build-time
prerendering, real per-section URLs, typed content, and selective hydration — are
about 400 lines of bespoke infrastructure if hand-rolled on bare Vite. Bespoke
build infrastructure is worse long-term debt than a framework major every ~18
months: a framework bump has a migration guide and thousands of people hitting it
the same week; hand-rolled code has only its own comments. Astro is Vite
underneath, so nothing about the Three.js integration changes.

**Why Three.js is pinned exact.** It is still `0.x`. Minor bumps break addons.
This is the single most important pin in the repo.

**Why plain CSS.** Forty tokens and ~15 components do not need a utility
framework. CSS custom properties are the platform and do not rot, and the
"never hardcode a value" rule in
[design-system.md](../design/design-system.md) is trivial to enforce with tokens
and awkward to enforce with utility classes.

**Rejected:** React (nothing here has client state worth 40KB) · Tailwind (v4
rewrote its own config model — imported churn for no gain) · a router (Astro's is
the filesystem) · a state library · a physics engine (paper settling is a spring
on one transform) · a pathfinding library (eight objects do not need A*) ·
ESLint (TS strict is the linter; the flat-config migration is not worth
re-living).

**shadcn/ui — considered and rejected (2026-08-12).** It is React + Tailwind +
Radix, and its aesthetic is the modern neutral SaaS look: rounded corners, grey
borders, Inter, slate. That is the precise opposite of the paper system — radius
≤2px, warm off-white, all-serif, contact shadows. Adopting it means overriding
nearly every token, which is the point at which the components have effectively
been rewritten while still carrying three dependency trees. The strategic
objection is bigger than the technical one: **shadcn would make the site look
like every other 2026 site**, and the site's whole argument is that it doesn't.
Component count does not justify it either — about fifteen, none of them a
combobox or a sortable table, which is exactly where shadcn earns its keep.

*The real need behind the suggestion is accessible modal behaviour for the
case-study sheet — focus trap, Escape, focus restore, ARIA. That is solved by the
native `<dialog>` element: focus trapping, top-layer rendering and `::backdrop`,
built into the browser, zero dependencies, and unable to rot. Use it.*

**The safety net.** The output is static HTML. If the toolchain rots in 2028, the
last deploy keeps serving indefinitely while it gets fixed. No server, no
runtime, no database. That is what makes framework churn an errand rather than an
emergency, and it is why taking a framework is acceptable here at all.

## Directive 1 — the content proxy

**`src/content/` is the only module in the app that content comes from.** Nothing
else may read `content/*.json`, and nothing else may ever mention Notion.

```
src/content.config.ts   the collections + Zod schemas — the real contract
src/content/
  index.ts              the public API: getCaseStudies(), getLibrary(), …
```

The collection reads the **committed JSON files**. It does *not* fetch Notion at
build time, and that is deliberate — see Directive 5.

Why the proxy is a rule and not a preference:

- **The source will change.** If Notion rate-limits, changes its API, or gets
  outgrown, the swap is one loader instead of a hunt through every component.
- **Notion's shapes are hostile.** A multi-select arrives as
  `{ multi_select: [{ name: "B2B" }] }`. If that leaks into a template, the
  template is coupled to a vendor's JSON. The sync normalises it to `["B2B"]`
  once, at the boundary.
- **Zod makes a bad sync loud.** A missing required field fails the build instead
  of publishing a portfolio with an empty section. This is the guardrail the
  content rail would otherwise lack, since content ships without code review.

The app must **never call Notion at runtime.** The official API needs a secret
token that cannot ship to a browser, and the public `/api/v3` endpoint (which the
research for this project used successfully server-side) is CORS-blocked,
undocumented, and unversioned. Content is fetched at **build time, by Node, with
the token** — never by the page.

## Directive 2 — content is DOM, always

**Text is never baked into a texture, a canvas, or a 3D mesh.** Every word is
real HTML in the prerendered document.

This is the rule that makes the 3D desk survivable. Without it, a full-canvas
portfolio loses selectable text, Cmd-F, browser translation, screen readers,
Google's index, and link previews — which for a *product manager's* portfolio is
a worse loss than the visual gain.

So the desk renders the **stage**; the DOM renders the **content**:

- A 3D object exposes an **anchor** (a `Vector3` on the desk).
- Each frame, the anchor is projected to screen space and written to CSS custom
  properties (`--x`, `--y`, `--scale`) on the matching DOM node.
- The DOM node is a normal, styled, accessible sheet of paper above the canvas —
  it just knows where its 3D object is.

Transform and opacity only — never `top`/`left`/`width`. See
[ux-rules.md](../design/ux-rules.md).

## Directive 3 — two stages, not one degraded stage

Desktop-first, but mobile is **not** a stripped desktop. Two designed
presentations of one content layer.

| | Desktop (`DeskStage`) | Mobile (`StackStage`) |
|---|---|---|
| Metaphor | The desk in 3D, lit by one lamp | A stack of paper you thumb through |
| Renderer | Three.js + WebGL | CSS only |
| The figure | Walks between artifacts, opens them | Appears at the sheet edge, points |
| 3D payload | Loaded after content is interactive | **Never downloaded** |
| Content | Identical prerendered HTML | Identical prerendered HTML |

**Mobile does not pay for the desk.** The desk is an Astro island declared
`client:media="(min-width: 1024px)"`, so a phone provably never fetches the
chunk. Declarative rather than imperative, which matters because this is the
regression most likely to happen silently.

Capability gates beyond the media query — WebGL2, `deviceMemory`,
`prefers-reduced-motion` — run inside the island before it mounts the scene, and
fall through to the stack presentation.

A visitor on the stack stage sees a **dismissible chip**: "Best on desktop —
there's a whole desk over there." A chip, not a wall. Never block content behind
a "please use a computer" modal; the person you most want reading this is exactly
the one who opened the link on a phone between meetings.

## Directive 4 — the site works with JavaScript off

Astro prerenders every page to static HTML at build time. JS only **upgrades** it.

- JS off → a complete, styled, readable paper portfolio.
- JS on, phone → the stack stage.
- JS on, real machine → the desk.

Each is a real experience. None is an error state.

## Directive 5 — content is committed, not fetched at build

Astro can load from Notion live during the build. **We don't.** Three reasons,
each of which has bitten someone:

- Notion being down would break the deploy.
- Content changes stop being diffable — there is no record of what a case study
  said last month.
- Rolling back a bad edit stops being `git revert` and becomes "remember what it
  used to say".

The sync writes JSON; git stores it; the collection reads it. A deploy never
depends on a third party being awake.

## Routing

File-based, prerendered, **real URLs** — not hash routing:

```
/                              the desk / the stack
/case-studies/<slug>/
/product-dives/<slug>/
/projects/<slug>/
/library/
/recommendations/
```

Each is a real HTML file: indexable, previewable, forwardable. This is the URL a
recruiter sends a colleague, which is the single most valuable thing the site can
produce.

## Repo layout

```
src/
  content.config.ts      collections + Zod schemas (the contract)
  content/index.ts       THE PROXY — the only door to content
  pages/                 file-based routes → prerendered HTML
  components/            paper primitives, sheets, sections
  stages/
    DeskStage.astro      island, client:media ≥1024px
    desk/                Three.js scene, artifacts, camera, anchors
    StackStage.astro     CSS paper stack
  character/             sprite runtime, walking, state machine
  styles/
    tokens.css           the design source of truth — hand-written
scripts/
  sync-notion.mjs        Notion → content/*.json
  sync-notion.test.mjs   node:test — normalisation fixtures
content/                 generated JSON — committed, never hand-edited
public/
  fonts/                 subset woff2, committed (no build-time font pipeline)
  motion/                character sprite sheets + manifest
  models/                desk geometry (.glb, draco)
.github/workflows/
  sync-content.yml       cron + manual + repository_dispatch
  deploy.yml             build → Pages
  release-notes.yml      auto GitHub Release on push to main
```

**Fonts are subset once and committed**, not subset during the build. A font
pipeline is a build dependency that rots; three committed woff2 files are not.

## Performance budget

**Gates**, not aspirations. [steps.md](../work/steps.md) checks them before merge.

| Metric | Desktop | Mobile |
|---|---|---|
| First Contentful Paint | < 1.2s | < 1.5s (4G, mid-tier) |
| Largest Contentful Paint | < 2.0s | < 2.5s |
| JS before interactive | < 120KB gz | < 120KB gz |
| 3D payload (deferred) | ≤ 2.5MB gz | **0 bytes** |
| Character sprites | ≤ 1.5MB total | ≤ 400KB (`idle` + `point`) |
| Audio (only after the visitor starts it) | ≤ 1MB per track, ~3 tracks | same |
| Frame rate | 60fps | n/a (no canvas) |
| Draw calls / triangles | < 60 / < 250k | n/a |
| Lighthouse Performance | ≥ 90 | ≥ 90 |
| Lighthouse A11y / SEO | 100 | 100 |

The desk auto-degrades before it drops frames: shadow maps off → DPR 1.5 → DPR
1.0. Measured over a rolling 60-frame window and stepped down **once** — a scene
oscillating between quality levels looks broken in a way a permanently simpler
scene does not.
