import Phaser from 'phaser';
import { PLAYER } from '../config/constants';
import { DEBUG_HITBOXES, debugState } from '../config/debug';
import { COMBAT } from '../config/combat';
import { COMBAT_TEAM, isEnemyTarget } from '../combat/damageRules';
import { Combatant } from '../combat/Combatant';
import { createCenteredHitbox, drawHitboxOutline, hitboxesOverlap } from '../combat/overlap';
import { applyHit, type CombatTarget, type HitboxRect, type MovementBounds } from '../types/combat';
import type { PlayerConfig } from '../types/player';
import { soundManager } from '../systems/soundManager';
import { textStyle } from '../ui/theme';
import { applyDepthSort } from '../world/depthSort';
import { clampToWalkLane, getWalkLaneForX } from '../world/walkLane';
import { BODY_COLLISION, resolveBlockedMovement, type BodySnapshot } from '../world/bodyCollision';
import { HERO_ANIMS, HERO_DISPLAY, HERO_TEXTURES } from './heroAssets';
import type { MovementVector } from './PlayerInput';

type PlayerUpdateOptions = {
  now: number;
  deltaSeconds: number;
  movement: MovementVector;
  speed: number;
  attackPressed: boolean;
  dodgePressed: boolean;
  bounds: MovementBounds;
  targets: CombatTarget[];
  bodyBlockers: BodySnapshot[];
};

export class Player {
  readonly container: Phaser.GameObjects.Container;
  readonly combatant: Combatant;
  readonly index: PlayerConfig['index'];
  readonly displayName: string;
  readonly team = COMBAT_TEAM.hero;

  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly tintColor: number;
  private facing: 1 | -1 = 1;
  private isAttacking = false;
  private isDodging = false;
  private attackElapsedMs = 0;
  private dodgeElapsedMs = 0;
  private attackCooldownUntil = 0;
  private dodgeCooldownUntil = 0;
  private attackHitRegistered = false;
  private dodgeDirection: MovementVector = { x: 1, y: 0 };
  private down = false;
  /** Held by an abduction beam: can't move, attack or dodge until released. */
  private captured = false;
  private readonly scene: Phaser.Scene;
  private readonly hurtboxDebug?: Phaser.GameObjects.Graphics;
  private movementBounds: MovementBounds | null = null;

  constructor(
    scene: Phaser.Scene,
    config: PlayerConfig,
    onHealthChanged?: (current: number, max: number) => void,
    onDown?: () => void,
  ) {
    this.scene = scene;
    this.index = config.index;
    this.displayName = config.name;
    this.tintColor = config.color;

    this.container = scene.add.container(config.spawnX, config.spawnY);
    this.sprite = scene.add
      .sprite(0, HERO_DISPLAY.footY, HERO_TEXTURES.idle)
      .setOrigin(0.5, 1)
      .setScale(HERO_DISPLAY.scale)
      .setTint(config.color);

    const label = scene.add
      .text(0, -58, config.name, textStyle('bodySmall', {
        color: '#ffffff',
      }))
      .setOrigin(0.5);

    this.container.add([this.sprite, label]);
    this.sprite.play(HERO_ANIMS.idle);
    applyDepthSort(this.container, this.container.y);

    this.combatant = new Combatant(COMBAT.playerMaxHealth, onHealthChanged, () => {
      this.setCaptured(false);
      this.down = true;
      this.sprite.setAlpha(0.45);
      this.sprite.play(HERO_ANIMS.fall);
      onDown?.();
    });

    if (DEBUG_HITBOXES) {
      this.hurtboxDebug = scene.add.graphics();
    }
  }

  get x() {
    return this.container.x;
  }

  get y() {
    return this.container.y;
  }

  get position() {
    return this.container;
  }

  get isAlive() {
    return !this.down && !this.combatant.isDefeated;
  }

  getBodySnapshot(): BodySnapshot {
    return {
      x: this.container.x,
      y: this.container.y,
      radius: BODY_COLLISION.playerRadius,
    };
  }

  setWorldPosition(x: number, y: number) {
    const minX = this.movementBounds?.minX ?? x;
    const maxX = this.movementBounds?.maxX ?? x;
    const nextX = Phaser.Math.Clamp(x, minX, maxX);
    const lane = getWalkLaneForX(nextX);
    const nextY = clampToWalkLane(y, lane);
    this.container.setPosition(nextX, nextY);
    applyDepthSort(this.container, nextY);
  }

