import Phaser from 'phaser';
import { COMBAT } from '../config/combat';
import { DEBUG_HITBOXES } from '../config/debug';
import { ATTACKS_PER_TURN, ENEMY_KINDS, WAIT_DISTANCE, type EnemyKind, type EnemyProfile, type EnemyStats } from '../config/enemies';
import { COMBAT_TEAM } from '../combat/damageRules';
import { Combatant } from '../combat/Combatant';
import { createCenteredHitbox, drawHitboxOutline, hitboxesOverlap } from '../combat/overlap';
import type { EncounterActor, EnemyContext } from '../core/EncounterManager';
import type { Player } from '../player/Player';
import type { HitboxRect, HitInfo } from '../types/combat';
import { textStyle } from '../ui/theme';
import { applyDepthSort } from '../world/depthSort';
import { BODY_COLLISION, resolveBlockedMovement, type BodySnapshot } from '../world/bodyCollision';
import { clampToWalkLane, getWalkLaneForX } from '../world/walkLane';
import { PadelBall } from './PadelBall';
import { SmokeBomb } from './SmokeBomb';

type AiState = 'move' | 'windup' | 'dash' | 'recover' | 'aim' | 'stagger';

/** The container origin is at the feet, like the players', so same-depth bodies line up. */
const FEET_OFFSET = 0;
/** Matches the player hurtbox center (feet minus half the body) so same-depth attacks connect. */
const HIT_HEIGHT = 36;
/** How close (px) counts as "arrived" at an attack slot. */
const SLOT_TOLERANCE = { x: 14, y: 10 };
/** A slot holder that can't land an attack for this long gives its slot away. */
const SLOT_TIMEOUT_MS = 5000;
/** After giving its slot away, an enemy waits this long before asking again. */
const SLOT_REST_MS = 1200;
/** Hits interrupt a windup (unless the enemy has super armor) and stun it this long. */
const HITSTUN_MS = 280;
const BLOCK_POPUP_MS = 400;
/** To reach the far side of its target, an enemy first steps this far off the target's lane. */
const CROSSING_OFFSET_Y = 70;

/**
 * Every regular enemy. The `kind` picks stats and behavior (see `config/enemies.ts`):
 * - melee: takes an attack slot beside its target, winds up, hits. Others wait around.
 * - dasher: takes a slot farther away and dashes through the target.
 * - ranged: keeps its distance on the target's lane and serves padel balls.
 * - zone: keeps its distance and lobs smoke bombs where the target stands.
 */
export class InvaderEnemy implements EncounterActor {
  readonly container: Phaser.GameObjects.Container;
  readonly combatant: Combatant;
  readonly team = COMBAT_TEAM.enemy;
  readonly kind: EnemyKind;

  private readonly scene: Phaser.Scene;
  private readonly context: EnemyContext;
  private readonly profile: EnemyProfile;
  private readonly body: Phaser.GameObjects.Rectangle;
  private readonly shield?: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;
  private telegraph?: Phaser.GameObjects.Graphics;
  private readonly hitboxDebug?: Phaser.GameObjects.Graphics;

  private state: AiState = 'move';
  private stateStartedAt = 0;
  private stateDurationMs = 0;
  private target: Player | null = null;
  private facing: 1 | -1 = -1;
  private active = true;
  private cooldownUntil = 0;

  /** Melee slot bookkeeping. */
  private hasSlot = false;
  private slotSide: 1 | -1 = 1;
  private slotSince = 0;
  private slotRestUntil = 0;
  private attacksThisTurn = 0;
  /** Each enemy waits at its own spot so a crowd spreads out. */
  private readonly waitOffsetX = Phaser.Math.Between(0, 90);
  private readonly waitOffsetY = Phaser.Math.Between(-60, 60);

