import Phaser from 'phaser';

const SPARK_TEXTURE = 'respawn-spark';
const SPARK_TINTS = [0x67e8f9, 0xa5f3fc, 0xffffff];

/** A soft round dot drawn once and reused by every effect. */
function ensureSparkTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(SPARK_TEXTURE)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffffff, 0.35).fillCircle(8, 8, 8);
  g.fillStyle(0xffffff, 1).fillCircle(8, 8, 4);
  g.generateTexture(SPARK_TEXTURE, 16, 16);
  g.destroy();
}

function burst(scene: Phaser.Scene, x: number, y: number, height: number, count: number, rise: number) {
  ensureSparkTexture(scene);
  const emitter = scene.add.particles(x, y, SPARK_TEXTURE, {
    emitting: false,
    lifespan: { min: 500, max: 950 },
    speedX: { min: -35, max: 35 },
    speedY: { min: -rise, max: -rise * 0.3 },
    scale: { start: 0.9, end: 0 },
    alpha: { start: 1, end: 0 },
    tint: SPARK_TINTS,
    blendMode: Phaser.BlendModes.ADD,
    // Spawn anywhere over the body (relative to the feet).
    x: { min: -26, max: 26 },
    y: { min: -height, max: 0 },
  });
  emitter.setDepth(y + 2);
  emitter.explode(count);
  scene.time.delayedCall(1200, () => emitter.destroy());
}

/** Sparks drift off a knocked-out player as they vanish. */
export function playVanishEffect(scene: Phaser.Scene, x: number, y: number, height: number) {
  burst(scene, x, y, height * 0.5, 18, 120);
}

/**
 * The player beams back in: a column of light shrinks onto them while sparks rise.
 * `y` is the feet; `height` the body's height.
 */
export function playRespawnEffect(scene: Phaser.Scene, x: number, y: number, height: number) {
  const column = scene.add
    .rectangle(x, y - height * 0.6, 90, height * 1.6, 0x67e8f9, 0.45)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(y + 1);
  const glow = scene.add
    .ellipse(x, y, 120, 30, 0x67e8f9, 0.5)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(y - 1);
  scene.tweens.add({
    targets: column,
    scaleX: 0.15,
    alpha: 0,
    duration: 700,
    ease: 'Cubic.easeIn',
    onComplete: () => column.destroy(),
  });
  scene.tweens.add({
    targets: glow,
    scaleX: 1.6,
    scaleY: 1.6,
    alpha: 0,
    duration: 900,
    ease: 'Cubic.easeOut',
    onComplete: () => glow.destroy(),
  });
  burst(scene, x, y, height, 40, 220);
}
