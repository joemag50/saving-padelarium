import { COMBAT } from '../config/combat';

export class Combatant {
  readonly maxHealth: number;
  private currentHealth: number;
  private readonly onHealthChanged?: (current: number, max: number) => void;
  private readonly onDefeated?: () => void;

  invulnerableUntil = 0;

  constructor(
    maxHealth: number,
    onHealthChanged?: (current: number, max: number) => void,
    onDefeated?: () => void,
  ) {
    this.maxHealth = maxHealth;
    this.onHealthChanged = onHealthChanged;
    this.onDefeated = onDefeated;
    this.currentHealth = maxHealth;
  }

  get health() {
    return this.currentHealth;
  }

  get isDefeated() {
    return this.currentHealth <= 0;
  }

  isInvulnerable(now: number) {
    return now < this.invulnerableUntil;
  }

  takeDamage(amount: number, now: number): boolean {
    if (this.isDefeated || this.isInvulnerable(now)) {
      return false;
    }

    this.currentHealth = Math.max(0, this.currentHealth - amount);
    this.onHealthChanged?.(this.currentHealth, this.maxHealth);

    if (this.isDefeated) {
      this.onDefeated?.();
      return true;
    }

    this.invulnerableUntil = now + COMBAT.invulnerabilityMs;
    return true;
  }

  reset() {
    this.currentHealth = this.maxHealth;
    this.invulnerableUntil = 0;
    this.onHealthChanged?.(this.currentHealth, this.maxHealth);
  }
}
