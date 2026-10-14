export type PlayerIndex = 0 | 1 | 2 | 3;

export const MAX_PLAYERS = 4;

export interface PlayerConfig {
  index: PlayerIndex;
  name: string;
  color: number;
  spawnX: number;
  spawnY: number;
}

export const PLAYER_CONTROL_HINTS = [
  'P1 WASD · J K E · Space',
  'P2 Arrows · L O P · .',
  'P3 TFGH · Y U I · C',
  'P4 Numpad · 1 3 0 · 2',
] as const;
