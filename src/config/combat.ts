export const COMBAT = {
  depthTolerance: 36,
  hitStopMs: 60,
  playerMaxHealth: 100,
  playerAttackDamage: 12,
  attackDurationMs: 220,
  attackActiveStartMs: 60,
  attackActiveEndMs: 140,
  attackCooldownMs: 280,
  hitboxWidth: 58,
  hitboxHeight: 42,
  hurtboxPadding: 4,
  invulnerabilityMs: 400,
  dodgeDurationMs: 220,
  dodgeCooldownMs: 500,
  dodgeSpeed: 420,
  specialMax: 100,
  specialGainPerHit: 12,
  specialDamage: 28,
  specialRadius: 140,
} as const;

export const ENEMY_BODY = {
  width: 48,
  height: 72,
} as const;

export const ENEMY_STATS = {
  basic: {
    maxHealth: 30,
    moveSpeed: 145,
    attackDamage: 8,
    attackRange: 58,
    attackWindupMs: 420,
    attackActiveMs: 180,
    attackCooldownMs: 1500,
    color: 0x8b5cf6,
    label: 'Fake invader',
  },
  miniBoss: {
    maxHealth: 120,
    moveSpeed: 105,
    attackDamage: 15,
    attackRange: 62,
    attackWindupMs: 620,
    attackActiveMs: 220,
    attackCooldownMs: 2000,
    color: 0xc026d3,
    label: 'Squad Leader',
  },
} as const;
