/* ============================================================================
 * THE ROOM — the walnut surface, the wall behind it, and the two lights.
 *
 * One warm key (the lamp, upper right), one cool fill (a window, off left), so
 * the paper carries a temperature gradient across the desk. That gradient is
 * doing most of the work: a single-source render of matte paper looks like a
 * screenshot of a 3D tutorial, and two sources at different temperatures looks
 * like a room.
 *
 * Both are DirectionalLights rather than spot/point lights. A spot is the
 * physically honest model of a desk lamp and also the one whose falloff has to
 * be re-tuned every time an object moves; a directional light's intensity means
 * the same thing everywhere on the desk, which is what makes the lighting
 * reviewable rather than fiddled with.
 * ========================================================================== */

import {
  AmbientLight,
  BoxGeometry,
  CylinderGeometry,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
} from "three";
import { blend, type Palette } from "./palette";
import type { Materials } from "./materials";

const DEG = Math.PI / 180;

export interface Lighting {
  readonly key: DirectionalLight;
  readonly fill: DirectionalLight;
  readonly ambient: AmbientLight;
}

/** The surface, the wall, and the lamp that motivates the key light. */
export function buildRoom(p: Palette, m: Materials): Group {
  const room = new Group();
  room.name = "room";

  // The desk top. Its upper face is y = 0, which every placement assumes.
  const top = new Mesh(new BoxGeometry(2.7, 0.08, 1.5), m.wood);
  top.position.y = -0.04;
  top.receiveShadow = true;
  room.add(top);

  // A wall far enough back to catch falloff and no further. It is what stops
  // the desk floating in black.
  const wall = new Mesh(new PlaneGeometry(7, 4.5), m.wall);
  wall.position.set(0, 1.1, -1.15);
  wall.receiveShadow = true;
  room.add(wall);

  // The lamp itself, upper right. It is not the light source — it is the
  // explanation for one, which is all a viewer needs.
  const shadeMaterial = new MeshStandardMaterial({
    color: blend(p.keyLight, p.paper, 0.35),
    roughness: 0.5,
    metalness: 0.1,
  });
  // x = 1.24 puts it clear of the turntable in `beyond`, whose base reaches
  // x = 1.05. Two objects intersecting is the one modelling error that reads
  // instantly as broken rather than as casual.
  const shade = new Mesh(new CylinderGeometry(0.055, 0.105, 0.11, 20, 1, true), shadeMaterial);
  shade.position.set(1.18, 0.5, -0.58);
  shade.rotation.set(20 * DEG, 0, -16 * DEG);
  room.add(shade);

  const stem = new Mesh(new CylinderGeometry(0.008, 0.008, 0.5, 10), m.brass);
  stem.position.set(1.24, 0.25, -0.6);
  stem.castShadow = true;
  room.add(stem);

  const base = new Mesh(new CylinderGeometry(0.075, 0.08, 0.016, 20), m.brass);
  base.position.set(1.24, 0.008, -0.6);
  base.castShadow = true;
  room.add(base);

  // The ring where a cup sat. The desk should look used; this costs 96
  // triangles and does more for that than any texture would.
  const ring = new Mesh(
    new CylinderGeometry(0.042, 0.042, 0.0006, 24, 1, true),
    new MeshStandardMaterial({ color: blend(p.desk, p.deskDeep, 0.55), roughness: 0.45 }),
  );
  ring.position.set(-0.68, 0.0004, -0.32);
  room.add(ring);

  return room;
}

export function buildLighting(p: Palette): Lighting {
  // The lamp: a warm colour pulled most of the way back toward paper white.
  // Straight --highlighter as a light source turns every sheet into a legal
  // pad; the token is the tint, not the whole colour.
  const key = new DirectionalLight(blend(p.keyLight, p.paper, 0.4), 2.3);
  key.position.set(2.0, 2.5, 0.9);
  key.castShadow = true;

  // A tight ortho frustum around the desk. This is the single number that
  // decides whether contact shadows touch or smear: a frustum sized for the
  // whole scene spends its 2048 texels on empty room.
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -1.8;
  key.shadow.camera.right = 1.8;
  key.shadow.camera.top = 1.8;
  key.shadow.camera.bottom = -1.8;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 7;
  // normalBias, not bias: paper is 4mm thick, and a depth bias large enough to
  // stop acne on a 4mm box also detaches its contact shadow, which is the one
  // thing paper cannot survive losing.
  key.shadow.normalBias = 0.012;
  key.shadow.bias = -0.0004;

  const fill = new DirectionalLight(blend(p.fillLight, p.paper, 0.55), 1.0);
  fill.position.set(-3.2, 1.7, 1.4);

  const ambient = new AmbientLight(p.ambient, 1.9);

  return { key, fill, ambient };
}
