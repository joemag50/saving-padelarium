export const LEVEL_ZONES = {
  encounter1TriggerX: 550,
  encounter1BlockX: 960,
  barrierX: 1040,
  hallwayStartX: 1100,
  courtTriggerX: 1720,
  rescueX: 2220,
} as const;

export const ENEMY_SPAWNS = {
  encounter1: [
    { x: 760, y: 440 },
    { x: 840, y: 460 },
    { x: 920, y: 480 },
  ],
  encounter2: {
    minions: [
      { x: 1820, y: 430 },
      { x: 1980, y: 490 },
    ],
    miniBoss: { x: 1900, y: 460 },
  },
} as const;

export const INTERACT_POINTS = {
  barrier: { x: 1020, y: 460, radius: 95 },
  projector: { x: 660, y: 430, radius: 85 },
} as const;
