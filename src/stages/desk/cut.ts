/* ============================================================================
 * THE CUT EDGE — the whole trick, in forty lines.
 *
 * What makes a paper-craft model read as paper is not the lighting and not the
 * texture. It is that every surface shows its own thickness. A sheet of card
 * seen face-on is its printed skin; seen side-on it is the compressed core of
 * the board, which is always darker and always denser. Your eye reads that
 * darker line as "this is a real thing that was cut", and it reads its absence
 * as "this is a coloured rectangle".
 *
 * So every piece of geometry on this desk is painted twice: its faces in the
 * card's colour, its edges in that colour blended toward --stage-cut. Which
 * faces count as "face" and which as "edge" falls out of the shape itself — for
 * a sheet, the two large faces are the ones perpendicular to its thinnest axis,
 * and everything else is a cut. Nothing has to be labelled by hand.
 *
 * It is done with a vertex colour attribute rather than a material per colour,
 * and that choice is doing a lot of work:
 *
 *   - One material for the entire model. A material is a shader program, and
 *     one program means one compile on the first frame instead of a dozen.
 *   - One draw call per mesh. The obvious implementation — a BoxGeometry with a
 *     six-entry material array, face material on top and edge material on the
 *     sides — costs one draw call *per geometry group*, so it would have turned
 *     forty meshes into a hundred and twenty.
 *   - Any number of colours for free. Adding a card colour costs a token, not
 *     a material.
 * ========================================================================== */

import { BufferAttribute, Color, type BufferGeometry } from "three";
import { blend } from "./palette";

/**
 * How far a face colour travels toward --stage-cut to become its own edge.
 *
 * Was 0.56, which was enough to see and not enough to read. The failure it left
 * behind is the one this whole direction exists to avoid: a model that is
 * *beige* rather than *made of paper*. A cut edge you have to look for is doing
 * none of the work — the eye needs a definite darker line at every change of
 * plane before it will accept that the shapes have thickness.
 *
 * 0.78 is close to the point where the edges start reading as outlines rather
 * than as board, which is the other failure mode, and where it stops was found
 * by rendering rather than by taste.
 */
const DEPTH = 0.78;

/** The cut edge of a given card. */
export function edgeOf(face: Color, cut: Color): Color {
  return blend(face, cut, DEPTH);
}

/**
 * Writes the face/edge colours into the geometry.
 *
 * `axis` is the one the large faces point along; a vertex whose normal is
 * mostly parallel to it is a face, and everything else is a cut. `invert` flips
 * that, which is what a rolled tube needs: the curved side is the paper and the
 * two ends are the cuts, exactly the opposite of a flat sheet.
 */
export function paint(
  geometry: BufferGeometry,
  face: Color,
  edge: Color,
  axis: 0 | 1 | 2,
  invert = false,
): BufferGeometry {
  const normal = geometry.getAttribute("normal");
  const colours = new Float32Array(normal.count * 3);
  for (let i = 0; i < normal.count; i++) {
    const n = axis === 0 ? normal.getX(i) : axis === 1 ? normal.getY(i) : normal.getZ(i);
    const c = Math.abs(n) > 0.5 !== invert ? face : edge;
    colours[i * 3] = c.r;
    colours[i * 3 + 1] = c.g;
    colours[i * 3 + 2] = c.b;
  }
  geometry.setAttribute("color", new BufferAttribute(colours, 3));
  return geometry;
}

/**
 * Flat normals, for anything that is meant to read as folded rather than
 * turned. A twelve-sided cone with smooth normals is a cone; the same cone with
 * one normal per facet is a lampshade someone scored and bent, which is the
 * only kind of lampshade this desk is allowed to have.
 *
 * Must run before `paint` — it rebuilds the vertex list.
 */
export function facet(geometry: BufferGeometry): BufferGeometry {
  const flat = geometry.toNonIndexed();
  flat.computeVertexNormals();
  geometry.dispose();
  return flat;
}

