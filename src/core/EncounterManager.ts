import Phaser from 'phaser';
import { InvaderEnemy } from '../enemy/InvaderEnemy';
import type { Player } from '../player/Player';
import type { CombatTarget } from '../types/combat';
import type { BodySnapshot } from '../world/bodyCollision';

type SpawnPoint = { readonly x: number; readonly y: number };

export class EncounterManager {
  private readonly enemies: InvaderEnemy[] = [];
  active = false;
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  get targets(): CombatTarget[] {
    return this.enemies;
  }

  get livingEnemies() {
    return this.enemies.filter((enemy) => enemy.isActive);
  }

  startBasic(spawns: readonly SpawnPoint[], onAllDefeated: () => void) {
    this.clear();
    this.active = true;
    let remaining = spawns.length;

    const onEnemyDown = () => {
      remaining -= 1;
      if (remaining <= 0) {
        this.active = false;
        onAllDefeated();
      }
    };

    for (const spawn of spawns) {
      const enemy = new InvaderEnemy(this.scene, spawn.x, spawn.y, 'basic', onEnemyDown);
      this.enemies.push(enemy);
    }
  }

  startFinal(
    minionSpawns: readonly SpawnPoint[],
    bossSpawn: SpawnPoint,
    onAllDefeated: () => void,
  ) {
    this.clear();
    this.active = true;
    let remaining = minionSpawns.length + 1;

    const onEnemyDown = () => {
      remaining -= 1;
      if (remaining <= 0) {
        this.active = false;
        onAllDefeated();
      }
    };

    for (const spawn of minionSpawns) {
      const enemy = new InvaderEnemy(this.scene, spawn.x, spawn.y, 'basic', () => {
        onEnemyDown();
      });
      this.enemies.push(enemy);
    }

    const boss = new InvaderEnemy(this.scene, bossSpawn.x, bossSpawn.y, 'miniBoss', onEnemyDown);
    this.enemies.push(boss);
  }

  update(now: number, deltaSeconds: number, players: Player[], bodyBlockersFor: (enemy: InvaderEnemy) => BodySnapshot[]) {
    for (const enemy of this.enemies) {
      if (!enemy.isActive) continue;
      enemy.update(now, deltaSeconds, players, bodyBlockersFor(enemy));
    }
  }

  clear() {
    for (const enemy of this.enemies) {
      enemy.position.destroy();
    }
    this.enemies.length = 0;
    this.active = false;
  }
}
