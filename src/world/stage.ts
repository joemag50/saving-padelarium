import Phaser from 'phaser';
import { LEVEL_HEIGHT, WALK_LANE } from '../config/constants';

/** Vertical layout: ceiling above `wallTop`, flat back wall down to `wallBottom`, floor below. */
export const STAGE_LAYOUT = {
  wallTop: 100,
  wallBottom: WALK_LANE.minY - 10,
} as const;

/**
 * Floor seams lean 45° (one pixel sideways per pixel down), the classic beat 'em up look
 * that sells depth on a side-scrolling floor.
 */
const SLANT = 1;
/** Floor rows grow toward the camera to fake perspective. */
const FIRST_ROW_HEIGHT = 30;
const ROW_GROWTH = 1.2;

const CEILING_COLOR = 0x0f1220;
const DOORFRAME_COLOR = 0x0b0d16;

export type FloorPattern =
  /** Checkered tiles. */
  | { kind: 'tiles'; base: number; alt: number; grout: number; size: number }
  /** Wooden planks, staggered every row. */
  | { kind: 'planks'; base: number; alt: number; seam: number; plankWidth: number }
  /** Big concrete slabs with faint seams and stains. */
  | { kind: 'slabs'; base: number; seam: number; size: number }
  /** Plain carpet with a woven fleck. */
  | { kind: 'carpet'; base: number; fleck: number }
  /** Asphalt with slanted parking lines. */
  | { kind: 'asphalt'; base: number; line: number; spacing: number }
  /** Padel court surface with its white lines. */
  | { kind: 'court'; base: number; line: number };

export type StageRoom = {
  fromX: number;
  toX: number;
  /** Flat wall: main color, top molding and baseboard. */
  wall: { color: number; trim: number; base: number };
  floor: FloorPattern;
};

/**
 * Each level's signature light, drawn over both of its rooms:
 * - glow: colored light washing down the walls (the green light that took the group).
 * - fog: a low cloud hugging the floor along the wall.
 * - waves: sound rings pulsing across the wall.
 * - beams: slanted cones of light falling from above.
 * - lasers: thin beams crossing the wall.
 */
export type StageLight = { kind: 'glow' | 'fog' | 'waves' | 'beams' | 'lasers'; color: number };

export type StageDefinition = { rooms: readonly StageRoom[]; light: StageLight };

type Row = { top: number; bottom: number; index: number };

/** Paints the whole level backdrop: ceiling, a flat wall and a perspective floor per room. */
export function buildStage(scene: Phaser.Scene, stage: StageDefinition) {
  const { wallTop, wallBottom } = STAGE_LAYOUT;
  const width = Math.max(...stage.rooms.map((room) => room.toX));
  scene.add.rectangle(0, 0, width, wallTop, CEILING_COLOR).setOrigin(0).setDepth(0);

  const rows = floorRows(wallBottom, LEVEL_HEIGHT);
  for (const room of stage.rooms) {
    paintWall(scene, room, wallTop, wallBottom);
    paintFloor(scene, room, rows, wallBottom);
  }

  // Door frames where one room's wall meets the next.
  for (const room of stage.rooms.slice(1)) {
    scene.add.rectangle(room.fromX, wallTop, 14, wallBottom - wallTop, DOORFRAME_COLOR).setOrigin(0.5, 0).setDepth(1);
  }

  paintLight(scene, stage.light, width, wallTop, wallBottom);
}

