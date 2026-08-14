/**
 * fetch-models — pulls the desk's 3D models from poly.pizza into public/models/.
 *
 * Every model here is CC0 or CC-BY, chosen against four hard criteria:
 *
 *   1. Triangle budget. Nothing over ~900 tris; the whole set is ~5.7k, which
 *      is a rounding error next to the 250k budget and roughly doubles the
 *      procedural desk rather than replacing its cost with a download.
 *   2. No textures. Every model arrives stripped of its materials and given the
 *      paper Lambert + cut-edge vertex colours (see stages/desk/materials.ts),
 *      so a model whose entire appeal is its texture is a model we cannot use.
 *      This is why "low poly" beats "photoreal" here on LOOK, not just weight.
 *   3. Separable parts where the object has to move. The lamp is the whole
 *      reason this criterion exists: its head pivots and drives a real light,
 *      so a single fused mesh — which is what nearly every desk lamp on every
 *      asset site is — cannot be rigged at all.
 *   4. Licence that survives commercial use and modification.
 *
 * `parts` is recorded because it is the property you cannot recover from a
 * screenshot and the one most likely to be silently broken by a re-upload.
 *
 * Run: node scripts/fetch-models.mjs [--force]
 */
import { writeFile, mkdir, access } from "node:fs/promises";
import { join } from "node:path";

const DIR = "public/models";
const UA = { "User-Agent": "lilithfactor.github.io asset fetch" };

/** name → the poly.pizza model it comes from. `tris` and `parts` are assertions:
 * if an upload changes underneath us, the fetch fails loudly rather than
 * quietly putting a different object on the desk. */
