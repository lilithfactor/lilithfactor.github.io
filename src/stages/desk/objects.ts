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

import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  type Color,
  type Object3D,
  type Texture,
} from "three";
import { bow, edgeOf, facet, paint } from "./cut";
import type { ArtifactId } from "./layout";
import { printed, type Materials } from "./materials";
import { stock, type Palette } from "./palette";
import type { Press } from "./print";
import type { ModelKit, ModelSpec } from "./models";

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

// Generic over Object3D rather than Mesh, so a loaded model places exactly the
// way a folded card does.
function place<T extends Object3D>(o: T, t: Transform): T {
  o.position.set(t.x ?? 0, t.y ?? 0, t.z ?? 0);
  o.rotation.set((t.pitch ?? 0) * DEG, (t.yaw ?? 0) * DEG, (t.roll ?? 0) * DEG);
  return o;
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
  return place(new Mesh(cardGeometry(colour, cut, w, h, d), m.card), t);
}

/**
 * The geometry half of `card`, split out so a printed sheet can reuse it with
 * a material of its own.
 *
 * Anything with a face over 15cm gets a bow. That threshold is the whole point:
 * a business card is stiff enough to be flat and a sheet of A4 is not, so
 * warping everything would be as wrong as warping nothing. The displacement is
 * a third of a millimetre per 10cm of span — invisible as a shape, and the only
 * reason a large face is no longer one uniform tone of Lambert shading.
 */
