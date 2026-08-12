# The ship checklist

> *Rebuilt 2026-08-12.* This file used to be the Muretabi app's eight-step EAS
> release process — channels, runtime versions, local builds, keychain rules,
> Play Console. This project ships a static site to GitHub Pages. Replaced
> wholesale.

**One artifact, one branch, one deploy.** A push to `main` builds and publishes.
Nothing else deploys, and nothing waits for approval.

---

## 1. Branch

```bash
git checkout main && git pull && git checkout -b feat/<short-name>
```

## 2. Build it

Commit as you go — subjects become the release notes.

## 3. Verify — the gates

Nothing merges unverified. These are the gates, in the order they catch things:

```bash
npx tsc --noEmit          # must pass
npm run build             # must pass
npm run preview           # then actually look at it
```

**Then the passes that automation cannot do for you:**

- [ ] **Keyboard only.** Tab through all eight sections, open one, `Escape` out.
      Focus visible at every step.
- [ ] **Reduced motion.** DevTools → Rendering → `prefers-reduced-motion: reduce`.
      You should get a complete experience, not a broken one.
- [ ] **JS disabled.** The content still reads.
- [ ] **A real phone**, on cellular — not a devtools viewport. The devtools
      viewport has your laptop's CPU and your office wifi, which is why it has
      never once predicted how a 3D page feels in a hand.
- [ ] **No horizontal scrollbar** at 320 / 768 / 1024 / 1440px.
- [ ] **Cmd-F finds a word from a case-study body.** This is the one-second proof
      that content is still real text.
- [ ] **Lighthouse** — Performance ≥ 90, Accessibility 100, SEO 100.

**If the PR touched the desk (Phase 2+), one more, and it is the important one:**

```bash
# On a phone, or DevTools Network tab throttled to 4G:
# confirm NO three.js chunk is requested.
```
The entire justification for choosing a full 3D desk over a lighter design is
that mobile never pays for it. A regression here is silent — the site still
works, it is just three megabytes heavier for the visitor who can least afford
it. Check it every time; don't assume the dynamic import still splits.

## 4. Update the docs

[todo.md](../vision/todo.md) always. Then whichever of these the change touched:
[content-model.md](../content/content-model.md),
[design-system.md](../design/design-system.md),
[learning.md](learning.md), [vision.md](../vision/vision.md).

Anything learned the hard way goes in `work/learning.md` **while it still hurts**.
A week later you will remember the fix and not the symptom, and the symptom is
the part that saves the next hour.

## 5. PR → merge

```bash
gh pr create   # description: what changed, and how it was verified
```

Merge when the gates pass. **Merging deploys to everyone, immediately.**

## 6. Verify live

The deploy can go green and the site can still be wrong — a successful static
upload proves the upload worked, not that the page exists.

```bash
curl -s -o /dev/null -w '%{http_code}\n' -L https://lilithfactor.github.io/
curl -s https://lilithfactor.github.io/content/meta.json | head -c 300
```

`meta.json` carries `syncedAt` and the row counts — it is the fastest proof that
the deployed site has the content you think it has.

Then open it. Actually open it.

## 7. If it is wrong

| Shipped | To undo |
|---|---|
| Code | `git revert <sha> && git push` — live in about a minute |
| Content | Fix it in Notion, run the sync workflow. Or `git revert` the sync commit for an instant rollback while you think. |
| A bad deploy | Actions → the last good deploy run → **Re-run jobs** |

There is no database, no migration, no binary in anyone's hands. Everything here
is reversible in one command, which is worth remembering before treating a
mistake as a crisis.

---

## Content-only changes skip all of this

Editing a case study in Notion is **not** a code change. It syncs on the
half-hour cron, or immediately via the webhook, or on demand:

- **From a phone:** GitHub mobile app → Actions → *Sync content* → Run workflow.
- **From a laptop:** `gh workflow run sync-content.yml`

No branch, no PR, no checklist. That is the entire point of the Notion rail — see
[workflow.md](workflow.md#two-rails-and-they-are-independent).