  get hurtbox(): HitboxRect {
    return createCenteredHitbox(
      this.container.x,
      this.container.y - PLAYER.bodyHeight / 2,
      PLAYER.bodyWidth + COMBAT.hurtboxPadding,
      PLAYER.bodyHeight + COMBAT.hurtboxPadding,
    );
  }

  isInvulnerable(now: number) {
    return this.isDodging || this.combatant.isInvulnerable(now);
  }

  get isCaptured() {
    return this.captured;
  }

  setCaptured(captured: boolean) {
    if (this.captured === captured) return;
    this.captured = captured;
    this.isAttacking = false;
    this.isDodging = false;
    this.sprite.setY(HERO_DISPLAY.footY - (captured ? 28 : 0));
    if (captured) {
      this.sprite.setTint(0x67e8f9);
    } else if (this.isAlive) {
      this.sprite.setTint(this.tintColor);
    }
  }

  resetForEncounter(x: number, y: number) {
    this.setCaptured(false);
    this.down = false;
    this.isAttacking = false;
    this.isDodging = false;
    this.sprite.setAlpha(1);
    this.sprite.clearTint();
    this.sprite.setTint(this.tintColor);
    this.container.setPosition(x, y);
    applyDepthSort(this.container, y);
    this.combatant.reset();
    this.sprite.play(HERO_ANIMS.idle);
  }

  /** Between fights: heal the living and get a downed partner back on their feet. */
  recoverBetweenEncounters(healAmount: number) {
    if (this.isAlive) {
      this.combatant.heal(healAmount);
    } else {
      this.resetForEncounter(this.x, this.y);
    }
  }

  takeDamage(amount: number, now: number) {
    if (!this.isAlive || this.isInvulnerable(now) || debugState.invincible) return false;
    const hit = this.combatant.takeDamage(amount, now);
    if (hit) {
      soundManager.playPlayerHurt();
      this.sprite.setTint(0xff6b6b);
      this.scene.time.delayedCall(100, () => {
        if (this.isAlive) this.sprite.setTint(this.tintColor);
      });
    }
    return hit;
  }

  update(options: PlayerUpdateOptions): boolean {
    const {
      now,
      deltaSeconds,
      movement,
      speed,
      attackPressed,
      dodgePressed,
      bounds,
      targets,
      bodyBlockers,
    } = options;

    this.movementBounds = bounds;

    if (!this.isAlive || this.captured) {
      this.drawDebugHitboxes();
      return false;
    }

    if (dodgePressed && !this.isDodging && !this.isAttacking && now >= this.dodgeCooldownUntil) {
      this.startDodge(movement);
    }

    if (attackPressed && !this.isAttacking && !this.isDodging && now >= this.attackCooldownUntil) {
      this.startAttack();
    }

    let hitConnected = false;

    if (this.isDodging) {
      this.dodgeElapsedMs += deltaSeconds * 1000;
      this.updateDodge(deltaSeconds, bounds);
      if (this.dodgeElapsedMs >= COMBAT.dodgeDurationMs) {
        this.endDodge(now);
      }
    } else if (this.isAttacking) {
      this.attackElapsedMs += deltaSeconds * 1000;
      hitConnected = this.processAttack(now, targets);
      if (this.attackElapsedMs >= COMBAT.attackDurationMs) {
        this.endAttack(now);
      }
    } else {
      this.updateMovement(deltaSeconds, movement, speed, bounds, bodyBlockers);
    }

    this.updateAnimation(movement);
    this.drawDebugHitboxes();
    return hitConnected;
  }

  private drawDebugHitboxes() {
    if (!this.hurtboxDebug) return;

    this.hurtboxDebug.clear();
    drawHitboxOutline(this.hurtboxDebug, this.hurtbox, 0xff0000);

    if (this.isAttacking) {
      drawHitboxOutline(this.hurtboxDebug, this.getAttackHitbox(), 0x00ff00);
    }

    this.hurtboxDebug.setDepth(this.container.y + 900);
  }

  private startAttack() {
    this.isAttacking = true;
    this.attackElapsedMs = 0;
    this.attackHitRegistered = false;
    this.sprite.play(HERO_ANIMS.attack, true);
  }

