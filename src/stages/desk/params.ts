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
  /** The whole model, so the desk can be turned as one. */
  room: Object3D;
  /** id → the placed group, for per-object position and yaw. */
  artifacts: Map<string, Object3D>;
  lamp: Object3D;
  camera: {
    get(): { position: [number, number, number]; target: [number, number, number]; fov: number };
    set(v: { position?: [number, number, number]; target?: [number, number, number]; fov?: number }): void;
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
    get: () => 38,
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
      num({
        key: `artifact.${id}.${name}`,
        group: id,
        label: name,
        min: -1.6,
        max: 1.6,
        step: 0.005,
        get: () => object.position.getComponent(i),
        set: (v) => object.position.setComponent(i, v),
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
    const spec = byKey.get(key);
    if (!spec) continue;
    if (spec.kind === "num") {
      if (typeof value === "number" && Number.isFinite(value)) spec.set(value);
    } else if (typeof value === "string") {
      spec.set(value);
    }
  }
}
