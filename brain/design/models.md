# The desk's 3D models

> *Written 2026-08-14.* Until now every object on the desk was procedural
> geometry (`src/stages/desk/objects.ts`), on the stated principle that a `.glb`
> cannot be reviewed in a diff or recoloured from a token. That principle was
> right about **material** and wrong about **silhouette**: a folded-card
> approximation of a magnifying glass is a shape you have to be told the meaning
> of. Downloaded geometry, re-materialled by us, keeps the paper look and buys a
> silhouette that reads instantly.

> *Updated 2026-08-14.* The scene is now **one paper and one ink**: every object
> is the same off-white (`--stage-sheet`) and separated by a drawn black edge
> (`--stage-line`, see `outline.ts`), not by colour. Downloaded models are
> repainted into that single tone like everything else — which makes silhouette
> the only thing a model contributes, and raises the bar for taking one.
>
> One casualty worth recording: the chess knights are fetched and credited but
> **not placed**. At 62mm they are about 30 screen pixels of a 200-triangle
> faceted mesh, and an ink line around every facet collapses into a solid black
> blob. Small + faceted + outlined does not work; the printed diagram does.

**The split, which is the whole idea:** *they* supply geometry, *we* supply
material. Every model is stripped of its incoming materials on load and given
the paper Lambert, the cut-edge vertex colours and the palette tokens. That is
why low-poly models look *better* here than photoreal ones — and why a 47MB
scanned lamp is not a better version of a 67KB one, it is a worse one whose
entire cost is textures we delete.

## Two sources, two scripts

| Concern | Where |
|---|---|
| The 17 poly.pizza models + provenance | [`scripts/fetch-models.mjs`](../../scripts/fetch-models.mjs) — the `MODELS` map |
| The lamp and turntable, from hi-fi sources | [`scripts/prepare-models.mjs`](../../scripts/prepare-models.mjs) |
| Hi-fi inputs (54MB, git-ignored, never shipped) | `models-src/` |
| The files the site uses | `public/models/*.glb` (1.0MB, desktop-only) |
| Credits | `public/models/ATTRIBUTION.md`, generated |
| Re-materialling + placement | `src/stages/desk/` — **not yet wired; see todo** |

Triangle and part counts in `fetch-models.mjs` are **assertions**: an upstream
re-upload warns rather than silently swapping the object on the desk.

### Why the two hero objects come from elsewhere

The survey picked poly.pizza models for the lamp and turntable. Two hi-fi
downloads then beat both outright, and it is worth recording why the survey was
wrong — the criteria were right but incomplete.

*Cost is not size.* A 47.8MB lamp and a 6.1MB record player sound
disqualifying, but the cost was in the parts we discard anyway: the record
player is **3,610 triangles wrapped in 6MB of textures** and lands at **149KB**
once repainted. The lamp is the opposite, 1.75M triangles and *zero* textures —
pure density, which simplification takes to 13.5k at 440KB. Neither number
described the model; both described its packaging.

*Look at it under the real material.* Rendered side by side in the paper
Lambert, the salvaged lamp is a spring-arm anglepoise with a conical shade and
weighted base, and the salvaged turntable is a suitcase portable with an open
lid. The poly.pizza equivalents are a cylinder on a stick and a slab. For the
two objects a visitor looks at longest, that gap is worth 590KB.

The rule that survives: **judge a model after the treatment, not in the
listing.** A hi-fi download is a candidate, not a disqualification — but only
if it survives texture-stripping and simplification, which is a test to run,
not to predict.

## Selection criteria

1. **≤ ~900 triangles.** Whole set is 5,666 — it roughly doubles the procedural
   desk instead of replacing its cost with a download.
2. **No texture dependency.** Anything whose appeal is its texture is unusable,
   because the texture is the first thing we throw away.
3. **Separable parts where the object moves.** The lamp exists as a criterion of
   its own: its head pivots and drives a real `SpotLight`, so a fused mesh —
   which is what nearly every desk lamp on every asset site is — cannot be
   rigged. Of ~25 lamps surveyed, exactly one had a separable head.

   The hi-fi lamp initially failed this test, because exporters group meshes by
   **material**: its shade and base arrived inside one "body" mesh that no
   rotation could pivot. They are separate shells with a physical gap between
   them (shade at Y 31–48, arm topping out at 29.3), so `prepare-models.mjs`
   cuts at Y 30 — through empty space, severing nothing — and emits a `head`
   node. Verified by rendering the head at −30° and +25°: shade and bulb travel
   together, arm and base stay put.
4. **CC0 or CC-BY.** Both permit commercial use and modification.

## Every object means something

The desk's rule, stated 2026-08-14: *every object is clickable and carries
significance.* Nothing is set dressing. An object that opens nothing is a
texture pretending to be a control.

| Object | Model | Opens |
|---|---|---|
| Open book | `open-book` | About |
| File folder + clipboard | `folder`, `clipboard` | Case studies |
| Corkboard + magnifier | `corkboard`/`pinboard`, `magnifier` | Product dives |
| Open box | `crate` | Projects |
| Envelope + posted letter | `envelope`, `letter` | Recommendations |
| Book row + stack | `books`, `book-stack` | Library |
| Chess knights on the printed position | `knights` | Beyond → chess |
| **Rubik's cube** | `rubiks` | **Speedcubing scores** — needs content |
| **Turntable** | `turntable` | **Spotify** — needs a URL, and it is also the music control |
| Legal pad, pencil, post-its, mug | `legal-pad`, `pencil`, `postit`, `mug` | Nothing yet — see below |

**The unresolved half of the rule.** The last row is the honest gap: those four
are the objects that make a desk look inhabited, and under "everything is
clickable" they either earn a meaning or come off the desk. Candidates: the
legal pad as a now/next note, the mug as the "currently drinking / currently
reading" aside. Decide before placing them, not after — an object placed first
and justified later is how set dressing gets in.

## What stays procedural, permanently

- **The desk, walls and shelf** — they are the coordinate system every
  placement is expressed in. Resizing a downloaded desk to match eight
  placements is strictly worse than the three boxes they are.
- **The printed sheets, the chess diagram, the business card** — their faces are
  `CanvasTexture`s drawn at runtime from synced Notion content ("60% FASTER",
  "25% TTM"). A model would freeze numbers the whole content pipeline exists to
  keep live.
- **Loose paper and the cut edges** — literally boxes with vertex colours, and
  the cut edge is the entire paper read.

## Scale is not comparable between models

Poly's archive has no unit convention: surveyed models ranged from 0.005 to 1.95
units tall for objects that are all roughly a foot wide in life. Nothing may be
placed by trusting its authored scale — the loader normalises each model by its
bounding box to a size given in *our* units, the same way `PLACEMENTS` already
expresses everything else.
