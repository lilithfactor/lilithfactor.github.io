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
  // The lamp switched off. Not an inversion of the day desk — a second time of
  // day, which is what design-system.md says a dark mode of this site has to be.
  night: "--stage-night",
  nightAmbient: "--stage-night-ambient",
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

/**
 * INK AS A MULTIPLIER — how you print on a sheet that is already painted.
 *
 * Every card in this model gets its colour from a vertex attribute (cut.ts) and
 * its tooth from a `map` that MULTIPLIES that attribute. A printed sheet has to
 * join that system rather than replace it, or it loses its cut edges and its
 * stock tone the moment it gains a word on it.
 *
 * So the print texture is not a picture of a sheet — it is a field of
 * multipliers, white where the paper shows through and `ink / paper` where the
 * ink lands. Multiply that by the vertex colour and the sheet comes out exactly
 * the ink colour the token named, on exactly the card it was cut from.
 *
 * The division is done in the renderer's linear working space, which is where
 * the shader's multiply happens, and `css()` re-encodes the result to sRGB for
 * the canvas. Still zero hex literals: this is arithmetic on two tokens.
 */
export function overprint(ink: Color, paper: Color): Color {
  const a = ink.clone();
  const b = paper;
  // A guard, not a fudge: a token pair where the paper is darker than the ink
  // would ask for a multiplier above 1, which no texture can carry. Clamping
  // means such a pair prints as "no darker than the paper", never as garbage.
  a.r = Math.min(a.r / Math.max(b.r, 1e-4), 1);
  a.g = Math.min(a.g / Math.max(b.g, 1e-4), 1);
  a.b = Math.min(a.b / Math.max(b.b, 1e-4), 1);
  return a;
}

/**
 * The same card, from a different batch.
 *
 * Real paper-craft is built from whatever was in the drawer, and two sheets of
 * "the same" stock are never quite the same shade. `n` is an index, not a seed —
 * the variation is a deterministic fan around the token so a given piece is the
 * same colour on every load, and so the whole set still reads as one material.
 *
 * Kept under 4% of lightness. Past that it stops being stock variation and
 * starts being a second colour, which is a decision the palette should make.
 */
export function stock(colour: Color, n: number): Color {
  const spread = [0, 0.028, -0.021, 0.014, -0.033, 0.021];
  return colour.clone().offsetHSL(0, 0, spread[n % spread.length] ?? 0);
}
