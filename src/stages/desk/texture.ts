/* ============================================================================
 * PROCEDURAL TEXTURE — three small canvases, drawn once at mount.
 *
 * This file used to be four times this size. It generated walnut grain, a wax
 * roughness map, recycled-board mottle and plaster, all in service of a
 * photographed room. The stage is a cut-paper diorama now, and none of that
 * survives the change: a paper model has no grain to render, and a roughness
 * map is meaningless on a material with no specular term to break up.
 *
 * What is left is the three things paper-craft genuinely needs, none of which
 * are surfacing:
 *
 *   fibre    a whisper of tooth on the card, so a large flat face is not a
 *            single flat fill. Barely visible on purpose.
 *   contact  a soft radial falloff, used as the alpha of the darkened plane
 *            under each object. This is the entire shadow system.
 *   pool     the lamp's warm glow, painted onto the desk. A paper lamp that
 *            only emits light has nothing on the desk to show for it.
 *
 * The rule about literals is unchanged: colours come from tokens, and the only
 * numbers here are greyscale *data* — alpha ramps and tooth, which are values a
 * shader multiplies rather than colours anyone picked.
 * ========================================================================== */

import { CanvasTexture, ClampToEdgeWrapping, RepeatWrapping, SRGBColorSpace } from "three";

/**
 * mulberry32. Seeded, because a texture that is different on every load is a
 * texture nobody can review: "the tooth looks wrong" has to be reproducible.
 */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Greyscale as data, not as colour. See the header. */
const grey = (v: number, a = 1) => {
  const c = Math.round(Math.min(Math.max(v, 0), 255));
  return `rgba(${c},${c},${c},${a})`;
};

function pad(size: number): CanvasRenderingContext2D | null {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas.getContext("2d");
}

/**
 * The tooth of the card. Near-white throughout: it multiplies whatever colour
 * the vertex already carries, so one canvas serves every sheet in the model
 * regardless of what shade it was cut from.
 *
 * ±4 levels out of 255. That is deliberately almost nothing — the point of
 * paper-craft is flat card, and a visible paper texture would be re-introducing
 * exactly the surfacing this direction threw out. It exists so that a 2.7-metre
 * base sheet is not one mathematically uniform fill, and for no other reason.
 */
function fibre(anisotropy: number): CanvasTexture | null {
  const S = 128;
  const ctx = pad(S);
  if (!ctx) return null;
  const rand = seeded(0xfa7e11);
  ctx.fillStyle = grey(253);
  ctx.fillRect(0, 0, S, S);
  const image = ctx.getImageData(0, 0, S, S);
  const d = image.data;
  for (let i = 0; i < S * S; i++) {
    const n = (rand() - 0.5) * 8;
    for (let c = 0; c < 3; c++) d[i * 4 + c] = Math.min(255, Math.max(0, d[i * 4 + c]! + n));
  }
  ctx.putImageData(image, 0, 0);

  const texture = new CanvasTexture(ctx.canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(6, 6);
  texture.anisotropy = anisotropy;
  return texture;
}

/**
 * A radial falloff, used as the alpha of the darkened plane under each object.
 *
 * This replaces the shadow map outright. A 2048² depth buffer casting a hard
 * raking shadow is the correct answer for a photograph and the wrong one here:
 * paper-craft is a lit-from-everywhere craft object, its shadows are short and
 * soft, and a sharp cast shadow across the base sheet would immediately read as
 * a rendering rather than a model. This is also, incidentally, free — no shadow
 * pass, no second draw of every caster.
 *
 * The dark core runs out to half the radius before it starts falling, and then
 * falls fast. That shape is load-bearing: with a narrower core the whole dark
 * part of the gradient hides underneath the object that cast it and all anyone
 * sees is the faint tail, which reads as haze on the desk rather than as
 * contact. A single linear ramp has the same problem and also looks airbrushed.
 */
function contact(): CanvasTexture | null {
  const S = 128;
  const ctx = pad(S);
  if (!ctx) return null;
  const r = S / 2;
  // White throughout, with the ramp in the alpha channel, and consumed as
  // `map` rather than `alphaMap`. `map` multiplies both the colour and the
  // alpha of the material — so white RGB leaves the shadow colour alone and
  // the alpha ramp becomes the falloff, in one texture fetch and one texture.
  //
  // Verified by render, not by reading the docs: the alphaMap route produced
  // nothing at all under this renderer, while `map` is the same path the lamp
  // pool below already takes and demonstrably works.
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, grey(255, 1));
  g.addColorStop(0.5, grey(255, 0.88));
  g.addColorStop(0.74, grey(255, 0.36));
  g.addColorStop(1, grey(255, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);

  const texture = new CanvasTexture(ctx.canvas);
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  return texture;
}

/**
 * The lamp's pool, painted on the base sheet.
 *
 * A SpotLight alone gives a physically-plausible pool and, on flat matte card
 * with almost no specular, an unconvincing one: the falloff is real but there
 * is nothing on the surface that says "warmth". This is the paper-craft answer
 * — a glow drawn on, additively, the way you would airbrush one onto a model.
 * It is also what makes the lamp the emotional centre of the desk rather than a
 * prop that happens to be near the bright part.
 *
 * Wider and softer than `contact`, with a hot core, because that is the shape
 * of a shade open at the bottom.
 */
function pool(): CanvasTexture | null {
  const S = 256;
  const ctx = pad(S);
  if (!ctx) return null;
  const r = S / 2;
  // Used as `map` under additive blending, where black adds nothing — so the
  // ramp needs no alpha channel at all and the edge of the quad disappears on
  // its own. sRGB, because this one is drawn as a colour and should arrive
  // looking like what was drawn.
  ctx.fillStyle = grey(0);
  ctx.fillRect(0, 0, S, S);
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, grey(255));
  g.addColorStop(0.22, grey(178));
  g.addColorStop(0.5, grey(78));
  g.addColorStop(0.78, grey(20));
  g.addColorStop(1, grey(0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);

  const texture = new CanvasTexture(ctx.canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  return texture;
}

export interface StageTextures {
  readonly fibre: CanvasTexture | null;
  readonly contact: CanvasTexture | null;
  readonly pool: CanvasTexture | null;
  dispose(): void;
}

export function createTextures(anisotropy: number): StageTextures {
  const set = { fibre: fibre(anisotropy), contact: contact(), pool: pool() };
  return {
    ...set,
    dispose() {
      for (const texture of Object.values(set)) texture?.dispose();
    },
  };
}
