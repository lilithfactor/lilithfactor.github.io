/* ============================================================================
 * AUTO-DEGRADE — the desk gets simpler before it drops frames.
 *
 * Three steps, in the order that trades the least appearance for the most
 * headroom: contact shadows off, then DPR 1.5, then DPR 1.0.
 *
 * It is a ratchet. Each step happens at most once and there is no path back
 * up, which is the entire design: a scene that recovers, re-degrades, and
 * recovers again looks broken in a way a permanently simpler scene never does.
 * A visitor cannot see the quality level it settled at; they can absolutely
 * see it changing. architecture.md, performance budget.
 * ========================================================================== */

/** Frames per measurement window. */
const WINDOW = 60;
/** Below this, step down. Not 60: a 58fps scene is fine and must be left alone. */
const FLOOR = 50;
/**
 * Frames ignored at startup. The first second is shader compilation, texture
 * upload and the browser's own layout work — degrading on that measures the
 * page load, not the scene.
 */
const WARMUP = 45;

export type Degradation = "contact-off" | "dpr-1.5" | "dpr-1.0";

const LADDER: readonly Degradation[] = ["contact-off", "dpr-1.5", "dpr-1.0"];

export interface Governor {
  /** Feed it every frame's delta in seconds. Returns a step, once, or null. */
  sample(dt: number): Degradation | null;
}

export function createGovernor(): Governor {
  let warmup = WARMUP;
  let frames = 0;
  let elapsed = 0;
  let step = 0;

  return {
    sample(dt) {
      if (warmup > 0) {
        warmup -= 1;
        return null;
      }
      if (step >= LADDER.length) return null;

      // A frame longer than a third of a second is a tab switch, a breakpoint,
      // or a GC pause. Counting it would degrade the scene for something that
      // has nothing to do with the scene.
      if (dt > 0.34) return null;

      frames += 1;
      elapsed += dt;
      if (frames < WINDOW) return null;

      const fps = frames / elapsed;
      frames = 0;
      elapsed = 0;

      if (fps >= FLOOR) return null;

      const next = LADDER[step];
      step += 1;
      return next ?? null;
    },
  };
}
