import Phaser from 'phaser';
import type { WalkLaneBounds } from '../config/constants';
import { WALK_LANE } from '../config/constants';

export function getWalkLaneForX(_x: number): WalkLaneBounds {
  return WALK_LANE;
}

export function clampToWalkLane(y: number, lane: WalkLaneBounds) {
  return Phaser.Math.Clamp(y, lane.minY, lane.maxY);
}
