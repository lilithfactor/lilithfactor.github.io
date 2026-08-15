/* ============================================================================
 * THE TUNER — a live control panel for everything the scene is made of.
 *
 * This exists because the loop it replaces was terrible: change a number,
 * rebuild, screenshot, look, repeat. Every round trip cost minutes and the
 * answer was always "a bit more than that". Now the numbers are sliders, the
 * scene updates on the frame, and the panel hands back a block of final values
 * to paste into the source.
 *
 * NEVER SHIPS TO A VISITOR. It is behind an explicit opt-in — `?tune` in the
 * URL, which also sticks in localStorage so a reload keeps it — and the module
 * is dynamically imported only when that flag is set, so its bytes are not in
 * the desk chunk for anybody else.
 *
 * The values here are the SOURCE'S values, read from the live objects at open
 * time, so the panel never disagrees with what is on screen. "Copy" prints
 * them in the shape they appear in the files they came from.
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

const STORE = "desk-tune";

/** Is the tuner wanted? `?tune` turns it on, `?tune=off` turns it off. */
export function tuningRequested(): boolean {
  const flag = new URLSearchParams(location.search).get("tune");
  if (flag === "off") {
    localStorage.removeItem(STORE);
    return false;
  }
  if (flag !== null) localStorage.setItem(STORE, "1");
  return localStorage.getItem(STORE) === "1";
}

interface Row {
  label: string;
  get(): number;
  set(v: number): void;
  min: number;
  max: number;
  step: number;
}

