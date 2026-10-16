import type { HitboxRect } from '../types/combat';

export function toPhaserRect(box: HitboxRect): Phaser.Geom.Rectangle {
  return new Phaser.Geom.Rectangle(
    box.x - box.width / 2,
    box.y - box.height / 2,
    box.width,
    box.height,
  );
}

export function hitboxesOverlap(
  attacker: HitboxRect,
  target: HitboxRect,
  depthTolerance: number,
): boolean {
  // Compare feet, not box centers: a punch at shoulder height and a body-tall hurtbox have
  // centers far apart even when both fighters stand on the same line.
  if (Math.abs(attacker.floorY - target.floorY) > depthTolerance) {
    return false;
  }

  return Phaser.Geom.Rectangle.Overlaps(toPhaserRect(attacker), toPhaserRect(target));
}

export function createCenteredHitbox(x: number, y: number, width: number, height: number, floorY: number): HitboxRect {
  return { x, y, width, height, floorY };
}

export function drawHitboxOutline(
  graphics: Phaser.GameObjects.Graphics,
  box: HitboxRect,
  color: number,
  lineWidth = 2,
) {
  const rect = toPhaserRect(box);
  graphics.lineStyle(lineWidth, color, 1);
  graphics.strokeRect(rect.x, rect.y, rect.width, rect.height);
}
