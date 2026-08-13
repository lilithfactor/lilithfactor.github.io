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

  camera.position.copy(position);
  camera.lookAt(lookAt);

  const reference = overviewPosition.distanceTo(overviewTarget);

  return {
    camera,
    reference,

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

      // Drift is applied after the ease, as a rotation of the eye about the
      // look-at point. Rotating the eye rather than nudging the target keeps
      // the subject still and moves the observer, which is what a held camera
      // actually does.
      scratch.copy(position).sub(lookAt);
      const yaw = Math.sin(elapsed * 0.31) * DRIFT_YAW;
      const pitch = Math.sin(elapsed * 0.21 + 1.3) * DRIFT_PITCH;
      scratch.applyAxisAngle(UP, yaw);
      scratch.y += Math.tan(pitch) * scratch.length();

      camera.position.copy(lookAt).add(scratch);
      camera.lookAt(lookAt);
    },

    resize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
  };
}
