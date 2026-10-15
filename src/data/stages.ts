import { GAME_WIDTH, LEVEL_WIDTH } from '../config/constants';
import type { FloorPattern, StageDefinition, StageLight, StageRoom } from '../world/stage';

/** Every level has two rooms, one screen wide each: A (first fight) and B (leader or boss + rescue). */
const ROOM_EDGES = [0, GAME_WIDTH, LEVEL_WIDTH] as const;

type RoomLook = { wall: StageRoom['wall']; floor: FloorPattern };

function stage(light: StageLight, a: RoomLook, b: RoomLook): StageDefinition {
  return {
    light,
    rooms: [a, b].map((look, index) => ({ ...look, fromX: ROOM_EDGES[index], toX: ROOM_EDGES[index + 1] })),
  };
}

/**
 * Walls and floors for each level (colors are 0xRRGGBB).
 * Rules: it's always night ("Noche de Invasión"); both rooms of a level stay inside that
 * level's color (the same one as its background, menu card and leader); and each level carries
 * the light its intro describes. The room's material (tile, wood, carpet…) says what the room is.
 */
export const STAGES = {
  /** 1. Blue-gray night. The green light that took the group leaks in from outside. */
  recepcion: stage(
    { kind: 'glow', color: 0x4ade80 },
    {
      wall: { color: 0x3b4a5e, trim: 0x6b7f99, base: 0x1c2431 },
      floor: { kind: 'tiles', base: 0x4a5568, alt: 0x414b5c, grout: 0x2b3442, size: 72 },
    },
    {
      wall: { color: 0x1e293b, trim: 0x60a5fa, base: 0x0f172a },
      floor: { kind: 'court', base: 0x1e3a8a, line: 0xcbd5e1 },
    },
  ),
  /** 2. Green. A green fog creeps along the floor. */
  vestidores: stage(
    { kind: 'fog', color: 0x86efac },
    {
      wall: { color: 0x2f4a42, trim: 0x5f8f7f, base: 0x14231f },
      floor: { kind: 'tiles', base: 0x3c5a51, alt: 0x345049, grout: 0x22362f, size: 56 },
    },
    {
      wall: { color: 0x2c4f4a, trim: 0x6fa79c, base: 0x14231f },
      floor: { kind: 'tiles', base: 0x3e6660, alt: 0x365a55, grout: 0x223d39, size: 44 },
    },
  ),
  /** 3. Purple. The alien buzz shows as sound rings on the walls. */
  cafeteria: stage(
    { kind: 'waves', color: 0xc4b5fd },
    {
      wall: { color: 0x4a3a5a, trim: 0x8b6fae, base: 0x231a2b },
      floor: { kind: 'planks', base: 0x5b4a52, alt: 0x51424a, seam: 0x2e2430, plankWidth: 150 },
    },
    {
      wall: { color: 0x4f4560, trim: 0x9a8bb5, base: 0x231a2b },
      floor: { kind: 'tiles', base: 0x6b6478, alt: 0x3b3447, grout: 0x2a2433, size: 56 },
    },
  ),
  /** 4. Concrete gray with hazard yellow. The "abduction beam" falls from above. */
  estacionamiento: stage(
    { kind: 'beams', color: 0xfde047 },
    {
      wall: { color: 0x3f444d, trim: 0x9ca3af, base: 0x1c1f24 },
      floor: { kind: 'slabs', base: 0x4b5058, seam: 0x32363d, size: 160 },
    },
    {
      wall: { color: 0x2f3238, trim: 0xfacc15, base: 0x15171b },
      floor: { kind: 'asphalt', base: 0x2a2d32, line: 0xfacc15, spacing: 140 },
    },
  ),
  /** 5. Wine red. Alien lasers crisscross the walls. */
  oficina: stage(
    { kind: 'lasers', color: 0xf87171 },
    {
      wall: { color: 0x4a3436, trim: 0x8a6a6a, base: 0x26191b },
      floor: { kind: 'carpet', base: 0x4a2f33, fleck: 0x5a3a3f },
    },
    {
      wall: { color: 0x3a1a1d, trim: 0xc9a227, base: 0x1f0d0f },
      floor: { kind: 'carpet', base: 0x5c1a1f, fleck: 0x6e2228 },
    },
  ),
  /** 6. Navy blue. The UFO's light floods the walls. */
  canchaCentral: stage(
    { kind: 'glow', color: 0x38bdf8 },
    {
      wall: { color: 0x1e2a4a, trim: 0x3b82f6, base: 0x0b1026 },
      floor: { kind: 'slabs', base: 0x2f3d5c, seam: 0x1c2640, size: 140 },
    },
    {
      wall: { color: 0x0f2a4a, trim: 0x38bdf8, base: 0x082f49 },
      floor: { kind: 'court', base: 0x1e40af, line: 0xe2e8f0 },
    },
  ),
} as const satisfies Record<string, StageDefinition>;
