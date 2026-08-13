/* ============================================================================
 * THE OBJECTS — eight sections, built from boxes and cylinders.
 *
 * There are no model files in this project and there will not be. A .glb is a
 * binary asset that cannot be reviewed in a diff, cannot be recoloured from a
 * token, and has to be re-exported by whoever still has the source file in
 * 2029. Procedural geometry is a few hundred lines that a `git blame` explains.
 *
 * The whole desk is under 5k triangles, which is a rounding error against the
 * 250k budget — paper is cheap, and that is half of why the site is made of it.
 * ========================================================================== */

import { BoxGeometry, CylinderGeometry, Group, Mesh, type MeshStandardMaterial } from "three";
import type { ArtifactId } from "./layout";
import type { Materials } from "./materials";

const DEG = Math.PI / 180;

interface Transform {
  x?: number;
  y?: number;
  z?: number;
  /** Degrees. */
  yaw?: number;
  pitch?: number;
  roll?: number;
  /** Big things ground the composition; details do not need to pay for a shadow map pass. */
  shadow?: boolean;
}

function place(mesh: Mesh, t: Transform): Mesh {
  mesh.position.set(t.x ?? 0, t.y ?? 0, t.z ?? 0);
  mesh.rotation.set((t.pitch ?? 0) * DEG, (t.yaw ?? 0) * DEG, (t.roll ?? 0) * DEG);
  mesh.castShadow = t.shadow ?? false;
  mesh.receiveShadow = true;
  return mesh;
}

/** A box. Paper is a very thin one — thin enough to read as a sheet, thick enough to have an edge. */
function box(
  w: number,
  h: number,
  d: number,
  material: MeshStandardMaterial,
  t: Transform = {},
): Mesh {
  return place(new Mesh(new BoxGeometry(w, h, d), material), t);
}

/** A cylinder. Standing on end by default; `roll: 90` lays it down. */
function tube(
  radius: number,
  height: number,
  material: MeshStandardMaterial,
  t: Transform = {},
  segments = 20,
  open = false,
): Mesh {
  return place(
    new Mesh(new CylinderGeometry(radius, radius, height, segments, 1, open), material),
    t,
  );
}

function group(...meshes: Mesh[]): Group {
  const g = new Group();
  g.add(...meshes);
  return g;
}

/* --- About: an open notebook, always open — this is the landing state ------ */
function notebook(m: Materials): Group {
  return group(
    box(0.04, 0.026, 0.32, m.paperAged, { y: 0.013, shadow: true }),
    box(0.24, 0.005, 0.32, m.paper, { x: -0.128, y: 0.023, roll: 2.2 }),
    box(0.24, 0.005, 0.32, m.paper, { x: 0.128, y: 0.023, roll: -2.2 }),
    // One pen, uncapped, lying where it was put down rather than in a tray.
    tube(0.005, 0.15, m.accent, { x: 0.19, y: 0.005, z: 0.19, roll: 90, yaw: -22 }, 10),
  );
}

/* --- Case studies: a manila dossier, tabs visible, slightly askew --------- */
function dossier(m: Materials): Group {
  return group(
    box(0.34, 0.007, 0.25, m.kraft, { y: 0.0035, shadow: true }),
    box(0.31, 0.012, 0.22, m.paper, { y: 0.013 }),
    // The cover is lifted, hinged at the back edge — the dossier is mid-read.
    box(0.34, 0.006, 0.25, m.kraft, { y: 0.055, z: -0.1, pitch: -22, shadow: true }),
    box(0.062, 0.005, 0.03, m.paperAged, { x: 0.1, y: 0.007, z: -0.138 }),
  );
}

/* --- Product dives: a pinned board of index cards, and a magnifier -------- */
function pinBoard(m: Materials): Group {
  // 0.42 tall, centred on the origin, so the group's y in layout.ts (0.21)
  // is exactly what puts its bottom edge on the desk.
  const g = group(
    box(0.7, 0.42, 0.022, m.kraft, { pitch: -6, shadow: true }),
    box(0.13, 0.09, 0.003, m.paper, { x: -0.19, y: 0.09, z: 0.018, roll: 3 }),
    box(0.13, 0.09, 0.003, m.paper, { x: -0.02, y: 0.1, z: 0.018, roll: -2 }),
    box(0.13, 0.09, 0.003, m.paperAged, { x: -0.11, y: -0.04, z: 0.018, roll: 2.5 }),
  );
  // Magnifier: an open-ended cylinder is a ring, and a ring is a lens rim.
  g.add(tube(0.048, 0.01, m.brass, { x: 0.21, y: -0.01, z: 0.05, pitch: 90 }, 24, true));
  g.add(tube(0.006, 0.09, m.ink, { x: 0.21, y: -0.09, z: 0.05, roll: 8 }, 10));
  return g;
}