/** The level's signature light, on top of walls and floor but under every actor. */
function paintLight(scene: Phaser.Scene, light: StageLight, width: number, wallTop: number, wallBottom: number) {
  const g = scene.add.graphics().setDepth(2);
  const wallHeight = wallBottom - wallTop;
  switch (light.kind) {
    case 'glow':
      // Light leaking in from above, strongest at the molding.
      for (let i = 0; i < GRADIENT_BANDS; i += 1) {
        const top = Math.round(wallTop + (wallHeight * i) / GRADIENT_BANDS);
        const bottom = Math.round(wallTop + (wallHeight * (i + 1)) / GRADIENT_BANDS);
        g.fillStyle(light.color, 0.22 * (1 - i / GRADIENT_BANDS)).fillRect(0, top, width, bottom - top);
      }
      // Pools of the same light at regular spots, like windows letting it in.
      for (let x = 160; x < width; x += 520) {
        softEllipse(g, x, wallTop + wallHeight * 0.45, 300, wallHeight * 1.1, light.color, 0.16);
      }
      break;
    case 'fog':
      // Layered puffs along the base of the wall, spilling onto the floor.
      for (let x = -80; x < width + 80; x += 90) {
        const lift = (hash(x + 1000, 1) % 30) - 15;
        softEllipse(g, x, wallBottom + 10 + lift, 300, 150, light.color, 0.14);
        softEllipse(g, x + 45, wallBottom - 45 + lift, 220, 100, light.color, 0.08);
      }
      break;
    case 'waves':
      // Concentric rings spreading over the wall, like the noise coming out of a speaker.
      for (let x = 260; x < width; x += 640) {
        for (let ring = 1; ring <= 5; ring += 1) {
          g.lineStyle(4, light.color, 0.3 - ring * 0.045);
          g.strokeEllipse(x, wallTop + wallHeight * 0.55, ring * 110, ring * 52);
        }
      }
      break;
    case 'beams':
      // Slanted cones of light from above, crossing wall and floor.
      for (let x = 120; x < width; x += 460) {
        g.fillStyle(light.color, 0.12);
        g.fillPoints(
          [
            new Phaser.Math.Vector2(x, wallTop),
            new Phaser.Math.Vector2(x + 90, wallTop),
            new Phaser.Math.Vector2(x + 300, LEVEL_HEIGHT),
            new Phaser.Math.Vector2(x + 60, LEVEL_HEIGHT),
          ],
          true,
        );
      }
      break;
    case 'lasers':
      // Crisscrossing laser lines across the wall, with a soft halo.
      for (let x = -200; x < width; x += 340) {
        g.lineStyle(8, light.color, 0.12).lineBetween(x, wallTop + 20, x + 260, wallBottom - 24);
        g.lineStyle(2, light.color, 0.7).lineBetween(x, wallTop + 20, x + 260, wallBottom - 24);
        g.lineStyle(8, light.color, 0.12).lineBetween(x + 260, wallTop + 20, x, wallBottom - 24);
        g.lineStyle(2, light.color, 0.7).lineBetween(x + 260, wallTop + 20, x, wallBottom - 24);
      }
      break;
  }
}

function floorRows(top: number, bottom: number): Row[] {
  const rows: Row[] = [];
  let y = top;
  let height = FIRST_ROW_HEIGHT;
  while (y < bottom) {
    rows.push({ top: y, bottom: Math.min(bottom, y + height), index: rows.length });
    y += height;
    height *= ROW_GROWTH;
  }
  return rows;
}

function paintWall(scene: Phaser.Scene, room: StageRoom, top: number, bottom: number) {
  const width = room.toX - room.fromX;
  const { color, trim, base } = room.wall;
  const g = scene.add.graphics().setDepth(0);
  // Smooth, slightly darker toward the floor.
  verticalGradient(g, room.fromX, top, width, bottom - top, lighten(color, 0.08), darken(color, 0.12));
  // Top molding.
  g.fillStyle(trim, 1).fillRect(room.fromX, top, width, 10);
  g.fillStyle(darken(trim, 0.35), 1).fillRect(room.fromX, top + 10, width, 3);
  // Baseboard with a lit top edge.
  g.fillStyle(base, 1).fillRect(room.fromX, bottom - 18, width, 18);
  g.fillStyle(lighten(base, 0.25), 1).fillRect(room.fromX, bottom - 18, width, 3);
}

function paintFloor(scene: Phaser.Scene, room: StageRoom, rows: Row[], floorTop: number) {
  const g = scene.add.graphics().setDepth(0);
  const floorBottom = rows[rows.length - 1].bottom;
  // Patterns overhang the room; the mask trims them to its edges.
  const maskShape = scene.make.graphics({}, false).fillRect(room.fromX, floorTop, room.toX - room.fromX, floorBottom - floorTop);
  g.setMask(maskShape.createGeometryMask());

  const pattern = room.floor;
  switch (pattern.kind) {
    case 'tiles':
      paintTiles(g, room, rows, floorTop, pattern);
      break;
    case 'planks':
      paintPlanks(g, room, rows, floorTop, pattern);
      break;
    case 'slabs':
      paintSlabs(g, room, rows, floorTop, pattern);
      break;
    case 'carpet':
      paintCarpet(g, room, floorTop, floorBottom, pattern);
      break;
    case 'asphalt':
      paintAsphalt(g, room, floorTop, floorBottom, pattern);
      break;
    case 'court':
      paintCourt(g, room, floorTop, floorBottom, pattern);
      break;
  }

  // Depth shading: the floor is darker where it meets the wall, lit toward the camera.
  shadeDown(g, room.fromX, floorTop, room.toX - room.fromX, (floorBottom - floorTop) * 0.55, 0.45);
  // Contact shadow right under the baseboard.
  g.fillStyle(0x000000, 0.35).fillRect(room.fromX, floorTop, room.toX - room.fromX, 6);
}

