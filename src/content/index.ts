/**
 * THE CONTENT PROXY — the only door to content.
 *
 * Nothing outside src/content/ may read content/*.json or mention Notion.
 * Zod parses at module load, so a malformed sync FAILS THE BUILD — a broken
 * portfolio can never deploy. (Plain zod over astro:content collections on
 * purpose: JSON data needs none of the collection machinery, and the
 * build-failure guarantee is identical. See eng/architecture.md.)
 */
import { z } from "astro/zod";

import aboutJson from "../../content/about.json";
import caseStudiesJson from "../../content/case-studies.json";
import productDivesJson from "../../content/product-dives.json";
import projectsJson from "../../content/projects.json";
import recommendationsJson from "../../content/recommendations.json";
import libraryJson from "../../content/library.json";
import beyondJson from "../../content/beyond.json";
import linksJson from "../../content/links.json";
import metaJson from "../../content/meta.json";
import playlistJson from "../../content/playlist.json";

const base = z.object({
  id: z.string(),
  slug: z.string().min(1),
  name: z.string().min(1),
  order: z.number(),
});

/* The renderable body tree the sync normalises Notion blocks into.
 * STAR sections under H1s: Overview · Situation · Tasks · Actions · Results ·
 * Learning. Bodies can be sparse or absent — a section renders only if it
 * exists, and a case study without one still has its card. */
const BodyBlock = z.discriminatedUnion("type", [
  z.object({ type: z.literal("para"), text: z.string() }),
  z.object({ type: z.literal("quote"), text: z.string() }),
  z.object({ type: z.literal("callout"), text: z.string() }),
  z.object({ type: z.literal("list"), items: z.array(z.string()) }),
  z.object({ type: z.literal("link"), url: z.string().url() }),
  z.object({
    type: z.literal("image"),
    /** Local path under /case-studies/ — the sync downloads every asset
     * because Notion's signed URLs die in ~1h. Never a remote URL. */
    src: z.string().startsWith("/case-studies/"),
    caption: z.string().nullable(),
    width: z.number(),
    height: z.number(),
  }),
]);

const BodySection = z.object({
  heading: z.string().min(1),
  blocks: z.array(BodyBlock),
});

const CaseStudy = base.extend({
  summary: z.string().min(1),
  type: z.array(z.string()),
  role: z.string().nullable(),
  domain: z.array(z.string()),
  kpis: z.array(z.string()),
  association: z.string().nullable(),
  links: z.array(z.string().url()),
  body: z.array(BodySection).default([]),
});

const ProductDive = base.extend({
  summary: z.string(),
  url: z.string().url().nullable(),
  productType: z.array(z.string()),
  category: z.array(z.string()),
  gtm: z.array(z.string()),
  date: z.string().nullable(),
  pricing: z.string().nullable(),
});

const Project = base.extend({
  summary: z.string(),
  productType: z.string().nullable(),
  links: z.array(z.object({ url: z.string().url(), label: z.string() })),
  kpis: z.array(z.string()),
});

const Recommendation = base.extend({
  role: z.string(),
  org: z.string().nullable(),
  quote: z.string().min(1),
});

const Book = base.extend({
  author: z.string().nullable(),
  domain: z.array(z.string()),
  status: z.enum(["done", "reading", "enqueued", "tbd"]),
  month: z.string().nullable(),
  year: z.number().nullable(),
});

const Interest = base.extend({ desc: z.string() });

const About = z.object({
  headline: z.string().min(1),
  paragraphs: z.array(z.string()),
});

const Link = z.object({ label: z.string(), url: z.string() });

const TrackSchema = z.object({
  id: z.string(),
  name: z.string(),
  mood: z.string(),
  /** Extension-less stem: the runtime appends .opus, falling back to .m4a. */
  src: z.string(),
  credit: z.string(),
  order: z.number(),
});

const Meta = z.object({
  syncedAt: z.string(),
  counts: z.record(z.string(), z.number()),
  warnings: z.array(z.string()),
});

const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;

/* Parsed once at module load — the build gate. */
export const about = About.parse(aboutJson);
export const caseStudies = z.array(CaseStudy).parse(caseStudiesJson).sort(byOrder);
export const productDives = z.array(ProductDive).parse(productDivesJson).sort(byOrder);
export const projects = z.array(Project).parse(projectsJson).sort(byOrder);
export const recommendations = z.array(Recommendation).parse(recommendationsJson).sort(byOrder);
export const library = z.array(Book).parse(libraryJson).sort(byOrder);
export const beyond = z.array(Interest).parse(beyondJson).sort(byOrder);
export const links = z.array(Link).parse(linksJson);
export const meta = Meta.parse(metaJson);
export const playlist = z.array(TrackSchema).parse(playlistJson).sort(byOrder);

export type CaseStudy = z.infer<typeof CaseStudy>;
export type ProductDive = z.infer<typeof ProductDive>;
export type Project = z.infer<typeof Project>;
export type Book = z.infer<typeof Book>;

/* Convenience views */
export const divesMade = productDives.filter((d) => d.category.includes("Design"));
export const divesStudied = productDives.filter((d) => !d.category.includes("Design"));
export const shelf = {
  reading: library.filter((b) => b.status === "reading"),
  done: library.filter((b) => b.status === "done"),
  queued: library.filter((b) => b.status === "enqueued" || b.status === "tbd"),
};
