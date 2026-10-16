import Phaser from 'phaser';
import { createEnemyAnimations, preloadEnemyAssets } from '../enemy/enemyAssets';
import { createHeroAnimations, preloadHeroAssets } from '../player/heroAssets';
import { preloadTileAssets, registerTileFrames } from '../world/tileAssets';
import { preloadMenuBackgrounds } from '../ui/menuBackground';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    preloadHeroAssets(this);
    preloadEnemyAssets(this);
    preloadTileAssets(this);
    preloadMenuBackgrounds(this);
  }

  create() {
    createHeroAnimations(this);
    createEnemyAnimations(this);
    registerTileFrames(this);
    this.scene.start('TitleScene');
  }
}