function cardGeometry(colour: Color, cut: Color, w: number, h: number, d: number): BoxGeometry {
  const thin: 0 | 1 | 2 = h <= w && h <= d ? 1 : w <= d ? 0 : 2;
  const broad = Math.max(w, d) > 0.15 && h < 0.05;
  // Segments only where there is something to bend. A flat sheet subdivided
  // 6x6 costs 72 triangles instead of 12 and a stiff little card costs nothing.
  const geometry = broad
    ? new BoxGeometry(w, h, d, 6, 1, 6)
    : new BoxGeometry(w, h, d);
  if (broad) bow(geometry, Math.min(w, d) * 0.022, 1);
  paint(geometry, colour, edgeOf(colour, cut), thin);
  return geometry;
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

/**
 * A sheet with something typed on it.
 *
 * Identical to `card` except for the material, which carries this sheet's own
 * print texture in the `map` slot. The print is a multiplier over the vertex
 * colours (see print.ts), so the sheet still gets its stock tone and its darker
 * cut edges from exactly the same mechanism as every other piece of card in the
 * model — which is what stops it reading as a label stuck onto the scene.
 *
 * No extra draw call: the texture goes on the sheet itself rather than on a
 * decal plane floating above it. BoxGeometry's +Y face happens to be laid out
 * with u along +X and v = 1 at -Z, so a canvas drawn the normal way up arrives
 * on the desk the right way up for a reader standing at +Z. Verified against
 * the geometry rather than guessed.
 */
function printedSheet(
  colour: Color,
  cut: Color,
  map: Texture,
  w: number,
  h: number,
  d: number,
  t: Transform = {},
): Mesh {
  return place(new Mesh(cardGeometry(colour, cut, w, h, d), printed(map)), t);
}

function group(...parts: Object3D[]): Group {
  const g = new Group();
  g.add(...parts);
  return g;
}

/* --- What the desk asks for from public/models/ -----------------------------
 * Sizes are the object's largest dimension in metres, chosen against the desk
 * rather than against each other: a mug is 85mm because a mug is 85mm.
 *
 * Every entry is optional at runtime. A missing file leaves the procedural
 * object in place, which is the state lamp.glb and turntable.glb are in until
 * their licence is settled. */
export const MODEL_SPECS = (p: Palette): readonly ModelSpec[] => [
  // The lamp is re-scaled and split into its pivot group by desk.ts, so the
  // size here is nominal — it only has to be sane if that split ever fails.
  { name: "lamp", size: 0.46, tone: p.kraft },
  { name: "open-book", size: 0.34, tone: stock(p.paper, 2) },
  { name: "legal-pad", size: 0.19, tone: p.paperAged },
  { name: "pencil", size: 0.17, tone: p.accent },
  { name: "corkboard", size: 0.66, tone: p.kraft },
  { name: "magnifier", size: 0.19, tone: p.cool },
  { name: "crate", size: 0.3, tone: p.kraft },
  { name: "envelope", size: 0.19, tone: p.paperAged },
  { name: "letter", size: 0.16, tone: stock(p.paper, 3) },
  { name: "books", size: 0.32, tone: p.cool },
  { name: "book-stack", size: 0.19, tone: p.accent },
  { name: "rubiks", size: 0.075, tone: p.accent },
];
// Not the chess knights, though they are fetched and credited. At 62mm on a
// paper board they are ~30 screen pixels of a 200-triangle faceted mesh, and
// the ink outline round every facet collapses into a solid black blob — the one
// thing on a white desk that reads as a bug. The printed position IS the chess
// entry (art-direction.md); a diagram is also the more paper answer.
// Deliberately NOT loaded: folder, clipboard, mug, postit. They are fetched and
// ready, but nothing places them yet — the desk's rule is that every object
// opens something, and downloading four objects to decorate with would break
// it and cost bytes at the same time. See brain/vision/todo.md.

/* --- About: an open notebook, always open — this is the landing state ------ */
function notebook(p: Palette, m: Materials, _press: Press, models: ModelKit): Group {
  const book = models.take("open-book");
  const pad = models.take("legal-pad");
  const pen = models.take("pencil");

  const g = group(
    card(m, p.paperAged, p.cut, 0.045, 0.03, 0.32, { y: 0.015 }),
    // The two open pages are not the same white. They never are: one has been
    // face-up on a desk for a week and the other has been shut inside a book.
    // A loaded open book supersedes them — it has real page curl, which two
    // flat cards cannot fake — but the spine card stays either way.
    ...(book
      ? [place(book, { x: 0.02, y: 0.026, yaw: -3 })]
      : [
          card(m, stock(p.paper, 1), p.cut, 0.24, 0.012, 0.32, { x: -0.13, y: 0.026, roll: 2.2 }),
          card(m, stock(p.paper, 4), p.cut, 0.24, 0.012, 0.32, { x: 0.13, y: 0.026, roll: -2.2 }),
        ]),
  );

  // One pen, uncapped, lying where it was put down rather than in a tray.
  g.add(
    pen
      ? place(pen, { x: 0.2, y: 0.004, z: 0.2, yaw: -22, roll: 90 })
      : tube(m, p.accent, p.cut, 0.007, 0.15, { x: 0.19, y: 0.007, z: 0.19, roll: 90, yaw: -22 }, 8),
  );
  if (pad) g.add(place(pad, { x: -0.26, y: 0.002, z: 0.16, yaw: 11 }));
  return g;
}

/* --- Case studies: four printouts, spread out and read ---------------------
 * THE ONE OBJECT ON THE DESK THAT ARGUES.
 *
 * This was a closed manila folder with a blank sheet in it, and blank was the
 * problem: a visitor who has not clicked anything had been shown that there
 * ARE case studies and nothing whatsoever about them. Eight labelled objects
 * with nothing written on any of them is a navigation bar with a texture on it.
 *
 * So the dossier is open and its contents are out on the desk — four sheets,
 * each carrying one real outcome, big enough to read at the resting camera.
 * That is the difference the whole scene is for: at rest, before any click,
 * the desk says 60%, 1.4x, 25%, 40%.
 *
 * They are laid out as four things someone put down, not as a 2x2 of cards:
 * every sheet has its own yaw, the rows do not line up, and the pairs are
 * offset. Perfect alignment is the thing art-direction.md names as the fastest
 * way to make a considered scene read as a template.
 *
 * The 11-degree tilt is not decoration either. A sheet lying flat on a desk
 * viewed from this camera is foreshortened to about 40% of its height, and
 * leaning it back against the folder recovers roughly a third of that — which
 * is the difference between a number you can read and a number you can see. */
function dossier(p: Palette, m: Materials, press: Press): Group {
  const folder = group(
    card(m, p.kraft, p.cut, 0.66, 0.014, 0.46, { y: 0.007 }),
    // The raised cover at the back. It is what the sheets lean on, so it is
    // load-bearing in the literal sense as well as the compositional one: it
    // explains the tilt that makes the print legible.
    card(m, stock(p.kraft, 2), p.cut, 0.62, 0.012, 0.22, { y: 0.055, z: -0.2, pitch: -26 }),
    card(m, p.accent, p.cut, 0.07, 0.008, 0.032, { x: 0.2, y: 0.017, z: -0.28 }),
  );

  // Where each printout landed. Four positions, none of them square to
  // anything, and the two rows deliberately not the same width apart.
  const spread: ReadonlyArray<Transform> = [
    { x: -0.155, z: -0.07, yaw: -9, pitch: 11 },
    { x: 0.145, z: -0.1, yaw: 7, pitch: 12 },
    { x: -0.175, z: 0.15, yaw: 5, pitch: 10 },
    { x: 0.125, z: 0.18, yaw: -8, pitch: 11 },
  ];

  press.sheets.forEach((map, i) => {
    const at = spread[i];
    if (!at) return;
    folder.add(
      printedSheet(stock(p.paper, i + 1), p.cut, map, 0.26, 0.007, 0.35, {
        ...at,
        // Set so the near edge rests on the folder and the far edge on the
        // raised cover, rather than either end floating.
        y: 0.043,
      }),
    );
  });

  return folder;
}

/* --- Product dives: a pinned board of index cards, and a magnifier -------- */
function pinBoard(p: Palette, m: Materials, _press: Press, models: ModelKit): Group {
  const board = models.take("corkboard");
  const glass = models.take("magnifier");

  // 0.42 tall, centred on the origin, so the group's y in layout.ts (0.21)
  // is exactly what puts its bottom edge on the desk. The loaded board is
  // re-seated to sit on y = 0, so it is lowered by half that to match.
  const g = group(
    board
      ? place(board, { y: -0.21, pitch: -6 })
      : card(m, p.kraft, p.cut, 0.7, 0.42, 0.03, { pitch: -6 }),
    // Three cards off three different pads. Same size, not the same white.
    card(m, stock(p.paper, 1), p.cut, 0.13, 0.09, 0.006, { x: -0.19, y: 0.09, z: 0.021, roll: 3 }),
    card(m, stock(p.paper, 3), p.cut, 0.13, 0.09, 0.006, { x: -0.02, y: 0.1, z: 0.021, roll: -2 }),
    card(m, stock(p.paperAged, 2), p.cut, 0.13, 0.09, 0.006, {
      x: -0.11,
      y: -0.04,
      z: 0.021,
      roll: 2.5,
    }),
  );
  // Magnifier: a real one when we have it, otherwise an open-ended tube, which
  // is a ring, which is a lens rim.
  if (glass) {
    g.add(place(glass, { x: 0.24, y: -0.06, z: 0.06, pitch: 74, roll: 14 }));
  } else {
    g.add(tube(m, p.cool, p.cut, 0.048, 0.014, { x: 0.21, y: -0.01, z: 0.055, pitch: 90 }, 16, true));
    g.add(tube(m, p.ink, p.cut, 0.008, 0.09, { x: 0.21, y: -0.09, z: 0.055, roll: 8 }, 8));
  }
  return g;
}

/* --- Projects: a crate of shipped things, lid open, blueprints inside ----- */
function crate(p: Palette, m: Materials, _press: Press, models: ModelKit): Group {
  const box = models.take("crate");
  // The rolled drawings stay procedural either way: they are what says the box
  // is full of shipped work rather than empty, and a loaded box is just a box.
  return group(
    ...(box
      ? [place(box, { yaw: -4 })]
      : [
          card(m, p.kraft, p.cut, 0.3, 0.16, 0.24, { y: 0.08 }),
          card(m, p.kraft, p.cut, 0.32, 0.018, 0.26, { y: 0.215, z: -0.115, pitch: -58 }),
        ]),
    tube(m, p.paper, p.cut, 0.025, 0.27, { x: -0.01, y: 0.19, z: 0.01, roll: 90, yaw: -6 }, 10),
    tube(m, p.paperAged, p.cut, 0.022, 0.24, { x: 0.02, y: 0.186, z: 0.07, roll: 90, yaw: 5 }, 10),
  );
}

/* --- Recommendations: two opened letters with their envelopes ------------- */
function letters(p: Palette, m: Materials, _press: Press, models: ModelKit): Group {
  const envelope = models.take("envelope");
  const letter = models.take("letter");
  // Two letters from two people, so two envelopes and two writing papers. Only
  // one of each is a model — the second stays cut card, because two copies of
  // the same mesh side by side is the thing that reads as an asset pack.
  return group(
    envelope
      ? place(envelope, { x: -0.1, y: 0.002, z: 0.03, yaw: -9 })
      : card(m, p.paperAged, p.cut, 0.165, 0.008, 0.1, { x: -0.1, y: 0.004, z: 0.03, yaw: -9 }),
    letter
      ? place(letter, { x: -0.075, y: 0.009, z: -0.07, yaw: -5 })
      : card(m, stock(p.paper, 2), p.cut, 0.14, 0.007, 0.19, {
          x: -0.075,
          y: 0.011,
          z: -0.06,
          yaw: -5,
        }),
    card(m, stock(p.paperAged, 4), p.cut, 0.165, 0.008, 0.1, { x: 0.11, y: 0.004, z: 0.06, yaw: 8 }),
    card(m, stock(p.paper, 5), p.cut, 0.14, 0.007, 0.19, { x: 0.095, y: 0.011, z: -0.03, yaw: 4 }),
  );
}

/* --- Library: a shelf behind the desk, visibly read ----------------------- */
function shelf(p: Palette, m: Materials, _press: Press, models: ModelKit): Group {
  const row = models.take("books");
  const stack = models.take("book-stack");
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
  if (row) {
    // A leaning row of real books, which is a shape five extruded rectangles
    // cannot make: the lean is the whole read of a shelf someone uses.
    g.add(place(row, { x: -0.24, y: 0.015, yaw: 2 }));
  } else {
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
  }

  // The ones currently being read, laid flat on the shelf.
  g.add(
    stack
      ? place(stack, { x: 0.28, y: 0.015, yaw: 4 })
      : card(m, p.paperAged, p.cut, 0.15, 0.032, 0.11, { x: 0.28, y: 0.031, yaw: 4 }),
  );
  return g;
}

/* --- Beyond the routine: the props are the content ------------------------
 * The cube IS the speedcubing entry, the board IS the chess entry, the
 * turntable IS the music entry. Nothing here is set dressing. */
function props(p: Palette, m: Materials, press: Press, models: ModelKit): Group {
  const cube = models.take("rubiks");
  const g = group(
    card(m, p.ink, p.cut, 0.26, 0.042, 0.26, { y: 0.021 }),
    tube(m, p.ink, p.cut, 0.095, 0.01, { x: -0.02, y: 0.047, z: -0.01 }, 20),
    // A paper label on the record, so the disc is not a black hole on a black
    // plinth — the one place in the model where two dark cards meet.
    tube(m, p.accent, p.cut, 0.03, 0.012, { x: -0.02, y: 0.053, z: -0.01 }, 12),
    // Tonearm parked on its rest. Silence has to be visible. ux-rules.md 13.
    tube(m, p.kraft, p.cut, 0.006, 0.11, { x: 0.085, y: 0.054, z: -0.05, roll: 90, yaw: 34 }, 6),
    // The cube IS the speedcubing entry, so it is a real cube when we have one.
    cube
      ? place(cube, { x: -0.2, y: 0.001, z: 0.2, yaw: 22, roll: 7 })
      : card(m, p.accent, p.cut, 0.075, 0.075, 0.075, {
          x: -0.2,
          y: 0.038,
          z: 0.2,
          yaw: 22,
          roll: 7,
        }),
    card(m, p.ink, p.cut, 0.2, 0.004, 0.045, { x: -0.16, y: 0.002, z: 0.4, yaw: 28 }),
  );


  // The board, set to a real game. It was a blank tan square, which made the
  // one object art-direction.md is most explicit about ("the chess board IS the
  // Chess entry, and it is set to a real position") the emptiest thing on the
  // desk. Printed rather than built: see print.ts for what twenty-four carved
  // pieces would have cost and why a diagram is the more paper answer anyway.
  g.add(
    press.chess
      ? printedSheet(p.paperAged, p.cut, press.chess, 0.2, 0.016, 0.2, {
          x: 0.02,
          y: 0.008,
          z: 0.3,
          yaw: -6,
        })
      : card(m, p.paperAged, p.cut, 0.2, 0.016, 0.2, { x: 0.02, y: 0.008, z: 0.3, yaw: -6 }),
  );
  return g;
}

/* --- Connect: a business card and a stamped envelope ---------------------- */
function connectCard(p: Palette, m: Materials): Group {
  return group(
    card(m, p.paper, p.cut, 0.18, 0.01, 0.115, { y: 0.005 }),
    card(m, p.accent, p.cut, 0.03, 0.004, 0.036, { x: 0.062, y: 0.012, z: -0.036, yaw: -4 }),
    card(m, p.paperAged, p.cut, 0.088, 0.006, 0.052, { x: -0.03, y: 0.013, z: 0.055, yaw: -9 }),
  );
}

type Builder = (p: Palette, m: Materials, press: Press, models: ModelKit) => Group;

const BUILDERS: Readonly<Record<ArtifactId, Builder>> = {
  about: notebook,
  "case-studies": dossier,
  "product-dives": pinBoard,
  projects: crate,
  recommendations: letters,
  library: shelf,
  beyond: props,
  connect: connectCard,
};

export function buildArtifact(
  id: ArtifactId,
  p: Palette,
  materials: Materials,
  press: Press,
  models: ModelKit,
): Group {
  const g = BUILDERS[id](p, materials, press, models);
  g.name = id;
  return g;
}
