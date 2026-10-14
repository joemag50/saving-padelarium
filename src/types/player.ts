export type PlayerIndex = 0 | 1;

export type PlayerCount = 1 | 2;

export const MAX_PLAYERS = 2;

export interface PlayerConfig {
  index: PlayerIndex;
  name: string;
  color: number;
  spawnX: number;
  spawnY: number;
}

export const KEYBOARD_CONTROL_HINTS = [
  'WASD · J golpe · K especial · Espacio esquiva · E usar',
  'Flechas · L golpe · O especial · . esquiva · P usar',
] as const;

export const GAMEPAD_CONTROL_HINT = 'Control: X golpe · Y especial · A esquiva · B usar';

export function getControlHintLines(playerCount: PlayerCount): string[] {
  if (playerCount === 1) {
    return [...KEYBOARD_CONTROL_HINTS, GAMEPAD_CONTROL_HINT];
  }
  return [
    `J1: ${KEYBOARD_CONTROL_HINTS[0]} · o control 1`,
    `J2: ${KEYBOARD_CONTROL_HINTS[1]} · o control 2`,
    GAMEPAD_CONTROL_HINT,
  ];
}
