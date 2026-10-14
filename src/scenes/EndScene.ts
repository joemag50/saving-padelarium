import Phaser from 'phaser';
import { END_SCREEN } from '../data/levelFlow';
import { getRosterCharacter } from '../data/roster';
import { unlockMvpRescueCharacter } from '../systems/rosterProgress';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { COLORS, FONTS } from '../ui/theme';
import { createButton } from '../ui/createButton';
import { bindMenuInput } from '../ui/menuInput';

export class EndScene extends Phaser.Scene {
  constructor() {
    super({ key: 'EndScene' });
  }

  create() {
    unlockMvpRescueCharacter();
    const rescued = getRosterCharacter('rody');
    this.cameras.main.setBackgroundColor(COLORS.background);

    this.add
      .text(GAME_WIDTH / 2, 120, END_SCREEN.headline, {
        fontFamily: FONTS.title,
        fontSize: '42px',
        color: COLORS.textBright,
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 190, END_SCREEN.reveal, {
        fontFamily: FONTS.ui,
        fontSize: '26px',
        color: COLORS.text,
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 240, END_SCREEN.subreveal, {
        fontFamily: FONTS.ui,
        fontSize: '22px',
        color: COLORS.textMuted,
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 330, `${END_SCREEN.rescued}: ${rescued.name}\n${END_SCREEN.continuation}`, {
        fontFamily: FONTS.mono,
        fontSize: '20px',
        color: COLORS.text,
        align: 'center',
      })
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2,
        430,
        'Si los aliens son falsos, ¿quién organizó el ataque\ny por qué quieren Padelarium?',
        {
          fontFamily: FONTS.ui,
          fontSize: '20px',
          color: '#fbbf24',
          align: 'center',
        },
      )
      .setOrigin(0.5);

    createButton(this, {
      x: GAME_WIDTH / 2 - 160,
      y: GAME_HEIGHT - 100,
      width: 240,
      height: 52,
      label: 'REINICIAR NIVEL',
      color: COLORS.playerCarol,
      hoverColor: 0x7aaef7,
      onClick: () => this.scene.start('CharacterSelectScene'),
    });

    createButton(this, {
      x: GAME_WIDTH / 2 + 160,
      y: GAME_HEIGHT - 100,
      width: 240,
      height: 52,
      label: 'MENÚ PRINCIPAL',
      color: COLORS.prop,
      hoverColor: COLORS.propBorder,
      onClick: () => this.scene.start('TitleScene'),
    });

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 44, 'Enter o botón A para reiniciar · Esc o B para el menú', {
        fontFamily: FONTS.mono,
        fontSize: '14px',
        color: COLORS.textMuted,
      })
      .setOrigin(0.5);

    bindMenuInput(this, {
      confirm: () => this.scene.start('CharacterSelectScene'),
      back: () => this.scene.start('TitleScene'),
    });
  }
}
