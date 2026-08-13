/* ============================================================================
 * THE OBJECTS — eight sections, cut and folded out of card.
 *
 * There are no model files in this project and there will not be. A .glb is a
 * binary asset that cannot be reviewed in a diff, cannot be recoloured from a
 * token, and has to be re-exported by whoever still has the source file in
 * 2029. Procedural geometry is a few hundred lines that a `git blame` explains.
 *
 * What changed with the paper-craft direction is not the shapes — a dossier is
 * still a dossier — but what a shape *is*. Every helper here used to take a
 * material; they now take a colour, because there is only one material in the
 * model and the thing that differs between a manila folder and a sheet of
 * writing paper is which card it was cut from. See cut.ts for why that is a
 * vertex attribute and not twelve materials.
 *
 * The one real modelling change: everything got thicker. Paper that was 3mm is
 * now 5–8mm, and the boards are thicker still. Scale-accurate paper has no
 * visible cut edge, and the cut edge is the entire read. A model-maker works in
 * 2mm greyboard and does not apologise for it.
 *
 * Still under 6k triangles, which is a rounding error against the 250k budget.
 * ========================================================================== */

import { BoxGeometry, CylinderGeometry, Group, Mesh, type Color } from "three";
import { edgeOf, facet, paint } from "./cut";
import type { ArtifactId } from "./layout";
import type { Materials } from "./materials";
import type { Palette } from "./palette";

const DEG = Math.PI / 180;

interface Transform {
  x?: number;
  y?: number;
  z?: number;
  /** Degrees. */
  yaw?: number;
  pitch?: number;
  roll?: number;
}

function place(mesh: Mesh, t: Transform): Mesh {
  mesh.position.set(t.x ?? 0, t.y ?? 0, t.z ?? 0);
  mesh.rotation.set((t.pitch ?? 0) * DEG, (t.yaw ?? 0) * DEG, (t.roll ?? 0) * DEG);
  return mesh;
}

/**
 * A piece of card. The two faces perpendicular to its thinnest dimension are
 * the printed skin; the other four are cuts, and get the darker core colour.
 * Which axis that is falls out of the dimensions, so a sheet lying flat and a
 * board standing upright both come out right without being told which is which.
 */
function card(
  m: Materials,
  colour: Color,
  cut: Color,
  w: number,
  h: number,
  d: number,
  t: Transform = {},
): Mesh {
  const thin: 0 | 1 | 2 = h <= w && h <= d ? 1 : w <= d ? 0 : 2;
  const geometry = new BoxGeometry(w, h, d);
  paint(geometry, colour, edgeOf(colour, cut), thin);
  return place(new Mesh(geometry, m.card), t);
}

/** A rolled tube. Standing on end by default; `roll: 90` lays it down. */
function tube(
  m: Materials,
  colour: Color,
  cut: Color,
  radius: number,
  height: number,
  t: Transform = {},
  segments = 12,
  open = false,
): Mesh {
  const geometry = facet(new CylinderGeometry(radius, radius, height, segments, 1, open));
  paint(geometry, colour, edgeOf(colour, cut), 1, true);
  return place(new Mesh(geometry, m.card), t);
}

function group(...meshes: Mesh[]): Group {
  const g = new Group();
  g.add(...meshes);
  return g;
}

/* --- About: an open notebook, always open — this is the landing state ------ */
function notebook(p: Palette, m: Materials): Group {
  return group(
    card(m, p.paperAged, p.cut, 0.045, 0.03, 0.32, { y: 0.015 }),
    card(m, p.paper, p.cut, 0.24, 0.012, 0.32, { x: -0.13, y: 0.026, roll: 2.2 }),
    card(m, p.paper, p.cut, 0.24, 0.012, 0.32, { x: 0.13, y: 0.026, roll: -2.2 }),
    // One pen, uncapped, lying where it was put down rather than in a tray.
    tube(m, p.accent, p.cut, 0.007, 0.15, { x: 0.19, y: 0.007, z: 0.19, roll: 90, yaw: -22 }, 8),
  );
}

