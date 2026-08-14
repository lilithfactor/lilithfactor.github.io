/* ============================================================================
 * LOADED MODELS — downloaded geometry, wearing the desk's paper.
 *
 * The split this module enforces: *they* supply geometry, *we* supply material.
 * Every incoming material and texture is discarded on arrival and replaced with
 * the same matte Lambert every procedural sheet uses, so a downloaded object
 * cannot drift out of the paper look no matter what it was authored as.
 *
 * Two things every model needs and no model arrives with:
 *
 *   Scale.   glTF has no unit convention and the archive proves it — surveyed
 *            models ran from 0.005 to 48 units tall for objects that are all
 *            about a foot wide in life. Authored scale is therefore ignored
 *            entirely: each model is normalised by its bounding box to a size
 *            named here, in the metres layout.ts already speaks.
 *   Origin.  Exporters put it anywhere. Every model is re-seated so its base
 *            sits on y = 0, centred in x and z, because that is what every
 *            placement assumes.
 *
 * A model that fails to load returns null and the caller keeps its procedural
 * object. That is not defensive coding for its own sake: lamp.glb and
 * turntable.glb are deliberately not committed until their licence is known
 * (see brain/vision/todo.md), so "the file is not there" is a state that
 * happens in production by design, and the desk must be whole without them.
 * ========================================================================== */

import { Box3, Color, Group, Mesh, MeshLambertMaterial, Vector3, type Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { StageTextures } from "./texture";

/** Every model the desk asks for, with the size it should be, in metres. */
export interface ModelSpec {
  /** File stem in public/models/. */
  readonly name: string;
  /** Largest dimension after normalisation. */
  readonly size: number;
  /** Card tone, from the palette. */
  readonly tone: Color;
}

export interface ModelKit {
  /** A fresh instance of a loaded model, or null if it never arrived. */
  take(name: string): Group | null;
}

function isMesh(o: Object3D): o is Mesh {
  return (o as Mesh).isMesh === true;
}

/**
 * Loads every spec in parallel. Never rejects: a model that 404s or fails to
 * parse is simply absent from the kit.
 */
export async function loadModels(
  specs: readonly ModelSpec[],
  textures: StageTextures,
): Promise<ModelKit> {
  const loader = new GLTFLoader();
  const tones = new Map<string, MeshLambertMaterial>();

  // One material per distinct tone, shared across every model using it. The
  // fibre map is the same card tooth the procedural sheets wear, which is most
  // of why a downloaded object sits in the same world as a folded one.
  const materialFor = (tone: Color): MeshLambertMaterial => {
    const key = tone.getHexString();
    let mat = tones.get(key);
    if (!mat) {
      mat = new MeshLambertMaterial({ color: tone, map: textures.fibre });
      tones.set(key, mat);
    }
    return mat;
  };

  const loaded = new Map<string, Group>();

  /* A request that never settles must not be able to strand the desk.
   *
   * mountDesk() awaits this, and mountPanels() has already put every section
   * into a panel and marked it aria-hidden by then. So a fetch that hangs — a
   * flaky connection, a proxy that accepts and never answers — would leave the
   * whole portfolio hidden from assistive technology with no desk to open it,
   * which is the one failure this stage is not allowed to have. Whatever has
   * not arrived by the deadline is treated as absent, and the procedural
   * fallback takes over. Found by a single-threaded test server deadlocking on
   * twelve parallel requests; the failure it produced was real. */
  const DEADLINE = 6000;
  const withDeadline = <T>(p: Promise<T>): Promise<T | null> =>
    Promise.race([
      p.catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), DEADLINE)),
    ]);

  await Promise.all(
    specs.map(async (spec) => {
      const gltf = await withDeadline(loader.loadAsync(`/models/${spec.name}.glb`));
      // Absent by design, by accident, or too slow to wait for; the caller has
      // a procedural fallback for every one of those.
      if (!gltf) return;
      const root = gltf.scene;
      const material = materialFor(spec.tone);
      root.traverse((o) => {
        if (isMesh(o)) o.material = material;
      });

      // Normalise: largest dimension to spec.size, base on y = 0, centred.
      const box = new Box3().setFromObject(root);
      const dims = box.getSize(new Vector3());
      const scale = spec.size / Math.max(dims.x, dims.y, dims.z || 1e-6);
      root.scale.setScalar(scale);
      root.updateMatrixWorld(true);

      const seated = new Box3().setFromObject(root);
      const mid = seated.getCenter(new Vector3());
      root.position.set(-mid.x, -seated.min.y, -mid.z);

      // A wrapper, so callers can rotate and place without fighting the
      // re-seating transform above.
      const holder = new Group();
      holder.name = spec.name;
      holder.add(root);
      loaded.set(spec.name, holder);
    }),
  );

  return {
    take(name) {
      const source = loaded.get(name);
      // Cloned, so one file can appear twice on the desk (two knights) and so a
      // caller rotating one instance never moves another. Geometry and material
      // are shared by clone(); only the transforms are new.
      return source ? (source.clone(true) as Group) : null;
    },
  };
}
