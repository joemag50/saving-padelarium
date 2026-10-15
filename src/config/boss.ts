/**
 * Tuning for the final boss, "Supremo Galáctico". Every number of the fight lives here.
 * `solo` values replace the base ones when playing alone, so the fight stays fair for one player.
 */
export const FINAL_BOSS = {
  label: 'Supremo Galáctico',
  maxHealth: 360,
  body: { width: 84, height: 124, radius: 40 },
  color: 0x4338ca,
  /** Health fractions where phase 2 (charge) and phase 3 (abduction) begin. */
  phase2At: 0.66,
  phase3At: 0.33,
  /** Pause where the boss flashes between phases; it can't be hurt meanwhile. */
  phaseTransitionMs: 1400,
  /** Two different players landing hits on a stunned boss within this window → "Golpe de pareja". */
  pairHitWindowMs: 500,
  pairHitBonusDamage: 20,

  /** Close-range racket swipe, used in every phase when a player gets too close. */
  swipe: { range: 110, windupMs: 520, damage: 16, cooldownMs: 1600, windupMsPhase3: 380 },

  serve: {
    aimMs: 850,
    gapMs: 650,
    ballsPerVolley: 3,
    restMs: 1400,
    ballSpeed: 520,
    returnSpeed: 700,
    ballDamage: 14,
    returnDamage: 12,
    stunMs: 2200,
    /** Minions called in after every other volley, never more than this many alive. */
    maxMinions: 2,
  },

  charge: {
    alignMs: 600,
    telegraphMs: 800,
    speed: 900,
    damage: 18,
    stunMs: 2000,
    restMs: 900,
  },

  abduction: {
    everyMs: 3600,
    telegraphMs: 1000,
    activeMs: 4200,
    radius: 56,
    followSpeed: 70,
    /** Hits a partner needs to break the beam holding someone. */
    beamHealth: 3,
    damagePerSecond: 5,
    /** Alone there's no partner to help, so the beam lets go on its own. */
    maxHoldMs: 3200,
    chaseSpeed: 70,
  },

  solo: {
    stunMsBonus: 900,
    ballDamage: 10,
    beamsPerWave: 1,
    maxHoldMs: 1500,
    chargeDamage: 14,
  },
  duo: {
    beamsPerWave: 2,
  },
} as const;
