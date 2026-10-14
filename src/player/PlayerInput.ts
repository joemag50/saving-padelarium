import Phaser from 'phaser';
import type { PlayerCount, PlayerIndex } from '../types/player';

export interface MovementVector {
  x: number;
  y: number;
}

type Action = 'attack' | 'dodge' | 'special' | 'interact';

type KeyCodes = {
  up: string;
  down: string;
  left: string;
  right: string;
} & Record<Action, string>;

type KeySet = {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
} & Record<Action, Phaser.Input.Keyboard.Key>;

const KEYBOARD_LAYOUTS: readonly KeyCodes[] = [
  { up: 'W', down: 'S', left: 'A', right: 'D', attack: 'J', dodge: 'SPACE', special: 'K', interact: 'E' },
  { up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT', attack: 'L', dodge: 'PERIOD', special: 'O', interact: 'P' },
];

/** Standard-mapping gamepad button indices (Xbox labels). */
const PAD_BUTTONS: Record<Action, number> = {
  dodge: 0, // A
  interact: 1, // B
  attack: 2, // X
  special: 3, // Y
};

const STICK_DEADZONE = 0.25;

/**
 * Merges keyboard and gamepad input per player.
 * Solo: P1 listens to both keyboard layouts and every connected gamepad.
 * Two players: each player gets one keyboard layout plus the Nth connected gamepad.
 */
export class PlayerInput {
  private readonly keySets: KeySet[];
  private readonly gamepad: Phaser.Input.Gamepad.GamepadPlugin | null;
  private readonly pendingPadPresses = new Set<string>();
  private readonly playerCount: PlayerCount;

  constructor(
    keyboard: Phaser.Input.Keyboard.KeyboardPlugin,
    gamepad: Phaser.Input.Gamepad.GamepadPlugin | null,
    playerCount: PlayerCount,
  ) {
    this.playerCount = playerCount;
    this.keySets = KEYBOARD_LAYOUTS.map((codes) => createKeySet(keyboard, codes));
    this.gamepad = gamepad;
    // Latch presses so a tap between frames is never lost, mirroring Key.JustDown semantics.
    gamepad?.on('down', this.onPadDown, this);
  }

  destroy() {
    this.gamepad?.off('down', this.onPadDown, this);
    this.pendingPadPresses.clear();
  }

  getMovement(playerIndex: PlayerIndex): MovementVector {
    let x = 0;
    let y = 0;

    for (const keys of this.keySetsFor(playerIndex)) {
      if (keys.left.isDown) x -= 1;
      if (keys.right.isDown) x += 1;
      if (keys.up.isDown) y -= 1;
      if (keys.down.isDown) y += 1;
    }

    for (const pad of this.padsFor(playerIndex)) {
      if (pad.left) x -= 1;
      if (pad.right) x += 1;
      if (pad.up) y -= 1;
      if (pad.down) y += 1;
      const stick = pad.leftStick;
      if (stick.length() > STICK_DEADZONE) {
        x += stick.x;
        y += stick.y;
      }
    }

    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }

    return { x, y };
  }

  attackJustPressed(playerIndex: PlayerIndex) {
    return this.justPressed(playerIndex, 'attack');
  }

  dodgeJustPressed(playerIndex: PlayerIndex) {
    return this.justPressed(playerIndex, 'dodge');
  }

  specialPressedByAny(activeCount: number) {
    return this.pressedByAny(activeCount, 'special');
  }

  interactPressedByAny(activeCount: number) {
    return this.pressedByAny(activeCount, 'interact');
  }

  private pressedByAny(activeCount: number, action: Action) {
    let pressed = false;
    for (let index = 0; index < activeCount; index += 1) {
      // Check every player so stale presses are consumed rather than firing later.
      if (this.justPressed(index as PlayerIndex, action)) pressed = true;
    }
    return pressed;
  }

  private justPressed(playerIndex: PlayerIndex, action: Action) {
    let pressed = false;
    for (const keys of this.keySetsFor(playerIndex)) {
      if (Phaser.Input.Keyboard.JustDown(keys[action])) pressed = true;
    }
    for (const pad of this.padsFor(playerIndex)) {
      if (this.pendingPadPresses.delete(padPressKey(pad.index, PAD_BUTTONS[action]))) pressed = true;
    }
    return pressed;
  }

  private keySetsFor(playerIndex: PlayerIndex): KeySet[] {
    if (this.playerCount === 1) return this.keySets;
    const keys = this.keySets[playerIndex];
    return keys ? [keys] : [];
  }

  private padsFor(playerIndex: PlayerIndex): Phaser.Input.Gamepad.Gamepad[] {
    const pads = (this.gamepad?.getAll() ?? []).filter((pad) => pad?.connected);
    if (this.playerCount === 1) return pads;
    const pad = pads[playerIndex];
    return pad ? [pad] : [];
  }

  private onPadDown(pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) {
    this.pendingPadPresses.add(padPressKey(pad.index, button.index));
  }
}

function padPressKey(padIndex: number, buttonIndex: number) {
  return `${padIndex}:${buttonIndex}`;
}

function createKeySet(keyboard: Phaser.Input.Keyboard.KeyboardPlugin, codes: KeyCodes): KeySet {
  return {
    up: keyboard.addKey(codes.up),
    down: keyboard.addKey(codes.down),
    left: keyboard.addKey(codes.left),
    right: keyboard.addKey(codes.right),
    attack: keyboard.addKey(codes.attack),
    dodge: keyboard.addKey(codes.dodge),
    special: keyboard.addKey(codes.special),
    interact: keyboard.addKey(codes.interact),
  };
}
