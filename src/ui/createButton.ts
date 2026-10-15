import Phaser from 'phaser';
import { COLORS, textStyle } from './theme';

type ButtonConfig = {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  color: number;
  hoverColor: number;
  onClick: () => void;
};

export function createButton(scene: Phaser.Scene, config: ButtonConfig) {
  const container = scene.add.container(config.x, config.y);
  const background = scene.add
    .rectangle(0, 0, config.width, config.height, config.color)
    .setStrokeStyle(2, COLORS.propBorder);
  const label = scene.add
    .text(0, 0, config.label, textStyle('subheading', {
      color: COLORS.textBright,
    }))
    .setOrigin(0.5);

  background.setInteractive({ useHandCursor: true });
  background.on('pointerover', () => background.setFillStyle(config.hoverColor));
  background.on('pointerout', () => background.setFillStyle(config.color));
  background.on('pointerdown', config.onClick);

  container.add([background, label]);
  return container;
}

/**
 * Keyboard/gamepad focus ring for menus: a yellow frame drawn around the focused button
 * or card. `show` moves it; `hide` removes it.
 */
export function createFocusRing(scene: Phaser.Scene) {
  const ring = scene.add.rectangle(0, 0, 10, 10).setStrokeStyle(4, FOCUS_COLOR).setDepth(1_000).setVisible(false);
  scene.tweens.add({ targets: ring, alpha: 0.45, duration: 450, yoyo: true, repeat: -1 });
  return {
    show(x: number, y: number, width: number, height: number) {
      ring.setPosition(x, y).setSize(width + 14, height + 14).setVisible(true);
      // setSize keeps the old stroke geometry; refresh it so the frame wraps the new size.
      ring.setStrokeStyle(4, FOCUS_COLOR);
    },
    hide() {
      ring.setVisible(false);
    },
  };
}

const FOCUS_COLOR = 0xfde047;
