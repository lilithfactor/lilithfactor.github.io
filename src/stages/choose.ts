/* ============================================================================
 * THE STAGE GATE — architecture.md Directive 3.
 *
 * Two stages, not one degraded stage. This module answers exactly one
 * question: may the desk mount? It is deliberately tiny and free of any
 * Three.js reference, because it ships in the initial page bundle and the 3D
 * chunk must not. See StageMount.astro.
 *
 * Every check here is a reason NOT to mount. There is no "try anyway" branch:
 * the DOM page is already complete and correct on its own, so falling through
 * is a designed outcome rather than a failure. ux-rules.md rule 9.
 * ========================================================================== */

export type Stage = "desk" | "stack";

/** Matches the island's media query. One number, one place. */
export const DESK_MIN_WIDTH = 1024;

/**
 * WebGL2 only — the desk's materials and shadow path assume it, and a WebGL1
 * fallback is a second renderer to maintain for machines that are, by 2026,
 * already choosing the stack stage on every other check anyway.
 *
 * The probe context is released immediately: creating one is cheap, holding
 * one is not, and browsers cap the number of live contexts per page.
 */
function hasWebGL2(): boolean {
  try {
    const probe = document.createElement("canvas");
    const gl = probe.getContext("webgl2");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The gate. Cheap checks first — the WebGL probe allocates, so it runs last
 * and only for viewports that could actually host the desk.
 */
export function canMountDesk(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  // Size: below this the desk has no room to be a desk rather than a diorama.
  if (!window.matchMedia(`(min-width: ${DESK_MIN_WIDTH}px)`).matches) return false;

  // A real pointer. `pointer: fine` also excludes the large touch screens that
  // pass the width check — a tablet gets the stack stage, which is the better
  // experience there regardless of its resolution.
  if (!window.matchMedia("(pointer: fine)").matches) return false;

  // Reduced motion is a real mode, not a degraded desk. ux-rules.md rule 2.
  if (prefersReducedMotion()) return false;

  return hasWebGL2();
}

export function chooseStage(): Stage {
  return canMountDesk() ? "desk" : "stack";
}