/** Parallelogram for one floor cell: `x` is its top-left corner; seams lean by SLANT. */
function cell(g: Phaser.GameObjects.Graphics, x: number, width: number, row: Row) {
  const height = row.bottom - row.top;
  const shift = height * SLANT;
  g.fillPoints(
    [
      new Phaser.Math.Vector2(x, row.top),
      new Phaser.Math.Vector2(x + width, row.top),
      new Phaser.Math.Vector2(x + width - shift, row.bottom),
      new Phaser.Math.Vector2(x - shift, row.bottom),
    ],
    true,
  );
}

/**
 * Left edge (at the row's top) of every cell column that can show up inside the room.
 * Shifting each row by its depth keeps the seams on continuous 45° lines.
 */
function columns(room: StageRoom, row: Row, floorTop: number, size: number, offset = 0) {
  const shift = (row.top - floorTop) * SLANT;
  const rowShift = (row.bottom - row.top) * SLANT;
  const first = Math.floor((room.fromX - size - offset + shift) / size);
  const last = Math.ceil((room.toX + rowShift - offset + shift) / size);
  const xs: { x: number; column: number }[] = [];
  for (let column = first; column <= last; column += 1) {
    xs.push({ x: column * size + offset - shift, column });
  }
  return xs;
}

function paintTiles(g: Phaser.GameObjects.Graphics, room: StageRoom, rows: Row[], floorTop: number, p: Extract<FloorPattern, { kind: 'tiles' }>) {
  for (const row of rows) {
    for (const { x, column } of columns(room, row, floorTop, p.size)) {
      g.fillStyle(p.grout, 1);
      cell(g, x, p.size, row);
      g.fillStyle((column + row.index) % 2 === 0 ? p.base : p.alt, 1);
      cell(g, x + 2, p.size - 4, { ...row, top: row.top + 2, bottom: row.bottom - 1 });
    }
  }
}

function paintPlanks(g: Phaser.GameObjects.Graphics, room: StageRoom, rows: Row[], floorTop: number, p: Extract<FloorPattern, { kind: 'planks' }>) {
  for (const row of rows) {
    const stagger = row.index % 2 === 0 ? 0 : p.plankWidth / 2;
    for (const { x, column } of columns(room, row, floorTop, p.plankWidth, stagger)) {
      g.fillStyle(p.seam, 1);
      cell(g, x, p.plankWidth, row);
      g.fillStyle(hash(column, row.index) % 3 === 0 ? p.alt : p.base, 1);
      cell(g, x + 3, p.plankWidth - 4, { ...row, top: row.top + 2, bottom: row.bottom });
    }
  }
}

function paintSlabs(g: Phaser.GameObjects.Graphics, room: StageRoom, rows: Row[], floorTop: number, p: Extract<FloorPattern, { kind: 'slabs' }>) {
  // Slabs span two perspective rows each.
  const merged: Row[] = [];
  for (let i = 0; i < rows.length; i += 2) {
    merged.push({ top: rows[i].top, bottom: (rows[i + 1] ?? rows[i]).bottom, index: merged.length });
  }
  for (const row of merged) {
    for (const { x, column } of columns(room, row, floorTop, p.size)) {
      g.fillStyle(p.seam, 1);
      cell(g, x, p.size, row);
      const stain = hash(column, row.index) % 4 === 0 ? darken(p.base, 0.06) : p.base;
      g.fillStyle(stain, 1);
      cell(g, x + 2, p.size - 3, { ...row, top: row.top + 2, bottom: row.bottom });
    }
  }
}

function paintCarpet(g: Phaser.GameObjects.Graphics, room: StageRoom, top: number, bottom: number, p: Extract<FloorPattern, { kind: 'carpet' }>) {
  g.fillStyle(p.base, 1).fillRect(room.fromX, top, room.toX - room.fromX, bottom - top);
  // A faint 45° weave.
  g.lineStyle(2, p.fleck, 0.35);
  for (let x = room.fromX - (bottom - top); x < room.toX; x += 18) {
    g.lineBetween(x + (bottom - top) * SLANT, top, x, bottom);
  }
}

