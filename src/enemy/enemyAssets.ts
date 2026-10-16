import type { EnemyKind } from '../config/enemies';
import { ACTOR_SCALE } from '../config/constants';

/**
 * Enemies with their own sprites, rendered in Blender like the friends (`art/characters/<id>.json`).
 * Only the animations each enemy's AI plays are rendered. The attack strip is split in the game
 * into a windup (stretched over the enemy's warning time) and the strike, at `strikeFrame`.
 */
type EnemySpriteSpec = {
  /** Standing height in the frame, mask included (px); places the name tag. */
  height: number;
  /** Real height, to sync the walk cycle with how far it moves. */
  cm: number;
  attack: { strip: 'attack' | 'serve' | 'dash'; frames: number; strikeFrame: number };
  /** Super armor kinds don't flinch, so they have no hurt strip. */
  hurt: boolean;
  /** The tallest need a wider frame to lie down whole (`wideFrames` in their JSON). */
  fallWidth?: number;
};

const PUNCH = { strip: 'attack', frames: 13, strikeFrame: 8 } as const;

const ENEMY_SPRITES = {
  invasor: { height: 186, cm: 176, attack: PUNCH, hurt: true },
  // The dash strip is also its windup: it holds the first stride, ready to sprint.
  veloz: { height: 164, cm: 168, attack: { strip: 'dash', frames: 8, strikeFrame: 1 }, hurt: true },
  grandote: { height: 203, cm: 200, attack: PUNCH, hurt: false, fallWidth: 576 },
  // The racket goes back over the shoulder (0-3) and swings through (4-11).
  tirador: { height: 185, cm: 175, attack: { strip: 'serve', frames: 12, strikeFrame: 4 }, hurt: true },
  escudero: { height: 180, cm: 180, attack: PUNCH, hurt: true },
  // The punch reads as the bomb toss.
  humero: { height: 182, cm: 172, attack: PUNCH, hurt: true },
  'lider-1': { height: 204, cm: 190, attack: PUNCH, hurt: false, fallWidth: 576 },
  'lider-2': { height: 204, cm: 190, attack: PUNCH, hurt: false, fallWidth: 576 },
  'lider-3': { height: 204, cm: 190, attack: PUNCH, hurt: false, fallWidth: 576 },
  'lider-4': { height: 204, cm: 190, attack: PUNCH, hurt: false, fallWidth: 576 },
  'lider-5': { height: 204, cm: 190, attack: PUNCH, hurt: false, fallWidth: 576 },
} as const satisfies Record<string, EnemySpriteSpec>;

export type EnemySpriteId = keyof typeof ENEMY_SPRITES;
const SPRITE_IDS = Object.keys(ENEMY_SPRITES) as EnemySpriteId[];

const FRAME = 256;
const FALL_FRAME_WIDTH = 448;
/** Same scale as the friends, so a 176 cm invader stands about as tall as José. */
export const ENEMY_SPRITE_SCALE = 0.66 * ACTOR_SCALE;
/** Empty frame under the feet (px), as rendered. */
export const ENEMY_FEET_MARGIN = 14;
/** How far one walk cycle (8 frames) carries a 176 cm character on screen, to sync the feet. */
const WALK_CYCLE_PX_AT_176_CM = 165;

/**
 * Which sprites an enemy uses, or null for the colored block. Each level's leader has its own
 * costume (`lider-<level>`); the final level's boss is drawn by `SupremoBoss`.
 */
export function enemySpriteId(kind: EnemyKind, levelId: number): EnemySpriteId | null {
  const id = kind === 'miniBoss' ? `lider-${levelId}` : kind;
  return id in ENEMY_SPRITES ? (id as EnemySpriteId) : null;
}

export function enemyHeight(id: EnemySpriteId) {
  return ENEMY_SPRITES[id].height;
}

export function enemyWalkCyclePx(id: EnemySpriteId) {
  return (WALK_CYCLE_PX_AT_176_CM * ENEMY_SPRITES[id].cm) / 176;
}

export function enemyHasHurt(id: EnemySpriteId) {
  return ENEMY_SPRITES[id].hurt;
}

export type EnemyAnim = 'idle' | 'walk' | 'windup' | 'strike' | 'dash' | 'hurt' | 'fall' | 'fall-unmasked';

export const enemyAnimKey = (id: EnemySpriteId, anim: EnemyAnim) => `${id}-${anim}`;

export const enemyMaskTexture = (id: EnemySpriteId) => `${id}-mask`;

function strips(id: EnemySpriteId) {
  const spec: EnemySpriteSpec = ENEMY_SPRITES[id];
  const list: Record<string, { frames: number; frameWidth?: number }> = {
    idle: { frames: 8 },
    walk: { frames: 8 },
    [spec.attack.strip]: { frames: spec.attack.frames },
    fall: { frames: 8, frameWidth: spec.fallWidth ?? FALL_FRAME_WIDTH },
    'fall-unmasked': { frames: 8, frameWidth: spec.fallWidth ?? FALL_FRAME_WIDTH },
  };
  if (spec.hurt) list.hurt = { frames: 4 };
  return list;
}

