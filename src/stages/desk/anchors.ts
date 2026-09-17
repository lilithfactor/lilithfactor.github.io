/* ============================================================================
 * ANCHORS — the bridge between the canvas and the document.
 *
 * architecture.md Directive 2, in code. The canvas renders the stage; the DOM
 * renders the content; the only thing that crosses between them is a handful
 * of numbers per object per frame.
 *
 * Each 3D object exposes a world-space anchor. Every frame the anchor is
 * projected through the camera into viewport pixels and written to --x / --y /
 * --scale / --a on the matching [data-artifact] node. The DOM node stays a
 * normal, selectable, screen-readable section of the page — it just knows
 * where its object is. No text is ever rendered into the canvas, so nothing
 * here can cost a visitor Cmd-F, translation, or a screen reader.
 *
 * A HANDLE IS MEASURED, NOT GUESSED.
 *
 * The [data-anchor] buttons are the desk's whole hit test (see panels.ts), and
 * they used to be a fixed 7rem x 6rem box parked at the object's anchor. Two
 * things made that wrong at once. The box was sized for a 200mm note and the
 * notes are 120mm, so eight oversized rectangles overlapped each other and
 * DOM order — not depth — decided who took the click. And the anchor is not
 * where the note is: `note.<id>.x/y/z` moves a note around its object, so on
 * library (note.x 0.42) the button sat nearly half a metre from the paper it
 * was supposed to be.
 *
 * So a handle tracks its NOTE, and projects the note's actual extent: the
 * note's local box, measured once, pushed through its live world matrix and
 * projected as three points — bottom-centre, top-centre, right-centre. That
 * gives real --w/--h in pixels, and --z, an integer depth, so the nearer note
 * wins the click over a farther one. Four projections times eight objects is
 * nothing beside the render they sit next to.
 *
 * Writes are transform inputs, sizes and a z-index. A width and a height CAN
 * cost layout — but on a `position: fixed` element with no in-flow children,
 * that layout is the element itself, which is the price of a hit area that is
 * the size of the thing it covers.
 * ========================================================================== */

import { Vector3, type Camera, type Object3D } from "three";
import type { ArtifactId } from "./layout";

/**
 * A note's own size, measured ONCE in its own space — before it is leaned,
 * scaled or parented, so this box IS the note's local geometry with no inverse
 * to get wrong. Everything that happens to the note afterwards (the lean, the
 * per-note scale, the object moving across the desk, the yaw written every
 * frame to keep it square to the view) lives in `object.matrixWorld`, which is
 * read live. That is what makes the hit area follow the paper for free.
 */
export interface NoteExtent {
  readonly object: Object3D;
  readonly centreX: number;
  readonly centreZ: number;
  readonly minY: number;
  readonly maxY: number;
  readonly halfX: number;
}

export interface Binding {
  readonly id: ArtifactId;
  readonly el: HTMLElement;
  /** World space. Fixed at build time — the hover lift must not drag the label. */
  readonly anchor: Vector3;
  /** Set on a handle whose object has a note: the paper the button must cover. */
  readonly extent?: NoteExtent;
  /** Last written values, so an unchanged frame writes nothing at all. */
  last: {
    x: number;
    y: number;
    scale: number;
    w: number;
    h: number;
    z: number;
    visible: boolean;
  };
}

/**
 * Pairs objects with their sections. A section with no object, or an object
 * with no section, is a contract break between layout.ts and the page — it is
 * skipped rather than guessed at, and the desk still mounts, because a missing
 * marker is invisible while a thrown error takes the whole stage down.
 */
export function bindAnchors(
  anchors: ReadonlyMap<ArtifactId, Vector3>,
  notes: ReadonlyMap<ArtifactId, NoteExtent> = new Map(),
  root: ParentNode = document,
): Binding[] {
  const bindings: Binding[] = [];
  for (const [id, anchor] of anchors) {
    // Two kinds of node track an anchor, and both need the projection:
    //   [data-artifact] — the section itself, which becomes the open panel
    //   [data-anchor]   — its handle: the little paper tag sitting ON the
    //                     object, which is what a visitor actually clicks.
    // The handle exists because the panel is centred and hidden when closed,
    // so it cannot double as the object's hit area. See stages/panels.ts.
    const nodes = root.querySelectorAll<HTMLElement>(
      `[data-artifact="${id}"], [data-anchor="${id}"]`,
    );
    for (const el of nodes) {
      // Only the handle gets the note box. The section's marker is a dot at
      // the object's anchor and is meant to stay one.
      const extent = el.hasAttribute("data-anchor") ? notes.get(id) : undefined;
      bindings.push({
        id,
        el,
        anchor,
        ...(extent ? { extent } : {}),
        last: { x: NaN, y: NaN, scale: NaN, w: NaN, h: NaN, z: NaN, visible: false },
      });
    }
  }
  return bindings;
}

const ndc = new Vector3();
const corner = new Vector3();
/** The note's front face, as a unit square in its own space. */
const CORNERS = [
  [-1, 0],
  [1, 0],
  [-1, 1],
  [1, 1],
] as const;