/* --- Case studies: a manila dossier, tabs visible, slightly askew --------- */
function dossier(p: Palette, m: Materials): Group {
  return group(
    card(m, p.kraft, p.cut, 0.34, 0.012, 0.25, { y: 0.006 }),
    card(m, p.paper, p.cut, 0.31, 0.016, 0.22, { y: 0.02 }),
    // The cover is lifted, hinged at the back edge — the dossier is mid-read.
    card(m, p.kraft, p.cut, 0.34, 0.01, 0.25, { y: 0.062, z: -0.1, pitch: -24 }),
    card(m, p.accent, p.cut, 0.062, 0.008, 0.03, { x: 0.1, y: 0.012, z: -0.138 }),
  );
}

/* --- Product dives: a pinned board of index cards, and a magnifier -------- */
function pinBoard(p: Palette, m: Materials): Group {
  // 0.42 tall, centred on the origin, so the group's y in layout.ts (0.21)
  // is exactly what puts its bottom edge on the desk.
  const g = group(
    card(m, p.kraft, p.cut, 0.7, 0.42, 0.03, { pitch: -6 }),
    card(m, p.paper, p.cut, 0.13, 0.09, 0.006, { x: -0.19, y: 0.09, z: 0.021, roll: 3 }),
    card(m, p.paper, p.cut, 0.13, 0.09, 0.006, { x: -0.02, y: 0.1, z: 0.021, roll: -2 }),
    card(m, p.paperAged, p.cut, 0.13, 0.09, 0.006, { x: -0.11, y: -0.04, z: 0.021, roll: 2.5 }),
  );
  // Magnifier: an open-ended tube is a ring, and a ring is a lens rim.
  g.add(tube(m, p.cool, p.cut, 0.048, 0.014, { x: 0.21, y: -0.01, z: 0.055, pitch: 90 }, 16, true));
  g.add(tube(m, p.ink, p.cut, 0.008, 0.09, { x: 0.21, y: -0.09, z: 0.055, roll: 8 }, 8));
  return g;
}

/* --- Projects: a crate of shipped things, lid open, blueprints inside ----- */
function crate(p: Palette, m: Materials): Group {
  return group(
    card(m, p.kraft, p.cut, 0.3, 0.16, 0.24, { y: 0.08 }),
    card(m, p.kraft, p.cut, 0.32, 0.018, 0.26, { y: 0.215, z: -0.115, pitch: -58 }),
    tube(m, p.paper, p.cut, 0.025, 0.27, { x: -0.01, y: 0.19, z: 0.01, roll: 90, yaw: -6 }, 10),
    tube(m, p.paperAged, p.cut, 0.022, 0.24, { x: 0.02, y: 0.186, z: 0.07, roll: 90, yaw: 5 }, 10),
  );
}

/* --- Recommendations: two opened letters with their envelopes ------------- */
function letters(p: Palette, m: Materials): Group {
  return group(
    card(m, p.paperAged, p.cut, 0.165, 0.008, 0.1, { x: -0.1, y: 0.004, z: 0.03, yaw: -9 }),
    card(m, p.paper, p.cut, 0.14, 0.007, 0.19, { x: -0.075, y: 0.011, z: -0.06, yaw: -5 }),
    card(m, p.paperAged, p.cut, 0.165, 0.008, 0.1, { x: 0.11, y: 0.004, z: 0.06, yaw: 8 }),
    card(m, p.paper, p.cut, 0.14, 0.007, 0.19, { x: 0.095, y: 0.011, z: -0.03, yaw: 4 }),
  );
}

