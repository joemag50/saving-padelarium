import Phaser from 'phaser';
import { COMBAT, ENEMY_BODY, ENEMY_STATS } from '../config/combat';
import { DEBUG_HITBOXES } from '../config/debug';
import { COMBAT_TEAM, isHeroTarget } from '../combat/damageRules';
import { Combatant } from '../combat/Combatant';
import { createCenteredHitbox, drawHitboxOutline, hitboxesOverlap } from '../combat/overlap';
import type { Player } from '../player/Player';
import type { CombatTarget, HitboxRect } from '../types/combat';
import { FONTS } from '../ui/theme';
import { applyDepthSort } from '../world/depthSort';
import {
  BODY_COLLISION,
  resolveBlockedMovement,
  type BodySnapshot,
} from '../world/bodyCollision';
import { clampToWalkLane, getWalkLaneForX } from '../world/walkLane';

type EnemyStats = (typeof ENEMY_STATS)[keyof typeof ENEMY_STATS];

const EnemyAiState = {
  Idle: 'idle',
  Chase: 'chase',
  Windup: 'windup',
  Attack: 'attack',
} as const;

type EnemyAiState = (typeof EnemyAiState)[keyof typeof EnemyAiState];

export class InvaderEnemy implements CombatTarget {
  readonly container: Phaser.GameObjects.Container;
  readonly combatant: Combatant;
  readonly team = COMBAT_TEAM.enemy;

