import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { setPlayerCount } from '../systems/session';
import type { PlayerCount } from '../types/player';
import { createButton } from '../ui/createButton';
import { bindMenuInput } from '../ui/menuInput';
import { COLORS, textStyle } from '../ui/theme';
import { addMenuBackground, MENU_TEXTURES } from '../ui/menuBackground';

const OPTIONS: readonly { count: PlayerCount; label: string; detail: string; x: number }[] = [
  {
    count: 1,
    label: '1 JUGADOR',
    detail: 'Teclado (WASD o flechas)\no cualquier control',
    x: GAME_WIDTH / 2 - 190,
  },
  {
    count: 2,
    label: '2 JUGADORES',
    detail: 'J1: WASD o control 1\nJ2: flechas o control 2',
    x: GAME_WIDTH / 2 + 190,
  },
];

const BUTTON = { width: 320, height: 64, y: 330 } as const;

export class PlayerCountScene extends Phaser.Scene {
  private selectedIndex = 0;
  private highlight!: Phaser.GameObjects.Rectangle;

  constructor() {
    super({ key: 'PlayerCountScene' });
  }

  create() {
    this.cameras.main.setBackgroundColor(COLORS.background);
    addMenuBackground(this, MENU_TEXTURES.menu, 0.35);

    this.add
      .text(GAME_WIDTH / 2, 150, '¿Cuántos jugadores?', textStyle('display', {
        color: COLORS.textBright,
      }))
      .setOrigin(0.5);

    this.highlight = this.add
      .rectangle(0, BUTTON.y, BUTTON.width + 16, BUTTON.height + 16)
      .setStrokeStyle(3, 0xffffff);

    for (const option of OPTIONS) {
      createButton(this, {
        x: option.x,
        y: BUTTON.y,
        width: BUTTON.width,
        height: BUTTON.height,
        label: option.label,
        color: option.count === 1 ? COLORS.playerCarol : COLORS.playerJose,
        hoverColor: option.count === 1 ? 0x7aaef7 : 0xf4a37d,
        onClick: () => this.choose(option.count),
      });

      this.add
        .text(option.x, BUTTON.y + 80, option.detail, textStyle('bodySmall', {
          color: COLORS.textMuted,
          align: 'center',
        }))
        .setOrigin(0.5, 0);
    }

    this.add
      .text(
        GAME_WIDTH / 2,
        540,
        'Si usas control, presiona cualquier botón para que el navegador lo detecte.',
        textStyle('bodySmall', { color: COLORS.textMuted }),
      )
      .setOrigin(0.5);

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

    this.select(0);
    bindMenuInput(this, {
      left: () => this.select(0),
      right: () => this.select(1),
      confirm: () => this.choose(OPTIONS[this.selectedIndex].count),
      back: () => this.back(),
      keys: { '1': () => this.choose(1), '2': () => this.choose(2) },
    });
  }

  private select(index: number) {
    this.selectedIndex = index;
    this.highlight.setX(OPTIONS[index].x);
  }

  private choose(count: PlayerCount) {
    setPlayerCount(this.registry, count);
    this.scene.start('LevelSelectScene');
  }

  private back() {
    this.scene.start('TitleScene');
  }
}
