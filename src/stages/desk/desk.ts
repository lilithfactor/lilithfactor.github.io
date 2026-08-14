/* ============================================================================
 * THE MODEL — the base sheet, the backdrop, and the paper lamp.
 *
 * This was a photographed room: a walnut top, a plaster wall, a 2048² shadow
 * map and a PMREM environment bake standing in for an HDRI. It is now a
 * cut-paper diorama, and the parts that went are worth naming because most of
 * them were expensive:
 *
 *   - The PMREM environment. Its entire job was ambient *specular*, and card
 *     has none. Deleted, along with the six-box room it was baked from.
 *   - The shadow map. See texture.ts: soft short contact shadows are both more
 *     correct for a paper model and free.
 *   - The walnut and its wax roughness map. There is no wood here any more.
 *   - ACES filmic tone mapping, which existed to keep a blown highlight from
 *     going chalky. Nothing in a flat matte model gets near clipping, and a
 *     film curve on flat card just desaturates the card. See scene.ts.
 *
 * What is left is two sheets of board and a lamp, which is the correct amount
 * of room for a model of a desk.
 * ========================================================================== */

import {
  BoxGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  PlaneGeometry,
  SpotLight,
  Vector3,
  type BufferGeometry,
} from "three";
import { bow, deckle, edgeOf, facet, paint } from "./cut";
import type { Materials } from "./materials";
import { blend, stock, type Palette } from "./palette";

const DEG = Math.PI / 180;

/** The base sheet, in metres. */
export const DESK_SIZE = [2.7, 1.5] as const;

/** Where the lamp stands. */
export const LAMP = new Vector3(1.16, 0, -0.5);
/** The arm's joint, in the lamp's own space. Everything above this pivots. */
export const JOINT = new Vector3(0.012, 0.355, 0);
/** The bulb, in the HEAD's space — so it follows the head when the head turns. */
export const BULB = new Vector3(-0.127, 0.115, -0.04);
/**
 * What the lamp is aimed at, also in the head's space.
 *
 * A point rather than a direction, and in head space rather than world space,
 * because that is what makes the light follow the shade for free: rotate the
 * head and this rotates with it, so the beam goes where the shade is pointing
 * without a single line of code that knows the two are related.
 */
export const AIM = new Vector3(-0.892, -0.355, 0.6);

export interface Lighting {
  readonly key: SpotLight;
  readonly fill: DirectionalLight;
  readonly ambient: HemisphereLight;
}

/** The movable parts of the lamp. See lamp.ts for what moves them. */
export interface LampParts {
  /** The whole lamp, standing on the desk. */
  readonly group: Group;
  /** Upper arm, shade and bulb. Pivots about the joint; this is the "angle". */
  readonly head: Group;
  /** The warm pool painted on the desk. World space, so it stays on the desk. */
  readonly pool: Mesh;
  /** The lit inside of the shade. Goes dark with the lamp. */
  readonly glow: Mesh;
}

/** A painted box. `thin` names the axis its two large faces look along. */
function sheet(
  w: number,
  h: number,
  d: number,
  face: Color,
  cut: Color,
  thin: 0 | 1 | 2 = 1,
): BufferGeometry {
  const geometry = new BoxGeometry(w, h, d);
  paint(geometry, face, edgeOf(face, cut), thin);
  return geometry;
}

/** A rolled tube of card: the curved side is paper, the two ends are cuts. */
function roll(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  segments: number,
  face: Color,
  cut: Color,
  open = false,
): BufferGeometry {
  const geometry = facet(new CylinderGeometry(radiusTop, radiusBottom, height, segments, 1, open));
  paint(geometry, face, edgeOf(face, cut), 1, true);
  return geometry;
}

