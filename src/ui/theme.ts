import type Phaser from 'phaser';

export const COLORS = {
  background: 0x1a1f2e,
  floor: 0x3a3f4b,
  floorLine: 0x4a5060,
  wall: 0x2b303b,
  prop: 0x505868,
  propBorder: 0x6a7080,
  playerCarol: 0x5b8def,
  playerJose: 0xef8b5b,
  text: '#e6edf3',
  textMuted: '#9da7b3',
  textBright: '#ffffff',
} as const;

/** Single typeface for the whole game. Change it here and every text follows. */
export const FONT_FAMILY = '"Courier New", Courier, monospace';

/**
 * Typography scale. Every text in the game uses one of these variants via `textStyle()`,
 * so size, weight and outline can be tuned in one place.
 */
export const TEXT_VARIANTS = {
  /** Screen titles: "¿Cuántos jugadores?", "Elige un nivel"… */
  display: { fontSize: 42, bold: true, stroke: 6 },
  /** Card titles and message headers. */
  heading: { fontSize: 28, bold: true, stroke: 5 },
  /** Buttons and big story lines. */
  subheading: { fontSize: 22, bold: true, stroke: 4 },
  /** Objectives, dialogue, character names. */
  body: { fontSize: 20, bold: false, stroke: 4 },
  /** Instructions and secondary lines. */
  bodySmall: { fontSize: 16, bold: false, stroke: 4 },
  /** Key hints, actor and prop labels. */
  label: { fontSize: 14, bold: false, stroke: 3 },
  /** Tiny status tags and HUD captions. */
  caption: { fontSize: 12, bold: false, stroke: 0 },
} as const;

export type TextVariant = keyof typeof TEXT_VARIANTS;

/** Builds a Phaser text style from a variant; `overrides` win (e.g. color, align, wordWrap). */
export function textStyle(
  variant: TextVariant,
  overrides: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  const { fontSize, bold, stroke } = TEXT_VARIANTS[variant];
  return {
    fontFamily: FONT_FAMILY,
    fontSize: `${fontSize}px`,
    fontStyle: bold ? 'bold' : 'normal',
    color: COLORS.text,
    stroke: '#000000',
    strokeThickness: stroke,
    ...overrides,
  };
}