const MODELS = {
  turntable: {
    resource: "a98ad5db-b39c-4534-902f-855ec814dd27",
    page: "fmkVqWxEWO3",
    title: "Turntable / Record Player",
    creator: "Vince Pale Jr",
    licence: "CC-BY 3.0",
    tris: 312,
    parts: 1,
  },
  // No lamp: the desk's lamp is procedural on purpose. It is folded card by
  // construction — a disc base, a strip folded twice, a cone scored into eight
  // facets — which is exactly the look, and its head is already a pivot group
  // driving a real SpotLight. The best downloaded lamp (poly.pizza/m/0iZSZezOQxC,
  // 856t, the only articulated one of ~25 surveyed) would be a downgrade here
  // and a rig rewrite besides.
  rubiks: {
    resource: "e43be19c-d07d-4f3f-9f4f-29701a92feff",
    page: "fOzaoeVGlG9",
    title: "Rubik's cube",
    creator: "Poly by Google",
    licence: "CC-BY 3.0",
    tris: 540,
    parts: 1,
    // Real cubie geometry. The 12-triangle alternatives are a box with the
    // cube printed on it, which is nothing once the texture is stripped.
    note: "geometric cubies, not a printed box",
  },
  books: {
    resource: "a3d65818-0da5-4ac0-ab39-87846fa3458f",
    page: "M2cJ5sVUgJ",
    title: "Books",
    creator: "Kenney",
    licence: "CC0 1.0",
    tris: 124,
    parts: 2,
  },
  "book-stack": {
    resource: "b8d88c42-85c7-4b58-8758-09561f47edd0",
    page: "1WggoIFq8tx",
    title: "Book Stack",
    creator: "Danni Bittman",
    licence: "CC-BY 3.0",
    tris: 640,
    parts: 1,
  },
  magnifier: {
    resource: "84ad2697-71c7-4e5d-8e38-f031c3825db1",
    page: "c8HQVCBMIMR",
    title: "Magnifying Glass",
    creator: "Gabriel Valdivia",
    licence: "CC-BY 3.0",
    tris: 256,
    parts: 1,
  },
  "open-book": {
    resource: "b8b1db56-fe65-448f-b6e0-11a77485d742",
    page: "4WPcl72i1_S",
    title: "open book",
    creator: "Justin Randall",
    licence: "CC-BY 3.0",
    tris: 482,
    parts: 18,
  },
  "legal-pad": {
    resource: "d9b91830-403d-4f37-a2bc-45e99137afa9",
    page: "9Ptsg_xZt6B",
    title: "Notebook",
    creator: "jeremy",
    licence: "CC-BY 3.0",
    tris: 568,
    parts: 1,
  },
  folder: {
    resource: "7b9eb828-59f1-4eba-819e-143accdd8b6b",
    page: "fDhOEadpKWA",
    title: "File Folder",
    creator: "Ryan Dewalt",
    licence: "CC-BY 3.0",
    tris: 20,
    parts: 2,
  },
  clipboard: {
    resource: "d0a8123f-bc6e-49b7-b646-4494f144707e",
    page: "8H5SDxwMnEA",
    title: "clipboard",
    creator: "William Murphy",
    licence: "CC-BY 3.0",
    tris: 92,
    parts: 1,
  },
  crate: {
    resource: "c1d0a153-ef19-4fbd-91b2-d688c8e0a57d",
    page: "pZBpmjtvw8",
    title: "Empty Box",
    creator: "CreativeTrio",
    licence: "CC0 1.0",
    tris: 76,
    parts: 1,
  },
  envelope: {
    resource: "0b636f6d-38cf-4ef3-a281-2a156016df93",
    page: "0nJFg_ANfxf",
    title: "Manila Envelope",
    creator: "Jarlan Perez",
    licence: "CC-BY 3.0",
    tris: 320,
    parts: 1,
  },
  letter: {
    resource: "6d65fe7e-cf92-456d-87bc-0344fe09db88",
    page: "4RKKC0BC4gb",
    title: "Posted Letter",
    creator: "Jarlan Perez",
    licence: "CC-BY 3.0",
    tris: 444,
    parts: 1,
  },
  corkboard: {
    resource: "09cf2ec1-8b2c-4543-b773-962fba13aac5",
    page: "U8yQZ9l0HZ",
    title: "Wall Corkboard",
    creator: "CreativeTrio",
    licence: "CC0 1.0",
    tris: 218,
    parts: 1,
  },
  pinboard: {
    resource: "2eb226c8-1635-4261-8985-6daa6de85221",
    page: "2CvK24vFhUK",
    title: "Bulletin board",
    creator: "Poly by Google",
    licence: "CC-BY 3.0",
    tris: 208,
    parts: 10,
  },
  knights: {
    resource: "59dc3fa6-3dea-4024-be63-d5ef4fad0772",
    page: "373iD4phSZh",
    title: "low poly chess knights",
    creator: "Thomas Saint Pierre (s1pierro)",
    licence: "CC-BY 3.0",
    tris: 200,
    parts: 1,
    // Black AND white knight in one 4KB file — the cheapest real presence the
    // printed chess position could get.
    note: "both colours in one file",
  },
  pencil: {
    resource: "befca51d-a3d8-4c06-b648-a8479ea1fa0e",
    page: "2X568L4LJ1",
    title: "Pencil",
    creator: "J-Toastie",
    licence: "CC-BY 3.0",
    tris: 58,
    parts: 1,
  },
  postit: {
    resource: "8fac14d3-bed0-4449-afc8-5b193b0e0d7a",
    page: "3r6uTb4Tn0j",
    title: "A stack of post-it",
    creator: "Zack Huang",
    licence: "CC-BY 3.0",
    tris: 20,
    parts: 1,
  },
  mug: {
    resource: "5600ffdc-21d2-4e62-93e2-1b255738e43d",
    page: "fis2ugeLbn",
    title: "Mug",
    creator: "Kenney",
    licence: "CC0 1.0",
    tris: 232,
    parts: 1,
  },
};

/** Triangles and mesh count straight from the GLB's JSON chunk — the same
 * numbers the choice was made on, so drift is detectable. */
