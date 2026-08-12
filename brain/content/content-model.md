# Content model — Notion → JSON

**Notion is the dashboard.** You edit the page you already have; the site follows.
Nothing about your editing habit changes: open Notion on the phone or the laptop,
change a word, done.

This doc is the contract between what you type in Notion and what the site can
render. It was written by reading your **live** page on 2026-08-12, not by
guessing — every field and every count below is real.

- Page: `292e0b98-133d-4a5d-ba42-02cae942aa2f` — "Pranav Upadhyay"
- Warehouse: `2f2be508-b291-8043-b9a1-e17593459950` — "Portfolio WareHouse", where
  the databases are authored. The portfolio page surfaces them through **synced
  blocks**.
- Space: `88dc8829-932d-44ef-b120-43833ba633d1`
- Public URL: https://lilithfactor.notion.site/pranav-upadhyay

> **The database ids below are `child_database` block ids** — the ones
> `api.notion.com` accepts. They are **not** the `collection_id` values the
> unofficial `/api/v3` endpoint returns for the same databases. The two id spaces
> look identical and are not interchangeable; using the wrong one produces a
> `404 object_not_found` that reads exactly like a permissions error. See
> [learning.md](../work/learning.md). Verify any time with:
>
> ```bash
> node --env-file=.env scripts/check-notion-access.mjs
> ```
>
> **Verified all seven reachable on 2026-08-12.**

## The publish switch

Four of the six databases already carry a **`Visibility`** property, and every
live row is set to `Highlight`.

> **Rule: `Visibility` must equal `Highlight` for a row to appear on the site.**

That gives you drafts for free. Write a case study in Notion, leave `Visibility`
blank, and it stays invisible until you flip it. Nothing else gates content, so
this one field is the difference between "thinking about it" and "published".

Two databases (**Library**, **Beyond the Routine**) have no `Visibility` field.
They publish everything, which is correct for both — a bookshelf with hidden books
is just a shorter bookshelf. If you ever want drafts there, add the property and
the sync picks it up.

## The databases

Six exist today. A seventh — **Playlist** — needs creating; see the end of this
section.

### 1. Case Studies — `2e4be508-b291-81d4-84fc-ed24828d353a`
The spine of the portfolio. **5 rows live.**

| Notion property | Type | → JSON | Notes |
|---|---|---|---|
| `Name` | title | `name` | Lead with the outcome. Yours already do — "25% Faster Time-to-market" beats "3D Pipeline Project". |
| `Description` | rich text | `summary` | 1–2 sentences. Rendered on the folder tab. |
| `Type` | select | `type` | New Feature · UX · Optimization · New Product |
| `Role` | select | `role` | Product Manager |
| `Domain` | multi-select | `domain[]` | B2B, SaaS, AR, XR |
| `KPIs` | multi-select | `kpis[]` | Conversion, Engagement, Revenue, Efficiency, Time-to-market, Acquisition, Satisfaction, Usability |
| `Association` | select | `association` | Org / Personal |
| `Link` | rich text (URLs) | `links[]` | Comma-separated today; the sync splits them. |
| *(page body)* | blocks | `body[]` | **Phase 2.** See "The body problem" below. |

Live rows: Visual Compare for Mass-Market Buyers · 60% Faster Onboarding, Halved
Bounce · 25% Faster Time-to-market · Configurator: Visualize, Customize, Compare,
Purchase · Brand-led agent: Expert Guidance, Instant.

### 2. Product Dives — `2e4be508-b291-81f3-abfc-f53abee5d76d`
Teardowns and speculative redesigns — the "I think in products even when nobody
asked me to" evidence. **7 rows live.**

| Notion property | Type | → JSON | Notes |
|---|---|---|---|
| `Name` | title | `name` | |
| `Description` | rich text | `summary` | |
| `URL` | url | `url` | Several are live demos — those get a "visit" affordance. |
| `Product Type` | multi-select | `productType[]` | Web, App, AI Productivity Suite, Cataloging, Content Creation |
| `Section Category` | multi-select | `category[]` | **Design · Analysis · Landscaping.** This splits the section into two tabs: things you *made* (Design) and things you *studied* (Analysis/Landscaping). Keep it accurate — it is doing real IA work. |
| `GTM Model` | multi-select | `gtm[]` | B2C, B2B, Internal, SaaS |
| `Date` | date | `date` | Sort key, newest first. |
| `Pricing` | rich text | `pricing` | Sparse. Optional. |

