/**
 * prepare-models — turns the hi-fi downloads in models-src/ into desk-ready
 * models in public/models/.
 *
 * Three things get thrown away, all because the desk supplies them itself:
 * textures (every model is repainted with the paper Lambert, so a PBR set is
 * bytes we download in order to ignore), density (1.75M triangles of CAD
 * geometry reads identically at 10k once it is paper), and the exporter's
 * mesh grouping.
 *
 * That last one is the only custom step here. Exporters group by MATERIAL, so
 * the lamp's shade and base arrive inside one "body" mesh and no rotation can
 * pivot the head — which the lamp rig requires. They split cleanly on height:
 * the shade shell sits at Y 31..48 and the arm tops out at 29.3, so a cut at 30
 * passes through empty space and severs no geometry.
 *
 * Run: node scripts/prepare-models.mjs   (models-src/ is git-ignored)
 */
import { NodeIO } from "@gltf-transform/core";
import { dedup, prune, weld, simplify } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import { mkdir, stat } from "node:fs/promises";

const SRC = "models-src";
const OUT = "public/models";

const JOBS = [
  // ratio 0.006 → ~10k triangles. headY is measured, not guessed: see the gap above.
  { src: "lamp-hifi.glb", out: "lamp.glb", ratio: 0.006, headY: 30, label: "desk lamp" },
  { src: "record-player-hifi.glb", out: "turntable.glb", ratio: 1, label: "record player" },
];

const io = new NodeIO();

const tris = (root) =>
  root
    .listMeshes()
    .reduce(
      (n, m) =>
        n + m.listPrimitives().reduce((k, p) => k + (p.getIndices()?.getCount() ?? 0) / 3, 0),
      0,
    );

/** Moves every triangle above `minY` into a node named "head". */
function splitHead(doc, minY) {
  const root = doc.getRoot();
  const head = doc.createMesh("head");
  const p = [0, 0, 0];

  for (const mesh of root.listMeshes()) {
    if (mesh === head) continue;
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices();
      const pos = prim.getAttribute("POSITION");
      const below = [];
      const above = [];
      for (let i = 0; i < idx.getCount(); i += 3) {
        const t = [idx.getScalar(i), idx.getScalar(i + 1), idx.getScalar(i + 2)];
        let y = 0;
        for (const v of t) {
          pos.getElement(v, p);
          y += p[1] / 3;
        }
        (y >= minY ? above : below).push(...t);
      }
      if (!above.length) continue;
      head.addPrimitive(
        prim.clone().setIndices(doc.createAccessor().setArray(new Uint32Array(above))),
      );
      if (below.length) prim.setIndices(doc.createAccessor().setArray(new Uint32Array(below)));
      else mesh.removePrimitive(prim);
    }
  }
  root.listScenes()[0].addChild(doc.createNode("head").setMesh(head));
  return head.listPrimitives().reduce((n, p) => n + p.getIndices().getCount() / 3, 0);
}

await mkdir(OUT, { recursive: true });

for (const job of JOBS) {
  const src = `${SRC}/${job.src}`;
  try {
    await stat(src);
  } catch {
    console.log(`· ${job.label} — ${src} missing, skipped`);
    continue;
  }

  const doc = await io.read(src);
  const root = doc.getRoot();
  const before = { tris: tris(root), tex: root.listTextures().length };

  // Detaching materials is what makes the textures unreferenced, which is what
  // lets prune actually delete them.
  for (const prim of root.listMeshes().flatMap((m) => m.listPrimitives())) prim.setMaterial(null);
  for (const m of root.listMaterials()) m.dispose();
  for (const t of root.listTextures()) t.dispose();

  await doc.transform(
    dedup(),
    // Weld before simplify: exported geometry splits vertices at every triangle
    // and a simplifier cannot collapse an edge that is not shared.
    weld(),
    ...(job.ratio < 1 ? [simplify({ simplifier: MeshoptSimplifier, ratio: job.ratio, error: 0.01 })] : []),
    prune(),
  );

  let head = 0;
  if (job.headY) {
    head = splitHead(doc, job.headY);
    if (!head) throw new Error(`${job.label}: nothing above Y=${job.headY} — the rig needs a head`);
  }

  await io.write(`${OUT}/${job.out}`, doc);
  const { size } = await stat(`${OUT}/${job.out}`);
  console.log(
    `✓ ${job.label} → ${job.out}  ${before.tris.toLocaleString()} → ${tris(root).toLocaleString()} tris, ` +
      `${before.tex} → 0 textures, ${(size / 1024).toFixed(0)}KB` +
      (head ? `, head = ${head} tris` : ""),
  );
}
