/* ============================================================================
 * THE DESK STAGE — entry point for the 3D chunk.
 *
 * Everything Three.js touches is downstream of this module, and this module is
 * only ever reached through a dynamic import behind the capability gate. That
 * is what keeps the 3D payload at exactly zero bytes on a phone rather than
 * "small on a phone". See StageMount.astro and choose.ts.
 *
 * Nothing here is required for the page to work. If any step fails — no
 * palette, no context, a lost context later — it tears itself down and the
 * document carries on being a complete, readable portfolio, which is what it
 * was before this file ran. ux-rules.md rule 9.
 * ========================================================================== */

import {
  Box3,
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  NeutralToneMapping,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
} from "three";
import { DESK_MIN_WIDTH } from "../choose";
import { bindAnchors, clearAnchors, projectAnchors, type Binding } from "./anchors";
import { createCameraRig } from "./camera";
import { buildLighting, buildRoom, DESK_SIZE, LAMP } from "./desk";
import { ARTIFACT_IDS, PLACEMENTS, type ArtifactId } from "./layout";
import { createMaterials } from "./materials";
import { buildArtifact } from "./objects";
import { blend, readPalette } from "./palette";
import { createGovernor, type Degradation } from "./quality";
import { createTextures } from "./texture";

const DEG = Math.PI / 180;
/** How far an object rises when its section is hovered or focused. 18mm. */
const LIFT = 0.018;
const MAX_DPR = 2;

export interface DeskHandle {
  destroy(): void;
}

interface Piece {
  readonly id: ArtifactId;
  readonly object: Object3D;
  readonly restY: number;
  raised: boolean;
}

function isMesh(o: Object3D): o is Mesh {
  return (o as Mesh).isMesh === true;
}

/** Where one object meets the base sheet, for its contact shadow. */
interface Footprint {
  readonly x: number;
  readonly z: number;
  readonly halfX: number;
  readonly halfZ: number;
}

