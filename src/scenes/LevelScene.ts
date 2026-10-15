import Phaser from 'phaser';
import { COMBAT } from '../config/combat';
import { DEBUG_DEFEAT_ALL_KEY, DEBUG_INVINCIBLE_KEY, DEBUG_MODE, debugState } from '../config/debug';
import {
  buildEncounter1Waves,
  buildEncounter2Waves,
  ENCOUNTER_CAMERA_X,
  INTERACT_POINTS,
  LEVEL_PROPS,
  LEVEL_ZONES,
} from '../config/level';
import {
  CAMERA,
  GAME_HEIGHT,
  GAME_WIDTH,
  LEVEL_HEIGHT,
  LEVEL_WIDTH,
  PLAYER,
  SPAWN_POINTS,
  WALK_LANE,
} from '../config/constants';
import { EncounterManager } from '../core/EncounterManager';
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
import { COLORS, textStyle } from '../ui/theme';
import type { MovementBounds } from '../types/combat';
import { applyDepthSort, sortByDepth } from '../world/depthSort';
import { BODY_COLLISION, separateActors, type BodyActor } from '../world/bodyCollision';
import { addDecorSprite, buildScenery } from '../world/scenery';
import type { DecorFrame } from '../world/tileAssets';

type DepthSortable = Phaser.GameObjects.GameObject & {
  y: number;
  setDepth: (value: number) => unknown;
};

export class LevelScene extends Phaser.Scene {
  private players: Player[] = [];
  private playerInput!: PlayerInput;
  private hud!: GameHud;
  private encounterManager!: EncounterManager;
  private pairSpecial = new PairSpecial();
  private cameraTarget!: Phaser.GameObjects.Container;
  private depthSorted: DepthSortable[] = [];
  private hitStopUntil = 0;
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
    this.lockedCameraX = null;

