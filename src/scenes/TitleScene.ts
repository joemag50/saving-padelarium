import Phaser from 'phaser';
import { COLORS, FONTS } from '../ui/theme';
import { createButton } from '../ui/createButton';
import { bindMenuInput } from '../ui/menuInput';
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
      .text(GAME_WIDTH / 2, 210, 'Invasión de Mentira', {
        fontFamily: FONTS.mono,
        fontSize: '22px',
        color: COLORS.textMuted,
      })
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2,
        310,
        'Padelarium fue tomado por unos supuestos extraterrestres.\nPelea por el club, descubre el engaño\ny rescata a tu amigo.',
        {
          fontFamily: FONTS.ui,
          fontSize: '22px',
          color: COLORS.text,
          align: 'center',
        },
      )
      .setOrigin(0.5);

    const play = () => this.scene.start('PlayerCountScene');

    createButton(this, {
      x: GAME_WIDTH / 2,
      y: 470,
      width: 280,
      height: 56,
      label: 'JUGAR',
      color: COLORS.playerCarol,
      hoverColor: 0x7aaef7,
      onClick: play,
    });

    this.add
      .text(GAME_WIDTH / 2, 530, 'Enter o botón A para empezar', {
        fontFamily: FONTS.mono,
        fontSize: '14px',
        color: COLORS.textMuted,
      })
      .setOrigin(0.5);

    bindMenuInput(this, { confirm: play });
  }
}
