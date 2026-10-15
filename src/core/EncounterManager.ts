import Phaser from 'phaser';
import { MAX_MELEE_ATTACKERS, type EnemyKind, type EnemyStats } from '../config/enemies';
import { AbductionBeam } from '../enemy/AbductionBeam';
import { InvaderEnemy } from '../enemy/InvaderEnemy';
import { PadelBall } from '../enemy/PadelBall';
import { SmokeBomb } from '../enemy/SmokeBomb';
import { SupremoBoss } from '../enemy/SupremoBoss';
import type { Player } from '../player/Player';
import type { CombatTarget } from '../types/combat';
import type { BodyActor, BodySnapshot } from '../world/bodyCollision';

export type EnemySpawn = {
  readonly x: number;
  readonly y: number;
  readonly kind: EnemyKind | 'finalBoss';
  /** Per-level tweaks (the level leader's name, color, health…). */
  readonly overrides?: Partial<EnemyStats>;
  /** Level difficulty: multiplies health and damage. */
  readonly scale?: number;
};

export type Arena = { minX: number; maxX: number };

export type EnemyWave = readonly EnemySpawn[];

/** Anything that lives in a fight: enemies, the boss and its projectiles/beams. */
export interface EncounterActor extends CombatTarget, BodyActor {
  /** False for things players walk through (balls, beams, a charging boss). */
  readonly blocksBodies: boolean;
  update(now: number, deltaSeconds: number, players: Player[], bodyBlockers: BodySnapshot[]): void;
  destroy(): void;
}

/** How the encounter talks back to the level (boss health bar, hints). */
export type EncounterHooks = {
  onBossHealth(current: number, max: number): void;
  onBossFightEnd(): void;
  setHint(text: string): void;
};

/** What a regular enemy can ask of the fight it's in. */
export type EnemyContext = {
  /** Left/right limits of the locked room. */
  arena: Arena;
  addActor(actor: EncounterActor): void;
  /** Melee enemies need one of the few attack slots to go after a player. */
  requestAttackSlot(enemy: InvaderEnemy): boolean;
  releaseAttackSlot(enemy: InvaderEnemy): void;
  /** Whether another attacker already stands on that side of `target`. */
  isSideTaken(target: Player, side: 1 | -1, except: InvaderEnemy): boolean;
};

/** What the final boss can do to the fight it's in. */
export type BossContext = {
  scene: Phaser.Scene;
  hooks: EncounterHooks;
  /** Left/right limits of the locked arena. */
  arena: Arena;
  addActor(actor: EncounterActor): void;
  spawnMinion(x: number, y: number): void;
  livingMinionCount(): number;
  /** Clears every ball and beam (and frees anyone held). */
  removeHazards(): void;
};

/** Pause between one wave being cleared and the next one arriving. */
const WAVE_DELAY_MS = 700;

export class EncounterManager {
  private readonly actors: EncounterActor[] = [];
  active = false;
  private readonly scene: Phaser.Scene;
  private readonly hooks: EncounterHooks;
  /** Shared with every enemy and the boss; updated in place when a fight starts. */
  private readonly arena: Arena = { minX: 0, maxX: 0 };
  private readonly attackSlots = new Set<InvaderEnemy>();
  private readonly enemyContext: EnemyContext;
  /** Bumped on every start/clear so pending wave timers from an aborted run are ignored. */
  private runId = 0;

  constructor(scene: Phaser.Scene, hooks: EncounterHooks) {
    this.scene = scene;
    this.hooks = hooks;
    this.enemyContext = {
      arena: this.arena,
      addActor: (actor) => this.actors.push(actor),
      requestAttackSlot: (enemy) => {
        if (this.attackSlots.has(enemy)) return true;
        if (this.attackSlots.size >= MAX_MELEE_ATTACKERS) return false;
        this.attackSlots.add(enemy);
        return true;
      },
      releaseAttackSlot: (enemy) => {
        this.attackSlots.delete(enemy);
      },
      isSideTaken: (target, side, except) =>
        [...this.attackSlots].some((enemy) => {
          if (enemy === except) return false;
          const slot = enemy.attackSide;
          return slot !== null && slot.target === target && slot.side === side;
        }),
    };
  }

