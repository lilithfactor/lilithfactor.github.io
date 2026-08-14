/* ============================================================================
 * THE DRAWN EDGE — a black line around everything.
 *
 * The scene is cut from one paper now (see stage.css). Colour used to separate
 * a kraft crate from an aged sheet from an ink plinth; with every object the
 * same off-white, shading alone leaves two touching objects as one blob. So the
 * separation is drawn instead: an ink line along every hard edge, which is what
 * a paper model *illustrated* rather than photographed looks like.
 *
 * EdgesGeometry, not a post-process outline pass and not an inverted hull:
 *
 *   A post pass (EffectComposer + normal/depth edge detection) would need a
 *   second render target and a full-screen shader — a real cost on the low end,
 *   for an effect that also outlines nothing *inside* a silhouette.
 *   An inverted hull is the usual cheap trick, but it only draws silhouettes,
 *   and it fails outright on the thing this scene is mostly made of: flat
 *   sheets, whose scaled-up backface pokes through the front.
 *
 * EdgesGeometry draws exactly the folds — every edge whose two faces disagree
 * by more than a threshold — which on a paper model is precisely the crease and
 * cut lines a pen would follow.
 *
 * Cost control: every mesh under one artifact is baked into ONE LineSegments,
 * with each mesh's transform applied to its edges first. Nine artifacts and a
 * room means ten line draws for the entire scene rather than sixty.
 * ========================================================================== */

import {
  BufferGeometry,
  Color,
  EdgesGeometry,
  Float32BufferAttribute,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  type Object3D,
} from "three";

/**
 * Below this angle between two faces, an edge is not drawn.
 *
 * 38 degrees, and the number is load-bearing. A 12-sided cylinder (the lamp
 * base) breaks at 30 degrees and a 20-sided one (the record) at 18, so anything
 * under 30 rings every turned object with a cage of lines. Low-poly downloaded
 * models are worse: at 24 the 200-triangle chess knights drew so many edges
 * they rendered as solid black blobs.
 *
 * Above 38 the real folds start dropping out — the 8-facet lampshade cone
 * breaks at 45 and has to keep its creases, which sets the ceiling. Box corners
 * at 90 are never in danger from either side.
 */
const THRESHOLD = 38;

export function createOutlines(line: Color): {
  /** Bakes one line mesh for everything under `root` and parents it there. */
  apply(root: Object3D): void;
  material: LineBasicMaterial;
} {
  // One material for the whole scene. `toneMapped: false` so the ink stays the
  // ink: run through the Neutral curve it lifts to a soft grey, and the entire
  // point is that this is the one drawn, unlit thing in a lit model.
  const material = new LineBasicMaterial({ color: line, toneMapped: false });

  return {
    material,
    apply(root) {
      const positions: number[] = [];
      const matrix = new Matrix4();

      root.updateMatrixWorld(true);
      const inverse = new Matrix4().copy(root.matrixWorld).invert();

      root.traverse((o) => {
        const mesh = o as Mesh;
        if (!mesh.isMesh || !mesh.geometry) return;
        // Skip anything already drawn as ink or glow: the contact shadows and
        // the lamp's pool are painted light, and an outline around a shadow is
        // a rectangle sitting on the desk.
        if (mesh.userData.noOutline) return;

        const edges = new EdgesGeometry(mesh.geometry, THRESHOLD);
        // Into the artifact's own space, so the baked line mesh moves, lifts and
        // rotates with the object exactly as its meshes do.
        matrix.copy(inverse).multiply(mesh.matrixWorld);
        edges.applyMatrix4(matrix);
        const array = edges.getAttribute("position").array;
        for (let i = 0; i < array.length; i++) positions.push(array[i] as number);
        edges.dispose();
      });

      if (!positions.length) return;
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
      const lines = new LineSegments(geometry, material);
      lines.name = "outline";
      // Never outlined itself, and never a hit target for anything.
      lines.userData.noOutline = true;
      root.add(lines);
    },
  };
}
