import { COMBAT } from '../config/combat';
import { isEnemyTarget } from './damageRules';
import type { CombatTarget } from '../types/combat';
import { createCenteredHitbox, hitboxesOverlap } from './overlap';

export class PairSpecial {
  charge = 0;
  private flashUntil = 0;

  addCharge(amount = COMBAT.specialGainPerHit) {
    this.charge = Math.min(COMBAT.specialMax, this.charge + amount);
    if (this.charge >= COMBAT.specialMax) {
      this.flashUntil = performance.now() + 2000;
    }
  }

  canActivate() {
    return this.charge >= COMBAT.specialMax;
  }

  isReadyFlash(now: number) {
    return this.canActivate() && now < this.flashUntil;
  }

  activate(now: number, originX: number, originY: number, targets: CombatTarget[]): number {
    if (!this.canActivate()) return 0;

    this.charge = 0;
    this.flashUntil = 0;

    const hitbox = createCenteredHitbox(originX, originY, COMBAT.specialRadius * 2, COMBAT.specialRadius);
    let hits = 0;

    for (const target of targets) {
      if (!isEnemyTarget(target)) continue;
      if (!target.isActive || target.combatant.isDefeated) continue;
      if (!hitboxesOverlap(hitbox, target.hurtbox, COMBAT.depthTolerance + 20)) continue;
      if (target.combatant.takeDamage(COMBAT.specialDamage, now)) {
        target.onHit(now);
        hits += 1;
      }
    }

    return hits;
  }
}
