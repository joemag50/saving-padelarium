import type { EnemySpawn, EnemyWave } from '../core/EncounterManager';
import type { EnemyKind, EnemyStats } from './enemies';
import { GAME_WIDTH, LEVEL_WIDTH } from './constants';

/**
 * Every level shares this three-zone layout (A: start + first fight, B: hallway, C: boss + rescue);
 * levels differ in content, enemy waves and difficulty, defined in `data/levels.ts`.
 */
export const LEVEL_ZONES = {
  encounter1TriggerX: 550,
  courtTriggerX: 1720,
  rescueX: 2220,
} as const;

/**
 * Old-school camera lock: while a fight is on, the camera freezes on its room (left edge below)
 * and players can't leave the screen. It's released when every enemy in the room is down.
 */
export const ENCOUNTER_CAMERA_X = {
  encounter1: 0,
  encounter2: LEVEL_WIDTH - GAME_WIDTH,
} as const;

export const LEVEL_PROPS = {
  cover: { x: 620, y: 330, width: 220, height: 90 },
  hallway: { x: 1500, width: 80, height: 160 },
  court: { x: 2100, width: 80, height: 160 },
} as const;

export const INTERACT_POINTS = {
  /** Walking up to the rescued friends (once every enemy is down) opens the rescue message. */
  rescue: { x: LEVEL_ZONES.rescueX, y: 460, radius: 110 },
} as const;

const ENCOUNTER_AREAS = {
  encounter1: { minX: 740, maxX: 930 },
  encounter2: { minX: 1800, maxX: 2080 },
} as const;

const BOSS_SPAWN = { x: 1940, y: 460 } as const;
const FINAL_BOSS_SPAWN = { x: LEVEL_WIDTH - 150, y: 450 } as const;

/** Depth rows enemies are spread across, inside the walk lane. */
const SPAWN_ROWS = [430, 490, 460, 520, 400] as const;

/** One wave lists the enemy kinds in it, e.g. `['invasor', 'invasor', 'tirador']`. */
export type WaveKinds = readonly EnemyKind[];

function spreadSpawns(kinds: WaveKinds, area: { minX: number; maxX: number }, scale: number): EnemySpawn[] {
  const count = kinds.length;
  return kinds.map((kind, index) => ({
    x: count === 1 ? (area.minX + area.maxX) / 2 : area.minX + ((area.maxX - area.minX) * index) / (count - 1),
    y: SPAWN_ROWS[index % SPAWN_ROWS.length],
    kind,
    scale,
  }));
}

export function buildEncounter1Waves(waves: readonly WaveKinds[], scale: number): EnemyWave[] {
  return waves.map((kinds) => spreadSpawns(kinds, ENCOUNTER_AREAS.encounter1, scale));
}

/** The level leader joins the last wave; the final boss instead fights alone after the waves. */
export function buildEncounter2Waves(
  waves: readonly WaveKinds[],
  scale: number,
  leader: Partial<EnemyStats>,
  finalBoss = false,
): EnemyWave[] {
  const built = waves.map((kinds) => spreadSpawns(kinds, ENCOUNTER_AREAS.encounter2, scale));
  if (finalBoss) return [...built, [{ ...FINAL_BOSS_SPAWN, kind: 'finalBoss', scale }]];
  const boss: EnemySpawn = { ...BOSS_SPAWN, kind: 'miniBoss', overrides: leader };
  if (built.length === 0) return [[boss]];
  built[built.length - 1] = [...built[built.length - 1], boss];
  return built;
}
