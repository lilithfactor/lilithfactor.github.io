# UX rules — the non-negotiables

Read before any interaction decision. These override aesthetics, including
everything in [art-direction.md](art-direction.md). Sourced from the
`ui-ux-pro-max` UX corpus plus the specific risks of a 3D portfolio.

## The one that governs the rest

> **This site is read by someone deciding whether to hire Pranav, often on a
> phone, often with about forty seconds of patience.**

Every rule below is that sentence applied somewhere. When a rule and a delightful
idea conflict, the rule wins — not because delight doesn't matter, but because a
portfolio that is charming and unreadable has failed at its only job.

## 1. Content is never gated behind motion

- **Any animation can be skipped.** A second click, `Enter`, `Escape`, or arrow
  keys open a section instantly with the figure teleporting.
- **Nothing waits on the figure.** The camera moves with him, the sheet begins
  fading in as he arrives — a visitor never watches a walk cycle to get a
  sentence.
- **No loading screen.** If the desk isn't ready, the content is already readable
  without it.

The walk is the site's signature. It is also, on the third visit, an obstacle.
Design it so a returning visitor can outrun it.

## 2. Reduced motion is a real mode, not a switch that disables things

`prefers-reduced-motion: reduce` produces a **complete, designed experience**:

- The stack stage, not the desk (the desk is motion by definition).
- No walking, no page folds, no camera drift, no settle.
- Transitions become instant, not fast — `transition: none`, not `50ms`.
- The figure appears as a still ink drawing beside the section heading. He stays;
  he just stops moving.

Motion sensitivity is the highest-severity accessibility issue that applies to
this project. Parallax and scroll-driven camera work cause genuine nausea.

## 3. No scroll-jacking

The scroll wheel scrolls. It does not fly a camera, advance a section, or trigger
a transition. Navigation happens by **clicking artifacts**.

If a section's content is longer than the sheet, the *sheet* scrolls, normally,
with a visible scrollbar.

## 4. Keyboard is a first-class stage

The desk is clickable; it is also fully operable without a mouse.

- `Tab` cycles the eight artifacts in reading order. Focus is **visible** — a red
  pen underline on the artifact's label, `outline-offset: 3px`, never
  `outline: none`.
- `Enter` / `Space` opens the focused artifact.
- `Escape` closes, returns focus to the artifact that opened it.
- `←` / `→` move between sheets within a section.
- Focus never enters the `<canvas>`. It is `aria-hidden` and `tabindex="-1"` —
  it is scenery. The DOM layer is the application.

A keyboard user gets the whole portfolio with no walking and no camera work, and
that is a correct experience rather than a lesser one.

## 5. Every section is a real URL

`/case-studies/visual-compare/` is a prerendered HTML file, not a hash route.

- Shareable — the reason a hiring manager can send *one specific case study* to a
  colleague.
- Back/forward work.
- Refresh restores state.
- Deep links skip the intro animation entirely.

A 3D site that is one URL is a site nobody can cite.

## 6. Text is text

Restating [architecture.md](../eng/architecture.md) Directive 2 because it is a
UX rule as much as an engineering one: selectable, searchable with Cmd-F,
translatable, screen-readable, indexable. No words in textures.

## 7. Touch targets and hit areas

- **44×44px minimum**, 8px minimum spacing — including the desk's 3D artifacts,
  whose raycast targets are padded beyond their visual bounds.
- On the stack stage, no interactive element within 16px of a screen edge (thumb
  reach and gesture conflicts).
- Hover is never the only way to discover something — it doesn't exist on touch.
  Every hover reveal has a tap/focus equivalent.

## 8. The desktop hint is a chip, not a wall

On the stack stage, a dismissible chip: **"Best on desktop — there's a whole desk
over there."** Bottom-anchored, dismissed with one tap, remembered in
`localStorage`, never shown twice.

**Never** a full-screen "please visit on a computer" interstitial. It reads as
contempt for the visitor, and the person you most want reading this is exactly
the person who opened the link on a phone between two meetings.

## 9. Loading and failure states are designed

