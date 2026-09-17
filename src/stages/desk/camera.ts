/* ============================================================================
 * THE CAMERA — a small set of known positions, and nothing else.
 *
 * It does not free-fly and it is not attached to the scroll wheel. The wheel
 * scrolls the page, full stop: scroll-driven camera work is the single most
 * reliable way to make a portfolio nauseating, and it takes the scrollbar's
 * meaning away from every visitor in exchange. ux-rules.md rule 3.
 *
 * The camera moves for exactly one reason: focus landed inside an artifact's
 * section, so it frames that artifact. That makes the keyboard the first-class
 * way to drive the stage rather than an afterthought bolted beside the mouse.
 *
 * Idle, it drifts under a degree of yaw and half a degree of pitch. Enough to
 * feel like a held camera, not enough to notice as motion — and the only
 * infinite animation on the desk. art-direction.md, motion character.
 * ========================================================================== */

import { PerspectiveCamera, Vector3 } from "three";
import { FRAMING_OFFSET, OVERVIEW, type ArtifactId } from "./layout";

const DRIFT_YAW = 0.85 * (Math.PI / 180);
const DRIFT_PITCH = 0.45 * (Math.PI / 180);

/** Module scope, because the alternative is allocating a vector sixty times a second. */
const UP = new Vector3(0, 1, 0);

/**
 * Exponential smoothing rather than a keyframed easing curve: it is frame-rate
 * independent, and it is interruptible at any instant, which matters because a
 * visitor tabbing quickly retargets the camera mid-move and must never watch a
 * stale transition play itself out. TAU 0.19s settles in roughly 700ms.
 */
const TAU = 0.19;

export interface CameraRig {
  readonly camera: PerspectiveCamera;
  /** Distance from the overview camera to the desk — the --scale reference. */
  readonly reference: number;
  /** Pass null to return to the overview. */
  frame(id: ArtifactId | null): void;
  update(elapsed: number, dt: number): void;
  resize(width: number, height: number): void;
  /** Cursor position, each axis −1…1. The rig damps it; callers just report. */
  parallax(nx: number, ny: number): void;
  /**
   * The three knobs behind that: `amount` is 0…1 of the eye's full orbit,
   * `gaze` is 0…1 of how far the point of regard slides across the desk, and
   * `speed` is the ease rate in 1/seconds. Live, so the tuner can move them.
   */
  readonly parallaxTuning: {
    amount: { get(): number; set(v: number): void };
    gaze: { get(): number; set(v: number): void };
    speed: { get(): number; set(v: number): void };
  };
  /**
   * The resting shot, live. The rig recomputes the camera every frame from
   * these, so a tuner cannot just move camera.position — it would be
   * overwritten on the next tick. See tuner.ts.
   */
  overview(): { position: [number, number, number]; target: [number, number, number]; fov: number };
  setOverview(v: {
    position?: [number, number, number];
    target?: [number, number, number];
    fov?: number;
  }): void;
}

