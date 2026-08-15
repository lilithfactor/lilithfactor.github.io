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
 * THE TOOTH OF THE CARD. Near-white throughout: it multiplies whatever colour
 * the vertex already carries, so one canvas serves every sheet in the model
 * regardless of what shade it was cut from.
 *
 * This used to be ±4 levels of uniform white noise, and the honest read on it
 * was that it did nothing. Two reasons, and they are worth separating because
 * only one of them is about strength:
 *
 *   1. It was too weak to survive mipmapping. A per-texel random field averages
 *      to its own mean the moment the texture is minified, which on a desk seen
 *      from a metre away is always. It was not subtle; it was absent.
 *   2. Paper fibre is not white noise. It is a low-frequency cloud (where the
 *      pulp settled unevenly) with directional fibres lying in it (where the
 *      sheet was couched). Noise with no structure at any scale above one texel
 *      reads as video grain, not as material.
 *
 * So it is now drawn in three passes at three scales, and the two coarse ones
 * are what actually survive to the screen. Peak-to-peak stays inside 6% of
 * white, which design-system.md gives as the point where grain starts costing
 * text contrast — and this map now lies under printed text (see print.ts), so
 * that ceiling is a real constraint here rather than an inherited one.
 */
/**
 * Paints the card's tooth. Split out of `fibre` so the tuner can repaint the
 * same canvas in a different finish without building a new texture — every
 * material already holds this map, so a repaint is one `needsUpdate`.
 *
 * `grain` is how far the tone strays from white (in 0-255 steps) and `strokes`
 * is how many fibres lie in it. Those two carry the whole difference between
 * copier paper and watercolour stock.
 */
function paintFibre(ctx: CanvasRenderingContext2D, S: number, grain = 4, strokes = 900): void {
  const rand = seeded(0xfa7e11);
  ctx.fillStyle = grey(255);
  ctx.fillRect(0, 0, S, S);

  // 1 — the cloud. Where the pulp lay thicker. Big soft blobs, drawn with a
  // radial gradient so they tile without a seam at this size and cost nothing.
  for (let i = 0; i < 26; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const r = 26 + rand() * 62;
    const dark = rand() > 0.5;
    const tone = 255 - (dark ? grain * 4.75 : 0);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, grey(tone, 0.5));
    g.addColorStop(1, grey(tone, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // 2 — the fibres. Short strokes lying mostly one way, because a couched sheet
  // has a grain direction and that is half of why paper looks like paper.
  ctx.lineCap = "round";
  for (let i = 0; i < strokes; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const len = 3 + rand() * 13;
    const angle = (rand() - 0.5) * 0.7;
    ctx.strokeStyle = grey(rand() > 0.45 ? 255 - grain * 3.75 : 255, 0.42);
    ctx.lineWidth = rand() > 0.8 ? 1.4 : 0.7;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }

  // 3 — the speck. Flecks of unbleached pulp. Rare and small, and the only
  // thing here dark enough to notice individually.
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = grey(255 - grain * 6.75, 0.5);
    ctx.fillRect(rand() * S, rand() * S, 1 + Math.round(rand()), 1);
  }
}

function fibre(anisotropy: number): CanvasTexture | null {
  const S = 256;
  const ctx = pad(S);
  if (!ctx) return null;
  paintFibre(ctx, S);

  const texture = new CanvasTexture(ctx.canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  // One tile per ~45cm of base sheet. Chosen so a texel lands near one screen
  // pixel at the resting camera: any denser and the mip chain eats it, any
  // coarser and the cloud stops being tooth and starts being staining.
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
  /** Surface finishes the card can wear, for the tuner to flip between. */
  readonly surfaces: readonly string[];
  /** Repaints `fibre` in the named finish. No new texture object, so every
   * material already holding the map picks it up on the next frame. */
  setSurface(name: string): void;
  dispose(): void;
}

/**
 * The card's surface, as a repaintable set rather than one baked look.
 *
 * All procedural: a downloaded paper photograph would be a megabyte of someone
 * else's lighting baked into a scene that lights itself, and at this scale the
 * only thing a real scan contributes over noise is its low-frequency cloud —
 * which is cheap to generate and free to ship. These four are the honest range
 * of "what paper is this", and the tuner exists so the choice can be made by
 * looking rather than by arguing.
 */
const SURFACES = ["fibre", "smooth", "laid", "rough"] as const;

export function createTextures(anisotropy: number): StageTextures {
  const set = { fibre: fibre(anisotropy), contact: contact(), pool: pool() };
  return {
    ...set,
    surfaces: SURFACES,
    setSurface(name) {
      const map = set.fibre;
      if (!map) return;
      const ctx = map.image.getContext("2d") as CanvasRenderingContext2D | null;
      if (!ctx) return;
      const S = map.image.width;
      // Grain amount and fibre density are the only two knobs that matter:
      // "smooth" is a near-flat sheet, "rough" is watercolour stock.
      const spec: Record<string, { grain: number; strokes: number }> = {
        fibre: { grain: 4, strokes: 900 },
        smooth: { grain: 1.5, strokes: 200 },
        laid: { grain: 3, strokes: 2600 },
        rough: { grain: 9, strokes: 1400 },
      };
      const { grain, strokes } = spec[name] ?? spec.fibre!;
      paintFibre(ctx, S, grain, strokes);
      map.needsUpdate = true;
    },
    dispose() {
      for (const texture of Object.values(set)) texture?.dispose();
    },
  };
}