### 3. Projects — `320be508-b291-80ab-ab61-ca40957a2ff2`
Shipped things you built yourself. **5 rows live.**

| Notion property | Type | → JSON | Notes |
|---|---|---|---|
| `Name` | title | `name` | |
| `Description` | rich text | `summary` | |
| `Product Type` | select | `productType` | App, Web, Extension, AI Productivity Suite, Cataloging |
| `Links` | rich text (URLs) | `links[]` | Store + site + repo. Sync splits and labels by host (Play Store / GitHub / live). |
| `KPIs` | multi-select | `kpis[]` | |

Live rows: Muretabi · Slimly · Applifai · Local RAG Pipeline · Answers to
"Where should we go?".

### 4. Recommendations — `2f7be508-b291-801f-a804-c8ecf3078783`
**2 rows live.**

| Notion property | Type | → JSON |
|---|---|---|
| `Name` | title | `name` |
| `Role` | rich text | `role` |
| `Org` | rich text | `org` |
| `Testimony Content` | rich text | `quote` |

Ashish Dasari (Engineering Manager, Metadome.ai) · Neeti Kejriwal (Founder, Shuru).

> **Add a `Photo` (files) and `LinkedIn` (url) property when you get a chance.** A
> testimonial with a face and a verifiable link is worth several without. This is
> the single highest-leverage content addition available right now — see
> [todo.md](../vision/todo.md).

### 5. Library — `2e4be508-b291-81b5-b7b4-d15d62af9a69`
**37 rows.** The bookshelf.

| Notion property | Type | → JSON | Notes |
|---|---|---|---|
| `Name` | title | `name` | |
| `Author` | rich text | `author` | Missing on 3 rows (Thinking Fast and Slow, Steal Like an Artist, Hooked). |
| `Domain` | multi-select | `domain[]` | Product & Business · Psychology & Communication · Frameworks and Logic · Leadership & Philosophy · Personal Development · History · Society · Biography · Philosophy · Finance |
| `Status` | select | `status` | `done` · `reading` · `enqueued` · `tbd` |
| `Month` / `Year` | select / number | `month`, `year` | Together = when read. |

`Status` drives the shelf: `done` books stand upright, `reading` lies open on the
desk, `enqueued` leans in a to-read pile, `tbd` is a faint outline. One glance
tells a visitor you are 20 books deep and still going — which says more about how
you think than a "skills" bar chart ever will.

### 6. Beyond the Routine — `2e4be508-b291-8114-9a3b-e0c980038895`
**5 rows.** The human section, and the source of the desk's props.

| `Name` | `Desc` | Becomes |
|---|---|---|
| Reading | Communication · Business · Psychology | The bookshelf → opens the Library |
| Music | Pop · Acoustic · Indie | The record player → Spotify |
| Speedcubing | 3x3 · 4x4 · 5x5 · Gear · Pyraminx · Megaminx | A Rubik's cube prop (it turns) |
| Chess | Bullet · Blitz | A small board → chess.com |
| Films and Series | Thriller · Com · Documentaries | A film strip / ticket stub |

### 7. Playlist — *to be created*
The records on the desk's turntable. **Does not exist yet** — create it in Notion
and the sync picks it up.

| Notion property | Type | → JSON | Notes |
|---|---|---|---|
| `Name` | title | `name` | Shown on the sleeve |
| `Mood` | select | `mood` | Your existing three read well as sleeves: Pop · Acoustic · Indie |
| `Audio` | files | `src` | **Downloaded at sync**, like every other Notion asset. Upload Opus or MP3; the sync transcodes to Opus + AAC. |
| `Order` | number | `order` | Sleeve order in the stack |
| `Credit` | rich text | `credit` | Artist + licence. **Required if the track isn't yours** — rendered as attribution. |

**Three sleeves is the target.** Enough to be a choice, few enough that none is
filler. Instrumental only — lyrics compete with reading.

The point of putting this in Notion rather than in `public/`: swapping a track
would otherwise be the one content change that needs a pull request, which breaks
the promise the whole architecture is built on.

## Not in a database

### About
Three paragraphs of rich text in the "About me" callout. Synced to `about.json`
as `{ headline, paragraphs[] }`.

