# Storyboard — The Desk

The shot list for the live desk. Art direction is in
[art-direction.md](art-direction.md); the rules any shot must obey are in
[ux-rules.md](ux-rules.md), and they outrank everything here.

**Read this as a film, not a spec.** Each beat says what the visitor *sees*,
what it *costs*, and why it earns its place. A beat that cannot justify its
frame budget gets cut — a portfolio is not a showreel, and the visitor came to
evaluate a person, not to watch a scene load.

**The through-line:** *a desk someone just stepped away from.* Not a museum
piece, not a game level. The lamp is still on. That is the whole feeling, and
every beat below is in service of it.

---

## Beat 0 — Cold open · 0–400ms

```
┌──────────────────────────────────────────┐
│                                          │   Paper. Nothing else.
│   PRODUCT MANAGER                        │   Text is already readable —
│   Pranav Upadhyay                        │   prerendered, no JS needed.
│                                          │
│   I'm a Product Manager who turns …      │   Fonts swap in. No spinner,
│                                          │   no splash, no "loading".
└──────────────────────────────────────────┘
```

The page is complete before the desk exists. This is the beat most 3D sites get
wrong: they show a loader, and the visitor who was going to leave leaves during
it. **Nothing here waits on the canvas.**

*Cost: 17KB HTML + 11KB CSS + 124KB fonts. No JS in the critical path.*

## Beat 1 — The lamp wakes · 400–1200ms

```
┌──────────────────────────────────────────┐
│  ╭───╮                                   │   The 3D chunk has arrived.
│  │▒▒▒│  ← lamp, warm pool blooms         │   The desk fades UP from the
│  ╰─┬─╯      outward over ~500ms          │   same paper white the page
│    │     ░░▒▒▓▓▒▒░░                      │   already is, so there is no
│  ══╧══════════════════════               │   flash and no seam.
└──────────────────────────────────────────┘
```

The single most important transition on the site. The desk does not *appear* —
the **light comes on**, and the objects were always there. Opacity 0→1 on the
canvas over `--m-turn` (620ms), while the lamp's warm pool scales from 0.85 to
1.0. Camera eases from very slightly wide into its resting three-quarter view.

**If the chunk is slow, this beat simply happens later.** It is never a gate.

*Cost: one opacity transition + one camera tween. No layout, no reflow.*

## Beat 2 — Resting state

```
┌──────────────────────────────────────────┐
│  PRODUCT MANAGER                         │
│  Pranav Upadhyay          ╭───╮          │   8 objects, each a section.
│                           │▒▒▒│          │   Masthead sits ON the desk.
│   ▤ dossier   ▥ board     ╰─┬─╯          │
│   ▦ crate     ▧ letters  ◉ turntable     │   Idle: lamp pool breathes 2%
│   ▩ shelf     ⬚ cube     ✉ card          │   over 6s. Camera drifts <2°.
│                                          │
│         Click anything on the desk       │   ← hint, dies on first click
└──────────────────────────────────────────┘
```

**The hint is not decoration.** A visitor who lands on a desk with no
instructions clicks nothing and leaves. One line, mono, low-contrast, gone
forever after the first open.

**Nothing loops forever** except the lamp's breath and the camera drift — both
under the threshold where they register as motion. See design-system.md.

## Beat 3 — Hover · 160ms

```
   ▤            ▤  ← lifts 4px, cut-edge shadow deepens
  ═══   →      ═══     a paper tag fades in beside it:
                       ┌──────────────┐
                       │ CASE STUDIES │   mono, uppercase
                       └──────────────┘
```

Paper does not glow. It **lifts**, and its shadow tightens because it moved
closer to the surface it sits on. That is the entire hover language.

*Keyboard parity: `Tab` produces the identical state. The tag is how a keyboard
user knows what they are focused on — it is not a mouse affordance.*

## Beat 4 — Open · 420ms

