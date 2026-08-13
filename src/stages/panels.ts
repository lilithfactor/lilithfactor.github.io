/**
 * Panels — the desk's navigation.
 *
 * Clicking a desk object opens that section as a sheet.
 *
 * There is NO raycaster. Each object gets a real <button> handle carrying
 * [data-anchor], which the desk's existing anchor projection positions over
 * the object every frame. So a click on the object is an ordinary DOM click,
 * and tab order, Enter/Space and screen-reader names all come free — none of
 * which a canvas raycast would have given us.
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

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

export interface Panels {
  open(artifact: string): void;
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

  const hint = document.createElement("p");
  hint.className = "desk-hint";
  hint.textContent = "Click anything on the desk";
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
   * for free, and it is why the desk needs no raycaster at all. */
  const handles = document.createElement("div");
  handles.className = "desk-handles";
  for (const [id, section] of sections) {
    const heading = section.querySelector("h2")?.textContent?.trim() ?? id;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "desk-handle";
    btn.dataset.anchor = id;
    btn.textContent = heading;
    btn.setAttribute("aria-haspopup", "dialog");
    btn.addEventListener("click", () => api.open(id));
    handles.append(btn);
  }
  document.body.append(handles);

  for (const [id, section] of sections) {
    section.setAttribute("aria-hidden", "true");

    const close = document.createElement("button");
    close.type = "button";
    close.className = "panel-close";
    close.setAttribute("aria-label", `Close ${id.replace(/-/g, " ")}`);
    close.textContent = "✕";
    close.addEventListener("click", () => api.close());
    section.prepend(close);
  }

  function onKeydown(e: KeyboardEvent) {
    if (!openId) return;
    if (e.key === "Escape") {
      e.preventDefault();
      api.close();
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

    open(artifact) {
      const panel = sections.get(artifact);
      if (!panel || openId === artifact) return;
      if (openId) api.close();

      lastFocused = document.activeElement as HTMLElement | null;
      openId = artifact;

      panel.dataset.open = "";
      handles.dataset.dimmed = "";
      panel.removeAttribute("aria-hidden");
      scrim.dataset.visible = "";
      hint.hidden = true;

      // Move focus to the panel itself, not its first link: a screen-reader
      // user should hear what opened before they hear where they can go.
      panel.tabIndex = -1;
      panel.focus({ preventScroll: true });

      // Deep-linkable without a navigation: back closes the panel.
      history.pushState({ artifact }, "", `#${artifact}`);
    },

    close() {
      if (!openId) return;
      const panel = sections.get(openId);
      if (panel) {
        delete panel.dataset.open;
        panel.setAttribute("aria-hidden", "true");
        panel.scrollTop = 0;
      }
      openId = null;
      delete scrim.dataset.visible;
      delete handles.dataset.dimmed;
      lastFocused?.focus?.({ preventScroll: true });
      if (location.hash) history.pushState(null, "", location.pathname);
    },

    dispose() {
      document.removeEventListener("keydown", onKeydown);
      scrim.remove();
      hint.remove();
      handles.remove();
      // Leave the document exactly as found: the sections must go back to
      // being readable content, not hidden panels.
      for (const section of sections.values()) {
        section.removeAttribute("aria-hidden");
        delete section.dataset.open;
        section.querySelector(".panel-close")?.remove();
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
