import Phaser from 'phaser';
import { FINAL_BOSS } from '../config/boss';
import { COMBAT } from '../config/combat';
import { DEBUG_HITBOXES } from '../config/debug';
import { COMBAT_TEAM } from '../combat/damageRules';
import { Combatant } from '../combat/Combatant';
import { createCenteredHitbox, drawHitboxOutline, hitboxesOverlap } from '../combat/overlap';
import type { BossContext, EncounterActor } from '../core/EncounterManager';
import type { Player } from '../player/Player';
import { soundManager } from '../systems/soundManager';
import type { HitboxRect, HitInfo } from '../types/combat';
import { textStyle } from '../ui/theme';
import { applyDepthSort } from '../world/depthSort';
import { clampToWalkLane, getWalkLaneForX } from '../world/walkLane';
import { AbductionBeam } from './AbductionBeam';
import { PadelBall } from './PadelBall';

type Phase = 1 | 2 | 3;

type BossState =
  | 'intro'
  | 'transition'
  | 'serveAim'
  | 'serveRest'
  | 'swipeWindup'
  | 'chargeAlign'
  | 'chargeTelegraph'
  | 'charging'
  | 'chargeRest'
  | 'stunned'
  | 'chase'
  | 'exhausted'
  | 'defeated';

const COLORS = {
  body: FINAL_BOSS.color,
  windup: 0xffffff,
  stunned: 0x818cf8,
  exhausted: 0x64748b,
  shield: 0x93c5fd,
  serveLane: 0xef4444,
  chargeLane: 0xfbbf24,
} as const;

const HINTS = {
  phase1: '¡Regresa sus pelotas con un golpe para aturdirlo!',
  phase2: '¡Tiene escudo! Golpéalo por la espalda, o haz que se estrelle con su embestida.',
  phase3Duo: '¡Cuidado con los rayos! Golpea el rayo para liberar a tu pareja.',
  phase3Solo: '¡Cuidado con los rayos abductores! Esquívalos.',
  finisher: '¡Está agotado! Usen el ESPECIAL DE EQUIPO para el golpe final.',
} as const;

const INTRO_MS = 1200;
/** Throttle for the "¡BLOQUEADO!" pop-up so a flurry of hits doesn't spam it. */
const BLOCK_POPUP_MS = 400;

/**
 * Final boss "Supremo Galáctico" (Galán in a foam suit). Three phases:
 * 1. Serves padel balls down depth lanes; return one with a swing to stun him.
 * 2. Front shield; charges across the court and is stunned when he hits the glass.
 * 3. Abduction beams hold players until a partner breaks them; he chases and swipes.
 * He can't drop below 1 HP from normal hits: the pair special lands the final blow.
 */
export class SupremoBoss implements EncounterActor {
  readonly team = COMBAT_TEAM.enemy;
  readonly combatant: Combatant;
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Rectangle;
  private readonly shield: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;
  private readonly status: Phaser.GameObjects.Text;
  private readonly telegraph: Phaser.GameObjects.Graphics;
  private readonly hitboxDebug?: Phaser.GameObjects.Graphics;

  private phase: Phase = 1;
  private state: BossState = 'intro';
  private stateStartedAt = 0;
  private stateDurationMs = 0;
  private facing: 1 | -1 = -1;
  private alive = true;
  private initialized = false;
  private solo = false;

  private serveLaneY = 0;
  private ballsServed = 0;
  private volleys = 0;
  private chargeDirection: 1 | -1 = -1;
  private readonly chargeHitPlayers = new Set<Player>();
  private nextBeamsAt = 0;
  private swipeCooldownUntil = 0;
  private stateAfterSwipe: BossState = 'serveRest';
  private lastHit: { index: number; at: number } | null = null;
  private lastBlockPopupAt = 0;
  private readonly context: BossContext;
  private readonly onDefeated: () => void;