/** The base sheet, the backdrop it stands against, and the lamp. */
export function buildRoom(p: Palette, m: Materials): { room: Group; lamp: LampParts } {
  const room = new Group();
  room.name = "room";

  /* The base sheet, INSET by 4cm on every side from the board beneath it.
   *
   * That inset is the single most paper-craft thing in the model. A real
   * cut-paper build is stacked: a heavier board underneath, a lighter sheet
   * laid on top, and a margin where you can see both. Making them the same size
   * — which is what this was — hides the join and leaves one slab with a line
   * round it. Making them different sizes turns the desk into two pieces of
   * card that someone put one on top of the other.
   *
   * TORN, not cut, along the two edges the camera can see. This is the single
   * highest-value detail in the whole repaint and it is worth saying why: every
   * other edge in the model is a straight line, because a straight line is what
   * a blade and a steel rule produce, and a model made entirely of them still
   * reads as something a machine laid out. One torn edge is the proof of a
   * hand. It goes on the mat because the mat is the largest object in frame and
   * its front edge runs right across the bottom of the shot — the one place a
   * 4mm irregularity is a full centimetre of screen.
   *
   * And it is bowed, because a 2.6-metre sheet of card that is mathematically
   * planar is the loudest "computed" signal available. See cut.ts. */
  const mat = new PlaneGeometry(DESK_SIZE[0] - 0.08, DESK_SIZE[1] - 0.08, 34, 20);
  deckle(mat, 0.014, { bottom: true, right: true }, 7);
  bow(mat, 0.0055, 2);
  const top = new Mesh(mat, m.card);
  paint(top.geometry, p.desk, p.desk, 2);
  top.rotation.x = -90 * DEG;
  room.add(top);

  // The board under it, showing its cut edge all the way round. 55mm of
  // thickness is far more than any real card, and that is the point: a model is
  // built up from stacked greyboard, and a model-maker working in 2mm stock
  // does not apologise for the scale of the edge.
  const slab = new Mesh(sheet(DESK_SIZE[0], 0.055, DESK_SIZE[1], p.deskDeep, p.cut), m.card);
  // 1mm below the top sheet, not level with it: the base sheet's own upper face
  // has to stay at y = 0, because every placement in layout.ts assumes it.
  slab.position.y = -0.0285;
  room.add(slab);

  // The backdrop. One sheet standing behind the whole model, deep enough to be
  // the darkest thing in frame so the base sheet reads as a lit surface in
  // front of it rather than as more of the same. Bowed too, and here the bow is
  // doing something specific: it is the largest unbroken area on screen, and a
  // flat one gave the whole shot a single dead-uniform field behind the model.
  const wall = new PlaneGeometry(8, 5, 12, 8);
  bow(wall, 0.05, 2);
  const backdrop = new Mesh(wall, m.card);
  paint(backdrop.geometry, p.backdrop, p.backdrop, 2);
  backdrop.position.set(0, 1.3, -1.25);
  room.add(backdrop);

  const lamp = buildLamp(p, m);
  room.add(lamp.group, lamp.pool);

  // A paper coaster where a cup sat, because the desk should look used and this
  // costs one disc. Aged card, one shade off the base sheet.
  const coaster = new Mesh(new CircleGeometry(0.045, 20), m.card);
  paint(coaster.geometry, stock(p.paperAged, 3), p.paperAged, 2);
  coaster.rotation.x = -90 * DEG;
  coaster.position.set(-0.72, 0.0012, -0.28);
  room.add(coaster);

  return { room, lamp };
}

/* --- The lamp --------------------------------------------------------------
 * The brief calls this the emotional centre of the desk, and it is the one
 * object in the model that has to be *charming* rather than merely correct. So
 * it is built the way you would actually build one out of card: a disc for the
 * base, a strip folded twice for the arm, and a cone scored into eight facets
 * for the shade. Nothing on it is round — everything is folded, which is the
 * difference between a paper lamp and a lamp rendered in paper colours. */
