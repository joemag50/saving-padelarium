import Phaser from 'phaser';
import { COMBAT } from '../config/combat';
import {
  DEBUG_DEFEAT_ALL_KEY,
  DEBUG_DRAIN_HEALTH_FRACTION,
  DEBUG_DRAIN_HEALTH_KEY,
  DEBUG_INVINCIBLE_KEY,
  DEBUG_MODE,
  debugState,
} from '../config/debug';
import {
  buildEncounter1Waves,
  buildEncounter2Waves,
  ENCOUNTER_CAMERA_X,
  INTERACT_POINTS,
  LEVEL_ZONES,
} from '../config/level';
import {
  actorPx,
  CAMERA,
  GAME_HEIGHT,
  GAME_WIDTH,
  LEVEL_HEIGHT,
  LEVEL_WIDTH,
  PLAYER,
  SPAWN_POINTS,
} from '../config/constants';
import { EncounterManager } from '../core/EncounterManager';
import { playRespawnEffect, playVanishEffect } from '../world/respawnEffect';
import type { LevelState } from '../data/levelFlow';
import type { LevelDefinition } from '../data/levels';
import { getDefaultParty, getRosterCharacter } from '../data/roster';
import { sanitizePartySelection, type PartySelection } from '../systems/rosterProgress';
import { getCurrentLevel, getPlayerCount } from '../systems/session';
import type { PlayerIndex } from '../types/player';
import { PairSpecial } from '../combat/PairSpecial';
import { Player } from '../player/Player';
import { PlayerInput } from '../player/PlayerInput';
import { soundManager } from '../systems/soundManager';
import { GameHud } from '../ui/GameHud';
import { TouchControls } from '../ui/TouchControls';
import { isTouchDevice } from '../systems/device';
import { textStyle } from '../ui/theme';
import type { MovementBounds } from '../types/combat';
import { applyDepthSort, sortByDepth } from '../world/depthSort';
import { BODY_COLLISION, separateActors, type BodyActor } from '../world/bodyCollision';
import { buildStage } from '../world/stage';

type DepthSortable = Phaser.GameObjects.GameObject & {
  y: number;
  setDepth: (value: number) => unknown;
};

/** Standard-mapping gamepad Start button. */
const GAMEPAD_START = 9;

/** Timing (ms) of the knockout → respawn sequence when every player is down. */
const RESPAWN = { knockoutPauseMs: 1500, vanishMs: 350, gapMs: 250, appearMs: 550 } as const;

export class LevelScene extends Phaser.Scene {
  private players: Player[] = [];
  private playerInput!: PlayerInput;
  private hud!: GameHud;
  private encounterManager!: EncounterManager;
  private pairSpecial = new PairSpecial();
  private cameraTarget!: Phaser.GameObjects.Container;
  private depthSorted: DepthSortable[] = [];
  private hitStopUntil = 0;
  /** Everyone fell: the fight is frozen while they get beamed back to retry. */
  private respawning = false;
  private level!: LevelDefinition;

  private rescuedFriends!: Phaser.GameObjects.Container;

  private flow = LevelScene.initialFlow();
  /** Left edge of the camera while it's locked on a fight; null when the camera follows the players. */
  private lockedCameraX: number | null = null;

  private static initialFlow() {
    return {
      state: 'start' as LevelState,
      encounter1Started: false,
      encounter1Cleared: false,
      encounter2Started: false,
      encounter2Cleared: false,
      rescueShown: false,
    };
  }

  constructor() {
    super({ key: 'LevelScene' });
  }

