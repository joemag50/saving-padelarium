export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

/** Every level is two rooms, each exactly one screen wide. */
export const LEVEL_WIDTH = GAME_WIDTH * 2;
export const LEVEL_HEIGHT = 720;

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
  moveSpeed: 220,
  bodyWidth: 48,
  bodyHeight: 72,
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