  private readonly scene: Phaser.Scene;
  private readonly body: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;
  private readonly stats: EnemyStats;
  private readonly isMiniBoss: boolean;
  private aiState: EnemyAiState = EnemyAiState.Idle;
  private target: Player | null = null;
  private windupStartedAt = 0;
  private attackCooldownUntil = 0;
  private facing: 1 | -1 = -1;
  private active = true;
  private readonly hitboxDebug?: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    variant: 'basic' | 'miniBoss',
    onDefeated?: () => void,
  ) {
    this.scene = scene;
    this.stats = variant === 'miniBoss' ? ENEMY_STATS.miniBoss : ENEMY_STATS.basic;
    this.isMiniBoss = variant === 'miniBoss';

    this.container = scene.add.container(x, y);
    this.body = scene.add
      .rectangle(0, 0, ENEMY_BODY.width, ENEMY_BODY.height, this.stats.color)
      .setStrokeStyle(this.isMiniBoss ? 3 : 2, 0xffffff, 0.4);
    this.label = scene.add
      .text(0, -56, this.stats.label, {
        fontFamily: FONTS.ui,
        fontSize: this.isMiniBoss ? '16px' : '14px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.container.add([this.body, this.label]);
    applyDepthSort(this.container, y);

    this.combatant = new Combatant(this.stats.maxHealth, undefined, () => {
      this.markDefeated();
      onDefeated?.();
    });

    if (DEBUG_HITBOXES) {
      this.hitboxDebug = scene.add.graphics();
    }
  }

  get position() {
    return this.container;
  }

  get isActive() {
    return this.active && !this.combatant.isDefeated;
  }

  getBodySnapshot(): BodySnapshot {
    return {
      x: this.container.x,
      y: this.container.y,
      radius: BODY_COLLISION.enemyRadius,
    };
  }

  setWorldPosition(x: number, y: number) {
    const lane = getWalkLaneForX(x);
    const nextY = clampToWalkLane(y, lane);
    this.container.setPosition(x, nextY);
    applyDepthSort(this.container, nextY);
  }

  get hurtbox(): HitboxRect {
    return createCenteredHitbox(
      this.container.x,
      this.container.y,
      ENEMY_BODY.width + COMBAT.hurtboxPadding,
      ENEMY_BODY.height + COMBAT.hurtboxPadding,
    );
  }

  update(now: number, deltaSeconds: number, players: Player[], bodyBlockers: BodySnapshot[]) {
    if (!this.isActive) return;

    const livingPlayers = players.filter((player) => player.isAlive);
    if (livingPlayers.length === 0) return;

    this.target = this.pickNearestTarget(livingPlayers);
    if (!this.target) return;

    const distance = Phaser.Math.Distance.Between(
      this.container.x,
      this.container.y,
      this.target.x,
      this.target.y,
    );
    const depthDelta = Math.abs(this.container.y - this.target.y);

    switch (this.aiState) {
      case EnemyAiState.Idle:
      case EnemyAiState.Chase:
        if (now < this.attackCooldownUntil) {
          this.chase(deltaSeconds, bodyBlockers);
          break;
        }
        if (distance <= this.stats.attackRange && depthDelta <= COMBAT.depthTolerance) {
          this.aiState = EnemyAiState.Windup;
          this.windupStartedAt = now;
          this.body.setFillStyle(0xffffff, 0.25);
          break;
        }
        this.chase(deltaSeconds, bodyBlockers);
        break;
      case EnemyAiState.Windup:
        if (now - this.windupStartedAt >= this.stats.attackWindupMs) {
          this.aiState = EnemyAiState.Attack;
          this.tryDamagePlayer(now, livingPlayers);
          this.attackCooldownUntil = now + this.stats.attackCooldownMs;
          this.aiState = EnemyAiState.Chase;
          this.body.setFillStyle(this.stats.color);
        }
        break;
      case EnemyAiState.Attack:
        this.aiState = EnemyAiState.Chase;
        break;
    }

    if (this.target.x < this.container.x) this.facing = -1;
    if (this.target.x > this.container.x) this.facing = 1;
    this.body.setScale(this.facing, 1);
    this.drawDebugHitboxes();
  }

  private getAttackHitbox(): HitboxRect {
    return createCenteredHitbox(
      this.container.x + this.facing * 34,
      this.container.y,
      50,
      40,
    );
  }

  private drawDebugHitboxes() {
    if (!this.hitboxDebug) return;

    this.hitboxDebug.clear();
    if (!this.isActive || this.aiState !== EnemyAiState.Windup) return;

    drawHitboxOutline(this.hitboxDebug, this.getAttackHitbox(), 0x00ff00);
    this.hitboxDebug.setDepth(this.container.y + 900);
  }

  onHit(now: number) {
    if (!this.isActive) return;

    this.body.setFillStyle(0xffffff);
    this.scene.time.delayedCall(80, () => {
      if (this.isActive) this.body.setFillStyle(this.stats.color);
    });

    this.scene.tweens.add({
      targets: this.container,
      x: this.container.x + 10 * this.facing * -1,
      duration: 80,
      yoyo: true,
    });

    this.combatant.invulnerableUntil = now + 120;
  }

  markDefeated() {
    if (!this.isActive) return;
    this.active = false;
    this.hitboxDebug?.clear();
    this.label.setText('Defeated');
    this.body.setFillStyle(0x4b5563, 0.5);
    this.scene.tweens.add({ targets: this.container, alpha: 0.25, duration: 250 });
  }

  private pickNearestTarget(players: Player[]) {
    return players.reduce<Player | null>((nearest, player) => {
      if (!nearest) return player;
      const nearestDistance = Phaser.Math.Distance.Between(
        this.container.x,
        this.container.y,
        nearest.x,
        nearest.y,
      );
      const playerDistance = Phaser.Math.Distance.Between(
        this.container.x,
        this.container.y,
        player.x,
        player.y,
      );
      return playerDistance < nearestDistance ? player : nearest;
    }, null);
  }

  private chase(deltaSeconds: number, bodyBlockers: BodySnapshot[]) {
    if (!this.target) return;

    const dx = this.target.x - this.container.x;
    const dy = this.target.y - this.container.y;
    const length = Math.hypot(dx, dy) || 1;
    const speed = this.stats.moveSpeed * deltaSeconds;

    const desiredX = this.container.x + (dx / length) * speed;
    const desiredY = this.container.y + (dy / length) * speed;
    const resolved = resolveBlockedMovement(
      this.getBodySnapshot(),
      desiredX,
      desiredY,
      bodyBlockers,
      BODY_COLLISION.depthTolerance,
    );

    this.setWorldPosition(resolved.x, resolved.y);
  }

  private tryDamagePlayer(now: number, players: Player[]) {
    const attackBox = this.getAttackHitbox();

    for (const player of players) {
      if (!isHeroTarget(player)) continue;
      if (!player.isAlive || player.isInvulnerable(now)) continue;
      if (!hitboxesOverlap(attackBox, player.hurtbox, COMBAT.depthTolerance)) continue;
      player.takeDamage(this.stats.attackDamage, now);
    }
  }
}