  constructor(x: number, y: number, context: BossContext, onDefeated: () => void) {
    this.context = context;
    this.onDefeated = onDefeated;
    this.scene = context.scene;
    const { width, height } = FINAL_BOSS.body;

    this.container = this.scene.add.container(x, y);
    // The container origin is at the feet, like the players'.
    this.body = this.scene.add.rectangle(0, -height / 2, width, height, COLORS.body).setStrokeStyle(3, 0xffffff, 0.5);
    this.shield = this.scene.add.rectangle(0, -height / 2, 12, height + 10, COLORS.shield, 0.85).setVisible(false);
    this.label = this.scene.add
      .text(0, -height - 22, FINAL_BOSS.label, textStyle('bodySmall', { color: '#ffffff' }))
      .setOrigin(0.5);
    this.status = this.scene.add
      .text(0, -height - 48, '', textStyle('label', { color: '#fde047' }))
      .setOrigin(0.5);
    this.container.add([this.body, this.shield, this.label, this.status]);
    applyDepthSort(this.container, y);

    this.telegraph = this.scene.add.graphics();
    this.combatant = new Combatant(FINAL_BOSS.maxHealth);
    context.hooks.onBossHealth(this.combatant.health, this.combatant.maxHealth);

    if (DEBUG_HITBOXES) this.hitboxDebug = this.scene.add.graphics();
  }

  get position() {
    return this.container;
  }

  get isActive() {
    return this.alive && this.state !== 'defeated';
  }

  get blocksBodies() {
    return this.state !== 'charging';
  }

  get hurtbox(): HitboxRect {
    // Centered at the same height as the players' swing (36px above the feet), so hits
    // connect from the same depth range as against any other enemy.
    return createCenteredHitbox(
      this.container.x,
      this.container.y - 36,
      FINAL_BOSS.body.width + COMBAT.hurtboxPadding,
      FINAL_BOSS.body.height * 0.75,
    );
  }

  /** Debug (N key): skip straight to the knockout, as if the pair special landed. */
  forceDefeat(now: number) {
    if (!this.isActive) return;
    this.finish(now);
  }

  getBodySnapshot() {
    return { x: this.container.x, y: this.container.y, radius: FINAL_BOSS.body.radius };
  }

  setWorldPosition(x: number, y: number) {
    const { minX, maxX } = this.context.arena;
    const nextX = Phaser.Math.Clamp(x, minX + FINAL_BOSS.body.width / 2, maxX - FINAL_BOSS.body.width / 2);
    const nextY = clampToWalkLane(y, getWalkLaneForX(nextX));
    this.container.setPosition(nextX, nextY);
    applyDepthSort(this.container, nextY);
  }

  update(now: number, deltaSeconds: number, players: Player[]) {
    if (!this.isActive) return;
    if (!this.initialized) {
      this.initialized = true;
      this.solo = players.length === 1;
      this.enter('intro', now, INTRO_MS);
    }

    const living = players.filter((player) => player.isAlive);
    if (living.length === 0) return;

    this.checkPhaseChange(now);
    const nearest = this.nearest(living);
    this.telegraph.clear();

    switch (this.state) {
      case 'intro':
        if (this.elapsed(now) >= this.stateDurationMs) this.startPhase(1, now);
        break;
      case 'transition':
        this.body.setAlpha(Math.floor(this.elapsed(now) / 100) % 2 === 0 ? 1 : 0.4);
        if (this.elapsed(now) >= this.stateDurationMs) {
          this.body.setAlpha(1);
          this.startPhase(this.phase, now);
        }
        break;
      case 'serveAim':
        this.updateServeAim(now, deltaSeconds, living);
        break;
      case 'serveRest':
        this.walkToward(this.homeX(), this.container.y, 160, deltaSeconds);
        this.face(nearest.x);
        if (this.trySwipe(now, nearest, 'serveRest')) break;
        if (this.elapsed(now) >= this.stateDurationMs) this.beginVolley(now, living);
        break;
      case 'swipeWindup':
        this.updateSwipe(now, living);
        break;
      case 'chargeAlign':
        this.face(nearest.x);
        this.walkToward(this.container.x, nearest.y, 220, deltaSeconds);
        if (this.elapsed(now) >= this.stateDurationMs) {
          this.chargeDirection = nearest.x >= this.container.x ? 1 : -1;
          this.facing = this.chargeDirection;
          this.enter('chargeTelegraph', now, FINAL_BOSS.charge.telegraphMs);
        }
        break;
      case 'chargeTelegraph':
        this.drawChargeLane(now);
        this.body.setX(Math.sin(now / 25) * 3);
        if (this.elapsed(now) >= this.stateDurationMs) {
          this.chargeHitPlayers.clear();
          this.enter('charging', now, 0);
        }
        break;
      case 'charging':
        this.updateCharge(now, deltaSeconds, living);
        break;
      case 'chargeRest':
        this.face(nearest.x);
        if (this.trySwipe(now, nearest, 'chargeRest')) break;
        if (this.elapsed(now) >= this.stateDurationMs) this.enter('chargeAlign', now, FINAL_BOSS.charge.alignMs);
        break;
      case 'stunned':
        if (this.elapsed(now) >= this.stateDurationMs) this.recoverFromStun(now);
        break;
      case 'chase':
        this.updateChase(now, deltaSeconds, nearest, living);
        break;
      case 'exhausted':
      case 'defeated':
        break;
    }

    this.updateVisuals();
    this.drawDebug();
  }