export function mountTuner(t: TunerTargets): { dispose(): void } {
  const panel = document.createElement("aside");
  panel.className = "desk-tuner";
  panel.innerHTML = `<header><strong>Desk tuner</strong><button type="button" data-fold>–</button></header>`;

  const body = document.createElement("div");
  body.className = "desk-tuner__body";
  panel.append(body);

  const readback: Array<() => string> = [];

  const group = (title: string): HTMLElement => {
    const section = document.createElement("section");
    section.innerHTML = `<h4>${title}</h4>`;
    body.append(section);
    return section;
  };

  const slider = (into: HTMLElement, row: Row) => {
    const wrap = document.createElement("label");
    const out = document.createElement("output");
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(row.min);
    input.max = String(row.max);
    input.step = String(row.step);
    input.value = String(row.get());
    out.textContent = input.value;
    input.addEventListener("input", () => {
      const v = Number(input.value);
      row.set(v);
      out.textContent = input.value;
    });
    wrap.append(Object.assign(document.createElement("span"), { textContent: row.label }), input, out);
    into.append(wrap);
    readback.push(() => `${row.label}: ${input.value}`);
  };

  const colour = (into: HTMLElement, label: string, initial: string, set: (hex: string) => void) => {
    const wrap = document.createElement("label");
    const input = document.createElement("input");
    input.type = "color";
    input.value = initial;
    input.addEventListener("input", () => set(input.value));
    wrap.append(Object.assign(document.createElement("span"), { textContent: label }), input);
    into.append(wrap);
    readback.push(() => `${label}: ${input.value}`);
  };

  /* --- Line ---------------------------------------------------------------- */
  const line = group("Outline");
  slider(line, {
    label: "width",
    min: 0.5,
    max: 8,
    step: 0.1,
    get: () => t.outlines.material.linewidth,
    set: (v) => t.outlines.setWidth(v),
  });
  slider(line, {
    label: "fold threshold",
    min: 5,
    max: 80,
    step: 1,
    get: () => 38,
    set: (v) => t.outlines.setThreshold(v),
  });
  colour(line, "ink", "#12100c", (hex) => t.outlines.material.color.set(hex));

  /* --- Paper and surface --------------------------------------------------- */
  const paper = group("Paper");
  colour(paper, "sheet", "#faf8f3", (hex) => t.materials.paper(hex));
  const surface = document.createElement("label");
  const select = document.createElement("select");
  for (const name of t.materials.surfaces) {
    select.append(new Option(name, name));
  }
  select.addEventListener("change", () => t.materials.surface(select.value));
  surface.append(
    Object.assign(document.createElement("span"), { textContent: "surface" }),
    select,
  );
  paper.append(surface);
  readback.push(() => `surface: ${select.value}`);

  /* --- Light --------------------------------------------------------------- */
  const light = group("Light");
  slider(light, {
    label: "key",
    min: 0,
    max: 3,
    step: 0.02,
    get: () => t.key.intensity,
    set: (v) => (t.key.intensity = v),
  });
  slider(light, {
    label: "fill",
    min: 0,
    max: 3,
    step: 0.02,
    get: () => t.fill.intensity,
    set: (v) => (t.fill.intensity = v),
  });
  slider(light, {
    label: "ambient",
    min: 0,
    max: 3,
    step: 0.02,
    get: () => t.ambient.intensity,
    set: (v) => (t.ambient.intensity = v),
  });
  slider(light, {
    label: "contact shadow",
    min: 0,
    max: 1,
    step: 0.01,
    get: () => t.materials.contactOpacity(-1),
    set: (v) => t.materials.contactOpacity(v),
  });
  slider(light, {
    label: "lamp glow",
    min: 0,
    max: 1,
    step: 0.01,
    get: () => t.materials.glowOpacity(-1),
    set: (v) => t.materials.glowOpacity(v),
  });

  /* --- Camera and the desk's angle ----------------------------------------- */
  const view = group("View");
  const cam = t.camera.get();
  const axis = ["x", "y", "z"] as const;
  axis.forEach((name, i) => {
    slider(view, {
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
  slider(view, {
    label: "fov",
    min: 18,
    max: 70,
    step: 0.5,
    get: () => cam.fov,
    set: (v) => t.camera.set({ fov: v }),
  });
  // The desk's own angle, which is the thing a straight-on view needs: turning
  // the model is not the same as moving the camera, and it keeps the framing.
  slider(view, {
    label: "desk angle°",
    min: -45,
    max: 45,
    step: 0.5,
    get: () => (t.room.rotation.y * 180) / Math.PI,
    set: (v) => (t.room.rotation.y = (v * Math.PI) / 180),
  });

  /* --- Lamp ---------------------------------------------------------------- */
  const lampGroup = group("Lamp");
  slider(lampGroup, {
    label: "scale",
    min: 0.3,
    max: 2.5,
    step: 0.01,
    get: () => t.lamp.scale.x,
    set: (v) => t.lamp.scale.setScalar(v),
  });
  axis.forEach((name, i) => {
    slider(lampGroup, {
      label: `lamp ${name}`,
      min: -2,
      max: 2,
      step: 0.01,
      get: () => t.lamp.position.getComponent(i),
      set: (v) => t.lamp.position.setComponent(i, v),
    });
  });
  slider(lampGroup, {
    label: "lamp yaw°",
    min: -180,
    max: 180,
    step: 1,
    get: () => (t.lamp.rotation.y * 180) / Math.PI,
    set: (v) => (t.lamp.rotation.y = (v * Math.PI) / 180),
  });

  /* --- Every object's placement -------------------------------------------- */
  for (const [id, object] of t.artifacts) {
    const section = group(id);
    axis.forEach((name, i) => {
      slider(section, {
        label: name,
        min: -1.6,
        max: 1.6,
        step: 0.01,
        get: () => object.position.getComponent(i),
        set: (v) => object.position.setComponent(i, v),
      });
    });
    slider(section, {
      label: "yaw°",
      min: -180,
      max: 180,
      step: 0.5,
      get: () => (object.rotation.y * 180) / Math.PI,
      set: (v) => (object.rotation.y = (v * Math.PI) / 180),
    });
  }

  /* --- Handing the numbers back -------------------------------------------- */
  const foot = document.createElement("footer");
  const copy = document.createElement("button");
  copy.type = "button";
  copy.textContent = "Copy all values";
  copy.addEventListener("click", async () => {
    const text = readback.map((r) => r()).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      copy.textContent = "Copied — paste it to Claude";
    } catch {
      // Clipboard can be blocked; the textarea is the fallback that always works.
      dump.value = text;
      dump.hidden = false;
      dump.select();
      copy.textContent = "Select and copy below";
    }
    setTimeout(() => (copy.textContent = "Copy all values"), 4000);
  });
  const dump = document.createElement("textarea");
  dump.hidden = true;
  dump.rows = 8;
  foot.append(copy, dump);
  panel.append(foot);

  panel.querySelector("[data-fold]")?.addEventListener("click", (e) => {
    const folded = panel.toggleAttribute("data-folded");
    (e.target as HTMLElement).textContent = folded ? "+" : "–";
  });

  document.body.append(panel);
  return {
    dispose() {
      panel.remove();
    },
  };
}
