import { FIRST_LEVEL_ID, getLevel, type LevelDefinition } from '../data/levels';
import type { PlayerCount } from '../types/player';

const PLAYER_COUNT_KEY = 'playerCount';
const LEVEL_ID_KEY = 'levelId';

export function getPlayerCount(registry: Phaser.Data.DataManager): PlayerCount {
  return registry.get(PLAYER_COUNT_KEY) === 2 ? 2 : 1;
}

export function setPlayerCount(registry: Phaser.Data.DataManager, count: PlayerCount) {
  registry.set(PLAYER_COUNT_KEY, count);
}

export function getCurrentLevel(registry: Phaser.Data.DataManager): LevelDefinition {
  const id = registry.get(LEVEL_ID_KEY);
  return getLevel(typeof id === 'number' ? id : FIRST_LEVEL_ID);
}

export function setCurrentLevel(registry: Phaser.Data.DataManager, levelId: number) {
  registry.set(LEVEL_ID_KEY, levelId);
}
