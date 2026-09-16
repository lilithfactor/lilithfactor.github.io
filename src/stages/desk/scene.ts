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
  Color,
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  NeutralToneMapping,
  PCFSoftShadowMap,
  PlaneGeometry,
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
import {
  buildLighting,
  buildRoom,
  DESK_SIZE,
  LAMP,
  matBowAmount,
  matHeightAt,
  setMatBow,
} from "./desk";
import { createLampRig } from "./lamp";
import { press } from "./print";
import { ARTIFACT_IDS, ARTIFACT_LABELS, PLACEMENTS, type ArtifactId } from "./layout";
import { createMaterials } from "./materials";
import { loadModels } from "./models";
import { buildArtifact, buildNote, MODEL_SPECS, NOTE_SIZE } from "./objects";
import { createOutlines } from "./outline";
import { blend, readPalette } from "./palette";
import { applyTuned, type Tuned, type TunerTargets } from "./params";
import tuned from "./tuned.json";
import { createGovernor, type Degradation } from "./quality";
import { createTextures } from "./texture";
import { startWeather, type Sky } from "./weather";

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
  /**
   * Height ABOVE THE BASE SHEET, not world y.
   *
   * The sheet is bowed, so "on the desk" is a different y at every point on it
   * — and an object seated at a fixed y disappears into the hump wherever the
   * hump is taller than the object. This is the number the tuner moves and the
   * number every placement in layout.ts meant; `restOf` adds the sheet.
   */
  base: number;
  /** Its paper name-note, a child of the object. Absent if the press failed. */
  readonly note?: Object3D;
  raised: boolean;
}

/** Where a piece sits when nothing is hovering it: its own height, plus the sheet's. */
function restOf(piece: Piece): number {
  return piece.base + matHeightAt(piece.object.position.x, piece.object.position.z);
}

/** How far a note leans back onto the object it is stuck to. Degrees. */
const NOTE_LEAN = -25;

/* --- THEMES ----------------------------------------------------------------
 * A theme is a set of --stage-* tokens (see stage.css) plus, for two of them, a
 * switch in here. It is read once, at mount, from ?theme= or from the last one
 * picked — which is why the tuner's picker reloads the page rather than
 * rebuilding a scene whose colours, textures and print were all resolved on the
 * way up. A reload is two hundred milliseconds; live re-theming is a second
 * copy of every builder in this directory.
 */
export const THEMES = ["paper", "kraft", "blueprint", "wire", "sketch"] as const;
export type ThemeName = (typeof THEMES)[number];
const THEME_STORE = "desk-theme";

