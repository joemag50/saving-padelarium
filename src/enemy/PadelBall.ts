import Phaser from 'phaser';
import { COMBAT_TEAM } from '../combat/damageRules';
import { Combatant } from '../combat/Combatant';
import { createCenteredHitbox } from '../combat/overlap';
import type { EncounterActor } from '../core/EncounterManager';
import type { Player } from '../player/Player';
import type { HitboxRect, HitInfo } from '../types/combat';
import { applyDepthSort } from '../world/depthSort';

type BallTarget = {
  /** The shooter's feet, used to tell when a returned ball reaches it. */
  readonly position: { x: number; y: number };
  readonly hurtbox: HitboxRect;
  onBallReturned(now: number): void;
};

/** Ball height above the floor, so it reads as flying at chest level. */
const FLIGHT_HEIGHT = 44;
/** How close (feet to feet) the ball must pass to hit a player. */
const HIT_REACH = { x: 30, y: 30 };

/**
 * The boss's serve. Flies along one depth lane; a player's swing sends it back,
 * and a returned ball that reaches the boss stuns it.
 */
export class PadelBall implements EncounterActor {
  readonly team = COMBAT_TEAM.enemy;
  readonly blocksBodies = false;
  readonly combatant = new Combatant(1);
  private readonly container: Phaser.GameObjects.Container;
  private readonly ball: Phaser.GameObjects.Arc;
  private readonly speed: { serve: number; return: number };
  private readonly damage: number;
  private readonly arena: { minX: number; maxX: number };
  private readonly boss: BallTarget;
  private velocityX: number;
  private returned = false;
  private alive = true;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    direction: 1 | -1,
    speed: { serve: number; return: number },
    damage: number,
    arena: { minX: number; maxX: number },
    boss: BallTarget,
  ) {
    this.speed = speed;
    this.damage = damage;
    this.arena = arena;
    this.boss = boss;
    this.velocityX = direction * speed.serve;
    this.container = scene.add.container(x, y);
    const shadow = scene.add.ellipse(0, 0, 22, 8, 0x000000, 0.35);
    this.ball = scene.add.circle(0, -FLIGHT_HEIGHT, 11, 0xd9f99d).setStrokeStyle(3, 0x65a30d);
    this.container.add([shadow, this.ball]);
    applyDepthSort(this.container, y);
  }

  get position() {
    return this.container;
  }

  get isActive() {
    return this.alive;
  }

  /** Sits around the flying ball so a normal swing at the same depth catches it. */
  get hurtbox(): HitboxRect {
    return createCenteredHitbox(this.container.x, this.container.y - 36, 52, 64);
  }

  getBodySnapshot() {
    return { x: this.container.x, y: this.container.y, radius: 0 };
  }

  setWorldPosition() {}

  update(now: number, deltaSeconds: number, players: Player[]) {
    if (!this.alive) return;
    this.container.x += this.velocityX * deltaSeconds;
    this.ball.rotation += deltaSeconds * 12;

    if (this.container.x < this.arena.minX - 60 || this.container.x > this.arena.maxX + 60) {
      this.destroy();
      return;
    }

    if (this.returned) {
      const feet = this.boss.position;
      const halfWidth = this.boss.hurtbox.width / 2;
      if (Math.abs(this.container.x - feet.x) <= halfWidth && Math.abs(this.container.y - feet.y) <= 36) {
        this.boss.onBallReturned(now);
        this.destroy();
      }
      return;
    }

    for (const player of players) {
      if (!player.isAlive || player.isInvulnerable(now)) continue;
      if (Math.abs(player.x - this.container.x) > HIT_REACH.x) continue;
      if (Math.abs(player.y - this.container.y) > HIT_REACH.y) continue;
      // A ball that doesn't hurt (debug invincibility) flies on, so it can still be returned.
      if (!player.takeDamage(this.damage, now)) continue;
      this.destroy();
      return;
    }
  }

  /** A swing (or the pair special) sends a served ball back toward the boss. */
  receiveHit(_amount: number, _now: number, _info: HitInfo) {
    if (this.returned || !this.alive) return false;
    this.returned = true;
    const towardBoss = Math.sign(this.boss.position.x - this.container.x) || 1;
    this.velocityX = towardBoss * this.speed.return;
    this.ball.setFillStyle(0xfde047).setStrokeStyle(3, 0xffffff);
    return true;
  }

  onHit() {}

  destroy() {
    if (!this.alive) return;
    this.alive = false;
    this.container.destroy();
  }
}
