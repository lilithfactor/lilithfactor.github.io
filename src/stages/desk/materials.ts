/* ============================================================================
 * MATERIALS
 *
 * Paper is matte. That is the whole shading model: high roughness, zero
 * metalness, no specular work, no env map. Its detail lives in edges and
 * contact shadows, which are geometry and lighting problems rather than
 * material ones — and both are nearly free.
 *
 * Nine shared materials for ~44 meshes. Shared because a material is a shader
 * program: forty unique ones is forty compiles on the first frame, which is
 * exactly the stutter the desk must not have.
 * ========================================================================== */

import { MeshStandardMaterial } from "three";
import type { Palette } from "./palette";

export interface Materials {
  readonly paper: MeshStandardMaterial;
  readonly paperAged: MeshStandardMaterial;
  readonly paperEdge: MeshStandardMaterial;
  readonly kraft: MeshStandardMaterial;
  readonly wood: MeshStandardMaterial;
  readonly wall: MeshStandardMaterial;
  readonly ink: MeshStandardMaterial;
  readonly accent: MeshStandardMaterial;
  readonly brass: MeshStandardMaterial;
}

export function createMaterials(p: Palette): Materials {
  const matte = (material: MeshStandardMaterial) => material;

  return {
    paper: matte(new MeshStandardMaterial({ color: p.paper, roughness: 0.92, metalness: 0 })),
    paperAged: matte(
      new MeshStandardMaterial({ color: p.paperAged, roughness: 0.94, metalness: 0 }),
    ),
    paperEdge: matte(
      new MeshStandardMaterial({ color: p.paperEdge, roughness: 0.95, metalness: 0 }),
    ),
    kraft: matte(new MeshStandardMaterial({ color: p.kraft, roughness: 0.9, metalness: 0 })),
    // The desk is the one surface allowed a little sheen — a waxed walnut top
    // catching the lamp is what tells you the paper is lying on something.
    wood: new MeshStandardMaterial({ color: p.desk, roughness: 0.62, metalness: 0.04 }),
    wall: new MeshStandardMaterial({ color: p.deskDeep, roughness: 1, metalness: 0 }),
    ink: matte(new MeshStandardMaterial({ color: p.ink, roughness: 0.85, metalness: 0 })),
    accent: matte(new MeshStandardMaterial({ color: p.accent, roughness: 0.8, metalness: 0 })),
    brass: new MeshStandardMaterial({ color: p.kraft, roughness: 0.35, metalness: 0.7 }),
  };
}
