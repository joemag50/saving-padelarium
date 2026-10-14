import Phaser from 'phaser';

export const BODY_COLLISION = {
  playerRadius: 24,
  enemyRadius: 24,
  depthTolerance: 30,
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

function onSameDepth(aY: number, bY: number, depthTolerance: number) {
  return Math.abs(aY - bY) <= depthTolerance;
}

function circlesOverlap(
  ax: number,
  ay: number,
  aRadius: number,
  bx: number,
  by: number,
  bRadius: number,
  depthTolerance: number,
) {
  if (!onSameDepth(ay, by, depthTolerance)) return false;
  const minDistance = aRadius + bRadius;
  return Phaser.Math.Distance.Between(ax, ay, bx, by) < minDistance;
}

export function resolveBlockedMovement(
  self: BodySnapshot,
  targetX: number,
  targetY: number,
  others: BodySnapshot[],
  depthTolerance: number,
) {
  if (
    !others.some((other) =>
      circlesOverlap(targetX, targetY, self.radius, other.x, other.y, other.radius, depthTolerance),
    )
  ) {
    return { x: targetX, y: targetY };
  }

  if (
    !others.some((other) =>
      circlesOverlap(targetX, self.y, self.radius, other.x, other.y, other.radius, depthTolerance),
    )
  ) {
    return { x: targetX, y: self.y };
  }

  if (
    !others.some((other) =>
      circlesOverlap(self.x, targetY, self.radius, other.x, other.y, other.radius, depthTolerance),
    )
  ) {
    return { x: self.x, y: targetY };
  }

  return { x: self.x, y: self.y };
}

function separatePair(
  a: BodySnapshot & { setPosition(x: number, y: number): void },
  b: BodySnapshot & { setPosition(x: number, y: number): void },
  depthTolerance: number,
) {
  if (!onSameDepth(a.y, b.y, depthTolerance)) return;

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distance = Math.hypot(dx, dy);
  const minDistance = a.radius + b.radius;
  if (distance >= minDistance) return;

  const overlap = minDistance - distance;
  const nx = distance === 0 ? 1 : dx / distance;
  const ny = distance === 0 ? 0 : dy / distance;
  const push = overlap * 0.5;

  a.setPosition(a.x - nx * push, a.y - ny * push);
  b.setPosition(b.x + nx * push, b.y + ny * push);
}

export function separateActors(
  actors: BodyActor[],
  depthTolerance: number,
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
        separatePair(states[i], states[j], depthTolerance);
      }
    }
  }
}
