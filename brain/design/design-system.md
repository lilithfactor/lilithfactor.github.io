# Design system — "Desk"

**`src/styles/tokens.css` is the source of truth.** This doc explains what each
token is for and why it has that value. If the two disagree, the CSS is right and
this doc needs updating.

> **Rule: never hardcode a hex, a duration, or a spacing value in a component.**
> If you need a value that isn't here, add it here first. The moment one `#fff`
> lands in a component, the paper stops being one material.

Derived from the **E-Ink / Paper** and **Anti-Polish / Raw** directions in the
`ui-ux-pro-max` style corpus, warmed toward editorial. The world it dresses is in
[art-direction.md](art-direction.md).

## Colour

### Paper
| Token | Value | Use |
|---|---|---|
| `--paper-page` | `#FAF7F0` | The page ground. The lightest surface on the site. |
| `--paper-sheet` | `#F5F1E8` | A sheet lying on the desk. |
| `--paper-aged` | `#EDE6D6` | Older paper — folder interiors, the Library's read books. |
| `--paper-edge` | `#DED4BE` | Cut edges, hairline rules, dividers. |

**The white is never `#FFFFFF`.** This is the single most important value in the
system. Pure white next to warm paper reads as a bug.

### Desk
| Token | Value | Use |
|---|---|---|
| `--desk` | `#3B3229` | Walnut surface, matte. Dark enough that paper needs no outline. |
| `--desk-deep` | `#241E18` | Shadowed desk, scene background, contact-shadow base colour. |

### Ink
| Token | Value | Contrast on `--paper-page` | Use |
|---|---|---|---|
| `--ink` | `#1F1B16` | 15.8:1 — AAA | All body and heading text. A warm black, never `#000`. |
| `--ink-muted` | `#6B6358` | 5.6:1 — AA | Secondary text, labels, metadata. **The floor for anything readable.** |
| `--ink-faint` | `#8A8175` | 3.4:1 — fails AA | **Non-text only.** Rules, hairlines, disabled marks, decorative strokes. Never put words in this. |

That last row is a trap worth naming: `--ink-faint` looks lovely on 12px mono
labels and it is unreadable for a chunk of your visitors. Labels use
`--ink-muted`.

### Marks
| Token | Value | Use |
|---|---|---|
| `--red-pen` | `#B4472F` | The editor's mark. Active state, the current section, outcome numbers. **Used sparingly — it is the only loud colour on the site.** |
| `--ink-blue` | `#2E4A6B` | Links. Reads as a second pen, not a web link. |
| `--kraft` | `#C4A77D` | Manila folders, tabs, envelope interiors. |
| `--highlighter` | `#E8D98A` | A marked line. Always at `0.35` alpha under text, never as a fill. |

### Semantic aliases
Components use these, not the raw values above:

```css
--bg: var(--paper-page);
--surface: var(--paper-sheet);
--text: var(--ink);
--text-muted: var(--ink-muted);
--rule: var(--paper-edge);
--link: var(--ink-blue);
--accent: var(--red-pen);
```

### Theme
**Light-committed.** Paper inverted is not paper — it is a dark UI with a beige
tint, and the whole argument of the site collapses. So: `color-scheme: light` is
set explicitly, and `--bg` is painted on `body` rather than inherited.

A real dark mode exists as a Phase 4 *option*, and it is a **night desk**, not an
inversion: the lamp stays warm, the desk goes near-black, the paper drops to
`#E8E2D6` at reduced luminance. Same world, later in the evening. Only build it
if it earns its place — it is nobody's blocker.

## Typography

Three families, all variable, all **self-hosted and subset** (no third-party
request, no FOUT, no privacy question).

| Role | Family | Why |
|---|---|---|
| Display | **Fraunces** | Variable serif with `opsz` and `WONK` axes. Warm, slightly old-style, a little hand-cut at large sizes. Editorial without the fashion-magazine coldness of Playfair. |
| Body | **Source Serif 4** | Screen-tuned serif that stays comfortable at 17px for a 300-word case study. Pairs with Fraunces without competing. |
| Label / metric | **IBM Plex Mono** | Reads as *typed* — a form, a stamp, a spec. Carries tags, dates, KPIs, and outcome numbers. |

No UI sans-serif anywhere. The moment Inter appears, the desk becomes a website.

### Scale
| Token | Size / line-height | Family & weight |
|---|---|---|
| `--t-display` | `clamp(2.75rem, 6vw, 4.5rem)` / 0.95 / `-0.02em` | Fraunces 700 |
| `--t-title` | `clamp(1.75rem, 3.2vw, 2.5rem)` / 1.1 / `-0.01em` | Fraunces 600 |
| `--t-heading` | `1.375rem` / 1.25 | Fraunces 600 |
| `--t-subhead` | `1.125rem` / 1.4 | Source Serif 4 600 |
| `--t-body` | `1.0625rem` / 1.65 | Source Serif 4 400 |
| `--t-small` | `0.9375rem` / 1.5 | Source Serif 4 400 |
| `--t-label` | `0.75rem` / 1 / `0.09em` / uppercase | IBM Plex Mono 500 |
| `--t-metric` | `clamp(1.75rem, 3vw, 2.75rem)` / 1 | IBM Plex Mono 500, `tabular-nums` |