  private endAttack(now: number) {
    this.isAttacking = false;
    this.attackCooldownUntil = now + COMBAT.attackCooldownMs;
  }

  private startDodge(movement: MovementVector) {
    this.isDodging = true;
    this.dodgeElapsedMs = 0;
    this.combatant.invulnerableUntil = performance.now() + COMBAT.dodgeDurationMs + 80;
    this.dodgeDirection =
      movement.x !== 0 || movement.y !== 0 ? movement : { x: this.facing, y: 0 };
  }

  private endDodge(now: number) {
    this.isDodging = false;
    this.dodgeCooldownUntil = now + COMBAT.dodgeCooldownMs;
  }

  private updateDodge(deltaSeconds: number, bounds: MovementBounds) {
    const speed = COMBAT.dodgeSpeed * deltaSeconds;
    const nextX = Phaser.Math.Clamp(
      this.container.x + this.dodgeDirection.x * speed,
      bounds.minX,
      bounds.maxX,
    );
    const nextY = Phaser.Math.Clamp(
      this.container.y + this.dodgeDirection.y * speed,
      getWalkLaneForX(this.container.x).minY,
      getWalkLaneForX(this.container.x).maxY,
    );
    this.container.setPosition(nextX, nextY);
    applyDepthSort(this.container, nextY);
  }

  private processAttack(now: number, targets: CombatTarget[]): boolean {
    const inActiveWindow =
      this.attackElapsedMs >= COMBAT.attackActiveStartMs &&
      this.attackElapsedMs <= COMBAT.attackActiveEndMs;

    if (!inActiveWindow || this.attackHitRegistered) return false;

    const hitbox = this.getAttackHitbox();
    for (const target of targets) {
      if (!isEnemyTarget(target)) continue;
      if (!target.isActive || target.combatant.isDefeated) continue;
      if (!hitboxesOverlap(hitbox, target.hurtbox, COMBAT.depthTolerance)) continue;
      const info = { attackerX: this.container.x, attackerIndex: this.index, kind: 'melee' as const };
      if (!applyHit(target, COMBAT.playerAttackDamage, now, info)) continue;
      target.onHit(now);
      this.attackHitRegistered = true;
      return true;
    }
    return false;
  }

  private getAttackHitbox() {
    const offsetX = this.facing * (PLAYER.bodyWidth / 2 + COMBAT.hitboxWidth / 2 - 6);
    return createCenteredHitbox(
      this.container.x + offsetX,
      this.container.y - PLAYER.bodyHeight / 2,
      COMBAT.hitboxWidth,
      COMBAT.hitboxHeight,
    );
  }

  private updateMovement(
    deltaSeconds: number,
    movement: MovementVector,
    speed: number,
    bounds: MovementBounds,
    bodyBlockers: BodySnapshot[],
  ) {
    if (movement.x === 0 && movement.y === 0) return;

    const desiredX = Phaser.Math.Clamp(
      this.container.x + movement.x * speed * deltaSeconds,
      bounds.minX,
      bounds.maxX,
    );
    const lane = getWalkLaneForX(this.container.x);
    const desiredY = Phaser.Math.Clamp(
      this.container.y + movement.y * speed * deltaSeconds,
      lane.minY,
      lane.maxY,
    );

    const resolved = resolveBlockedMovement(
      this.getBodySnapshot(),
      desiredX,
      desiredY,
      bodyBlockers,
      BODY_COLLISION.depthRatio,
    );

    this.setWorldPosition(resolved.x, resolved.y);

    if (movement.x < 0) this.facing = -1;
    if (movement.x > 0) this.facing = 1;
    this.sprite.setFlipX(this.facing === -1);
  }

  private updateAnimation(movement: MovementVector) {
    if (this.down) return;

    if (this.isAttacking) {
      return;
    }

    const moving = movement.x !== 0 || movement.y !== 0;
    const running = Math.abs(movement.x) > 0.5 && movement.y === 0;

    if (this.isDodging) {
      this.sprite.play(running ? HERO_ANIMS.run : HERO_ANIMS.walk, true);
      return;
    }

    if (moving) {
      this.sprite.play(running ? HERO_ANIMS.run : HERO_ANIMS.walk, true);
      return;
    }

    this.sprite.play(HERO_ANIMS.idle, true);
  }
}
