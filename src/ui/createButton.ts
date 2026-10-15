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
