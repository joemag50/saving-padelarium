import Phaser from 'phaser';
import { COLORS } from '../ui/theme';
import { createButton } from '../ui/createButton';
import { bindMenuInput } from '../ui/menuInput';
import { GAME_WIDTH } from '../config/constants';
import { addMenuBackground, MENU_TEXTURES } from '../ui/menuBackground';
import { isTouchDevice } from '../systems/device';
import { setPlayerCount } from '../systems/session';
import { BOTTOM_BUTTON_Y } from '../ui/layout';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
  }

  create() {
    // The artwork already carries the logo and subtitle.
    addMenuBackground(this, MENU_TEXTURES.title);

    const touch = isTouchDevice();
    const play = () => {
      // Phones play solo: skip the player count screen.
      if (!touch) return this.scene.start('PlayerCountScene');
      setPlayerCount(this.registry, 1);
      if (this.scale.fullscreen.available && !this.scale.isFullscreen) this.scale.startFullscreen();
      this.scene.start('LevelSelectScene');
    };

    createButton(this, {
      x: GAME_WIDTH / 2,
      y: BOTTOM_BUTTON_Y - 20,
      width: 280,
      height: 56,
      label: 'JUGAR',
      color: COLORS.playerCarol,
      hoverColor: 0x7aaef7,
      onClick: play,
    });


    bindMenuInput(this, { confirm: play });
  }
}
