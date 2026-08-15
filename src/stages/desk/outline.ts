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
    const existing = root.getObjectByName("outline");
    if (existing) {
      (existing as LineSegments2).geometry.dispose();
      existing.removeFromParent();
    }

    const positions: number[] = [];
    const matrix = new Matrix4();
    root.updateMatrixWorld(true);
    const inverse = new Matrix4().copy(root.matrixWorld).invert();

    root.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      // The contact shadows and the lamp's pool are painted light, not paper;
      // an outline round a shadow is a rectangle lying on the desk.
      if (mesh.userData.noOutline) return;

      const edges = new EdgesGeometry(mesh.geometry, threshold);
      // Into the artifact's own space, so the baked lines move, lift and rotate
      // with the object exactly as its meshes do.
      matrix.copy(inverse).multiply(mesh.matrixWorld);
      edges.applyMatrix4(matrix);
      const array = edges.getAttribute("position").array;
      for (let i = 0; i < array.length; i++) positions.push(array[i] as number);
      edges.dispose();
    });

    if (!positions.length) return;
    const geometry = new LineSegmentsGeometry().setPositions(positions);
    const lines = new LineSegments2(geometry, material);
    lines.name = "outline";
    lines.userData.noOutline = true;
    // Never a hit target, and never nudged by the hover lift.
    lines.raycast = () => {};
    root.add(lines);
  }

  return {
    material,
    apply(root) {
      roots.push(root);
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
      for (const root of roots) bake(root);
    },
  };
}

/** Shared by the tuner: the visual extent of anything, for sane slider ranges. */
export function extentOf(o: Object3D): Vector3 {
  return new Box3().setFromObject(o).getSize(new Vector3());
}
