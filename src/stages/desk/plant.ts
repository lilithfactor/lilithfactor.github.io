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
 * AND BELOW TEN IT SAYS NO NUMBER AT ALL. A counter reading "2 likes" is not a
 * neutral fact on a portfolio — it is the page volunteering that almost nobody
 * cared, next to a button asking you to be the third. So under the threshold
 * the tag is an instruction instead, and the number appears at the point where
 * it starts being worth reading. Nothing is hidden that a visitor could act on:
 * the plant's shape still says exactly how far along it is.
 *
 * THREE THINGS ARE ADJUSTABLE, and they live in three different places on
 * purpose:
 *
 *   - THE COUNT is in Supabase, one row, hand-editable in the table editor.
 *     It is a fact about the world that changes without anybody deploying.
 *   - THE THRESHOLDS are `plant.t1`..`plant.t4` in the tuner, saved to
 *     tuned.json. They are a design decision — how much attention a shape is
 *     worth — so they belong in a diff, not in a database row.
 *   - THE STAGE OVERRIDE is `plant.stage`, also in tuned.json: -1 derives from
 *     the count, 0-4 pins the plant there and stops it responding to likes.
 *
 * `plant.seed` is the fourth and the most honest of the four: a number added to
 * the real count before the ladder is read. It is how the plant opens looking
 * established without the page claiming an audience it does not have — and
 * because it is a visible line in a versioned file rather than a constant
 * buried in a function, nobody has to remember later which part was true.
 *
 * The desk never waits for the count. The plant is built at whatever stage the
 * cached or local number says, and the shared total redraws it when — or if —
 * it arrives. See likes.ts for the project and the fallback.
 * ========================================================================== */

import { Vector3, type Camera, type Group, type Object3D } from "three";
import { hasLiked, like, likeCount } from "./likes";
import type { Materials } from "./materials";
import { plant, PLANT_THRESHOLDS, PLANT_TOP, plantStage, plantToGo } from "./objects";
import type { Palette } from "./palette";

/** How long a new tier takes to unfurl out of its joint. */
const GROW_MS = 700;

/**
 * The total below which the tag shows no number.
 *
 * Ten, because that is roughly where a count stops being an admission. It is a
 * copy decision rather than a tuned one, so it is a constant here and not a
 * slider: a knob for it would invite fiddling with the one number on this page
 * whose job is to be trustworthy.
 */
const SHOW_COUNT_AT = 10;

export interface PlantRig {
  readonly group: Group;
  /**
   * The four knobs the tuner drives. All of them redraw on the frame and all
   * of them replay through applyTuned at mount — see params.ts for which of
   * these is a design decision and which is an override.
   */
  readonly controls: {
    /** -1 derives the stage from the count; 0-4 pins it there. */
    stage: { get(): number; set(v: number): void };
    /** Added to the real count before the ladder is read. */
    seed: { get(): number; set(v: number): void };
    /** Threshold `i`, 1-4. The setter keeps the ladder ascending. */
    threshold: { get(i: number): number; set(i: number, v: number): void };
  };
  /** Projects the tag and eases anything still growing. Once per frame. */
  update(camera: Camera, width: number, height: number, dt: number): void;
  /** The pointer hit the plant itself. Same call the button makes. */
  activate(): void;
  dispose(): void;
}

