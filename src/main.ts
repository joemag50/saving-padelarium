import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config/constants';
import { DEBUG_MODE } from './config/debug';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { PlayerCountScene } from './scenes/PlayerCountScene';
import { LevelSelectScene } from './scenes/LevelSelectScene';
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
  scene: [BootScene, TitleScene, PlayerCountScene, LevelSelectScene, CharacterSelectScene, LevelScene, EndScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

const game = new Phaser.Game(config);
// `?debug` exposes the game to the browser console for testing.
if (DEBUG_MODE) (window as unknown as { __game?: Phaser.Game }).__game = game;

export default game;
