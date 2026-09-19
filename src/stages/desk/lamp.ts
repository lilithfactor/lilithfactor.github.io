/**
 * The lamp rig — the one desk object that acts on the scene itself.
 *
 * "The angle of the lamp should be changeable, the lighting effect will also
 * change based on that" — so this is real lighting response, not a decorative
 * rotation: the head pivots about its arm joint, and the key light's position
 * and target are recomputed from the head's transform, so the warm pool
 * genuinely travels across the desk.
 *
 * Control is a DOM <button> positioned over the shade every frame, exactly the
 * pattern the section handles use (see stages/panels.ts): drag to angle it,
 * arrow keys for keyboard parity, Enter/Space (or clicking the base) to switch
 * it off — the night desk. A pointer-only control would be a defect, not a
 * shortcut: ux-rules.md rule 4.
 */

import { Vector3, type Camera, type Mesh, type SpotLight } from "three";
import { shadeAxisOf, type LampParts } from "./desk";

/** Head pitch limits, radians about the joint. Past these the folded shade
 * would intersect its own arm — sane limits, not physics. */
const MIN = -0.42;
const MAX = 0.5;
/** Arrow-key step. Nine presses sweep the full range. */
const STEP = (MAX - MIN) / 9;

const STORE = "desk-lamp";
const OFF_INTENSITY = 0.22;

export interface LampRig {
  update(camera: Camera, width: number, height: number): void;
  /**
   * Adopts the scene's settled lighting as this lamp's "on".
   *
   * Call it once, AFTER tuned.json has been replayed. The lit intensity cannot
   * be read at construction: `applyTuned` sets `light.key` afterwards, so a
   * value captured here would be the code default, and the first toggle would
   * yank the brightness back to it.
   */
  settle(): void;
  dispose(): void;
}

