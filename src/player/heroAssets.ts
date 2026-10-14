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

export function preloadHeroAssets(scene: Phaser.Scene) {
  const base = HERO_ASSET_BASE;
  const frame = HERO_FRAME;

  scene.load.spritesheet(HERO_TEXTURES.idle, `${base}/male_hero_template-idle.png`, frame);
  scene.load.spritesheet(HERO_TEXTURES.walk, `${base}/male_hero_template-walk.png`, frame);
  scene.load.spritesheet(HERO_TEXTURES.run, `${base}/male_hero_template-run.png`, frame);
  scene.load.spritesheet(HERO_TEXTURES.attack, `${base}/male_hero_template-combo_1.png`, frame);
  scene.load.spritesheet(HERO_TEXTURES.fall, `${base}/male_hero_template-fall.png`, frame);
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
    frameRate: 14,
    repeat: 0,
  });

  scene.anims.create({
    key: HERO_ANIMS.fall,
    frames: scene.anims.generateFrameNumbers(HERO_TEXTURES.fall, { start: 0, end: 3 }),
    frameRate: 10,
    repeat: 0,
  });
}

export const HERO_DISPLAY = {
  scale: 2.25,
  footY: 110,
} as const;
