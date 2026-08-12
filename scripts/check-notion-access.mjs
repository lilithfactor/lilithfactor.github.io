#!/usr/bin/env node
// Probes whether NOTION_TOKEN can reach the page and all six databases.
// Run: node --env-file=.env scripts/check-notion-access.mjs
// The token is never printed.

const TOKEN = process.env.NOTION_TOKEN;
const V = "2022-06-28";

const PAGE = ["Portfolio page", "292e0b98-133d-4a5d-ba42-02cae942aa2f"];
// NOTE: these are `child_database` BLOCK ids from the official API — NOT the
// `collection_id` values the unofficial /api/v3 endpoint returns. The two are
// different and only these work with api.notion.com. See eng/context.md.
const DBS = [
  ["Case Studies", "2e4be508-b291-81d4-84fc-ed24828d353a"],
  ["Product Dives", "2e4be508-b291-81f3-abfc-f53abee5d76d"],
  ["Projects", "320be508-b291-80ab-ab61-ca40957a2ff2"],
  ["Recommendations", "2f7be508-b291-801f-a804-c8ecf3078783"],
  ["Library", "2e4be508-b291-81b5-b7b4-d15d62af9a69"],
  ["Beyond the Routine", "2e4be508-b291-8114-9a3b-e0c980038895"],
];

if (!TOKEN) {
  console.error("✗ NOTION_TOKEN not set. Run with: node --env-file=.env " + process.argv[1]);
  process.exit(1);
}

const head = { Authorization: `Bearer ${TOKEN}`, "Notion-Version": V };

async function probe(kind, [label, id]) {
  const url = `https://api.notion.com/v1/${kind}/${id}`;
  const r = await fetch(url, { headers: head });
  const body = await r.json().catch(() => ({}));
  if (r.ok) {
    const rows = kind === "databases" ? ` · ${Object.keys(body.properties ?? {}).length} properties` : "";
    return { ok: true, line: `  ✓ ${label.padEnd(20)} reachable${rows}` };
  }
  const why =
    body.code === "object_not_found" ? "not shared with the integration"
    : body.code === "unauthorized" ? "token rejected — check the value"
    : `${body.code}: ${(body.message ?? "").slice(0, 80)}`;
  return { ok: false, line: `  ✗ ${label.padEnd(20)} ${why}` };
}

const results = [
  await probe("pages", PAGE),
  ...(await Promise.all(DBS.map((d) => probe("databases", d)))),
];

console.log("\nNotion access check\n");
results.forEach((r) => console.log(r.line));

const failed = results.filter((r) => !r.ok).length;
if (failed === 0) {
  console.log("\n✓ All reachable. The sync can run.\n");
} else {
  console.log(
    `\n${failed} unreachable. In Notion: open the page (or the database's own ` +
      `page) → ••• → Connections → add the integration.\n` +
      `Databases inside synced blocks may live on a different page — share that one.\n`,
  );
  process.exit(1);
}