export function createCameraRig(
  anchors: ReadonlyMap<ArtifactId, Vector3>,
  width: number,
  height: number,
): CameraRig {
  const camera = new PerspectiveCamera(OVERVIEW.fov, width / height, 0.1, 20);

  const overviewPosition = new Vector3(...OVERVIEW.position);
  const overviewTarget = new Vector3(...OVERVIEW.target);
  const framingOffset = new Vector3(...FRAMING_OFFSET);

  const targetPosition = overviewPosition.clone();
  const targetLookAt = overviewTarget.clone();
  const position = overviewPosition.clone();
  const lookAt = overviewTarget.clone();
  const scratch = new Vector3();
  const regard = new Vector3();

  /* --- THE CURSOR IS AN EYE -------------------------------------------------
   *
   * Gaze is two motions at once, and for a long time this rig only had one of
   * them. It orbited the eye about a FIXED point on the desk, which means the
   * desk centre stayed pinned under the cursor wherever you pointed: the
   * visitor could make the scene lean, but never got the feeling of looking AT
   * anything. At 2.1° of yaw that read as dead.
   *
   * So there are two halves here, applied in this order every frame:
   *
   *   1. THE POINT OF REGARD slides across the desk toward the cursor, up to
   *      GAZE_X / GAZE_Z. This is the eye turning in the socket — it is what
   *      brings whatever you are pointing at toward the middle of the frame.
   *   2. THE EYE ORBITS that point by PARALLAX_YAW / PARALLAX_PITCH. This is
   *      the head moving on its neck — an actual translation of the eye, which
   *      is what makes near and far objects slide past each other.
   *
   * Orbiting keeps the framing honest: the eye travels on an arc AROUND the
   * thing it is looking at, so raising the throw cannot push the subject out
   * of frame the way dollying sideways would. And because the orbit is applied
   * to `position` and the gaze to `lookAt` — both AFTER their own easing —
   * neither fights `frame(id)`: with the cursor centred both terms are exactly
   * zero, so every framed shot and the walk home from it are untouched.
   *
   * The cone is bounded by construction rather than by trust: `parallax()`
   * shapes the cursor into −1…1 and nothing downstream can exceed that, so the
   * total excursion is never more than the four constants below.
   *
   * The three numbers a hand can only find by moving them are live in the
   * tuner — `view.parallax` (the orbit), `view.gaze` (the point of regard) and
   * `view.parallaxSpeed` (the ease rate in 1/seconds, the reciprocal of the
   * 0.24s time constant this used to hardcode). A rate rather than a tau
   * because a slider that gets FASTER as you push it right is the one a hand
   * can read. */
  const PARALLAX_YAW = 9 * (Math.PI / 180);
  const PARALLAX_PITCH = 5.5 * (Math.PI / 180);
  /** How far the point of regard slides, in metres of desk, at full throw. */
  const GAZE_X = 0.16;
  const GAZE_Z = 0.06;
  /**
   * A hand resting near the middle of the screen is not pointing at anything,
   * and a camera that answers it is a camera that never sits still. Inside 6%
   * of half-width the desk is simply at rest; outside it the response is
   * renormalised from that edge, so there is no step at the boundary.
   */
  const DEADZONE = 0.06;
  let parallaxAmount = 1;
  let gazeAmount = 1;
  let parallaxSpeed = 1 / 0.24;
  let cursorX = 0;
  let cursorY = 0;
  let easeX = 0;
  let easeY = 0;

  /**
   * Cursor axis → throw. Clamp, drop the deadzone, then square with the sign
   * kept (`t·|t|`): linear felt twitchy, because the fastest part of a cursor's
   * travel is the middle of the screen and a linear map spends the camera's
   * whole budget there. Squaring puts the movement where the hand is
   * deliberate — out at the edges, where a visitor is actually pointing at
   * something — and leaves the middle calm. It also guarantees |out| ≤ 1.
   */
  const throwOf = (n: number): number => {
    const v = Math.max(-1, Math.min(1, n));
    const a = Math.abs(v);
    if (a <= DEADZONE) return 0;
    const t = (a - DEADZONE) / (1 - DEADZONE);
    return Math.sign(v) * t * t;
  };

  camera.position.copy(position);
  camera.lookAt(lookAt);

  const reference = overviewPosition.distanceTo(overviewTarget);

  return {
    camera,
    reference,

    overview: () => ({
      position: overviewPosition.toArray() as [number, number, number],
      target: overviewTarget.toArray() as [number, number, number],
      fov: camera.fov,
    }),

    setOverview({ position, target, fov }) {
      if (position) overviewPosition.set(...position);
      if (target) overviewTarget.set(...target);
      if (fov !== undefined) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
      // Retarget only if nothing is being framed, so tuning the resting shot
      // while a panel is open does not yank the camera off its subject.
      targetPosition.copy(overviewPosition);
      targetLookAt.copy(overviewTarget);
    },

    frame(id) {
      const anchor = id === null ? null : anchors.get(id);
      if (!anchor) {
        targetPosition.copy(overviewPosition);
        targetLookAt.copy(overviewTarget);
        return;
      }
      targetLookAt.copy(anchor);
      targetPosition.copy(anchor).add(framingOffset);
    },

    update(elapsed, dt) {
      // 1 - e^(-dt/tau): the same settle whether the frame took 8ms or 40ms.
      const k = 1 - Math.exp(-dt / TAU);
      position.lerp(targetPosition, k);
      lookAt.lerp(targetLookAt, k);

      const pk = 1 - Math.exp(-dt * parallaxSpeed);
      easeX += (cursorX - easeX) * pk;
      easeY += (cursorY - easeY) * pk;

      /* THE POINT OF REGARD. An offset on top of the eased look-at, never a
       * replacement for it, so whatever `frame(id)` is easing toward stays the
       * base the gaze is measured from — and a centred cursor leaves it
       * untouched, which is what makes closing a panel land exactly home.
       *
       * The signs are the camera's, not the screen's. The eye sits on +z
       * looking toward −z, so world +x is screen right: the cursor to the
       * right slides the regard to +x, the camera turns right, and the thing
       * that was on the right comes to the middle. The cursor low means the
       * near edge of the desk, which is +z — toward the viewer — so the camera
       * tips down onto it rather than away from it. */
      regard.copy(lookAt);
      regard.x += easeX * GAZE_X * gazeAmount;
      regard.z += easeY * GAZE_Z * gazeAmount;

      // THE EYE. Drift and orbit are applied after the ease, as a rotation of
      // the eye about the point of regard. Rotating the eye rather than
      // dollying it keeps the subject in frame and moves the observer, which is
      // what a head on a neck actually does — and the arc is a real
      // translation, so near and far slide past each other on the way.
      scratch.copy(position).sub(regard);
      const yaw = Math.sin(elapsed * 0.31) * DRIFT_YAW - easeX * PARALLAX_YAW * parallaxAmount;
      const pitch =
        Math.sin(elapsed * 0.21 + 1.3) * DRIFT_PITCH + easeY * PARALLAX_PITCH * parallaxAmount;
      scratch.applyAxisAngle(UP, yaw);
      scratch.y += Math.tan(pitch) * scratch.length();

      camera.position.copy(regard).add(scratch);
      camera.lookAt(regard);
    },

    parallax(nx, ny) {
      cursorX = throwOf(nx);
      cursorY = throwOf(ny);
    },

    parallaxTuning: {
      amount: {
        get: () => parallaxAmount,
        set: (v) => (parallaxAmount = v),
      },
      gaze: {
        get: () => gazeAmount,
        set: (v) => (gazeAmount = v),
      },
      speed: {
        // Floored rather than trusted: a zero rate freezes the follower at
        // whatever it last held, which reads as a stuck camera, not as "off".
        // Off is amount 0.
        get: () => parallaxSpeed,
        set: (v) => (parallaxSpeed = Math.max(0.01, v)),
      },
    },

    resize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
  };
}
