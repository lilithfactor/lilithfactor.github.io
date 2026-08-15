/* ============================================================================
 * THE TUNER — a live control panel for everything the scene is made of.
 *
 * This exists because the loop it replaces was terrible: change a number,
 * rebuild, screenshot, look, repeat. Every round trip cost minutes and the
 * answer was always "a bit more than that". Now the numbers are sliders and the
 * scene updates on the frame.
 *
 * SAVE WRITES TO DISK. In `npm run dev` the Save button POSTs to a middleware
 * that writes src/stages/desk/tuned.json, which the scene replays at mount —
 * so a value moved with a slider is a value that survives a reload, a restart
 * and a build, with nobody transcribing anything. See astro.config.mjs. In a
 * production build there is no endpoint, so Save falls back to the clipboard.
 *
 * NEVER SHIPS TO A VISITOR. Behind an explicit opt-in — `?tune` in the URL,
 * which sticks in localStorage so a reload keeps it — and the module is
 * dynamically imported only when that flag is set, so its bytes are not in the
 * desk chunk for anybody else. (params.ts is the small half that does ship,
 * because the saved values have to be applied for everyone.)
 *
 * The values are read from the live objects at open time, so the panel never
 * disagrees with what is on screen.
 * ========================================================================== */

import { specs, type Spec, type Tuned, type TunerTargets } from "./params";

export type { TunerTargets };

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