  create() {
    // Phaser reuses the scene instance, so reset per-run state on every start.
    this.level = getCurrentLevel(this.registry);
    this.flow = LevelScene.initialFlow();
    this.pairSpecial = new PairSpecial();
    this.depthSorted = [];
    this.hitStopUntil = 0;
    this.respawning = false;
    this.lockedCameraX = null;

    soundManager.ensureContext();
    this.cameras.main.setBackgroundColor(this.level.palette.background);
    this.buildLevel();
    this.hud = new GameHud(this);
    this.spawnPlayers();
    this.hud.bindPlayers(this.players.map((player) => ({ name: player.displayName, color: player.color })));
    this.hud.setObjective(this.level.objectives.start);
    for (const [index, player] of this.players.entries()) {
      this.hud.setPlayerHp(index, player.combatant.health, player.combatant.maxHealth);
    }
    this.encounterManager = new EncounterManager(this, {
      onBossAppear: (label) => this.hud.showBossBar(label),
      onBossHealth: (current, max) => this.hud.setBossHealth(current, max),
      onBossFightEnd: () => this.hud.hideBossBar(),
      setHint: (text) => this.hud.setInteractHint(text),
    });
    this.setupCamera();

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('Keyboard input is unavailable.');
    const touch = isTouchDevice() ? new TouchControls(this) : null;
    this.playerInput = new PlayerInput(keyboard, this.input.gamepad, getPlayerCount(this.registry), touch);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.playerInput.destroy());
    this.bindPause(keyboard, touch);
    if (DEBUG_MODE) {
      const defeatAll = () => this.encounterManager.defeatAll(this.time.now);
      keyboard.on(`keydown-${DEBUG_DEFEAT_ALL_KEY}`, defeatAll);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => keyboard.off(`keydown-${DEBUG_DEFEAT_ALL_KEY}`, defeatAll));

