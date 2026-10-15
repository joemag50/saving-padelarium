import Phaser from 'phaser';

/**
 * LimeZu "Modern Interiors" free pack (48×48). Free license: non-commercial use only,
 * see `public/assets/tiles/LICENSE.txt`.
 */
const TILE_ASSET_BASE = './assets/tiles';

export const TILE_TEXTURES = {
  roomBuilder: 'tiles-room-builder',
  interiors: 'tiles-interiors',
} as const;

/** Every tile sprite is drawn at this scale (48px source tiles → 72px on screen). */
export const TILE_SCALE = 1.5;

type FrameRect = { x: number; y: number; w: number; h: number };

/** Walls are 1 column wide; each style is 96px tall, split so the plain middle can stretch. */
export const WALL_STYLES = ['salmon', 'yellow', 'mint', 'woodLight', 'woodBrown', 'woodRed', 'grayBlue', 'beige'] as const;
export type WallStyle = (typeof WALL_STYLES)[number];

export const FLOOR_STYLES = ['brick', 'yellowTile', 'blueTile', 'concrete', 'herringbone'] as const;
export type FloorStyle = (typeof FLOOR_STYLES)[number];

/** Multi-tile objects cut from the interiors sheet. */
const DECOR_FRAMES = {
  counter: { x: 240, y: 1251, w: 192, h: 90 },
  snackFridge: { x: 96, y: 888, w: 192, h: 96 },
  sofa: { x: 384, y: 864, w: 144, h: 78 },
  aquarium: { x: 18, y: 990, w: 63, h: 42 },
  paintingSun: { x: 390, y: 990, w: 84, h: 39 },
  paintingForest: { x: 390, y: 1086, w: 84, h: 39 },
  doubleDoor: { x: 528, y: 1161, w: 96, h: 84 },
  window: { x: 345, y: 1173, w: 75, h: 60 },
  curtainWindow: { x: 210, y: 1173, w: 105, h: 75 },
  elevator: { x: 39, y: 1269, w: 114, h: 75 },
  glassDoors: { x: 0, y: 1365, w: 192, h: 75 },
  bottleShelves: { x: 480, y: 3282, w: 288, h: 102 },
  plantTree: { x: 501, y: 2139, w: 54, h: 93 },
  plantSmall: { x: 579, y: 2166, w: 42, h: 69 },
  palm: { x: 639, y: 2112, w: 69, h: 93 },
} as const satisfies Record<string, FrameRect>;

export type DecorFrame = keyof typeof DECOR_FRAMES;

const WALL_ORIGIN = { x: 384, y: 240 } as const;
const WALL_STYLE_HEIGHT = 96;
/** Rows inside one wall style: cap (white trim), stretchable plain band, lower part with baseboard. */
const WALL_SLICES = {
  cap: { y: 0, h: 21 },
  fill: { y: 24, h: 30 },
  base: { y: 54, h: 42 },
} as const;

const FLOOR_ORIGIN = { x: 528, y: 240, w: 144, h: 96 } as const;

export function wallFrame(style: WallStyle, slice: keyof typeof WALL_SLICES) {
  return `wall-${style}-${slice}`;
}

export function floorFrame(style: FloorStyle) {
  return `floor-${style}`;
}

export function wallSliceHeight(slice: keyof typeof WALL_SLICES) {
  return WALL_SLICES[slice].h;
}

export function preloadTileAssets(scene: Phaser.Scene) {
  scene.load.image(TILE_TEXTURES.roomBuilder, `${TILE_ASSET_BASE}/room_builder_48.png`);
  scene.load.image(TILE_TEXTURES.interiors, `${TILE_ASSET_BASE}/interiors_48.png`);
}

/** Registers named frames on the loaded sheets. Call once after preload. */
export function registerTileFrames(scene: Phaser.Scene) {
  const roomBuilder = scene.textures.get(TILE_TEXTURES.roomBuilder);
  const interiors = scene.textures.get(TILE_TEXTURES.interiors);
  if (roomBuilder.has(floorFrame('brick'))) return;

  roomBuilder.setFilter(Phaser.Textures.FilterMode.NEAREST);
  interiors.setFilter(Phaser.Textures.FilterMode.NEAREST);

  WALL_STYLES.forEach((style, index) => {
    const styleY = WALL_ORIGIN.y + index * WALL_STYLE_HEIGHT;
    for (const [slice, rect] of Object.entries(WALL_SLICES)) {
      roomBuilder.add(wallFrame(style, slice as keyof typeof WALL_SLICES), 0, WALL_ORIGIN.x, styleY + rect.y, 48, rect.h);
    }
  });

  FLOOR_STYLES.forEach((style, index) => {
    roomBuilder.add(floorFrame(style), 0, FLOOR_ORIGIN.x, FLOOR_ORIGIN.y + index * FLOOR_ORIGIN.h, FLOOR_ORIGIN.w, FLOOR_ORIGIN.h);
  });

  for (const [name, rect] of Object.entries(DECOR_FRAMES)) {
    interiors.add(name, 0, rect.x, rect.y, rect.w, rect.h);
  }
}
