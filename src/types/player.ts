import type { RosterCharacterId } from '../data/roster';

export type PlayerIndex = 0 | 1;

export type PlayerCount = 1 | 2;

export const MAX_PLAYERS = 2;

export interface PlayerConfig {
  index: PlayerIndex;
  /** Picks the character's sprites (see `player/heroAssets.ts`). */
  characterId: RosterCharacterId;
  name: string;
  color: number;
  spawnX: number;
  spawnY: number;
}
