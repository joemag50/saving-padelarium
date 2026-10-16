export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

/** Every level is two rooms, each exactly one screen wide. */
export const LEVEL_WIDTH = GAME_WIDTH * 2;
export const LEVEL_HEIGHT = 720;

/**
 * Size of characters and enemies relative to the stage. Bodies, hitboxes and fighting
 * distances are written at the original size and multiplied by this, so it can be retuned
 * in one place.
 */
export const ACTOR_SCALE = 1.5;

/** A length measured at the original actor size, in today's pixels. */
export function actorPx(px: number) {
  return Math.round(px * ACTOR_SCALE);
}

/** Beat-'em-up walk lane on the Y axis (screen depth). Applies to the whole level. */
export const WALK_LANE = {
  minY: 310,
  maxY: 590,
} as const;

export type WalkLaneBounds = {
  minY: number;
  maxY: number;
};

export const PLAYER = {
  moveSpeed: 270,
  /** Hurtbox: about the torso's width and the whole body's height (rendered friends, ~165 px). */
  bodyWidth: actorPx(31),
  bodyHeight: actorPx(105),
} as const;

export const CAMERA = {
  followLerp: 0.1,
  deadzoneWidth: 80,
} as const;

export const SPAWN_POINTS = [
  { x: 150, y: 450 },
  { x: 210, y: 470 },
  { x: 270, y: 450 },
  { x: 330, y: 470 },
] as const;
