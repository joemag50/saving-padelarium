import type { PlayerCount } from '../types/player';

const PLAYER_COUNT_KEY = 'playerCount';

export function getPlayerCount(registry: Phaser.Data.DataManager): PlayerCount {
  return registry.get(PLAYER_COUNT_KEY) === 2 ? 2 : 1;
}

export function setPlayerCount(registry: Phaser.Data.DataManager, count: PlayerCount) {
  registry.set(PLAYER_COUNT_KEY, count);
}
