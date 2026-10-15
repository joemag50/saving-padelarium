import Phaser from 'phaser';
import { COLORS, textStyle } from '../ui/theme';
import { createButton } from '../ui/createButton';
import { bindMenuInput } from '../ui/menuInput';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { addMenuBackground, MENU_TEXTURES } from '../ui/menuBackground';
import { isTouchDevice } from '../systems/device';
import { setPlayerCount } from '../systems/session';
import { installMethod, isInstalledApp, promptInstall } from '../systems/install';
import { BOTTOM_BUTTON_Y } from '../ui/layout';

const INSTALL_BUTTON = { x: GAME_WIDTH - 120, y: 56, width: 190, height: 48 } as const;

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
      // The installed app already fills the screen.
      if (!isInstalledApp() && this.scale.fullscreen.available && !this.scale.isFullscreen) this.scale.startFullscreen();
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

    if (touch) this.addInstallButton();

    bindMenuInput(this, { confirm: play });
  }

  /**
   * Phones only, until the game is on the home screen. Android's dialog can become available
   * after this screen is up, so the button may appear a moment later.
   */
  private addInstallButton() {
    let button: Phaser.GameObjects.Container | undefined;
    const show = () => {
      const method = installMethod();
      if (button || !method) return;
      button = createButton(this, {
        ...INSTALL_BUTTON,
        label: 'INSTALAR',
        color: COLORS.prop,
        hoverColor: COLORS.propBorder,
        onClick: () => {
          if (method === 'ios-steps') return this.showIosSteps();
          void promptInstall().then((accepted) => {
            if (accepted) button?.destroy();
          });
        },
      });
    };
    show();
    window.addEventListener('beforeinstallprompt', show);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('beforeinstallprompt', show));
  }

  /** iPhone can't open an install dialog: explain Safari's steps. Tap anywhere to close. */
  private showIosSteps() {
    const panel = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(100);
    const shade = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7).setInteractive();
    const box = this.add.rectangle(0, 0, 640, 260, 0x0f172a, 0.95).setStrokeStyle(2, COLORS.propBorder);
    const title = this.add.text(0, -80, 'INSTALAR EN TU IPHONE', textStyle('heading', { color: COLORS.textBright })).setOrigin(0.5);
    const steps = this.add
      .text(0, 10, '1. Toca el botón Compartir de Safari.\n2. Elige "Agregar a inicio".\n3. Abre Padelirium desde su ícono.', textStyle('body', { color: COLORS.text, lineSpacing: 10 }))
      .setOrigin(0.5);
    const close = this.add.text(0, 100, 'Toca para cerrar', textStyle('bodySmall', { color: COLORS.textMuted })).setOrigin(0.5);
    panel.add([shade, box, title, steps, close]);
    shade.once('pointerdown', () => panel.destroy());
  }
}