**Measure: 62–68ch** on body text. A case study wider than that is unread.

**Margin notes** — the annotations in a sheet's margin — are Source Serif 4
*italic* at `--t-small` in `--ink-muted`. **Not a handwriting font.** Handwriting
fonts are the fastest way to make a considered design look like a template.

## Space

4pt base: `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128` as
`--s-1 … --s-10`.

Paper wants generous margins — a sheet with 16px padding looks like a web card. Sheet
interiors start at `--s-6` (32px) and go to `--s-8` (64px) on desktop.

## Form

| Token | Value | Note |
|---|---|---|
| `--r-sheet` | `1px` | Paper. Effectively square. |
| `--r-chip` | `2px` | Tags and chips. |

**Nothing on this site has a radius above 2px.** A rounded corner is the single
clearest tell that something is a UI card rather than a sheet of paper. The only
curve allowed is a *curled* corner, which is a mask, not a radius.

### Elevation
Contact shadows — tight, warm, short-offset. Paper rests on something.

```css
--e-rest: 0 1px 2px rgba(36,30,24,.10);
--e-lift: 0 1px 2px rgba(36,30,24,.10), 0 6px 16px -8px rgba(36,30,24,.22);
--e-open: 0 2px 4px rgba(36,30,24,.12), 0 18px 40px -20px rgba(36,30,24,.35);
```

Three levels, no more. A soft 40px glow with no contact point is a floating
`<div>`, not an object on a desk.

### Grain
Every paper surface carries fibre:

```css
--grain: url("data:image/svg+xml,…feTurbulence baseFrequency='0.8'…");
/* 180px tile · opacity .035 · mix-blend-mode: multiply */
```

Generated as an inline data URI at build — **no image request**. At 3.5% it is
invisible as texture and unmistakable as material. Above ~6% it starts to hurt
text contrast, which is the failure mode the `ui-ux-pro-max` corpus flags for
skeuomorphic and raw-aesthetic styles both.

## Motion

| Token | Value | For |
|---|---|---|
| `--m-quick` | `160ms cubic-bezier(.2,.8,.2,1)` | Hovers, chips, tag states |
| `--m-settle` | `280ms cubic-bezier(.16,1,.3,1)` | Paper landing — the ~4% overshoot |
| `--m-open` | `420ms cubic-bezier(.16,1,.3,1)` | A sheet opening |
| `--m-turn` | `620ms cubic-bezier(.65,0,.35,1)` | The page fold. The site's one slow moment. |
| `--m-camera` | `700ms cubic-bezier(.4,0,.2,1)` | Desk camera easing to an artifact |
| *(walk)* | distance-driven | Not a duration. One sprite frame per fixed distance travelled. |

**Transform and opacity only.** Animating `width`, `height`, `top`, or `left`
triggers layout on every frame — flagged as a high-severity issue in the UX
corpus and immediately visible on a mid-tier phone.

**No infinite animations** except the character's `idle` and the camera's <2°
drift. Decorative loops are a documented distraction anti-pattern, and on a page
someone is trying to *read*, they are worse than useless.

## Icons

**Hand-drawn SVG line marks**, single weight, matching the ink figure's stroke.
About sixteen are needed (external-link, close, next, prev, play, the five
Beyond-the-Routine props, the six social marks).

- **No emoji as icons.** Ever.
- **No geometric icon set** — Lucide and its family are precise and cold, and next
  to a hand-drawn figure they look like they arrived from a different project.
- If time-pressed: Lucide at `stroke-width: 1.5` is the acceptable stopgap, and it
  is a stopgap, recorded in [todo.md](../vision/todo.md) as debt.

## Layout

- **Desktop:** the desk fills the viewport. Content sheets are anchored to 3D
  objects, `min(680px, 42vw)` wide, and always land within the safe reading zone
  — never against the viewport edge, never over the figure.
- **Mobile:** single column, `--s-5` (24px) gutters, sheets full-bleed minus the
  gutter.
- **Breakpoint that matters: 1024px.** Below it, the stack stage. This is a
  *capability* boundary, not just a width one — see
  [architecture.md](../eng/architecture.md#directive-3--two-stages-not-one-degraded-stage).

## The checklist

Before any screen is called done:

- [ ] No pure white, no pure black, no hex outside this doc
- [ ] Radius ≤ 2px everywhere
- [ ] Text on `--ink` or `--ink-muted` — never `--ink-faint`
- [ ] Measure ≤ 68ch
- [ ] Grain present on every paper surface
- [ ] Shadows have a contact point
- [ ] Only transform/opacity animated
- [ ] `--red-pen` used fewer than five times on screen
- [ ] Reads correctly with `prefers-reduced-motion: reduce`
