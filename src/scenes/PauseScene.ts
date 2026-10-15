import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { createButton, createFocusRing } from '../ui/createButton';
import { bindMenuInput } from '../ui/menuInput';
import { COLORS, textStyle } from '../ui/theme';

const BUTTON = { width: 320, height: 56, gap: 76, firstY: GAME_HEIGHT / 2 - 40 } as const;

/**
 * Overlay shown on top of a paused LevelScene. Arrows pick an option, confirm presses it;
 * Esc, P or the gamepad's back button resume.
 */
export class PauseScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PauseScene' });
  }

  create() {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.65);
    this.add.text(GAME_WIDTH / 2, BUTTON.firstY - 110, 'PAUSA', textStyle('display', { color: COLORS.textBright })).setOrigin(0.5);

    const options = [
      { label: 'CONTINUAR', color: COLORS.playerCarol, hover: 0x7aaef7, action: () => this.resumeLevel() },
      { label: 'REINICIAR NIVEL', color: COLORS.prop, hover: COLORS.propBorder, action: () => this.restartLevel() },
      { label: 'MENÚ PRINCIPAL', color: COLORS.prop, hover: COLORS.propBorder, action: () => this.toMenu() },
    ];
    options.forEach((option, index) => {
      createButton(this, {
        x: GAME_WIDTH / 2,
        y: BUTTON.firstY + index * BUTTON.gap,
        width: BUTTON.width,
        height: BUTTON.height,
        label: option.label,
        color: option.color,
        hoverColor: option.hover,
        onClick: option.action,
      });
    });

    let focused = 0;
    const ring = createFocusRing(this);
    const showFocus = () => ring.show(GAME_WIDTH / 2, BUTTON.firstY + focused * BUTTON.gap, BUTTON.width, BUTTON.height);
    const move = (step: number) => {
      focused = Phaser.Math.Wrap(focused + step, 0, options.length);
      showFocus();
    };
    showFocus();

    bindMenuInput(this, {
      up: () => move(-1),
      down: () => move(1),
      confirm: () => options[focused].action(),
      back: () => this.resumeLevel(),
      keys: { p: () => this.resumeLevel(), P: () => this.resumeLevel() },
    });
  }

  private resumeLevel() {
    this.scene.resume('LevelScene');
    this.scene.stop();
  }

  /** `start` from here also closes this overlay. */
  private restartLevel() {
    this.scene.stop('LevelScene');
    this.scene.start('LevelScene');
  }

  private toMenu() {
    this.scene.stop('LevelScene');
    this.scene.start('TitleScene');
  }
}
