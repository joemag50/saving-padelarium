class SoundManager {
  private context: AudioContext | null = null;

  ensureContext() {
    if (!this.context) {
      this.context = new AudioContext();
    }
    void this.context.resume();
  }

  playHit() {
    this.playTone(240, 0.06, 'square', 0.05);
  }

  playPlayerHurt() {
    this.playTone(120, 0.12, 'sawtooth', 0.06);
  }

  playDefeat() {
    this.playTone(90, 0.18, 'triangle', 0.05);
  }

  playDiscover() {
    this.playSequence([
      { f: 420, d: 0.08, t: 'sine' as OscillatorType, g: 0.06 },
      { f: 620, d: 0.12, t: 'sine' as OscillatorType, g: 0.05 },
    ]);
  }

  playSpecial() {
    this.playSequence([
      { f: 300, d: 0.05, t: 'square' as OscillatorType, g: 0.05 },
      { f: 450, d: 0.08, t: 'square' as OscillatorType, g: 0.05 },
      { f: 600, d: 0.1, t: 'square' as OscillatorType, g: 0.04 },
    ]);
  }

  /** Everyone is down: a sad slide down. */
  playKnockout() {
    this.playSequence([
      { f: 330, d: 0.16, t: 'triangle' as OscillatorType, g: 0.06 },
      { f: 247, d: 0.16, t: 'triangle' as OscillatorType, g: 0.06 },
      { f: 165, d: 0.32, t: 'triangle' as OscillatorType, g: 0.06 },
    ]);
  }

  /** Beaming back in: a quick shimmer up. */
  playRespawn() {
    this.playSequence([
      { f: 520, d: 0.06, t: 'sine' as OscillatorType, g: 0.05 },
      { f: 660, d: 0.06, t: 'sine' as OscillatorType, g: 0.05 },
      { f: 880, d: 0.06, t: 'sine' as OscillatorType, g: 0.05 },
      { f: 1175, d: 0.16, t: 'sine' as OscillatorType, g: 0.04 },
    ]);
  }

  playEncounterStart() {
    this.playTone(180, 0.15, 'triangle', 0.05);
  }

  private playTone(frequency: number, duration: number, type: OscillatorType, gain: number) {
    this.ensureContext();
    if (!this.context) return;

    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();
    const start = this.context.currentTime;
    const end = start + duration;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gainNode.gain.setValueAtTime(gain, start);
    gainNode.gain.exponentialRampToValueAtTime(0.001, end);
    oscillator.connect(gainNode);
    gainNode.connect(this.context.destination);
    oscillator.start(start);
    oscillator.stop(end);
  }

  private playSequence(steps: { f: number; d: number; t: OscillatorType; g: number }[]) {
    let offset = 0;
    for (const step of steps) {
      this.playToneAt(step.f, step.d, step.t, step.g, offset);
      offset += step.d;
    }
  }

  private playToneAt(
    frequency: number,
    duration: number,
    type: OscillatorType,
    gain: number,
    delay: number,
  ) {
    this.ensureContext();
    if (!this.context) return;

    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();
    const start = this.context.currentTime + delay;
    const end = start + duration;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gainNode.gain.setValueAtTime(gain, start);
    gainNode.gain.exponentialRampToValueAtTime(0.001, end);
    oscillator.connect(gainNode);
    gainNode.connect(this.context.destination);
    oscillator.start(start);
    oscillator.stop(end);
  }
}

export const soundManager = new SoundManager();
