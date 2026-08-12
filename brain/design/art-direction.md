# Art direction — The Desk

The world bible. Tokens are in [design-system.md](design-system.md); the rules
that constrain all of this are in [ux-rules.md](ux-rules.md).

## The idea

**A product manager's desk, at the end of a good day, lit by one warm lamp.**

Not a museum, not a game, not a hero video. A working surface with real things on
it: a dossier of case studies, index cards pinned to a board, a shelf of books
that has visibly been read, a chess board mid-game, a cube that isn't solved. You
click a thing; a small ink-drawn Pranav walks over, opens it, and the paper is
yours to read.

The metaphor is doing an argument, not just a vibe: **a PM is someone who makes a
mess legible.** A desk that is dense, personal, and still perfectly navigable
*is* the portfolio piece. The visitor should finish thinking "this person
organises things well" before they have read a single case study.

## Why paper

Paper is the one material that is simultaneously **warm** and **credible**.
Glass-and-neon 3D reads as a designer's showreel; a PM who ships that invites the
question "but can you write a spec?". Paper reads as thinking — memos, drafts,
margin notes, a red pen. It also happens to be the cheapest convincing thing to
render: paper is matte, so it needs almost no specular work, and its detail lives
in **grain and edges**, both nearly free.

Three things make paper believable, and only three:

1. **The white is never white.** `#FAF7F0`, not `#FFFFFF`. Warm, slightly yellow.
2. **The shadow touches.** Paper sits *on* something. A tight contact shadow at
   the edge, not a soft 40px glow floating in space.
3. **The corners are sharp.** 0–2px radius. A 12px rounded corner is a UI card,
   not a sheet of paper. The only curve paper gets is a *curled* corner.

Get those three right and a flat `<div>` reads as paper. Everything after is
refinement.

## The two stages

Same world, two presentations. Neither is a fallback for the other.

### Desktop — the desk, in 3D
A three-quarter view, camera slightly above and to the left, as if you just sat
down. One warm key light (the lamp, upper right), one cool fill (a window, off
left) so the paper has a temperature gradient across it. Soft contact shadows.
The desk surface is a dark walnut-toned matte — dark enough that the paper pops
without any outline.

The camera **does not free-fly**. It has a small set of known positions: the
overview, and one framing per artifact. Clicking an artifact eases the camera to
that framing over ~700ms. Idle, the camera drifts by a degree or two — enough to
feel alive, not enough to notice as motion.

### Mobile — the stack
The same desk, seen from directly above, flattened: a **stack of paper** you
thumb through. Sections are sheets; a swipe slides the top sheet away with a
weighted settle. The lamp becomes a soft warm gradient in the top-right of the
viewport. All CSS. No canvas, no WebGL, no download.

It has to be genuinely good on its own, because most first-touches from a shared
link are phones. A visitor on mobile should never feel they got the leftovers —
they got the pocket edition.

## The desk, object by object

Every section is a physical thing. This is the map from
[content-model.md](../content/content-model.md) to the world:

| Section | Object on the desk | Opening motion |
|---|---|---|
| **About** | An open notebook, centre-left, always visible | Already open — this is the landing state |
| **Case Studies** (5) | A manila dossier, tabs visible, slightly askew | Figure lifts the cover; sheets fan out |
| **Product Dives** (7) | A pinned board with index cards + a magnifier | Figure pulls a card off the pin |
| **Projects** (5) | A small crate of shipped things / blueprints | Figure opens the lid |
| **Recommendations** (2) | Two opened letters with envelopes | Figure unfolds one |
| **Library** (37) | A shelf behind the desk + a reading book | Camera tilts up to the shelf |
| **Beyond the Routine** (5) | The props themselves — the record player, cube, chess board, film strip | Each is directly clickable |
| **Connect** | A business card and a stamped envelope | Figure hands the card forward |

**Props are not decoration.** The Rubik's cube on the desk *is* the Speedcubing
entry. The chess board *is* the Chess entry, and it is set to a real position. The
record player *is* the Music entry, and it links onward to Spotify. Nothing on the
desk is there just to fill space — which is the difference between a set and a
scene.

The desk should look **used**: the dossier is not square to the edge, there is a
ring where a cup sat, one pen is uncapped. Perfect alignment reads as a template.
A 2–4° rotation on the paper stacks does more for believability than any shader.

## The figure

An **ink sketch of Pranav** — ballpoint on paper, confident single-weight line,
no colour except the red pen. Roughly 1/8 the height of the frame. He is not a
mascot and he does not have a personality that needs explaining; he is a
draughtsman's figure who happens to live on this desk.

**He is the site's navigation.** Not a decoration that also happens to move — the
literal answer to "how do I get to the case studies".

### What he does

| State | Frames | Trigger |
|---|---|---|
| `idle` | ~24, loop | Default. Weight shift, a breath. Never a bounce. |
| `walk` | ~16, loop | Travelling. **Frame index driven by distance, not time** — one stride per N pixels, so he never moon-walks. Mirror the sheet for the other direction; do not generate twice. |
| `turn` | ~8 | Direction change on arrival |
| `open` | ~18 | Arrived at an artifact; the artifact opens on the frame his hand lands |
| `point` | ~12 | Idle-hint after ~15s of no interaction, aimed at the nearest unopened artifact |
| `read` | ~20, loop | While a sheet is open — he stands and reads it with you |
| `return` | reuse `walk` | On close, back to his spot near the notebook |