export function mountTuner(t: TunerTargets): { dispose(): void } {
  const panel = document.createElement("aside");
  panel.className = "desk-tuner";
  panel.innerHTML = `<header><strong>Desk tuner</strong><button type="button" data-fold>–</button></header>`;

  const body = document.createElement("div");
  body.className = "desk-tuner__body";
  panel.append(body);

  /** key → current value, in the shape that goes to disk. */
  const values: Tuned = {};
  /** key → put a value back into the control, for the pad to drive sliders. */
  const echo = new Map<string, (v: number) => void>();

  const sections = new Map<string, HTMLElement>();
  const sectionFor = (title: string): HTMLElement => {
    let section = sections.get(title);
    if (!section) {
      section = document.createElement("section");
      section.innerHTML = `<h4>${title}</h4>`;
      body.append(section);
      sections.set(title, section);
    }
    return section;
  };

  const label = (into: HTMLElement, text: string, ...controls: HTMLElement[]) => {
    const wrap = document.createElement("label");
    wrap.append(Object.assign(document.createElement("span"), { textContent: text }), ...controls);
    into.append(wrap);
  };

  const all = specs(t);

  for (const spec of all) {
    const into = sectionFor(spec.group);

    if (spec.kind === "num") {
      const input = document.createElement("input");
      const out = document.createElement("output");
      input.type = "range";
      input.min = String(spec.min);
      input.max = String(spec.max);
      input.step = String(spec.step);
      input.value = String(spec.get());
      out.textContent = input.value;
      values[spec.key] = Number(input.value);
      const push = (v: number, drive = true) => {
        input.value = String(v);
        out.textContent = input.value;
        values[spec.key] = v;
        if (drive) spec.set(v);
      };
      input.addEventListener("input", () => push(Number(input.value)));
      echo.set(spec.key, (v) => push(v, false));
      label(into, spec.label, input, out);
      continue;
    }

    if (spec.kind === "hex") {
      const input = document.createElement("input");
      input.type = "color";
      input.value = spec.value;
      values[spec.key] = spec.value;
      input.addEventListener("input", () => {
        values[spec.key] = input.value;
        spec.set(input.value);
      });
      label(into, spec.label, input);
      continue;
    }

    const select = document.createElement("select");
    for (const name of spec.options) select.append(new Option(name, name));
    select.value = spec.value;
    values[spec.key] = spec.value;
    select.addEventListener("change", () => {
      values[spec.key] = select.value;
      spec.set(select.value);
    });
    label(into, spec.label, select);
  }

  /* --- Moving things in two directions at once -----------------------------
   * A slider moves one axis, and placing an object on a desk is never a
   * one-axis question: you want it a bit left AND a bit forward, and doing that
   * as two separate drags means overshooting one while judging the other.
   *
   * So any group that has an x and a z gets a pad above its sliders — drag
   * inside it and the object slides across the desk under the pointer. x and z,
   * not x and y, because those are the two axes of the surface things stand on;
   * height stays a slider, since nothing here floats.
   *
   * One rule rather than one pad per object: the lamp asked for it, and every
   * artifact gets it for free because they are all described the same way. */
  for (const [group, section] of sections) {
    const x = all.find((s) => s.key.endsWith(".x") && s.group === group);
    const z = all.find((s) => s.key.endsWith(".z") && s.group === group);
    if (!x || !z || x.kind !== "num" || z.kind !== "num") continue;

    const pad = document.createElement("div");
    pad.className = "desk-tuner__pad";
    const dot = document.createElement("i");
    pad.append(dot);

    const place = () => {
      dot.style.left = `${((x.get() - x.min) / (x.max - x.min)) * 100}%`;
      dot.style.top = `${((z.get() - z.min) / (z.max - z.min)) * 100}%`;
    };
    place();

    const drag = (e: PointerEvent) => {
      const box = pad.getBoundingClientRect();
      const round = (v: number, step: number) => Math.round(v / step) * step;
      const u = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width));
      const v = Math.min(1, Math.max(0, (e.clientY - box.top) / box.height));
      const nx = round(x.min + u * (x.max - x.min), x.step);
      const nz = round(z.min + v * (z.max - z.min), z.step);
      x.set(nx);
      z.set(nz);
      values[x.key] = nx;
      values[z.key] = nz;
      echo.get(x.key)?.(nx);
      echo.get(z.key)?.(nz);
      place();
    };

    pad.addEventListener("pointerdown", (e) => {
      pad.setPointerCapture(e.pointerId);
      drag(e);
    });
    pad.addEventListener("pointermove", (e) => {
      if (pad.hasPointerCapture(e.pointerId)) drag(e);
    });
    // Insert above the sliders, under the group's heading.
    section.querySelector("h4")?.after(pad);
  }

  /* --- Handing the numbers back --------------------------------------------
   * Save first, because it is the one that ends the loop. Copy stays as the
   * fallback for a built site, where there is no dev server to write to. */
  const foot = document.createElement("footer");
  const save = document.createElement("button");
  save.type = "button";
  save.textContent = "Save to disk";

  const dump = document.createElement("textarea");
  dump.hidden = true;
  dump.rows = 8;

  const toClipboard = async (text: string, button: HTMLButtonElement, ok: string) => {
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = ok;
    } catch {
      // Clipboard can be blocked; the textarea always works.
      dump.value = text;
      dump.hidden = false;
      dump.select();
      button.textContent = "Select and copy below";
    }
  };

  save.addEventListener("click", async () => {
    const text = JSON.stringify(values, null, 2);
    try {
      const response = await fetch("/__tune", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: text,
      });
      if (!response.ok) throw new Error(String(response.status));
      save.textContent = "Saved — tuned.json";
    } catch {
      // A built site, or the dev middleware is not there. Say so rather than
      // pretending it saved, and put the values somewhere they are not lost.
      await toClipboard(text, save, "No dev server — copied instead");
    }
    setTimeout(() => (save.textContent = "Save to disk"), 4000);
  });

  const copy = document.createElement("button");
  copy.type = "button";
  copy.textContent = "Copy JSON";
  copy.addEventListener("click", async () => {
    await toClipboard(JSON.stringify(values, null, 2), copy, "Copied");
    setTimeout(() => (copy.textContent = "Copy JSON"), 4000);
  });

  foot.append(save, copy, dump);
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

/** Re-exported so scene.ts has one import for the whole tuning story. */
export type { Spec };
