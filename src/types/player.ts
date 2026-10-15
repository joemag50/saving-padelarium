export type PlayerIndex = 0 | 1;

export type PlayerCount = 1 | 2;

export const MAX_PLAYERS = 2;

export interface PlayerConfig {
  index: PlayerIndex;
  name: string;
  color: number;
  spawnX: number;
  spawnY: number;
}
