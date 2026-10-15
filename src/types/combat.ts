export type CombatantState = 'idle' | 'move' | 'attack' | 'hit' | 'down' | 'defeated';

export interface HitboxRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Who landed a hit and how, for targets that react differently (shields, returned balls…). */
export interface HitInfo {
  attackerX: number;
  /** Player index, or -1 for the shared pair special. */
  attackerIndex: number;
  kind: 'melee' | 'special';
}

export interface CombatTarget {
  combatant: import('../combat/Combatant').Combatant;
  hurtbox: HitboxRect;
  onHit(now: number): void;
  position: Phaser.GameObjects.Container;
  isActive: boolean;
  team: import('../combat/damageRules').CombatTeam;
  /**
   * Optional custom damage handling. When present it's called instead of `combatant.takeDamage`;
   * return true if the hit counts (feedback, special charge), false if it was ignored.
   */
  receiveHit?(amount: number, now: number, info: HitInfo): boolean;
}

/** Applies a hit to a target, using its custom handling when it has one. */
export function applyHit(target: CombatTarget, amount: number, now: number, info: HitInfo): boolean {
  return target.receiveHit ? target.receiveHit(amount, now, info) : target.combatant.takeDamage(amount, now);
}

export interface MovementBounds {
  minX: number;
  maxX: number;
}