function buildLamp(p: Palette, m: Materials): LampParts {
  const group = new Group();
  group.name = "lamp";
  group.position.copy(LAMP);

  const kraft = p.kraft;

  // Base: a squat disc of stacked board, twelve-sided so it reads as cut.
  const base = new Mesh(roll(0.1, 0.108, 0.026, 12, kraft, p.cut), m.card);
  base.position.y = 0.013;
  group.add(base);

  // Lower arm: a folded strip, not a curve. It does not move — the whole point
  // of an anglepoise is that the bottom half stays where you put the lamp.
  const lower = new Mesh(sheet(0.03, 0.34, 0.014, stock(kraft, 1), p.cut, 2), m.card);
  lower.position.set(0.01, 0.19, 0);
  lower.rotation.z = -7 * DEG;
  group.add(lower);

  /* THE HEAD. Everything above the joint, in its own group.
   *
   * This is the whole reason the lamp can be aimed: rotating one Object3D
   * carries the upper arm, the shade, the bulb, the beam's aim point and the
   * glow inside the shade together, in the right relative positions, with no
   * bookkeeping. Aiming a light by hand — moving a SpotLight's position and its
   * target separately and hoping they stay consistent with a shade that is
   * drawn somewhere else — is how a draggable lamp ends up shining out of its
   * own arm. A pivot group makes that state unrepresentable. */
  const head = new Group();
  head.name = "lamp-head";
  head.position.copy(JOINT);
  group.add(head);

  const upper = new Mesh(sheet(0.027, 0.21, 0.013, kraft, p.cut, 2), m.card);
  upper.position.set(-0.062, 0.065, -0.02);
  upper.rotation.set(12 * DEG, 0, 38 * DEG);
  head.add(upper);

  // Shade: a faceted cone, open at the bottom, seen from both sides so the lit
  // inside is visible from the camera's high angle.
  const shade = new Mesh(roll(0.05, 0.13, 0.125, 8, p.paperEdge, p.cut, true), m.card);
  shade.position.set(BULB.x, BULB.y + 0.05, BULB.z);
  shade.rotation.set(16 * DEG, 22 * DEG, -22 * DEG);
  head.add(shade);

  // The lit inside of the shade. A disc of glow tucked just under its mouth —
  // this is what makes the lamp look switched on from a viewing angle that can
  // see up into it, and it costs one triangle fan.
  const glow = new Mesh(new CircleGeometry(0.1, 16), m.glow);
  glow.position.copy(BULB);
  glow.rotation.x = -90 * DEG;
  glow.renderOrder = 1;
  head.add(glow);

  /* The pool on the base sheet. The painted half of the lamp's light: a
   * SpotLight alone gives flat card a falloff but nothing that reads as warmth,
   * and this is the airbrushed glow a model-maker would add.
   *
   * It is a child of the ROOM, not of the lamp, and that is deliberate now that
   * the lamp moves. The pool has to stay lying flat on the desk at y≈0 whatever
   * the head is doing; parented to a rotating head it would tip up off the
   * surface and become a wall of light. lamp.ts places it each time the head
   * moves, by intersecting the beam with the desk plane. */
  const pool = new Mesh(new PlaneGeometry(1.75, 1.75), m.glow);
  pool.rotation.x = -90 * DEG;
  pool.position.y = 0.0016;
  pool.renderOrder = 2;

  return { group, head, pool, glow };
}

export function buildLighting(p: Palette): Lighting {
  // The lamp. Still a SpotLight with a decay, because even flat card wants the
  // near half of the desk brighter than the far half — but far gentler than the
  // photoreal version, which crushed everything outside the cone to black. Here
  // the light shapes the model; the painted pool does the drama.
  const key = new SpotLight(blend(p.keyLight, p.paper, 0.25), 3.7);
  // Position and target are both written by lamp.ts from the head's transform,
  // every time the head moves. What is set here is only a starting pose so the
  // very first frame is lit even if the lamp rig has not run yet.
  key.position.set(LAMP.x + JOINT.x + BULB.x, JOINT.y + BULB.y, LAMP.z + JOINT.z + BULB.z);
  key.target.position.set(0.28, 0, 0.1);
  key.angle = 68 * DEG;
  key.penumbra = 0.85;
  // Well under inverse-square. A paper model is a small object on a table, lit
  // as much by the room as by the lamp, and a physical decay here would say the
  // opposite.
  key.decay = 0.9;
  key.distance = 0;
  // No castShadow anywhere in this scene. See texture.ts.

  // A soft cool wash from the left, for form: it is what keeps the vertical
  // faces of a folded box distinguishable from its top when the lamp is not on
  // them. Deliberately weak — the model must not read as lit from two sides.
  const fill = new DirectionalLight(blend(p.fillLight, p.paper, 0.45), 0.95);
  fill.position.set(-2.4, 2.1, 1.2);

  // Sky/ground rather than a flat ambient: cool daylight from above, warm
  // bounce off the kraft base sheet from below. One light, and it gives every
  // upward face and every downward face a different temperature — which on
  // matte card is most of what stops it looking like flat colour.
  // The sky is pulled most of the way to paper white rather than left at the
  // raw 7000K token. Straight --stage-fill-light overhead turned every upward
  // face — which on a desk seen from above is nearly every face there is — a
  // cold grey, and cold grey card is the one thing this direction cannot have.
  const ambient = new HemisphereLight(blend(p.fillLight, p.paper, 0.76), p.ambient, 2.7);

  return { key, fill, ambient };
}
