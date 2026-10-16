import { actorPx } from './constants';

export const COMBAT = {
  depthTolerance: 44,
  hitStopMs: 60,
  playerMaxHealth: 250,
  playerAttackDamage: 12,
  /** Short windup, a held impact, then recovery; duration + cooldown keep one punch every 500 ms. */
  attackDurationMs: 340,
  /** While the arm is out (frames 8-9 of the punch, see `player/heroAssets.ts`). */
  attackActiveStartMs: 120,
  attackActiveEndMs: 240,
  attackCooldownMs: 160,
  /** Punch hitbox: from the chest to just past the fist, at shoulder height. */
  hitboxWidth: actorPx(48),
  hitboxHeight: actorPx(47),
  /** From the body's center to the hitbox's center, toward where the player faces. */
  hitboxReach: actorPx(39),
  /** Hitbox center above the feet (the fist is ~120 px up on a 165 px friend). */
  hitboxHeightAboveFeet: actorPx(77),
  hurtboxPadding: 4,
  invulnerabilityMs: 400,
  /** Long enough for the roll to read as a roll. */
  dodgeDurationMs: 420,
  dodgeCooldownMs: 500,
  /** 400 px/s for 420 ms ≈ 168 px per dodge, about one body length. */
  dodgeSpeed: 400,
  specialMax: 100,
  specialGainPerHit: 12,
  specialDamage: 28,
  specialRadius: actorPx(140),
  /** Health given back between the two fights of a level (40% of max). */
  recoveryBetweenEncounters: 100,
} as const;
