import { ACTOR_SCALE, actorPx } from '../config/constants';
import type { RosterCharacterId } from '../data/roster';

export const HERO_ASSET_BASE = './assets/individual_sheets';

export const HERO_FRAME = {
  frameWidth: 128,
  frameHeight: 128,
} as const;

export const HERO_TEXTURES = {
  idle: 'hero-idle',
  walk: 'hero-walk',
  run: 'hero-run',
  attack: 'hero-attack',
  fall: 'hero-fall',
} as const;

export const HERO_ANIMS = {
  idle: 'hero-idle',
  walk: 'hero-walk',
  run: 'hero-run',
  attack: 'hero-attack',
  fall: 'hero-fall',
} as const;

export type HeroAnimName = keyof typeof HERO_ANIMS | 'dodge' | 'hurt';

/**
 * Friends with their own sprites, rendered in Blender from `art/characters/<id>.json`
 * (see `art/blender/build_character.py`). Everyone else uses the tinted template above.
 */
/** Each friend's standing height in their frame (px), from their real height; places the name tag. */
const CHARACTER_HEIGHTS = {
  jose: 167,
  carol: 148,
  casillas: 153,
  armando: 175,
  arturo: 163,
  fisam: 167,
  juaquin: 164,
  alberto: 153,
  rody: 149,
  cris: 148,
  crispy: 163,
  lucia: 157,
  fatima: 152,
  flor: 148,
} as const satisfies Record<RosterCharacterId, number>;
type SpriteCharacterId = keyof typeof CHARACTER_HEIGHTS;
const CHARACTER_SPRITE_IDS = Object.keys(CHARACTER_HEIGHTS) as SpriteCharacterId[];
/** Taller friends need a wider frame to lie down whole (`wideFrames` in their JSON). */
const CHARACTER_FRAME_WIDTHS: Partial<Record<SpriteCharacterId, Partial<Record<HeroAnimName, number>>>> = {
  armando: { fall: 448 },
};

const CHARACTER_FRAME = 256;
/** Frames per strip and playback; must match the Blender render (art/characters/<id>.frames.json). */
type CharacterAnim = {
  frames: number;
  frameRate: number;
  repeat: number;
  /** Frames to play, in order (repeats hold a pose). Default: every frame once. */
  sequence?: number[];
  /** Wider frames for poses that leave the square (lying down); same height and center. */
  frameWidth?: number;
};

const CHARACTER_ANIMS: Record<HeroAnimName, CharacterAnim> = {
  idle: { frames: 8, frameRate: 8, repeat: -1 },
  // Feet match the ground at PLAYER.moveSpeed (270 px/s): a walk cycle covers ~168 px on screen
  // and a run cycle ~200 px, so they loop every ~0.62 s and ~0.74 s.
  walk: { frames: 8, frameRate: 13, repeat: -1 },
  run: { frames: 8, frameRate: 11, repeat: -1 },
  // 11 steps at ~32 fps ≈ COMBAT.attackDurationMs (340 ms): a trimmed windup (0-7), the arm held
  // out on impact (8-9, when the hit lands) and the way back (10-12).
  attack: { frames: 13, frameRate: 32, repeat: 0, sequence: [0, 3, 5, 7, 8, 8, 9, 9, 10, 11, 12] },
  hurt: { frames: 4, frameRate: 16, repeat: 0 },
  // The whole roll fits in one dodge (COMBAT.dodgeDurationMs = 420 ms).
  dodge: { frames: 8, frameRate: 19, repeat: 0 },
  fall: { frames: 8, frameRate: 12, repeat: 0, frameWidth: 384 },
};

/** How a hero's sprite sits in its container (feet at y = 0). */
export type HeroLook = {
  /** null: the shared template, tinted with the character's color. */
  characterId: SpriteCharacterId | null;
  scale: number;
  spriteY: number;
  /** Where the name tag goes, above the head. */
  labelY: number;
};

const TEMPLATE_LOOK: HeroLook = {
  characterId: null,
  scale: 2.25 * ACTOR_SCALE,
  spriteY: actorPx(110),
  labelY: actorPx(-58),
};
/** Rendered friends: a 180 cm friend is ~165 px tall on screen (167 px in the frame, 14 px under the feet). */
const CHARACTER_SCALE = 0.66 * ACTOR_SCALE;
const CHARACTER_FEET_MARGIN = 14;

