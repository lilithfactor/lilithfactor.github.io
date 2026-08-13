#!/usr/bin/env node
/**
 * Notion → content/*.json
 *
 * The only code that talks to Notion. Runs in Node with NOTION_TOKEN
 * (locally: `npm run notion:sync`; CI: .github/workflows/sync-content.yml).
 * The contract it writes is documented field-by-field in
 * brain/content/content-model.md — update both together.
 *
 * Fails loudly (exit 1) on anything that would publish a broken portfolio.
 * Soft problems (a book missing its author) land in meta.json "warnings".
 */

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

// Read lazily so the normalisers can be imported by tests without a token;
// main() enforces its presence before any network call.
const TOKEN = process.env.NOTION_TOKEN;

const API = "https://api.notion.com/v1";
// Pinned. Bumping this is a deliberate change, not a drift.
const NOTION_VERSION = "2022-06-28";

const PAGE_ID = "292e0b98-133d-4a5d-ba42-02cae942aa2f";

// child_database block ids — NOT the unofficial API's collection_ids.
// See brain/work/learning.md ("collection_id ≠ database_id").
const DATABASES = {
  caseStudies: "2e4be508-b291-81d4-84fc-ed24828d353a",
  productDives: "2e4be508-b291-81f3-abfc-f53abee5d76d",
  projects: "320be508-b291-80ab-ab61-ca40957a2ff2",
  recommendations: "2f7be508-b291-801f-a804-c8ecf3078783",
  library: "2e4be508-b291-81b5-b7b4-d15d62af9a69",
  beyond: "2e4be508-b291-8114-9a3b-e0c980038895",
};

// The "Lets Connect" buttons are Notion automation buttons — invisible to the
// official API — so this is the one hand-maintained content block. Documented
// as the exception in content-model.md.
const LINKS = [
  { label: "LinkedIn", url: "https://www.linkedin.com/in/pranav-upadhyay/" },
  { label: "GitHub", url: "https://github.com/lilithfactor" },
  { label: "Email", url: "mailto:pranav.upadhyay1997@gmail.com" }, // TODO(pranav): confirm address
  { label: "Instagram", url: "https://www.instagram.com/pra.naive/" },
  { label: "Goodreads", url: "https://www.goodreads.com/lilithfactor" },
  { label: "Chess.com", url: "https://www.chess.com/member/lilithfactor" },
  { label: "Spotify", url: "https://open.spotify.com/user/%E2%98%A3blurryface" },
];

const warnings = [];

/* ---------------- Notion plumbing ---------------- */