      // Twice in a row knocks a player out (each press takes 95% of max health).
      const drainHealth = () => {
        for (const player of this.players) player.debugDrainHealth(DEBUG_DRAIN_HEALTH_FRACTION, this.time.now);
      };
      keyboard.on(`keydown-${DEBUG_DRAIN_HEALTH_KEY}`, drainHealth);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => keyboard.off(`keydown-${DEBUG_DRAIN_HEALTH_KEY}`, drainHealth));

      const invincibleLabel = this.add
        .text(GAME_WIDTH / 2, 62, `MODO INVENCIBLE (${DEBUG_INVINCIBLE_KEY})`, textStyle('caption', { color: '#fde047' }))
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(10_000)
        .setVisible(debugState.invincible);
      const toggleInvincible = () => {
        debugState.invincible = !debugState.invincible;
        invincibleLabel.setVisible(debugState.invincible);
      };
      keyboard.on(`keydown-${DEBUG_INVINCIBLE_KEY}`, toggleInvincible);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => keyboard.off(`keydown-${DEBUG_INVINCIBLE_KEY}`, toggleInvincible));
    }

    this.hud.showMessage(`NIVEL ${this.level.id}: ${this.level.title.toUpperCase()}`, this.level.intro, () => undefined);
  }

  update(time: number, delta: number) {
    if (time < this.hitStopUntil) return;

    const deltaSeconds = delta / 1000;
    const bounds = this.getMovementBounds();
    const targets = this.encounterManager.targets;
    const players = this.players;
    const activeCount = players.length;

    if (this.hud.isMessageOpen()) {
      this.hud.tryDismissMessage(this.playerInput.attackPressedByAny(activeCount));
      return;
    }
    const bodyBlockersFor = (exclude: BodyActor) =>
      this.collectBodyActors()
        .filter((actor) => actor !== exclude)
        .map((actor) => actor.getBodySnapshot());

    this.checkTriggers();
    this.tryPairSpecial(time, targets);

    let hitConnected = false;
    for (const [index, player] of players.entries()) {
      const playerIndex = index as PlayerIndex;
      if (
        player.update({
          now: time,
          deltaSeconds,
          movement: this.playerInput.getMovement(playerIndex),
          speed: PLAYER.moveSpeed,
          attackPressed: this.playerInput.attackJustPressed(playerIndex),
          dodgePressed: this.playerInput.dodgeJustPressed(playerIndex),
          bounds,
          targets,
          bodyBlockers: bodyBlockersFor(player),
        })
      ) {
        hitConnected = true;
        this.pairSpecial.addCharge();
        soundManager.playHit();
      }
    }

    if (hitConnected) {
      this.hitStopUntil = time + COMBAT.hitStopMs;
      this.cameras.main.shake(80, 0.002);
    }

    if (this.encounterManager.active && !this.respawning) {
      this.encounterManager.update(time, deltaSeconds, players, (enemy) => bodyBlockersFor(enemy));
      this.checkEncounterFailure();
    }

    const bodyActors = this.collectBodyActors();
    if (bodyActors.length > 1) {
      separateActors(bodyActors, BODY_COLLISION.depthRatio);
    }

    this.updateCameraTarget();
    this.hud.setSpecial(this.pairSpecial.charge, this.pairSpecial.isReadyFlash(time));
    this.refreshDepthSorting();

    if (this.flow.state === 'rescue' && !this.flow.rescueShown && this.isAnyPlayerNear(INTERACT_POINTS.rescue)) {
      this.flow.rescueShown = true;
      this.hud.showMessage('RESCATE', this.level.rescue.line, () => this.scene.start('EndScene'));
    }
  }

  /** Esc, P, the gamepad's Start, the HUD button, or leaving the tab/app all pause the game. */
  private bindPause(keyboard: Phaser.Input.Keyboard.KeyboardPlugin, touch: TouchControls | null) {
    const pause = () => {
      if (!this.scene.isActive()) return;
      this.scene.launch('PauseScene');
      this.scene.pause();
    };
    const onPad = (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
      if (button.index === GAMEPAD_START) pause();
    };
    keyboard.on('keydown-ESC', pause);
    keyboard.on('keydown-P', pause);
    this.input.gamepad?.on('down', onPad);
    this.game.events.on(Phaser.Core.Events.HIDDEN, pause);
    this.hud.onPause(pause);

    // Whatever was pressed in the pause menu (or released while paused) shouldn't leak into play.
    const onResume = () => {
      keyboard.resetKeys();
      touch?.reset();
    };
    this.events.on(Phaser.Scenes.Events.RESUME, onResume);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard.off('keydown-ESC', pause);
      keyboard.off('keydown-P', pause);
      this.input.gamepad?.off('down', onPad);
      this.game.events.off(Phaser.Core.Events.HIDDEN, pause);
      this.events.off(Phaser.Scenes.Events.RESUME, onResume);
    });
  }

  private buildLevel() {
    const { level } = this;
    buildStage(this, level.stage);
    this.rescuedFriends = this.add.container(LEVEL_ZONES.rescueX, 460).setVisible(false);
    const rescued = level.rescue.characters.map(getRosterCharacter);
    rescued.forEach((character, index) => {
      const offsetX = (index - (rescued.length - 1) / 2) * actorPx(64);
      this.rescuedFriends.add(
        this.add.rectangle(offsetX, 0, PLAYER.bodyWidth, PLAYER.bodyHeight, character.color).setStrokeStyle(2, 0xffffff, 0.4),
      );
      this.rescuedFriends.add(
        this.add
          .text(offsetX, -PLAYER.bodyHeight / 2 - 16, character.name, textStyle('label', { color: '#fff' }))
          .setOrigin(0.5),
      );
    });
  }

  private spawnPlayers() {
    const party = this.getPartySelection();
    this.players = party.map((id, index) => {
      const character = getRosterCharacter(id);
      const spawn = SPAWN_POINTS[index] ?? SPAWN_POINTS[0];
      const playerIndex = index as PlayerIndex;
      const player = new Player(
        this,
        {
          index: playerIndex,
          characterId: character.id,
          name: character.name,
          color: character.color,
          spawnX: spawn.x,
          spawnY: spawn.y,
        },
        (current, max) => this.hud.setPlayerHp(index, current, max),
      );
      this.depthSorted.push(player.position);
      return player;
    });
  }

  private setupCamera() {
    const first = this.players[0];
    this.cameraTarget = this.add.container(first?.x ?? SPAWN_POINTS[0].x, first?.y ?? SPAWN_POINTS[0].y);
    const camera = this.cameras.main;
    camera.setBounds(0, 0, LEVEL_WIDTH, LEVEL_HEIGHT);
    camera.startFollow(this.cameraTarget, true, CAMERA.followLerp, CAMERA.followLerp);
    camera.setDeadzone(CAMERA.deadzoneWidth, GAME_HEIGHT);
  }

  /** Walkable limits of a fight's room, given the camera's left edge while it's locked there. */
  private static roomArena(cameraX: number) {
    return { minX: cameraX + PLAYER.bodyWidth / 2, maxX: cameraX + GAME_WIDTH - PLAYER.bodyWidth / 2 };
  }

  /** Freezes the camera on a fight's room; players are kept on screen by `getMovementBounds`. */
  private lockCamera(scrollX: number) {
    const camera = this.cameras.main;
    this.lockedCameraX = Phaser.Math.Clamp(scrollX, 0, LEVEL_WIDTH - GAME_WIDTH);
    camera.stopFollow();
    camera.pan(this.lockedCameraX + GAME_WIDTH / 2, GAME_HEIGHT / 2, 400, 'Sine.easeInOut');
  }

  private releaseCamera(showGoHint = true) {
    if (this.lockedCameraX === null) return;
    this.lockedCameraX = null;
    this.cameras.main.startFollow(this.cameraTarget, true, CAMERA.followLerp, CAMERA.followLerp);
    if (showGoHint) this.hud.showGoHint();
  }

  private updateCameraTarget() {
    if (this.players.length === 0) return;
    const avgX = this.players.reduce((sum, player) => sum + player.x, 0) / this.players.length;
    const avgY = this.players.reduce((sum, player) => sum + player.y, 0) / this.players.length;
    this.cameraTarget.setPosition(avgX, avgY);
  }

  private getPartySelection(): PartySelection {
    const playerCount = getPlayerCount(this.registry);
    return sanitizePartySelection(
      (this.registry.get('partySelection') as PartySelection | undefined) ?? getDefaultParty(playerCount),
      playerCount,
    );
  }

  private collectBodyActors(): BodyActor[] {
    const actors: BodyActor[] = [];
    for (const player of this.players) {
      if (player.isAlive) actors.push(player);
    }
    for (const enemy of this.encounterManager.bodyActors) {
      actors.push(enemy);
    }
    return actors;
  }

  private getMovementBounds(): MovementBounds {
    let maxX = LEVEL_WIDTH - PLAYER.bodyWidth / 2;

    let minX = PLAYER.bodyWidth / 2;

    if (this.lockedCameraX !== null) {
      minX = Math.max(minX, this.lockedCameraX + PLAYER.bodyWidth / 2);
      maxX = Math.min(maxX, this.lockedCameraX + GAME_WIDTH - PLAYER.bodyWidth / 2);
    }

    return { minX, maxX };
  }

  private checkTriggers() {
    const leadX = Math.max(...this.players.map((player) => player.x));

    if (!this.flow.encounter1Started && leadX >= LEVEL_ZONES.encounter1TriggerX) {
      this.startEncounter1();
    }
    if (
      this.flow.state === 'hallway' &&
      !this.flow.encounter2Started &&
      leadX >= LEVEL_ZONES.courtTriggerX
    ) {
      this.startEncounter2();
    }
  }

  private startEncounter1() {
    this.flow.encounter1Started = true;
    this.flow.state = 'encounter_1';
    this.lockCamera(ENCOUNTER_CAMERA_X.encounter1);
    this.hud.setObjective(this.level.objectives.encounter1);
    soundManager.playEncounterStart();
    const waves = buildEncounter1Waves(this.level.encounter1.waves, this.level.minionScale);
    this.encounterManager.startWaves(waves, LevelScene.roomArena(ENCOUNTER_CAMERA_X.encounter1), () => {
      this.flow.encounter1Cleared = true;
      for (const player of this.players) {
        player.recoverBetweenEncounters(COMBAT.recoveryBetweenEncounters);
      }
      this.flow.state = 'hallway';
      this.hud.setObjective(this.level.objectives.hallway);
      this.releaseCamera();
    });
  }

  private startEncounter2() {
    this.flow.encounter2Started = true;
    this.flow.state = 'encounter_2';
    this.lockCamera(ENCOUNTER_CAMERA_X.encounter2);
    this.hud.setObjective(this.level.objectives.encounter2);
    soundManager.playEncounterStart();
    const waves = buildEncounter2Waves(
      this.level.encounter2.waves,
      this.level.minionScale,
      this.level.boss,
      this.level.finalBoss === true,
    );
    this.encounterManager.startWaves(
      waves,
      LevelScene.roomArena(ENCOUNTER_CAMERA_X.encounter2),
      () => {
        this.flow.encounter2Cleared = true;
        this.flow.state = 'rescue';
        // The friends to rescue are in this same room, so no "¡ADELANTE!" here.
        this.releaseCamera(false);
        this.hud.setObjective(this.level.objectives.rescue);
        this.rescuedFriends.setVisible(true);
        applyDepthSort(this.rescuedFriends, this.rescuedFriends.y);
      },
    );
  }

  private tryPairSpecial(time: number, targets: import('../types/combat').CombatTarget[]) {
    // Always read the button, so presses made before the gauge filled don't fire it later.
    const presserIndex = this.playerInput.specialPressedBy(this.players.length);
    if (presserIndex === null || !this.pairSpecial.canActivate()) return;
    const presser = this.players[presserIndex];
    if (!presser?.isAlive) return;

    // It goes off around whoever pressed it.
    const hits = this.pairSpecial.activate(time, presser.x, presser.y, targets);
    soundManager.playSpecial();
    this.cameras.main.shake(hits > 0 ? 160 : 90, hits > 0 ? 0.005 : 0.002);
    if (hits > 0) this.hitStopUntil = time + COMBAT.hitStopMs * 2;
    this.showSpecialWave(presser.x, presser.y);
  }

  /** Golden shockwave on the floor, showing the special's reach even when it hits nobody. */
  private showSpecialWave(x: number, y: number) {
    const wave = this.add
      .ellipse(x, y, COMBAT.specialRadius * 2, COMBAT.specialRadius, 0xfbbf24, 0.35)
      .setStrokeStyle(4, 0xfde68a, 0.9)
      .setDepth(y + 1)
      .setScale(0.2);
    this.tweens.add({
      targets: wave,
      scale: 1.1,
      alpha: 0,
      duration: 420,
      ease: 'Cubic.easeOut',
      onComplete: () => wave.destroy(),
    });
  }

  private checkEncounterFailure() {
    if (this.respawning || this.players.some((player) => player.isAlive)) return;
    // Let the fall play out, then beam everyone back and retry the fight.
    this.respawning = true;
    soundManager.playKnockout();
    this.time.delayedCall(RESPAWN.knockoutPauseMs, () => this.vanishParty());
  }

  /** A flash: enemies are gone and the fallen fade away in sparks. */
  private vanishParty() {
    this.cameras.main.flash(250, 220, 250, 255);
    this.encounterManager.clear();
    for (const player of this.players) {
      playVanishEffect(this, player.x, player.y, PLAYER.bodyHeight);
      this.tweens.add({ targets: player.container, alpha: 0, duration: RESPAWN.vanishMs });
    }
    this.time.delayedCall(RESPAWN.vanishMs + RESPAWN.gapMs, () => this.respawnParty());
  }

  /** Back at the start of the room, beamed in, and the fight starts again. */
  private respawnParty() {
    // Respawn inside the locked room so the retry starts on screen.
    const roomX = this.lockedCameraX ?? 0;
    soundManager.playRespawn();
    for (const [index, player] of this.players.entries()) {
      const spawn = SPAWN_POINTS[index] ?? SPAWN_POINTS[0];
      player.resetForEncounter(roomX + spawn.x, spawn.y);
      player.container.setAlpha(0);
      playRespawnEffect(this, player.x, player.y, PLAYER.bodyHeight);
      this.tweens.add({ targets: player.container, alpha: 1, delay: 150, duration: RESPAWN.appearMs });
    }
    this.time.delayedCall(RESPAWN.appearMs + 150, () => {
      this.respawning = false;
      this.restartActiveEncounter();
    });
  }

  private restartActiveEncounter() {
    if (this.flow.encounter2Started && !this.flow.encounter2Cleared) {
      this.startEncounter2();
      return;
    }

    if (this.flow.encounter1Started && !this.flow.encounter1Cleared) {
      this.startEncounter1();
    }
  }

  private isAnyPlayerNear(point: { x: number; y: number; radius: number }) {
    return this.players.some((player) =>
      Phaser.Math.Distance.Between(player.x, player.y, point.x, point.y) <= point.radius,
    );
  }

  private refreshDepthSorting() {
    sortByDepth(this.depthSorted);
  }
}
