import Phaser from 'phaser';
import { createBossAnimations, createEnemyAnimations, preloadBossAssets, preloadEnemyAssets } from '../enemy/enemyAssets';
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
    preloadBossAssets(this);
    preloadTileAssets(this);
    preloadMenuBackgrounds(this);
  }

  create() {
    createHeroAnimations(this);
    createEnemyAnimations(this);
    createBossAnimations(this);
    registerTileFrames(this);
    this.scene.start('TitleScene');
  }
}
