# brain — the context for this repo

This repo is **one product**: a personal portfolio for Pranav Upadhyay, hosted on
GitHub Pages at `lilithfactor.github.io`, with **Notion as the CMS**.

Everything under `brain/` is the durable context. Code says *what* the site does;
these docs say *why*, *for whom*, and *what must never break*.

> **These docs were rebuilt on 2026-08-12.** Before that, `brain/` was a verbatim
> copy of the Muretabi mobile-app repo's brain — EAS builds, Supabase migrations,
> five Vercel projects, none of which exist here. If you are reading a doc that
> mentions `app.json`, `eas update`, or an APK, it was missed in the rewrite and
> is wrong. Nothing in this project ships a binary.

## Read in this order

| # | Doc | Owns |
|---|---|---|
| 1 | [start/profile.md](start/profile.md) | The hat to wear. Director of Product + EM + analyst. |
| 2 | [start/CLAUDE.md](start/CLAUDE.md) | Model routing — which model does what. |
| 3 | [vision/vision.md](vision/vision.md) | What this site is, who it is for, what it must prove, the phases. |
| 4 | [vision/todo.md](vision/todo.md) | What is being built **right now**. |
| 5 | [eng/architecture.md](eng/architecture.md) | The layers, the content proxy, the two stages, the perf budget. |
| 6 | [content/content-model.md](content/content-model.md) | The Notion → JSON contract. The only content truth. |
| 7 | [design/art-direction.md](design/art-direction.md) | The world: the desk, the paper, the ink figure. |
| 8 | [design/design-system.md](design/design-system.md) | Tokens: colour, type, space, elevation, motion. |
| 9 | [design/ux-rules.md](design/ux-rules.md) | The non-negotiables. Read before any interaction decision. |
| 10 | [work/workflow.md](work/workflow.md) | How we work — branches, commits, skills, model routing. |
| 11 | [work/steps.md](work/steps.md) | The ship checklist. |
| 12 | [work/releases.md](work/releases.md) | How release notes happen (automatically). |
| 13 | [work/learning.md](work/learning.md) | Hard-won learnings. Read before re-diagnosing anything weird. |

## Folder map

```
brain/
  README.md              ← you are here; the map
  start/                 who to be, and how to route work
    profile.md           the persona
    CLAUDE.md            model routing directives
    team/brand-manager.md a specialist hat
  vision/                what & why
    vision.md            positioning, principles, phases, idea catalog
    todo.md              build-scoped tasks for the current phase
  design/                how it looks and behaves
    art-direction.md     the desk, the paper, the character — the world bible
    design-system.md     tokens; the only place a hex or a duration is defined
    ux-rules.md          non-negotiables (a11y, perf, motion, fallback)
  content/               what it says
    content-model.md     Notion schema → JSON contract, field by field
  eng/                   how it is built
    architecture.md      layers, content proxy, two stages, budgets, stack
  work/                  how we ship
    workflow.md          process & directives
    steps.md             the ship checklist
    releases.md          the auto-generated GitHub Release
    learning.md          hard-won learnings — high bar, see its header
```

Two folders outside `brain/` worth knowing:

- **`dump/`** — the 2019 student portfolio (logos, `index.html`, `style.css`).
  Kept only as a memento until launch. It is **not** a reference for anything;
  nothing in it is being ported. Delete after Phase 4.
- **`content/`** *(created in Phase 1)* — the generated JSON written by the Notion
  sync. **Committed** to the repo, but **never hand-edited.** It is a build
  artifact with a git history, which is deliberate: it makes every content change
  diffable and revertible, and it means the site never depends on Notion being up.

## Where a new thought goes

| The thought | Goes to |
|---|---|
| "The site should also do X" | [vision.md](vision/vision.md) → Inbox |
| "X is next, and here is the scope" | [todo.md](vision/todo.md) |
| "This colour / font / spacing" | [design-system.md](design/design-system.md) — never a hex in a component |
| "The figure should do X when Y" | [art-direction.md](design/art-direction.md) |
| "Notion has a new field" | [content-model.md](content/content-model.md), then the sync script |
| "This broke, and here is why" | [work/learning.md](work/learning.md) |
| "We should always do it this way" | [workflow.md](work/workflow.md) as a directive |

## The one-line summary

**Notion is the dashboard. A GitHub Action turns it into static JSON. A desk made
of paper renders it — in 3D on desktop, as a paper stack on mobile — and an
ink-sketch figure walks a visitor through it.**