  private dashDirection: 1 | -1 = 1;
  private dashTraveled = 0;
  private readonly dashHitPlayers = new Set<Player>();
  private aimLaneY = 0;
  private lastBlockPopupAt = 0;
  /** When the target got behind a shielded enemy (it turns around only after `turnDelayMs`). */
  private behindSince: number | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    kind: EnemyKind,
    context: EnemyContext,
    onDefeated?: () => void,
    overrides?: Partial<EnemyStats>,
    scale = 1,
  ) {
    this.scene = scene;
    this.kind = kind;
    this.context = context;
    const base = ENEMY_KINDS[kind];
    this.profile = {
      ...base,
      ...overrides,
      maxHealth: Math.round((overrides?.maxHealth ?? base.maxHealth) * scale),
      attackDamage: Math.round((overrides?.attackDamage ?? base.attackDamage) * scale),
    };
    const { width, height } = this.profile.body;
    const isLeader = kind === 'miniBoss';

    this.container = scene.add.container(x, y);
    this.body = scene.add
      .rectangle(0, FEET_OFFSET - height / 2, width, height, this.profile.color)
      .setStrokeStyle(isLeader ? 3 : 2, 0xffffff, 0.4);
    this.label = scene.add
      .text(0, FEET_OFFSET - height - 18, this.profile.label, textStyle(isLeader ? 'bodySmall' : 'label', { color: '#ffffff' }))
      .setOrigin(0.5);
    this.container.add([this.body, this.label]);
    if (this.profile.shield) {
      this.shield = scene.add.rectangle(0, FEET_OFFSET - height / 2, 8, height + 6, 0x93c5fd, 0.9);
      this.container.add(this.shield);
    }
    applyDepthSort(this.container, y);

    this.combatant = new Combatant(this.profile.maxHealth, undefined, () => {
      this.markDefeated();
      onDefeated?.();
    });

    if (DEBUG_HITBOXES) this.hitboxDebug = scene.add.graphics();
  }

  get position() {
    return this.container;
  }

  get isActive() {
    return this.active && !this.combatant.isDefeated;
  }

  get blocksBodies() {
    return this.state !== 'dash';
  }

  /** Which side of its target this enemy attacks from, while it holds a slot. */
  get attackSide(): { target: Player | null; side: 1 | -1 } | null {
    return this.hasSlot ? { target: this.target, side: this.slotSide } : null;
  }

  getBodySnapshot(): BodySnapshot {
    return { x: this.container.x, y: this.container.y, radius: this.profile.body.width / 2 };
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
      this.container.y - this.profile.body.height / 2,
      this.profile.body.width + COMBAT.hurtboxPadding,
      this.profile.body.height + COMBAT.hurtboxPadding,
    );
  }

  update(now: number, deltaSeconds: number, players: Player[], bodyBlockers: BodySnapshot[]) {
    if (!this.isActive) return;
    const living = players.filter((player) => player.isAlive);
    if (living.length === 0) return;

    // Keep the same target while attacking it; otherwise go for whoever is closest.
    if (!this.target || !this.target.isAlive || (!this.hasSlot && this.state === 'move')) {
      this.target = this.nearest(living);
    }
    const target = this.target;
    this.telegraph?.clear();

    switch (this.profile.role) {
      case 'melee':
      case 'dasher':
        this.updateMelee(now, deltaSeconds, target, living, bodyBlockers);
        break;
      case 'ranged':
      case 'zone':
        this.updateRanged(now, deltaSeconds, target, bodyBlockers);
        break;
    }

    this.updateFacing(now, target);
    this.updateVisuals();
    this.drawDebug();
  }

  /** Shields block melee from the front; everything else takes normal damage. */
  receiveHit(amount: number, now: number, info: HitInfo) {
    if (!this.isActive) return false;
    if (this.profile.shield && info.kind === 'melee') {
      const fromSide = Math.sign(info.attackerX - this.container.x);
      if (fromSide === this.facing) {
        this.popup('¡BLOQUEADO!', now);
        return false;
      }
    }
    return this.combatant.takeDamage(amount, now);
  }

  onHit(now: number) {
    if (!this.isActive) return;
    this.body.setFillStyle(0xffffff);
    this.scene.time.delayedCall(80, () => {
      if (this.isActive) this.updateVisuals();
    });
    this.combatant.invulnerableUntil = now + 120;
    if (this.profile.superArmor) return;

    this.scene.tweens.add({
      targets: this.container,
      x: this.container.x - this.facing * 10,
      duration: 80,
      yoyo: true,
    });
    // Getting hit interrupts an attack being prepared.
    if (this.state === 'windup' || this.state === 'aim') this.enter('recover', now, HITSTUN_MS);
  }

  /** A ball this enemy served was returned and hit it. */
  onBallReturned(now: number) {
    if (!this.isActive) return;
    const damage = this.profile.ranged?.returnDamage ?? 10;
    this.combatant.invulnerableUntil = 0;
    this.combatant.takeDamage(damage, now);
    this.onHit(now);
    if (this.isActive) this.enter('stagger', now, 800);
  }

  destroy() {
    this.active = false;
    this.releaseSlot();
    this.telegraph?.destroy();
    this.hitboxDebug?.destroy();
    this.container.destroy();
  }

  markDefeated() {
    // Check the flag, not isActive: health is already 0 when the combatant reports defeat.
    if (!this.active) return;
    this.active = false;
    this.releaseSlot();
    this.telegraph?.clear();
    this.hitboxDebug?.clear();
    this.shield?.setVisible(false);
    this.label.setText('Derrotado');
    this.body.setFillStyle(0x4b5563, 0.5);
    this.scene.tweens.add({ targets: this.container, alpha: 0.25, duration: 250 });
  }

  // --- Melee and dash -------------------------------------------------------------------------

  private updateMelee(now: number, deltaSeconds: number, target: Player, living: Player[], blockers: BodySnapshot[]) {
    switch (this.state) {
      case 'windup':
        if (this.elapsed(now) < this.stateDurationMs) return;
        this.attacksThisTurn += 1;
        this.cooldownUntil = now + this.profile.attackCooldownMs;
        if (this.profile.role === 'dasher') {
          this.dashDirection = this.facing;
          this.dashTraveled = 0;
          this.dashHitPlayers.clear();
          this.enter('dash', now, 0);
        } else {
          this.strike(now, living);
          this.enter('recover', now, 260);
        }
        return;
      case 'dash':
        this.updateDash(now, deltaSeconds, living);
        return;
      case 'recover':
      case 'stagger':
        if (this.elapsed(now) < this.stateDurationMs) return;
        if (this.attacksThisTurn >= ATTACKS_PER_TURN) this.releaseSlot(now);
        this.enter('move', now, 0);
        return;
      default:
        break;
    }

    if (!this.hasSlot && now >= this.slotRestUntil && this.context.requestAttackSlot(this)) {
      this.hasSlot = true;
      this.slotSince = now;
      this.attacksThisTurn = 0;
      this.slotSide = this.pickSlotSide(target);
    }

    if (!this.hasSlot) {
      // Wait around the target, out of the way, until a slot frees up.
      const side = (Math.sign(this.container.x - target.x) || 1) as 1 | -1;
      const waitX = this.clampToArena(target.x + side * (WAIT_DISTANCE + this.waitOffsetX));
      this.walkToward(waitX, target.y + this.waitOffsetY, this.profile.moveSpeed * 0.6, deltaSeconds, blockers);
      return;
    }

    if (now - this.slotSince > SLOT_TIMEOUT_MS) {
      this.releaseSlot(now);
      return;
    }

    let slotX = target.x + this.slotSide * this.profile.reach;
    if (slotX !== this.clampToArena(slotX)) {
      this.slotSide = (-this.slotSide) as 1 | -1;
      slotX = target.x + this.slotSide * this.profile.reach;
    }
    // Slot on the other side: go around the target (off its lane) instead of through it.
    const crossing = Math.sign(this.container.x - target.x) === -this.slotSide && Math.abs(this.container.x - target.x) > 8;
    if (crossing) {
      const detourY = target.y + this.detourSign() * CROSSING_OFFSET_Y;
      this.walkToward(slotX, detourY, this.profile.moveSpeed, deltaSeconds, blockers);
      return;
    }
    const dx = slotX - this.container.x;
    const dy = target.y - this.container.y;
    const arrived = Math.abs(dx) <= SLOT_TOLERANCE.x && Math.abs(dy) <= SLOT_TOLERANCE.y;
    // A player who walks right up to a melee enemy gets hit without it repositioning.
    const inReach =
      this.profile.role === 'melee' &&
      Math.abs(target.x - this.container.x) <= this.profile.reach + 10 &&
      Math.abs(dy) <= SLOT_TOLERANCE.y * 2;

    // A shielded enemy doesn't attack behind its back: it has to turn around first.
    if ((arrived || inReach) && now >= this.cooldownUntil && this.isFacing(target)) {
      this.face(target.x);
      this.enter('windup', now, this.profile.attackWindupMs);
      return;
    }
    this.walkToward(slotX, target.y, this.profile.moveSpeed, deltaSeconds, blockers);
  }

  private strike(now: number, living: Player[]) {
    const box = this.attackHitbox();
    for (const player of living) {
      if (player.isInvulnerable(now)) continue;
      if (!hitboxesOverlap(box, player.hurtbox, COMBAT.depthTolerance)) continue;
      player.takeDamage(this.profile.attackDamage, now);
    }
  }

  private updateDash(now: number, deltaSeconds: number, living: Player[]) {
    const dash = this.profile.dash;
    if (!dash) return;
    const step = dash.speed * deltaSeconds;
    const nextX = this.container.x + this.dashDirection * step;
    const clamped = this.clampToArena(nextX);
    this.setWorldPosition(clamped, this.container.y);
    this.dashTraveled += step;

    for (const player of living) {
      if (this.dashHitPlayers.has(player) || player.isInvulnerable(now)) continue;
      if (Math.abs(player.x - this.container.x) > this.profile.body.width / 2 + 18) continue;
      if (Math.abs(player.y - this.container.y) > COMBAT.depthTolerance) continue;
      this.dashHitPlayers.add(player);
      player.takeDamage(this.profile.attackDamage, now);
    }

    if (this.dashTraveled >= dash.distance || clamped !== nextX) {
      // Ends on the far side: next time it attacks from there.
      this.slotSide = (-this.slotSide) as 1 | -1;
      this.enter('recover', now, 500);
    }
  }

  private pickSlotSide(target: Player): 1 | -1 {
    const preferred = (Math.sign(this.container.x - target.x) || 1) as 1 | -1;
    return this.context.isSideTaken(target, preferred, this) ? ((-preferred) as 1 | -1) : preferred;
  }

  private releaseSlot(now?: number) {
    if (!this.hasSlot) return;
    this.hasSlot = false;
    this.attacksThisTurn = 0;
    this.context.releaseAttackSlot(this);
    if (now !== undefined) this.slotRestUntil = now + SLOT_REST_MS;
  }

  private attackHitbox(): HitboxRect {
    const reach = this.profile.reach;
    return createCenteredHitbox(
      this.container.x + this.facing * (reach / 2 + 5),
      this.container.y - HIT_HEIGHT,
      reach + 10,
      40,
    );
  }

  // --- Ranged (balls) and zone (smoke) ---------------------------------------------------------

  private updateRanged(now: number, deltaSeconds: number, target: Player, blockers: BodySnapshot[]) {
    if (this.state === 'aim' || this.state === 'windup') {
      if (this.profile.role === 'ranged') this.drawAimLane();
      if (this.elapsed(now) < this.stateDurationMs) return;
      this.fire(now, target);
      this.cooldownUntil = now + this.profile.attackCooldownMs;
      this.enter('recover', now, 300);
      return;
    }
    if (this.state === 'recover' || this.state === 'stagger') {
      if (this.elapsed(now) >= this.stateDurationMs) this.enter('move', now, 0);
      return;
    }

    const retreatBelow = this.profile.ranged?.retreatBelow ?? 160;
    let side = (Math.sign(this.container.x - target.x) || 1) as 1 | -1;
    let desiredX = target.x + side * this.profile.reach;
    if (desiredX !== this.clampToArena(desiredX)) {
      side = (-side) as 1 | -1;
      desiredX = target.x + side * this.profile.reach;
    }
    desiredX = this.clampToArena(desiredX);
    const distance = Math.abs(target.x - this.container.x);
    const speed = distance < retreatBelow ? this.profile.moveSpeed * 1.3 : this.profile.moveSpeed;
    // Ranged lines up on the target's lane; zone only needs to keep its distance.
    const desiredY = this.profile.role === 'ranged' ? target.y : this.container.y;
    this.walkToward(desiredX, desiredY, speed, deltaSeconds, blockers);

    if (now < this.cooldownUntil || distance < retreatBelow * 0.8) return;
    const aligned = this.profile.role === 'zone' || Math.abs(target.y - this.container.y) <= 14;
    const inRange = Math.abs(distance - this.profile.reach) <= 140;
    if (!aligned || !inRange) return;

    this.face(target.x);
    this.aimLaneY = this.container.y;
    this.enter(this.profile.role === 'ranged' ? 'aim' : 'windup', now, this.profile.attackWindupMs);
  }

  private fire(now: number, target: Player) {
    if (this.profile.role === 'ranged' && this.profile.ranged) {
      this.context.addActor(
        new PadelBall(
          this.scene,
          this.container.x + this.facing * (this.profile.body.width / 2 + 12),
          this.container.y,
          this.facing,
          { serve: this.profile.ranged.ballSpeed, return: this.profile.ranged.ballSpeed * 1.4 },
          this.profile.attackDamage,
          this.context.arena,
          this,
        ),
      );
      return;
    }
    if (this.profile.smoke) {
      this.context.addActor(
        new SmokeBomb(this.scene, target.x, target.y, { ...this.profile.smoke, damage: this.profile.attackDamage }, now),
      );
    }
  }

  private drawAimLane() {
    if (!this.telegraph) this.telegraph = this.scene.add.graphics();
    const length = 520;
    const from = this.container.x;
    const to = this.clampToArena(from + this.facing * length);
    const alpha = Math.floor(this.scene.time.now / 110) % 2 === 0 ? 0.5 : 0.2;
    this.telegraph.fillStyle(0xef4444, alpha);
    this.telegraph.fillRect(Math.min(from, to), this.aimLaneY - 4, Math.abs(to - from), 8);
    this.telegraph.setDepth(this.aimLaneY - 30);
  }

  // --- Shared helpers ---------------------------------------------------------------------------

  private enter(state: AiState, now: number, durationMs: number) {
    this.state = state;
    this.stateStartedAt = now;
    this.stateDurationMs = durationMs;
  }

  private elapsed(now: number) {
    return now - this.stateStartedAt;
  }

  /**
   * Turn toward the target. Not while attacking. Shielded enemies are slow to turn:
   * that delay is the window to hit them from behind.
   */
  private updateFacing(now: number, target: Player) {
    if (this.state === 'dash' || this.state === 'windup' || this.state === 'aim') return;
    const turnDelay = this.profile.turnDelayMs;
    if (!turnDelay) {
      this.face(target.x);
      return;
    }
    if (this.state === 'recover' || this.isFacing(target)) {
      this.behindSince = this.isFacing(target) ? null : this.behindSince;
      return;
    }
    this.behindSince ??= now;
    if (now - this.behindSince >= turnDelay) {
      this.face(target.x);
      this.behindSince = null;
    }
  }

  private isFacing(target: Player) {
    const side = Math.sign(target.x - this.container.x);
    return side === 0 || side === this.facing;
  }

  private face(x: number) {
    if (Math.abs(x - this.container.x) < 4) return;
    this.facing = x > this.container.x ? 1 : -1;
  }

  private clampToArena(x: number) {
    const half = this.profile.body.width / 2;
    return Phaser.Math.Clamp(x, this.context.arena.minX + half, this.context.arena.maxX - half);
  }

  private walkToward(x: number, y: number, speed: number, deltaSeconds: number, blockers: BodySnapshot[]) {
    const dx = x - this.container.x;
    const dy = y - this.container.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 3) return;
    const step = Math.min(distance, speed * deltaSeconds);
    const self = this.getBodySnapshot();
    let resolved = resolveBlockedMovement(
      self,
      this.container.x + (dx / distance) * step,
      this.container.y + (dy / distance) * step,
      blockers,
      BODY_COLLISION.depthRatio,
    );
    // Blocked by other bodies: slide up or down the lane to get around them.
    if (Math.hypot(resolved.x - self.x, resolved.y - self.y) < step * 0.3) {
      for (const sign of [this.detourSign(), -this.detourSign()]) {
        const detour = resolveBlockedMovement(self, self.x, self.y + sign * step, blockers, BODY_COLLISION.depthRatio);
        if (Math.abs(detour.y - self.y) > step * 0.5) {
          resolved = detour;
          break;
        }
      }
    }
    this.setWorldPosition(resolved.x, resolved.y);
  }

  /** Which way (up or down the lane) this enemy goes around obstacles; stays consistent. */
  private detourSign(): 1 | -1 {
    const lane = getWalkLaneForX(this.container.x);
    // Near the edge of the walk lane there's only room on one side.
    if (this.container.y - CROSSING_OFFSET_Y < lane.minY) return 1;
    if (this.container.y + CROSSING_OFFSET_Y > lane.maxY) return -1;
    return this.waitOffsetY >= 0 ? 1 : -1;
  }

  private nearest(players: Player[]) {
    return players.reduce((best, player) =>
      Phaser.Math.Distance.Between(this.container.x, this.container.y, player.x, player.y) <
      Phaser.Math.Distance.Between(this.container.x, this.container.y, best.x, best.y)
        ? player
        : best,
    );
  }

  private updateVisuals() {
    const preparing = this.state === 'windup' || this.state === 'aim';
    this.body.setFillStyle(preparing ? 0xffffff : this.profile.color, preparing ? 0.35 : 1);
    this.body.setScale(this.facing, 1);
    this.shield?.setX(this.facing * (this.profile.body.width / 2 + 6));
  }

  private popup(text: string, now: number) {
    if (now - this.lastBlockPopupAt < BLOCK_POPUP_MS) return;
    this.lastBlockPopupAt = now;
    const popup = this.scene.add
      .text(this.container.x, this.container.y - this.profile.body.height - 20, text, textStyle('label', { color: '#93c5fd' }))
      .setOrigin(0.5)
      .setDepth(15_000);
    this.scene.tweens.add({ targets: popup, y: popup.y - 36, alpha: 0, duration: 600, onComplete: () => popup.destroy() });
  }

  private drawDebug() {
    if (!this.hitboxDebug) return;
    this.hitboxDebug.clear();
    if (!this.isActive || this.state !== 'windup' || this.profile.role !== 'melee') return;
    drawHitboxOutline(this.hitboxDebug, this.attackHitbox(), 0x00ff00);
    this.hitboxDebug.setDepth(this.container.y + 900);
  }
}
