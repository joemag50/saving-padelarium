import { actorPx } from '../config/constants';

export const BODY_COLLISION = {
  playerRadius: actorPx(24),
  enemyRadius: actorPx(24),
  /**
   * Bodies are ovals on the floor: as wide as their radius, `depthRatio` times as deep.
   * Two 24px bodies keep 48px apart side by side and about 29px apart in depth.
   */
  depthRatio: 0.6,
  separationIterations: 4,
} as const;

export type BodySnapshot = {
  x: number;
  y: number;
  radius: number;
};

export type BodyActor = {
  getBodySnapshot(): BodySnapshot;
  setWorldPosition(x: number, y: number): void;
};

/** Distance between two bodies in "oval units": below 1 means they overlap. */
function ovalDistance(ax: number, ay: number, aRadius: number, bx: number, by: number, bRadius: number, depthRatio: number) {
  const reach = aRadius + bRadius;
  if (reach <= 0) return Infinity;
  return Math.hypot((bx - ax) / reach, (by - ay) / (reach * depthRatio));
}

function bodiesOverlap(
  ax: number,
  ay: number,
  aRadius: number,
  bx: number,
  by: number,
  bRadius: number,
  depthRatio: number,
) {
  return ovalDistance(ax, ay, aRadius, bx, by, bRadius, depthRatio) < 1;
}

export function resolveBlockedMovement(
  self: BodySnapshot,
  targetX: number,
  targetY: number,
  others: BodySnapshot[],
  depthRatio: number,
) {
  if (
    !others.some((other) =>
      bodiesOverlap(targetX, targetY, self.radius, other.x, other.y, other.radius, depthRatio),
    )
  ) {
    return { x: targetX, y: targetY };
  }

  if (
    !others.some((other) =>
      bodiesOverlap(targetX, self.y, self.radius, other.x, other.y, other.radius, depthRatio),
    )
  ) {
    return { x: targetX, y: self.y };
  }

  if (
    !others.some((other) =>
      bodiesOverlap(self.x, targetY, self.radius, other.x, other.y, other.radius, depthRatio),
    )
  ) {
    return { x: self.x, y: targetY };
  }

  return { x: self.x, y: self.y };
}

function separatePair(
  a: BodySnapshot & { setPosition(x: number, y: number): void },
  b: BodySnapshot & { setPosition(x: number, y: number): void },
  depthRatio: number,
) {
  const reach = a.radius + b.radius;
  if (reach <= 0) return;
  // Work in oval space (depth stretched to match width), push apart, then map back.
  const nx = (b.x - a.x) / reach;
  const ny = (b.y - a.y) / (reach * depthRatio);
  const distance = Math.hypot(nx, ny);
  if (distance >= 1) return;

  const dirX = distance === 0 ? 1 : nx / distance;
  const dirY = distance === 0 ? 0 : ny / distance;
  const push = (1 - distance) * 0.5;
  const pushX = dirX * push * reach;
  const pushY = dirY * push * reach * depthRatio;

  a.setPosition(a.x - pushX, a.y - pushY);
  b.setPosition(b.x + pushX, b.y + pushY);
}

export function separateActors(
  actors: BodyActor[],
  depthRatio: number,
  iterations = BODY_COLLISION.separationIterations,
) {
  if (actors.length < 2) return;

  const states = actors.map((actor) => {
    const snapshot = actor.getBodySnapshot();
    return {
      actor,
      x: snapshot.x,
      y: snapshot.y,
      radius: snapshot.radius,
      setPosition(nextX: number, nextY: number) {
        this.x = nextX;
        this.y = nextY;
        this.actor.setWorldPosition(nextX, nextY);
      },
    };
  });

  for (let pass = 0; pass < iterations; pass += 1) {
    for (let i = 0; i < states.length; i += 1) {
      for (let j = i + 1; j < states.length; j += 1) {
        separatePair(states[i], states[j], depthRatio);
      }
    }
  }
}
