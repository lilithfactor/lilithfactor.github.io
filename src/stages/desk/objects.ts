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
  ExtrudeGeometry,
  Group,
  Mesh,
  Shape,
  type Color,
  type Object3D,
  type Texture,
  MeshLambertMaterial,
} from "three";
import { bow, edgeOf, facet, paint } from "./cut";
import type { ArtifactId } from "./layout";
import { printed, type Materials } from "./materials";
import { blend, stock, type Palette } from "./palette";
import { IMMORTAL, type Press } from "./print";
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
  { name: "rubiks", size: 0.075, tone: p.accent },
  // The one prop on this desk that opens nothing. A coaster with a ring on it
  // and no mug is a conspicuous absence — every reference desk in
  // brain/storyboard has a cup on it — and 95mm is what a mug is.
  { name: "mug", size: 0.095, tone: stock(p.paper, 2) },
  /* The chess set. Five files, one author, so the pieces match — there is no
   * queen among them, and the position needs one, so the queen borrows the
   * king. At 35mm squares nobody is going to challenge the ruling.
   *
   * These were left out for a long time on the grounds that a 200-triangle
   * faceted piece 30 pixels tall, ringed in ink at every facet, collapses into
   * a black blob. That reasoning was sound and the conclusion was wrong: the
   * answer is to drop the ink on the pieces (see `chessmen`), not to drop the
   * pieces. Sizes are proportioned to the square, the way a real set is —
   * a king is about one and a half squares tall. */
  { name: "chess-pawn", size: 0.034, tone: stock(p.paper, 1) },
  { name: "chess-rook", size: 0.038, tone: stock(p.paper, 1) },
  { name: "chess-knight", size: 0.044, tone: stock(p.paper, 1) },
  { name: "chess-bishop", size: 0.048, tone: stock(p.paper, 1) },
  { name: "chess-king", size: 0.056, tone: stock(p.paper, 1) },
];
// Deliberately NOT loaded: folder, clipboard, pinboard, turntable, books,
// book-stack. They are fetched and ready, but nothing places them yet — the
// desk's rule is that every object opens something, and downloading objects to
// decorate with would break it and cost bytes at the same time. The last two
// were placed, on top of the bookcase, until RECOMMENDATIONS took that
// surface. See brain/vision/todo.md.

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
      printedSheet(stock(press.stock, i + 1), p.cut, map, 0.26, 0.007, 0.35, {
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

/* --- Library: a bookcase, built rather than downloaded ---------------------
 * The downloaded carcass was an open frame — four uprights and some rails —
 * and at this angle, in one colour, that is a ladder. It never mattered how
 * many books were put on it: an object nobody can name is not helped by
 * decorating it.
 *
 * What makes a bookcase legible is not the frame, it is the SHADOW BOX. A
 * bookcase is a stack of dark rectangular openings with rows of vertical
 * spines set back inside them, and that silhouette is unmistakable at any size
 * and from any angle. So this one is closed: two solid sides, a back, and
 * shelf boards that read as horizontal bands right across it.
 *
 * Which is also why it is built here rather than fetched. Every dimension is
 * one this file can choose — the sides run past the boards, the boards are
 * thick enough to see, the books stand back from the front edge — and none of
 * those is negotiable with a .glb someone else authored for a different scene.
 *
 * The origin is the TOP SURFACE, because that is what layout.ts places (the
 * carcass hangs below it and most of it is behind the desk).
 */
const CASE = { width: 0.92, depth: 0.26, bay: 0.34, board: 0.026, side: 0.022 };

/**
 * A row of books standing on a shelf.
 *
 * Varied on every axis that costs nothing: height, width, and a lean for the
 * last one into the gap. A shelf where every spine is the same size is a
 * texture of a bookshelf; a shelf where they are not is a bookshelf.
 *
 * Deterministic from `seed`, so a shelf does not reshuffle between renders and
 * two shelves are never the same shelf twice.
 */
function spines(
  p: Palette,
  m: Materials,
  x0: number,
  span: number,
  y: number,
  seed: number,
): Object3D[] {
  const out: Object3D[] = [];
  let s = seed >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };

  let x = x0;
  while (x < x0 + span - 0.02) {
    const w = 0.016 + rand() * 0.022;
    const h = 0.17 + rand() * 0.08;
    const d = 0.13 + rand() * 0.05;
    if (x + w > x0 + span) break;
    // Every fifth book or so is off the vertical, resting on its neighbour.
    const lean = rand() > 0.82 ? (rand() - 0.5) * 16 : 0;
    out.push(
      card(m, stock(p.paper, Math.floor(rand() * 5)), p.cut, w, h, d, {
        x: x + w / 2,
        y: y + h / 2,
        // Back from the front edge, which is where books actually sit and what
        // puts the shelf board's own edge in front of them.
        z: -0.02,
        roll: lean,
      }),
    );
    x += w + 0.002;
  }
  return out;
}

function shelf(p: Palette, m: Materials, _press: Press, _models: ModelKit): Group {
  const { width, depth, bay, board, side } = CASE;
  const bays = 3;
  const height = bays * bay + board;
  const g = new Group();

  // Two solid sides, running the full height and standing proud of the boards.
  for (const end of [-1, 1] as const) {
    g.add(
      card(m, p.kraft, p.cut, side, height, depth, {
        x: (end * (width - side)) / 2,
        y: -height / 2,
      }),
    );
  }

  // The back. Thin, and set behind the boards so each opening reads as a box
  // with a floor and a wall rather than as a gap you can see the room through.
  g.add(
    card(m, stock(p.kraft, 2), p.cut, width - side * 2, height, 0.01, {
      y: -height / 2,
      z: -depth / 2 + 0.006,
    }),
  );

  // The boards, including the top one the origin sits on.
  for (let i = 0; i <= bays; i++) {
    g.add(
      card(m, p.kraft, p.cut, width, board, depth, {
        y: -i * bay - board / 2,
      }),
    );
  }

  /* The books. The top TWO bays are filled, and the rest is left empty on
   * purpose: layout.ts stands this thing so that only its upper part clears
   * the desk, and filling shelves nobody can see is triangles spent on nothing.
   */
  const inner = width - side * 2 - 0.03;
  for (let i = 0; i < 2; i++) {
    g.add(...spines(p, m, -inner / 2, inner, -(i + 1) * bay + board / 2, 0x51f3 + i * 977));
  }

  /* THE TOP IS LEFT BARE, deliberately.
   *
   * It used to carry a leaning row and a flat stack — the two things that said
   * the shelf belonged to somebody. They were good and they lost to a better
   * claimant: RECOMMENDATIONS now stands up there, and a section object has to
   * be the only thing on the surface it stands on or it reads as part of the
   * clutter rather than as a thing you can click. The bookcase is still a
   * bookcase; what makes it one is the spines inside the bays, not the props.
   */
  return g;
}

/* --- The plant on the window sill ------------------------------------------
 * The one object on this desk that is not a section and does not open
 * anything. It is a tally you can look at: every visitor who likes the page
 * adds one to a number, and past certain totals the plant puts out new parts.
 *
 * GROWTH IS STAGES, NOT SCALE, and that is the whole design. Scaling one mesh
 * up is a zoom: the silhouette is identical, every proportion is identical,
 * and the eye reads "the camera moved" rather than "the thing grew". So each
 * threshold adds REAL PARTS — a side shoot, a second stem, another length of
 * stem, a flower — and what changes between stage 0 and stage 4 is the shape,
 * not the size.
 *
 * Which is also why the tiers are separate groups rather than one rebuilt
 * mesh. A tier's origin is the JOINT it grows out of, so easing its scale from
 * nothing to one unfurls it out of the stem it belongs to, and nothing that
 * was already there moves. It also gives each tier its own baked ink for free:
 * a group that moves under its own steam is flagged `ownOutline` and outlined
 * in its own space (outline.ts), so a scaling tier takes its line with it.
 *
 * THE BOOKCASE'S LESSON APPLIES. A plant has to be nameable in one flat colour
 * at the resting camera, which rules out relying on green — there is no green
 * in the palette and the mono themes collapse every stock tone to one sheet.
 * What survives that is the SILHOUETTE: a tapered pot with a rim, a straight
 * stem, and leaves cut as pointed almonds fanned around it. The ink outline
 * does the rest.
 */

/**
 * How many likes each stage costs. The plant is at stage `i` once the total has
 * reached `PLANT_THRESHOLDS[i]`, so stage 0 is free and a visitor always sees a
 * plant rather than an empty pot.
 *
 * THIS IS THE DEFAULT, NOT THE TRUTH. The live ladder is four tuner knobs —
 * `plant.t1` to `plant.t4` — saved into tuned.json, because a threshold is a
 * design decision: it says how much attention a shape is worth, it wants to be
 * argued with in a diff, and it should not be editable by anyone who can reach
 * a database. The COUNT is the opposite and lives in Supabase. See params.ts.
 *
 * RETUNED FOR A PORTFOLIO. It used to be 0/10/25/50/100, which was a ladder
 * built for traffic this site will never see: the first forty visitors would
 * have clicked a button and watched nothing happen, which teaches them the
 * button is broken. At 1/4/10/25 the FIRST click by the FIRST visitor moves
 * the plant, and the top of the ladder is somewhere a good week could reach.
 */
export const PLANT_THRESHOLDS: readonly number[] = [0, 1, 4, 10, 25];

/** The stage a total buys, 0..4. Clamped at both ends. */
export function plantStage(count: number, ladder: readonly number[] = PLANT_THRESHOLDS): number {
  let stage = 0;
  for (let i = 0; i < ladder.length; i++) {
    if (count >= ladder[i]!) stage = i;
  }
  return stage;
}

/** Likes still to go before the next stage; null once it is fully grown. */
export function plantToGo(
  count: number,
  ladder: readonly number[] = PLANT_THRESHOLDS,
): number | null {
  const next = ladder[plantStage(count, ladder) + 1];
  return next === undefined ? null : Math.max(0, next - count);
}

/**
 * A 380mm plant in a 90mm pot before a single like, reaching 460mm at stage 4.
 *
 * Sized against the RESTING SHOT rather than against a garden centre. The
 * first pass was a botanically sensible 260mm and came out 44 pixels tall on a
 * 200mm ledge two and a half metres from the camera — legible if you went
 * looking for it, invisible if you did not, and an object nobody notices
 * cannot be a thing anybody clicks. A plant on a sill is allowed to be a big
 * plant; the ledge is 2.19m wide and this still only uses a fifteenth of it.
 */
const POT = { top: 0.075, bottom: 0.054, height: 0.087 };
/** Where the main stem's joints are, in metres above the soil. */
const JOINT = [0, 0.083, 0.173, 0.263, 0.343] as const;
/** The soil surface: where everything that grows starts from. */
const SOIL = POT.height - 0.003;

/**
 * How tall the plant stands at each stage, in metres above its own origin.
 *
 * Derived from the joints rather than measured off a screenshot, so it cannot
 * drift when the joints move. The DOM tag hangs from this, which is why the
 * label does not float a foot above the leaves.
 *
 * The first three are equal now, because stages 1 and 2 grow SIDEWAYS — see
 * the tiers below. A plant that only ever got taller would be a bar chart.
 */
export const PLANT_TOP: readonly number[] = [
  SOIL + JOINT[3] + 0.03,
  SOIL + JOINT[3] + 0.03,
  SOIL + JOINT[3] + 0.03,
  SOIL + JOINT[4] + 0.03,
  SOIL + JOINT[4] + 0.06,
];

/**
 * A folded vessel — the pot, its rim and the soil inside it.
 *
 * `tube` with two radii, which is the shape a pot is and the shape a cone of
 * card rolled and taped is. Six sides and flat normals, for the same reason
 * the lampshade has them: a faceted cone is a thing somebody scored and bent.
 */
function vessel(
  m: Materials,
  colour: Color,
  cut: Color,
  top: number,
  bottom: number,
  height: number,
  t: Transform = {},
): Mesh {
  const geometry = facet(new CylinderGeometry(top, bottom, height, 6));
  paint(geometry, colour, edgeOf(colour, cut), 1, true);
  return place(new Mesh(geometry, m.card), t);
}

/**
 * A leaf, cut flat out of card.
 *
 * Two quadratic curves from the stalk to the tip and back, extruded 3mm. A
 * rectangle would have been one line of code and it would have read as a
 * rectangle — the pointed almond is the entire reason a shape on a stick is a
 * leaf and not a flag. Five segments a curve: past that the extra vertices go
 * into an outline nobody can resolve at this size.
 *
 * Built pointing along +Y in its own space, so `roll` leans it away from the
 * stem and `yaw` fans it around one.
 */
function leaf(
  m: Materials,
  colour: Color,
  cut: Color,
  length: number,
  width: number,
  t: Transform = {},
): Mesh {
  const shape = new Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(width, length * 0.38, 0, length);
  shape.quadraticCurveTo(-width, length * 0.38, 0, 0);
  const geometry = new ExtrudeGeometry(shape, {
    depth: 0.004,
    bevelEnabled: false,
    curveSegments: 5,
    steps: 1,
  });
  // Centred on its own thickness, so a leaf turns about its face and not about
  // one of its skins.
  geometry.translate(0, 0, -0.002);
  paint(geometry, colour, edgeOf(colour, cut), 2);
  return place(new Mesh(geometry, m.card), t);
}

/**
 * A length of stem standing up from `base` metres above the group's origin.
 *
 * `base` exists because stage 0 is now three stacked segments in ONE group
 * rather than three tiers arriving one at a time — see below.
 */
function stem(m: Materials, colour: Color, cut: Color, height: number, base = 0): Mesh {
  return card(m, colour, cut, 0.012, height, 0.0075, { y: base + height / 2 });
}

/**
 * The plant, and the five tiers it grows in.
 *
 * Every tier is built, always: five small groups is a few hundred triangles
 * and the alternative — building geometry on the click — is a hitch at exactly
 * the moment a visitor is watching. The rig attaches as many as the count has
 * paid for (see plant.ts).
 *
 * The origin is the BOTTOM OF THE POT, so the whole thing can be dropped on
 * the sill's published centre with no offset to work out.
 */
export function plant(p: Palette, m: Materials): { group: Group; tiers: Group[] } {
  const g = new Group();
  /* IT CARRIES ITS OWN INK.
   *
   * Sixth thing in this model to need this, and the first that changes SHAPE:
   * the lamp head, the blind, its bottom rail, the notes, and now a plant that
   * gains a tier mid-session and is nudged around the sill by the tuner. The
   * line is baked in this group's own space, so it travels with every move —
   * and each tier below re-declares it, so a tier easing out of its joint
   * takes its own outline with it instead of leaving a plant-shaped stain. */
  g.userData.ownOutline = true;

  const clay = stock(p.kraft, 0);
  const rim = stock(p.kraft, 1);
  const earth = stock(p.kraft, 4);
  const frond = stock(p.paper, 2);
  const shoot = stock(p.paper, 4);

  g.add(vessel(m, clay, p.cut, POT.top, POT.bottom, POT.height, { y: POT.height / 2 }));
  // The rim. A pot without one is a beaker, and the band is what makes the
  // taper read as a taper at forty pixels tall.
  g.add(vessel(m, rim, p.cut, POT.top + 0.009, POT.top + 0.009, 0.018, { y: POT.height - 0.006 }));
  g.add(vessel(m, earth, p.cut, POT.top - 0.011, POT.top - 0.011, 0.012, { y: POT.height - 0.009 }));

  /** A tier, parked at the joint it grows out of. */
  const tier = (y: number, x = 0): Group => {
    const t = new Group();
    t.position.set(x, y, 0);
    // Its own ink, for the same reason the whole plant has its own: a tier
    // scales out of its joint when it arrives, and a line baked into the
    // plant's space would stay the size the tier was going to be.
    t.userData.ownOutline = true;
    return t;
  };

  /* Stage 0 — A PLANT, NOT A SEEDLING, and this is the change that matters
   * most about the ladder.
   *
   * The first version opened on two cotyledons on a 83mm stalk, which was
   * botanically correct and read, at forty pixels on a sill two and a half
   * metres away, as a twig in a pot. Everything after it was the plant being
   * rescued from looking dead rather than being rewarded. So the whole main
   * stem and its three sets of leaves — what used to be stages 0, 1 and 2 —
   * arrive free, in one group, and the four stages above are all ADDITIONS to
   * something that already looked alive. A visitor who never clicks still gets
   * a plant; a visitor who does gets a bigger one.
   *
   * One group rather than three because they never come apart again. The
   * joints are still the joints, so nothing below moved. */
  const t0 = tier(SOIL);
  t0.add(stem(m, shoot, p.cut, JOINT[1]));
  t0.add(stem(m, shoot, p.cut, JOINT[2] - JOINT[1], JOINT[1]));
  t0.add(stem(m, shoot, p.cut, JOINT[3] - JOINT[2], JOINT[2]));
  t0.add(leaf(m, frond, p.cut, 0.083, 0.029, { y: 0.045, yaw: 10, roll: 62 }));
  t0.add(leaf(m, frond, p.cut, 0.075, 0.026, { y: 0.054, yaw: -12, roll: -58 }));
  t0.add(leaf(m, frond, p.cut, 0.093, 0.032, { y: 0.104, yaw: 96, roll: 54 }));
  t0.add(leaf(m, frond, p.cut, 0.087, 0.03, { y: 0.134, yaw: -84, roll: -50 }));
  /* The crown. Three leaves rather than two: an odd number reads as growth
   * continuing, an even one as a thing that has finished. */
  t0.add(leaf(m, frond, p.cut, 0.099, 0.033, { y: 0.191, yaw: 40, roll: 48 }));
  t0.add(leaf(m, frond, p.cut, 0.09, 0.032, { y: 0.218, yaw: -140, roll: -44 }));
  t0.add(leaf(m, frond, p.cut, 0.081, 0.029, { y: 0.242, yaw: 160, roll: 38 }));

  /* Stage 1 — a LOW SIDE SHOOT, out of the soil on the other side and leaning
   * away. It adds no height at all, which is the point: the first reward has
   * to be visible at a glance, and a silhouette that gets WIDER at the base is
   * the cheapest legible change there is. Nothing above it moves. */
  const t1 = tier(SOIL, 0.026);
  t1.rotation.z = -17 * DEG;
  t1.add(stem(m, shoot, p.cut, 0.084));
  t1.add(leaf(m, frond, p.cut, 0.066, 0.024, { y: 0.036, yaw: -30, roll: -56 }));
  t1.add(leaf(m, frond, p.cut, 0.058, 0.021, { y: 0.069, yaw: 120, roll: 44 }));

  /* Stage 2 — a full SECOND SHOOT out of the soil, taller than the first and
   * leaning the other way. This is the stage that changes the silhouette most:
   * one stem is a stem, two stems is a plant that has been alive for a while. */
  const t2 = tier(SOIL, -0.03);
  t2.rotation.z = 19 * DEG;
  t2.add(stem(m, shoot, p.cut, 0.15));
  t2.add(leaf(m, frond, p.cut, 0.075, 0.027, { y: 0.063, yaw: 20, roll: 58 }));
  t2.add(leaf(m, frond, p.cut, 0.069, 0.024, { y: 0.093, yaw: -150, roll: -52 }));
  t2.add(leaf(m, frond, p.cut, 0.063, 0.023, { y: 0.129, yaw: 80, roll: 30 }));

  /* Stage 3 — the main stem puts on another 80mm and a pair of leaves. The
   * first stage that makes the plant TALLER, which is why it is this far up:
   * height is the change the eye reads last and remembers longest, and it is
   * also the change that moves the label (see PLANT_TOP). */
  const t3 = tier(SOIL + JOINT[3]);
  t3.add(stem(m, shoot, p.cut, JOINT[4] - JOINT[3]));
  t3.add(leaf(m, frond, p.cut, 0.078, 0.027, { y: 0.024, yaw: 65, roll: 46 }));
  t3.add(leaf(m, frond, p.cut, 0.07, 0.025, { y: 0.054, yaw: -115, roll: -40 }));

  /* Stage 4 — it flowers. Five petals and a centre, on the new top joint. */
  const t4 = tier(SOIL + JOINT[4]);
  /* PETALS AT 50°, NOT FLAT. A rosette lying flat on top of the stem is a disc,
   * and the resting camera looks at this wall from slightly above and a long
   * way back — a disc seen at that angle is a line. Standing them half-open
   * turns the flower into a five-pointed star in silhouette, which survives
   * being forty pixels tall in one colour. */
  for (let i = 0; i < 5; i++) {
    t4.add(leaf(m, rim, p.cut, 0.045, 0.026, { y: 0.008, yaw: i * 72 + 18, roll: 50 }));
  }
  t4.add(vessel(m, earth, p.cut, 0.0135, 0.0135, 0.009, { y: 0.012 }));

  return { group: g, tiers: [t0, t1, t2, t3, t4] };
}

/* --- The notes -------------------------------------------------------------
 * The paper label standing on each object, in place of the HTML chip that used
 * to float over it. See print.ts/paintNote for what is written on it and why
 * the words still live in the DOM.
 *
 * A note is a square of card pitched back a few degrees with a tab folded out
 * behind it. The tab is not decoration: a card standing bolt upright in mid-air
 * with nothing holding it is the one thing in this model that could not be made
 * out of paper, and a folded foot is exactly how a paper model stands a sign
 * up. It costs one box.
 *
 * The map goes on the +Y face — the same face `printedSheet` prints and the
 * same reason (BoxGeometry lays u along +X and v = 1 at -Z there) — and then
 * the whole thing is pitched up. Rotating -90° about X carries +Y to +Z and -Z
 * to up, so the writing arrives facing the room and the right way up, with no
 * second UV convention to keep in anyone's head.
 */
/**
 * How big a note is built, in metres — and the divisor the live `note.size`
 * knob scales against (params.ts).
 *
 * Was 200mm, which made the name-note bigger than the A5 notebook it stands in
 * front of: the label ate the object it was labelling, which is the one thing a
 * label cannot do. 120mm still reads at the resting camera because paintNote
 * fits the type to the sheet rather than setting it at a fixed size, so a
 * smaller note prints smaller paper with the same relative letterforms.
 */
export const NOTE_SIZE = 0.12;

export function buildNote(
  p: Palette,
  m: Materials,
  map: Texture,
  lean: number,
  base: Color = p.paper,
): Group {
  const g = new Group();
  /* IT CARRIES ITS OWN INK.
   *
   * The note turns to face the camera every frame, which means it is a moving
   * part inside a parent — and outline.ts bakes a parent's whole subtree into
   * one line object in the PARENT's space. Without this flag the border stays
   * pointing where the note used to point, and you get a paper square with a
   * black rectangle floating beside it at the wrong angle.
   *
   * Fourth thing in this model to need it: the lamp head, the blind, the
   * blind's bottom rail, now this. The rule is simply "if it moves under its
   * own steam, it says so here", and it belongs next to the thing that moves
   * rather than in the file that draws the lines. */
  g.userData.ownOutline = true;
  const paper = stock(base, 1);

  const sheet = printedSheet(paper, p.cut, map, NOTE_SIZE, 0.005, NOTE_SIZE, {
    pitch: -90 + lean,
    // Half a note above its own origin, so the origin is the bottom edge and
    // the anchor it is placed at reads as "where the note stands".
    y: (NOTE_SIZE / 2) * Math.cos(lean * DEG),
    z: (NOTE_SIZE / 2) * Math.sin(lean * DEG),
  });
  /* Named, because the hit area is measured off THIS and not off the group:
   * the folded foot behind it adds ~25mm of depth that would drag the button's
   * box back into the object. The printed paper is what a visitor aims at. See
   * anchors.ts. */
  sheet.name = "note-sheet";
  g.add(sheet);

  // The foot: a strip of the same card folded back under the note.
  g.add(
    card(m, paper, p.cut, NOTE_SIZE * 0.42, 0.004, 0.05, {
      pitch: -34,
      y: 0.012,
      z: -0.022,
    }),
  );
  return g;
}

/* --- The chess set ---------------------------------------------------------
 * Twenty-three carved men in the final position of the Immortal Game, standing
 * on the printed board. The position is the one thing art-direction.md is most
 * explicit about, and reading it off a diagram was always the compromise.
 *
 * NO INK ON THE MEN, and this is the whole reason they are here at all. Every
 * other object in the model is outlined, because on one white paper the drawn
 * line is what separates one object from the next. A chess piece is the case
 * where that rule inverts: it is 40mm of turned, faceted geometry about thirty
 * pixels tall on screen, so an edge at every facet is not a contour, it is a
 * fill — the piece arrives as a solid black lozenge. Left unlined they read as
 * what they are, small pale carvings, and the thing that separates them from
 * the board is the board: printed dark squares and a real cast shadow.
 *
 * The dark side gets its own material rather than its own model. `take` clones
 * share a material, so recolouring one piece would recolour all of them.
 */
function chessmen(p: Palette, models: ModelKit, square: number, top: number): Group {
  const set = new Group();
  const OF: Record<string, string> = {
    p: "chess-pawn",
    r: "chess-rook",
    n: "chess-knight",
    b: "chess-bishop",
    k: "chess-king",
    // No queen in the set, so she takes the king's shape. At this size the
    // silhouette difference is under a pixel.
    q: "chess-king",
  };

  let dark: MeshLambertMaterial | null = null;
  let rank = 0;
  let file = 0;
  for (const ch of IMMORTAL) {
    if (ch === "/") {
      rank += 1;
      file = 0;
      continue;
    }
    const skip = Number(ch);
    if (!Number.isNaN(skip)) {
      file += skip;
      continue;
    }

    const black = ch === ch.toLowerCase();
    const piece = models.take(OF[ch.toLowerCase()] ?? "chess-pawn");
    file += 1;
    if (!piece) continue;

    piece.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      mesh.userData.noOutline = true;
      if (!black) return;
      const base = mesh.material as MeshLambertMaterial;
      // One dark material for the whole side, cloned off whatever the loader
      // built so it keeps the fibre map and the lighting model.
      dark ??= Object.assign(base.clone(), { color: blend(p.paper, p.line, 0.74) });
      mesh.material = dark;
    });

    /* Files run left to right and rank 0 is the FAR rank, matching the order
     * the FEN is drawn onto the board in print.ts. Getting this backwards
     * mirrors the position, which is the kind of error a chess player spots
     * instantly and nobody else ever does. */
    set.add(
      place(piece, {
        x: (file - 1 - 3.5) * square,
        y: top,
        z: (rank - 3.5) * square,
        // A hand set these down, so no two face quite the same way.
        yaw: ((file * 37 + rank * 61) % 24) - 12,
      }),
    );
  }
  return set;
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
  // Grown from 200mm to 280mm, because 23 men on a 200mm board is a 25mm
  // square and a piece narrower than the line drawn round the board.
  const BOARD = 0.28;
  const board = new Group();
  board.position.set(0.06, 0, 0.32);
  board.rotation.y = -6 * DEG;
  board.add(
    press.chess
      ? printedSheet(press.stock, p.cut, press.chess, BOARD, 0.016, BOARD, { y: 0.008 })
      : card(m, p.paperAged, p.cut, BOARD, 0.016, BOARD, { y: 0.008 }),
    chessmen(p, models, BOARD / 8, 0.016),
  );
  g.add(board);
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
