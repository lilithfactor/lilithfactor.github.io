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

/** How far a face colour travels toward --stage-cut to become its own edge. */
const DEPTH = 0.56;

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