function paintAsphalt(g: Phaser.GameObjects.Graphics, room: StageRoom, top: number, bottom: number, p: Extract<FloorPattern, { kind: 'asphalt' }>) {
  g.fillStyle(p.base, 1).fillRect(room.fromX, top, room.toX - room.fromX, bottom - top);
  // Grain.
  for (let i = 0; i < (room.toX - room.fromX) / 3; i += 1) {
    const x = room.fromX + (hash(i, 7) % (room.toX - room.fromX));
    const y = top + (hash(i, 13) % (bottom - top));
    g.fillStyle(hash(i, 3) % 2 === 0 ? lighten(p.base, 0.12) : darken(p.base, 0.15), 1).fillRect(x, y, 3, 2);
  }
  // Parking lines: slanted stalls along the back, a lane line in front.
  const stallBottom = top + (bottom - top) * 0.55;
  g.lineStyle(6, p.line, 0.85);
  for (let x = room.fromX - p.spacing; x < room.toX + p.spacing; x += p.spacing) {
    g.lineBetween(x + (stallBottom - top) * SLANT, top + 8, x, stallBottom);
  }
  g.lineBetween(room.fromX, stallBottom, room.toX, stallBottom);
}

function paintCourt(g: Phaser.GameObjects.Graphics, room: StageRoom, top: number, bottom: number, p: Extract<FloorPattern, { kind: 'court' }>) {
  const height = bottom - top;
  g.fillStyle(p.base, 1).fillRect(room.fromX, top, room.toX - room.fromX, height);
  // Slightly lighter playing area inside the lines.
  const inner = { top: top + 40, bottom: bottom - 40 };
  g.fillStyle(lighten(p.base, 0.06), 1).fillRect(room.fromX, inner.top, room.toX - room.fromX, inner.bottom - inner.top);
  g.lineStyle(5, p.line, 0.9);
  g.lineBetween(room.fromX, inner.top, room.toX, inner.top);
  g.lineBetween(room.fromX, inner.bottom, room.toX, inner.bottom);
  // Service and center lines, leaning 45° like every floor seam.
  const span = inner.bottom - inner.top;
  for (let x = room.fromX + 160; x < room.toX + span; x += 420) {
    g.lineBetween(x + span * SLANT, inner.top, x, inner.bottom);
  }
  g.lineStyle(3, p.line, 0.6);
  const middle = (inner.top + inner.bottom) / 2;
  g.lineBetween(room.fromX, middle, room.toX, middle);
}

/** A blurry light spot: stacked ellipses, faint at the rim and denser toward the middle. */
function softEllipse(g: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number, color: number, alpha: number) {
  const layers = 8;
  for (let i = 0; i < layers; i += 1) {
    const scale = 1 - i / layers;
    g.fillStyle(color, alpha / layers).fillEllipse(x, y, width * scale, height * scale);
  }
}

/**
 * Gradients built from thin bands: Phaser's gradient fills only work with WebGL,
 * and some phones fall back to the Canvas renderer.
 */
const GRADIENT_BANDS = 24;

function verticalGradient(g: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number, from: number, to: number) {
  const band = height / GRADIENT_BANDS;
  for (let i = 0; i < GRADIENT_BANDS; i += 1) {
    g.fillStyle(mix(from, to, i / (GRADIENT_BANDS - 1)), 1);
    g.fillRect(x, y + i * band, width, Math.ceil(band) + 1);
  }
}

/** Black overlay fading from `maxAlpha` at the top to nothing at the bottom. */
function shadeDown(g: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number, maxAlpha: number) {
  // Whole-pixel bands that touch without overlapping, so no darker seams show.
  for (let i = 0; i < GRADIENT_BANDS; i += 1) {
    const bandTop = Math.round(y + (height * i) / GRADIENT_BANDS);
    const bandBottom = Math.round(y + (height * (i + 1)) / GRADIENT_BANDS);
    g.fillStyle(0x000000, maxAlpha * (1 - i / GRADIENT_BANDS));
    g.fillRect(x, bandTop, width, bandBottom - bandTop);
  }
}

/** Small deterministic hash so stains and grain look random but never change between runs. */
function hash(a: number, b: number) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return Math.abs(h ^ (h >>> 16));
}

/** Mixes a 0xRRGGBB color toward white by `amount` (0–1). */
function lighten(color: number, amount: number) {
  return mix(color, 0xffffff, amount);
}

/** Mixes a 0xRRGGBB color toward black by `amount` (0–1). */
function darken(color: number, amount: number) {
  return mix(color, 0x000000, amount);
}

function mix(from: number, to: number, amount: number) {
  const channel = (shift: number) => {
    const a = (from >> shift) & 0xff;
    const b = (to >> shift) & 0xff;
    return Math.round(a + (b - a) * amount) << shift;
  };
  return channel(16) | channel(8) | channel(0);
}