  /** Every hit on the boss comes through here: shields, stuns and the finisher rule live here. */
  receiveHit(amount: number, now: number, info: HitInfo) {
    if (!this.isActive || this.state === 'intro' || this.state === 'transition') return false;

    if (this.state === 'exhausted') {
      if (info.kind !== 'special') return true; // Counts for feedback and special charge only.
      this.finish(now);
      return true;
    }

    if (info.kind === 'melee' && !this.isOpenTo(info.attackerX)) {
      this.popup('¡BLOQUEADO!', now, '#93c5fd');
      return false;
    }

    let damage = amount;
    if (this.state === 'stunned' && info.attackerIndex >= 0) {
      const last = this.lastHit;
      if (last && last.index !== info.attackerIndex && now - last.at <= FINAL_BOSS.pairHitWindowMs) {
        damage += FINAL_BOSS.pairHitBonusDamage;
        this.popup('¡GOLPE DE PAREJA!', now, '#fde047', true);
        this.lastHit = null;
      } else {
        this.lastHit = { index: info.attackerIndex, at: now };
      }
    }

    // Normal hits stop at 1 HP: the last blow has to be the pair special.
    damage = Math.min(damage, this.combatant.health - 1);
    if (damage > 0) {
      this.combatant.invulnerableUntil = 0;
      this.combatant.takeDamage(damage, now);
      this.combatant.invulnerableUntil = 0;
      this.context.hooks.onBossHealth(this.combatant.health, this.combatant.maxHealth);
    }
    if (this.combatant.health <= 1) this.becomeExhausted(now);
    return true;
  }

  onHit(now: number) {
    if (!this.isActive) return;
    this.body.setFillStyle(0xffffff);
    this.scene.time.delayedCall(70, () => {
      if (this.isActive) this.updateVisuals();
    });
    void now;
  }

  /** A returned serve reached him: stunned, and it hurts. */
  onBallReturned(now: number) {
    if (this.phase !== 1 || !this.isActive || this.state === 'transition') return;
    soundManager.playHit();
    this.scene.cameras.main.shake(120, 0.004);
    const damage = Math.min(FINAL_BOSS.serve.returnDamage, this.combatant.health - 1);
    if (damage > 0) {
      this.combatant.invulnerableUntil = 0;
      this.combatant.takeDamage(damage, now);
      this.context.hooks.onBossHealth(this.combatant.health, this.combatant.maxHealth);
    }
    this.stun(now, FINAL_BOSS.serve.stunMs);
  }

  destroy() {
    if (!this.alive) return;
    this.alive = false;
    this.context.hooks.setHint('');
    this.telegraph.destroy();
    this.hitboxDebug?.destroy();
    this.container.destroy();
  }

  // --- Phase flow -----------------------------------------------------------------------------

  private startPhase(phase: Phase, now: number) {
    this.phase = phase;
    if (phase === 1) {
      this.context.hooks.setHint(HINTS.phase1);
      this.enter('serveRest', now, 600);
    } else if (phase === 2) {
      this.context.hooks.setHint(HINTS.phase2);
      this.enter('chargeRest', now, FINAL_BOSS.charge.restMs);
    } else {
      this.context.hooks.setHint(this.solo ? HINTS.phase3Solo : HINTS.phase3Duo);
      this.nextBeamsAt = now + 800;
      this.enter('chase', now, 0);
    }
  }

