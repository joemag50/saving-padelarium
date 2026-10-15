import Phaser from 'phaser';
import { LEVEL_HEIGHT, WALK_LANE } from '../config/constants';
import {
  floorFrame,
  TILE_SCALE,
  TILE_TEXTURES,
  wallFrame,
  wallSliceHeight,
  type DecorFrame,
  type FloorStyle,
  type WallStyle,
} from './tileAssets';

/** Vertical layout of the back wall: ceiling above `top`, wall down to `bottom`, floor below. */
export const SCENERY_LAYOUT = {
  wallTop: 100,
  wallBottom: WALK_LANE.minY - 10,
} as const;

/** Floor-standing decor sits just above the walk lane so actors always render in front of it. */
const FLOOR_DECOR_BASE_Y = WALK_LANE.minY - 2;

const CEILING_COLOR = 0x2b2b3d;
const ROOM_BORDER_COLOR = 0x3d3d52;

export type SceneryRoom = { fromX: number; toX: number; wall: WallStyle; floor: FloorStyle };

export type DecorPlacement =
  /** Hung on the wall; `y` is the bottom edge of the sprite. */
  | { frame: DecorFrame; x: number; mount: 'wall'; y: number }
  /** Standing on the floor against the wall. */
  | { frame: DecorFrame; x: number; mount: 'floor' };

export type SceneryDefinition = {
  rooms: readonly SceneryRoom[];
  decor: readonly DecorPlacement[];
  /** Sprites replacing the gray-box props; props without one keep the placeholder box. */
  props: Partial<Record<'cover' | 'hallway' | 'court', DecorFrame>>;
};

export function buildScenery(scene: Phaser.Scene, scenery: SceneryDefinition) {
  const { wallTop, wallBottom } = SCENERY_LAYOUT;
  const levelWidth = Math.max(...scenery.rooms.map((room) => room.toX));
  scene.add.rectangle(0, 0, levelWidth, wallTop, CEILING_COLOR).setOrigin(0).setDepth(0);

  for (const room of scenery.rooms) {
    const width = room.toX - room.fromX;
    addTiled(scene, room.fromX, wallBottom, width, LEVEL_HEIGHT - wallBottom, floorFrame(room.floor));
    addWall(scene, room, wallTop, wallBottom);
  }

  // Dark seams where one room's wall meets the next.
  for (const room of scenery.rooms.slice(1)) {
    scene.add
      .rectangle(room.fromX, wallTop, 6, wallBottom - wallTop, ROOM_BORDER_COLOR)
      .setOrigin(0.5, 0)
      .setDepth(1);
  }

  for (const item of scenery.decor) {
    if (item.mount === 'wall') {
      addDecorSprite(scene, item.frame, item.x, item.y).setDepth(2);
    } else {
      addDecorSprite(scene, item.frame, item.x, FLOOR_DECOR_BASE_Y).setDepth(FLOOR_DECOR_BASE_Y);
    }
  }
}

/** Places a decor sprite by its bottom-center point. */
export function addDecorSprite(scene: Phaser.Scene, frame: DecorFrame, x: number, bottomY: number) {
  return scene.add.image(x, bottomY, TILE_TEXTURES.interiors, frame).setOrigin(0.5, 1).setScale(TILE_SCALE);
}

function addWall(scene: Phaser.Scene, room: SceneryRoom, top: number, bottom: number) {
  const width = room.toX - room.fromX;
  const capHeight = wallSliceHeight('cap') * TILE_SCALE;
  const baseHeight = wallSliceHeight('base') * TILE_SCALE;
  addTiled(scene, room.fromX, top, width, capHeight, wallFrame(room.wall, 'cap'));
  addTiled(scene, room.fromX, top + capHeight, width, bottom - baseHeight - top - capHeight, wallFrame(room.wall, 'fill'));
  addTiled(scene, room.fromX, bottom - baseHeight, width, baseHeight, wallFrame(room.wall, 'base'));
}

/** Repeats a frame over a screen-space rectangle, keeping pixels at TILE_SCALE. */
function addTiled(scene: Phaser.Scene, x: number, y: number, width: number, height: number, frame: string) {
  return scene.add
    .tileSprite(x, y, width / TILE_SCALE, height / TILE_SCALE, TILE_TEXTURES.roomBuilder, frame)
    .setOrigin(0)
    .setScale(TILE_SCALE)
    .setDepth(0);
}
