/* ============================================================================
 * THE PLANT RIG — the object, the button and the number, wired together.
 *
 * objects.ts cuts the card; this decides how much of it is standing, puts a
 * real <button> over it, and writes the tally underneath.
 *
 * A DOM BUTTON, EXACTLY LIKE A HANDLE. Same pattern as panels.ts: a real
 * <button> positioned every frame from the object's projected anchor, so tab
 * order, Enter and Space and a name a screen reader announces all come free.
 * The 3D plant is ALSO clickable through the picker (pick.ts), which is the
 * pointer's second route to the same call — never its only one. It is
 * deliberately NOT in the section handles map: it opens nothing, it has no
 * panel, and putting it there would give it a place in a navigation it is not
 * part of.
 *
 * WHAT THE TAG SAYS is the whole feature from where a visitor stands, so it
 * says it plainly: a total, and how far to the next change. No exclamation
 * marks, no reward language, nothing that congratulates anybody for clicking.
 * It is `aria-live` so the count reaching a keyboard user does not depend on
 * them noticing a paper square move.
 *
 * The desk never waits for the count. The plant is built at whatever stage the
 * cached or local number says, and the shared total redraws it when — or if —
 * it arrives. See likes.ts for the endpoint and the fallback.
 * ========================================================================== */

import { Vector3, type Camera, type Group, type Object3D } from "three";
import { hasLiked, like, likeCount } from "./likes";
import type { Materials } from "./materials";
import { plant, PLANT_TOP, plantStage, plantToGo } from "./objects";
import type { Palette } from "./palette";

/** How long a new tier takes to unfurl out of its joint. */
const GROW_MS = 700;

export interface PlantRig {
  readonly group: Group;
  /**
   * The stage the tuner is showing, 0..4. Previewing one NEVER touches the
   * count — it is a way to look at every growth stage without faking likes,
   * and the next real like puts the plant back where the total says it is.
   */
  readonly preview: { get(): number; set(v: number): void };
  /** Projects the tag and eases anything still growing. Once per frame. */
  update(camera: Camera, width: number, height: number, dt: number): void;
  /** The pointer hit the plant itself. Same call the button makes. */
  activate(): void;
  dispose(): void;
}

const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);

/** "142 likes · 8 more to grow" — and nothing more decorated than that. */
function caption(count: number): string {
  const likes = count === 0 ? "No likes yet" : count === 1 ? "1 like" : `${count} likes`;
  const togo = plantToGo(count);
  return togo === null ? `${likes} · fully grown` : `${likes} · ${togo} more to grow`;
}

/**
 * Builds the plant, mounts its controls, and returns the rig.
 *
 * `ink` is outline.ts's `apply`, handed in rather than imported: a tier that
 * arrives after the scene was outlined has to be baked when it arrives, and
 * the plant is the only thing in this model that gains geometry at runtime.
 */
