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

import { writeFile, mkdir, rm } from "node:fs/promises";
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
  // Supplied by Pranav 2026-08-13. Hand-maintained because the Notion button
  // uses an email automation action, which exposes no address via the API.
  { label: "Email", url: "mailto:pranav.upadhyay.p@gmail.com" },
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

/* ---------------- Case-study bodies (page blocks) ----------------
 *
 * A case-study row IS a Notion page, and the page body is where the craft
 * actually lives — the properties are only the index card. Pranav writes them
 * as STAR under H1s (Overview · Situation · Tasks · Actions · Results ·
 * Learning), and the prose under each heading is almost never a child of the
 * heading: it sits inside a *callout* that follows it, whose children are the
 * bullets. Walk only the top level and you get six words instead of four
 * hundred. So: recurse, and treat containers (callout, column_list, column)
 * as transparent — their children join the flow at the point the container
 * appeared.
 *
 * Output is a boring renderable tree, never raw Notion JSON:
 *   [{ heading, blocks: [{ type: "list"|"para"|"quote"|"callout"|"image"|"link", … }] }]
 */

// Containers whose children belong to the surrounding flow.
const TRANSPARENT_BLOCKS = new Set(["callout", "column_list", "column", "synced_block", "toggle"]);
// Chrome and things a paper page cannot render. Silent — not warning-worthy.
const IGNORED_BLOCKS = new Set([
  "divider",
  "table_of_contents",
  "unsupported",
  "breadcrumb",
  "child_database",
  "child_page",
  "link_to_page",
  "template",
]);
// The hand-written nav line at the top of a body. Notion chrome, not content.
const TOC_LINE = /^contents\s*[⇒=>-]/i;

/** One pass over a page's blocks → a flat event list (headings, list items,
 * blocks), with containers flattened and nested bullets promoted to siblings. */
async function bodyEvents(pageId, warn) {
  const events = [];
  const seenUnhandled = new Set();

  async function walk(id, depth) {
    // Notion nests: heading → callout → bullet → sub-bullet is already depth 3.
    if (depth > 3) return;
    for (const b of await childBlocks(id)) {
      const t = b.type;
      const text = plain(b[t]?.rich_text);

      if (t === "heading_1" || t === "heading_2" || t === "heading_3") {
        if (text) events.push({ kind: "heading", text });
        continue;
      }
      if (t === "bulleted_list_item" || t === "numbered_list_item") {
        if (text) events.push({ kind: "item", text });
        // Sub-bullets become siblings. The two that exist read fine flat, and
        // a nested schema would buy hierarchy nobody is writing.
        if (b.has_children) await walk(b.id, depth + 1);
        continue;
      }
      if (t === "paragraph") {
        if (text) events.push({ kind: "block", block: { type: "para", text } });
        if (b.has_children) await walk(b.id, depth + 1);
        continue;
      }
      if (t === "quote") {
        if (text && !TOC_LINE.test(text)) {
          events.push({ kind: "block", block: { type: "quote", text } });
        }
        continue;
      }
      if (t === "image") {
        const src = b.image.file?.url ?? b.image.external?.url ?? null;
        // Signed S3 URL — rewritten to a local path by downloadImages() below.
        if (src) {
          events.push({
            kind: "block",
            block: { type: "image", src, caption: plain(b.image.caption) || null },
          });
        }
        continue;
      }
      if (t === "embed" || t === "bookmark") {
        const url = b[t]?.url;
        if (url) events.push({ kind: "block", block: { type: "link", url } });
        continue;
      }
      if (TRANSPARENT_BLOCKS.has(t)) {
        // A callout with its own copy is a pull-quote wrapping its bullets:
        // keep the copy, then let the bullets join the flow behind it.
        if (text) events.push({ kind: "block", block: { type: "callout", text } });
        if (b.has_children) await walk(b.id, depth + 1);
        continue;
      }
      if (!IGNORED_BLOCKS.has(t) && !seenUnhandled.has(t)) {
        seenUnhandled.add(t);
        warn(`body contains an unrendered "${t}" block`);
      }
    }
  }

  await walk(pageId, 0);
  return events;
}

/** Events → sections. Consecutive list items collapse into one `list` block;
 * a heading with nothing under it is dropped (sparse bodies are normal). */