export function preloadEnemyAssets(scene: Phaser.Scene) {
  for (const id of SPRITE_IDS) {
    for (const [strip, spec] of Object.entries(strips(id))) {
      scene.load.spritesheet(`${id}-${strip}-strip`, `./assets/characters/${id}/${strip}.png`, {
        frameWidth: spec.frameWidth ?? FRAME,
        frameHeight: FRAME,
      });
    }
    scene.load.image(enemyMaskTexture(id), `./assets/characters/${id}/mask.png`);
  }
}

export function createEnemyAnimations(scene: Phaser.Scene) {
  for (const id of SPRITE_IDS) {
    if (scene.anims.exists(enemyAnimKey(id, 'idle'))) continue;
    const spec: EnemySpriteSpec = ENEMY_SPRITES[id];
    const frames = (strip: string, range: { start: number; end: number }) =>
      scene.anims.generateFrameNumbers(`${id}-${strip}-strip`, range);
    const add = (anim: EnemyAnim, strip: string, start: number, end: number, frameRate: number, repeat = 0) =>
      scene.anims.create({ key: enemyAnimKey(id, anim), frames: frames(strip, { start, end }), frameRate, repeat });
    const { strip, frames: count, strikeFrame } = spec.attack;

    add('idle', 'idle', 0, 7, 8, -1);
    // Its frame rate is set per enemy from its walking speed (see SpriteEnemyLook).
    add('walk', 'walk', 0, 7, 8, -1);
    // Played over the enemy's whole warning time, ending just before the swing.
    add('windup', strip, 0, strikeFrame - 1, 16);
    if (strip === 'dash') {
      add('dash', strip, 0, count - 1, 20, -1);
    } else {
      add('strike', strip, strikeFrame, count - 1, 20);
    }
    if (spec.hurt) add('hurt', 'hurt', 0, 3, 16);
    add('fall', 'fall', 0, 7, 12);
    add('fall-unmasked', 'fall-unmasked', 0, 7, 12);
  }
}

/**
 * The final boss, "Supremo Galáctico" (`art/characters/supremo.json`): a taller frame for his
 * crown, and one strip per phase of the fight (see `SupremoBoss`).
 */
export const BOSS_SPRITE = {
  id: 'supremo',
  /** Standing height in the frame, crown included (px). */
  height: 217,
  frameHeight: 320,
  /** The racket goes back (0-3) and swings through (4-11), like the Tirador's serve. */
  strikeFrame: 4,
  walkCyclePx: (WALK_CYCLE_PX_AT_176_CM * 210) / 176,
} as const;

export type BossAnim = 'idle' | 'walk' | 'windup' | 'strike' | 'charge' | 'raise' | 'stunned' | 'exhausted' | 'fall-unmasked';

export const bossAnimKey = (anim: BossAnim) => `${BOSS_SPRITE.id}-${anim}`;
export const BOSS_MASK_TEXTURE = `${BOSS_SPRITE.id}-mask`;

const BOSS_STRIPS: Record<string, { frames: number; frameWidth?: number }> = {
  idle: { frames: 8 },
  walk: { frames: 8 },
  serve: { frames: 12, frameWidth: 384 },
  charge: { frames: 8 },
  raise: { frames: 8 },
  stunned: { frames: 6 },
  exhausted: { frames: 8 },
  'fall-unmasked': { frames: 8, frameWidth: 640 },
};

export function preloadBossAssets(scene: Phaser.Scene) {
  for (const [strip, spec] of Object.entries(BOSS_STRIPS)) {
    scene.load.spritesheet(`${BOSS_SPRITE.id}-${strip}-strip`, `./assets/characters/${BOSS_SPRITE.id}/${strip}.png`, {
      frameWidth: spec.frameWidth ?? FRAME,
      frameHeight: BOSS_SPRITE.frameHeight,
    });
  }
  scene.load.image(BOSS_MASK_TEXTURE, `./assets/characters/${BOSS_SPRITE.id}/mask.png`);
}

export function createBossAnimations(scene: Phaser.Scene) {
  if (scene.anims.exists(bossAnimKey('idle'))) return;
  const add = (anim: BossAnim, strip: string, start: number, end: number, frameRate: number, repeat = 0, yoyo = false) =>
    scene.anims.create({
      key: bossAnimKey(anim),
      frames: scene.anims.generateFrameNumbers(`${BOSS_SPRITE.id}-${strip}-strip`, { start, end }),
      frameRate,
      repeat,
      yoyo,
    });
  add('idle', 'idle', 0, 7, 8, -1);
  add('walk', 'walk', 0, 7, 8, -1);
  add('windup', 'serve', 0, BOSS_SPRITE.strikeFrame - 1, 12);
  add('strike', 'serve', BOSS_SPRITE.strikeFrame, 11, 20);
  add('charge', 'charge', 0, 7, 16, -1);
  // Arms up to call the beams, and between phases.
  add('raise', 'raise', 0, 7, 10, -1, true);
  // Dizzy: rocks back and forth while stunned.
  add('stunned', 'stunned', 0, 5, 9, -1, true);
  add('exhausted', 'exhausted', 0, 7, 5, -1);
  add('fall-unmasked', 'fall-unmasked', 0, 7, 12);
}