function hasOwnSprites(id: RosterCharacterId): id is SpriteCharacterId {
  return (CHARACTER_SPRITE_IDS as readonly string[]).includes(id);
}

export function getHeroLook(id: RosterCharacterId): HeroLook {
  if (!hasOwnSprites(id)) return TEMPLATE_LOOK;
  return {
    characterId: id,
    scale: CHARACTER_SCALE,
    spriteY: CHARACTER_FEET_MARGIN * CHARACTER_SCALE + 2,
    labelY: -Math.round(CHARACTER_HEIGHTS[id] * CHARACTER_SCALE) - 22,
  };
}

/** Animation key for this look; template looks have no dodge/hurt and fall back. */
export function heroAnimKey(look: HeroLook, anim: HeroAnimName) {
  if (look.characterId) return `${look.characterId}-${anim}`;
  if (anim === 'dodge') return HERO_ANIMS.run;
  if (anim === 'hurt') return HERO_ANIMS.idle;
  return HERO_ANIMS[anim];
}

export function heroIdleTexture(look: HeroLook) {
  return look.characterId ? `${look.characterId}-idle` : HERO_TEXTURES.idle;
}

export function preloadHeroAssets(scene: Phaser.Scene) {
  const base = HERO_ASSET_BASE;
  const frame = HERO_FRAME;

  scene.load.spritesheet(HERO_TEXTURES.idle, `${base}/male_hero_template-idle.png`, frame);
  scene.load.spritesheet(HERO_TEXTURES.walk, `${base}/male_hero_template-walk.png`, frame);
  scene.load.spritesheet(HERO_TEXTURES.run, `${base}/male_hero_template-run.png`, frame);
  scene.load.spritesheet(HERO_TEXTURES.attack, `${base}/male_hero_template-combo_1.png`, frame);
  scene.load.spritesheet(HERO_TEXTURES.fall, `${base}/male_hero_template-fall.png`, frame);

  for (const id of CHARACTER_SPRITE_IDS) {
    for (const [anim, spec] of Object.entries(CHARACTER_ANIMS)) {
      scene.load.spritesheet(`${id}-${anim}`, `./assets/characters/${id}/${anim}.png`, {
        frameWidth: CHARACTER_FRAME_WIDTHS[id]?.[anim as HeroAnimName] ?? spec.frameWidth ?? CHARACTER_FRAME,
        frameHeight: CHARACTER_FRAME,
      });
    }
  }
}

export function createHeroAnimations(scene: Phaser.Scene) {
  if (scene.anims.exists(HERO_ANIMS.idle)) return;

  scene.anims.create({
    key: HERO_ANIMS.idle,
    frames: scene.anims.generateFrameNumbers(HERO_TEXTURES.idle, { start: 0, end: 9 }),
    frameRate: 8,
    repeat: -1,
  });

  scene.anims.create({
    key: HERO_ANIMS.walk,
    frames: scene.anims.generateFrameNumbers(HERO_TEXTURES.walk, { start: 0, end: 9 }),
    frameRate: 12,
    repeat: -1,
  });

  scene.anims.create({
    key: HERO_ANIMS.run,
    frames: scene.anims.generateFrameNumbers(HERO_TEXTURES.run, { start: 0, end: 9 }),
    frameRate: 14,
    repeat: -1,
  });

  scene.anims.create({
    key: HERO_ANIMS.attack,
    frames: scene.anims.generateFrameNumbers(HERO_TEXTURES.attack, { start: 0, end: 2 }),
    // Spread over the whole attack (COMBAT.attackDurationMs).
    frameRate: 9,
    repeat: 0,
  });

  scene.anims.create({
    key: HERO_ANIMS.fall,
    frames: scene.anims.generateFrameNumbers(HERO_TEXTURES.fall, { start: 0, end: 3 }),
    frameRate: 10,
    repeat: 0,
  });

  for (const id of CHARACTER_SPRITE_IDS) {
    for (const [anim, spec] of Object.entries(CHARACTER_ANIMS)) {
      const key = `${id}-${anim}`;
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(
          key,
          spec.sequence ? { frames: spec.sequence } : { start: 0, end: spec.frames - 1 },
        ),
        frameRate: spec.frameRate,
        repeat: spec.repeat,
      });
    }
  }
}
