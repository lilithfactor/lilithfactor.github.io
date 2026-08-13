/* ============================================================================
 * ANCHORS — the bridge between the canvas and the document.
 *
 * architecture.md Directive 2, in code. The canvas renders the stage; the DOM
 * renders the content; the only thing that crosses between them is four
 * numbers per object per frame.
 *
 * Each 3D object exposes a world-space anchor. Every frame the anchor is
 * projected through the camera into viewport pixels and written to --x / --y /
 * --scale / --a on the matching [data-artifact] node. The DOM node stays a
 * normal, selectable, screen-readable section of the page — it just knows
 * where its object is. No text is ever rendered into the canvas, so nothing
 * here can cost a visitor Cmd-F, translation, or a screen reader.
 *
 * Writes are transform inputs only. Nothing here ever produces a top, left,
 * width or height, so a frame of this loop cannot trigger layout.
 * ========================================================================== */

import { Vector3, type Camera } from "three";
import type { ArtifactId } from "./layout";

export interface Binding {
  readonly id: ArtifactId;
  readonly el: HTMLElement;
  /** World space. Fixed at build time — the hover lift must not drag the label. */
  readonly anchor: Vector3;
  /** Last written values, so an unchanged frame writes nothing at all. */
  last: { x: number; y: number; scale: number; visible: boolean };
}

/**
 * Pairs objects with their sections. A section with no object, or an object
 * with no section, is a contract break between layout.ts and the page — it is
 * skipped rather than guessed at, and the desk still mounts, because a missing
 * marker is invisible while a thrown error takes the whole stage down.
 */
export function bindAnchors(
  anchors: ReadonlyMap<ArtifactId, Vector3>,
  root: ParentNode = document,
): Binding[] {
  const bindings: Binding[] = [];
  for (const [id, anchor] of anchors) {
    const el = root.querySelector<HTMLElement>(`[data-artifact="${id}"]`);
    if (!el) continue;
    bindings.push({
      id,
      el,
      anchor,
      last: { x: NaN, y: NaN, scale: NaN, visible: false },
    });
  }
  return bindings;
}

const ndc = new Vector3();

/**
 * Projects every anchor and writes the result.
 *
 * `reference` is the camera's distance to the desk at the overview framing, so
 * --scale reads as 1 at rest and grows as the camera moves in. Sub-pixel
 * changes are dropped: at 60fps a jitter of 0.4px is invisible and still costs
 * a style recalculation on eight elements.
 */
export function projectAnchors(
  bindings: readonly Binding[],
  camera: Camera,
  width: number,
  height: number,
  reference: number,
): void {
  for (const b of bindings) {
    ndc.copy(b.anchor).project(camera);

    // z outside [-1, 1] is behind the camera or past the far plane. The 1.06
    // on x and y is the frame plus about a marker's radius: --a means "you can
    // actually see where this section lives", and a marker pinned to the
    // outside of the viewport is not an answer to that.
    const visible =
      ndc.z > -1 && ndc.z < 1 && Math.abs(ndc.x) < 1.06 && Math.abs(ndc.y) < 1.06;

    const x = Math.round((ndc.x * 0.5 + 0.5) * width * 2) / 2;
    const y = Math.round((-ndc.y * 0.5 + 0.5) * height * 2) / 2;
    const distance = camera.position.distanceTo(b.anchor);
    const scale = Math.round((reference / Math.max(distance, 0.001)) * 1000) / 1000;

    const { last } = b;
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
    for (const prop of ["--x", "--y", "--scale", "--a"]) {
      b.el.style.removeProperty(prop);
    }
  }
}
