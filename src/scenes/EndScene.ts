import Phaser from 'phaser';
import { EPILOGUE } from '../data/epilogue';
import { getNextLevel } from '../data/levels';
import { ROSTER } from '../data/roster';
import { markLevelCompleted } from '../systems/rosterProgress';
import { getCurrentLevel, setCurrentLevel } from '../systems/session';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { COLORS, textStyle } from '../ui/theme';
import { createButton } from '../ui/createButton';
import { addMenuBackground, MENU_TEXTURES } from '../ui/menuBackground';
import { bindMenuInput } from '../ui/menuInput';

/** Delay between epilogue lines appearing. */
const EPILOGUE_LINE_MS = 1600;

export class EndScene extends Phaser.Scene {
  constructor() {
    super({ key: 'EndScene' });
  }

  create() {
    const level = getCurrentLevel(this.registry);
    const nextLevel = getNextLevel(level.id);
    markLevelCompleted(level.id);
    if (!nextLevel) {
      this.showEpilogue();
      return;
    }

    this.cameras.main.setBackgroundColor(level.palette.background);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, 'NIVEL COMPLETADO', textStyle('display', {
        color: COLORS.textBright,
      }))
      .setOrigin(0.5);

    const goToNext = () => {
      setCurrentLevel(this.registry, nextLevel.id);
      // The team chosen at the start plays the whole run; it stays in the registry.
      this.scene.start('LevelScene');
    };
    const toMenu = () => this.scene.start('TitleScene');

    createButton(this, {
      x: GAME_WIDTH / 2 - 140,
      y: GAME_HEIGHT - 110,
      width: 260,
      height: 52,
      label: 'SIGUIENTE NIVEL',
      color: COLORS.playerCarol,
      hoverColor: 0x7aaef7,
      onClick: goToNext,
    });

    createButton(this, {
      x: GAME_WIDTH / 2 + 140,
      y: GAME_HEIGHT - 110,
      width: 240,
      height: 52,
      label: 'MENÚ PRINCIPAL',
      color: COLORS.prop,
      hoverColor: COLORS.propBorder,
      onClick: toMenu,
    });

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 50, 'Enter, J o botón A: siguiente nivel · Esc o B: menú', textStyle('label', {
        color: COLORS.textMuted,
      }))
      .setOrigin(0.5);

    bindMenuInput(this, { confirm: goToNext, back: toMenu });
  }

  /** After the last level: the epilogue appears line by line, then the cast and a way back to the menu. */
  private showEpilogue() {
    addMenuBackground(this, MENU_TEXTURES.menu, 0.6);

    this.add.text(GAME_WIDTH / 2, 70, EPILOGUE.title, textStyle('display', { color: COLORS.textBright })).setOrigin(0.5);

    // Stacked by real height: some lines wrap to two rows.
    let nextY = 130;
    const reveals: Phaser.GameObjects.Text[] = EPILOGUE.lines.map((line) => {
      const text = this.add
        .text(GAME_WIDTH / 2, nextY, line, textStyle('body', { align: 'center', wordWrap: { width: 1040 } }))
        .setOrigin(0.5, 0)
        .setAlpha(0);
      nextY += text.height + 16;
      return text;
    });
    reveals.push(
      this.add.text(GAME_WIDTH / 2, 530, EPILOGUE.thanks, textStyle('heading', { color: '#fbbf24' })).setOrigin(0.5).setAlpha(0),
      this.add
        .text(GAME_WIDTH / 2, 572, ROSTER.map((character) => character.name).join(' · '), textStyle('label', { color: COLORS.textMuted }))
        .setOrigin(0.5)
        .setAlpha(0),
    );

    reveals.forEach((text, index) => {
      this.tweens.add({ targets: text, alpha: 1, delay: 400 + index * EPILOGUE_LINE_MS, duration: 700 });
    });

    // First press shows everything at once; once it's all visible, it goes back to the menu.
    const toMenu = () => {
      if (reveals.some((text) => text.alpha < 1)) {
        this.tweens.killAll();
        reveals.forEach((text) => text.setAlpha(1));
        return;
      }
      this.scene.start('TitleScene');
    };

    createButton(this, {
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT - 72,
      width: 260,
      height: 52,
      label: 'MENÚ PRINCIPAL',
      color: COLORS.playerCarol,
      hoverColor: 0x7aaef7,
      onClick: () => this.scene.start('TitleScene'),
    });

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 26, 'Enter, J o botón A: continuar', textStyle('label', { color: COLORS.textMuted }))
      .setOrigin(0.5);

    bindMenuInput(this, { confirm: toMenu, back: toMenu });
  }
}
