import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';

const UI_ASSET_BASE = './assets/ui';

export const MENU_TEXTURES = {
  title: 'ui-title',
  menu: 'ui-menu-bg',
} as const;

export function preloadMenuBackgrounds(scene: Phaser.Scene) {
  scene.load.image(MENU_TEXTURES.title, `${UI_ASSET_BASE}/title.jpg`);
  scene.load.image(MENU_TEXTURES.menu, `${UI_ASSET_BASE}/menu_bg.jpg`);
}

/**
 * Fills the screen with a background image (cropping to cover).
 * `dim` darkens it so menu text stays readable on top.
 */
export function addMenuBackground(scene: Phaser.Scene, key: string, dim = 0) {
  const image = scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, key);
  image.setScale(Math.max(GAME_WIDTH / image.width, GAME_HEIGHT / image.height));
  if (dim > 0) {
    scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, dim);
  }
  return image;
}
