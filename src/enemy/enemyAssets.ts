import type { EnemyKind } from '../config/enemies';
import { ACTOR_SCALE } from '../config/constants';

/**
 * Enemies with their own sprites, rendered in Blender like the friends (`art/characters/<kind>.json`).
 * Every kind not listed here is still drawn as a colored block.
 * Only the animations the enemy AI plays are rendered: `attack` is split in the game into a
 * windup (stretched over the enemy's warning time) and the strike.
 */
const ENEMY_SPRITES = {
  invasor: {
    /** Standing height in the frame, antennae included (px); places the name tag. */
    height: 186,
  },
} as const satisfies Partial<Record<EnemyKind, { height: number }>>;

export type SpriteEnemyKind = keyof typeof ENEMY_SPRITES;

const FRAME = 256;
/** Same scale as the friends, so a 176 cm invader stands about as tall as José. */
export const ENEMY_SPRITE_SCALE = 0.66 * ACTOR_SCALE;
/** Empty frame under the feet (px), as rendered. */
export const ENEMY_FEET_MARGIN = 14;
/** How far one walk cycle (8 frames) carries a ~176 cm character on screen, to sync the feet. */
export const ENEMY_WALK_CYCLE_PX = 165;

type StripSpec = { frames: number; frameWidth?: number };

const STRIPS: Record<string, StripSpec> = {
  idle: { frames: 8 },
  walk: { frames: 8 },
  attack: { frames: 13 },
  hurt: { frames: 4 },
  fall: { frames: 8, frameWidth: 448 },
  'fall-unmasked': { frames: 8, frameWidth: 448 },
};

/** The punch's arm is fully out on frame 8 (same animation as the friends' punch). */
const STRIKE_FRAME = 8;

export function hasEnemySprites(kind: EnemyKind): kind is SpriteEnemyKind {
  return kind in ENEMY_SPRITES;
}

export function enemyHeight(kind: SpriteEnemyKind) {
  return ENEMY_SPRITES[kind].height;
}

export const enemyAnimKey = (kind: SpriteEnemyKind, anim: 'idle' | 'walk' | 'windup' | 'strike' | 'hurt' | 'fall' | 'fall-unmasked') =>
  `${kind}-${anim}`;

export const enemyMaskTexture = (kind: SpriteEnemyKind) => `${kind}-mask`;

export function preloadEnemyAssets(scene: Phaser.Scene) {
  for (const kind of Object.keys(ENEMY_SPRITES) as SpriteEnemyKind[]) {
    for (const [strip, spec] of Object.entries(STRIPS)) {
      scene.load.spritesheet(`${kind}-${strip}-strip`, `./assets/characters/${kind}/${strip}.png`, {
        frameWidth: spec.frameWidth ?? FRAME,
        frameHeight: FRAME,
      });
    }
    scene.load.image(enemyMaskTexture(kind), `./assets/characters/${kind}/mask.png`);
  }
}

export function createEnemyAnimations(scene: Phaser.Scene) {
  for (const kind of Object.keys(ENEMY_SPRITES) as SpriteEnemyKind[]) {
    if (scene.anims.exists(enemyAnimKey(kind, 'idle'))) continue;
    const frames = (strip: string, range: { start: number; end: number }) =>
      scene.anims.generateFrameNumbers(`${kind}-${strip}-strip`, range);
    const last = (strip: string) => STRIPS[strip].frames - 1;

    scene.anims.create({ key: enemyAnimKey(kind, 'idle'), frames: frames('idle', { start: 0, end: last('idle') }), frameRate: 8, repeat: -1 });
    // Its frame rate is set per enemy from its walking speed (see SpriteEnemyLook).
    scene.anims.create({ key: enemyAnimKey(kind, 'walk'), frames: frames('walk', { start: 0, end: last('walk') }), frameRate: 8, repeat: -1 });
    // Played over the enemy's whole warning time, ending just before the arm goes out.
    scene.anims.create({ key: enemyAnimKey(kind, 'windup'), frames: frames('attack', { start: 0, end: STRIKE_FRAME - 1 }), frameRate: 16, repeat: 0 });
    scene.anims.create({ key: enemyAnimKey(kind, 'strike'), frames: frames('attack', { start: STRIKE_FRAME, end: last('attack') }), frameRate: 20, repeat: 0 });
    scene.anims.create({ key: enemyAnimKey(kind, 'hurt'), frames: frames('hurt', { start: 0, end: last('hurt') }), frameRate: 16, repeat: 0 });
    scene.anims.create({ key: enemyAnimKey(kind, 'fall'), frames: frames('fall', { start: 0, end: last('fall') }), frameRate: 12, repeat: 0 });
    scene.anims.create({
      key: enemyAnimKey(kind, 'fall-unmasked'),
      frames: frames('fall-unmasked', { start: 0, end: last('fall-unmasked') }),
      frameRate: 12,
      repeat: 0,
    });
  }
}
