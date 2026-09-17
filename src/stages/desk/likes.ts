/* ============================================================================
 * THE LIKES — one number, held somewhere that is not this browser.
 *
 * The second runtime fetch in this project, and it earns its place the same way
 * weather.ts does: it is not content. Nothing here is written, reviewed or
 * crawled; it is a tally that changes between two people loading the page, and
 * baking it at build time would mean a deploy per click.
 *
 * WHY THERE IS A PROXY IN FRONT OF NOTION, and why the browser does not just
 * call Notion itself. Two reasons, both fatal on their own:
 *
 *   1. api.notion.com sends no CORS headers at all — not on the preflight and
 *      not on the request. A browser cannot reach it with any token.
 *   2. A Notion token is a WORKSPACE key. Put one in client JavaScript and it
 *      is in the bundle, readable by anyone, with write access to everything
 *      Pranav has ever shared with the integration. A "public write count" is
 *      not worth handing out the keys to the CMS.
 *
 * So a small Worker holds the token, is the only thing that talks to Notion,
 * and the site talks to the Worker. See workers/likes/. The build-time sync
 * (scripts/sync-notion.mjs) runs on a half-hour cron and could never serve a
 * live number anyway.
 *
 * Be clear about the trade, because it is a real one. This posts to an endpoint
 * that sees the visitor's IP — which is how it rate-limits, and is the whole
 * reason a public write endpoint is survivable. Nothing else is sent: no body,
 * no identifier, no cookie. Nothing is stored in this browser but a count and a
 * flag saying this visitor has already clicked.
 *
 * AND IT WORKS WITH NO ENDPOINT AT ALL. Same discipline as the weather: the
 * desk never waits on this and never breaks without it. With PUBLIC_LIKES_-
 * ENDPOINT unset — which is the state today — the count lives in localStorage
 * and the plant grows for that visitor alone. The moment the variable is set,
 * the same two functions return the shared number instead. Nothing else in the
 * scene knows the difference.
 * ========================================================================== */

/**
 * The Worker's URL, injected at build time. Astro exposes PUBLIC_ variables to
 * the client; anything without that prefix stays on the server, which is
 * exactly where a Notion token belongs.
 *
 * Empty string when unset, which is the local-only mode below.
 */
const ENDPOINT = String(import.meta.env.PUBLIC_LIKES_ENDPOINT ?? "").trim();

/** The count, for this browser only, when there is no endpoint to ask. */
const LOCAL_COUNT = "desk-likes-local";
/**
 * COURTESY, NOT SECURITY. This stops an enthusiastic visitor clicking twenty
 * times; it stops nothing else, because anything in localStorage can be cleared
 * from the console in one line. The real limit is one like per IP per day,
 * enforced in the Worker where a visitor cannot reach it. This flag exists so
 * the button can say "liked" and stop firing, which is a UI state and not a
 * defence.
 */
const LIKED = "desk-liked";
/** Session cache, exactly as weather.ts keeps one: a tally is not per-frame. */
const CACHE = "desk-likes";
const MAX_AGE = 60 * 1000;
/** The desk never waits on this. If the answer is slow, it is not an answer. */
const DEADLINE = 4000;

/** A count is a whole, non-negative, believable number or it is nothing. */
function sane(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1e9) return null;
  return Math.floor(n);
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // Private mode, or storage disabled entirely.
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Private mode. The count is still right for this page view. */
  }
}

/** Has this visitor already clicked? Read by the button to paint itself. */
export function hasLiked(): boolean {
  return read(LIKED) === "1";
}

function localCount(): number {
  return sane(read(LOCAL_COUNT)) ?? 0;
}

function cached(): number | null {
  try {
    const raw = sessionStorage.getItem(CACHE);
    if (!raw) return null;
    const { at, value } = JSON.parse(raw) as { at: number; value: number };
    return Date.now() - at < MAX_AGE ? (sane(value) ?? null) : null;
  } catch {
    return null;
  }
}

function remember(count: number): number {
  try {
    sessionStorage.setItem(CACHE, JSON.stringify({ at: Date.now(), value: count }));
  } catch {
    /* Private mode, or a full quota. */
  }
  return count;
}

/**
 * One request, with a deadline, that always resolves to a number or null.
 *
 * The 409 a second like from the same address earns is NOT an error: the body
 * still carries the true count, and showing the visitor the real total after
 * they have been turned away is better than showing them nothing.
 */
async function ask(method: "GET" | "POST"): Promise<number | null> {
  if (!ENDPOINT) return null;
  const request = fetch(ENDPOINT, { method, mode: "cors", cache: "no-store" })
    .then(async (r) => {
      // 5xx is the server having a bad day; 429/409 still answer the question.
      if (r.status >= 500) return null;
      const data = (await r.json()) as { count?: unknown };
      return sane(data?.count);
    })
    .catch(() => null);

  return Promise.race([
    request,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), DEADLINE)),
  ]);
}

/**
 * The total. Never throws, never hangs, never leaves the plant without a size.
 *
 * With an endpoint: the shared number, session-cached. Without one, or when the
 * request fails: this browser's own tally, so the plant still has a stage and
 * nothing on screen looks broken.
 */
export async function likeCount(): Promise<number> {
  const hit = cached();
  if (hit !== null) return hit;
  const live = await ask("GET");
  return live === null ? localCount() : remember(live);
}

/**
 * Adds one and returns the new total.
 *
 * The local flag is set whatever happens, including on a failed request. A
 * visitor who clicked and got a network error has still clicked, and offering
 * them the button again would only produce a second failure.
 */
export async function like(): Promise<number> {
  const live = await ask("POST");
  write(LIKED, "1");
  if (live !== null) return remember(live);
  const next = localCount() + 1;
  write(LOCAL_COUNT, String(next));
  remember(next);
  return next;
}