```
   ▤ pressed 2px            ┌────────────────────────┐
   (paper compresses)       │ CASE STUDIES        ✕  │
        ↓                   ├────────────────────────┤
   ░░░░ scrim to 60% ░░░░   │ Configurator: Visual…  │  ← sheet SETTLES:
        ↓                   │ Brand-led agent: Exp…  │    overshoots 4%,
   sheet rises and lands    │ 60% Faster Onboardi…   │    one counter-rotate,
                            └────────────────────────┘    still.
```

The object presses **down** first — a click on paper compresses it — then the
panel rises. That 80ms of anticipation is what makes it feel physical rather
than like a modal appearing.

The scrim exists for two reasons, one aesthetic and one functional: the paper
becomes the brightest thing on screen, and click-outside-to-close gets a real
hit area.

**Focus moves to the panel itself**, not its first link — a screen-reader user
should hear *what opened* before *where they can go*.

## Beat 5 — Reading

The panel scrolls internally; the desk never scrolls behind it. Four ways out,
because a visitor who feels trapped in a modal resents the site that trapped
them: **✕ · Escape · click the scrim · browser Back**.

The URL becomes `/#case-studies`, so this state is shareable and survives a
refresh — the whole reason the desk is allowed to be the navigation.

## Beat 6 — The record player *(the one object that behaves differently)*

```
   ◉ turntable, arm parked          ◉ arm lowers, record turns
   ┌──┐ ┌──┐ ┌──┐        click      ♪ Yesterday — Aventure
   │▓▓│ │▒▒│ │░░│         →           Bensound.com
   └──┘ └──┘ └──┘                   ┌──┐ ┌──┐ ┌──┐
   three paper sleeves               │▓▓│ │▒▒│ │░░│  ← click one to swap
```

Clicking the turntable does **not** open a panel — it drops the tonearm and
plays. This is the only object that acts rather than opens, and that difference
is the point: it is the one live thing on a desk someone stepped away from.

- **Silent until clicked, and visibly so** — arm parked, record still. No
  autoplay, ever ([ux-rules.md](ux-rules.md) rule 13).
- The spinning record is the **one permitted infinite animation**, because it is
  a state indicator: it tells you sound is coming out of your speakers.
- Attribution renders beside it. Bensound's licence requires it, and a credit
  line on a desk reads as a record label anyway.
- Volume starts at 30%. Pauses when the tab is hidden.

## Beat 7 — Close · 420ms

The sheet drops back with the same settle, the scrim clears, the object returns
to rest. Focus goes back to the object that opened it. Nothing is left on
screen that says a panel was ever there.

## Beat 8 — Mobile · the stack

```
┌───────────────┐   No canvas. Zero bytes of Three.js.
│ ░ warm corner │   The lamp becomes a warm gradient.
│               │   Sections are a stack of sheets.
│ ▤ Case studies│
│ ▤ Product div…│   ┌─────────────────────────┐
│ ▤ Projects    │   │ Best on desktop  ✕      │  ← chip, not a wall
└───────────────┘   └─────────────────────────┘
```

**Not a fallback — the pocket edition.** Most first-touches from a shared link
are phones, and a visitor there must never feel they got the leftovers.

---

## What is deliberately NOT in this film

Recorded so they don't get re-proposed:

- **No intro animation you have to sit through.** Beat 1 happens *around* the
  visitor, not *to* them.
- **No scroll-driven camera.** The wheel scrolls. Always.
- **No sound on arrival.**
- **No "explore the desk to find the case studies" game.** Every section is one
  click from rest, and every one is also a real URL.
- **No dust motes, lens flare, or depth-of-field.** They cost frames and say
  "showreel" — the opposite of the read we want.

## The figure — a later reel

The walking figure ([art-direction.md](art-direction.md)) is **not in this
storyboard** and the desk is complete without it. When it arrives it inserts
between Beats 3 and 4: click → he walks → he opens it. Every beat here already
works with him absent, which is the only reason it was safe to build the desk
first.

*Blocked on: a working ZenMux key (oil-motion cannot generate a frame without
one) and a reference image of the character, since `video_job.py` is
image→video and cannot invent a figure from text.*