export function mountDesk(): DeskHandle | null {
  // Colours come from the stylesheet, never from a literal in here. If the
  // stage stylesheet did not load, the honest outcome is no desk — not a desk
  // in whatever grey Three.js defaults to.
  const palette = readPalette();
  if (!palette) return null;

  const canvas = document.createElement("canvas");
  canvas.className = "desk-stage";
  // The canvas is scenery. Focus never enters it, no assistive technology ever
  // announces it, and every word it might have described is real DOM anyway.
  // ux-rules.md rule 4.
  canvas.setAttribute("aria-hidden", "true");
  canvas.tabIndex = -1;

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
  } catch {
    return null;
  }

  /* --- Colour management --------------------------------------------------
   * A cut-paper model is a set of known card colours, and the job of this block
   * is to deliver them to the screen as the colours the stylesheet named.
   *
   * So: Neutral, not ACES. ACES was right when the stage was a photograph — it
   * keeps a blown warm highlight from going chalky, which is a problem a
   * photograph has. Flat matte card never gets near clipping, and running it
   * through a film curve just desaturates every sheet and pulls the whole model
   * toward orange. Khronos PBR Neutral leaves everything under the knee exactly
   * where it was and compresses only the very top, which here is nothing but
   * the middle of the lamp's glow. The card comes out as the card.
   *
   * Not NoToneMapping, though, which would be the purest version of that
   * argument: the additive pool does push past 1 in its core, and with no curve
   * at all it clips per channel and the hot centre turns pink.
   *
   * outputColorSpace is already sRGB by default in this version. It is set
   * anyway, because the default is the kind of thing that changes between major
   * versions and this is the line whose absence is impossible to diagnose from
   * a screenshot. */
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1.08;

  const scene = new Scene();
  // Darker than the backdrop card, so the backdrop reads as a sheet standing in
  // a room rather than as the room itself.
  scene.background = blend(palette.backdrop, palette.shadow, 0.6);

  const textures = createTextures(renderer.capabilities.getMaxAnisotropy());
  const materials = createMaterials(palette, textures);
  scene.add(buildRoom(palette, materials));

  const lighting = buildLighting(palette);
  scene.add(lighting.key, lighting.key.target, lighting.fill, lighting.ambient);

  // --- Objects and their anchors ------------------------------------------
  const anchors = new Map<ArtifactId, Vector3>();
  const pieces: Piece[] = [];
  // The lamp base is not an artifact, so it declares its own footprint; the
  // eight artifacts measure theirs below.
  const feet: Footprint[] = [{ x: LAMP.x, z: LAMP.z, halfX: 0.094, halfZ: 0.094 }];
  const bounds = new Box3();

  for (const id of ARTIFACT_IDS) {
    const placement = PLACEMENTS[id];
    const object = buildArtifact(id, palette, materials);
    object.position.set(...placement.position);
    object.rotation.y = placement.yaw * DEG;
    scene.add(object);

    // World space, resolved once. The hover lift moves the object by 18mm; if
    // the anchor moved with it, every section on the page would twitch
    // whenever the mouse crossed it.
    object.updateWorldMatrix(true, false);
    anchors.set(id, object.localToWorld(new Vector3(...placement.anchor)));

    // Where this object touches the base sheet. Measured off the built object
    // rather than tabulated, so moving something in layout.ts moves its shadow
    // with it and there is no second table to forget.
    bounds.setFromObject(object);
    const onDesk =
      bounds.min.y < 0.08 &&
      Math.abs(bounds.max.x + bounds.min.x) / 2 < DESK_SIZE[0] / 2 &&
      Math.abs(bounds.max.z + bounds.min.z) / 2 < DESK_SIZE[1] / 2;
    if (onDesk) {
      feet.push({
        x: (bounds.max.x + bounds.min.x) / 2,
        z: (bounds.max.z + bounds.min.z) / 2,
        halfX: (bounds.max.x - bounds.min.x) / 2,
        halfZ: (bounds.max.z - bounds.min.z) / 2,
      });
    }

    pieces.push({ id, object, restY: object.position.y, raised: false });
  }

  /* --- Contact shadows ----------------------------------------------------
   * One darkened quad per object, lying a millimetre above the base sheet, and
   * all nine of them merged into a single mesh.
   *
   * This is the entire shadow system, and it replaces a 2048² shadow map and
   * the second draw of every caster that went with it. The trade is honest: it
   * cannot show one object shadowing another, and it only knows where the lamp
   * is well enough to lean away from it. Neither matters for a paper model,
   * whose shadows are short and soft and sit almost directly underneath — and a
   * soft ellipse is what a card object resting on a card sheet actually looks
   * like, where a sharp cast shadow would read as a rendering.
   *
   * Merged rather than nine meshes because nine transparent quads is nine draw
   * calls for eighteen triangles, and the scene is close enough to its draw
   * call budget that the geometry may as well be baked. It is also one object
   * for the degrade ladder to switch off. */
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (const foot of feet) {
    const rx = Math.max(foot.halfX, 0.05) * 2.3;
    const rz = Math.max(foot.halfZ, 0.05) * 2.3;
    // Nudged away from the lamp, by a fraction of the object's own size. A
    // shadow centred exactly under its object is a halo; a shadow that leans
    // away from the light is the one thing left in the scene that says where
    // the light is, now that nothing casts a real one.
    const dx = foot.x - LAMP.x;
    const dz = foot.z - LAMP.z;
    const away = Math.hypot(dx, dz) || 1;
    const cx = foot.x + (dx / away) * rx * 0.16;
    const cz = foot.z + (dz / away) * rz * 0.16;
    const base = positions.length / 3;
    for (const [sx, sz] of [
      [-1, 1],
      [1, 1],
      [1, -1],
      [-1, -1],
    ] as const) {
      positions.push(cx + sx * rx, 0.0009, cz + sz * rz);
      uvs.push((sx + 1) / 2, (sz + 1) / 2);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const shadows = new Mesh(new BufferGeometry(), materials.contact);
  shadows.name = "contact";
  shadows.geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  shadows.geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  shadows.geometry.setIndex(indices);
  scene.add(shadows);

  const size = { width: window.innerWidth, height: window.innerHeight };
  const rig = createCameraRig(anchors, size.width, size.height);
  const bindings: Binding[] = bindAnchors(anchors);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
  renderer.setSize(size.width, size.height, false);
  // shadowMap stays disabled — the default. Nothing in this scene casts, and
  // the contact quads above are the whole shadow system. That removes the
  // shadow pass entirely: no second draw of every caster, no depth material
  // compile, no 2048² depth buffer.

  document.body.prepend(canvas);

  let destroyed = false;
  let frame = 0;

  /* --- The DOM drives the stage ------------------------------------------
   * Four delegated listeners rather than thirty-two direct ones, and both a
   * pointer and a keyboard path to every behaviour: hover is never the only
   * way to reach anything. ux-rules.md rule 7. */
  const sectionOf = (node: EventTarget | null): ArtifactId | null => {
    if (!(node instanceof Element)) return null;
    const hit = node.closest<HTMLElement>("[data-artifact], [data-anchor]");
    const id = hit?.dataset.artifact ?? hit?.dataset.anchor;
    return id && (ARTIFACT_IDS as readonly string[]).includes(id) ? (id as ArtifactId) : null;
  };

  const setRaised = (id: ArtifactId | null, raised: boolean) => {
    for (const piece of pieces) if (piece.id === id) piece.raised = raised;
  };

  const onPointerOver = (e: PointerEvent) => setRaised(sectionOf(e.target), true);
  const onPointerOut = (e: PointerEvent) => setRaised(sectionOf(e.target), false);

  const onFocusIn = (e: FocusEvent) => {
    const id = sectionOf(e.target);
    setRaised(id, true);
    // The camera moves for focus and for nothing else. Never for scroll.
    rig.frame(id);
  };
  const onFocusOut = (e: FocusEvent) => {
    const id = sectionOf(e.target);
    if (id && sectionOf(e.relatedTarget) !== id) setRaised(id, false);
  };

  const onResize = () => {
    size.width = window.innerWidth;
    size.height = window.innerHeight;
    rig.resize(size.width, size.height);
    renderer.setSize(size.width, size.height, false);
  };

  const stopLoop = () => {
    if (frame !== 0) cancelAnimationFrame(frame);
    frame = 0;
  };

  /* --- Teardown -----------------------------------------------------------
   * Declared before the listeners that call it so the wiring below reads in
   * one direction. It is idempotent: pagehide, a lost context and a viewport
   * drop can all arrive, and two of them are then no-ops. */
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    stopLoop();

    document.removeEventListener("pointerover", onPointerOver);
    document.removeEventListener("pointerout", onPointerOut);
    document.removeEventListener("focusin", onFocusIn);
    document.removeEventListener("focusout", onFocusOut);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("resize", onResize);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    viewport.removeEventListener("change", onViewportChange);

    clearAnchors(bindings);
    delete document.documentElement.dataset.stage;

    // Geometries and materials are not garbage collected — they are GPU
    // allocations behind JS handles. Deduped, because three materials are
    // shared across fifty-odd meshes.
    const seen = new Set<object>();
    scene.traverse((o) => {
      if (!isMesh(o)) return;
      if (!seen.has(o.geometry)) {
        seen.add(o.geometry);
        o.geometry.dispose();
      }
      const list: Material[] = Array.isArray(o.material) ? o.material : [o.material];
      for (const mat of list) {
        if (seen.has(mat)) continue;
        seen.add(mat);
        mat.dispose();
      }
    });
    // Textures are the other GPU allocation behind a JS handle, and unlike
    // geometries they are not reachable from the scene graph once a material
    // has been disposed — so they are freed by the module that made them.
    textures.dispose();

    scene.clear();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  };

  // A hidden tab must not hold a GPU at 60fps. Nothing on the desk is
  // time-sensitive, so there is nothing to catch up on when it returns.
  const onVisibility = () => (document.hidden ? stopLoop() : startLoop());

  // A lost context is not an error state from the visitor's point of view —
  // they still have the document, which is the whole portfolio. No message.
  const onContextLost = (e: Event) => {
    e.preventDefault();
    destroy();
  };

  // Dragged to a narrow window, or a display swap: the gate that decided to
  // mount has stopped being true, so the desk stops being mounted.
  const viewport = window.matchMedia(`(min-width: ${DESK_MIN_WIDTH}px)`);
  const onViewportChange = () => {
    if (!viewport.matches) destroy();
  };

  /* --- Quality ------------------------------------------------------------ */
  const governor = createGovernor();
  const degrade = (step: Degradation | null) => {
    if (step === "contact-off") {
      // The ladder's first rung used to switch off the shadow map. There is no
      // shadow map now, so it drops what actually costs fill rate in this
      // scene: nine large overlapping transparent quads. Losing them costs the
      // model its grounding, which is why it is still the first thing to go and
      // not the last — appearance is what this ladder is for spending.
      shadows.visible = false;
    } else if (step === "dpr-1.5") {
      renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
      renderer.setSize(size.width, size.height, false);
    } else if (step === "dpr-1.0") {
      renderer.setPixelRatio(1);
      renderer.setSize(size.width, size.height, false);
    }
  };

  /* --- The loop ----------------------------------------------------------- */
  let last = performance.now();
  let elapsed = 0;
  let ready = false;

  const tick = (now: number) => {
    frame = requestAnimationFrame(tick);
    // Clamped: a frame that took longer than 100ms was a stall, and replaying
    // it at full weight makes the camera jump on the way back.
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    elapsed += dt;

    for (const piece of pieces) {
      const goal = piece.restY + (piece.raised ? LIFT : 0);
      piece.object.position.y += (goal - piece.object.position.y) * Math.min(dt * 9, 1);
    }

    rig.update(elapsed, dt);
    renderer.render(scene, rig.camera);
    projectAnchors(bindings, rig.camera, size.width, size.height, rig.reference);

    if (!ready) {
      ready = true;
      // Only now does the page become the desk stage: the first frame is
      // already in the buffer, so the reveal is a fade and never a flash of
      // empty canvas across content someone is reading.
      document.documentElement.dataset.stage = "desk";
      canvas.classList.add("is-ready");
    }

    degrade(governor.sample(dt));
  };

  function startLoop(): void {
    if (destroyed || frame !== 0) return;
    last = performance.now();
    frame = requestAnimationFrame(tick);
  }

  document.addEventListener("pointerover", onPointerOver);
  document.addEventListener("pointerout", onPointerOut);
  document.addEventListener("focusin", onFocusIn);
  document.addEventListener("focusout", onFocusOut);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("resize", onResize, { passive: true });
  canvas.addEventListener("webglcontextlost", onContextLost);
  viewport.addEventListener("change", onViewportChange);
  window.addEventListener("pagehide", destroy, { once: true });

  startLoop();
  return { destroy };
}
