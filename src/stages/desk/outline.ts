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
  /** The live fold angle. The tuner writes this straight back to disk. */
  readonly threshold: number;
  /** Every drawn line at once. The "wire" theme turns the ink off. */
  setVisible(on: boolean): void;
  /** THE LINE BOIL. Called every frame; does nothing at amplitude 0. */
  boil(dt: number): void;
  setBoil(amount: number): void;
  setBoilRate(ms: number): void;
  readonly boilAmount: number;
  readonly boilRate: number;
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

/* --- THE LINE BOIL ---------------------------------------------------------
 * What a pencil test looks like: the same drawing re-drawn every few frames by
 * a hand that cannot put the line back in exactly the same place. The paper
 * holds still and the ink shivers, which is the whole tell — animating the
 * objects would be motion, and this is drawing.
 *
 * Done by nudging the baked line object inside its own parent, so nothing is
 * re-baked and no geometry is touched: one position and one rotation per root,
 * five times a second. The amounts are deliberately below the threshold of
 * "something moved" — 0.7mm on a 2.4m desk — because past that it stops being
 * a drawn line and starts being a loose one.
 *
 * Not on a per-frame lerp, on a HOLD: a boil that interpolates is a wobble.
 * The jump is the point. */
const BOIL_SHIFT = 0.0007;
const BOIL_TURN = 0.2 * (Math.PI / 180);

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
  let boilAmount = 0;
  let boilRate = 110;
  let boilClock = 0;
  const roots: Object3D[] = [];

  /* --- THE DEV GUARD: ink left behind ---------------------------------------
   * `ownOutline` has now been forgotten four times — the lamp head, the blind,
   * its bottom rail, the notes — and every time it showed up as a black
   * rectangle floating beside the thing it was drawn around. The cheap way to
   * catch the fifth is to notice that what gets frozen into a line is each
   * mesh's transform RELATIVE TO ITS ROOT: the root may be moved, lifted,
   * dragged by the tuner or boiled without a word, but if that relative matrix
   * changes after the bake, the ink is standing where the object used to be.
   *
   * So the bake keeps a copy per mesh on the root, and the tick compares them
   * once a second. Dev only, all of it: no snapshots, no walk and no string in
   * a production build. */
  interface Baked {
    readonly mesh: Object3D;
    readonly at: Float32Array;
  }
  const warned = new Set<Object3D>();
  let watchClock = 0;
  function checkDrift(dt: number): void {
    watchClock += dt;
    if (watchClock < 1) return;
    watchClock = 0;
    const now = new Matrix4();
    const inverse = new Matrix4();
    for (const root of roots) {
      const baked = root.userData.baked as Baked[] | undefined;
      if (!baked) continue;
      root.updateMatrixWorld(true);
      inverse.copy(root.matrixWorld).invert();
      for (const { mesh, at } of baked) {
        if (warned.has(mesh)) continue;
        now.copy(inverse).multiply(mesh.matrixWorld);
        if (now.elements.every((v, i) => Math.abs(v - (at[i] ?? 0)) < 1e-4)) continue;
        warned.add(mesh);
        const name = mesh.name || `${mesh.type} under ${root.name || root.type}`;
        console.warn(
          `[outline] "${name}" moved after its line was baked, so its ink stayed behind — set userData.ownOutline on ${name}`,
        );
      }
    }
  }

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
    const baked: Baked[] = [];
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
      if (import.meta.env.DEV) baked.push({ mesh, at: new Float32Array(matrix.elements) });
      edges.applyMatrix4(matrix);
      const array = edges.getAttribute("position").array;
      for (let i = 0; i < array.length; i++) positions.push(array[i] as number);
      edges.dispose();

      for (const child of o.children) walk(child);
    };
    walk(root);
    if (import.meta.env.DEV) root.userData.baked = baked;

    if (!positions.length) return;
    const geometry = new LineSegmentsGeometry().setPositions(positions);
    const lines = new LineSegments2(geometry, material);
    lines.name = "outline";
    lines.userData.noOutline = true;
    // Never a hit target, and never nudged by the hover lift.
    lines.raycast = () => {};
    root.add(lines);
  }

  /** The baked line under a root, if it has one yet. */
  const lineOf = (root: Object3D): Object3D | undefined =>
    root.children.find((c) => c.name === "outline");

  const outlines: Outlines = {
    material,
    get boilAmount() {
      return boilAmount;
    },
    get boilRate() {
      return boilRate;
    },
    get threshold() {
      return threshold;
    },
    setVisible(on) {
      material.visible = on;
    },
    setBoil(amount) {
      boilAmount = amount;
      // Back to where it was drawn, or the last shiver stays frozen in.
      if (amount <= 0) {
        for (const root of roots) lineOf(root)?.position.set(0, 0, 0);
      }
    },
    setBoilRate(ms) {
      boilRate = ms;
    },
    boil(dt) {
      // Not inside the early return below: the guard has to run whether or not
      // the ink is boiling.
      if (import.meta.env.DEV) checkDrift(dt);
      if (boilAmount <= 0) return;
      boilClock += dt * 1000;
      if (boilClock < boilRate) return;
      boilClock = 0;
      for (const root of roots) {
        const line = lineOf(root);
        if (!line) continue;
        const jump = () => (Math.random() - 0.5) * 2 * BOIL_SHIFT * boilAmount;
        line.position.set(jump(), jump(), jump());
        line.rotation.y = (Math.random() - 0.5) * 2 * BOIL_TURN * boilAmount;
      }
    },
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
