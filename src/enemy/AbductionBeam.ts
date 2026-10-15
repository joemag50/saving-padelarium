import Phaser from 'phaser';
import { COMBAT_TEAM } from '../combat/damageRules';
import { Combatant } from '../combat/Combatant';
import { createCenteredHitbox } from '../combat/overlap';
import type { EncounterActor } from '../core/EncounterManager';
import type { Player } from '../player/Player';
import type { HitboxRect } from '../types/combat';

export type BeamTuning = {
  telegraphMs: number;
  activeMs: number;
  radius: number;
  followSpeed: number;
  beamHealth: number;
  damagePerSecond: number;
  maxHoldMs: number;
};

const BEAM_COLOR = 0x67e8f9;
/** The floor circle is squashed to match the beat 'em up perspective. */
const FLOOR_SQUASH = 0.45;

/**
 * Phase 3 hazard. Marks the floor under a player, then lights up and drifts after them.
 * Whoever it catches is held in the air until a partner breaks the beam (or it gives up).
 */
export class AbductionBeam implements EncounterActor {
  readonly team = COMBAT_TEAM.enemy;
  readonly blocksBodies = false;
  readonly combatant = new Combatant(1);
  private readonly container: Phaser.GameObjects.Container;
  private readonly floor: Phaser.GameObjects.Ellipse;
  private readonly column: Phaser.GameObjects.Rectangle;
  private readonly scene: Phaser.Scene;
  private readonly target: Player;
  private readonly tuning: BeamTuning;
  private readonly createdAt: number;
  private health: number;
  private held: Player | null = null;
  private heldSince = 0;
  private alive = true;

  constructor(scene: Phaser.Scene, target: Player, tuning: BeamTuning, now: number) {
    this.scene = scene;
    this.target = target;
    this.tuning = tuning;
    this.createdAt = now;
    this.health = tuning.beamHealth;
    this.container = scene.add.container(target.x, target.y);
    const width = tuning.radius * 2;
    this.floor = scene.add
      .ellipse(0, 0, width, width * FLOOR_SQUASH, BEAM_COLOR, 0)
      .setStrokeStyle(3, BEAM_COLOR, 0.9);
    this.column = scene.add.rectangle(0, -170, width * 0.8, 340, BEAM_COLOR, 0.28).setVisible(false);
    this.container.add([this.column, this.floor]);
    // Drawn on the floor, under everyone standing on it.
    this.container.setDepth(target.y - 40);
  }

  get position() {
    return this.container;
  }

  get isActive() {
    return this.alive;
  }

  get hurtbox(): HitboxRect {
    return createCenteredHitbox(this.container.x, this.container.y - 36, this.tuning.radius * 2, 90);
  }

  getBodySnapshot() {
    return { x: this.container.x, y: this.container.y, radius: 0 };
  }

  setWorldPosition() {}

  update(now: number, deltaSeconds: number, players: Player[]) {
    if (!this.alive) return;
    const age = now - this.createdAt;

    if (age < this.tuning.telegraphMs) {
      // Warning: the outline grows and blinks before the beam turns on.
      const progress = age / this.tuning.telegraphMs;
      this.floor.setScale(0.4 + progress * 0.6);
      this.floor.setStrokeStyle(3, BEAM_COLOR, Math.floor(age / 120) % 2 === 0 ? 1 : 0.35);
      this.followTarget(deltaSeconds);
      return;
    }

    if (!this.column.visible) {
      this.column.setVisible(true);
      this.floor.setScale(1).setFillStyle(BEAM_COLOR, 0.35);
    }

    if (this.held) {
      this.updateHold(now, deltaSeconds);
      return;
    }

    if (age > this.tuning.telegraphMs + this.tuning.activeMs) {
      this.destroy();
      return;
    }

    this.followTarget(deltaSeconds);
    const free = players.filter((player) => player.isAlive && !player.isCaptured);
    const caught = free.find((player) => this.contains(player));
    // In co-op, never hold the last free player: someone must be able to break the beam.
    if (caught && players.length > 1 && free.length === 1) {
      caught.takeDamage(this.tuning.damagePerSecond * 2, now);
      this.destroy();
      return;
    }
    if (caught) {
      this.held = caught;
      this.heldSince = now;
      caught.setCaptured(true);
      this.container.setPosition(caught.x, caught.y);
    }
  }

  /** A partner's swing (or the special) damages the beam holding someone. */
  receiveHit() {
    if (!this.held || !this.alive) return false;
    this.health -= 1;
    this.column.setFillStyle(0xffffff, 0.5);
    this.scene.time.delayedCall(80, () => {
      if (this.alive) this.column.setFillStyle(BEAM_COLOR, 0.28);
    });
    if (this.health <= 0) this.destroy();
    return true;
  }

  onHit() {}

  destroy() {
    if (!this.alive) return;
    this.alive = false;
    this.held?.setCaptured(false);
    this.held = null;
    this.container.destroy();
  }

  private updateHold(now: number, deltaSeconds: number) {
    const held = this.held;
    if (!held) return;
    if (!held.isAlive || now - this.heldSince >= this.tuning.maxHoldMs) {
      this.destroy();
      return;
    }
    // Damage over time: rounded to whole points, applied about once per second.
    const tick = Math.floor((now - this.heldSince) / 1000);
    const previousTick = Math.floor((now - deltaSeconds * 1000 - this.heldSince) / 1000);
    if (tick > previousTick) {
      held.combatant.invulnerableUntil = 0;
      held.takeDamage(this.tuning.damagePerSecond, now);
    }
  }

  private followTarget(deltaSeconds: number) {
    if (!this.target.isAlive) return;
    const dx = this.target.x - this.container.x;
    const dy = this.target.y - this.container.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 1) return;
    const step = Math.min(distance, this.tuning.followSpeed * deltaSeconds);
    this.container.x += (dx / distance) * step;
    this.container.y += (dy / distance) * step;
    this.container.setDepth(this.container.y - 40);
  }

  private contains(player: Player) {
    const rx = this.tuning.radius;
    const ry = this.tuning.radius * FLOOR_SQUASH;
    const dx = (player.x - this.container.x) / rx;
    const dy = (player.y - this.container.y) / ry;
    return dx * dx + dy * dy <= 1;
  }
}