/* --- Library: a shelf behind the desk, visibly read ----------------------- */
function shelf(p: Palette, m: Materials): Group {
  const g = group(
    card(m, p.deskDeep, p.cut, 0.86, 0.03, 0.2, {}),
    // The carcass. It runs down to the floor and is almost entirely hidden by
    // the desk, which is the point: a shelf board with nothing under it reads
    // as a missing mesh rather than as a shelf.
    card(m, p.backdrop, p.cut, 0.82, 0.9, 0.18, { y: -0.46 }),
  );

  // Five spines, uneven — a shelf where every book is the same height is a
  // prop shelf. Two are cut from the one cool card in the model, which is what
  // stops a row of warm rectangles reading as five copies of the same book.
  // The sixth leans into the gap the read one left.
  const spines: ReadonlyArray<readonly [number, number, number, Color]> = [
    [-0.36, 0.046, 0.22, p.cool],
    [-0.305, 0.04, 0.19, p.kraft],
    [-0.255, 0.054, 0.235, p.accent],
    [-0.195, 0.042, 0.2, p.paperAged],
    [-0.14, 0.048, 0.185, p.cool],
  ];
  for (const [x, w, h, colour] of spines) {
    g.add(card(m, colour, p.cut, w, h, 0.15, { x, y: 0.015 + h / 2 }));
  }
  g.add(card(m, p.paperEdge, p.cut, 0.05, 0.2, 0.15, { x: -0.085, y: 0.115, roll: -9 }));

  // The one currently being read, laid flat on the shelf.
  g.add(card(m, p.paperAged, p.cut, 0.15, 0.032, 0.11, { x: 0.28, y: 0.031, yaw: 4 }));
  return g;
}

/* --- Beyond the routine: the props are the content ------------------------
 * The cube IS the speedcubing entry, the board IS the chess entry, the
 * turntable IS the music entry. Nothing here is set dressing. */
function props(p: Palette, m: Materials): Group {
  return group(
    card(m, p.ink, p.cut, 0.26, 0.042, 0.26, { y: 0.021 }),
    tube(m, p.ink, p.cut, 0.095, 0.01, { x: -0.02, y: 0.047, z: -0.01 }, 20),
    // A paper label on the record, so the disc is not a black hole on a black
    // plinth — the one place in the model where two dark cards meet.
    tube(m, p.accent, p.cut, 0.03, 0.012, { x: -0.02, y: 0.053, z: -0.01 }, 12),
    // Tonearm parked on its rest. Silence has to be visible. ux-rules.md 13.
    tube(m, p.kraft, p.cut, 0.006, 0.11, { x: 0.085, y: 0.054, z: -0.05, roll: 90, yaw: 34 }, 6),
    card(m, p.accent, p.cut, 0.075, 0.075, 0.075, { x: -0.2, y: 0.038, z: 0.2, yaw: 22, roll: 7 }),
    card(m, p.paperAged, p.cut, 0.2, 0.016, 0.2, { x: 0.02, y: 0.008, z: 0.3, yaw: -6 }),
    card(m, p.ink, p.cut, 0.2, 0.004, 0.045, { x: -0.16, y: 0.002, z: 0.4, yaw: 28 }),
  );
}

/* --- Connect: a business card and a stamped envelope ---------------------- */
function connectCard(p: Palette, m: Materials): Group {
  return group(
    card(m, p.paper, p.cut, 0.18, 0.01, 0.115, { y: 0.005 }),
    card(m, p.accent, p.cut, 0.03, 0.004, 0.036, { x: 0.062, y: 0.012, z: -0.036, yaw: -4 }),
    card(m, p.paperAged, p.cut, 0.088, 0.006, 0.052, { x: -0.03, y: 0.013, z: 0.055, yaw: -9 }),
  );
}

const BUILDERS: Readonly<Record<ArtifactId, (p: Palette, m: Materials) => Group>> = {
  about: notebook,
  "case-studies": dossier,
  "product-dives": pinBoard,
  projects: crate,
  recommendations: letters,
  library: shelf,
  beyond: props,
  connect: connectCard,
};

export function buildArtifact(id: ArtifactId, p: Palette, materials: Materials): Group {
  const g = BUILDERS[id](p, materials);
  g.name = id;
  return g;
}
