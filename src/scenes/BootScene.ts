import Phaser from 'phaser';
import { createHeroAnimations, preloadHeroAssets } from '../player/heroAssets';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    preloadHeroAssets(this);
  }

  create() {
    createHeroAnimations(this);
    this.scene.start('TitleScene');
  }
}
