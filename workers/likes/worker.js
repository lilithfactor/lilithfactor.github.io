/**
 * THE LIKE COUNTER — the only thing in this project that talks to Notion at
 * runtime, and the only thing that holds the token.
 *
 * WHY THIS EXISTS AT ALL. The brief was "put the count in Notion", and the
 * browser cannot do that. api.notion.com sends no CORS headers — not on the
 * preflight, not on the request — so a fetch from the page fails before any
 * token is even considered. And a Notion token is a WORKSPACE key: shipped in
 * client JavaScript it is readable by anyone who opens the network tab, with
 * write access to everything the integration can see. The build-time sync
 * (scripts/sync-notion.mjs) runs on a half-hour cron, so it cannot serve a live
 * number either. A small server-side proxy is not one option among several; it
 * is the only shape this can take.
 *
 * KV IS THE TRUTH, NOTION IS THE DASHBOARD. Every like is a KV read and write —
 * instant, and close to the visitor. Notion is written to on a debounce, so
 * Pranav's page shows the total without the API being hit once per click. If
 * Notion is down, or the token is wrong, or nobody has set one: the counter
 * still works and the site never knows.
 *
 * IT IS A PUBLIC WRITE ENDPOINT and it is treated as one. One like per IP per
 * day, enforced here where a visitor cannot reach it; the browser's localStorage
 * flag is a courtesy so the button can say "liked", not a defence. The body is
 * never read, so there is nothing in it to trust. Every number that comes back
 * out of KV is validated before it is used, because KV holds whatever was last
 * written to it and "whatever was last written" is not a type.
 *
 * Modules syntax, no build step: this file is what runs.
 */

/** Pinned, exactly as the sync script pins it. Bumping it is a decision. */
const NOTION_VERSION = "2022-06-28";
/** The key the running total lives under. */
const COUNT = "count";
/** When Notion was last told, and what it was told. */
const SYNC_AT = "notion:at";
const SYNC_COUNT = "notion:count";
/** Write to Notion after this many likes... */
const SYNC_EVERY = 5;
/** ...or after this long, whichever comes first. One minute. */
const SYNC_MS = 60_000;
/** Nothing sane is ever above this. A ceiling on what KV can hand back. */
const MAX = 1_000_000_000;

/** A stored value, or 0. KV returns strings, and strings lie. */
function toCount(raw) {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= MAX ? Math.floor(n) : 0;
}

/**
 * The site's origin, and only the site's origin.
 *
 * A wildcard would let any page on the internet spend this endpoint's rate
 * limit on a visitor's behalf. ALLOW_ORIGIN is set in wrangler.toml; a request
 * from anywhere else gets no CORS headers back and the browser refuses it.
 * Several origins are allowed, comma-separated, so a preview deploy can be
 * added without editing this file.
 */
function cors(request, env) {
  const allowed = String(env.ALLOW_ORIGIN || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = request.headers.get("Origin") || "";
  const ok = allowed.includes(origin);
  return {
    ok,
    headers: {
      "Content-Type": "application/json",
      // Vary, or a CDN caches one visitor's allowed origin for everyone else's.
      Vary: "Origin",
      ...(ok
        ? {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Max-Age": "86400",
          }
        : {}),
    },
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), { status, headers });
}

/**
 * Tells Notion the total, if it is time to.
 *
 * Runs in `waitUntil`, so the visitor's response has already gone out: Notion
 * being slow is not the visitor's problem, and Notion being down is nobody's.
 * Every failure is swallowed on purpose — the dashboard is a convenience and
 * the counter is the product.
 *
 * The property shape matches what sync-notion.mjs reads elsewhere: a `number`
 * property, patched on a page.
 */
async function pushToNotion(env, count) {
  const token = env.NOTION_TOKEN;
  const page = env.NOTION_PAGE_ID;
  if (!token || !page) return;

  const property = env.NOTION_PROPERTY || "Likes";
  const at = Number(await env.LIKES.get(SYNC_AT)) || 0;
  const told = toCount(await env.LIKES.get(SYNC_COUNT));
  const due = count - told >= SYNC_EVERY || Date.now() - at >= SYNC_MS;
  if (!due) return;

  // Written BEFORE the request, not after. If the request hangs or the Worker
  // is cut off mid-flight, the worst case is one skipped update; writing after
  // would mean a failing Notion retried on every single like.
  await env.LIKES.put(SYNC_AT, String(Date.now()));
  await env.LIKES.put(SYNC_COUNT, String(count));

  try {
    await fetch(`https://api.notion.com/v1/pages/${page}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ properties: { [property]: { number: count } } }),
    });
  } catch {
    /* The dashboard is late. The count is not wrong. */
  }
}

export default {
  async fetch(request, env, ctx) {
    const { ok, headers } = cors(request, env);

    // The preflight. Answered whether or not the origin is allowed — a 403
    // here and a missing header there look the same to a browser, and the
    // second one is cheaper.
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (!ok) return json({ error: "origin" }, 403, headers);

    // One path. A counter has no routes, and anything else is somebody probing.
    const { pathname } = new URL(request.url);
    if (pathname !== "/") return json({ error: "not found" }, 404, headers);

    if (request.method === "GET") {
      return json({ count: toCount(await env.LIKES.get(COUNT)) }, 200, headers);
    }

    if (request.method !== "POST") return json({ error: "method" }, 405, headers);

    /* --- The rate limit ---------------------------------------------------
     * One like per address per day. Cloudflare sets CF-Connecting-IP itself
     * and it cannot be spoofed by a header in the request, which is the whole
     * reason it is the thing being counted. No address is stored: the key is
     * the address and the value is nothing, and the entry deletes itself after
     * a day because KV was told to expire it.
     *
     * An address the edge somehow did not give us is treated as one shared
     * visitor rather than waved through — a missing IP is the interesting case,
     * not the boring one. */
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const day = new Date().toISOString().slice(0, 10);
    const seen = `ip:${day}:${ip}`;
    if (await env.LIKES.get(seen)) {
      // 409, with the real total. Being told "you already have" and also being
      // told the truth is better than being told nothing.
      return json(
        { count: toCount(await env.LIKES.get(COUNT)), already: true },
        409,
        headers,
      );
    }
    await env.LIKES.put(seen, "1", { expirationTtl: 86_400 });

    /* KV IS EVENTUALLY CONSISTENT, and this read-add-write can therefore lose
     * a simultaneous like. That is a known and accepted cost: the rate limit
     * means one address can only ever race itself, the number is a tally on a
     * portfolio rather than a ledger, and the alternative (a Durable Object)
     * is a stateful class and a migration to run for a number nobody audits.
     * If this ever needs to be exact, that is the change to make. */
    const count = Math.min(MAX, toCount(await env.LIKES.get(COUNT)) + 1);
    await env.LIKES.put(COUNT, String(count));

    // After the response, never in front of it.
    ctx.waitUntil(pushToNotion(env, count));

    return json({ count }, 200, headers);
  },
};
