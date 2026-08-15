/* ============================================================================
 * THE DRAWN EDGE — a black line around everything.
 *
 * The scene is cut from one paper (see stage.css). Colour used to separate a
 * kraft crate from an aged sheet from an ink plinth; with every object the same
 * off-white, shading alone leaves two touching objects as one blob. So the
 * separation is drawn instead: an ink line along every hard edge, which is what
 * a paper model *illustrated* rather than photographed looks like.
 *
 * EdgesGeometry decides WHICH edges (every fold sharper than a threshold — on a
 * paper model, precisely the crease and cut lines a pen would follow). It is
 * not a post-process pass, which would need a second render target and would
 * outline nothing inside a silhouette, and not an inverted hull, which draws
 * only silhouettes and fails outright on the flat sheets this scene is mostly
 * made of.
 *
 * LineSegments2 draws them. Plain LineBasicMaterial ignores `linewidth` on
 * every WebGL platform — it is hardware-capped at one pixel — so the line was
 * always a hairline no matter what was asked for, and on a white desk a
 * hairline is barely an edge at all. LineSegments2 builds each segment from two
 * triangles, so width is real and tunable. It costs ~14KB of addon code and one
 * resolution uniform that has to track the canvas size.
 *
 * Cost control: every mesh under one artifact is baked into ONE line object,
 * with each mesh's transform applied to its edges first. Ten line draws for the
 * whole scene rather than sixty.
 * ========================================================================== */

import { Box3, Color, EdgesGeometry, Matrix4, Mesh, Vector3, type Object3D } from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";

export interface Outlines {
  /** Bakes one line object for everything under `root` and parents it there. */
  apply(root: Object3D): void;
  /** LineSegments2 needs the canvas size in pixels to size its quads. */
  resize(width: number, height: number): void;
  /** Live tuning: see tuner.ts. */
  setWidth(px: number): void;
  setColour(colour: Color): void;
  setThreshold(degrees: number): void;
  readonly material: LineMaterial;
}

/**
 * Default fold angle below which an edge is not drawn.
 *
 * A 12-sided cylinder (the lamp base) breaks at 30 degrees and a 20-sided one
 * at 18, so anything under 30 rings every turned object with a cage. Above ~45
 * the real folds start dropping out: the 8-facet lampshade cone breaks at 45
 * and has to keep its creases. Box corners at 90 are never at risk either way.
 */
const THRESHOLD = 38;
const WIDTH = 2.2;

export function createOutlines(line: Color): Outlines {
  // toneMapped false so the ink stays ink: run through the Neutral curve it
  // lifts to a soft grey, and the whole point is that this is the one drawn,
  // unlit thing in a lit model.
  const material = new LineMaterial({
    color: line.getHex(),
    linewidth: WIDTH,
    worldUnits: false,
    toneMapped: false,
    // Without this the far side of an object draws over the near side, which
    // on a white model turns every box into a wireframe cube.
    depthTest: true,
  });
  material.resolution.set(window.innerWidth, window.innerHeight);

  let threshold = THRESHOLD;
  const roots: Object3D[] = [];

  function bake(root: Object3D): void {
    // A DIRECT child, not a descendant. getObjectByName searches the whole
    // subtree, so on the room it found the lamp head's own line and deleted
    // that instead of the room's.
    const existing = root.children.find((c) => c.name === "outline");
    if (existing) {
      (existing as LineSegments2).geometry.dispose();
      existing.removeFromParent();
    }

    const positions: number[] = [];
    const matrix = new Matrix4();
    root.updateMatrixWorld(true);
    const inverse = new Matrix4().copy(root.matrixWorld).invert();

    /* A MANUAL WALK, because this has to stop descending and traverse cannot.
     *
     * The whole point of baking is that the lines are frozen into the root's
     * local space — which is what makes them travel with it for free. The cost
     * is that anything which moves INSIDE that root leaves its line behind: the
     * lamp head pivots and its ink stays pointing at where the shade used to
     * be, and the curtains slide open out of their own outlines.
     *
     * So a part that moves under its own steam is flagged `ownOutline` where it
     * is built, gets baked as its own root here, and is pruned from its
     * parent's. The knowledge stays next to the thing that moves, which is the
     * only place anyone will remember to put it. */
    const walk = (o: Object3D): void => {
      if (o !== root && o.userData.ownOutline) {
        outlines.apply(o);
        return;
      }

      const mesh = o as Mesh;
      if (!mesh.isMesh || !mesh.geometry) {
        for (const child of o.children) walk(child);
        return;
      }
      if (mesh.userData.noOutline) {
        for (const child of o.children) walk(child);
        return;
      }

      /* NOTHING TRANSPARENT GETS A LINE.
       *
       * Light is not paper. The lamp's glow, its pool and the contact shadows
       * are painted light, and an ink line around light is a drawn shape where
       * there is no object — the lamp's glow disc is a CircleGeometry, so it
       * came out as a perfect ring hanging in the air beside the lamp.
       *
       * Worth knowing WHY the fold threshold did not save us: EdgesGeometry
       * always emits boundary edges — edges with only one adjoining face —
       * whatever the angle. A flat disc is nothing but boundary, so it is the
       * one shape guaranteed to draw fully at any threshold.
       *
       * A material test rather than a flag on each object, because the flag has
       * to be remembered every time something new is added and this cannot be
       * forgotten. */
      const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      if (material && (material as { transparent?: boolean }).transparent) {
        for (const child of o.children) walk(child);
        return;
      }

      const edges = new EdgesGeometry(mesh.geometry, threshold);
      // Into the artifact's own space, so the baked lines move, lift and rotate
      // with the object exactly as its meshes do.
      matrix.copy(inverse).multiply(mesh.matrixWorld);
      edges.applyMatrix4(matrix);
      const array = edges.getAttribute("position").array;
      for (let i = 0; i < array.length; i++) positions.push(array[i] as number);
      edges.dispose();

      for (const child of o.children) walk(child);
    };
    walk(root);

    if (!positions.length) return;
    const geometry = new LineSegmentsGeometry().setPositions(positions);
    const lines = new LineSegments2(geometry, material);
    lines.name = "outline";
    lines.userData.noOutline = true;
    // Never a hit target, and never nudged by the hover lift.
    lines.raycast = () => {};
    root.add(lines);
  }

  const outlines: Outlines = {
    material,
    apply(root) {
      // A part that moves is baked by its parent's walk as well as by whoever
      // asked for it; without this, re-baking on a threshold change would keep
      // adding the same root and the list would grow every time.
      if (!roots.includes(root)) roots.push(root);
      root.userData.ownOutline = true;
      bake(root);
    },
    resize(width, height) {
      material.resolution.set(width, height);
    },
    setWidth(px) {
      material.linewidth = px;
    },
    setColour(colour) {
      material.color.set(colour);
    },
    setThreshold(degrees) {
      threshold = degrees;
      // Copied: a re-bake can discover a new sub-root and push onto `roots`.
      for (const root of [...roots]) bake(root);
    },
  };
  return outlines;
}

/** Shared by the tuner: the visual extent of anything, for sane slider ranges. */
export function extentOf(o: Object3D): Vector3 {
  return new Box3().setFromObject(o).getSize(new Vector3());
}