/* --- Projects: a crate of shipped things, lid open, blueprints inside ----- */
function crate(m: Materials): Group {
  return group(
    box(0.3, 0.16, 0.24, m.kraft, { y: 0.08, shadow: true }),
    box(0.32, 0.014, 0.26, m.kraft, { y: 0.215, z: -0.115, pitch: -58, shadow: true }),
    tube(0.023, 0.27, m.paper, { x: -0.01, y: 0.185, z: 0.01, roll: 90, yaw: -6 }, 14),
    tube(0.02, 0.24, m.paperAged, { x: 0.02, y: 0.182, z: 0.07, roll: 90, yaw: 5 }, 14),
  );
}

/* --- Recommendations: two opened letters with their envelopes ------------- */
function letters(m: Materials): Group {
  return group(
    box(0.165, 0.004, 0.1, m.paperAged, { x: -0.1, y: 0.002, z: 0.03, yaw: -9, shadow: true }),
    box(0.14, 0.003, 0.19, m.paper, { x: -0.075, y: 0.007, z: -0.06, yaw: -5 }),
    box(0.165, 0.004, 0.1, m.paperAged, { x: 0.11, y: 0.002, z: 0.06, yaw: 8, shadow: true }),
    box(0.14, 0.003, 0.19, m.paper, { x: 0.095, y: 0.006, z: -0.03, yaw: 4 }),
  );
}

/* --- Library: a shelf behind the desk, visibly read ----------------------- */
function shelf(m: Materials): Group {
  const g = group(
    box(0.86, 0.026, 0.2, m.wood, { shadow: true }),
    // The carcass. It runs down to the floor and is almost entirely hidden by
    // the desk, which is the point: a shelf board with nothing under it reads
    // as a missing mesh rather than as a shelf.
    box(0.82, 0.9, 0.18, m.wall, { y: -0.46 }),
  );

  // Five spines, uneven — a shelf where every book is the same height is a
  // prop shelf. The last one leans into the gap the read book left.
  const spines: ReadonlyArray<readonly [number, number, number, MeshStandardMaterial]> = [
    [-0.36, 0.042, 0.22, m.ink],
    [-0.31, 0.036, 0.19, m.kraft],
    [-0.265, 0.05, 0.235, m.accent],
    [-0.205, 0.038, 0.2, m.paperAged],
    [-0.15, 0.044, 0.185, m.ink],
  ];
  for (const [x, w, h, material] of spines) {
    g.add(box(w, h, 0.15, material, { x, y: 0.013 + h / 2, shadow: true }));
  }
  g.add(box(0.046, 0.2, 0.15, m.kraft, { x: -0.1, y: 0.11, roll: -9 }));

  // The one currently being read, laid flat on the shelf.
  g.add(box(0.15, 0.028, 0.11, m.paperAged, { x: 0.28, y: 0.027, yaw: 4, shadow: true }));
  return g;
}

/* --- Beyond the routine: the props are the content ------------------------
 * The cube IS the speedcubing entry, the board IS the chess entry, the
 * turntable IS the music entry. Nothing here is set dressing. */
function props(m: Materials): Group {
  const g = group(
    box(0.26, 0.036, 0.26, m.ink, { y: 0.018, shadow: true }),
    tube(0.095, 0.008, m.paperEdge, { x: -0.02, y: 0.04, z: -0.01 }, 28),
    // Tonearm parked on its rest. Silence has to be visible. ux-rules.md 13.
    tube(0.004, 0.11, m.brass, { x: 0.085, y: 0.048, z: -0.05, roll: 90, yaw: 34 }, 8),
    box(0.075, 0.075, 0.075, m.accent, { x: -0.2, y: 0.038, z: 0.2, yaw: 22, roll: 7, shadow: true }),
    box(0.2, 0.012, 0.2, m.paperAged, { x: 0.02, y: 0.006, z: 0.3, yaw: -6, shadow: true }),
    box(0.2, 0.002, 0.045, m.ink, { x: -0.16, y: 0.001, z: 0.4, yaw: 28 }),
  );
  return g;
}

/* --- Connect: a business card and a stamped envelope ---------------------- */
function card(m: Materials): Group {
  return group(
    box(0.18, 0.005, 0.115, m.paper, { y: 0.0025, shadow: true }),
    box(0.03, 0.001, 0.036, m.accent, { x: 0.062, y: 0.006, z: -0.036, yaw: -4 }),
    box(0.088, 0.002, 0.052, m.paperAged, { x: -0.03, y: 0.008, z: 0.055, yaw: -9 }),
  );
}

const BUILDERS: Readonly<Record<ArtifactId, (m: Materials) => Group>> = {
  about: notebook,
  "case-studies": dossier,
  "product-dives": pinBoard,
  projects: crate,
  recommendations: letters,
  library: shelf,
  beyond: props,
  connect: card,
};

export function buildArtifact(id: ArtifactId, materials: Materials): Group {
  const g = BUILDERS[id](materials);
  g.name = id;
  return g;
}
