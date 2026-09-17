/* ============================================================================
 * THE TUNABLES — one list of every number the scene will let you move.
 *
 * This is split out from tuner.ts because the same list has to serve two
 * readers that must never disagree:
 *
 *   - the tuner, which turns each entry into a slider;
 *   - the scene, which replays saved values through the very same setters at
 *     mount, so a number moved with a slider survives a reload and a build.
 *
 * Two lists would drift within a day. One list, two consumers.
 *
 * NO DOM IN HERE. That is the point: the scene imports this and applies the
 * saved values without pulling in the panel, which is 14KB of controls no
 * visitor should ever download.
 *
 * Keys are stable strings, because they end up in tuned.json on disk. Renaming
 * one silently drops whatever was saved against it.
 * ========================================================================== */

import type { Color, HemisphereLight, DirectionalLight, Object3D, SpotLight } from "three";
import type { Outlines } from "./outline";

export interface TunerTargets {
  outlines: Outlines;
  key: SpotLight;
  fill: DirectionalLight;
  ambient: HemisphereLight;
  /** The window's own light. Zero until the blind goes up — see desk.ts. */
  daylight: DirectionalLight;
  /** The whole model, so the desk can be turned as one. */
  room: Object3D;
  /** id → the placed group, for per-object position and yaw. */
  artifacts: Map<string, Object3D>;
  /**
   * id → its paper name-note. Separate from `artifacts` because a note is a
   * CHILD of its object: its numbers are offsets within that object, so moving
   * the object moves the note and this only says where on the object it sits.
   */
  notes: Map<string, Object3D>;
  lamp: Object3D;
  /** The base sheet's bow, in metres of lift at the crown. See desk.ts. */
  deskBow: { get(): number; set(v: number): void };
  /**
   * An object's height ABOVE the base sheet — which is not its position.y,
   * because the sheet is bowed. Every `artifact.<id>.y` ever saved means this.
   */
  height: { get(id: string): number; set(id: string, v: number): void };
  /** One world size for every note, in metres. */
  noteSize: { get(): number; set(v: number): void };
  /** One note's own multiplier on top of that size. */
  noteScale: { get(id: string): number; set(id: string, v: number): void };
  /** The whole palette, swapped. Reloads — see scene.ts for why. */
  theme: { options: readonly string[]; get(): string; set(v: string): void };
  camera: {
    get(): { position: [number, number, number]; target: [number, number, number]; fov: number };
    set(v: { position?: [number, number, number]; target?: [number, number, number]; fov?: number }): void;
  };
  /**
   * The cursor as an eye. Three numbers nobody can pick by reading them, and
   * they are not the same number twice — see camera.ts.
   *
   * - `amount` — ORBIT. How far the eye swings on its arc around whatever it
   *   is looking at. This is the head moving: it is what slides near past far.
   * - `gaze` — POINT OF REGARD. How far across the desk the thing being looked
   *   at slides toward the cursor. This is the eye turning in the socket: it
   *   is what brings the thing under the cursor toward the middle of frame.
   * - `speed` — EASE RATE, in 1/seconds, shared by both. Not an amplitude at
   *   all: it is how hard the camera chases the hand once the hand has moved.
   */
  parallax: {
    amount: { get(): number; set(v: number): void };
    gaze: { get(): number; set(v: number): void };
    speed: { get(): number; set(v: number): void };
  };
  materials: {
    contactOpacity(v: number): number;
    glowOpacity(v: number): number;
    paper(hex: string): void;
    /** Swap the card's surface texture. See texture.ts for the set. */
    surface(name: string): void;
    surfaces: readonly string[];
  };
}

interface Common {
  key: string;
  group: string;
  label: string;
}

export type Spec =
  | (Common & {
      kind: "num";
      min: number;
      max: number;
      step: number;
      get(): number;
      set(v: number): void;
    })
  | (Common & { kind: "hex"; value: string; set(v: string): void })
  | (Common & { kind: "pick"; options: readonly string[]; value: string; set(v: string): void });

export type Tuned = Record<string, number | string>;

const DEG = Math.PI / 180;
const AXIS = ["x", "y", "z"] as const;