    soundManager.ensureContext();
    this.cameras.main.setBackgroundColor(this.level.palette.background);
    this.buildLevel();
    this.hud = new GameHud(this);
    this.spawnPlayers();
    this.hud.bindPlayers(this.players.map((player) => player.displayName), getPlayerCount(this.registry));
    this.hud.setObjective(this.level.objectives.start);
    for (const [index, player] of this.players.entries()) {
      this.hud.setPlayerHp(index, player.combatant.health, player.combatant.maxHealth);
    }
    this.encounterManager = new EncounterManager(this, {
      onBossHealth: (current, max) => this.hud.setBossHealth(current, max),
      onBossFightEnd: () => this.hud.hideBossBar(),
      setHint: (text) => this.hud.setInteractHint(text),
    });
    this.setupCamera();

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('Keyboard input is unavailable.');
    this.playerInput = new PlayerInput(keyboard, this.input.gamepad, getPlayerCount(this.registry));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.playerInput.destroy());
    if (DEBUG_MODE) {
      const defeatAll = () => this.encounterManager.defeatAll(this.time.now);
      keyboard.on(`keydown-${DEBUG_DEFEAT_ALL_KEY}`, defeatAll);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => keyboard.off(`keydown-${DEBUG_DEFEAT_ALL_KEY}`, defeatAll));

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

    if (this.encounterManager.active) {
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

  private buildLevel() {
    const { level } = this;
    if (level.scenery) {
      buildScenery(this, level.scenery);
    } else {
      this.buildGrayBoxFloor();
    }
    const propSprites = level.scenery?.props ?? {};

    const { cover, hallway, court } = LEVEL_PROPS;
    this.addZoneLabel(level.zones[0], 320, 250);
    this.addProp(cover.x, cover.y, cover.width, cover.height, level.props.cover, propSprites.cover);
    this.addZoneLabel(level.zones[1], 1380, 220);
    this.addProp(hallway.x, WALK_LANE.minY - 40, hallway.width, hallway.height, level.props.hallway, propSprites.hallway);
    this.addZoneLabel(level.zones[2], 1880, 220);
    this.addProp(court.x, WALK_LANE.minY - 40, court.width, court.height, level.props.court, propSprites.court);

    this.rescuedFriends = this.add.container(LEVEL_ZONES.rescueX, 460).setVisible(false);
    const rescued = level.rescue.characters.map(getRosterCharacter);
    rescued.forEach((character, index) => {
      const offsetX = (index - (rescued.length - 1) / 2) * 64;
      this.rescuedFriends.add(
        this.add.rectangle(offsetX, 0, 48, 72, character.color).setStrokeStyle(2, 0xffffff, 0.4),
      );
      this.rescuedFriends.add(
        this.add
          .text(offsetX, -52, character.name, textStyle('label', { color: '#fff' }))
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
    if (this.level.finalBoss) this.hud.showBossBar(this.level.boss.label);
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
    if (!this.pairSpecial.canActivate()) return;
    if (!this.playerInput.specialPressedByAny(this.players.length)) return;

    const originX = this.players.reduce((sum, player) => sum + player.x, 0) / this.players.length;
    const originY = this.players.reduce((sum, player) => sum + player.y, 0) / this.players.length;
    const hits = this.pairSpecial.activate(time, originX, originY, targets);
    if (hits > 0) {
      soundManager.playSpecial();
      this.hitStopUntil = time + COMBAT.hitStopMs * 2;
      this.cameras.main.shake(120, 0.004);
      this.add
        .circle(originX, originY, COMBAT.specialRadius, 0xfbbf24, 0.25)
        .setDepth(originY + 1)
        .setScale(0.2);
    }
  }

  private checkEncounterFailure() {
    if (this.players.some((player) => player.isAlive)) return;
    this.restartActiveEncounter();
  }

  private restartActiveEncounter() {
    this.encounterManager.clear();
    // Respawn inside the locked room so the retry starts on screen.
    const roomX = this.lockedCameraX ?? 0;
    for (const [index, player] of this.players.entries()) {
      const spawn = SPAWN_POINTS[index] ?? SPAWN_POINTS[0];
      player.resetForEncounter(roomX + spawn.x, spawn.y);
    }

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

  private addZoneLabel(text: string, x: number, y: number) {
    this.add
      .text(x, y, text, textStyle('bodySmall', { color: COLORS.textMuted }))
      .setOrigin(0.5)
      .setDepth(y);
  }

  private buildGrayBoxFloor() {
    const floor = this.level.palette.floor;
    this.add.rectangle(LEVEL_WIDTH / 2, GAME_HEIGHT / 2, LEVEL_WIDTH, LEVEL_HEIGHT, floor).setDepth(0);
    this.add
      .rectangle(LEVEL_WIDTH / 2, WALK_LANE.minY, LEVEL_WIDTH, 4, COLORS.floorLine, 0.8)
      .setDepth(WALK_LANE.minY);
    this.add
      .rectangle(LEVEL_WIDTH / 2, WALK_LANE.maxY, LEVEL_WIDTH, 4, COLORS.floorLine, 0.8)
      .setDepth(WALK_LANE.maxY);
    this.add
      .rectangle(
        LEVEL_WIDTH / 2,
        (WALK_LANE.minY + WALK_LANE.maxY) / 2,
        LEVEL_WIDTH,
        WALK_LANE.maxY - WALK_LANE.minY,
        floor,
        0.2,
      )
      .setDepth(WALK_LANE.minY - 1);
  }

  private addProp(x: number, y: number, width: number, height: number, label: string, sprite?: DecorFrame) {
    const baseY = y + height / 2;
    if (sprite) {
      addDecorSprite(this, sprite, x, y + height).setDepth(baseY);
      return;
    }
    const prop = this.add
      .rectangle(x, baseY, width, height, COLORS.prop)
      .setStrokeStyle(2, COLORS.propBorder);
    this.add
      .text(x, y - 12, label, textStyle('label'))
      .setOrigin(0.5)
      .setDepth(baseY - 1);
    prop.setDepth(baseY);
  }

  private refreshDepthSorting() {
    sortByDepth(this.depthSorted);
  }
}
