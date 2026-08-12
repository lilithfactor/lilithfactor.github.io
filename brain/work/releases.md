# Releases

> *Rebuilt 2026-08-12.* The previous version described a three-tier release-note
> system: an auto-generated GitHub Release, hand-written per-version engineer
> notes in `brain/releases/`, and user-facing Play Store "What's new" copy. That
> existed because the app had store binaries that users installed and could get
> stuck on old versions of.
>
> **A website has one version: the one that is live.** Two of those three tiers
> were solving a problem this project does not have, so they are gone. What
> follows is all of it.

Every push to `main` auto-publishes a **GitHub Release** with notes grouped into
**Features / Fixes / Changes**. Read them in the repo's Releases tab.

## How it works

- **Workflow:** `.github/workflows/release-notes.yml`, on push to `main`.
- **Grouping:** heuristic on the commit subject — starts with `Add`/`feat` →
  **Features**, `Fix` → **Fixes**, everything else → **Changes**.
- **Tag:** `v<version>-build.<run#>`, version from `package.json`, pinned to the
  pushed commit. Tags don't re-trigger the workflow, so there is no loop.
- **Range:** commits since the previous release tag. Merge commits excluded.
- **Content syncs are excluded.** Commits subjected `Sync content from Notion`
  are filtered out — the cron runs every thirty minutes, and without the filter
  the Releases tab would be nothing but content syncs and the actual code history
  would be invisible inside it.

No secrets and no setup — it uses the built-in `GITHUB_TOKEN`.

## Keeping the notes good

**Commit subjects are the notes.** There is no second place to write a nicer
version, which is the reason this system works at all: one thing to write, and
writing it badly is immediately visible in public.

- Start with **`Add`** for a feature, **`Fix`** for a fix. Anything else lands in
  **Changes**, which is correct for refactors, copy, and docs.
- Write for someone who wasn't there. `Fix sheet overflow on 320px viewports`
  beats `fix css`.
- Each line carries its short SHA, so a release maps directly to a diff.

## What `version` in `package.json` means here

It is a **marker, not a mechanism.** Nothing installs it, nothing pins to it, and
no visitor ever sees it. It exists so the release tags sort sensibly.

Bump it when a phase closes — `0.1.0` at the end of Phase 1, `0.2.0` after the
desk lands, `1.0.0` at public launch. Don't bump it per PR; there is nothing for
it to protect.
