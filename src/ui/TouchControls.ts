import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import type { MovementVector } from '../player/PlayerInput';
import { textStyle } from './theme';

export type TouchAction = 'attack' | 'dodge' | 'special';

const DEPTH = 30_000;
/** Left part of the screen where a touch grabs the joystick. */
const JOYSTICK_ZONE_WIDTH = GAME_WIDTH * 0.45;
const JOYSTICK = { radius: 86, thumbRadius: 38, deadzone: 0.2, restX: 170, restY: GAME_HEIGHT - 150 } as const;

const BUTTONS: readonly { action: TouchAction; label: string; x: number; y: number; radius: number; color: number }[] = [
  { action: 'attack', label: 'GOLPE', x: GAME_WIDTH - 150, y: GAME_HEIGHT - 140, radius: 72, color: 0xef4444 },
  { action: 'dodge', label: 'ESQUIVA', x: GAME_WIDTH - 300, y: GAME_HEIGHT - 90, radius: 52, color: 0x3b82f6 },
  { action: 'special', label: 'ESPECIAL', x: GAME_WIDTH - 110, y: GAME_HEIGHT - 300, radius: 52, color: 0xfbbf24 },
];

/**
 * On-screen controls for phones: a floating joystick on the left half and action buttons
 * on the right. Several fingers can be used at once (move + attack).
 */
export class TouchControls {
  private readonly scene: Phaser.Scene;
  private readonly base: Phaser.GameObjects.Arc;
  private readonly thumb: Phaser.GameObjects.Arc;
  private readonly buttons: { action: TouchAction; circle: Phaser.GameObjects.Arc; color: number }[] = [];
  private joystickPointerId: number | null = null;
  private joystickCenter: { x: number; y: number } = { x: JOYSTICK.restX, y: JOYSTICK.restY };
  private movement: MovementVector = { x: 0, y: 0 };
  /** Presses latched until the game reads them, so a quick tap between frames isn't lost. */
  private readonly pending = new Set<TouchAction>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.base = scene.add
      .circle(JOYSTICK.restX, JOYSTICK.restY, JOYSTICK.radius, 0xffffff, 0.12)
      .setStrokeStyle(3, 0xffffff, 0.35);
    this.thumb = scene.add.circle(JOYSTICK.restX, JOYSTICK.restY, JOYSTICK.thumbRadius, 0xffffff, 0.35);
    for (const object of [this.base, this.thumb]) object.setScrollFactor(0).setDepth(DEPTH);

    for (const button of BUTTONS) {
      const circle = scene.add
        .circle(button.x, button.y, button.radius, button.color, 0.35)
        .setStrokeStyle(3, 0xffffff, 0.6)
        .setScrollFactor(0)
        .setDepth(DEPTH);
      scene.add
        .text(button.x, button.y, button.label, // Phones show the game at about half size, so labels go big.
        textStyle(button.radius > 60 ? 'subheading' : 'bodySmall', { color: '#ffffff', stroke: '#000000', strokeThickness: 3 }))
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(DEPTH + 1);
      this.buttons.push({ action: button.action, circle, color: button.color });
    }

    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
  }

  getMovement(): MovementVector {
    return this.movement;
  }

  /** True once per tap of that button. */
  consumePress(action: TouchAction) {
    return this.pending.delete(action);
  }

  /** Drops any held joystick and pending taps (e.g. fingers lifted while paused). */
  reset() {
    this.pending.clear();
    this.onUp({ id: this.joystickPointerId } as Phaser.Input.Pointer);
  }

  destroy() {
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
  }

  private onDown(pointer: Phaser.Input.Pointer) {
    const button = this.buttonAt(pointer.x, pointer.y);
    if (button) {
      this.pending.add(button.action);
      button.circle.setFillStyle(button.color, 0.75);
      this.scene.time.delayedCall(120, () => button.circle.setFillStyle(button.color, 0.35));
      return;
    }
    if (pointer.x < JOYSTICK_ZONE_WIDTH && this.joystickPointerId === null) {
      // The joystick appears where the thumb lands.
      this.joystickPointerId = pointer.id;
      this.joystickCenter = { x: pointer.x, y: pointer.y };
      this.base.setPosition(pointer.x, pointer.y);
      this.updateThumb(pointer.x, pointer.y);
    }
  }

  private onMove(pointer: Phaser.Input.Pointer) {
    if (pointer.id !== this.joystickPointerId) return;
    this.updateThumb(pointer.x, pointer.y);
  }

  private onUp(pointer: Phaser.Input.Pointer) {
    if (pointer.id !== this.joystickPointerId) return;
    this.joystickPointerId = null;
    this.movement = { x: 0, y: 0 };
    this.joystickCenter = { x: JOYSTICK.restX, y: JOYSTICK.restY };
    this.base.setPosition(JOYSTICK.restX, JOYSTICK.restY);
    this.thumb.setPosition(JOYSTICK.restX, JOYSTICK.restY);
  }

  private updateThumb(x: number, y: number) {
    const dx = x - this.joystickCenter.x;
    const dy = y - this.joystickCenter.y;
    const distance = Math.hypot(dx, dy);
    const clamped = Math.min(distance, JOYSTICK.radius);
    const nx = distance === 0 ? 0 : dx / distance;
    const ny = distance === 0 ? 0 : dy / distance;
    this.thumb.setPosition(this.joystickCenter.x + nx * clamped, this.joystickCenter.y + ny * clamped);

    const strength = clamped / JOYSTICK.radius;
    this.movement = strength < JOYSTICK.deadzone ? { x: 0, y: 0 } : { x: nx * strength, y: ny * strength };
  }

  private buttonAt(x: number, y: number) {
    // A little extra reach: fingers are bigger than the circles look.
    return this.buttons.find((button) => Phaser.Math.Distance.Between(x, y, button.circle.x, button.circle.y) <= button.circle.radius + 14);
  }
}
