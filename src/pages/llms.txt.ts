/**
 * /llms.txt — the whole portfolio as one plain-text page, for the fetchers
 * behind ChatGPT, Claude and Perplexity.
 *
 * Generated, not hand-written, for the same reason /meta.json is: a checked-in
 * public/llms.txt would be a second copy of content only Notion owns, and it
 * would be wrong the first time the sync republishes a case study. This reads
 * through the proxy, so it cannot drift. (Directive 1, eng/architecture.md.)
 *
 * Honest about what it buys: Google's own AI-optimization guidance says Search
 * ignores llms.txt. This is for the non-Google fetchers, and it is not a
 * ranking lever.
 *
 * The case-study lines carry the full summary on purpose. Three of the eight
 * bodies are still empty in Notion, so a model that reads only this file gets
 * more than it would by crawling all eight pages.
 */
import {
  about,
  caseStudies,
  projects,
  divesMade,
  divesStudied,
  links,
  type CaseStudy,
  type Project,
  type ProductDive,
} from "../content/index";

const SITE = "https://lilithfactor.github.io";

const caseLine = (c: CaseStudy) => {
  const tags = [c.role, ...c.domain, ...c.type, ...c.kpis].filter(Boolean).join(" · ");
  return `- [${c.name}](${SITE}/case-studies/${c.slug}/): ${tags}. ${c.summary}`;
};

/* Notion labels a bare URL "Visit", so the labels are not worth printing — the
 * host says what it is. First link becomes the markdown target, the rest trail. */
const projectLine = (p: Project) => {
  const [first, ...rest] = p.links.map((l) => l.url.trim());
  const head = first ? `[${p.name}](${first})` : p.name;
  const more = rest.length ? ` Also: ${rest.join(", ")}.` : "";
  return `- ${head}: ${p.summary}${more}`;
};

const diveLine = (d: ProductDive) =>
  d.url ? `- [${d.name}](${d.url}): ${d.summary}` : `- ${d.name}: ${d.summary}`;

export function GET() {
  const body = `# Pranav Upadhyay — Product Manager

> ${about.headline}

${about.paragraphs.join("\n\n")}

Every page on this site is static HTML and reads without JavaScript. This file is generated at build time from the same content the pages render from.

## Case studies

Eight write-ups, one page each, in STAR order: Overview, Situation, Tasks, Actions, Results, Learning.

${caseStudies.map(caseLine).join("\n")}

## Projects

${projects.map(projectLine).join("\n")}

## Product dives

Listed on the homepage, ${SITE}/, with no page of their own.

### Things I made

${divesMade.map(diveLine).join("\n")}

### Things I studied

Other people's products, taken apart.

${divesStudied.map(diveLine).join("\n")}

## Contact

${links.map((l) => `- ${l.label}: ${l.url.replace(/^mailto:/, "")}`).join("\n")}
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