Current copy opens: *"I'm a Product Manager who turns messy, high-stakes journeys
into simple, confident experiences."* — that is a strong line and it stays.

> **One live gap:** paragraph 2 ends `"…and trusted by brands like"` and then
> stops. The brand logos were never added. The sync will surface this as a
> warning, and it is a Phase 1 content task — a sentence that ends mid-clause on
> the hero of a PM's portfolio is the most damaging small thing on the site.

### Links ("Lets Connect 🚀")
Seven Notion buttons, driven by automations. Six resolve to URLs; the seventh is
an email action, which has no URL and must be added to `links.json` by hand.

| Label | URL |
|---|---|
| LinkedIn | https://www.linkedin.com/in/pranav-upadhyay/ |
| GitHub | https://github.com/lilithfactor |
| Instagram | https://www.instagram.com/pra.naive/ |
| Goodreads | https://www.goodreads.com/lilithfactor |
| Chess.com | https://www.chess.com/member/lilithfactor |
| Spotify | https://open.spotify.com/user/%E2%98%A3blurryface |
| Email | *(add manually — the Notion button uses an email action, not a link)* |

## The generated JSON

Written to `content/`, committed, never hand-edited:

```
content/
  about.json            { headline, paragraphs[], brands[] }
  case-studies.json     CaseStudy[]
  product-dives.json    ProductDive[]
  projects.json         Project[]
  recommendations.json  Recommendation[]
  library.json          Book[]
  beyond.json           Interest[]
  links.json            Link[]
  meta.json             { syncedAt, counts, warnings[] }
```

Every record also carries:

- `id` — the Notion block id. Stable across renames, so it is the anchor for
  matching a 3D artifact to its data, and the fallback route key when a `slug`
  collides.
- `slug` — kebab-cased `name`, for readable URLs. Falls back to `id` on collision.
- `order` — the row's position in your Notion view. **Reordering rows in Notion
  reorders the site.** That is a feature: drag a case study to the top and it
  leads.

## Gotchas that will bite

**1. Notion file URLs expire.** Any image, cover, or icon comes back as an S3 URL
signed for about an hour. Hot-linking one produces a portfolio whose images all
break by lunchtime. **The sync downloads every asset into `public/` and rewrites
the path.** Non-negotiable.

**2. `Link` / `Links` are rich text, not URL properties.** You have been putting
several comma-separated URLs in one text field. The sync splits on commas and
validates each. If you ever change these to a proper relation or a URL property,
the sync must change with them — it is the one place the schema is loose.

**3. Row bodies are a second fetch.** Each database row is itself a Notion page
with block children. The row *properties* come from one query; the *body* needs a
`blocks.children.list` per row. That is 56 extra API calls at today's counts —
fine on a 30-minute cron, and the reason bodies are Phase 2 rather than Phase 1.

**4. The body problem.** A case-study body is where a PM actually proves the
craft — problem, insight, what shipped, what moved. Free-form Notion blocks make
that unstructured and unrenderable in a fixed sheet layout.
**Convention over parsing:** each case-study page body uses four H2s, always the
same four, always in this order:

> `## Problem` · `## Insight` · `## What I shipped` · `## Outcome`

The sync maps H2 → section and fails loudly if one is missing. This is worth the
discipline: it makes every case study skimmable in the same shape, which is
exactly what a hiring manager comparing five candidates needs.

**5. The official API needs the page shared with an integration.** Create an
internal integration, put the token in the `NOTION_TOKEN` repo secret, and share
the parent page with it — the six databases inherit access. Without that, the API
returns 404 for pages that are perfectly public in a browser.

*(The public `/api/v3/queryCollection` endpoint needs no token at all and was used
to write this document. It is undocumented, unversioned, and CORS-blocked. Keep it
as the emergency fallback if the token ever lapses — never as the primary path.)*

## Adding a field — the checklist

1. Add the property in Notion.
2. Add it to `types.ts` in [the proxy](../eng/architecture.md#directive-1--the-content-proxy).
3. Map it in `scripts/sync-notion.mjs`.
4. Render it.
5. Update the table in this doc.

Steps 1 and 5 are the ones that get skipped, and skipping 5 is how a doc starts
lying. If the table here disagrees with Notion, the table is wrong.
