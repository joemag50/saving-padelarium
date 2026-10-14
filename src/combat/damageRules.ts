import type { Player } from '../player/Player';
import type { CombatTarget } from '../types/combat';

export const COMBAT_TEAM = {
  hero: 'hero',
  enemy: 'enemy',
} as const;

export type CombatTeam = (typeof COMBAT_TEAM)[keyof typeof COMBAT_TEAM];

export function isEnemyTarget(target: CombatTarget) {
  return target.team === COMBAT_TEAM.enemy;
}

export function isHeroTarget(target: unknown): target is Player {
  return (
    typeof target === 'object' &&
    target !== null &&
    'team' in target &&
    (target as { team?: CombatTeam }).team === COMBAT_TEAM.hero
  );
}
