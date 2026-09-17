/**
 * Panels — the desk's navigation.
 *
 * Clicking a desk object opens that section as a sheet.
 *
 * NAVIGATION IS DOM. Each object gets a real <button> handle carrying
 * [data-anchor], which the desk's existing anchor projection positions over
 * the object every frame. So a click on the note is an ordinary DOM click, and
 * tab order, Enter/Space and screen-reader names all come free — none of which
 * a canvas raycast would have given us. This is still the only route the
 * keyboard and assistive tech ever take.
 *
 * The desk now ALSO raycasts the pointer, so that clicking the bookcase and
 * not just its label opens Library — see stages/desk/pick.ts, which argues the
 * case. It calls `activate` below rather than carrying its own copy of any of
 * this, so there is exactly one way a section opens however it was asked for.
 *
 * This module imports nothing from three, so it stays cheap and testable.
 *
 * No <dialog>: a native dialog is display:none until opened, which would make
 * the sections invisible to a no-JS visitor and to anything that reads the
 * static HTML. The content has to stay in normal flow and be *re-presented*
 * by CSS, so the same markup serves the document page and the desk.
 * Focus trapping and Escape are the two things dialog would have given us, so
 * they are implemented here — that is the whole cost of the choice.
 */

import { createAudio, type Track } from "./audio";

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

export interface Panels {
  open(artifact: string): void;
  /**
   * Open a section as if its handle had been clicked — the tap, the focus, and
   * then the panel. The desk's raycaster calls this, so a click on the object
   * and a click on its note are the same event from here on, including where
   * Escape hands focus back to.
   */
  activate(artifact: string): void;
  close(): void;
  readonly openId: string | null;
  dispose(): void;
}

