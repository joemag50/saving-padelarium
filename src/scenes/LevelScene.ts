import Phaser from 'phaser';
import { COMBAT } from '../config/combat';
import {
  ENEMY_SPAWNS,
  INTERACT_POINTS,
  LEVEL_ZONES,
} from '../config/level';
import {
  CAMERA,
  GAME_HEIGHT,
  LEVEL_HEIGHT,
  LEVEL_WIDTH,
  PLAYER,
  SPAWN_POINTS,
  WALK_LANE,
} from '../config/constants';
import { EncounterManager } from '../core/EncounterManager';
import { CLUE, OBJECTIVES, RESCUE_LINE, type LevelState } from '../data/levelFlow';
import { getDefaultParty, getRosterCharacter } from '../data/roster';
import { sanitizePartySelection, type PartySelection } from '../systems/rosterProgress';
import { getPlayerCount } from '../systems/session';
import type { PlayerIndex } from '../types/player';
import { PairSpecial } from '../combat/PairSpecial';
import { Player } from '../player/Player';
import { PlayerInput } from '../player/PlayerInput';
import { soundManager } from '../systems/soundManager';
import { GameHud } from '../ui/GameHud';
import { COLORS, FONTS } from '../ui/theme';
import type { MovementBounds } from '../types/combat';
import { applyDepthSort, sortByDepth } from '../world/depthSort';
import { BODY_COLLISION, separateActors, type BodyActor } from '../world/bodyCollision';

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
  private readonly depthSorted: DepthSortable[] = [];
  private hitStopUntil = 0;

  private barrierGate!: Phaser.GameObjects.Rectangle;
  private encounterBlockGate!: Phaser.GameObjects.Rectangle;
  private cableGfx!: Phaser.GameObjects.Graphics;
  private projectorProp!: Phaser.GameObjects.Rectangle;
  private rescuedFriend!: Phaser.GameObjects.Container;

  private flow = {
    state: 'start' as LevelState,
    encounter1Started: false,
    encounter1Cleared: false,
    barrierInspected: false,
    clueFound: false,
    encounter2Started: false,
    encounter2Cleared: false,
    rescueShown: false,
  };

  constructor() {
    super({ key: 'LevelScene' });
  }

  create() {
    soundManager.ensureContext();
    this.cameras.main.setBackgroundColor(COLORS.background);
    this.buildLevel();
    this.hud = new GameHud(this);
    this.spawnPlayers();
    this.hud.bindPlayers(this.players.map((player) => player.displayName), getPlayerCount(this.registry));
    this.hud.setObjective(OBJECTIVES.start);
    for (const [index, player] of this.players.entries()) {
      this.hud.setPlayerHp(index, player.combatant.health, player.combatant.maxHealth);
    }
    this.encounterManager = new EncounterManager(this);
    this.setupCamera();

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('Keyboard input is unavailable.');
    this.playerInput = new PlayerInput(keyboard, this.input.gamepad, getPlayerCount(this.registry));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.playerInput.destroy());
  }

  update(time: number, delta: number) {
    if (time < this.hitStopUntil) return;

    const deltaSeconds = delta / 1000;
    const bounds = this.getMovementBounds();
    const targets = this.encounterManager.targets;
    const players = this.players;
    const activeCount = players.length;

    if (this.hud.isMessageOpen()) {
      this.hud.tryDismissMessage(this.playerInput.interactPressedByAny(activeCount));
      return;
    }
    const bodyBlockersFor = (exclude: BodyActor) =>
      this.collectBodyActors()
        .filter((actor) => actor !== exclude)
        .map((actor) => actor.getBodySnapshot());

    this.checkTriggers();
    this.handleInteractions();
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
      separateActors(bodyActors, BODY_COLLISION.depthTolerance);
    }

    this.updateCameraTarget();
    this.hud.setSpecial(this.pairSpecial.charge, this.pairSpecial.isReadyFlash(time));
    this.refreshDepthSorting();

    if (this.flow.state === 'rescue' && this.flow.rescueShown) {
      const leadX = Math.max(...players.map((player) => player.x));
      if (leadX >= LEVEL_ZONES.rescueX - 40) {
        this.scene.start('EndScene');
      }
    }
  }

  private buildLevel() {
    this.add.rectangle(LEVEL_WIDTH / 2, GAME_HEIGHT / 2, LEVEL_WIDTH, LEVEL_HEIGHT, COLORS.floor).setDepth(0);
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
        COLORS.floor,
        0.2,
      )
      .setDepth(WALK_LANE.minY - 1);

    this.addZoneLabel('ZONA A — RECEPCIÓN', 320, 250);
    this.addProp(620, 330, 220, 90, 'MOSTRADOR');
    this.projectorProp = this.add
      .rectangle(660, 455, 50, 30, 0xfbbf24)
      .setStrokeStyle(2, 0xffffff, 0.5);
    this.add
      .text(660, 420, 'PROYECTOR', { fontFamily: FONTS.mono, fontSize: '12px', color: '#fbbf24' })
      .setOrigin(0.5);

    this.barrierGate = this.add
      .rectangle(LEVEL_ZONES.barrierX, 430, 36, 230, 0x66e0ff, 0.4)
      .setStrokeStyle(3, 0x66e0ff);
    this.add
      .text(LEVEL_ZONES.barrierX, 300, 'BARRERA ALIENÍGENA', {
        fontFamily: FONTS.mono,
        fontSize: '14px',
        color: '#9fefff',
      })
      .setOrigin(0.5);

    this.encounterBlockGate = this.add
      .rectangle(LEVEL_ZONES.encounter1BlockX, 430, 24, 230, COLORS.prop, 0.85)
      .setStrokeStyle(2, COLORS.propBorder)
      .setVisible(false);

    this.cableGfx = this.add.graphics();
    this.drawCable(false);

    this.addZoneLabel('ZONA B — PASILLO', 1380, 220);
    this.addProp(1500, WALK_LANE.minY - 40, 80, 160, 'COLUMNA');
    this.addZoneLabel('ZONA C — CANCHA', 1880, 220);
    this.addProp(2100, WALK_LANE.minY - 40, 80, 160, 'COLUMNA');

    this.rescuedFriend = this.add.container(LEVEL_ZONES.rescueX, 460).setVisible(false);
    this.rescuedFriend.add(
      this.add.rectangle(0, 0, 48, 72, 0x34d399).setStrokeStyle(2, 0xffffff, 0.4),
    );
    this.rescuedFriend.add(
      this.add.text(0, -52, 'Rody', { fontFamily: FONTS.ui, fontSize: '14px', color: '#fff' }).setOrigin(0.5),
    );
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
    this.depthSorted.push(this.projectorProp, this.barrierGate);
  }

  private setupCamera() {
    const first = this.players[0];
    this.cameraTarget = this.add.container(first?.x ?? SPAWN_POINTS[0].x, first?.y ?? SPAWN_POINTS[0].y);
    const camera = this.cameras.main;
    camera.setBounds(0, 0, LEVEL_WIDTH, LEVEL_HEIGHT);
    camera.startFollow(this.cameraTarget, true, CAMERA.followLerp, CAMERA.followLerp);
    camera.setDeadzone(CAMERA.deadzoneWidth, GAME_HEIGHT);
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
    for (const enemy of this.encounterManager.livingEnemies) {
      actors.push(enemy);
    }
    return actors;
  }

  private getMovementBounds(): MovementBounds {
    let maxX = LEVEL_WIDTH - PLAYER.bodyWidth / 2;

    if (this.flow.encounter1Started && !this.flow.encounter1Cleared) {
      maxX = Math.min(maxX, LEVEL_ZONES.encounter1BlockX);
    }
    if (!this.flow.clueFound) {
      maxX = Math.min(maxX, LEVEL_ZONES.barrierX - 24);
    }

    return { minX: PLAYER.bodyWidth / 2, maxX };
  }

  private checkTriggers() {
    const leadX = Math.max(...this.players.map((player) => player.x));

    if (!this.flow.encounter1Started && leadX >= LEVEL_ZONES.encounter1TriggerX) {
      this.startEncounter1();
    }
    if (this.flow.clueFound && this.flow.state === 'investigate') {
      this.flow.state = 'hallway';
      this.hud.setObjective(OBJECTIVES.hallway);
    }
    if (
      this.flow.clueFound &&
      !this.flow.encounter2Started &&
      leadX >= LEVEL_ZONES.courtTriggerX
    ) {
      this.startEncounter2();
    }
  }

  private startEncounter1() {
    this.flow.encounter1Started = true;
    this.flow.state = 'encounter_1';
    this.encounterBlockGate.setVisible(true);
    this.hud.setObjective(OBJECTIVES.encounter_1);
    soundManager.playEncounterStart();
    this.encounterManager.startBasic(ENEMY_SPAWNS.encounter1, () => {
      this.flow.encounter1Cleared = true;
      this.flow.state = 'investigate';
      this.encounterBlockGate.setVisible(false);
      this.hud.setObjective(OBJECTIVES.investigate);
      this.drawCable(true);
    });
  }

  private startEncounter2() {
    this.flow.encounter2Started = true;
    this.flow.state = 'encounter_2';
    this.hud.setObjective(OBJECTIVES.encounter_2);
    soundManager.playEncounterStart();
    this.encounterManager.startFinal(
      ENEMY_SPAWNS.encounter2.minions,
      ENEMY_SPAWNS.encounter2.miniBoss,
      () => {
        this.flow.encounter2Cleared = true;
        this.flow.state = 'rescue';
        this.hud.setObjective(OBJECTIVES.rescue);
        this.rescuedFriend.setVisible(true);
        applyDepthSort(this.rescuedFriend, this.rescuedFriend.y);
        this.hud.showMessage('RESCATE', RESCUE_LINE, () => {
          this.flow.rescueShown = true;
        });
      },
    );
  }

  private handleInteractions() {
    if (this.flow.state !== 'investigate' && !this.flow.clueFound) {
      this.hud.setInteractHint('');
      return;
    }

    const nearBarrier = this.isAnyPlayerNear(INTERACT_POINTS.barrier);
    const nearProjector = this.isAnyPlayerNear(INTERACT_POINTS.projector);

    if (!this.flow.clueFound && nearBarrier) {
      this.hud.setInteractHint('[Interactuar] Inspeccionar la barrera');
      if (this.interactPressed()) {
        this.flow.barrierInspected = true;
        this.drawCable(true);
        this.hud.showMessage(
          'BARRERA',
          'La barrera no tiene una fuente visible. Un cable se extiende detrás del mostrador.',
          () => undefined,
        );
      }
      return;
    }

    if (!this.flow.clueFound && this.flow.barrierInspected && nearProjector) {
      this.hud.setInteractHint('[Interactuar] Apagar el proyector');
      if (this.interactPressed()) {
        this.disableProjector();
      }
      return;
    }

    if (!this.flow.clueFound && nearBarrier) {
      this.hud.setInteractHint('La barrera sigue activa');
    } else {
      this.hud.setInteractHint('');
    }
  }

  private disableProjector() {
    this.flow.clueFound = true;
    soundManager.playDiscover();
    this.barrierGate.setVisible(false);
    this.projectorProp.setFillStyle(0x4b5563);
    this.tweens.add({
      targets: this.barrierGate,
      alpha: 0,
      duration: 300,
    });
    this.hud.showMessage(
      CLUE.title,
      `${CLUE.subtitle}\n${CLUE.label}\n\n${CLUE.description}`,
      () => {
        this.hud.setObjective(CLUE.nextObjective);
        this.flow.state = 'hallway';
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
    for (const [index, player] of this.players.entries()) {
      const spawn = SPAWN_POINTS[index] ?? SPAWN_POINTS[0];
      player.resetForEncounter(spawn.x, spawn.y);
    }

    if (this.flow.encounter2Started && !this.flow.encounter2Cleared) {
      this.startEncounter2();
      return;
    }

    if (this.flow.encounter1Started && !this.flow.encounter1Cleared) {
      this.startEncounter1();
    }
  }

  private interactPressed() {
    return this.playerInput.interactPressedByAny(this.players.length);
  }

  private isAnyPlayerNear(point: { x: number; y: number; radius: number }) {
    return this.players.some((player) =>
      Phaser.Math.Distance.Between(player.x, player.y, point.x, point.y) <= point.radius,
    );
  }

  private drawCable(visible: boolean) {
    this.cableGfx.clear();
    if (!visible) return;
    this.cableGfx.lineStyle(3, 0xfbbf24, 0.8);
    this.cableGfx.beginPath();
    this.cableGfx.moveTo(LEVEL_ZONES.barrierX - 10, 430);
    this.cableGfx.lineTo(720, 445);
    this.cableGfx.lineTo(660, 455);
    this.cableGfx.strokePath();
  }

  private addZoneLabel(text: string, x: number, y: number) {
    this.add
      .text(x, y, text, { fontFamily: FONTS.mono, fontSize: '18px', color: COLORS.textMuted })
      .setOrigin(0.5)
      .setDepth(y);
  }

  private addProp(x: number, y: number, width: number, height: number, label: string) {
    const baseY = y + height / 2;
    const prop = this.add
      .rectangle(x, baseY, width, height, COLORS.prop)
      .setStrokeStyle(2, COLORS.propBorder);
    this.add
      .text(x, y - 12, label, { fontFamily: FONTS.mono, fontSize: '14px', color: COLORS.text })
      .setOrigin(0.5)
      .setDepth(baseY - 1);
    prop.setDepth(baseY);
  }

  private refreshDepthSorting() {
    sortByDepth(this.depthSorted);
  }
}
