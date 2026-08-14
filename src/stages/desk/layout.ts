/* ============================================================================
 * THE MAP — sections to places on the desk.
 *
 * art-direction.md's object table, expressed as coordinates. One unit is one
 * metre; the desk top is the y = 0 plane and spans roughly x ∈ [-1.3, 1.3],
 * z ∈ [-0.7, 0.7]. Positive z is toward the viewer.
 *
 * The ids are the contract with the DOM: every entry here has a matching
 * <section data-artifact="..."> in the prerendered page. If one side gains a
 * section the other must too, and the missing half fails loudly (see
 * anchors.ts) rather than silently rendering an unlabelled object.
 * ========================================================================== */

export const ARTIFACT_IDS = [
  "about",
  "case-studies",
  "product-dives",
  "projects",
  "recommendations",
  "library",
  "beyond",
  "connect",
] as const;

export type ArtifactId = (typeof ARTIFACT_IDS)[number];

/* --- What is printed on the paper ------------------------------------------
 * WHY THIS IS A HARDCODED TABLE AND NOT AN IMPORT.
 *
 * These four numbers are real, and they live in content/case-studies.json,
 * which is the one place content is allowed to come from. This module does not
 * read it, and cannot:
 *
 *   1. architecture.md Directive 1 — src/content/ is the only door to content.
 *      Nothing else may read content/*.json, and reaching around the proxy from
 *      inside the 3D scene would be the exact leak the directive exists to stop.
 *   2. Even going through the proxy is wrong here. The proxy is a build-time
 *      module; importing it from this file would pull the entire content
 *      collection — five case studies with their full bodies, thirty-seven
 *      library entries — into the deferred 3D chunk, to print eleven glyphs.
 *
 * The correct shape for "the scene needs four short strings from content" is a
 * table like this one, kept honest by citation. Every entry names the slug it
 * mirrors and the sentence it came from, so a future editor can check it in one
 * grep, and so nobody is ever tempted to make a number up — which is the only
 * real risk a hardcoded table carries.
 *
 * If a number here ever disagrees with content/case-studies.json, the JSON is
 * right and this table is stale. Fix it here; do not soften it there. */
export interface Outcome {
  /** The section it sits above. Small, quiet, sets the register. */
  readonly kicker: string;
  /** The number itself. The one thing that must be readable at rest. */
  readonly metric: string;
  /** What the number is of. */
  readonly label: string;
}

export const ARTIFACT_LABELS: readonly Outcome[] = [
  // content/case-studies.json — slug "60-faster-onboarding-halved-bounce",
  // name "60% Faster Onboarding, Halved Bounce": "slashed scan time 60% (<15s)".
  { kicker: "ONBOARDING", metric: "60%", label: "FASTER" },
  // slug "visual-compare-for-mass-market-buyers":
  // "1.4x higher lead likelihood for Compare users".
  { kicker: "COMPARE", metric: "1.4x", label: "LEAD LIFT" },
  // slug "25-faster-time-to-market", name "25% Faster Time-to-market":
  // "Accelerated time-to-market by 25%".
  { kicker: "DELIVERY", metric: "25%", label: "FASTER TTM" },
  // slug "visual-compare-for-mass-market-buyers":
  // "~40% adoption from configurator users".
  { kicker: "ADOPTION", metric: "40%", label: "OF USERS" },
];

export interface Placement {
  /** Where the object's group sits, in desk space. */
  readonly position: readonly [number, number, number];
  /** Yaw, in degrees. The desk is used, not staged: nothing is square to the edge. */
  readonly yaw: number;
  /**
   * The point the DOM node tracks, relative to the group origin. Usually a
   * little above the object so the marker sits on it rather than inside it.
   */
  readonly anchor: readonly [number, number, number];
}

/**
 * Layout notes, since the numbers alone do not explain themselves:
 *
 * - `about` is centre-left and closest to the viewer because it is the landing
 *   state — the notebook is already open when you sit down.
 * - `library` and `product-dives` stand behind the desk (positive y, negative
 *   z). They are the two sections that are not objects lying on the surface,
 *   which is what stops the composition reading as eight things in a row.
 * - Every yaw is between 2 and 4 degrees, in alternating directions. Perfect
 *   alignment reads as a template.
 */
export const PLACEMENTS: Readonly<Record<ArtifactId, Placement>> = {
  about: {
    position: [-0.3, 0, 0.12],
    yaw: -2.5,
    anchor: [0, 0.06, 0],
  },
  "case-studies": {
    position: [0.44, 0, 0.02],
    yaw: 3.5,
    anchor: [0, 0.08, 0],
  },
  "product-dives": {
    // Standing on the desk at the back edge, leaning toward the wall. The
    // group origin is the board's centre, so y is half its height: the board
    // rests on the surface rather than floating above it.
    position: [0.1, 0.21, -0.7],
    yaw: -2,
    anchor: [0, 0.29, 0.05],
  },
  projects: {
    position: [-0.94, 0, -0.16],
    yaw: 4,
    anchor: [0, 0.13, 0],
  },
  recommendations: {
    position: [0.24, 0, 0.44],
    yaw: -3,
    anchor: [0, 0.05, 0],
  },
  library: {
    // A low bookcase standing on the floor behind the desk, not a plank
    // floating on the wall. The origin is its top surface; the carcass runs
    // down from there and is hidden by the desk.
    position: [-0.78, 0.56, -0.95],
    yaw: 2,
    anchor: [0, 0.14, 0.02],
  },
  beyond: {
    position: [0.92, 0, -0.34],
    yaw: -3.5,
    anchor: [0, 0.11, 0.05],
  },
  connect: {
    position: [-0.6, 0, 0.42],
    yaw: 2.5,
    anchor: [0, 0.05, 0],
  },
};

/**
 * Where the camera sits when nothing in particular is being looked at.
 *
 * Above and to the left, as if you just sat down. These four numbers are not
 * taste — they were solved for: with the objects placed above, this framing is
 * the one that keeps all eight anchors inside the viewport across every
 * aspect ratio from 1.15 to 3.2, with a margin of 13% of the frame at the
 * tightest. An artifact whose object is cropped out of the shot has a section
 * on the page that points at nothing.
 *
 * If an object moves, re-check the framing. Nothing else here is coupled, but
 * this is.
 */
export const OVERVIEW = {
  position: [-0.85, 1.25, 2.45] as const,
  target: [0, 0.1, -0.05] as const,
  fov: 38,
};

/**
 * A per-artifact framing, derived rather than tabulated: the same shoulder the
 * overview looks over, moved in close. Eight hand-tuned camera pairs would be
 * eight more things to keep consistent every time an object moves.
 */
export const FRAMING_OFFSET = [-0.3, 0.62, 1.0] as const;