export function createPlant(
  p: Palette,
  m: Materials,
  ink: (root: Object3D) => void,
): PlantRig {
  const { group, tiers } = plant(p, m);

  let count = 0;
  let liked = hasLiked();
  let stage = 0;
  let busy = false;
  const growing: { tier: Group; clock: number }[] = [];
  const still = matchMedia("(prefers-reduced-motion: reduce)");

  /* --- The controls --------------------------------------------------------
   * One fixed wrapper carrying both, positioned at the plant's anchor. The
   * wrapper takes no pointer events; the button takes its own, so the desk's
   * raycaster does not also fire underneath it (pick.ts ignores anything that
   * is a <button>). */
  const wrap = document.createElement("div");
  wrap.className = "desk-plant";

  const tag = document.createElement("p");
  tag.className = "desk-plant__tag";
  // Polite: the total changing is worth hearing, but not worth interrupting
  // whatever a screen reader is in the middle of saying.
  tag.setAttribute("aria-live", "polite");

  const button = document.createElement("button");
  button.type = "button";
  button.className = "desk-like";

  wrap.append(tag, button);
  document.body.append(wrap);

  function paint(): void {
    tag.textContent = caption(count);
    button.textContent = liked ? "Liked" : "Like this plant";
    // aria-disabled rather than disabled: a disabled button drops out of tab
    // order, and a keyboard user who tabs to the plant and finds nothing there
    // has been told less than one that says "Liked".
    button.setAttribute("aria-disabled", String(liked));
    button.dataset.liked = liked ? "1" : "";
  }

  /**
   * Attaches exactly the tiers this stage has paid for.
   *
   * A tier that arrives is baked, then eased out of nothing. A tier that goes
   * (only the tuner can take one away) simply leaves — there is no reverse
   * animation, because a plant does not un-grow and the only audience for that
   * transition is the person dragging the slider.
   */
  function apply(next: number, animate: boolean): void {
    stage = Math.max(0, Math.min(tiers.length - 1, Math.round(next)));
    for (let i = 0; i < tiers.length; i++) {
      const tier = tiers[i]!;
      const wanted = i <= stage;
      const attached = tier.parent === group;
      if (wanted && !attached) {
        group.add(tier);
        // Bake now: the scene outlined the plant before this tier existed.
        ink(tier);
        if (animate && !still.matches) {
          tier.scale.setScalar(0.02);
          growing.push({ tier, clock: 0 });
        } else {
          tier.scale.setScalar(1);
        }
      } else if (!wanted && attached) {
        tier.removeFromParent();
      }
    }
  }

  /** One like, once. The guard is the button's, not the endpoint's. */
  function activate(): void {
    if (liked || busy) return;
    busy = true;
    // Set before the round trip, so a fast second click has nothing to do.
    liked = true;
    paint();
    void like().then((total) => {
      count = total;
      busy = false;
      paint();
      apply(plantStage(count), true);
    });
  }

  button.addEventListener("click", activate);

  // The first number. Cached, local, or shared — likes.ts decides, and this
  // does not care which it got.
  void likeCount().then((total) => {
    count = total;
    paint();
    apply(plantStage(count), false);
  });

  paint();
  apply(0, false);

  /* --- Where the tag goes --------------------------------------------------
   * The same projection the section handles get (anchors.ts), on one point
   * instead of four: this element has no hit area to match to a piece of
   * paper, it just has to stand above the plant. Half-pixel steps and a
   * written-only-on-change guard, for the same reason — two style writes a
   * frame on one element is nothing, sixty is a habit. */
  const local = new Vector3();
  let lastX = NaN;
  let lastY = NaN;
  let lastVisible: boolean | null = null;

  return {
    group,
    preview: {
      get: () => stage,
      set: (v) => apply(v, true),
    },
    activate,
    update(camera, width, height, dt) {
      for (let i = growing.length - 1; i >= 0; i--) {
        const g = growing[i]!;
        g.clock += dt * 1000;
        const k = Math.min(1, g.clock / GROW_MS);
        g.tier.scale.setScalar(Math.max(0.02, easeOut(k)));
        if (k >= 1) growing.splice(i, 1);
      }

      /* Hung off the plant's CURRENT height, not a fixed one. A seedling and a
       * flowering plant are 150mm apart, and a label that floats where the
       * plant is going to be one day belongs to nothing. */
      local
        .set(0, PLANT_TOP[stage] ?? 0.3, 0)
        .applyMatrix4(group.matrixWorld)
        .project(camera);
      const visible =
        local.z > -1 && local.z < 1 && Math.abs(local.x) < 1.2 && Math.abs(local.y) < 1.2;
      if (visible !== lastVisible) {
        wrap.style.setProperty("--a", visible ? "1" : "0");
        lastVisible = visible;
      }
      if (!visible) return;
      const x = Math.round((local.x * 0.5 + 0.5) * width * 2) / 2;
      const y = Math.round((-local.y * 0.5 + 0.5) * height * 2) / 2;
      if (x !== lastX) {
        wrap.style.setProperty("--x", `${x}px`);
        lastX = x;
      }
      if (y !== lastY) {
        wrap.style.setProperty("--y", `${y}px`);
        lastY = y;
      }
    },
    dispose() {
      button.removeEventListener("click", activate);
      wrap.remove();
    },
  };
}