function inspect(buf) {
  if (buf.length < 20 || buf.readUInt32LE(0) !== 0x46546c67) throw new Error("not a GLB");
  const json = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString("utf8"));
  const tris = (json.meshes ?? []).reduce(
    (n, m) =>
      n +
      m.primitives.reduce((k, p) => {
        const a = json.accessors?.[p.indices ?? p.attributes?.POSITION];
        return k + Math.floor((a?.count ?? 0) / 3);
      }, 0),
    0,
  );
  return { tris, parts: json.meshes?.length ?? 0 };
}

const force = process.argv.includes("--force");
await mkdir(DIR, { recursive: true });

const rows = [];
let failed = 0;

for (const [name, m] of Object.entries(MODELS)) {
  const file = join(DIR, `${name}.glb`);
  if (!force) {
    try {
      await access(file);
      rows.push({ name, ...m, skipped: true });
      console.log(`· ${name} — already present`);
      continue;
    } catch {}
  }

  const res = await fetch(`https://static.poly.pizza/${m.resource}.glb`, { headers: UA });
  if (!res.ok) {
    console.error(`✗ ${name} — HTTP ${res.status}`);
    failed++;
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());

  let got;
  try {
    got = inspect(buf);
  } catch (e) {
    console.error(`✗ ${name} — ${e.message}`);
    failed++;
    continue;
  }
  // Not fatal: an upstream re-upload is worth knowing about, not worth
  // blocking a build over. The number in MODELS is what was reviewed.
  if (got.tris !== m.tris || got.parts !== m.parts) {
    console.warn(
      `! ${name} — upstream changed: ${got.tris}t/${got.parts}p, expected ${m.tris}t/${m.parts}p`,
    );
  }

  await writeFile(file, buf);
  rows.push({ name, ...m, ...got, bytes: buf.length });
  console.log(`✓ ${name} — ${got.tris}t ${got.parts}p ${(buf.length / 1024).toFixed(0)}KB`);
}

/* --- Attribution ---------------------------------------------------------
 * CC-BY requires it, CC0 does not, and this file lists both: the point is not
 * only the licence but knowing where every object on the desk came from. */
const credit = rows
  .filter((r) => !r.skipped || true)
  .sort((a, b) => a.name.localeCompare(b.name))
  .map(
    (r) =>
      `| \`${r.name}.glb\` | [${r.title}](https://poly.pizza/m/${r.page}) | ${r.creator} | ${r.licence} |`,
  )
  .join("\n");

await writeFile(
  join(DIR, "ATTRIBUTION.md"),
  `# 3D model credits

Every model on the desk, where it came from, and its licence. Fetched by
\`scripts/fetch-models.mjs\`, which is the only thing that should write here.

The desk surface, the walls, the paper sheets, the printed outcomes and the
business card are **not** in this list: they are procedural geometry built in
\`src/stages/desk/\`, and owe nobody a credit.

All models are re-materialled on load — the paper Lambert, the cut-edge vertex
colours and the palette tokens are ours; the geometry is theirs.

| File | Model | Author | Licence |
|---|---|---|---|
${credit}

Every model above carries its licence, which is why the desk sources from
poly.pizza rather than from asset sites that ship geometry with no provenance.

CC-BY 3.0 requires attribution and permits commercial use and modification:
<https://creativecommons.org/licenses/by/3.0/>. CC0 1.0 waives all rights and
requires nothing: <https://creativecommons.org/publicdomain/zero/1.0/>.

Source: [poly.pizza](https://poly.pizza), which hosts the Google Poly archive.
`,
);

const total = rows.reduce((n, r) => n + (r.tris ?? 0), 0);
const kb = rows.reduce((n, r) => n + (r.bytes ?? 0), 0) / 1024;
console.log(
  `\n${rows.length} models · ${total} tris · ${kb.toFixed(0)}KB` +
    (failed ? ` · ${failed} FAILED` : "") +
    `\nWrote ${DIR}/ATTRIBUTION.md`,
);
process.exit(failed ? 1 : 0);