export function toSections(events, summary = "") {
  // The Overview callout repeats the row's Description verbatim; the page
  // already renders that as the lead, so don't print it twice.
  const dupe = summary.replace(/\s+/g, " ").slice(0, 60).toLowerCase();
  const isDupe = (s) =>
    dupe.length > 20 && s.replace(/\s+/g, " ").slice(0, 60).toLowerCase() === dupe;

  const sections = [];
  let current = { heading: null, blocks: [] };
  const flush = () => {
    if (current.blocks.length > 0) sections.push(current);
  };

  for (const e of events) {
    if (e.kind === "heading") {
      flush();
      current = { heading: e.text, blocks: [] };
    } else if (e.kind === "item") {
      const last = current.blocks[current.blocks.length - 1];
      if (last?.type === "list") last.items.push(e.text);
      else current.blocks.push({ type: "list", items: [e.text] });
    } else if (!((e.block.type === "callout" || e.block.type === "para") && isDupe(e.block.text))) {
      current.blocks.push(e.block);
    }
  }
  flush();
  return sections;
}

/* --- Assets ---------------------------------------------------------------
 * Notion image URLs are S3 links signed for ~1 hour. Ship one and every image
 * on the site 403s by lunchtime, so each is downloaded here and the JSON is
 * rewritten to the local path. Non-negotiable; see content-model.md. */

const PUBLIC_DIR = path.resolve(import.meta.dirname, "../public/case-studies");

/** Intrinsic size from the file header — width/height on the <img> is what
 * stops the page reflowing as images arrive. Four formats, no dependency. */
export function imageSize(buf) {
  const ascii = (a, b) => buf.subarray(a, b).toString("latin1");
  if (buf.length > 24 && ascii(1, 4) === "PNG") {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length > 10 && ascii(0, 3) === "GIF") {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }
  if (buf.length > 30 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") {
    const fourcc = ascii(12, 16);
    if (fourcc === "VP8X") return { width: readU24(buf, 24) + 1, height: readU24(buf, 27) + 1 };
    if (fourcc === "VP8 ") return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (fourcc === "VP8L") {
      const n = buf.readUInt32LE(21);
      return { width: (n & 0x3fff) + 1, height: ((n >> 14) & 0x3fff) + 1 };
    }
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    for (let i = 2; i < buf.length - 9; ) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      if (marker === 0xda) break; // start of scan — no size found
      // SOF0..SOF15 carry the frame size; C4/C8/CC are tables, not frames.
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
}

function readU24(buf, at) {
  return buf[at] | (buf[at + 1] << 8) | (buf[at + 2] << 16);
}

const EXT_BY_TYPE = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/svg+xml": "svg",
};

/** Downloads every image in `sections`, rewriting `src` to /case-studies/<slug>/<n>.<ext>.
 * Mutates in place; an image that will not download is dropped rather than
 * left pointing at a URL that is already dying. */
async function downloadImages(sections, slug, warn) {
  const images = sections.flatMap((s) => s.blocks.filter((b) => b.type === "image"));
  if (images.length === 0) return 0;

  const dir = path.join(PUBLIC_DIR, slug);
  // Rebuilt each sync so images deleted in Notion don't linger in the repo.
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });

  let n = 0;
  for (const img of images) {
    try {
      const res = await fetch(img.src);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
      const ext =
        EXT_BY_TYPE[type] ??
        (path.extname(new URL(img.src).pathname).slice(1).toLowerCase() || "bin");
      const file = `${++n}.${ext}`;
      await writeFile(path.join(dir, file), buf);
      const size = imageSize(buf);
      img.src = `/case-studies/${slug}/${file}`;
      img.width = size?.width ?? null;
      img.height = size?.height ?? null;
    } catch (e) {
      warn(`image ${n + 1} failed to download (${e.message}) — dropped`);
      img.drop = true;
    }
  }
  for (const s of sections) s.blocks = s.blocks.filter((b) => !b.drop);
  return n;
}

async function fetchBody(record) {
  const warn = (m) => warnings.push(`caseStudies "${record.name}": ${m}`);
  const events = await bodyEvents(record.id, warn);
  const sections = toSections(events, record.summary);
  const images = await downloadImages(sections, record.slug, warn);
  return { sections, images };
}

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

    // Only case studies carry a page body: they are the one place a body is
    // the point rather than a note-to-self.
    if (key === "caseStudies") {
      for (const record of records) {
        const { sections, images } = await fetchBody(record);
        record.body = sections;
        const words = sections
          .flatMap((s) => [s.heading ?? "", ...s.blocks.flatMap((b) => b.items ?? [b.text ?? ""])])
          .join(" ")
          .split(/\s+/)
          .filter(Boolean).length;
        if (words < 40) warnings.push(`caseStudies "${record.name}": body is only ${words} words`);
        console.log(`  · ${record.slug}: ${words} words, ${images} image(s)`);
      }
    }

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
