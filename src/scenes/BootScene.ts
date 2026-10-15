import Phaser from 'phaser';
import { createHeroAnimations, preloadHeroAssets } from '../player/heroAssets';
import { preloadTileAssets, registerTileFrames } from '../world/tileAssets';
import { preloadMenuBackgrounds } from '../ui/menuBackground';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    preloadHeroAssets(this);
    preloadTileAssets(this);
    preloadMenuBackgrounds(this);
  }

  create() {
    createHeroAnimations(this);
    registerTileFrames(this);
    this.scene.start('TitleScene');
  }
}