export function specs(t: TunerTargets): Spec[] {
  const list: Spec[] = [];
  const num = (s: Omit<Extract<Spec, { kind: "num" }>, "kind">) => list.push({ kind: "num", ...s });

  /* --- Line ---------------------------------------------------------------- */
  num({
    key: "outline.width",
    group: "Outline",
    label: "width",
    min: 0.5,
    max: 8,
    step: 0.1,
    get: () => t.outlines.material.linewidth,
    set: (v) => t.outlines.setWidth(v),
  });
  num({
    key: "outline.threshold",
    group: "Outline",
    label: "fold threshold",
    min: 5,
    max: 80,
    step: 1,
    // The live angle, not the default. Hardcoded, Save wrote 38 back over
    // whatever tuned.json had just replayed, every single time.
    get: () => t.outlines.threshold,
    set: (v) => t.outlines.setThreshold(v),
  });
  list.push({
    kind: "hex",
    key: "outline.ink",
    group: "Outline",
    label: "ink",
    value: "#12100c",
    set: (hex) => t.outlines.material.color.set(hex),
  });

  /* THE LINE BOIL. Amplitude first because it is the on/off — 0 is a still
   * drawing, 1 is the "sketch" theme's pencil test. See outline.ts. */
  num({
    key: "line.boil",
    group: "Outline",
    label: "boil",
    min: 0,
    max: 1,
    step: 0.05,
    get: () => t.outlines.boilAmount,
    set: (v) => t.outlines.setBoil(v),
  });
  num({
    key: "line.boilRate",
    group: "Outline",
    label: "boil ms",
    min: 60,
    max: 300,
    step: 5,
    get: () => t.outlines.boilRate,
    set: (v) => t.outlines.setBoilRate(v),
  });

  /* --- Paper and surface --------------------------------------------------- */
  list.push({
    kind: "hex",
    key: "paper.sheet",
    group: "Paper",
    label: "sheet",
    value: "#faf8f3",
    set: (hex) => t.materials.paper(hex),
  });
  list.push({
    kind: "pick",
    key: "paper.surface",
    group: "Paper",
    label: "surface",
    options: t.materials.surfaces,
    value: t.materials.surfaces[0] ?? "",
    set: (name) => t.materials.surface(name),
  });

  /* --- Light --------------------------------------------------------------- */
  num({
    key: "light.key",
    group: "Light",
    label: "key",
    min: 0,
    max: 6,
    step: 0.02,
    get: () => t.key.intensity,
    set: (v) => (t.key.intensity = v),
  });
  num({
    key: "light.fill",
    group: "Light",
    label: "fill",
    min: 0,
    max: 3,
    step: 0.02,
    get: () => t.fill.intensity,
    set: (v) => (t.fill.intensity = v),
  });
  num({
    key: "light.ambient",
    group: "Light",
    label: "ambient",
    min: 0,
    max: 4,
    step: 0.02,
    get: () => t.ambient.intensity,
    set: (v) => (t.ambient.intensity = v),
  });
  // The window's contribution, whatever the sky chose. Moving it while the
  // blind is still rising will be overwritten on the next frame; at rest — the
  // state anyone tunes in — this is the sky's number, scaled by hand.
  num({
    key: "light.day",
    group: "Light",
    label: "daylight",
    min: 0,
    max: 3,
    step: 0.02,
    get: () => t.daylight.intensity,
    set: (v) => (t.daylight.intensity = v),
  });
  // The cast shadow, live. It is the one thing in the scene that can look
  // "wrong" without anything being wrong, so it gets a knob rather than an
  // argument: 0 turns the lamp's shadow off completely.
  num({
    key: "light.cast",
    group: "Light",
    label: "cast shadow",
    min: 0,
    max: 1,
    step: 1,
    get: () => (t.key.castShadow ? 1 : 0),
    set: (v) => (t.key.castShadow = v > 0.5),
  });
  num({
    key: "light.cone",
    group: "Light",
    label: "cone°",
    min: 10,
    max: 85,
    step: 1,
    get: () => t.key.angle / DEG,
    set: (v) => (t.key.angle = v * DEG),
  });
  num({
    key: "light.penumbra",
    group: "Light",
    label: "penumbra",
    min: 0,
    max: 1,
    step: 0.01,
    get: () => t.key.penumbra,
    set: (v) => (t.key.penumbra = v),
  });
  num({
    key: "light.contact",
    group: "Light",
    label: "contact shadow",
    min: 0,
    max: 1,
    step: 0.01,
    get: () => t.materials.contactOpacity(-1),
    set: (v) => t.materials.contactOpacity(v),
  });
  num({
    key: "light.glow",
    group: "Light",
    label: "lamp glow",
    min: 0,
    max: 1,
    step: 0.01,
    get: () => t.materials.glowOpacity(-1),
    set: (v) => t.materials.glowOpacity(v),
  });

  /* --- The base sheet ------------------------------------------------------
   * How far the desk bows. It is a shading device and a hazard in equal parts:
   * every object is seated on it now (see desk.ts), but the sheet still rises
   * through anything built as a child of the room rather than placed on it, so
   * this is the knob to reach for when something looks half-buried. */
  num({
    key: "mat.bow",
    group: "Desk",
    label: "sheet bow",
    min: 0,
    max: 0.012,
    step: 0.0005,
    get: () => t.deskBow.get(),
    set: (v) => t.deskBow.set(v),
  });

  /* --- The notes ------------------------------------------------------------
   * One size for all eight. The per-object `note.<id>.scale` below multiplies
   * on top of it, so this moves the set and that moves the exception. */
  num({
    key: "note.size",
    group: "Notes",
    label: "size",
    min: 0.06,
    max: 0.24,
    step: 0.005,
    get: () => t.noteSize.get(),
    set: (v) => t.noteSize.set(v),
  });

  /* --- The theme ------------------------------------------------------------
   * Picking one stores it and reloads. Deliberately NOT replayed from
   * tuned.json — see applyTuned. */
  list.push({
    kind: "pick",
    key: "theme",
    group: "Theme",
    label: "theme",
    options: t.theme.options,
    value: t.theme.get(),
    set: (v) => t.theme.set(v),
  });

  /* --- Camera and the desk's angle ----------------------------------------- */
  AXIS.forEach((name, i) => {
    num({
      key: `view.camera.${name}`,
      group: "View",
      label: `camera ${name}`,
      min: -4,
      max: 4,
      step: 0.01,
      get: () => t.camera.get().position[i as 0 | 1 | 2],
      set: (v) => {
        const p = t.camera.get().position;
        p[i as 0 | 1 | 2] = v;
        t.camera.set({ position: p });
      },
    });
  });
  num({
    key: "view.fov",
    group: "View",
    label: "fov",
    min: 18,
    max: 70,
    step: 0.5,
    get: () => t.camera.get().fov,
    set: (v) => t.camera.set({ fov: v }),
  });
  /* --- The cursor as an eye ------------------------------------------------
   * "I want the cursor to behave like the user's eyes." Three sliders, and the
   * whole point is that they are three different things — move one at a time
   * or you cannot tell which one you liked.
   *
   * ORBIT (view.parallax) moves the EYE on an arc around whatever it is
   * looking at. Depth: near objects slide past far ones. Framing is safe at
   * any setting, because the arc goes around the subject rather than away.
   *
   * REGARD (view.gaze) moves the THING BEING LOOKED AT across the desk toward
   * the cursor. Direction: it is what brings the object under the cursor
   * toward the middle of frame, and it is the half that reads as intent.
   * This is the one that can push the far edge of the desk out of shot, so it
   * is the one to back off if the composition starts to swim.
   *
   * SPEED (view.parallaxSpeed) is neither: it is the ease rate in 1/seconds
   * that both halves follow the hand at — higher chases harder, the low end is
   * the slow lag of a heavy camera.
   *
   * Each amplitude is a fraction of the rig's full throw, so 0 is off and 1 is
   * what the constants in camera.ts were tuned to. */
  num({
    key: "view.parallax",
    group: "View",
    label: "orbit (eye)",
    min: 0,
    max: 1,
    step: 0.01,
    get: () => t.parallax.amount.get(),
    set: (v) => t.parallax.amount.set(v),
  });
  num({
    key: "view.gaze",
    group: "View",
    label: "gaze (regard)",
    min: 0,
    max: 1,
    step: 0.01,
    get: () => t.parallax.gaze.get(),
    set: (v) => t.parallax.gaze.set(v),
  });
  num({
    key: "view.parallaxSpeed",
    group: "View",
    label: "parallax speed",
    min: 0.5,
    max: 12,
    step: 0.1,
    get: () => t.parallax.speed.get(),
    set: (v) => t.parallax.speed.set(v),
  });
  // The desk's own angle, which is the thing a straight-on view needs: turning
  // the model is not the same as moving the camera, and it keeps the framing.
  num({
    key: "view.angle",
    group: "View",
    label: "desk angle°",
    min: -45,
    max: 45,
    step: 0.5,
    get: () => t.room.rotation.y / DEG,
    set: (v) => (t.room.rotation.y = v * DEG),
  });

  /* --- Lamp ---------------------------------------------------------------- */
  num({
    key: "lamp.scale",
    group: "Lamp",
    label: "scale",
    min: 0.3,
    max: 2.5,
    step: 0.01,
    get: () => t.lamp.scale.x,
    set: (v) => t.lamp.scale.setScalar(v),
  });
  AXIS.forEach((name, i) => {
    num({
      key: `lamp.${name}`,
      group: "Lamp",
      label: name,
      min: -2,
      max: 2,
      step: 0.005,
      get: () => t.lamp.position.getComponent(i),
      set: (v) => t.lamp.position.setComponent(i, v),
    });
  });
  num({
    key: "lamp.yaw",
    group: "Lamp",
    label: "yaw°",
    min: -180,
    max: 180,
    step: 1,
    get: () => t.lamp.rotation.y / DEG,
    set: (v) => (t.lamp.rotation.y = v * DEG),
  });

  /* --- Every object's placement -------------------------------------------- */
  for (const [id, object] of t.artifacts) {
    AXIS.forEach((name, i) => {
      /* y is NOT position.y. The base sheet is bowed, so "0" — which is what
       * every saved artifact y in tuned.json is — has to mean "on the desk",
       * and the desk is at a different height under every object. x and z stay
       * plain world components; the scene adds the sheet back each frame. */
      const height = i === 1;
      num({
        key: `artifact.${id}.${name}`,
        group: id,
        label: name,
        min: -1.6,
        max: 1.6,
        step: 0.005,
        get: () => (height ? t.height.get(id) : object.position.getComponent(i)),
        set: (v) => (height ? t.height.set(id, v) : object.position.setComponent(i, v)),
      });
    });
    num({
      key: `artifact.${id}.yaw`,
      group: id,
      label: "yaw°",
      min: -180,
      max: 180,
      step: 0.5,
      get: () => object.rotation.y / DEG,
      set: (v) => (t.artifacts.get(id)!.rotation.y = v * DEG),
    });
    /* --- Its note ---------------------------------------------------------
     * In the OBJECT's space, so these numbers stay true when the object is
     * moved or turned.
     *
     * The step toward the viewer is baked into z at build time, which is why z
     * does not start at zero — pulling it back toward 0 pushes the note into
     * whatever stands in front of it. */
    const note = t.notes.get(id);
    if (note) {
      AXIS.forEach((name, i) => {
        num({
          key: `note.${id}.${name}`,
          group: id,
          label: `note ${name}`,
          min: -0.8,
          max: 0.8,
          step: 0.005,
          get: () => note.position.getComponent(i),
          set: (v) => note.position.setComponent(i, v),
        });
      });
      /* YAW IS AN OFFSET, NOT AN ANGLE, and it has to be.
       *
       * scene.ts rewrites `note.rotation.y` on every single frame to keep the
       * note square to the view — so an absolute slider would be overwritten
       * between the drag and the next paint, which is why this knob did not
       * exist. Stored on the note as `userData.yawOffset` and ADDED to that
       * per-frame value, it survives, and it means something stable: "a few
       * degrees off square", which stays true from every camera position,
       * where "facing 30°" would only be true from one. */
      num({
        key: `note.${id}.yaw`,
        group: id,
        label: "note yaw°",
        min: -180,
        max: 180,
        step: 0.5,
        get: () => (typeof note.userData.yawOffset === "number" ? note.userData.yawOffset : 0) / DEG,
        set: (v) => (note.userData.yawOffset = v * DEG),
      });
      num({
        key: `note.${id}.lean`,
        group: id,
        label: "note lean°",
        min: -45,
        max: 45,
        step: 0.5,
        get: () => note.rotation.x / DEG,
        set: (v) => (note.rotation.x = v * DEG),
      });
      num({
        key: `note.${id}.scale`,
        group: id,
        label: "note scale",
        min: 0.3,
        max: 2.5,
        step: 0.01,
        get: () => t.noteScale.get(id),
        set: (v) => t.noteScale.set(id, v),
      });
    }

    // Size, because "realistic relative to the desk" is a judgement made by
    // looking, not by arithmetic: every object here is already about right in
    // absolute centimetres, and it is the RATIO to a 2.4m desk that decides
    // whether the thing reads as a book or a coffee table.
    num({
      key: `artifact.${id}.scale`,
      group: id,
      label: "scale",
      min: 0.3,
      max: 2,
      step: 0.01,
      get: () => object.scale.x,
      set: (v) => object.scale.setScalar(v),
    });
  }

  return list;
}

/**
 * Replays saved values through the setters above.
 *
 * Unknown keys are ignored rather than thrown on: tuned.json is written by a
 * previous version of this list, and a key that has since been renamed should
 * cost a lost slider, not a blank page.
 */
export function applyTuned(t: TunerTargets, saved: Tuned): void {
  const byKey = new Map(specs(t).map((s) => [s.key, s]));
  for (const [key, value] of Object.entries(saved)) {
    /* EXCEPT THE THEME. Its setter reloads the page, and the theme is already
     * decided by the URL and localStorage before this file is reached — so
     * replaying a saved one fights whatever ?theme= asked for, and the two
     * bounce a reload off each other forever. The tuner still writes it to the
     * file; nothing reads it back. */
    if (key === "theme") continue;
    const spec = byKey.get(key);
    if (!spec) continue;
    if (spec.kind === "num") {
      if (typeof value === "number" && Number.isFinite(value)) spec.set(value);
    } else if (typeof value === "string") {
      spec.set(value);
    }
  }
}
