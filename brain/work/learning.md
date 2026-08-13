# Learnings

**The bar for this doc:** an entry earns its place only if *not* knowing it would
cost real time or a wrong decision later. No trivia, no diary, no "TIL". If it
wouldn't change what a future session does, it doesn't go in. Newest first.

*(This absorbed `eng/context.md` on 2026-08-13 — one learnings doc, not two.)*

---

## The token colour and the rendered colour are not the same colour

*2026-08-13, Phase 2.*

`--desk: #3B3229` is correct as a flat CSS ground and renders as **near-black**
in a lit 3D scene: a renderer multiplies the base colour by its own light
falloff, so an already-dark token lands two stops lower than it reads in a
swatch. The first desk photographed as a black rectangle with the lights at
sane intensities — the instinct is to keep raising the lights, which only
washes out the paper.

Same shape, opposite direction, for shadows: `--e-open` is tuned for
paper-on-paper and is **invisible** against walnut, so the content column read
as a hard-edged slab pasted over the scene rather than a sheet resting on it.

**Rule:** a design token is a colour *in its intended context*. Crossing into a
renderer — or onto a much darker ground — needs a stage-specific value derived
from the token, not the token itself. `--stage-desk` is the lit walnut;
`--desk` became `--stage-desk-deep`, its own shadow.

## Verify the verifier before believing it — a night of false alarms

*2026-08-13, Phase 0 visual verification.*

Every alarming signal during the paper-primitive verification came from the
**measurement harness, not the site**. Four traps, each of which looked exactly
like a product bug:

1. **Headless Chrome (`--headless=new`, macOS) enforces a ~500px minimum window
   width.** Asking for `--window-size=390` renders at 500 CSS px and writes a
   PNG canvas sized for 390 — so the right ~110px of the page are **cropped out
   of the screenshot**. Text touching the PNG edge looked like clipped overflow;
   it was rendered fine, outside the crop. *Mobile screenshots below 500px wide
   from headless Chrome are unusable evidence on this machine.* Render the page
   in a **width-controlled iframe** inside a wide window instead, and measure
   `scrollWidth` + per-element `getBoundingClientRect().right` — that probe gives
   true-width data and names the guilty element.
2. **`cd dir && python3 -m http.server & … kill $!` kills the subshell, not the
   server.** The orphaned server keeps serving stale directory roots across
   later commands, so screenshots can capture a *previous* build. Use
   `python3 -m http.server --directory <abs-path>` (no `cd`, no compound) and
   `Popen`/`terminate` from one process.
3. **`grep` and `find` in this shell are functions** (from the zsh snapshot —
   ugrep etc.), and their output format/semantics differ from the real tools.
   For filesystem *truth*, use `python3 -c "import os; …"` or `/bin/ls` —
   during the incident, shell tools reported `dist/` missing while Python and
   VS Code both saw it.
4. **A `scrollWidth` overflow probe is blinded by `overflow-x: clip`** on the
   scrolling element. The old body clip made the broken layout pass the probe.
   Removing the clip (fixing overflow at the element, never masking it at the
   body) is what made the probe trustworthy evidence at all.

The general rule, and the reason this entry exists: **when evidence
contradicts itself, audit the measurement chain before touching the code.**
The one real layout bug of the night (a 44px clamp floor + an unbreakable
`&nbsp;` name overflowing true-390px) was found by *reasoning about the CSS*,
not by the screenshots — the screenshots produced only false positives.

*(One loose end, recorded honestly: for a ~15-minute window, `astro build`
wrote its output to the repo root and `dist/` was invisible to shell tools
while Python could see it. Root artifacts were cleaned up; subsequent builds
behave correctly and deterministically — verified twice with pre-existing and
absent `dist`. Mechanism unconfirmed; likely orphan-server cwd + sandbox
interaction. If dist ever "vanishes" again: check with Python before
re-diagnosing the build.)*

---


## Notion's public API works without a token — and is the wrong primary path

*2026-08-12, during the content research for this project.*

`POST https://lilithfactor.notion.site/api/v3/loadPageChunk` and
`/api/v3/queryCollection` return the **complete** page and database contents for
a publicly-shared Notion page, with no authentication at all. That is how
[content-model.md](../content/content-model.md) was written — all six databases,
56 rows, every property and every value, reverse-engineered from the live site
rather than guessed.

