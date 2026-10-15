import type { EnemySpawn, EnemyWave } from '../core/EncounterManager';
import type { EnemyKind, EnemyStats } from './enemies';
import { GAME_WIDTH, LEVEL_WIDTH } from './constants';

/**
 * Every level shares this two-room layout, each room one screen wide
 * (A: start + first fight, B: leader or final boss + rescue);
 * levels differ in content, enemy waves and difficulty, defined in `data/levels.ts`.
 */
const ROOM_B_X = GAME_WIDTH;

export const LEVEL_ZONES = {
  encounter1TriggerX: 550,
  /** A little past the doorway, so both players are inside room B when its camera locks. */
  courtTriggerX: ROOM_B_X + 140,
  rescueX: LEVEL_WIDTH - 200,
} as const;

/**
 * Old-school camera lock: while a fight is on, the camera freezes on its room (left edge below)
 * and players can't leave the screen. It's released when every enemy in the room is down.
 */
export const ENCOUNTER_CAMERA_X = {
  encounter1: 0,
  encounter2: LEVEL_WIDTH - GAME_WIDTH,
} as const;

export const INTERACT_POINTS = {
  /** Walking up to the rescued friends (once every enemy is down) opens the rescue message. */
  rescue: { x: LEVEL_ZONES.rescueX, y: 460, radius: 110 },
} as const;

const ENCOUNTER_AREAS = {
  encounter1: { minX: 740, maxX: 930 },
  encounter2: { minX: ROOM_B_X + 620, maxX: ROOM_B_X + 900 },
} as const;

const BOSS_SPAWN = { x: ROOM_B_X + 760, y: 460 } as const;
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