  get targets(): CombatTarget[] {
    return this.actors;
  }

  get livingEnemies() {
    return this.actors.filter((actor) => actor.isActive);
  }

  /** Living actors that push bodies around (not projectiles or a charging boss). */
  get bodyActors() {
    return this.livingEnemies.filter((actor) => actor.blocksBodies);
  }

  /** Spawns each wave once the previous one is fully defeated. `arena` is the locked room. */
  startWaves(waves: readonly EnemyWave[], arena: Arena, onAllDefeated: () => void) {
    this.clear();
    Object.assign(this.arena, arena);
    this.active = true;
    const runId = this.runId;

    const spawnWave = (index: number) => {
      if (runId !== this.runId) return;

      const wave = waves[index];
      if (!wave || wave.length === 0) {
        this.active = false;
        this.dismissLeftovers();
        onAllDefeated();
        return;
      }

      let remaining = wave.length;
      const onEnemyDown = () => {
        remaining -= 1;
        if (remaining > 0) return;
        if (index + 1 < waves.length) {
          this.scene.time.delayedCall(WAVE_DELAY_MS, () => spawnWave(index + 1));
        } else {
          spawnWave(index + 1);
        }
      };

      for (const spawn of wave) {
        this.actors.push(this.createActor(spawn, onEnemyDown));
      }
    };

    spawnWave(0);
  }

  /** Debug helper: knocks out every living enemy, as if the players had won the fight. */
  defeatAll(now: number) {
    for (const enemy of this.livingEnemies) {
      enemy.combatant.invulnerableUntil = 0;
      enemy.combatant.takeDamage(enemy.combatant.maxHealth, now);
    }
  }

  update(now: number, deltaSeconds: number, players: Player[], bodyBlockersFor: (actor: EncounterActor) => BodySnapshot[]) {
    // Copy: the boss may add balls/beams while updating.
    for (const actor of [...this.actors]) {
      if (!actor.isActive) continue;
      actor.update(now, deltaSeconds, players, bodyBlockersFor(actor));
    }
  }

  clear() {
    this.runId += 1;
    for (const actor of this.actors) {
      actor.destroy();
    }
    this.actors.length = 0;
    this.attackSlots.clear();
    this.active = false;
  }

  private createActor(spawn: EnemySpawn, onDefeated: () => void): EncounterActor {
    if (spawn.kind !== 'finalBoss') {
      return new InvaderEnemy(this.scene, spawn.x, spawn.y, spawn.kind, this.enemyContext, onDefeated, spawn.overrides, spawn.scale);
    }
    const context: BossContext = {
      scene: this.scene,
      hooks: this.hooks,
      arena: this.arena,
      addActor: (actor) => this.actors.push(actor),
      spawnMinion: (x, y) => {
        this.actors.push(new InvaderEnemy(this.scene, x, y, 'invasor', this.enemyContext, undefined, undefined, spawn.scale));
      },
      livingMinionCount: () => this.livingEnemies.filter((actor) => actor instanceof InvaderEnemy).length,
      removeHazards: () => {
        for (const actor of this.livingEnemies) {
          if (actor instanceof PadelBall || actor instanceof AbductionBeam || actor instanceof SmokeBomb) actor.destroy();
        }
      },
    };
    return new SupremoBoss(spawn.x, spawn.y, context, onDefeated);
  }

  /** When the last wave falls, summoned minions and leftover balls/beams vanish with it. */
  private dismissLeftovers() {
    for (const actor of this.actors) {
      if (actor.isActive) actor.destroy();
    }
  }
}