  private checkPhaseChange(now: number) {
    if (this.state === 'transition' || this.state === 'exhausted' || this.state === 'intro') return;
    const ratio = this.combatant.health / this.combatant.maxHealth;
    const next: Phase | null =
      this.phase === 1 && ratio <= FINAL_BOSS.phase2At ? 2 : this.phase === 2 && ratio <= FINAL_BOSS.phase3At ? 3 : null;
    if (!next) return;
    this.phase = next;
    soundManager.playEncounterStart();
    this.scene.cameras.main.shake(250, 0.006);
    this.popup(`¡FASE ${next}!`, now, '#fca5a5', true);
    this.enter('transition', now, FINAL_BOSS.phaseTransitionMs);
  }

  private becomeExhausted(now: number) {
    if (this.state === 'exhausted') return;
    this.enter('exhausted', now, 0);
    this.context.hooks.setHint(HINTS.finisher);
    this.context.removeHazards();
  }

  private finish(now: number) {
    this.combatant.invulnerableUntil = 0;
    this.combatant.takeDamage(this.combatant.health, now);
    this.context.hooks.onBossHealth(0, this.combatant.maxHealth);
    this.context.hooks.setHint('');
    this.context.hooks.onBossFightEnd();
    this.state = 'defeated';
    this.label.setText('Ing. Galán');
    this.status.setText('');
    this.shield.setVisible(false);
    this.body.setFillStyle(COLORS.exhausted, 0.6).setScale(1, 0.7);
    this.telegraph.clear();
    soundManager.playSpecial();
    this.scene.cameras.main.shake(400, 0.01);
    this.onDefeated();
  }

  // --- Phase 1: serves ------------------------------------------------------------------------

  private beginVolley(now: number, living: Player[]) {
    this.ballsServed = 0;
    this.aimAt(Phaser.Utils.Array.GetRandom(living), now);
  }

  private aimAt(target: Player, now: number) {
    this.serveLaneY = target.y;
    this.enter('serveAim', now, FINAL_BOSS.serve.aimMs);
  }

  private updateServeAim(now: number, deltaSeconds: number, living: Player[]) {
    this.facing = -1;
    this.walkToward(this.container.x, this.serveLaneY, 200, deltaSeconds);
    this.drawServeLane(now);
    if (this.elapsed(now) < this.stateDurationMs) return;

    const { serve } = FINAL_BOSS;
    this.context.addActor(
      new PadelBall(
        this.scene,
        this.container.x - FINAL_BOSS.body.width / 2 - 14,
        this.container.y,
        -1,
        { serve: serve.ballSpeed, return: serve.returnSpeed },
        this.solo ? FINAL_BOSS.solo.ballDamage : serve.ballDamage,
        this.context.arena,
        this,
      ),
    );
    soundManager.playEncounterStart();
    this.ballsServed += 1;

    if (this.ballsServed < serve.ballsPerVolley) {
      this.aimAt(Phaser.Utils.Array.GetRandom(living), now);
      this.stateDurationMs = serve.gapMs;
      return;
    }

    this.volleys += 1;
    if (this.volleys % 2 === 1) this.callMinions();
    this.enter('serveRest', now, serve.restMs);
  }

  private callMinions() {
    const missing = FINAL_BOSS.serve.maxMinions - this.context.livingMinionCount();
    const { minX } = this.context.arena;
    for (let i = 0; i < missing; i += 1) {
      this.context.spawnMinion(minX + 40, i % 2 === 0 ? 400 : 530);
    }
  }

  private homeX() {
    return this.context.arena.maxX - 130;
  }

  // --- Close range swipe (all phases) ---------------------------------------------------------

  private trySwipe(now: number, nearest: Player, resumeState: BossState) {
    if (now < this.swipeCooldownUntil) return false;
    if (Math.abs(nearest.x - this.container.x) > FINAL_BOSS.swipe.range) return false;
    if (Math.abs(nearest.y - this.container.y) > COMBAT.depthTolerance + 10) return false;
    this.face(nearest.x);
    this.stateAfterSwipe = resumeState;
    const windup = this.phase === 3 ? FINAL_BOSS.swipe.windupMsPhase3 : FINAL_BOSS.swipe.windupMs;
    this.enter('swipeWindup', now, windup);
    return true;
  }

