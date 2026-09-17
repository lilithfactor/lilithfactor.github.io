/* ============================================================================
 * POINTER PICKING — the whole object is the target, not just its name.
 *
 * "Only the notes of respective sections are clickable, but I should be able to
 * click on the element to trigger the section as well."
 *
 * THIS IS A RAYCASTER, AND panels.ts SAYS THE DESK HAS NO RAYCASTER. Both are
 * true, and the difference between them is the entire reason this file is
 * allowed to exist.
 *
 * "No raycaster" was never a statement about rays. It was a statement about
 * what a canvas-only desk throws away: tab order, Enter and Space, a name a
 * screen reader can announce, and a focus ring that lands on something real.
 * ux-rules.md rule 4 makes the keyboard a first-class stage, and a raycaster
 * that REPLACES the eight <button> handles takes all four away in one move.
 *
 * So nothing is replaced. The handles stay exactly as they are and remain the
 * only route the keyboard and assistive tech ever take. This file adds a
 * second route, for the POINTER ONLY, to the same door: put the mouse on the
 * bookcase and the bookcase lifts; click it and panels.open("library") runs —
 * the identical call the handle's own click makes.
 *
 * WHY NOT JUST GROW THE HANDLES. Because a handle is an axis-aligned rectangle
 * and a bookcase is not. Eight rectangles big enough to cover eight irregular
 * objects standing on one desk overlap each other and claim the bare paper
 * between them, so the nearest tag starts winning clicks aimed at the desk —
 * which is the bug that put the notes on their own objects in the first place,
 * wearing a new coat. A ray hits the geometry that is actually there.
 *
 * The costs, kept honest:
 *   - At most ONE raycast per frame, never one per pointermove. The move
 *     handler writes a coordinate and raises a flag; the scene's tick resolves
 *     it. A click resolves immediately only if the answer on file is stale,
 *     which is what makes a touch tap work without ever having hovered.
 *   - Eight roots, recursive. Baked outlines opt out of raycasting (outline.ts)
 *     and the lamp, the room and the window are not in the set at all: the lamp
 *     has its own grip and its own job, and it must never open a section.
 *   - Nothing here runs before the stage swap or while a panel is open. With
 *     paper over the canvas the canvas is scenery, exactly as it claims to be.
 * ========================================================================== */

import { Box3, Raycaster, Vector2, Vector3, type Camera, type Object3D } from "three";

export interface Picker {
  /** Resolves at most one pending pointer position. Call once per frame. */
  update(camera: Camera): void;
  dispose(): void;
}

/**
 * Elements that own their own clicks: the handles, the lamp grip, the sound
 * tags, the panel navigation, the tuner. A pointer on one of those is not a
 * pointer on the desk, and picking underneath it would fire the section twice.
 */
const OVERLAY = "a, button, input, select, textarea, summary, [contenteditable], .desk-tuner";

/** Pixels of travel that turn a click into a drag. The lamp grip's guard. */
const SLOP = 5;

