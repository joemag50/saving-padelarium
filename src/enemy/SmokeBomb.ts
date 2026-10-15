import Phaser from 'phaser';
import { COMBAT_TEAM } from '../combat/damageRules';
import { Combatant } from '../combat/Combatant';
import { createCenteredHitbox } from '../combat/overlap';
import type { EncounterActor } from '../core/EncounterManager';
import type { Player } from '../player/Player';
import type { HitboxRect } from '../types/combat';

export type SmokeTuning = {
  telegraphMs: number;
  cloudMs: number;
  radius: number;
  tickMs: number;
  damage: number;
};

const SMOKE_COLOR = 0x9ca3af;
/** Matches the beat 'em up floor perspective. */
const FLOOR_SQUASH = 0.45;

/**
 * Thrown by the "Humero". The landing spot is marked first; then a cloud sits there
 * and hurts anyone standing inside it, once per tick.
 */
export class SmokeBomb implements EncounterActor {
  readonly team = COMBAT_TEAM.enemy;
  readonly blocksBodies = false;
  readonly combatant = new Combatant(1);
  private readonly container: Phaser.GameObjects.Container;
  private readonly floor: Phaser.GameObjects.Ellipse;
  private readonly tuning: SmokeTuning;
  private readonly createdAt: number;
  private lastTickAt = 0;
  private alive = true;

  constructor(scene: Phaser.Scene, x: number, y: number, tuning: SmokeTuning, now: number) {
    this.tuning = tuning;
    this.createdAt = now;
    this.container = scene.add.container(x, y);
    const width = tuning.radius * 2;
    this.floor = scene.add.ellipse(0, 0, width, width * FLOOR_SQUASH, SMOKE_COLOR, 0).setStrokeStyle(3, SMOKE_COLOR, 0.9);
    this.container.add(this.floor);
    // On the floor, under the actors standing in it.
    this.container.setDepth(y - 40);
  }

  get position() {
    return this.container;
  }

  get isActive() {
    return this.alive;
  }

  /** Not hittable: players can't punch smoke. */
  get hurtbox(): HitboxRect {
    return createCenteredHitbox(-10_000, -10_000, 0, 0);
  }

  getBodySnapshot() {
    return { x: this.container.x, y: this.container.y, radius: 0 };
  }

  setWorldPosition() {}

  receiveHit() {
    return false;
  }

  onHit() {}

  update(now: number, _deltaSeconds: number, players: Player[]) {
    if (!this.alive) return;
    const age = now - this.createdAt;
    const { telegraphMs, cloudMs, tickMs, damage } = this.tuning;

    if (age < telegraphMs) {
      const progress = age / telegraphMs;
      this.floor.setScale(0.4 + progress * 0.6);
      this.floor.setStrokeStyle(3, SMOKE_COLOR, Math.floor(age / 120) % 2 === 0 ? 1 : 0.35);
      return;
    }

    if (age > telegraphMs + cloudMs) {
      this.destroy();
      return;
    }

    // The cloud puffs up and thins out over its life.
    const life = (age - telegraphMs) / cloudMs;
    this.floor.setScale(1 + Math.sin(now / 160) * 0.05).setFillStyle(SMOKE_COLOR, 0.55 * (1 - life * 0.6));
    this.floor.setStrokeStyle(0, SMOKE_COLOR, 0);

    if (now - this.lastTickAt < tickMs) return;
    this.lastTickAt = now;
    for (const player of players) {
      if (player.isAlive && this.contains(player)) player.takeDamage(damage, now);
    }
  }

  destroy() {
    if (!this.alive) return;
    this.alive = false;
    this.container.destroy();
  }

  private contains(player: Player) {
    const rx = this.tuning.radius;
    const ry = rx * FLOOR_SQUASH;
    const dx = (player.x - this.container.x) / rx;
    const dy = (player.y - this.container.y) / ry;
    return dx * dx + dy * dy <= 1;
  }
}
