import type { PlayerIndex } from '../types/player';

export interface MovementVector {
  x: number;
  y: number;
}

const PLAYER_KEY_CODES: Record<
  PlayerIndex,
  {
    up: string[];
    down: string[];
    left: string[];
    right: string[];
    attack: string;
    dodge: string;
    special: string;
    interact: string;
  }
> = {
  0: {
    up: ['W'],
    down: ['S'],
    left: ['A'],
    right: ['D'],
    attack: 'J',
    dodge: 'SPACE',
    special: 'K',
    interact: 'E',
  },
  1: {
    up: ['UP'],
    down: ['DOWN'],
    left: ['LEFT'],
    right: ['RIGHT'],
    attack: 'L',
    dodge: 'PERIOD',
    special: 'O',
    interact: 'P',
  },
  2: {
    up: ['T'],
    down: ['G'],
    left: ['F'],
    right: ['H'],
    attack: 'Y',
    dodge: 'C',
    special: 'U',
    interact: 'I',
  },
  3: {
    up: ['NUMPAD_8'],
    down: ['NUMPAD_5'],
    left: ['NUMPAD_4'],
    right: ['NUMPAD_6'],
    attack: 'NUMPAD_1',
    dodge: 'NUMPAD_2',
    special: 'NUMPAD_3',
    interact: 'NUMPAD_0',
  },
};

type DirectionKeys = {
  up: Phaser.Input.Keyboard.Key[];
  down: Phaser.Input.Keyboard.Key[];
  left: Phaser.Input.Keyboard.Key[];
  right: Phaser.Input.Keyboard.Key[];
  attack: Phaser.Input.Keyboard.Key;
  dodge: Phaser.Input.Keyboard.Key;
  special: Phaser.Input.Keyboard.Key;
  interact: Phaser.Input.Keyboard.Key;
};

export class PlayerInput {
  private readonly bindings: Record<PlayerIndex, DirectionKeys>;

  constructor(keyboard: Phaser.Input.Keyboard.KeyboardPlugin) {
    this.bindings = {
      0: this.createDirectionKeys(keyboard, PLAYER_KEY_CODES[0]),
      1: this.createDirectionKeys(keyboard, PLAYER_KEY_CODES[1]),
      2: this.createDirectionKeys(keyboard, PLAYER_KEY_CODES[2]),
      3: this.createDirectionKeys(keyboard, PLAYER_KEY_CODES[3]),
    };
  }

  getMovement(playerIndex: PlayerIndex): MovementVector {
    const keys = this.bindings[playerIndex];
    let x = 0;
    let y = 0;

    if (keys.left.some((key) => key.isDown)) x -= 1;
    if (keys.right.some((key) => key.isDown)) x += 1;
    if (keys.up.some((key) => key.isDown)) y -= 1;
    if (keys.down.some((key) => key.isDown)) y += 1;

    if (x !== 0 && y !== 0) {
      const scale = Math.SQRT1_2;
      x *= scale;
      y *= scale;
    }

    return { x, y };
  }

  attackJustPressed(playerIndex: PlayerIndex) {
    return Phaser.Input.Keyboard.JustDown(this.bindings[playerIndex].attack);
  }

  dodgeJustPressed(playerIndex: PlayerIndex) {
    return Phaser.Input.Keyboard.JustDown(this.bindings[playerIndex].dodge);
  }

  specialJustPressed(playerIndex: PlayerIndex) {
    return Phaser.Input.Keyboard.JustDown(this.bindings[playerIndex].special);
  }

  interactJustPressed(playerIndex: PlayerIndex) {
    return Phaser.Input.Keyboard.JustDown(this.bindings[playerIndex].interact);
  }

  specialPressedByAny(activeCount: number) {
    for (let index = 0; index < activeCount; index += 1) {
      if (this.specialJustPressed(index as PlayerIndex)) return true;
    }
    return false;
  }

  interactPressedByAny(activeCount: number) {
    for (let index = 0; index < activeCount; index += 1) {
      if (this.interactJustPressed(index as PlayerIndex)) return true;
    }
    return false;
  }

  private createDirectionKeys(
    keyboard: Phaser.Input.Keyboard.KeyboardPlugin,
    codes: {
      up: string[];
      down: string[];
      left: string[];
      right: string[];
      attack: string;
      dodge: string;
      special: string;
      interact: string;
    },
  ): DirectionKeys {
    return {
      up: codes.up.map((code) => keyboard.addKey(code)),
      down: codes.down.map((code) => keyboard.addKey(code)),
      left: codes.left.map((code) => keyboard.addKey(code)),
      right: codes.right.map((code) => keyboard.addKey(code)),
      attack: keyboard.addKey(codes.attack),
      dodge: keyboard.addKey(codes.dodge),
      special: keyboard.addKey(codes.special),
      interact: keyboard.addKey(codes.interact),
    };
  }
}
