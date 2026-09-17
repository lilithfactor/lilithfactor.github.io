# The like counter

The plant on the window sill grows when people like the page. This is the small
server that holds the number.

**The site works without it.** With no endpoint configured — which is how it
ships today — the count lives in each visitor's own browser and the plant grows
for them alone. Everything below is what turns that into one shared number.

## Why a server at all

The number was supposed to live in Notion, and a browser cannot put it there.

- `api.notion.com` sends **no CORS headers**. A `fetch` from the page fails
  before the token is even looked at. There is no flag, header or proxy trick
  that changes this from the browser side.
- A Notion token is a **workspace key**. In client JavaScript it is in the
  bundle, readable by anyone, with write access to everything the integration
  can see. A public like button is not worth handing out the keys to the CMS.
- The build-time sync (`scripts/sync-notion.mjs`) runs on a half-hour cron, so
  it can never serve a live number.

So: this Worker holds the token, is the only thing that talks to Notion, and the
site talks to this Worker. Cloudflare's free tier covers 100,000 requests a day,
which is more than a portfolio will ever see.

## What it does

| Request                                | Answer                                         |
| -------------------------------------- | ---------------------------------------------- |
| `GET /`                                | `{ "count": 142 }`                             |
| `POST /`                               | adds one, returns `{ "count": 143 }`           |
| `POST /` again, same address, same day | `409` with `{ "count": 143, "already": true }` |

The count lives in Cloudflare KV, which is what makes it instant. Notion is
written to on a debounce — every 5 likes, or once a minute, whichever comes
first — so the Notion page shows the total without the API being hit once per
click. If Notion is down the counter carries on and nobody notices.

One like per IP address per day. No address is stored: the address is the key,
the value is nothing, and the entry deletes itself after 24 hours.

---

## Deploying it

You need a Cloudflare account (free) and Node 22. Everything below is typed in
this directory.

```sh
cd workers/likes
```

### 1. Log in

```sh
npx wrangler login
```

This opens a browser and asks you to authorise Wrangler. It is a one-off.

### 2. Make the store the number lives in

```sh
npx wrangler kv namespace create LIKES
```

It prints something like:

```
[[kv_namespaces]]
binding = "LIKES"
id = "8f2c91a0e4b34f5d9c7a1e6b0d3f8a52"
```

Copy that `id` into `wrangler.toml`, replacing `PUT_YOUR_KV_NAMESPACE_ID_HERE`.

### 3. Deploy

```sh
npx wrangler deploy
```

It prints the URL it deployed to, e.g.
`https://desk-likes.<your-subdomain>.workers.dev`. **Keep that URL** — step 5
needs it.

Check it works:

```sh
curl https://desk-likes.<your-subdomain>.workers.dev
# {"count":0}
```

### 4. Give it the two secrets

A secret is stored by Cloudflare and never written to a file in this repo.
Each command below prompts for a value and does not echo it.

```sh
npx wrangler secret put NOTION_TOKEN
npx wrangler secret put NOTION_PAGE_ID
```

- **`NOTION_TOKEN`** — the integration token, starting with `ntn_`. The same one
  `.env` uses for the content sync. It needs **write** access for this, which
  read-only sync does not: in Notion, open the page → `⋯` → _Connections_ → add
  the integration.
- **`NOTION_PAGE_ID`** — the id of the Notion page that shows the total. Open
  the page, copy the URL, and take the 32 hex characters at the end of it:
  `notion.so/Likes-292e0b98133d4a5dba4202cae942aa2f` → the id is
  `292e0b98133d4a5dba4202cae942aa2f`. Dashes in it are fine either way.

That page needs a **number property**. Its name must match `NOTION_PROPERTY` in
`wrangler.toml`, which is `Likes` by default. If the property is called
something else, change the toml, not the code.

Then redeploy so the Worker picks the secrets up:

```sh
npx wrangler deploy
```

### 5. Point the site at it

Two lines, one of them for your machine and one for the live build.

**Locally** — add to `.env` in the repo root:

```
PUBLIC_LIKES_ENDPOINT=https://desk-likes.<your-subdomain>.workers.dev
```

**Live** — the same variable, set wherever the site is built. On Cloudflare
Pages: _Settings → Environment variables → Add_, name `PUBLIC_LIKES_ENDPOINT`,
value the same URL. On GitHub Actions: add it to the `env:` block of the build
step. It must be present **at build time** — Astro bakes `PUBLIC_` variables
into the bundle, so setting it afterwards changes nothing until the next build.

Rebuild, and the plant is counting everybody's likes instead of each visitor's
own.

---

## Changing it later

- **A different origin** (a custom domain, a preview deploy): edit
  `ALLOW_ORIGIN` in `wrangler.toml` — comma-separated for more than one — then
  `npx wrangler deploy`. A request from anywhere else is refused, which is the
  point: a wildcard would let any page on the internet spend a visitor's one
  like a day.
- **See what it is holding**: `npx wrangler kv key get --binding LIKES count`
- **Set it by hand**: `npx wrangler kv key put --binding LIKES count 500`
- **Watch it live**: `npx wrangler tail`

## What is deliberately not here

- **No exactness.** Two likes landing in the same instant from two different
  addresses can count as one, because KV is eventually consistent. For a tally
  on a portfolio that is a fair trade against a Durable Object, a stateful class
  and a migration. If it ever has to be exact, that is the change to make.
- **No identity.** No cookie, no fingerprint, no body is read from the request.
  The address is used for the day's rate limit and is never stored.