export function createLampRig(lamp: LampParts, key: SpotLight): LampRig {
  /** The lit intensity. Not read until `settle` — see the interface. */
  let onIntensity = key.intensity;
  let angle = 0;
  let lit = localStorage.getItem(STORE) !== "off";

  /* --- The control ------------------------------------------------------- */
  const grip = document.createElement("button");
  grip.type = "button";
  grip.className = "desk-lamp-grip";
  grip.setAttribute(
    "aria-label",
    "Desk lamp — drag or use arrow keys to angle it, Enter to switch it",
  );
  document.body.append(grip);

  /* --- Light follows head ------------------------------------------------ */
  const world = new Vector3();

  /* WHERE THE LIGHT IS, run EVERY FRAME.
   *
   * This used to be event-driven — recomputed on a drag, a key press or a
   * toggle — and that was a standing bug rather than an optimisation. The lamp
   * is moved by things that are not this file: `applyTuned` replays
   * `lamp.x/y/z/yaw/scale` from tuned.json at mount, and the tuner's sliders
   * move it live. None of them can be expected to know that a spotlight is
   * hanging off the shade, so the beam and the painted pool stayed at whatever
   * pose the lamp had when this rig was built, until the first drag snapped
   * them into place.
   *
   * Reading the transform every frame ends the whole class: two localToWorld
   * calls and one ray/plane intersect, which is nothing beside the render they
   * sit next to, and whatever moves the lamp is followed for free. */
  function pose(): void {
    lamp.head.rotation.z = angle;
    lamp.head.updateMatrixWorld();

    // The bulb and the aim point are head-local; the light lives in world
    // space. Recompute both from the pivoted transform.
    key.position.copy(lamp.head.localToWorld(world.copy(lamp.bulb)));
    key.target.position.copy(lamp.head.localToWorld(world.copy(lamp.aim)));
    key.target.updateMatrixWorld();

    // The painted pool slides to where the light actually lands: the ray
    // bulb → aim intersected with the desk plane (y = 0).
    const from = key.position;
    const to = key.target.position;
    const dy = from.y - to.y;
    if (dy > 0.001) {
      const t = from.y / dy;
      lamp.pool.position.x = from.x + (to.x - from.x) * t;
      lamp.pool.position.z = from.z + (to.z - from.z) * t;
    }
  }

  /** On or off. Nothing here changes per frame, so it stays event-driven. */
  function power(): void {
    key.intensity = lit ? onIntensity : OFF_INTENSITY;
    lamp.pool.visible = lit;
    lamp.glow.visible = lit;
    if (lit) grip.dataset.lit = "";
    else delete grip.dataset.lit;
  }

  function toggle(): void {
    // Going dark: whatever the key light is at right now IS "on", so a
    // `light.key` moved on the tuner survives being switched off and back on.
    if (lit) onIntensity = key.intensity;
    lit = !lit;
    localStorage.setItem(STORE, lit ? "on" : "off");
    power();
  }

  /* --- Drag ---------------------------------------------------------------
   * Vertical drag maps to pitch. No easing anywhere in this file: the hand is
   * the animation, and reduced-motion visitors get identical behaviour. */
  let dragging = false;
  let dragged = false;
  let startY = 0;
  let startAngle = 0;

  const onDown = (e: PointerEvent) => {
    dragging = true;
    dragged = false;
    startY = e.clientY;
    startAngle = angle;
    grip.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    const delta = (startY - e.clientY) / 160;
    if (Math.abs(delta) > 0.02) dragged = true;
    angle = Math.min(MAX, Math.max(MIN, startAngle + delta));
  };
  const onUp = () => {
    dragging = false;
  };
  const onClick = () => {
    // A drag that ends on the button must not also switch the lamp.
    if (!dragged) toggle();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowUp" || e.key === "ArrowRight") {
      angle = Math.min(MAX, angle + STEP);
    } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
      angle = Math.max(MIN, angle - STEP);
    } else {
      return; // Enter/Space fall through to click = toggle
    }
    e.preventDefault();
  };

  grip.addEventListener("pointerdown", onDown);
  grip.addEventListener("pointermove", onMove);
  grip.addEventListener("pointerup", onUp);
  grip.addEventListener("pointercancel", onUp);
  grip.addEventListener("click", onClick);
  grip.addEventListener("keydown", onKey);

  pose();

  /* --- DEV probe ----------------------------------------------------------
   * The beam is invisible: the only way to see whether the light agrees with
   * the lamp is to read both out. Dev only — nothing ships this. */
  if (import.meta.env.DEV) {
    const r3 = (v: number) => Math.round(v * 1000) / 1000;
    const head = new Vector3();
    const pool = new Vector3();
    const beam = new Vector3();
    const axis = new Vector3();
    (window as unknown as { __lampProbe?: () => unknown }).__lampProbe = () => {
      lamp.head.getWorldPosition(head);
      lamp.pool.getWorldPosition(pool);
      const from = key.position;
      const to = key.target.position;
      const dy = from.y - to.y;
      const t = dy > 0.001 ? from.y / dy : 0;
      /* DOES THE BEAM AGREE WITH THE SHADE?
       *
       * The one number that says whether the cone comes out of the shade's
       * mouth: the angle between the shade's own axis, measured off its
       * vertices (desk.ts/shadeAxisOf), and the bulb → aim direction the light
       * actually uses. It read 18.8 degrees while `aim` was a hand-picked
       * lean; it should now be 0. */
      beam.copy(to).sub(from).normalize();
      let shadeDeg: number | null = null;
      let shadeWorld: number[] | null = null;
      if (lamp.shade) {
        const a = shadeAxisOf(lamp.shade as Mesh);
        if (a) {
          axis.copy(a).transformDirection((lamp.shade as Mesh).matrixWorld);
          shadeWorld = [r3(axis.x), r3(axis.y), r3(axis.z)];
          shadeDeg = r3((Math.acos(Math.max(-1, Math.min(1, axis.dot(beam)))) * 180) / Math.PI);
        }
      }
      return {
        shadeAxisWorld: shadeWorld,
        shadeToBeamDeg: shadeDeg,
        keyToHead: r3(from.distanceTo(head)),
        keyPos: [r3(from.x), r3(from.y), r3(from.z)],
        headWorld: [r3(head.x), r3(head.y), r3(head.z)],
        poolWorld: [r3(pool.x), r3(pool.z)],
        beamOnDesk: [r3(from.x + (to.x - from.x) * t), r3(from.z + (to.z - from.z) * t)],
        keyIntensity: r3(key.intensity),
        beamWorld: [r3(beam.x), r3(beam.y), r3(beam.z)],
      };
    };
  }

  return {
    /** Re-aims the light at wherever the lamp now is, then pins the grip to
     * the shade — same projection the section handles use. */
    update(camera, width, height) {
      pose();
      lamp.head.getWorldPosition(world);
      world.project(camera);
      // An open panel owns the screen, and the grip is the DESK's control.
      // This has to be decided HERE and not in CSS: the opacity below is an
      // inline style written every frame, and an inline style beats any rule
      // a stylesheet can offer, so `html[data-panel] .desk-lamp-grip` lost
      // every time and the focus ring floated over the open sheet.
      const visible =
        !document.documentElement.dataset.panel && world.z > -1 && world.z < 1;
      grip.style.opacity = visible ? "1" : "0";
      grip.style.pointerEvents = visible ? "auto" : "none";
      if (visible) {
        const x = (world.x * 0.5 + 0.5) * width;
        const y = (-world.y * 0.5 + 0.5) * height;
        grip.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      }
    },
    settle() {
      // Whatever the scene ended up at — code default or tuned.json — IS the
      // lit brightness. Read it before `power` overwrites it.
      onIntensity = key.intensity;
      pose();
      power();
    },
    dispose() {
      grip.remove();
    },
  };
}
