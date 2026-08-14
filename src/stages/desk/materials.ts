/* ============================================================================
 * MATERIALS — three of them, for the entire desk.
 *
 * There used to be twelve MeshStandardMaterials here, each with its own
 * roughness, metalness and envMapIntensity, spread apart so that walnut, kraft,
 * book cloth and paper would each return the lamp differently. All of it is
 * gone, and the reason is not that it was badly tuned — it was that it was
 * answering a question the stage no longer asks. A cut-paper diorama is made of
 * one material. Card has no gloss, no metal, no Fresnel and no environment
 * response; giving it any of those is not extra fidelity, it is a mistake, and
 * a convincing one, which is worse.
 *
 * What replaces it:
 *
 *   card     MeshLambertMaterial, matte, vertex-coloured. Every sheet, board,
 *            spine and roll in the model, in one program.
 *   contact  the darkened plane under each object. The whole shadow system.
 *   glow     the lamp's warm light, painted on additively.
 *
 * Lambert rather than Standard: Lambert is diffuse-only, which is precisely the
 * shading model card has, and it drops the entire specular/IBL half of the
 * shader. Lambert rather than Basic: unlit card would throw away the warm-to-
 * cool gradient across the model, which is the one thing keeping flat colour
 * from reading as flat colour.
 *
 * Lambert rather than Toon, which the brief allowed and which sounds like the
 * obvious paper-craft answer: a stepped gradient quantises the lamp's falloff,
 * and across a 2.7-metre base sheet lit by one close lamp that produces two or
 * three hard concentric rings on the desk. On a small object that reads as
 * style; on the largest surface in the frame it reads as a bug. Flat card wants
 * flat *shading*, not banded shading.
 * ========================================================================== */

import {
  AdditiveBlending,
  DoubleSide,
  MeshBasicMaterial,
  MeshLambertMaterial,
  type Texture,
} from "three";
import type { Palette } from "./palette";
import type { StageTextures } from "./texture";

export interface Materials {
  readonly card: MeshLambertMaterial;
  readonly contact: MeshBasicMaterial;
  readonly glow: MeshBasicMaterial;
}

/**
 * A sheet with its own print on it.
 *
 * The fourth material, and the only one there is more than one of — a printed
 * sheet needs its own `map`, and a map is per-material. Four outcome sheets and
 * a chess board is five extra shader-identical materials, which cost five
 * uniform uploads and no extra program: they are the same Lambert as every
 * other card, differing only in which texture is bound.
 *
 * Crucially still `vertexColors: true`. The print texture carries multipliers,
 * not colour (see print.ts), so the sheet's stock tone and its darker cut edges
 * keep coming from the vertex attribute exactly as they do for blank card. A
 * printed sheet is a sheet that has been printed on, not a different object.
 */
export function printed(map: Texture): MeshLambertMaterial {
  return new MeshLambertMaterial({ vertexColors: true, map, side: DoubleSide });
}

export function createMaterials(p: Palette, t: StageTextures): Materials {
  return {
    // White, because the colour comes from the vertex attribute — see cut.ts.
    // The map is the card's tooth at ±4/255, which is under the threshold of
    // "texture" and above the threshold of "one flat fill".
    // DoubleSide because several pieces are genuinely single sheets — the
    // lampshade is an open cone the camera looks down into, and a backface-
    // culled cone is a cone with a hole in it. Card has no back.
    card: new MeshLambertMaterial({ vertexColors: true, map: t.fibre, side: DoubleSide }),

    // Contact shadows. depthWrite off because these planes lie a millimetre
    // above the desk and must not fight each other where two overlap; they only
    // ever darken what is already behind them, so they have nothing to write.
    contact: new MeshBasicMaterial({
      color: p.shadow,
      map: t.contact,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      // A decal offset, not a Y offset. These quads lie flat on the base sheet,
      // and lifting them far enough to clear the depth buffer by position alone
      // would lift them through the thin sheets of paper they sit under. A
      // 16-bit depth buffer at this camera distance cannot resolve a millimetre
      // — which is exactly what polygonOffset exists for.
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
      // Not tone mapped: this is a stencil of how dark to go, not a colour that
      // was lit. Running it through the curve would lift it back up again.
      toneMapped: false,
    }),

    // The lamp's pool and the lit inside of its shade. Additive, so it can only
    // ever add warmth to the card underneath and never flatten it into a
    // washed-out disc the way an opaque overlay would.
    glow: new MeshBasicMaterial({
      color: p.keyLight,
      map: t.pool,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      opacity: 0.52,
    }),
  };
}
