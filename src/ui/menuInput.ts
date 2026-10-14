import Phaser from 'phaser';

type MenuHandlers = {
  left?: () => void;
  right?: () => void;
  confirm?: () => void;
  back?: () => void;
  /** Extra keyboard shortcuts keyed by `KeyboardEvent.key`, e.g. `{ '1': ... }`. */
  keys?: Record<string, () => void>;
};

/** Standard-mapping gamepad button indices. */
const PAD = { a: 0, b: 1, start: 9, left: 14, right: 15 } as const;

/** Lets menus be driven by keyboard or any gamepad, in addition to mouse/touch. */
export function bindMenuInput(scene: Phaser.Scene, handlers: MenuHandlers) {
  const onKey = (event: KeyboardEvent) => {
    if (event.repeat) return;
    const shortcut = handlers.keys?.[event.key];
    if (shortcut) return shortcut();
    switch (event.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        return handlers.left?.();
      case 'ArrowRight':
      case 'd':
      case 'D':
        return handlers.right?.();
      case 'Enter':
      case ' ':
        return handlers.confirm?.();
      case 'Escape':
      case 'Backspace':
        return handlers.back?.();
    }
  };

  const onPad = (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
    switch (button.index) {
      case PAD.left:
        return handlers.left?.();
      case PAD.right:
        return handlers.right?.();
      case PAD.a:
      case PAD.start:
        return handlers.confirm?.();
      case PAD.b:
        return handlers.back?.();
    }
  };

  scene.input.keyboard?.on('keydown', onKey);
  scene.input.gamepad?.on('down', onPad);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.input.keyboard?.off('keydown', onKey);
    scene.input.gamepad?.off('down', onPad);
  });
}