async function notion(pathname, init = {}) {
  const res = await fetch(`${API}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Notion ${pathname} → ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

async function queryAll(databaseId) {
  const rows = [];
  let cursor;
  do {
    const body = cursor ? { start_cursor: cursor, page_size: 100 } : { page_size: 100 };
    const r = await notion(`/databases/${databaseId}/query`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    rows.push(...r.results);
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor);
  return rows;
}

async function childBlocks(blockId) {
  const blocks = [];
  let cursor;
  do {
    const qs = cursor ? `?start_cursor=${cursor}&page_size=100` : "?page_size=100";
    const r = await notion(`/blocks/${blockId}/children${qs}`);
    blocks.push(...r.results);
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor);
  return blocks;
}

/* ---------------- normalisers (exported for tests) ---------------- */

export function plain(richTextProp) {
  const arr = richTextProp?.rich_text ?? richTextProp?.title ?? richTextProp ?? [];
  if (!Array.isArray(arr)) return ""; // a non-text property wandered in
  return arr.map((t) => t.plain_text ?? "").join("").trim();
}

export function names(multiSelectProp) {
  return (multiSelectProp?.multi_select ?? []).map((o) => o.name);
}

export function selectName(prop) {
  return prop?.select?.name ?? prop?.status?.name ?? null;
}

/** A Notion "files & media" property → external URLs. Hosted files get a
 * warning: their signed URLs expire in ~1h and need the asset downloader. */
export function fileUrls(prop, warn = () => {}) {
  return (prop?.files ?? [])
    .map((f) => {
      if (f.type === "external") return f.external.url;
      warn(`hosted file "${f.name}" — signed URL expires in ~1h, needs the asset downloader`);
      return f.file?.url ?? null;
    })
    .filter(Boolean);
}

/** "https://a.com, https://b.com (label)" → clean URL list. */
export function splitLinks(text) {
  if (!text) return [];
  const urls = text.match(/https?:\/\/[^\s,()]+/g) ?? [];
  return [...new Set(urls.map((u) => u.replace(/[).,]+$/, "")))];
}

export function slugify(name) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’'"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/** Labels a project link by host for the UI. */
export function linkLabel(url) {
  const h = new URL(url).hostname;
  if (h.includes("play.google.com")) return "Play Store";
  if (h.includes("github.com")) return "GitHub";
  if (h.includes("docs.google.com")) return "Sheet";
  return "Visit";
}

function baseRecord(row, name, taken) {
  let slug = slugify(name) || row.id;
  if (taken.has(slug)) slug = `${slug}-${row.id.slice(0, 6)}`;
  taken.add(slug);
  return { id: row.id, slug, name };
}

/* ---------------- per-database mappers ---------------- */

function visible(row) {
  const vis = row.properties.Visibility;
  // Databases without the property publish everything
  // (Recommendations, Library, Beyond).
  if (!vis) return true;
  // It is a select today; tolerate multi_select in case it is ever recreated.
  return selectName(vis) === "Highlight" || names(vis).includes("Highlight");
}

function requireName(row, db) {
  const name = plain(row.properties.Name);
  if (!name) throw new Error(`${db}: row ${row.id} has an empty Name`);
  return name;
}

const MAPPERS = {
  caseStudies(row, taken) {
    const name = requireName(row, "caseStudies");
    const summary = plain(row.properties.Description);
    if (!summary) throw new Error(`caseStudies: "${name}" has no Description`);
    return {
      ...baseRecord(row, name, taken),
      summary,
      type: names(row.properties.Type),          // multi_select in the real schema
      role: selectName(row.properties.Role),
      domain: names(row.properties.Domain),
      kpis: names(row.properties.KPIs),
      association: selectName(row.properties.Association),
      links: fileUrls(row.properties.Link, (m) => warnings.push(`caseStudies "${name}": ${m}`)),
    };
  },
  productDives(row, taken) {
    const name = requireName(row, "productDives");
    return {
      ...baseRecord(row, name, taken),
      summary: plain(row.properties.Description),
      url: row.properties.URL?.url ?? splitLinks(plain(row.properties.URL))[0] ?? null,
      productType: names(row.properties["Product Type"]),
      category: names(row.properties["Section Category"]),
      gtm: names(row.properties["GTM Model"]),
      date: row.properties.Date?.date?.start ?? null,
      pricing: row.properties.Pricing?.url ?? null,   // url property, not text
    };
  },
  projects(row, taken) {
    const name = requireName(row, "projects");
    const links = fileUrls(row.properties.Links, (m) => warnings.push(`projects "${name}": ${m}`));
    return {
      ...baseRecord(row, name, taken),
      summary: plain(row.properties.Description),
      productType:
        selectName(row.properties["Product Type"]) ??
        names(row.properties["Product Type"])[0] ??
        null,
      links: links.map((url) => ({ url, label: linkLabel(url) })),
      kpis: names(row.properties.KPIs),
    };
  },
  recommendations(row, taken) {
    const name = requireName(row, "recommendations");
    const quote = plain(row.properties["Testimony Content"]);
    if (!quote) throw new Error(`recommendations: "${name}" has an empty quote`);
    return {
      ...baseRecord(row, name, taken),
      role: plain(row.properties.Role),
      org: selectName(row.properties.Org),            // select in the real schema
      quote,
    };
  },
  library(row, taken) {
    const name = requireName(row, "library");
    const author = plain(row.properties.Author) || null;
    if (!author) warnings.push(`library: "${name}" has no Author`);
    return {
      ...baseRecord(row, name, taken),
      author,
      domain: names(row.properties.Domain),
      status: selectName(row.properties.Status) ?? "tbd",  // status-type property
      month: selectName(row.properties.Month),
      // Year is a select of strings ("2026") — parse, keep null if absent/odd.
      year: Number(selectName(row.properties.Year)) || null,
    };
  },
  beyond(row, taken) {
    const name = requireName(row, "beyond");
    return { ...baseRecord(row, name, taken), desc: plain(row.properties.Desc) };
  },
};

/* ---------------- About (page blocks) ---------------- */

async function fetchAbout() {
  // The About copy lives in a callout inside the page's first synced block:
  // heading "About me", a divider, then paragraphs. Walk shallowly, collect
  // headings + paragraphs in order, take the run after the About heading.
  const texts = [];
  async function walk(id, depth) {
    if (depth > 4) return;
    for (const b of await childBlocks(id)) {
      const t = b.type;
      if (t === "heading_1" || t === "heading_2" || t === "heading_3") {
        texts.push({ kind: "h", text: plain(b[t]?.rich_text) });
      } else if (t === "paragraph") {
        const s = plain(b[t]?.rich_text);
        if (s) texts.push({ kind: "p", text: s });
      } else if (
        (t === "synced_block" || t === "callout" || t === "column_list" || t === "column") &&
        b.has_children
      ) {
        await walk(b.id, depth + 1);
      }
    }
  }
  await walk(PAGE_ID, 0);

  const start = texts.findIndex((x) => x.kind === "h" && /about/i.test(x.text));
  if (start === -1) throw new Error('about: no heading matching /about/i found on the page');
  const paragraphs = [];
  for (const x of texts.slice(start + 1)) {
    if (x.kind === "h") break;
    paragraphs.push(x.text);
  }
  if (paragraphs.length === 0) throw new Error("about: heading found but no paragraphs");

  const last = paragraphs[paragraphs.length - 1];
  if (/\b(like|such as|including)\s*$/i.test(last) || /\blike\b[.\s]*$/.test(last)) {
    warnings.push(`about: a paragraph ends mid-clause ("…${last.slice(-40)}")`);
  }
  return { headline: paragraphs[0], paragraphs: paragraphs.slice(1) };
}

/* ---------------- main ---------------- */

async function main() {
  if (!TOKEN) {
    console.error("✗ NOTION_TOKEN is not set (locally: node --env-file=.env scripts/sync-notion.mjs)");
    process.exit(1);
  }
  const outDir = path.resolve(import.meta.dirname, "../content");
  await mkdir(outDir, { recursive: true });

  const counts = {};
  for (const [key, dbId] of Object.entries(DATABASES)) {
    const rows = await queryAll(dbId);
    const taken = new Set();
    const records = rows
      .filter((r) => !r.archived && visible(r))
      .map((row, i) => ({ ...MAPPERS[key](row, taken), order: i }));
    if (records.length === 0) throw new Error(`${key}: 0 visible rows — refusing to publish an empty section`);
    counts[key] = records.length;
    await writeFile(path.join(outDir, `${fileName(key)}.json`), JSON.stringify(records, null, 2) + "\n");
  }

  const about = await fetchAbout();
  await writeFile(path.join(outDir, "about.json"), JSON.stringify(about, null, 2) + "\n");
  await writeFile(path.join(outDir, "links.json"), JSON.stringify(LINKS, null, 2) + "\n");

  const meta = { syncedAt: new Date().toISOString(), counts, warnings };
  await writeFile(path.join(outDir, "meta.json"), JSON.stringify(meta, null, 2) + "\n");

  console.log("✓ synced", JSON.stringify(counts));
  for (const w of warnings) console.log("  ⚠", w);
}

function fileName(key) {
  return {
    caseStudies: "case-studies",
    productDives: "product-dives",
    projects: "projects",
    recommendations: "recommendations",
    library: "library",
    beyond: "beyond",
  }[key];
}

// Only run when executed directly (so tests can import the normalisers).
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main().catch((e) => {
    console.error("✗ sync failed:", e.message);
    process.exit(1);
  });
}