  private updateSwipe(now: number, living: Player[]) {
    if (this.elapsed(now) < this.stateDurationMs) return;
    const box = this.swipeHitbox();
    for (const player of living) {
      if (player.isInvulnerable(now)) continue;
      if (!hitboxesOverlap(box, player.hurtbox, COMBAT.depthTolerance + 10)) continue;
      player.takeDamage(FINAL_BOSS.swipe.damage, now);
    }
    this.swipeCooldownUntil = now + FINAL_BOSS.swipe.cooldownMs;
    const duration = this.stateAfterSwipe === 'chargeRest' ? FINAL_BOSS.charge.restMs : this.stateAfterSwipe === 'serveRest' ? 500 : 0;
    this.enter(this.stateAfterSwipe, now, duration);
  }

  private swipeHitbox() {
    return createCenteredHitbox(this.container.x + this.facing * 70, this.container.y - 36, FINAL_BOSS.swipe.range, 60);
  }

  // --- Phase 2: charge ------------------------------------------------------------------------

  private updateCharge(now: number, deltaSeconds: number, living: Player[]) {
    const { minX, maxX } = this.context.arena;
    const halfWidth = FINAL_BOSS.body.width / 2;
    const nextX = this.container.x + this.chargeDirection * FINAL_BOSS.charge.speed * deltaSeconds;
    const hitWall = nextX <= minX + halfWidth || nextX >= maxX - halfWidth;
    this.setWorldPosition(nextX, this.container.y);

    const damage = this.solo ? FINAL_BOSS.solo.chargeDamage : FINAL_BOSS.charge.damage;
    for (const player of living) {
      if (this.chargeHitPlayers.has(player) || player.isInvulnerable(now)) continue;
      if (Math.abs(player.x - this.container.x) > halfWidth + 20) continue;
      if (Math.abs(player.y - this.container.y) > COMBAT.depthTolerance + 10) continue;
      this.chargeHitPlayers.add(player);
      player.takeDamage(damage, now);
    }

    if (hitWall) {
      soundManager.playDefeat();
      this.scene.cameras.main.shake(220, 0.008);
      this.popup('¡CRASH!', now, '#fde047');
      this.stun(now, FINAL_BOSS.charge.stunMs);
    }
  }

  // --- Phase 3: chase + abduction beams -------------------------------------------------------

  private updateChase(now: number, deltaSeconds: number, nearest: Player, living: Player[]) {
    this.face(nearest.x);
    if (this.trySwipe(now, nearest, 'chase')) return;
    const standOff = FINAL_BOSS.swipe.range * 0.7;
    const targetX = nearest.x - this.facing * standOff;
    this.walkToward(targetX, nearest.y, FINAL_BOSS.abduction.chaseSpeed, deltaSeconds);

    if (now < this.nextBeamsAt) return;
    this.nextBeamsAt = now + FINAL_BOSS.abduction.everyMs;
    const count = this.solo ? FINAL_BOSS.solo.beamsPerWave : FINAL_BOSS.duo.beamsPerWave;
    const free = living.filter((player) => !player.isCaptured);
    const { abduction } = FINAL_BOSS;
    for (const target of free.slice(0, count)) {
      this.context.addActor(
        new AbductionBeam(this.scene, target, {
          telegraphMs: abduction.telegraphMs,
          activeMs: abduction.activeMs,
          radius: abduction.radius,
          followSpeed: abduction.followSpeed,
          beamHealth: abduction.beamHealth,
          damagePerSecond: abduction.damagePerSecond,
          maxHoldMs: this.solo ? FINAL_BOSS.solo.maxHoldMs : abduction.maxHoldMs,
        }, now),
      );
    }
  }

  // --- Shared helpers -------------------------------------------------------------------------

  /** Phase 1: only while stunned. Phase 2: stunned, or hit from behind the shield. Phase 3: always. */
  private isOpenTo(attackerX: number) {
    if (this.state === 'stunned') return true;
    if (this.phase === 1) return false;
    if (this.phase === 2) {
      if (this.state === 'charging' || this.state === 'chargeTelegraph') return false;
      const fromSide = Math.sign(attackerX - this.container.x);
      return fromSide !== 0 && fromSide !== this.facing;
    }
    return true;
  }

