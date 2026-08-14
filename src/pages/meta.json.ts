/**
 * /meta.json — the deploy-freshness probe.
 *
 * steps.md's "verify live" gate needs one URL that proves the deployed site
 * carries the content you think it does. content/*.json never ships (it is
 * build input, not artifact), so this endpoint re-emits the sync's metadata
 * through the proxy at build time: same counts, same warnings, same syncedAt
 * that the committed content was generated from.
 */
import { meta } from "../content/index";

export function GET() {
  return new Response(JSON.stringify(meta, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
}
