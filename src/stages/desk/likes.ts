/* ============================================================================
 * THE LIKES — one number, held somewhere that is not this browser.
 *
 * The second runtime fetch in this project, and it earns its place the same way
 * weather.ts does: it is not content. Nothing here is written, reviewed or
 * crawled; it is a tally that changes between two people loading the page, and
 * baking it at build time would mean a deploy per click.
 *
 * THE RELAY IS GONE, and the reason is worth keeping. A Worker used to sit in
 * front of Notion because api.notion.com sends no CORS headers on any request,
 * and because a Notion token is a WORKSPACE key — put one in the bundle and
 * anybody can write to the whole CMS. Supabase is the opposite on both counts:
 * it sends CORS, and its anon key is a role selector rather than a password.
 * Row-level security is the boundary, so the browser can hold the key and talk
 * to Postgres directly. 380 lines of Worker and a second deploy target gone.
 *
 * That is only safe because of what the database is allowed to do, and the
 * answer is short: one row, and one function taking NO ARGUMENTS whose whole
 * body is `likes = likes + 1` under a daily ceiling. No insert, update or
 * delete policy exists and the default grants are revoked, so there is no
 * other write path. docs/likes.md has the SQL, the threat model and the
 * two-statement recovery.
 *
 * THE TRADE, plainly: this posts to Supabase, which — like every host — sees
 * the visitor's IP in its own logs. Nothing identifying is sent by this file
 * and nothing identifying is stored in the table: no body, no identifier, no
 * cookie. This browser keeps a count and a flag saying it has already clicked.
 *
 * AND IT WORKS WITH NO ACCOUNT AT ALL. Same discipline as the weather: the desk
 * never waits on this and never breaks without it. With the two variables unset
 * the count lives in localStorage and the plant grows for that visitor alone.
 * Set them and the same two functions return the shared number. Nothing else in
 * the scene knows the difference.
 * ========================================================================== */

/**
 * Both PUBLIC_ because both belong in the bundle — see .env.example. The one
 * that must never appear here is the SERVICE key, which bypasses every policy.
 */
const BASE = String(import.meta.env.PUBLIC_SUPABASE_URL ?? "")
  .trim()
  .replace(/\/$/, "");
const KEY = String(import.meta.env.PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
const AUTH = { apikey: KEY, Authorization: `Bearer ${KEY}` };

/** The count, for this browser only, when there is no project to ask. */
const LOCAL_COUNT = "desk-likes-local";
/**
 * COURTESY, NOT SECURITY. This stops an enthusiastic visitor clicking twenty
 * times; it stops nothing else, because anything in localStorage can be cleared
 * from the console in one line. The real limit is the daily ceiling inside
 * water_plant(), where a visitor cannot reach it. This flag exists so the
 * button can say "Watered" and stop firing, which is a UI state and not a
 * defence.
 */
const LIKED = "desk-liked";
/** Session cache, exactly as weather.ts keeps one: a tally is not per-frame. */
const CACHE = "desk-likes";
const MAX_AGE = 60 * 1000;
/** The desk never waits on this. If the answer is slow, it is not an answer. */
const DEADLINE = 4000;

/**
 * A count is a whole, non-negative, believable number or it is nothing.
 *
 * It also unwraps the two shapes PostgREST answers in — `[{ likes: 57 }]` from
 * the table, a bare `58` from the function — which is why there is no
 * `Accept: application/vnd.pgrst.object+json` header below. One line here beats
 * a header the next reader has to go and look up.
 */
function sane(raw: unknown): number | null {
  const row = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(row && typeof row === "object" ? (row as { likes?: unknown }).likes : row);
  return Number.isFinite(n) && n >= 0 && n <= 1e9 ? Math.floor(n) : null;
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
    return Date.now() - at < MAX_AGE ? sane(value) : null;
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
 * A refused like is NOT an error: if the day's ceiling has been spent the
 * function still returns the true total, and showing the visitor the real
 * number after they have been turned away is better than showing them nothing.
 */
function ask(path: string, init: RequestInit = {}): Promise<number | null> {
  if (!BASE || !KEY) return Promise.resolve(null);
  const request = fetch(`${BASE}/rest/v1/${path}`, {
    cache: "no-store",
    ...init,
    headers: { ...AUTH, ...init.headers },
  })
    .then(async (r) => (r.ok ? sane(await r.json()) : null))
    .catch(() => null);

  return Promise.race([
    request,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), DEADLINE)),
  ]);
}

/**
 * The total. Never throws, never hangs, never leaves the plant without a size.
 *
 * With a project: the shared number, session-cached. Without one, or when the
 * request fails: this browser's own tally, so the plant still has a stage and
 * nothing on screen looks broken.
 */
export async function likeCount(): Promise<number> {
  const hit = cached();
  if (hit !== null) return hit;
  // No `id=eq.1` filter: anon is granted SELECT on the `likes` column only, and
  // PostgREST needs SELECT on a column to filter by it. The table's CHECK pins
  // it to one row, so `limit=1` is the same question with fewer grants.
  const live = await ask("plant?select=likes&limit=1");
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
  // The body has to be `{}` rather than absent: PostgREST rejects an RPC POST
  // with no body. The function reads none of it — it takes no arguments.
  const live = await ask("rpc/water_plant", {
    method: "POST",
    body: "{}",
    headers: { "Content-Type": "application/json" },
  });
  write(LIKED, "1");
  if (live !== null) return remember(live);
  const next = localCount() + 1;
  write(LOCAL_COUNT, String(next));
  return remember(next);
}
