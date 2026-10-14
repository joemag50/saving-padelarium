export type CombatantState = 'idle' | 'move' | 'attack' | 'hit' | 'down' | 'defeated';

export interface HitboxRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CombatTarget {
  combatant: import('../combat/Combatant').Combatant;
  hurtbox: HitboxRect;
  onHit(now: number): void;
  position: Phaser.GameObjects.Container;
  isActive: boolean;
  team: import('../combat/damageRules').CombatTeam;
}

export interface MovementBounds {
  minX: number;
  maxX: number;
}
