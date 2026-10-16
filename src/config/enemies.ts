/**
 * Every enemy type, with its stats and behavior tuning. Tweak speed, damage and timing here.
 * Health and damage are multiplied per level by `minionScale` (see `data/levels.ts`).
 * For reference: players walk at 270 px/s, have 250 HP and hit for 12.
 */

export type EnemyKind = 'invasor' | 'veloz' | 'grandote' | 'tirador' | 'escudero' | 'humero' | 'miniBoss';

/** How an enemy fights. Melee kinds share the attack slots around a player; the others don't. */
export type EnemyRole = 'melee' | 'dasher' | 'ranged' | 'zone';

export type EnemyStats = {
  label: string;
  color: number;
  maxHealth: number;
  moveSpeed: number;
  body: { width: number; height: number };
  /** Damage of its attack (melee hit, dash, ball or smoke tick). */
  attackDamage: number;
  /** Melee: distance it stands from the player to hit. Ranged/zone: distance it keeps. */
  reach: number;
  /** Warning time before the attack lands (the enemy flashes white). */
  attackWindupMs: number;
  attackCooldownMs: number;
  /** Not knocked back by hits (still takes damage). */
  superArmor: boolean;
  /** Blocks melee hits from the front. */
  shield: boolean;
};

export type EnemyProfile = EnemyStats & {
  role: EnemyRole;
  dash?: { speed: number; distance: number };
  ranged?: { ballSpeed: number; returnDamage: number; retreatBelow: number };
  smoke?: { telegraphMs: number; cloudMs: number; radius: number; tickMs: number };
  /** Shielded enemies: how long it takes to turn around once a player gets behind them. */
  turnDelayMs?: number;
};

import { actorPx } from './constants';

function body(width: number, height: number) {
  return { width: actorPx(width), height: actorPx(height) };
}

const BODY = body(48, 72);

export const ENEMY_KINDS: Record<EnemyKind, EnemyProfile> = {
  /** The basic one: walks up and punches. */
  invasor: {
    label: 'Invasor',
    color: 0x8b5cf6,
    role: 'melee',
    maxHealth: 30,
    moveSpeed: 150,
    body: BODY,
    attackDamage: 8,
    reach: actorPx(60),
    attackWindupMs: 450,
    attackCooldownMs: 1300,
    superArmor: false,
    shield: false,
  },
  /** Fast and fragile: winds up from a distance and dashes through you. */
  veloz: {
    label: 'Veloz',
    color: 0x22d3ee,
    role: 'dasher',
    maxHealth: 20,
    moveSpeed: 235,
    body: body(40, 64),
    attackDamage: 7,
    reach: 230,
    attackWindupMs: 380,
    attackCooldownMs: 1700,
    superArmor: false,
    shield: false,
    dash: { speed: 560, distance: 320 },
  },
  /** Slow tank: lots of health, heavy hit with a long warning, hits don't push it. */
  grandote: {
    label: 'Grandote',
    color: 0xb45309,
    role: 'melee',
    maxHealth: 90,
    moveSpeed: 85,
    body: body(64, 96),
    attackDamage: 18,
    reach: actorPx(78),
    attackWindupMs: 750,
    attackCooldownMs: 2200,
    superArmor: true,
    shield: false,
  },
  /** Keeps its distance and serves padel balls down your lane. Return one with a swing! */
  tirador: {
    label: 'Tirador',
    color: 0x84cc16,
    role: 'ranged',
    maxHealth: 24,
    moveSpeed: 130,
    body: BODY,
    attackDamage: 10,
    reach: 360,
    attackWindupMs: 750,
    attackCooldownMs: 2400,
    superArmor: false,
    shield: false,
    ranged: { ballSpeed: 420, returnDamage: 14, retreatBelow: 200 },
  },
  /** Front shield: only takes damage from behind (or from the pair special). */
  escudero: {
    label: 'Escudero',
    color: 0x2563eb,
    role: 'melee',
    maxHealth: 30,
    moveSpeed: 115,
    body: BODY,
    attackDamage: 10,
    reach: actorPx(62),
    attackWindupMs: 520,
    attackCooldownMs: 1600,
    superArmor: false,
    shield: true,
    turnDelayMs: 1200,
  },
  /** Throws smoke bombs: the floor is marked, then a cloud hurts whoever stays inside. */
  humero: {
    label: 'Humero',
    color: 0x9ca3af,
    role: 'zone',
    maxHealth: 28,
    moveSpeed: 120,
    body: BODY,
    attackDamage: 6,
    reach: 300,
    attackWindupMs: 500,
    attackCooldownMs: 3200,
    superArmor: false,
    shield: false,
    smoke: { telegraphMs: 900, cloudMs: 2600, radius: actorPx(70), tickMs: 600 },
  },
  /** Each level's leader (name and color come from the level). */
  miniBoss: {
    label: 'Líder del escuadrón',
    color: 0xc026d3,
    role: 'melee',
    maxHealth: 120,
    moveSpeed: 115,
    body: body(56, 88),
    attackDamage: 15,
    reach: actorPx(66),
    attackWindupMs: 600,
    attackCooldownMs: 1800,
    superArmor: true,
    shield: false,
  },
};

/** At most this many melee enemies attack at once; the rest wait around the players. */
export const MAX_MELEE_ATTACKERS = 2;

/** Waiting enemies circle at this distance from their target. */
export const WAIT_DISTANCE = actorPx(200);

/** A melee enemy hands its attack slot to someone else after this many attacks. */
export const ATTACKS_PER_TURN = 2;