| State | What the visitor sees |
|---|---|
| 3D still loading | The full content, readable, on the stack layout. The desk fades in when ready — it never replaces content mid-read. |
| WebGL unavailable / context lost | Stack stage. No error message; nothing failed from their point of view. |
| Sprite sheet fails | Static first-frame `<img>` of the figure. Navigation still works — the figure was never the mechanism, only the escort. |
| A section is empty in Notion | The section is not rendered at all. Never an empty folder with "coming soon". |
| Content sync is stale | Nothing. The committed JSON is always complete and valid. There is no such thing as a failed content load at runtime. |

## 10. No horizontal scroll, ever

Documented as high-severity, and on a page with a full-bleed canvas it is a
recurring bug: a transformed sheet overflowing the viewport creates a horizontal
scrollbar that makes the whole page feel broken. Wide content (a table, a code
block, a diagram) scrolls **inside its own container**.

## 11. Honest hierarchy

A product-manager-specific rule, and the reason the site exists:

- **Outcome before method.** A case study leads with what moved — "60% faster
  onboarding, halved bounce" — before how. Your Notion titles already do this;
  the design must not bury it under a beautiful hero.
- **The four-H2 structure holds** — Problem, Insight, What I shipped, Outcome. A
  visitor comparing five candidates can skim five case studies in the same shape.
- **Numbers are typeset as numbers** — `--t-metric`, tabular figures, `--red-pen`.
  They are the most valuable characters on the site.
- **No skill bars, no percentage rings, no "PM · 95%".** They are unfalsifiable
  and every hiring manager discounts them to zero.

## 12. Performance is an accessibility feature

The budgets in [architecture.md](../eng/architecture.md#performance-budget) are
UX rules. A 4-second first paint on a mid-tier Android is not a technical
shortfall — it is a visitor who left.

The load order is fixed and not negotiable:

1. HTML + critical CSS + content *(inlined — readable immediately)*
2. Fonts *(subset, `font-display: swap`)*
3. Stage decision + stage JS
4. **Then**, desktop only: the 3D chunk
5. **Then**: character sprites

Nothing in steps 3–5 blocks step 1.

## 13. Audio is opt-in, always

The record player is the site's one sound source, and it is governed by the
strictest rules on this page.

**It never autoplays.** Off by default, and *visibly* off — tonearm parked,
record still. Browsers block gestureless autoplay anyway, so this is not a
limitation being worked around; it is the correct design regardless.

The reason is the audience. A hiring manager opening this link in an open-plan
office, or on a phone in a meeting, who gets unexpected music will close the tab
and remember why. **Sound is the only thing this site can do that actively costs
the visitor something.** Opt-in inverts it: a visitor who chooses to drop the
tonearm is leaning in, and the music becomes a reward for exploring rather than
an ambush at the door.

| Rule | Why |
|---|---|
| **Zero bytes until requested** | No audio file is fetched until the visitor starts playback. It must not appear in the initial load at all. |
| **Pause on `visibilitychange`** | Nobody should have to hunt their tabs for mystery music. Resume only if they return and it was playing. |
| **Always-reachable control** | A small persistent mute/stop, keyboard-operable, present on **both** stages. Never only a 3D object — that strands keyboard and mobile users with sound they cannot stop. |
| **Remember the choice** | `localStorage`. If they turned it off, it stays off next visit. If on, it still waits for a gesture — the browser requires one, and so do we. |
| **Start at ~30% volume** | Full-volume first note is its own kind of ambush. |
| **Instrumental only** | Lyrics compete with reading, and reading is the point. |
| **Never gate content behind it** | Nothing requires sound to be understood. No audio-only information, ever. |

**Licensing is a hard requirement, not a formality.** Every track must be owned
by Pranav or licensed for public web use (CC0 / CC-BY with attribution rendered).
This site carries his name; an unlicensed track is a real liability, not a
technicality.

## Pre-merge checklist

- [ ] Keyboard-only pass through all eight sections
- [ ] `prefers-reduced-motion: reduce` gives a complete experience
- [ ] Every section deep-links and survives refresh
- [ ] Real phone, not just a devtools viewport
- [ ] JS disabled → content still reads
- [ ] No horizontal scrollbar at 320px, 768px, 1024px, 1440px
- [ ] Cmd-F finds a word from a case-study body
- [ ] **The page is silent on load**, and no audio file appears in the Network tab
- [ ] Sound can be stopped by keyboard, on both stages
- [ ] Lighthouse: Performance ≥ 90, Accessibility 100, SEO 100
