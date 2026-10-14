import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config/constants';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { PlayerCountScene } from './scenes/PlayerCountScene';
import { CharacterSelectScene } from './scenes/CharacterSelectScene';
import { LevelScene } from './scenes/LevelScene';
import { EndScene } from './scenes/EndScene';
import './style.css';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#1a1f2e',
  input: { gamepad: true },
  scene: [BootScene, TitleScene, PlayerCountScene, CharacterSelectScene, LevelScene, EndScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

export default new Phaser.Game(config);
