/* ============================================================================
 * THE PALETTE — CSS tokens in, THREE.Color out.
 *
 * No hex literal ever appears in this directory. The desk is lit and painted
 * from the same custom properties the DOM uses, read at runtime, so the paper
 * on the canvas and the paper in the document cannot drift apart.
 *
 * The stage-only values (the two light temperatures, the ambient) live in
 * src/styles/stage.css. That file is their tokens.css.
 * ========================================================================== */

import { Color } from "three";

/** Palette key → the custom property it is read from. */
const SOURCES = {
  desk: "--stage-desk",
  deskDeep: "--stage-desk-deep",
  paper: "--stage-paper",
  paperAged: "--stage-paper-aged",
  paperEdge: "--stage-paper-edge",
  kraft: "--stage-kraft",
  ink: "--stage-ink",
  accent: "--stage-accent",
  backdrop: "--stage-backdrop",
  cut: "--stage-cut",
  shadow: "--stage-shadow",
  cool: "--stage-cool",
  keyLight: "--stage-key-light",
  fillLight: "--stage-fill-light",
  ambient: "--stage-ambient",
} as const;

export type PaletteKey = keyof typeof SOURCES;
export type Palette = Readonly<Record<PaletteKey, Color>>;

/**
 * Reads the whole palette, or returns null.
 *
 * Null means stage.css did not load, and the correct response to that is not
 * to mount a desk in fallback colours — it is not to mount a desk. Partial
 * paper is worse than no paper.
 */
export function readPalette(root: Element = document.documentElement): Palette | null {
  const styles = getComputedStyle(root);
  const out: Partial<Record<PaletteKey, Color>> = {};

  for (const key of Object.keys(SOURCES) as PaletteKey[]) {
    const raw = styles.getPropertyValue(SOURCES[key]).trim();
    // `CSS.supports` rejects an empty or malformed token before Three.js has a
    // chance to warn and silently leave the colour white.
    if (!raw || !CSS.supports("color", raw)) return null;
    try {
      out[key] = new Color().setStyle(raw);
    } catch {
      return null;
    }
  }

  return out as Palette;
}

/**
 * A colour pulled toward another, for the values that are a mix of two tokens
 * rather than a token of their own — the lamp's warmth over paper white, say.
 * Mixing tokens is still sourcing from tokens; inventing a hex is not.
 */
export function blend(a: Color, b: Color, amount: number): Color {
  return a.clone().lerp(b, amount);
}

/**
 * A palette colour as a string a 2D canvas will accept.
 *
 * The round trip is exact and deliberate: `setStyle` reads the token as sRGB
 * and stores it in the renderer's linear working space, and `getStyle` converts
 * it back. Canvas is an sRGB surface, so a texture painted with these strings
 * and then tagged `SRGBColorSpace` arrives at the shader as the same colour the
 * stylesheet asked for — which is the whole reason there is no hex in here.
 */
export function css(color: Color, alpha = 1): string {
  const { r, g, b } = color.clone().convertLinearToSRGB();
  const c = (v: number) => Math.round(Math.min(Math.max(v, 0), 1) * 255);
  return `rgba(${c(r)},${c(g)},${c(b)},${alpha})`;
}
