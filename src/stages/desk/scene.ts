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
  PCFSoftShadowMap,
  Scene,
  Vector3,
  WebGLRenderer,
  type Material,
  type Mesh,
  type Object3D,
} from "three";
import { DESK_MIN_WIDTH } from "../choose";
import { bindAnchors, clearAnchors, projectAnchors, type Binding } from "./anchors";
import { createCameraRig } from "./camera";
import { buildLighting, buildRoom } from "./desk";
import { ARTIFACT_IDS, PLACEMENTS, type ArtifactId } from "./layout";
import { createMaterials } from "./materials";
import { buildArtifact } from "./objects";
import { readPalette } from "./palette";
import { createGovernor, type Degradation } from "./quality";

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

  const scene = new Scene();
  scene.background = palette.deskDeep;

  const materials = createMaterials(palette);
  scene.add(buildRoom(palette, materials));

  const lighting = buildLighting(palette);
  scene.add(lighting.key, lighting.key.target, lighting.fill, lighting.ambient);

  // --- Objects and their anchors ------------------------------------------
  const anchors = new Map<ArtifactId, Vector3>();
  const pieces: Piece[] = [];

  for (const id of ARTIFACT_IDS) {
    const placement = PLACEMENTS[id];
    const object = buildArtifact(id, materials);
    object.position.set(...placement.position);
    object.rotation.y = placement.yaw * DEG;
    scene.add(object);

    // World space, resolved once. The hover lift moves the object by 18mm; if
    // the anchor moved with it, every section on the page would twitch
    // whenever the mouse crossed it.
    object.updateWorldMatrix(true, false);
    anchors.set(id, object.localToWorld(new Vector3(...placement.anchor)));

    pieces.push({ id, object, restY: object.position.y, raised: false });
  }

  const size = { width: window.innerWidth, height: window.innerHeight };
  const rig = createCameraRig(anchors, size.width, size.height);
  const bindings: Binding[] = bindAnchors(anchors);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
  renderer.setSize(size.width, size.height, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  document.body.prepend(canvas);

  let destroyed = false;
  let frame = 0;

  /* --- The DOM drives the stage ------------------------------------------
   * Four delegated listeners rather than thirty-two direct ones, and both a
   * pointer and a keyboard path to every behaviour: hover is never the only
   * way to reach anything. ux-rules.md rule 7. */
  const sectionOf = (node: EventTarget | null): ArtifactId | null => {
    if (!(node instanceof Element)) return null;
    const id = node.closest<HTMLElement>("[data-artifact]")?.dataset.artifact;
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
    // allocations behind JS handles. Deduped, because nine materials are
    // shared across forty-odd meshes.
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
    if (step === "shadows-off") {
      renderer.shadowMap.enabled = false;
      scene.traverse((o) => {
        if (!isMesh(o)) return;
        o.castShadow = false;
        // Materials compiled against a shadow map need recompiling without one.
        const m = o.material;
        for (const mat of Array.isArray(m) ? m : [m]) mat.needsUpdate = true;
      });
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
