import Phaser from 'phaser';
import {
  ENEMY_FEET_MARGIN,
  ENEMY_SPRITE_SCALE,
  ENEMY_WALK_CYCLE_PX,
  enemyAnimKey,
  enemyHeight,
  enemyMaskTexture,
  type SpriteEnemyKind,
} from './enemyAssets';

/**
 * How an enemy looks and moves on screen, apart from how it fights (`InvaderEnemy`).
 * Kinds with Blender sprites animate; the rest are still colored blocks.
 */
export interface EnemyLook {
  readonly object: Phaser.GameObjects.GameObject;
  /** Name tag height above the feet (negative = up). */
  readonly labelY: number;
  setFacing(facing: 1 | -1): void;
  /** Every frame: walking or standing, and whether it's warning of an attack. */
  update(now: number, moved: boolean, speed: number, preparing: boolean): void;
  windup(durationMs: number): void;
  strike(): void;
  /** Hit flash; `react` also plays the flinch (not for super armor). */
  hit(react: boolean): void;
  /** Knocked out. `unmask` (later levels) shows the person under the costume. */
  defeat(unmask: boolean): void;
}

const PREPARING_ALPHA = 0.35;

export class BlockEnemyLook implements EnemyLook {
  readonly object: Phaser.GameObjects.Rectangle;
  readonly labelY: number;
  private readonly color: number;
  private facing: 1 | -1 = -1;
  private flashing = false;

  constructor(scene: Phaser.Scene, width: number, height: number, color: number, leader: boolean) {
    this.color = color;
    this.object = scene.add.rectangle(0, -height / 2, width, height, color).setStrokeStyle(leader ? 3 : 2, 0xffffff, 0.4);
    this.labelY = -height - 18;
  }

  setFacing(facing: 1 | -1) {
    this.facing = facing;
    this.object.setScale(facing, 1);
  }

  update(_now: number, _moved: boolean, _speed: number, preparing: boolean) {
    if (this.flashing) return;
    this.object.setFillStyle(preparing ? 0xffffff : this.color, preparing ? PREPARING_ALPHA : 1);
    this.object.setScale(this.facing, 1);
  }

  windup() {}

  strike() {}

  hit() {
    this.flashing = true;
    this.object.setFillStyle(0xffffff);
    this.object.scene.time.delayedCall(80, () => {
      this.flashing = false;
    });
  }

  defeat() {
    this.object.setFillStyle(0x4b5563, 0.5);
  }
}

/** Holds the hurt/strike poses this long before walking or idling again (ms). */
const HOLD_MS = { hurt: 250, strike: 260 } as const;

export class SpriteEnemyLook implements EnemyLook {
  readonly object: Phaser.GameObjects.Sprite;
  readonly labelY: number;
  private holdUntil = 0;
  private flashUntil = 0;
  private down = false;
  private readonly scene: Phaser.Scene;
  private readonly kind: SpriteEnemyKind;
  private readonly container: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, kind: SpriteEnemyKind, container: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.kind = kind;
    this.container = container;
    this.object = scene.add
      .sprite(0, ENEMY_FEET_MARGIN * ENEMY_SPRITE_SCALE + 2, `${kind}-idle-strip`)
      .setOrigin(0.5, 1)
      .setScale(ENEMY_SPRITE_SCALE);
    this.object.play(enemyAnimKey(kind, 'idle'));
    this.labelY = -Math.round(enemyHeight(kind) * ENEMY_SPRITE_SCALE) - 14;
  }

  setFacing(facing: 1 | -1) {
    this.object.setFlipX(facing === -1);
  }

  update(now: number, moved: boolean, speed: number, preparing: boolean) {
    if (this.down) return;
    // Warning: blink white while it winds up, like the blocks did.
    if (now < this.flashUntil) this.object.setTintFill(0xffffff);
    else if (preparing && Math.floor(now / 90) % 2 === 0) this.object.setTintFill(0xfff7c2);
    else this.object.clearTint();

    if (preparing || now < this.holdUntil) return;
    if (moved) {
      // Feet match the ground: one 8-frame cycle per ENEMY_WALK_CYCLE_PX traveled.
      const frameRate = Phaser.Math.Clamp((8 * speed) / ENEMY_WALK_CYCLE_PX, 4, 14);
      if (this.object.anims.currentAnim?.key !== enemyAnimKey(this.kind, 'walk')) {
        this.object.play({ key: enemyAnimKey(this.kind, 'walk'), frameRate });
      }
    } else {
      this.object.play(enemyAnimKey(this.kind, 'idle'), true);
    }
  }

  windup(durationMs: number) {
    if (this.down) return;
    this.object.play({ key: enemyAnimKey(this.kind, 'windup'), duration: durationMs });
  }

  strike() {
    if (this.down) return;
    this.object.play(enemyAnimKey(this.kind, 'strike'));
    this.holdUntil = this.scene.time.now + HOLD_MS.strike;
  }

  hit(react: boolean) {
    if (this.down) return;
    this.flashUntil = this.scene.time.now + 80;
    if (!react) return;
    this.object.play(enemyAnimKey(this.kind, 'hurt'));
    this.holdUntil = this.scene.time.now + HOLD_MS.hurt;
  }

  defeat(unmask: boolean) {
    this.down = true;
    this.object.clearTint();
    this.object.play(enemyAnimKey(this.kind, unmask ? 'fall-unmasked' : 'fall'));
    if (unmask) this.tossMask();
  }

  /** The costume head pops off backward, spins and bounces on the floor. */
  private tossMask() {
    const { scene, container } = this;
    const facing = this.object.flipX ? -1 : 1;
    const headY = container.y + this.labelY + 40;
    const mask = scene.add
      .image(container.x, headY, enemyMaskTexture(this.kind))
      .setScale(ENEMY_SPRITE_SCALE)
      .setFlipX(facing === -1)
      .setDepth(container.y + 1);
    const landX = container.x - facing * Phaser.Math.Between(70, 110);
    const floorY = container.y - 18;
    scene.tweens.add({ targets: mask, x: landX, angle: -facing * 300, duration: 700, ease: 'Sine.easeOut' });
    scene.tweens.chain({
      targets: mask,
      tweens: [
        { y: headY - 70, duration: 260, ease: 'Quad.easeOut' },
        { y: floorY, duration: 440, ease: 'Bounce.easeOut' },
        { alpha: 0, delay: 1400, duration: 400, onComplete: () => mask.destroy() },
      ],
    });
  }
}