/* --- Nothing is flat -------------------------------------------------------
 * PERFECTLY FLAT IS THE TELL. A large sheet of card that is mathematically
 * planar is the single loudest "this was computed" signal in the model, louder
 * than the lighting and louder than the colour, because real paper cannot do
 * it: card is a laminate, it takes up moisture from one side, and a sheet the
 * size of the desk mat always has a gentle bow in it somewhere.
 *
 * The displacement is 2–6mm on a 2.7m sheet. It is not meant to be seen as a
 * shape. It is meant to make the SHADING across the sheet non-uniform and the
 * silhouette of its edge non-straight, which is what the eye actually reads. */

/** A seeded value in [-1, 1] for integer-ish inputs. Cheap, and stable per load. */
function wobble(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

/**
 * Bows a geometry along `axis`, as a function of the other two.
 *
 * Two cosine humps at right angles, plus a half-period phase offset, so the
 * sheet is never symmetrical about its own centre — a symmetrical bow reads as
 * a dish, and paper does not warp into dishes.
 *
 * Must run BEFORE `paint`: it recomputes normals, and `paint` classifies faces
 * by them. The recompute is what turns the bow into visible shading; without it
 * the sheet is displaced but still lit as if flat.
 */
export function bow(geometry: BufferGeometry, amount: number, axis: 0 | 1 | 2 = 1): BufferGeometry {
  const position = geometry.getAttribute("position");
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return geometry;

  const u = (axis + 1) % 3;
  const v = (axis + 2) % 3;
  const span = (i: number) => Math.max(box.max.getComponent(i) - box.min.getComponent(i), 1e-4);
  const su = span(u);
  const sv = span(v);

  for (let i = 0; i < position.count; i++) {
    const pu = (position.getComponent(i, u) - box.min.getComponent(u)) / su;
    const pv = (position.getComponent(i, v) - box.min.getComponent(v)) / sv;
    const lift =
      Math.cos((pu - 0.38) * Math.PI * 1.7) * 0.62 + Math.cos((pv - 0.55) * Math.PI * 1.3) * 0.38;
    position.setComponent(i, axis, position.getComponent(i, axis) + lift * amount);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * A DECKLE — the soft irregular edge a sheet has when it was torn rather than
 * guillotined.
 *
 * One or two torn edges in a model of otherwise cut card is worth more than any
 * amount of surfacing, because a straight edge is something a machine did and a
 * torn edge is something a hand did. It is the fastest available proof that the
 * thing on screen was *made*.
 *
 * Perturbs only the boundary vertices of a segmented plane, outward along the
 * edge they sit on, at two frequencies: a slow one for the wander of the tear
 * and a fast one for its fibres. `edges` names which sides are torn — a sheet
 * with all four torn is not a deckle, it is a scrap.
 *
 * Expects a PlaneGeometry in its own local space (normal down +Z), i.e. before
 * whatever rotation puts it on the desk.
 */
export function deckle(
  geometry: BufferGeometry,
  amount: number,
  edges: { left?: boolean; right?: boolean; top?: boolean; bottom?: boolean },
  seed = 1,
): BufferGeometry {
  const position = geometry.getAttribute("position");
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return geometry;

  const near = (a: number, b: number) => Math.abs(a - b) < 1e-4;

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    // Along-edge coordinate, so the tear is continuous down the side rather
    // than a per-vertex jitter — which would read as noise, not as a tear.
    const t = (x + y) * 37 + seed * 11;
    const tear = wobble(Math.floor(t), seed) * 0.62 + wobble(Math.floor(t * 2.7), seed + 3) * 0.38;
    // Torn edges lose material more often than they gain it: bias inward, so a
    // deckle never grows the sheet past the size it was cut to.
    const d = (tear - 0.35) * amount;

    if (edges.left && near(x, box.min.x)) position.setX(i, x - d);
    if (edges.right && near(x, box.max.x)) position.setX(i, x + d);
    if (edges.bottom && near(y, box.min.y)) position.setY(i, y - d);
    if (edges.top && near(y, box.max.y)) position.setY(i, y + d);
  }

  position.needsUpdate = true;
  return geometry;
}