const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);

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

  /* --- The three adjustable things -----------------------------------------
   * A mutable copy of the default ladder, because the tuner moves it and the
   * default is a `readonly` export shared with anything else that asks. */
  const ladder = [...PLANT_THRESHOLDS];
  /** Added to the real count. See the file header for why this beats a lie. */
  let seed = 0;
  /**
   * -1 = derive the stage from the total, which is the default and what makes
   * the button mean anything. 0-4 PINS the plant at that stage.
   *
   * The trade is deliberate and it is not a bug: a pinned plant stops
   * responding to likes entirely. Somebody clicks, the number moves, the shape
   * does not. That is the right behaviour for an override — it is how you park
   * the plant at a shape you want for a screenshot or a launch — and it is why
   * the tag drops its "more to grow" line while a pin is in, rather than
   * promising a change that will not come.
   */
  let pin = -1;

  /** What the ladder is actually read against. */
  const total = () => count + seed;
  /** The stage that should be on screen right now. */
  const wanted = () => (pin >= 0 ? Math.min(tiers.length - 1, pin) : plantStage(total(), ladder));
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

  /**
   * "57 likes · 3 more to grow", or an instruction, and nothing more decorated
   * than that.
   */
  function caption(): string {
    const n = total();
    if (n < SHOW_COUNT_AT) return "Click to water it";
    const likes = n === 1 ? "1 like" : `${n} likes`;
    // Pinned: the shape is not tracking the count, so do not say it is.
    if (pin >= 0) return likes;
    const togo = plantToGo(n, ladder);
    return togo === null ? `${likes} · fully grown` : `${likes} · ${togo} more to grow`;
  }

  function paint(): void {
    tag.textContent = caption();
    button.textContent = liked ? "Watered" : "Water it";
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
   * — a raised threshold, or a pin dropped to a lower stage — simply leaves.
   * There is no reverse animation, because a plant does not un-grow and the
   * only audience for that transition is the person dragging the slider.
   *
   * `removeFromParent()` is the whole of what a departing tier needs and the
   * whole of what it may have: the tier stays alive and re-attachable, and its
   * geometry and material must NOT be disposed here. Disposal belongs at rig
   * teardown, once, where nothing is going to ask for the tier again.
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

  /** The tag and the shape, together, because nothing moves one without the
   * other: every knob below and every arriving count goes through here. */
  function redraw(animate: boolean): void {
    paint();
    apply(wanted(), animate);
  }

  /** One like, once. The guard is the button's, not the database's. */
  function activate(): void {
    if (liked || busy) return;
    busy = true;
    // Set before the round trip, so a fast second click has nothing to do.
    liked = true;
    paint();
    void like().then((n) => {
      count = n;
      busy = false;
      redraw(true);
    });
  }

  button.addEventListener("click", activate);

  // The first number. Cached, local, or shared — likes.ts decides, and this
  // does not care which it got.
  void likeCount().then((n) => {
    count = n;
    redraw(false);
  });

  redraw(false);

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
    controls: {
      stage: {
        get: () => pin,
        set: (v) => {
          pin = Math.max(-1, Math.min(tiers.length - 1, Math.round(v)));
          redraw(true);
        },
      },
      seed: {
        get: () => seed,
        set: (v) => {
          seed = Math.max(0, Math.round(v));
          redraw(true);
        },
      },
      threshold: {
        get: (i) => ladder[i] ?? 0,
        /**
         * Writes one rung and then repairs the ladder around it.
         *
         * A ladder that is not strictly ascending is not a slightly wrong
         * ladder, it is a broken one: `plantToGo` would hand the tag a
         * negative distance and two stages would claim the same total. So
         * dragging t3 below t2 pushes t2 (and t1) down out of the way, and
         * dragging it above t4 pushes t4 up — in both directions, so it
         * cannot matter which order four sliders are moved in, or which order
         * four saved values are replayed in at mount.
         */
        set: (i, v) => {
          if (i < 1 || i >= ladder.length) return;
          // Floor of `i`, not of 1: four strictly ascending whole numbers above
          // zero means the lowest t4 can ever be is 4. That floor is also what
          // stops the downward repair below walking a rung to zero or past it.
          ladder[i] = Math.max(i, Math.round(v));
          for (let j = i + 1; j < ladder.length; j++) {
            ladder[j] = Math.max(ladder[j]!, ladder[j - 1]! + 1);
          }
          for (let j = i - 1; j >= 1; j--) {
            ladder[j] = Math.min(ladder[j]!, ladder[j + 1]! - 1);
          }
          redraw(true);
        },
      },
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