/** NDC → viewport pixels. Half-pixel steps: below that nothing is visible and
 * every write still costs a style recalculation on eight elements. */
const toX = (n: number, width: number) => Math.round((n * 0.5 + 0.5) * width * 2) / 2;
const toY = (n: number, height: number) => Math.round((-n * 0.5 + 0.5) * height * 2) / 2;

/**
 * z outside [-1, 1] is behind the camera or past the far plane. The 1.06 on x
 * and y is the frame plus about a marker's radius: --a means "you can actually
 * see where this section lives", and a marker pinned to the outside of the
 * viewport is not an answer to that.
 */
const onScreen = (v: Vector3) =>
  v.z > -1 && v.z < 1 && Math.abs(v.x) < 1.06 && Math.abs(v.y) < 1.06;

/**
 * Projects every anchor and writes the result.
 *
 * `reference` is the camera's distance to the desk at the overview framing, so
 * --scale reads as 1 at rest and grows as the camera moves in.
 */
export function projectAnchors(
  bindings: readonly Binding[],
  camera: Camera,
  width: number,
  height: number,
  reference: number,
): void {
  for (const b of bindings) {
    const { last } = b;

    if (b.extent) {
      /* --- A handle: the note's box, in pixels -----------------------------
       * The four corners of the note's front face, pushed through its live
       * world matrix and projected. The screen box is their bounding box, so
       * it stays right when perspective skews a note near the edge of the
       * frame — which a centre-and-half-width estimate gets ~20% too narrow. */
      const e = b.extent;
      const m = e.object.matrixWorld;
      let inFront = true;
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const [sx, sy] of CORNERS) {
        corner
          .set(e.centreX + sx * e.halfX, sy ? e.maxY : e.minY, e.centreZ)
          .applyMatrix4(m)
          .project(camera);
        if (corner.z <= -1 || corner.z >= 1) inFront = false;
        const px = toX(corner.x, width);
        const py = toY(corner.y, height);
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }

      // Depth from the world centre of that face. Linear and comparable,
      // where NDC z is neither.
      corner
        .set(e.centreX, (e.minY + e.maxY) / 2, e.centreZ)
        .applyMatrix4(m);
      const depth = camera.position.distanceTo(corner);

      // --x is the box's centre and --y its foot: the CSS translates by
      // -50% / -100% from there. See desk-panels.css.
      const x = (minX + maxX) / 2;
      const y = maxY;
      const w = maxX - minX;
      const h = maxY - minY;

      /* Visible means "some of this note is actually in the frame". The box
       * rather than one point, so a note half off the edge keeps its tag: the
       * visitor can see it, so it has to stay clickable. */
      const visible = inFront && maxX > 0 && minX < width && maxY > 0 && minY < height;

      /* An integer 1..1000, nearer is higher, so a note in front of another
       * takes the click. Anything past 10m of desk is already clamped, and
       * 10mm of separation is one step — finer than the objects ever are. */
      const z = Math.max(1, Math.min(1000, 1000 - Math.round(depth * 100)));

      if (visible !== last.visible) {
        b.el.style.setProperty("--a", visible ? "1" : "0");
        last.visible = visible;
      }
      if (!visible) continue;
      if (x !== last.x) {
        b.el.style.setProperty("--x", `${x}px`);
        last.x = x;
      }
      if (y !== last.y) {
        b.el.style.setProperty("--y", `${y}px`);
        last.y = y;
      }
      if (w !== last.w) {
        b.el.style.setProperty("--w", `${w}px`);
        last.w = w;
      }
      if (h !== last.h) {
        b.el.style.setProperty("--h", `${h}px`);
        last.h = h;
      }
      if (z !== last.z) {
        b.el.style.setProperty("--z", `${z}`);
        last.z = z;
      }
      continue;
    }

    /* --- A section: one point, the object's anchor ------------------------ */
    ndc.copy(b.anchor).project(camera);
    const visible = onScreen(ndc);
    const x = toX(ndc.x, width);
    const y = toY(ndc.y, height);
    const distance = camera.position.distanceTo(b.anchor);
    const scale = Math.round((reference / Math.max(distance, 0.001)) * 1000) / 1000;

    if (visible !== last.visible) {
      b.el.style.setProperty("--a", visible ? "1" : "0");
      last.visible = visible;
    }
    if (!visible) continue;

    if (x !== last.x) {
      b.el.style.setProperty("--x", `${x}px`);
      last.x = x;
    }
    if (y !== last.y) {
      b.el.style.setProperty("--y", `${y}px`);
      last.y = y;
    }
    if (scale !== last.scale) {
      b.el.style.setProperty("--scale", `${scale}`);
      last.scale = scale;
    }
  }
}

/** On teardown the sections must be left exactly as the server rendered them. */
export function clearAnchors(bindings: readonly Binding[]): void {
  for (const b of bindings) {
    for (const prop of ["--x", "--y", "--scale", "--a", "--w", "--h", "--z"]) {
      b.el.style.removeProperty(prop);
    }
  }
}
