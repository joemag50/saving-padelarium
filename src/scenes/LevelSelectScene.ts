import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { LEVELS, type LevelDefinition } from '../data/levels';
import { getRosterCharacter } from '../data/roster';
import { isLevelCompleted, isLevelUnlocked } from '../systems/rosterProgress';
import { getCurrentLevel, setCurrentLevel } from '../systems/session';
import { createButton } from '../ui/createButton';
import { bindMenuInput } from '../ui/menuInput';
import { COLORS, textStyle } from '../ui/theme';
import { addMenuBackground, MENU_TEXTURES } from '../ui/menuBackground';
import { isTouchDevice } from '../systems/device';

const GRID = {
  columns: 3,
  cardWidth: 360,
  cardHeight: 150,
  gapX: 30,
  gapY: 30,
  topY: 170,
} as const;

export class LevelSelectScene extends Phaser.Scene {
  private selectedIndex = 0;
  private highlight!: Phaser.GameObjects.Rectangle;
  private cardPositions: { x: number; y: number }[] = [];

  constructor() {
    super({ key: 'LevelSelectScene' });
  }

  create() {
    this.cameras.main.setBackgroundColor(COLORS.background);
    addMenuBackground(this, MENU_TEXTURES.menu, 0.35);
    this.cardPositions = [];

    this.add
      .text(GAME_WIDTH / 2, 70, 'Elige un nivel', textStyle('display', {
        color: COLORS.textBright,
      }))
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 115, 'Completa un nivel para desbloquear el siguiente y a los amigos que rescates.', textStyle('bodySmall', {
        color: COLORS.textMuted,
      }))
      .setOrigin(0.5);

    const rowWidth = GRID.columns * GRID.cardWidth + (GRID.columns - 1) * GRID.gapX;
    const originX = (GAME_WIDTH - rowWidth) / 2 + GRID.cardWidth / 2;
    LEVELS.forEach((level, index) => {
      const x = originX + (index % GRID.columns) * (GRID.cardWidth + GRID.gapX);
      const y = GRID.topY + GRID.cardHeight / 2 + Math.floor(index / GRID.columns) * (GRID.cardHeight + GRID.gapY);
      this.cardPositions.push({ x, y });
      this.createLevelCard(level, index, x, y);
    });

    this.highlight = this.add
      .rectangle(0, 0, GRID.cardWidth + 12, GRID.cardHeight + 12)
      .setStrokeStyle(3, 0xffffff);

    createButton(this, {
      x: 120,
      y: GAME_HEIGHT - 88,
      width: 160,
      height: 44,
      label: 'ATRÁS',
      color: COLORS.prop,
      hoverColor: COLORS.propBorder,
      onClick: () => this.back(),
    });

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 44, '← → para elegir · Enter, J o botón A para jugar · Esc o B para volver', textStyle('label', {
        color: COLORS.textMuted,
      }))
      .setOrigin(0.5);

    this.select(this.initialIndex());
    bindMenuInput(this, {
      left: () => this.move(-1),
      right: () => this.move(1),
      confirm: () => this.play(this.selectedIndex),
      back: () => this.back(),
    });
  }

  /** Last level played, or the furthest level unlocked so far. */
  private initialIndex() {
    const current = LEVELS.findIndex((level) => level.id === getCurrentLevel(this.registry).id);
    const furthest = LEVELS.reduce((best, level, index) => (isLevelUnlocked(level.id) ? index : best), 0);
    if (this.registry.has('levelId') && current >= 0 && isLevelUnlocked(LEVELS[current].id)) return current;
    return furthest;
  }

  private createLevelCard(level: LevelDefinition, index: number, x: number, y: number) {
    const unlocked = isLevelUnlocked(level.id);
    const completed = isLevelCompleted(level.id);
    const { cardWidth, cardHeight } = GRID;

    const background = this.add
      .rectangle(x, y, cardWidth, cardHeight, unlocked ? level.palette.floor : 0x2b303b)
      .setStrokeStyle(2, COLORS.propBorder)
      .setAlpha(unlocked ? 1 : 0.5);

    const status = completed ? '✓ COMPLETADO' : unlocked ? 'DISPONIBLE' : 'BLOQUEADO';
    this.add
      .text(x - cardWidth / 2 + 16, y - cardHeight / 2 + 12, `NIVEL ${level.id} · ${status}`, textStyle('label', {
        color: completed ? '#86efac' : COLORS.textMuted,
      }))
      .setAlpha(unlocked ? 1 : 0.6);

    this.add
      .text(x, y - 8, unlocked ? level.title : '???', textStyle('heading', {
        color: COLORS.textBright,
      }))
      .setOrigin(0.5)
      .setAlpha(unlocked ? 1 : 0.6);

    const names = level.rescue.characters.map((id) => getRosterCharacter(id).name).join(' y ');
    const detail = unlocked ? `Rescata a ${names}` : `Completa el nivel ${level.id - 1}`;
    this.add
      .text(x, y + 38, detail, textStyle('bodySmall'))
      .setOrigin(0.5)
      .setAlpha(unlocked ? 1 : 0.6);

    if (unlocked) {
      background.setInteractive({ useHandCursor: true });
      background.on('pointerover', () => this.select(index));
      background.on('pointerdown', () => this.play(index));
    }
  }

  /** Moves the cursor to the previous/next unlocked level, wrapping around. */
  private move(step: 1 | -1) {
    for (let offset = 1; offset <= LEVELS.length; offset += 1) {
      const index = (this.selectedIndex + step * offset + LEVELS.length) % LEVELS.length;
      if (isLevelUnlocked(LEVELS[index].id)) {
        this.select(index);
        return;
      }
    }
  }

  private select(index: number) {
    this.selectedIndex = index;
    const position = this.cardPositions[index];
    this.highlight.setPosition(position.x, position.y);
  }

  private play(index: number) {
    const level = LEVELS[index];
    if (!level || !isLevelUnlocked(level.id)) return;
    setCurrentLevel(this.registry, level.id);
    this.scene.start('CharacterSelectScene');
  }

  private back() {
    // Phones skip the player count screen, so "back" goes to the title.
    this.scene.start(isTouchDevice() ? 'TitleScene' : 'PlayerCountScene');
  }
}
