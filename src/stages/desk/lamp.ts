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

import { Vector3, type Camera, type SpotLight } from "three";
import { AIM, BULB, type LampParts } from "./desk";

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
  dispose(): void;
}

export function createLampRig(lamp: LampParts, key: SpotLight): LampRig {
  const onIntensity = key.intensity;
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

  function apply(): void {
    lamp.head.rotation.z = angle;
    lamp.head.updateMatrixWorld();

    // The bulb and the aim point are head-local; the light lives in world
    // space. Recompute both from the pivoted transform.
    key.position.copy(lamp.head.localToWorld(world.copy(BULB)));
    key.target.position.copy(lamp.head.localToWorld(world.copy(AIM)));
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

    key.intensity = lit ? onIntensity : OFF_INTENSITY;
    lamp.pool.visible = lit;
    lamp.glow.visible = lit;
    grip.dataset.lit = lit ? "" : undefined as unknown as string;
  }

  function toggle(): void {
    lit = !lit;
    localStorage.setItem(STORE, lit ? "on" : "off");
    apply();
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
    apply();
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
    apply();
  };

  grip.addEventListener("pointerdown", onDown);
  grip.addEventListener("pointermove", onMove);
  grip.addEventListener("pointerup", onUp);
  grip.addEventListener("pointercancel", onUp);
  grip.addEventListener("click", onClick);
  grip.addEventListener("keydown", onKey);

  apply();

  return {
    /** Pins the grip to the shade — same projection the section handles use. */
    update(camera, width, height) {
      lamp.head.getWorldPosition(world);
      world.project(camera);
      const visible = world.z > -1 && world.z < 1;
      grip.style.opacity = visible ? "1" : "0";
      grip.style.pointerEvents = visible ? "auto" : "none";
      if (visible) {
        const x = (world.x * 0.5 + 0.5) * width;
        const y = (-world.y * 0.5 + 0.5) * height;
        grip.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      }
    },
    dispose() {
      grip.remove();
    },
  };
}