Seven clips. That is the whole character. Resist adding more — every clip is an
AI generation cycle, a review pass, and a payload.

### How he is built — oil-motion

Per [oil-motion](/Users/lilithfactor/Ext-Dev/oil-motion)'s delivery guidance, this
subject is **small, 2D, and frequently seeked**, which puts it squarely in the
**alpha WebP sprite sheet** route — not chroma-key video. Keying happens at build
time; random access stays instant, which matters because `walk` is scrubbed by
distance rather than played.

Pipeline, in order, and the order is the point:

1. **Lock key frames first.** For a walking figure the identity risk is
   proportions — arm length, head size, line weight. Generate and approve the
   contact/passing/contact poses before any video generation, or the model will
   quietly redraw him mid-stride.
2. Generate continuous motion between them.
3. Frame review: no extra limbs, no flicker, no duplicate frames, clean alpha at
   the line edges — a thin ink line is exactly what over-aggressive keying eats.
4. Compress to **actual on-page display size** (~256px tall, 2× DPR → 512px
   frames). Not more.
5. Wire to the runtime.

**In the desk scene he is a billboarded plane**, not a DOM overlay. That is what
gets him the scene's lighting, a real contact shadow, and correct occlusion
behind the dossier — and perspective scales him automatically as he walks
"into" the desk. On mobile he is a plain `<img>` swapping sprite sheets.

**Budget:** ≤ 1.5MB for all seven clips on desktop; mobile ships `idle` + `point`
only, ≤ 400KB.

### The walk, precisely

This is the interaction the whole site is built around, so it is worth being
exact:

1. Visitor clicks the dossier.
2. A path is computed on the desk plane from his current position to the
   dossier's approach point. Straight line unless it crosses another object, in
   which case one waypoint around it. **No pathfinding library** — a desk with
   eight objects does not need A*.
3. He turns (~8 frames), then walks. Speed ~1.2 desk-units/sec, and the walk
   sprite advances one frame per fixed distance travelled, so the stride is
   locked to the ground.
4. The camera begins easing to the dossier framing **at the same time** — it does
   not wait for him to arrive. A camera that waits feels like a loading screen.
5. On arrival: `turn`, then `open`. The dossier's cover lifts on the frame his
   hand meets it.
6. The content sheet fades up as DOM, anchored to the dossier. He shifts to
   `read`.

**Interruptible at every step.** Click a different artifact mid-walk and he
redirects from where he is — he does not finish the old walk first, and he does
not teleport. If a visitor clicks four things in three seconds, the site should
feel responsive and slightly funny, never stuck.

**Skippable.** Any keyboard navigation, or a second click on the same artifact,
opens it instantly — figure teleports, no animation. Charm must never become a
toll. See [ux-rules.md](ux-rules.md).

## The record player

Back-right of the desk: a small turntable and a **stack of paper sleeves**.
Sleeves are the right object because the site is already made of paper — an album
sleeve needs no new material invented for it.

- **Parked = silent, and it looks it.** Tonearm resting on its rest, record still.
  A visitor can tell at a glance that the site is not making noise.
- **Click a sleeve** → the arm lifts, the record swaps, the arm drops. Changing
  tunes is a physical act, not a dropdown.
- **The record spins while playing.** This is the one **infinite animation
  permitted** past the rule in [design-system.md](design-system.md), and the
  exemption is principled: it is a *state indicator*, not decoration. It tells the
  visitor that sound is currently coming out of their speakers, which is
  information they need. When paused, it stops.
- **On the stack stage** it is a compact player card with the same sleeves — the
  device is content (the Music entry), so it cannot be desktop-only.

The sleeve art is drawn in the same ink as the figure: single-weight line, one
red-pen mark. Three sleeves is the right number — enough to feel like a choice,
few enough that none of them is filler.

**It never plays on its own.** The full set of audio rules — opt-in, zero bytes
until requested, pause on tab-hide, always-reachable mute — is in
[ux-rules.md](ux-rules.md). They are UX law, not art direction, and they outrank
everything on this page.

## Motion character

Paper does not ease like software. It **settles**.

- A sheet dropped onto the desk overshoots ~4%, comes back, and stops. One small
  counter-rotation, then still.
- Nothing bounces more than once. Two bounces is a cartoon.
- Page turns are the signature transition — a fold with the light catching the
  curl, ~620ms, the one moment in the site allowed to be slow.
- **Nothing loops forever.** No floating, no pulsing, no ambient bobbing. The
  camera's idle drift is the single exception and it is under 2°.

## What this must never become

- **A game.** No score, no exploration reward, no "find the hidden thing". The
  visitor came to evaluate a candidate.
- **A loading screen.** If the desk needs a spinner, the desk is too heavy.
  Content is readable before the 3D arrives, always.
- **Cute over clear.** The figure is charming; the case studies are the point. If
  charm ever costs a reader the outcome number, charm loses.