/** Resolves the theme and stamps it on <html>. MUST run before readPalette. */
function applyTheme(): ThemeName {
  let name = "paper";
  try {
    const asked = new URLSearchParams(location.search).get("theme");
    if (asked) localStorage.setItem(THEME_STORE, asked);
    name = asked ?? localStorage.getItem(THEME_STORE) ?? "paper";
  } catch {
    /* No storage — a private window, or blocked. The URL still decides. */
  }
  const theme = (THEMES as readonly string[]).includes(name) ? (name as ThemeName) : "paper";
  document.documentElement.dataset.theme = theme;
  return theme;
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

/**
 * Is the tuner wanted? Inlined here rather than imported from tuner.ts, because
 * a static import of that module — even of one tiny function — pulls the whole
 * panel into the desk chunk for every visitor, which is exactly what the
 * dynamic import below exists to prevent.
 */
function wantsTuner(): boolean {
  const KEY = "desk-tune";
  try {
    const flag = new URLSearchParams(location.search).get("tune");
    if (flag === "off") {
      localStorage.removeItem(KEY);
      return false;
    }
    if (flag !== null) localStorage.setItem(KEY, "1");
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export async function mountDesk(): Promise<DeskHandle | null> {
  // BEFORE the palette: the theme is a set of tokens on <html>, and the palette
  // is those tokens resolved. Read in the other order, every theme is paper.
  const theme = applyTheme();

  // Colours come from the stylesheet, never from a literal in here. If the
  // stage stylesheet did not load, the honest outcome is no desk — not a desk
  // in whatever grey Three.js defaults to.
  const palette = readPalette();
  if (!palette) return null;

  // Kicked off before anything else so the round trip overlaps the model
  // loading below. By the time the window is built the answer is usually
  // already here; if it is not, its own deadline passes and the window falls
  // back to the clock. The desk never waits on the sky. See weather.ts.
  const weather = startWeather();

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
  /* One shadow-casting light, softly filtered. The scene ran on painted
   * contact ellipses alone, which ground an object but cannot show something
   * standing between the lamp and the desk — and interrupting the pool is the
   * entire reward for aiming an adjustable lamp. See buildLighting. */
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1.08;

  const scene = new Scene();
  // Darker than the backdrop card, so the backdrop reads as a sheet standing in
  // a room rather than as the room itself.
  // Exactly the backdrop, NOT a darkened blend. The room geometry does not
  // reach the top of a wide viewport, and a darker clear colour turned that gap
  // into a visible grey band across the top of the page. Matching the wall makes
  // the seam impossible to see instead of merely less obvious.
  scene.background = palette.backdrop.clone();

  const textures = createTextures(renderer.capabilities.getMaxAnisotropy());
  const materials = createMaterials(palette, textures);

  // Downloaded geometry, repainted in the desk's own paper. Awaited before
  // anything is built: the objects decide the contact shadows and the anchor
  // positions below, the lamp is one of them, and rebuilding those mid-flight
  // would move every section marker on the page. The document is complete and
  // readable throughout, and a model that never arrives leaves its procedural
  // version in place.
  const models = await loadModels(MODEL_SPECS(palette), textures);

  const { room, lamp, window: view } = buildRoom(palette, materials, models);

  /* The scene NO LONGER WAITS for the sky.
   *
   * It used to await two chained network round trips — locate, then forecast —
   * in front of the entire desk, for scenery. Now the window is built with its
   * curtains shut and opens when the answer arrives, whenever that is. If it
   * never arrives the curtains stay closed, which is a normal state for a
   * window rather than an error state for a page. */
  const forcedSky = new URLSearchParams(location.search).get("sky");
  if (forcedSky) {
    // ?sky=rain opens the curtains on a synthetic forecast, so every condition
    // can be looked at without waiting on — or being lied to by — the network.
    view.reveal({ sky: forcedSky as Sky, day: true, celsius: 20 });
  } else {
    void weather.then((w) => {
      if (!destroyed) view.reveal(w);
    });
  }
  // The desk and the wall take shadow but never throw it; nothing is behind
  // them to catch one, and a caster costs a second draw.
  room.traverse((node) => {
    const mesh = node as Mesh;
    if (mesh.isMesh) mesh.receiveShadow = true;
  });
  scene.add(room);

  const lighting = buildLighting(palette);
  scene.add(lighting.key, lighting.key.target, lighting.fill, lighting.ambient);

  // The printed sheets: real outcome numbers, typeset onto the top papers so
  // the desk reads as a portfolio at rest, before any click.
  /* The note text comes from the DOCUMENT, not from a table in here.
   *
   * Each note is a picture of that section's <h2>, which is the same string the
   * invisible button announces and the same string the open panel is titled
   * with. One source: rename a section and its note follows, and there is no
   * way for the paper to disagree with the page. */
  const noteLabels = new Map<string, string>();
  for (const id of ARTIFACT_IDS) {
    const heading = document
      .querySelector(`[data-artifact="${id}"] h2`)
      ?.textContent?.trim();
    if (heading) noteLabels.set(id, heading);
  }
  const pressKit = press(palette, ARTIFACT_LABELS, noteLabels);

  /* THE SIGN BEHIND THE SET.
   *
   * The camera is on rails — createCameraRig owns it and nothing on the page
   * can move it off them. But anyone who opens a console can reach into the
   * scene graph and fly it wherever they like, and the first place they will go
   * is straight through the back wall, because that is what you do.
   *
   * There is no lock worth building here: it is their machine, their renderer,
   * and any guard is thirty seconds of work to remove. So instead of pretending
   * the room has walls, there is a sign on the other side of this one. It faces
   * the way that visitor is travelling, which is why it is turned to look back
   * at the camera's approach rather than into the room.
   *
   * Unlit, so it reads at full contrast out there where the lamp does not
   * reach, and never outlined — it is printing, not paper. */
  if (pressKit.sign) {
    const sign = new Mesh(
      new PlaneGeometry(3.6, 1.8),
      new MeshBasicMaterial({ map: pressKit.sign, toneMapped: false }),
    );
    sign.position.set(0, 1.2, -2.7);
    sign.rotation.y = Math.PI;
    sign.userData.noOutline = true;
    sign.receiveShadow = false;
    room.add(sign);
  }
  // The rig owns the head angle and drives the key light from it.
  const lampRig = createLampRig(lamp, lighting.key);

  // The scene is one paper now, so the black line is what separates objects
  // from each other and from the desk. Applied per artifact below, and to the
  // room here — the lamp's painted glow and pool are light, not paper, and are
  // marked so no line is drawn round them.
  const outlines = createOutlines(palette.line);
  outlines.resize(window.innerWidth, window.innerHeight);
  lamp.pool.userData.noOutline = true;
  lamp.glow.userData.noOutline = true;
  outlines.apply(room);

  // --- Objects and their anchors ------------------------------------------
  const anchors = new Map<ArtifactId, Vector3>();
  const placed = new Map<string, Object3D>();
  /** id → its paper note, so the tuner can nudge a label off whatever it hides. */
  const noteObjects = new Map<string, Object3D>();

  /* NOTE SIZING, IN TWO PARTS.
   *
   * One world size for every note — a label set is a set, and eight labels at
   * eight sizes is eight different voices — times a per-note fudge for the one
   * that has to be smaller because of what it stands on. Both land on the same
   * `scale`, because the alternative (a wrapper group carrying one of them)
   * would multiply the note's saved position by the size and move every label
   * the moment the slider did. */
  let noteSize = NOTE_SIZE;
  const noteFudge = new Map<string, number>();
  const sizeNote = (id: string): void => {
    noteObjects.get(id)?.scale.setScalar((noteSize / NOTE_SIZE) * (noteFudge.get(id) ?? 1));
  };
  const sizeAllNotes = (): void => {
    for (const id of noteObjects.keys()) sizeNote(id);
  };
  const pieces: Piece[] = [];
  const viewDirection = new Vector3();
  /** Each artifact's anchor in its OWN space, for re-projecting every frame. */
  const anchorLocals = new Map<ArtifactId, Vector3>();
  // The lamp base is not an artifact, so it declares its own footprint; the
  // eight artifacts measure theirs below.
  const feet: Footprint[] = [{ x: LAMP.x, z: LAMP.z, halfX: 0.094, halfZ: 0.094 }];
  const bounds = new Box3();

  for (const id of ARTIFACT_IDS) {
    const placement = PLACEMENTS[id];
    const object = buildArtifact(id, palette, materials, pressKit, models);
    // Before placing: the line mesh is baked in the object's own space, so it
    // travels with every later move, lift and rotation for free.
    // Casts and receives, so the lamp can throw one object's shape across
    // another. Set before the outline is baked so the line mesh — which is not
    // a Mesh and must never cast — is untouched.
    object.traverse((node) => {
      const mesh = node as Mesh;
      if (!mesh.isMesh) return;
      const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      if (material && (material as { transparent?: boolean }).transparent) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
    /* The object's own extent, measured while it is still at the origin and
     * unturned — so this box IS its local space, with no world→local inverse
     * to get wrong. The note below is hung off its front-top edge from it. */
    const extent = new Box3().setFromObject(object);

    object.position.set(
      placement.position[0],
      // ON the sheet, not on the plane the sheet used to be. See desk.ts.
      placement.position[1] + matHeightAt(placement.position[0], placement.position[2]),
      placement.position[2],
    );
    object.rotation.y = placement.yaw * DEG;

    /* THE NOTE IS PART OF THE OBJECT.
     *
     * It was a sibling, added to the scene at a world position worked out once
     * — which was wrong, and wrong in a way that only shows up with the tuner
     * open: drag an object across the desk and its name stays behind, because
     * nothing told the label the thing it names had moved. The invisible button
     * stayed behind with it, since both were pinned to an anchor resolved at
     * build time.
     *
     * A piece of paper standing on a thing is part of that thing. So the note
     * is a child now, the anchor is re-read from the live matrix every frame
     * (see the tick), and moving, turning or rescaling an object carries its
     * name, its ink and its hit target along with it.
     *
     * Added BEFORE the outline is baked so the note's own ink is baked as its
     * own root and pruned from the object's — see outline.ts/ownOutline. */
    const printedNote = pressKit.notes.get(id);
    let noteOf: Object3D | null = null;
    if (printedNote) {
      const note = buildNote(palette, materials, printedNote, 8, pressKit.stock);
      /* STUCK TO THE OBJECT, not standing in front of it.
       *
       * It used to be stepped 150mm along the sightline from the anchor, which
       * put a 200mm square of paper on the desk BETWEEN the viewer and the
       * thing it names — the about note covered most of the notebook. A label
       * that hides its subject has inverted its own job.
       *
       * So it goes on the object's front-top edge: the front face of its own
       * bounding box, near the top of it, leaning back onto the object the way
       * a card tucked against something leans. Nothing is behind it to hide. */
      note.position.set(
        (extent.min.x + extent.max.x) / 2,
        extent.max.y * 0.9,
        extent.max.z + 0.006,
      );
      note.rotation.x = NOTE_LEAN * DEG;
      note.traverse((n) => {
        const mesh = n as Mesh;
        if (mesh.isMesh) mesh.castShadow = true;
      });
      object.add(note);
      noteObjects.set(id, note);
      sizeNote(id);
      noteOf = note;
    }

    outlines.apply(object);
    scene.add(object);

    /* The anchor: a live world point, not a resolved one.
     *
     * Kept as one Vector3 per artifact and MUTATED IN PLACE each frame, because
     * bindAnchors holds the reference and projectAnchors reads it — so writing
     * into it is what makes the button follow. The hover lift is subtracted
     * there rather than here, so a mouse crossing an object does not make its
     * section marker twitch 18mm up the page. */
    object.updateWorldMatrix(true, false);
    const anchorLocal = new Vector3(...placement.anchor);
    const anchor = object.localToWorld(anchorLocal.clone());
    anchors.set(id, anchor);
    anchorLocals.set(id, anchorLocal);

    pieces.push({ id, object, base: placement.position[1], note: noteOf ?? undefined, raised: false });
    placed.set(id, object);
  }

  /** id → its piece, for the tuner's per-object height. */
  const byId = new Map<string, Piece>(pieces.map((piece) => [piece.id as string, piece]));

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

  /* --- WHAT IS OPEN DECIDES WHAT IS FRAMED --------------------------------
   * Focus alone could not answer this, and the reason is worth keeping: what
   * framed the object on the way in was the HANDLE taking focus when it was
   * clicked. Closing hands focus back to that same handle — which never lost
   * it — so no focusin fires, nothing calls frame(null), and the camera simply
   * stays where the last focus put it. The ✕, Escape, the scrim, "Back to the
   * desk" and Back all ended there, and fixing them one at a time would be five
   * callbacks that have to agree.
   *
   * panels.ts already writes the one fact behind all five: `data-panel` on
   * <html>, set on open and deleted on close. So the framing reads that instead
   * of guessing from focus. Observer callbacks land after the click handler
   * that moved focus, so this is what the rig is left holding. panels.ts stays
   * ignorant of the camera, and the desk stays mountable without it. */
  const onPanelChange = () => {
    const id = document.documentElement.dataset.panel;
    const known = id && (ARTIFACT_IDS as readonly string[]).includes(id);
    rig.frame(known ? (id as ArtifactId) : null);
  };
  const panelWatch = new MutationObserver(onPanelChange);
  panelWatch.observe(document.documentElement, { attributeFilter: ["data-panel"] });
  // Panels mount before the desk does, so a shared link like /#library has
  // already opened one by the time there is a camera to point at it.
  onPanelChange();

  const onPointerMove = (e: PointerEvent) => {
    rig.parallax((e.clientX / size.width) * 2 - 1, (e.clientY / size.height) * 2 - 1);
  };

  const onResize = () => {
    size.width = window.innerWidth;
    size.height = window.innerHeight;
    rig.resize(size.width, size.height);
    renderer.setSize(size.width, size.height, false);
    // Fat lines size their quads in pixels, so they need the new resolution or
    // every outline in the scene changes width when the window does.
    outlines.resize(size.width, size.height);
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

    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerover", onPointerOver);
    document.removeEventListener("pointerout", onPointerOut);
    document.removeEventListener("focusin", onFocusIn);
    document.removeEventListener("focusout", onFocusOut);
    panelWatch.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("resize", onResize);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    viewport.removeEventListener("change", onViewportChange);

    tuner?.dispose();
    lampRig.dispose();
    pressKit.dispose();
    clearAnchors(bindings);
    delete document.documentElement.dataset.stage;

    // Geometries and materials are not garbage collected — they are GPU
    // allocations behind JS handles. Deduped, because three materials are
    // shared across fifty-odd meshes.
    const seen = new Set<object>();
    scene.traverse((node) => {
      // Meshes AND the baked outline LineSegments: both hold a geometry and a
      // material, and a check for isMesh alone silently leaked every line.
      const o = node as Mesh;
      if (!o.geometry || !o.material) return;
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

    /* WHICH WAY THE NOTES FACE.
     *
     * One angle for all eight, taken from the direction the camera is LOOKING
     * rather than from where each note is relative to it. The two differ, and
     * the difference is the whole point: aiming each note at the camera's
     * position turns every one of them by a slightly different amount, so a
     * note at the edge of the desk is seen at a slant and its writing skews,
     * while a note in the middle is square on. Facing them all along the view
     * direction makes every note parallel to the screen — the same reading
     * angle wherever it stands on the desk, and whatever angle the desk is
     * being looked at from.
     *
     * The note's printed face looks down its own +Z, so it wants to point back
     * against the way the camera is pointing: hence the negated direction.
     *
     * Yaw ONLY. Matching the camera's downward tilt as well would make them
     * perfectly face-on and would also make them sprites hanging in the air;
     * the small lean keeps them standing on a desk. */
    rig.camera.getWorldDirection(viewDirection);
    const noteYaw = Math.atan2(-viewDirection.x, -viewDirection.z);

    for (const piece of pieces) {
      // Re-read every frame rather than cached: the sheet's height under an
      // object changes when the object is dragged across the desk and when the
      // bow itself is tuned, and two cosines times eight is nothing.
      const rest = restOf(piece);
      const goal = rest + (piece.raised ? LIFT : 0);
      piece.object.position.y += (goal - piece.object.position.y) * Math.min(dt * 9, 1);

      /* Re-read the anchor from where the object actually IS.
       *
       * Written into the existing Vector3 rather than replacing it, because
       * bindAnchors captured that object. Minus the hover lift: the object
       * rises 18mm under the pointer and its section marker must not.
       *
       * This is what makes the tuner honest — drag something across the desk
       * and its note, its ink and its hit target all arrive with it. */
      /* SQUARE TO THE VIEW, not aimed at the camera. See noteYaw above. */
      if (piece.note) piece.note.rotation.y = noteYaw - piece.object.rotation.y;

      const anchorLocal = anchorLocals.get(piece.id);
      const anchor = anchors.get(piece.id);
      if (anchorLocal && anchor) {
        piece.object.updateWorldMatrix(true, false);
        anchor.copy(piece.object.localToWorld(anchorLocal.clone()));
        anchor.y -= piece.object.position.y - rest;
      }
    }

    // The ink shivers; the paper does not. Free at amplitude 0. See outline.ts.
    outlines.boil(dt);

    view.update(dt);
    rig.update(elapsed, dt);
    renderer.render(scene, rig.camera);
    projectAnchors(bindings, rig.camera, size.width, size.height, rig.reference);
    lampRig.update(rig.camera, size.width, size.height);

    if (!ready) {
      ready = true;
      // The swap happens in two beats, and the order is CLS, not vanity:
      // fade the document to nothing first (opacity moves no layout), and only
      // flip the stage attribute — which reflows the entire page into panels —
      // while nothing is visible. Shifts of invisible elements score zero,
      // and more importantly, nobody watches their reading position teleport.
      document.documentElement.classList.add("stage-swapping");
      // Flip on transitionend, not a timer: a timer races the fade on slow
      // frames (throttled CPU, software GL) and reflows the page while it is
      // still half-visible — which is a full-viewport layout shift. The
      // transition's own end event is correct on any device speed; the timer
      // is only the fallback for a browser that never fires it.
      const main = document.querySelector("main");
      let swapped = false;
      const flip = () => {
        if (swapped) return;
        swapped = true;
        // NOT inside requestAnimationFrame. It used to be, to batch the change
        // with a paint, and that made the swap depend on a frame that might
        // never come: this scene stops its own rAF loop whenever the page is
        // hidden, so a tab opened in the background (cmd-click, "open in new
        // tab" — ordinary things) could stop the loop between the fade and the
        // frame. The flip was then lost permanently, because `ready` was
        // already true and the swap block never runs twice: the visitor came
        // back to a faded document with handles floating over it.
        //
        // A timer fires whether or not frames do, so the swap now completes on
        // its own regardless. Found while chasing an "intermittent" headless
        // screenshot that turned out to be reproducing this exactly.
        document.documentElement.dataset.stage = "desk";
        canvas.classList.add("is-ready");
        document.documentElement.classList.remove("stage-swapping");
      };
      // NOTE on measurement: Lighthouse desktop reports this swap as CLS ~1.0
      // no matter how main is hidden (opacity, visibility, three-frame). The
      // real-browser Layout Shift API reports ~0.02 for the same build. The
      // synthetic trace scores the fixed-position adoption of <main> as a
      // full-viewport shift regardless of paint state; do not contort the swap
      // to please it. Verified 2026-08-14 — see brain/work/learning.md.
      main?.addEventListener("transitionend", flip, { once: true });
      setTimeout(flip, 700);
    }

    degrade(governor.sample(dt));
  };

  function startLoop(): void {
    if (destroyed || frame !== 0) return;
    last = performance.now();
    frame = requestAnimationFrame(tick);
  }

  document.addEventListener("pointermove", onPointerMove, { passive: true });
  document.addEventListener("pointerover", onPointerOver);
  document.addEventListener("pointerout", onPointerOut);
  document.addEventListener("focusin", onFocusIn);
  document.addEventListener("focusout", onFocusOut);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("resize", onResize, { passive: true });
  canvas.addEventListener("webglcontextlost", onContextLost);
  viewport.addEventListener("change", onViewportChange);
  window.addEventListener("pagehide", destroy, { once: true });

  /* --- What a theme does beyond its tokens --------------------------------
   * Three of the five are nothing but --stage-* values and are already applied
   * by the time the palette was read. Two are a switch:
   *
   *   wire    every material drawn as a wireframe and the ink turned off — the
   *           three.js examples look, which is what this model is underneath.
   *           Materials are shared, so this is four flags, not four hundred.
   *   sketch  paper tokens with the line boiling: the same drawing re-drawn by
   *           a hand five times a second, on a heavier line. See outline.ts.
   *
   * Set BEFORE the saved tuning replays, so a number moved on a slider still
   * wins over a theme's opinion of it. */
  if (theme === "wire") {
    scene.traverse((node) => {
      if (!isMesh(node)) return;
      const list = Array.isArray(node.material) ? node.material : [node.material];
      for (const m of list) (m as Material & { wireframe?: boolean }).wireframe = true;
    });
    outlines.setVisible(false);
  }
  if (theme === "sketch") {
    outlines.setWidth(2.6);
    outlines.setBoil(1);
  }

  /* The tuner: sliders for every number this scene is made of, so the loop of
   * edit → rebuild → screenshot → squint stops being how the look gets found.
   * Dynamically imported and opt-in via ?tune, so a visitor never pays for it.
   * See tuner.ts. */
  const tunerTargets: TunerTargets = {
    outlines,
    key: lighting.key,
    fill: lighting.fill,
    ambient: lighting.ambient,
    // Built with the window rather than with the other three: it belongs to
    // the opening it comes through, and the blind drives it.
    daylight: view.daylight,
    room,
    artifacts: placed,
    notes: noteObjects,
    lamp: lamp.group,
    camera: { get: rig.overview, set: rig.setOverview },
    // The base sheet's bow. Re-bowed from the flat copy desk.ts keeps, and
    // every object re-seats itself on the next frame because `restOf` asks the
    // sheet how high it is rather than remembering.
    deskBow: { get: matBowAmount, set: setMatBow },
    /* An object's height ABOVE the sheet. This is what `artifact.<id>.y` has
     * always meant and what every saved value in tuned.json is: a 0 there means
     * "on the desk", which is only position.y = 0 on a desk that is flat. */
    height: {
      get: (id) => byId.get(id)?.base ?? 0,
      set: (id, v) => {
        const piece = byId.get(id);
        if (piece) piece.base = v;
      },
    },
    noteSize: { get: () => noteSize, set: (v) => ((noteSize = v), sizeAllNotes()) },
    noteScale: {
      get: (id) => noteFudge.get(id) ?? 1,
      set: (id, v) => {
        noteFudge.set(id, v);
        sizeNote(id);
      },
    },
    theme: {
      options: THEMES,
      get: () => theme,
      /* A RELOAD, deliberately. The palette, the print, the textures and every
       * vertex colour in the model were resolved from the tokens on the way up;
       * re-theming live means a second path through all of it that nobody would
       * exercise except by picking a theme. Guarded against the theme it is
       * already on, because applyTuned replays every setter at mount and a
       * setter that reloads unconditionally is a reload loop. */
      set: (name) => {
        if (name === theme) return;
        try {
          localStorage.setItem(THEME_STORE, name);
        } catch {
          /* No storage. The reload still lands on the ?theme= in the URL. */
        }
        location.reload();
      },
    },
    materials: {
      contactOpacity: (v) => (v < 0 ? materials.contact.opacity : (materials.contact.opacity = v)),
      glowOpacity: (v) => (v < 0 ? materials.glow.opacity : (materials.glow.opacity = v)),
      paper: (hex) => {
        materials.card.color.set(hex);
        scene.background = new Color(hex);
      },
      surface: (name) => textures.setSurface(name),
      surfaces: textures.surfaces,
    },
  };

  /* Saved tuning, replayed through the same setters the sliders use.
   *
   * This runs for everyone, which is the point: a number moved with a slider
   * and saved is the number the site is built with. It is a scratchpad, not the
   * source of truth — anything that settles gets folded back into the constant
   * it came from and the file emptied, so nobody has to read JSON to find out
   * where the lamp is. Empty is the normal state. */
  if (Object.keys(tuned).length) applyTuned(tunerTargets, tuned as Tuned);

  /* The tuner: sliders for every number this scene is made of, so the loop of
   * edit → rebuild → screenshot → squint stops being how the look gets found.
   * Dynamically imported and opt-in via ?tune, so a visitor never pays for it.
   * See tuner.ts. */
  let tuner: { dispose(): void } | null = null;
  if (wantsTuner()) {
    void import("./tuner").then(({ mountTuner }) => {
      if (destroyed) return;
      tuner = mountTuner(tunerTargets);
    });
  }

  startLoop();
  return { destroy };
}
