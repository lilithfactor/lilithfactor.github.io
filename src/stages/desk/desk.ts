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
  Box3,
  BoxGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  PlaneGeometry,
  MeshBasicMaterial,
  SpotLight,
  Vector3,
  type BufferGeometry,
  type Object3D,
} from "three";
import { bow, deckle, edgeOf, facet, paint } from "./cut";
import type { Materials } from "./materials";
import { blend, stock, type Palette } from "./palette";
import type { ModelKit } from "./models";

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
  /**
   * Where the bulb sits and what it points at, both in the HEAD's space so
   * they turn with it.
   *
   * Carried on the parts rather than imported as constants, because the
   * constants describe the procedural lamp and a downloaded one puts its shade
   * somewhere else entirely — which showed up as the warm pool landing beside
   * the lamp instead of under it.
   */
  readonly bulb: Vector3;
  readonly aim: Vector3;
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
export function buildRoom(p: Palette, m: Materials, models: ModelKit): { room: Group; lamp: LampParts } {
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

  room.add(buildWindow(p, m));

  const lamp = buildLamp(p, m, models);
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

/* --- The window ------------------------------------------------------------
 * A hole cut in the backdrop with a city behind it, in layers, like every
 * paper-craft diorama ever made.
 *
 * "Live" here means the visitor's own clock, not a network call. That is a
 * deliberate limit rather than a shortcut:
 *
 *   - architecture.md Directive 1 says content comes through the proxy at build
 *     time. A weather API would be the first runtime fetch this site has ever
 *     made, and it would need a key, a failure state and a privacy answer about
 *     asking for someone's location.
 *   - The clock is free, offline, instant, and already correct for whoever is
 *     looking. A desk that is dark at midnight and bright at noon is the part
 *     of "outside" that actually lands.
 *
 * Weather is the obvious next step and it is genuinely nice — rain on the glass
 * changing the soundscape is in vision.md. It should be a decision made on
 * purpose, with a key and a fallback, not smuggled in behind a window.
 *
 * The view is cut from the same paper as everything else, so what separates the
 * skyline from the sky is the ink line and one step of tone — which is exactly
 * how a paper diorama does distance.
 *
 * Z MATTERS HERE. Every layer of the view sits BEHIND the frame in the group's
 * own space, so the group has to stand far enough in front of the backdrop
 * (z = -1.25) that the furthest layer still clears it. It did not, first time:
 * the sky landed at -1.265, behind the wall, and the window was a frame around
 * a blank piece of backdrop. */
/* Placed against what the camera can actually see, not against the wall's
 * middle: the resting shot crops the backdrop at about y = 1.0, and the desk
 * itself fills everything below y ≈ 0.45. That leaves one band — above the
 * corkboard, between the bookcase and the lamp — and the window is sized to
 * sit in it rather than to be a nice size in the abstract. */
const WINDOW = new Vector3(0.6, 0.5, -1.19);

function buildWindow(p: Palette, m: Materials): Group {
  const g = new Group();
  g.name = "window";
  g.position.copy(WINDOW);

  const W = 0.86;
  const H = 0.48;
  const bar = 0.035;

  /* Time of day, from the machine looking at it. Three states rather than a
   * gradient: paper does not do subtle gradations of daylight, and a sheet that
   * is *one step* lighter than the wall reads as "bright outside" far better
   * than a smooth ramp that just looks like a slightly different white. */
  // `?hour=22` forces a time, which is the only sane way to look at the night
  // view at eleven in the morning. Falls back to the visitor's own clock.
  const forced = Number(new URLSearchParams(location.search).get("hour"));
  const hour = Number.isFinite(forced) && forced >= 0 && forced <= 23 ? forced : new Date().getHours();
  const night = hour < 6 || hour >= 20;
  const dusk = !night && (hour < 8 || hour >= 18);

  // Sky: lighter than the wall by day, darker at night. Still the same stock —
  // this is a tone step, not a colour.
  // Toward p.line, NOT p.ink: --stage-ink is the paper now (the whole scene is
  // one stock), so blending toward it does nothing at all. Exactly the mistake
  // that printed the outcome numbers white on white. Black lives in --stage-line.
  const sky = night
    ? blend(p.backdrop, p.line, 0.62)
    : blend(p.backdrop, p.line, dusk ? 0.12 : 0.02);
  /* The sky is UNLIT, and that is not a shortcut.
   *
   * As lit card it came out white at midnight: the hemisphere alone runs at
   * 2.7, so any tone this side of black is multiplied back up to paper. Sky is
   * not a surface in the room catching the room's light — it is distance, and
   * distance has no normal to shade. An unlit material gives exactly the tone
   * asked for, which is also how a paper diorama does a sky: you choose the
   * card and that IS the colour. */
  const pane = new Mesh(
    new BoxGeometry(W, H, 0.006),
    new MeshBasicMaterial({ color: sky, toneMapped: false }),
  );
  pane.position.z = -0.03;
  // Sky is not a surface anything lands on; a shadow falling on it would be a
  // shadow cast onto the horizon.
  pane.receiveShadow = false;
  g.add(pane);

  /* The city, in two layers. The far one is closer to the sky's tone and the
   * near one closer to the wall's, which is the whole trick of paper distance:
   * every layer you step forward gets one step darker and one step sharper. */
  const skyline = (
    depth: number,
    tone: Color,
    heights: readonly number[],
    width: number,
  ): void => {
    let x = -W / 2 + width / 2;
    for (const h of heights) {
      const block = new Mesh(sheet(width, h, 0.006, tone, p.cut, 2), m.card);
      block.position.set(x, -H / 2 + h / 2, depth);
      block.receiveShadow = false;
      g.add(block);
      // A lit window or two, at night only, so the city is somewhere people are.
      if (night && h > 0.12) {
        const lit = new Mesh(sheet(width * 0.24, 0.026, 0.004, p.paper, p.paper, 2), m.card);
        lit.position.set(x - width * 0.16, -H / 2 + h - 0.06, depth + 0.005);
        g.add(lit);
      }
      x += width;
    }
  };

  const far = blend(sky, p.line, night ? 0.16 : 0.1);
  const near = blend(sky, p.line, night ? 0.3 : 0.2);
  skyline(-0.022, far, [0.16, 0.28, 0.2, 0.34, 0.22, 0.3, 0.18], W / 7);
  skyline(-0.012, near, [0.12, 0.22, 0.14, 0.18, 0.26, 0.15], W / 6);

  /* The frame. Four bars and two glazing bars, because a rectangle of sky with
   * no frame is a poster, and the muntins are what make it a window at a
   * glance. */
  const frame = (w: number, h: number, x: number, y: number, thick = 0.05) => {
    const piece = new Mesh(sheet(w, h, thick, p.kraft, p.cut), m.card);
    piece.position.set(x, y, 0);
    piece.castShadow = true;
    g.add(piece);
  };
  frame(W + bar * 2, bar, 0, H / 2 + bar / 2);
  frame(W + bar * 2, bar, 0, -H / 2 - bar / 2);
  frame(bar, H + bar * 2, -W / 2 - bar / 2, 0);
  frame(bar, H + bar * 2, W / 2 + bar / 2, 0);
  // The glazing bars, thinner, sitting proud of the frame.
  frame(0.016, H, 0, 0, 0.03);
  frame(W, 0.016, 0, 0, 0.03);

  // A sill, which is the one part that says the window is in a wall with a
  // thickness rather than printed on it.
  const sill = new Mesh(sheet(W + bar * 4, 0.03, 0.09, p.kraft, p.cut), m.card);
  sill.position.set(0, -H / 2 - bar - 0.015, 0.03);
  sill.castShadow = true;
  g.add(sill);

  return g;
}

/* --- The lamp --------------------------------------------------------------
 * The brief calls this the emotional centre of the desk, and it is the one
 * object in the model that has to be *charming* rather than merely correct. So
 * it is built the way you would actually build one out of card: a disc for the
 * base, a strip folded twice for the arm, and a cone scored into eight facets
 * for the shade. Nothing on it is round — everything is folded, which is the
 * difference between a paper lamp and a lamp rendered in paper colours. */
/** Total lamp height on the desk, in metres. */
const LAMP_HEIGHT = 0.34;
/**
 * Where the model splits into "stays put" and "pivots", as a fraction of its
 * height. Measured, not guessed: in the poly.pizza lamp the pole runs to 0.144
 * and the lowest head part starts at 0.074 of a span from -1.349 to 0.601 —
 * about 0.73 up. Anything from ~0.65 to ~0.78 lands in the same gap.
 */
const HEAD_SPLIT = 0.72;

/**
 * The lamp, built from public/models/lamp.glb when it is there.
 *
 * The rig is the constraint, not the look: lamp.ts turns ONE Object3D and
 * expects the shade, the bulb and the beam's aim point to travel with it. A
 * downloaded lamp arrives as a flat list of parts with no such group, so this
 * builds one — parts above the knuckle are re-parented into `head` and moved
 * into its space, everything below stays with the stand.
 *
 * Splitting by height works because a desk lamp is the one object whose parts
 * genuinely stack vertically, and because the gap between the top of the pole
 * and the bottom of the knuckle is wide enough that the exact number does not
 * matter.
 */
function buildLamp(p: Palette, m: Materials, models: ModelKit): LampParts {
  const group = new Group();
  group.name = "lamp";
  group.position.copy(LAMP);

  const kraft = p.kraft;
  const model = models.take("lamp");

  const head = new Group();
  head.name = "lamp-head";
  head.position.copy(JOINT);

  if (model) {
    // Normalise to the desk's scale, standing on y = 0.
    const box = new Box3().setFromObject(model);
    const size = box.getSize(new Vector3());
    const scale = LAMP_HEIGHT / (size.y || 1);
    model.scale.setScalar(scale);
    model.updateMatrixWorld(true);

    const seated = new Box3().setFromObject(model);
    const centre = seated.getCenter(new Vector3());
    model.position.set(-centre.x, -seated.min.y, -centre.z);
    model.updateMatrixWorld(true);

    // Turned to face the desk. The model is authored with its arm reaching
    // along +x; the lamp stands at the desk's right-hand end, so left is where
    // the work is.
    group.rotation.y = Math.PI;
    group.add(model);
    group.updateMatrixWorld(true);

    // Split by each part's own centre height. Collected first, because moving
    // a child while traversing its parent skips siblings.
    const parts: Mesh[] = [];
    model.traverse((o: Object3D) => {
      if ((o as Mesh).isMesh) parts.push(o as Mesh);
    });

    const pivotY = LAMP_HEIGHT * HEAD_SPLIT;
    const headParts: Mesh[] = [];
    const union = new Box3().makeEmpty();
    const partBox = new Box3();
    const partCentre = new Vector3();
    for (const part of parts) {
      partBox.setFromObject(part);
      partBox.getCenter(partCentre);
      // World y, which equals group-local y: the lamp group sits at y = 0.
      if (partCentre.y < pivotY) continue;
      headParts.push(part);
      union.union(partBox);
    }

    /* THE PIVOT GOES AT THE KNUCKLE, not on the lamp's centre line.
     *
     * It was `(0, pivotY, 0)`, and that looked perfectly fine at rest —
     * attach() preserves world position, so nothing moved until the lamp was
     * dragged. Then the head swung about a point in mid-air beside the joint
     * and the shade sailed off the end of the arm. The bug was invisible in
     * every static screenshot and obvious the first time a hand touched it.
     *
     * The joint is the bottom-centre of the parts that move, which is what the
     * union box gives us. */
    if (!union.isEmpty()) {
      const pivotWorld = new Vector3(
        (union.min.x + union.max.x) / 2,
        union.min.y,
        (union.min.z + union.max.z) / 2,
      );
      head.position.copy(group.worldToLocal(pivotWorld));
    } else {
      head.position.set(0, pivotY, 0);
    }
    group.add(head);
    group.updateMatrixWorld(true);

    for (const part of headParts) {
      // attach(), NOT add(). The parts hang two scaled parents deep — the
      // loader normalises the gltf scene, then this function scales it again —
      // and add() keeps only the local transform, so a re-parented shade
      // snapped back to its authored size and arrived four times too big.
      // attach() preserves the world transform, which is the whole point.
      head.attach(part);
    }
  } else {
    // Base: a squat disc of stacked board, twelve-sided so it reads as cut.
    const base = new Mesh(roll(0.1, 0.108, 0.026, 12, kraft, p.cut), m.card);
    base.position.y = 0.013;
    group.add(base);

    // Lower arm: a folded strip, not a curve. It does not move — the whole
    // point of an anglepoise is that the bottom half stays where you put it.
    const lower = new Mesh(sheet(0.03, 0.34, 0.014, stock(kraft, 1), p.cut, 2), m.card);
    lower.position.set(0.01, 0.19, 0);
    lower.rotation.z = -7 * DEG;
    group.add(lower);
  }

  /* THE HEAD is the whole reason the lamp can be aimed: rotating one Object3D
   * carries the shade, the bulb, the beam's aim point and the glow inside the
   * shade together, in the right relative positions, with no bookkeeping.
   * Aiming a light by hand — moving a SpotLight's position and its target
   * separately and hoping they stay consistent with a shade drawn somewhere
   * else — is how a draggable lamp ends up shining out of its own arm. A pivot
   * group makes that state unrepresentable, whichever lamp fills it. */
  if (!model) {
    group.add(head);

    const upper = new Mesh(sheet(0.027, 0.21, 0.013, kraft, p.cut, 2), m.card);
    upper.position.set(-0.062, 0.065, -0.02);
    upper.rotation.set(12 * DEG, 0, 38 * DEG);
    head.add(upper);

    // Shade: a faceted cone, open at the bottom, seen from both sides so the
    // lit inside is visible from the camera's high angle.
    const shade = new Mesh(roll(0.05, 0.13, 0.125, 8, p.paperEdge, p.cut, true), m.card);
    shade.position.set(BULB.x, BULB.y + 0.05, BULB.z);
    shade.rotation.set(16 * DEG, 22 * DEG, -22 * DEG);
    head.add(shade);
  }

  /* The lit inside of the shade, tucked just under its mouth. This is what
   * makes the lamp look switched on from an angle that can see up into it.
   *
   * Sized and placed off the head's actual extent rather than the procedural
   * BULB constant, because that constant described the folded cone and the
   * loaded shade is a different object at a different height. */
  const headBox = new Box3().setFromObject(head);
  const bulb = headBox.isEmpty() ? BULB.clone() : headBox.getCenter(new Vector3());
  const glowRadius = headBox.isEmpty()
    ? 0.1
    : Math.max(0.05, Math.min(headBox.max.x - headBox.min.x, 0.16) * 0.42);
  const glow = new Mesh(new CircleGeometry(glowRadius, 16), m.glow);
  glow.position.copy(model ? bulb : BULB);
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

  // For the model, the beam starts at the shade and goes straight down with a
  // slight lean, which lands the pool under the lamp on any lamp geometry. The
  // procedural lamp keeps its hand-tuned pair.
  const lampBulb = model ? bulb.clone() : BULB.clone();
  const lampAim = model ? bulb.clone().add(new Vector3(0.12, -1, 0.22)) : AIM.clone();

  return { group, head, pool, glow, bulb: lampBulb, aim: lampAim };
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

  /* The lamp casts, and only the lamp.
   *
   * This scene ran on painted contact ellipses alone, which ground an object
   * but cannot say that something is BETWEEN the lamp and the desk. With a real
   * articulated lamp that is the whole point of aiming it: the shade throws a
   * pool, and anything standing in the pool interrupts it.
   *
   * One shadow-casting light, at 1024², is the affordable version of that. The
   * fill and the hemisphere stay shadowless, which is also physically the right
   * story — they are the room, not a source.
   *
   * normalBias rather than a big constant bias: the model is made of thin flat
   * card lit at a grazing angle, which is the exact case where a constant bias
   * either leaves acne or lifts the shadow off its object ("peter-panning").
   * Offsetting along the normal fixes the sheets without detaching anything. */
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.05;
  key.shadow.camera.far = 6;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.018;
  // Softens the edge without a second pass. A paper model's shadows are short
  // and soft; a hard-edged one would read as a rendering.
  key.shadow.radius = 3;

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