export function mountPanels(): Panels {
  const sections = new Map<string, HTMLElement>();
  for (const el of document.querySelectorAll<HTMLElement>("[data-artifact]")) {
    const id = el.dataset.artifact;
    if (id) sections.set(id, el);
  }

  const scrim = document.createElement("div");
  scrim.className = "desk-scrim";
  document.body.append(scrim);

  /* --- Sound ---------------------------------------------------------------
   * One control for music AND effects, starting off. It is a fixed paper tag
   * rather than only the 3D turntable, because a control a keyboard user
   * cannot reach is not a control. */
  let tracks: Track[] = [];
  try {
    tracks = JSON.parse(document.getElementById("playlist")?.textContent ?? "[]");
  } catch {
    tracks = [];
  }
  const audio = createAudio(tracks);

  const sound = document.createElement("button");
  sound.type = "button";
  sound.className = "desk-sound";
  const paintSound = () => {
    const t = audio.track;
    sound.setAttribute("aria-pressed", String(audio.on));
    sound.innerHTML = audio.on
      ? `<span class="desk-sound__disc" aria-hidden="true"></span><span>${t?.name ?? "Playing"}</span><small>${t?.credit ?? ""}</small>`
      : `<span class="desk-sound__disc" aria-hidden="true"></span><span>Play music</span>`;
  };
  sound.addEventListener("click", () => void audio.toggle().then(paintSound));
  audio.subscribe(paintSound);
  paintSound();
  document.body.append(sound);

  const nextTrack = document.createElement("button");
  nextTrack.type = "button";
  nextTrack.className = "desk-sound__next";
  nextTrack.textContent = "Next";
  nextTrack.setAttribute("aria-label", "Next track");
  nextTrack.addEventListener("click", () => audio.next());
  sound.after(nextTrack);

  const hint = document.createElement("p");
  hint.className = "desk-hint";
  hint.textContent = "Click anything on the desk · ← → to browse";
  document.body.append(hint);

  let openId: string | null = null;
  let lastFocused: HTMLElement | null = null;

  /* --- Handles -------------------------------------------------------------
   * A paper tag pinned to each object. It carries [data-anchor], so the desk's
   * projection positions it every frame and the scene's hover/focus wiring
   * raises the object behind it — the section itself cannot do that job, since
   * as a panel it is centred and hidden until opened.
   *
   * A <button>, not a div with a click listener: that is the entire keyboard
   * story (tab order, Enter/Space, and a name announced to a screen reader)
   * for free, and it is why the desk's raycaster is pointer-only — it adds a
   * way in, it never becomes the way in. */
  const handles = document.createElement("div");
  handles.className = "desk-handles";
  /** id → its handle, so `activate` can hand focus to the real control. */
  const handleOf = new Map<string, HTMLButtonElement>();
  for (const [id, section] of sections) {
    const heading = section.querySelector("h2")?.textContent?.trim() ?? id;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "desk-handle";
    btn.dataset.anchor = id;
    btn.textContent = heading;
    btn.setAttribute("aria-haspopup", "dialog");
    btn.addEventListener("click", () => api.activate(id));
    handleOf.set(id, btn);
    handles.append(btn);
  }
  document.body.append(handles);

  /* --- Getting back out ----------------------------------------------------
   * An open panel used to offer exactly one way out: the ✕, or Escape if you
   * knew. If the panel covered the handle you came from — which it does, they
   * are centred — the only route onward was to close, find another tag on the
   * desk, and click it. That is a dead end wearing a close button.
   *
   * So every panel ends with the same three doors: back to the desk, and the
   * section either side of this one. Ordered by the document, which is the
   * order the desk is laid out in and the order a reader tabs through. */
  const order = [...sections.keys()];
  const labelOf = (id: string) =>
    sections.get(id)?.querySelector("h2")?.textContent?.trim() ?? id.replace(/-/g, " ");

  for (const [id, section] of sections) {
    section.setAttribute("aria-hidden", "true");

    const close = document.createElement("button");
    close.type = "button";
    close.className = "panel-close";
    close.setAttribute("aria-label", `Close ${id.replace(/-/g, " ")}`);
    close.textContent = "✕";
    close.addEventListener("click", () => api.close());
    // Into the sticky header, not the panel. Absolutely positioned in a
    // scrolling panel it scrolled away with the text, and a visitor 400px down
    // had no way out but Escape or a reload. The header is the one part that
    // stays, so the exit lives there.
    const header = section.querySelector("header");
    if (header) header.append(close);
    else section.prepend(close);

    const i = order.indexOf(id);
    // Wraps, so there is no dead end at either end of the desk.
    const prev = order[(i - 1 + order.length) % order.length]!;
    const next = order[(i + 1) % order.length]!;

    const nav = document.createElement("nav");
    nav.className = "panel-nav";
    nav.setAttribute("aria-label", "Desk");

    const button = (className: string, text: string, onClick: () => void) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = className;
      b.textContent = text;
      b.addEventListener("click", onClick);
      return b;
    };

    nav.append(
      button("panel-nav__desk", "← Back to the desk", () => api.close()),
      button("panel-nav__step", `← ${labelOf(prev)}`, () => api.open(prev)),
      button("panel-nav__step", `${labelOf(next)} →`, () => api.open(next)),
    );
    section.append(nav);
  }

  /** Puts a panel away. Shared by close() and by switching between panels. */
  function hide(id: string): void {
    const panel = sections.get(id);
    if (!panel) return;
    delete panel.dataset.open;
    panel.setAttribute("aria-hidden", "true");
    panel.scrollTop = 0;
  }

  /** A modifier means the key belongs to the browser or the OS, not to us. */
  const bare = (e: KeyboardEvent) => !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey;

  /** Arrows move a caret before they move the desk. */
  const typing = () => {
    const el = document.activeElement;
    return (
      el instanceof HTMLElement &&
      (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
    );
  };

  function onKeydown(e: KeyboardEvent) {
    // From the desk, with nothing open, the arrows are the way IN. Without
    // this a keyboard visitor had to tab to a handle first, and the handles
    // are invisible, so the hint promised a key that did nothing.
    if (!openId) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      if (!bare(e) || typing() || order.length === 0) return;
      e.preventDefault();
      api.open(e.key === "ArrowRight" ? order[0]! : order[order.length - 1]!);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      api.close();
      return;
    }
    // Left/right walk the desk without closing. Not Tab's job — Tab moves
    // through the open panel's own links, which is what a reader expects.
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const i = order.indexOf(openId);
      if (i < 0) return;
      const step = e.key === "ArrowRight" ? 1 : -1;
      e.preventDefault();
      api.open(order[(i + step + order.length) % order.length]!);
      return;
    }
    if (e.key !== "Tab") return;

    // Trap focus inside the open panel.
    const panel = sections.get(openId);
    if (!panel) return;
    const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (el) => el.offsetParent !== null,
    );
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const api: Panels = {
    get openId() {
      return openId;
    },

    activate(artifact) {
      /* Focus FIRST, and then open.
       *
       * A pointer on the canvas leaves focus on <body>, so a panel opened from
       * the object would send Escape back to the top of the document instead
       * of to the thing that was clicked. The handle is the real control for
       * this section whichever way it was reached; putting focus there first
       * means `open` records it as `lastFocused` and closing returns to the
       * object, exactly as clicking the note already did. */
      handleOf.get(artifact)?.focus({ preventScroll: true });
      audio.play("tap");
      api.open(artifact);
    },

    open(artifact) {
      const panel = sections.get(artifact);
      if (!panel || openId === artifact) return;

      // Switching, not opening: put the previous panel away without restoring
      // focus to the desk or adding a second history entry for one move.
      const switching = openId !== null;
      if (openId) hide(openId);
      else lastFocused = document.activeElement as HTMLElement | null;
      openId = artifact;

      audio.play("paper");
      panel.dataset.open = "";
      handles.dataset.dimmed = "";
      panel.removeAttribute("aria-hidden");
      scrim.dataset.visible = "";
      hint.hidden = true;
      // The one flag every fixed overlay keys off. The lamp grip in particular
      // is a body-level button positioned over the lamp each frame, so with a
      // panel over the canvas it was left hovering on top of the text as an
      // unexplained circle. It is the desk's control; it belongs to the desk.
      document.documentElement.dataset.panel = artifact;

      // Move focus to the panel itself, not its first link: a screen-reader
      // user should hear what opened before they hear where they can go.
      panel.tabIndex = -1;
      panel.focus({ preventScroll: true });

      // Deep-linkable without a navigation: back closes the panel. Replacing
      // rather than pushing when stepping sideways, so Back means "leave the
      // desk panels" and not "undo one of the six sections I skimmed".
      const url = `#${artifact}`;
      if (switching) history.replaceState({ artifact }, "", url);
      else history.pushState({ artifact }, "", url);
    },

    close() {
      if (!openId) return;
      audio.play("paper");
      hide(openId);
      openId = null;
      delete scrim.dataset.visible;
      delete handles.dataset.dimmed;
      delete document.documentElement.dataset.panel;
      lastFocused?.focus?.({ preventScroll: true });
      if (location.hash) history.pushState(null, "", location.pathname);
    },

    dispose() {
      document.removeEventListener("keydown", onKeydown);
      scrim.remove();
      hint.remove();
      handles.remove();
      sound.remove();
      nextTrack.remove();
      audio.dispose();
      // Leave the document exactly as found: the sections must go back to
      // being readable content, not hidden panels.
      delete document.documentElement.dataset.panel;
      for (const section of sections.values()) {
        section.removeAttribute("aria-hidden");
        delete section.dataset.open;
        section.querySelector(".panel-close")?.remove();
        section.querySelector(".panel-nav")?.remove();
      }
    },
  };

  scrim.addEventListener("click", () => api.close());
  document.addEventListener("keydown", onKeydown);
  addEventListener("popstate", () => {
    const id = location.hash.slice(1);
    if (id && sections.has(id)) api.open(id);
    else api.close();
  });

  // A shared link like /#library should land with that panel already open.
  const initial = location.hash.slice(1);
  if (initial && sections.has(initial)) api.open(initial);

  return api;
}