Worth knowing, because it makes it tempting. It is still the wrong choice for the
build:

- **Undocumented and unversioned.** Notion can change or close it without notice,
  and there is no deprecation window for something that was never announced.
- **CORS-blocked**, so the browser cannot call it anyway — it only works
  server-side, which removes the one advantage a token-free endpoint would have.
- The response is Notion's *internal* record map: `recordMap.block[id].value.value`,
  with properties keyed by opaque four-character column ids that only make sense
  next to the collection's `schema`. Parsing it is real work, and that work
  breaks when the shape shifts.

**Use the official API with an integration token.** Keep this endpoint as the
emergency fallback if the token ever lapses, and as the reason nobody needs to
ask "what fields does the Notion page have" ever again.

The request shape, since it is nowhere on the internet in one piece:

```jsonc
// POST /api/v3/queryCollection?src=initial_load
{
  "source":         { "type": "collection", "id": "<collection-id>", "spaceId": "<space-id>" },
  "collectionView": { "id": "<view-id>", "spaceId": "<space-id>" },
  "loader": {
    "type": "reducer",
    "reducers": { "collection_group_results": { "type": "results", "limit": 100 } },
    "searchQuery": "", "sort": [], "userTimeZone": "Asia/Kolkata"
  }
}
```

Collection and view ids come from the `collection_view` blocks in the
`loadPageChunk` response for the page.

---

## `collection_id` ≠ `database_id` — and the difference looks like a 404

*2026-08-12, first attempt at verifying API access.*

The two Notion APIs use **different ids for the same database**, and the failure
mode is actively misleading.

- The unofficial `/api/v3` endpoint returns a **`collection_id`**
  (Case Studies: `…81a3-b479-000b81c7575c`).
- `api.notion.com` wants the **`child_database` block id**
  (Case Studies: `…81d4-84fc-ed24828d353a`).

Both are 32-hex UUIDs of identical shape. Passing the collection id to
`GET /v1/databases/{id}` returns:

```
404 object_not_found — Make sure the relevant pages and databases are shared
with your integration
```

That message names a permissions problem, so the obvious next move is to go
re-share pages that were already shared. Half an hour disappeared into that here,
and it was made more plausible by a true-but-irrelevant fact: the databases *are*
surfaced through synced blocks from a separate "Portfolio WareHouse" page, which
made a permissions-inheritance theory look right.

**Get the ids from the official API, never from the unofficial one:**

```bash
GET /v1/blocks/{page_id}/children     # recurse; look for type == "child_database"
```

`child_database.title` gives the name and `id` gives the usable database id. The
walk has to recurse through `synced_block`, `callout`, `column_list`, and
`column` — on this page the databases sit three levels down.

Correct ids are in [content-model.md](../content/content-model.md), and
`scripts/check-notion-access.mjs` verifies all seven in one command. Run it before
believing any theory about Notion permissions.

**The generalisable lesson:** when an error message names a cause, check that the
*inputs* are right before acting on it. A 404 that says "check your permissions"
is still, first and foremost, a 404 — the object wasn't found, and "you passed the
wrong id" is the cheaper hypothesis to eliminate.

---

## Notion asset URLs expire in about an hour

Every image, cover, and icon comes back as an S3 URL signed with a short TTL.
Hot-linking one gives you a portfolio whose images all work during development
and are all broken by the next morning — the worst possible failure shape,
because it passes every check you run at the time.

**The sync downloads every asset into `public/` and rewrites the path.** This is
in [content-model.md](../content/content-model.md) as a rule; it is here as the
reason.

---

## `brain/` was another project's brain

*2026-08-12.*

Every doc under `brain/` — vision, todo, workflow, steps, releases — was a
verbatim copy of the Muretabi mobile-app repo: EAS build channels, Supabase
migrations, `expo-updates` runtime versions, five Vercel projects, Play Console
release notes. All of it confidently written, none of it true here.

It is worth recording as a failure mode rather than a one-off tidy-up: **copied
context is more dangerous than missing context.** Missing docs make you go and
look. Docs that describe a different system make you act on them — they read as
authoritative, they are internally consistent, and the first sign they are wrong
is a command that does nothing or, worse, a decision made on a constraint that
does not exist.

The rewrite headers on each file (`> *Rebuilt 2026-08-12*`) are deliberate: if
one of these docs ever gets copied into a third project, the header says out loud
where it came from.
