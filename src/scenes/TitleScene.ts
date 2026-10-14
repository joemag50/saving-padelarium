import Phaser from 'phaser';
import { COLORS, FONTS } from '../ui/theme';
import { createButton } from '../ui/createButton';
import { GAME_WIDTH } from '../config/constants';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
  }

  create() {
    this.cameras.main.setBackgroundColor(COLORS.background);

    this.add
      .text(GAME_WIDTH / 2, 140, 'Padelarium', {
        fontFamily: FONTS.title,
        fontSize: '56px',
        color: COLORS.textBright,
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 210, 'Invasion of Lies — MVP', {
        fontFamily: FONTS.mono,
        fontSize: '22px',
        color: COLORS.textMuted,
      })
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2,
        310,
        'Padelarium has been overrun by fake aliens.\nFight through the club, uncover the hoax,\nand rescue your friend.',
        {
          fontFamily: FONTS.ui,
          fontSize: '22px',
          color: COLORS.text,
          align: 'center',
        },
      )
      .setOrigin(0.5);

    createButton(this, {
      x: GAME_WIDTH / 2,
      y: 470,
      width: 280,
      height: 56,
      label: 'CHOOSE PLAYERS',
      color: COLORS.playerCarol,
      hoverColor: 0x7aaef7,
      onClick: () => this.scene.start('CharacterSelectScene'),
    });
  }
}
