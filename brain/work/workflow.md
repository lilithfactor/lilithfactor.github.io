# How we work

> *Rebuilt 2026-08-12.* This file used to describe the Muretabi mobile app — EAS
> channels, Supabase migrations, five Vercel projects, `expo-updates`. None of it
> exists here. Replaced wholesale.

Product is in [vision.md](../vision/vision.md); design in
[design/](../design/); engineering in [architecture.md](../eng/architecture.md).

## The first proposal is the best long-term step (directive)

**Whatever is proposed first must be the best possible step for the long-term
state of the project.** A workaround is a fallback, taken only when there is
genuinely no other way forward — and when one is taken, it is labelled as one,
with the real fix written down next to it.

Why this is a rule and not a preference: a workaround offered first tends to get
accepted, because it is faster and it is the thing on the table. Then it *is* the
architecture. Config that papers over a problem also destroys the diagnosis —
you never find out whether the underlying cause was real.

In practice:

- **Work out the correct structure before offering a fix.** If the correct fix is
  more work, recommend it anyway and state the cost. Scaling the work down is
  Pranav's call, not the proposer's.
- **Config in git beats config in a web UI.** Anything set only in a dashboard is
  invisible, unreviewable, and lost when something is recreated.
- **Remove the cause rather than add a counterweight.**
- **A check that can pass for the wrong reason is worse than no check** — it gets
  quoted as proof.

## `main` is production

A push to `main` deploys the site. There is no staging, no preview channel, no
approval step. **Push when it is ready, not when it compiles.**

This is genuinely simpler than the mobile app this repo's docs used to describe,
and the simplicity is the point: one artifact, one branch, one deploy.

Rollback is `git revert` + push, or re-running a previous successful deploy from
the Actions tab. Both take about a minute.

## Two rails, and they are independent

The single most important process fact about this project:

| Rail | Changes | Path | Review |
|---|---|---|---|
| **Content** | Case studies, projects, books, copy | Edit in Notion → sync Action → `content/*.json` → deploy | **None.** It is Pranav's own words. |
| **Code** | Layout, the desk, the figure, the pipeline | Branch → PR → merge → deploy | Yes — the checklist in [steps.md](steps.md) |

Content must never require the code rail. If publishing a case study needs a
pull request, the system has failed at its main job. The corollary: **never
hand-edit `content/*.json`.** It is generated. An edit there is overwritten by
the next sync, silently, and the fix looks like a haunting.

## Repo layout

```
brain/          product + process + design docs (start here)
src/            the site — see architecture.md for the full tree
scripts/        sync-notion.mjs
content/        generated JSON — committed, never hand-edited
public/         fonts, sprite sheets, models, synced Notion assets
dump/           the 2019 site. A memento. Delete at launch.
.github/        deploy, content sync, release notes
```

## Model routing

Per [CLAUDE.md](../start/CLAUDE.md), and it matters here because this project has
three genuinely different kinds of work:

| Model | Use for | On this project |
|---|---|---|
| **Fable** | Orchestration, high-level deep planning | Phase planning, architecture calls, design direction |
| **Opus** | Scanning, problem solving | Building features, debugging the desk, the sync |
| **Sonnet** | Double-check, deletion, verification, grunt work | Checklist passes, dead-code removal, doc consistency, asset processing |

Switch deliberately. Planning the desk's camera system on Sonnet wastes the
plan; running a 40-item verification pass on Fable wastes the budget.

## Skills

Three, all named by Pranav, each with a real job here.

### `ui-ux-pro-max` — before any visual or interaction decision
```
/Users/lilithfactor/ZeroToOne/skills/ui-ux-pro-max-skill-main/.claude/skills/ui-ux-pro-max
python3 scripts/search.py "<keywords>" --domain ux|color|style|typography|chart -n 8
```
It informed the paper direction (E-Ink/Paper + Anti-Polish/Raw), the typography
stack, and most of [ux-rules.md](../design/ux-rules.md). Apply judgment — it
returns mobile-app results for a web query and vice versa.

**The output goes into [design/](../design/), not straight into code.** A search
result is an input to the system, not a decision.

### `ponytail` — on every coding task
```
/Users/lilithfactor/ZeroToOne/skills/ponytail
```
The correcting force on a project whose brief is "interactive 3D portfolio",
which is a brief that attracts complexity. It already removed a token generator,
a pathfinding library, a UI framework, and a three-tier release-note system from
this design. Ask its question first: **does this need to exist at all?**

Note the honest tension with the directive at the top of this file: "the best
long-term step" and "the laziest thing that works" usually agree, and when they
disagree, *the long-term step wins* — but it has to justify itself first.

### `oil-motion` — the figure only
```
/Users/lilithfactor/Ext-Dev/oil-motion  (SKILL.md + references/)
```
Phase 3. Alpha WebP sprite sheets, not chroma video — the figure is small, 2D,
and frequently seeked, which is exactly the case its delivery guidance routes to
sprite sheets. **Lock key frames before generating video**, every time.

## Commits

- **Subjects become the release notes.** Write them for a reader.
- **The prefix drives grouping:** `Add…`/`feat…` → Features, `Fix…` → Fixes,
  anything else → Changes. See [releases.md](releases.md).
- End with the `Co-Authored-By: Claude…` trailer.
- Content syncs commit as `Sync content from Notion` and are filtered out of the
  release notes — otherwise every half-hour cron would publish a release.

## Branches & PRs

Non-trivial work happens on a branch off `main`.

1. `git checkout main && git pull && git checkout -b feat/<short-name>`
   (`feat/` for features, `fix/` for fixes, `design/` for visual work).
2. Build it. Commit as you go. Push the branch.
3. **Verify on the branch** — the checklist in [steps.md](steps.md). Nothing
   merges unverified.
4. `gh pr create`. The description says what changed and **how it was verified**.
5. Merge → `main` deploys.

**A PR is done when: it is verified, the brain docs are updated, and the
performance and accessibility gates pass.** That is the whole requirement — there
is no version to bump and no release note to hand-write. Both of those existed in
the previous version of this file because the app had store binaries. This
doesn't.

> **Hotfix exception:** a typo or docs-only fix may go straight to `main`.
> Anything touching the site's code goes through a branch.

## Keep these current

Stale docs are worse than no docs, because they get quoted.

| Doc | Update when |
|---|---|
| [todo.md](../vision/todo.md) | Every session that finishes or starts a task |
| [content-model.md](../content/content-model.md) | A Notion property is added, renamed, or removed |
| [design-system.md](../design/design-system.md) | A token changes — **before** the CSS, not after |
| [learning.md](learning.md) | Anything surprising is learned the hard way |
| [vision.md](../vision/vision.md) | A new idea arrives (Inbox) or a phase closes |