  private stun(now: number, baseMs: number) {
    const bonus = this.solo ? FINAL_BOSS.solo.stunMsBonus : 0;
    this.lastHit = null;
    this.enter('stunned', now, baseMs + bonus);
  }

  private recoverFromStun(now: number) {
    if (this.phase === 1) this.enter('serveRest', now, 500);
    else if (this.phase === 2) this.enter('chargeRest', now, FINAL_BOSS.charge.restMs);
    else this.enter('chase', now, 0);
  }

  private enter(state: BossState, now: number, durationMs: number) {
    this.state = state;
    this.stateStartedAt = now;
    this.stateDurationMs = durationMs;
  }

  private elapsed(now: number) {
    return now - this.stateStartedAt;
  }

  private face(x: number) {
    if (Math.abs(x - this.container.x) < 4) return;
    this.facing = x > this.container.x ? 1 : -1;
  }

  private walkToward(x: number, y: number, speed: number, deltaSeconds: number) {
    const dx = x - this.container.x;
    const dy = y - this.container.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 2) return;
    const step = Math.min(distance, speed * deltaSeconds);
    this.setWorldPosition(this.container.x + (dx / distance) * step, this.container.y + (dy / distance) * step);
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
    const color =
      this.state === 'swipeWindup' ? COLORS.windup
        : this.state === 'stunned' ? COLORS.stunned
          : this.state === 'exhausted' ? COLORS.exhausted
            : COLORS.body;
    this.body.setFillStyle(color, this.state === 'swipeWindup' ? 0.6 : 1);
    this.body.setScale(1, this.state === 'exhausted' ? 0.82 : 1);
    if (this.state !== 'chargeTelegraph') this.body.setX(0);

    const shieldUp = this.phase === 2 && !['stunned', 'transition', 'exhausted'].includes(this.state);
    this.shield.setVisible(shieldUp).setX(this.facing * (FINAL_BOSS.body.width / 2 + 8));

    this.status.setText(
      this.state === 'stunned' ? '✦ ATURDIDO ✦' : this.state === 'exhausted' ? '¡AGOTADO!' : '',
    );
  }

  private drawServeLane(now: number) {
    const { minX } = this.context.arena;
    const alpha = Math.floor(now / 110) % 2 === 0 ? 0.55 : 0.2;
    const left = minX;
    const right = this.container.x - FINAL_BOSS.body.width / 2;
    this.telegraph.fillStyle(COLORS.serveLane, alpha);
    this.telegraph.fillRect(left, this.serveLaneY - 5, right - left, 10);
    this.telegraph.setDepth(this.serveLaneY - 30);
  }

  private drawChargeLane(now: number) {
    const { minX, maxX } = this.context.arena;
    const alpha = Math.floor(now / 90) % 2 === 0 ? 0.4 : 0.15;
    const from = this.container.x;
    const to = this.chargeDirection === 1 ? maxX : minX;
    this.telegraph.fillStyle(COLORS.chargeLane, alpha);
    this.telegraph.fillRect(Math.min(from, to), this.container.y - 22, Math.abs(to - from), 44);
    this.telegraph.setDepth(this.container.y - 30);
  }

  private popup(text: string, now: number, color: string, important = false) {
    if (!important && now - this.lastBlockPopupAt < BLOCK_POPUP_MS) return;
    if (!important) this.lastBlockPopupAt = now;
    const popup = this.scene.add
      .text(this.container.x, this.container.y - FINAL_BOSS.body.height - 40, text, textStyle(important ? 'heading' : 'bodySmall', { color }))
      .setOrigin(0.5)
      .setDepth(15_000);
    this.scene.tweens.add({
      targets: popup,
      y: popup.y - 50,
      alpha: 0,
      duration: important ? 1100 : 600,
      onComplete: () => popup.destroy(),
    });
  }

  private drawDebug() {
    if (!this.hitboxDebug) return;
    this.hitboxDebug.clear();
    drawHitboxOutline(this.hitboxDebug, this.hurtbox, 0xff00ff);
    if (this.state === 'swipeWindup') drawHitboxOutline(this.hitboxDebug, this.swipeHitbox(), 0x00ff00);
    this.hitboxDebug.setDepth(this.container.y + 900);
  }
}