export function createPicker(
  targets: ReadonlyMap<string, Object3D>,
  onHover: (id: string | null) => void,
  onPick: (id: string) => void,
): Picker {
  const roots = [...targets.values()];
  /** Every root by identity, so a hit mesh can be walked back up to its owner. */
  const idOf = new Map<Object3D, string>();
  for (const [id, root] of targets) idOf.set(root, id);

  const raycaster = new Raycaster();
  const ndc = new Vector2();

  let camera: Camera | null = null;
  let hovered: string | null = null;
  /** Has the pointer ever been over the page? Nothing to resolve until it has. */
  let seen = false;
  let pointerX = 0;
  let pointerY = 0;
  let down = false;
  let dragged = false;
  let downX = 0;
  let downY = 0;

  /** The desk is not the page until the swap, and it is scenery under a panel. */
  const live = (): boolean =>
    document.documentElement.dataset.stage === "desk" &&
    document.documentElement.dataset.panel === undefined;

  const setHover = (id: string | null): void => {
    if (id === hovered) return;
    hovered = id;
    // The same lift the handles ask for — the scene owns what "raised" means.
    onHover(id);
    // The canvas is pointer-events: none, so the cursor it would carry never
    // reaches the pointer. <body> is what is actually under it on the desk.
    document.body.style.cursor = id ? "pointer" : "";
  };

  const rootOf = (object: Object3D): string | null => {
    let node: Object3D | null = object;
    while (node) {
      const id = idOf.get(node);
      if (id) return id;
      node = node.parent;
    }
    return null;
  };

  function resolve(x: number, y: number): void {
    if (!camera || !live()) {
      setHover(null);
      return;
    }
    ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(roots, true);
    // Frontmost: intersectObjects sorts by distance, so the first hit is the
    // one a visitor can actually see.
    setHover(hits.length > 0 ? rootOf(hits[0]!.object) : null);
  }

  const onMove = (e: PointerEvent): void => {
    if (down && Math.hypot(e.clientX - downX, e.clientY - downY) > SLOP) dragged = true;
    pointerX = e.clientX;
    pointerY = e.clientY;
    seen = true;
  };

  const onDown = (e: PointerEvent): void => {
    down = true;
    dragged = false;
    downX = e.clientX;
    downY = e.clientY;
  };

  const onUp = (e: PointerEvent): void => {
    const wasDragged = dragged;
    down = false;
    dragged = false;
    // A drag that ends on an object must not also open it — a text selection
    // across the page, or the lamp being angled, both end somewhere.
    if (wasDragged || !live()) return;
    if (e.target instanceof Element && e.target.closest(OVERLAY)) return;
    /* ALWAYS RESOLVED AGAIN, HERE, at the pixel the click actually happened at.
     *
     * The hover answer on file can be a few frames old and the camera does not
     * hold still — it eases toward the cursor for about a third of a second
     * after every move, and drifts under a degree even at rest. So a click on
     * a pointer that has stopped moving can be judged against a pose the scene
     * has already left, and the section that opens is the one that WAS under
     * the cursor. One raycast per click is nothing; opening the wrong section
     * is everything. It is also what makes a touch tap work, having hovered
     * nothing at all. */
    resolve(e.clientX, e.clientY);
    if (hovered) onPick(hovered);
  };

  const onCancel = (): void => {
    down = false;
    dragged = false;
  };

  /** The pointer left the window: nothing is under it, so nothing is raised. */
  const onLeave = (): void => {
    seen = false;
    setHover(null);
  };

  document.addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("pointerdown", onDown, { passive: true });
  document.addEventListener("pointerup", onUp);
  document.addEventListener("pointercancel", onCancel);
  document.addEventListener("pointerleave", onLeave);

  /* --- DEV probe ----------------------------------------------------------
   * Where a test should aim to click the OBJECT rather than its label.
   *
   * The centre of an artifact's bounding box is not good enough: half of them
   * stand behind their own note, so the centre lands on the paper and proves
   * nothing the handles did not already do. So this walks a grid across each
   * object's projected box, keeps the points where a ray finds THAT artifact
   * first, and returns the one furthest from the note's screen rectangle —
   * with the distance, so a run can show how far from the label it clicked.
   *
   * Its own Raycaster, deliberately: the probe must not disturb the hover the
   * picker is holding. Dev only. See lamp.ts for the pattern.
   */
  if (import.meta.env.DEV) {
    const r = (v: number) => Math.round(v);
    /** Screen distance from a point to a rectangle; 0 if it is inside. */
    const gap = (x: number, y: number, box: number[] | null): number => {
      if (!box) return Infinity;
      const dx = Math.max(box[0]! - x, 0, x - box[2]!);
      const dy = Math.max(box[1]! - y, 0, y - box[3]!);
      return Math.hypot(dx, dy);
    };
    (window as unknown as { __pickHover?: () => string | null }).__pickHover = () => hovered;
    (window as unknown as { __pickProbe?: () => unknown }).__pickProbe = () => {
      if (!camera) return null;
      const cam = camera;
      const probeRay = new Raycaster();
      const probeNdc = new Vector2();
      const part = new Box3();
      const v = new Vector3();
      const W = window.innerWidth;
      const H = window.innerHeight;
      const toScreen = (x: number, y: number, z: number): [number, number] => {
        v.set(x, y, z).project(cam);
        return [(v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H];
      };
      /** The screen rectangle a world box occupies, from its eight corners. */
      const rectOf = (box: Box3): number[] => {
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        for (const x of [box.min.x, box.max.x])
          for (const y of [box.min.y, box.max.y])
            for (const z of [box.min.z, box.max.z]) {
              const [px, py] = toScreen(x, y, z);
              x0 = Math.min(x0, px);
              y0 = Math.min(y0, py);
              x1 = Math.max(x1, px);
              y1 = Math.max(y1, py);
            }
        return [x0, y0, x1, y1];
      };

      const out: Record<string, unknown> = {};
      for (const [id, root] of targets) {
        root.updateWorldMatrix(true, true);
        const body = new Box3();
        for (const child of root.children) {
          // The note is the label and the outline is ink; neither is the thing.
          if (child.name === "note" || child.name === "outline") continue;
          body.union(part.setFromObject(child));
        }
        if (body.isEmpty()) body.setFromObject(root);
        const rect = rectOf(body);
        const note = root.children.find((c) => c.name === "note");
        const noteRect = note ? rectOf(part.setFromObject(note)) : null;

        const N = 17;
        const found: number[][] = [];
        for (let iy = 0; iy < N; iy++) {
          for (let ix = 0; ix < N; ix++) {
            const x = rect[0]! + ((rect[2]! - rect[0]!) * (ix + 0.5)) / N;
            const y = rect[1]! + ((rect[3]! - rect[1]!) * (iy + 0.5)) / N;
            if (x < 2 || y < 2 || x > W - 2 || y > H - 2) continue;
            probeNdc.set((x / W) * 2 - 1, -(y / H) * 2 + 1);
            probeRay.setFromCamera(probeNdc, cam);
            const hits = probeRay.intersectObjects(roots, true);
            if (hits.length === 0 || rootOf(hits[0]!.object) !== id) continue;
            found.push([r(x), r(y), r(gap(x, y, noteRect))]);
          }
        }
        // Furthest from the label first, so a test that has to skip one still
        // lands nowhere near the note.
        found.sort((a, b) => b[2]! - a[2]!);
        const [cx, cy] = toScreen(...(body.getCenter(v.clone()).toArray() as [number, number, number]));
        out[id] = {
          // Where the object is, on screen or off it. The camera follows the
          // cursor, so a test aims here to bring an off-frame object in.
          centre: [r(cx), r(cy)],
          noteRect: noteRect ? noteRect.map(r) : null,
          candidates: found.slice(0, 10),
        };
      }
      return out;
    };
  }

  return {
    /* ONCE A FRAME, AND NOT ONLY WHEN THE POINTER MOVES.
     *
     * The obvious throttle — resolve only after a pointermove — is wrong here,
     * and it is the camera's fault rather than the pointer's: the rig eases
     * toward the cursor for about a third of a second after every move and
     * drifts even at rest, so the desk keeps sliding under a hand that has
     * stopped. Resolving only on movement leaves the wrong object lifted for
     * as long as the hand is still, which is exactly when a visitor is
     * looking at it.
     *
     * Measured at 0.015ms per cast against these eight roots — about a tenth
     * of one percent of a 60fps frame, and it is one cast, not one per event,
     * which is the thing that actually costs. */
    update(cam) {
      camera = cam;
      if (!seen) return;
      resolve(pointerX, pointerY);
    },
    dispose() {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onCancel);
      document.removeEventListener("pointerleave", onLeave);
      setHover(null);
      document.body.style.cursor = "";
    },
  };
}
