import Phaser from 'phaser';
import { COMBAT } from '../config/combat';
import { COLORS, textStyle } from '../ui/theme';
import { isTouchDevice } from '../systems/device';

/**
 * Messages are closed with the attack button, so ignore presses for a moment after one opens;
 * otherwise a player mashing attack when a fight ends would skip it unread.
 */
const MESSAGE_MIN_VISIBLE_MS = 600;
const BOSS_BAR_WIDTH = 600;

const DEPTH = 10_000;
/** Player cards along the top-left of the HUD band (one per player). */
const CARD = { x: 20, y: 16, spacing: 330, portrait: 56, barX: 68, barY: 34, barWidth: 190, barHeight: 16 } as const;
/** Health bar segments, so the bar reads as chunks of life rather than a number. */
const HP_PER_SEGMENT = 25;
const SPECIAL = { x: 830, y: 44, width: 240, height: 14, segments: 4 } as const;
const OBJECTIVE = { right: 1196, y: 14, width: 250 } as const;
/** Pause button in the top-right corner (tap or click; Esc / P / Start also work). */
const PAUSE_BUTTON = { x: 1236, y: 40, size: 48 } as const;
const HP_COLORS = { high: 0x22c55e, mid: 0xfacc15, low: 0xef4444, trail: 0xfef2f2 } as const;
const BAR_BACK = 0x0b0d16;
const BAR_BORDER = 0x3b4252;

type PlayerCard = {
  container: Phaser.GameObjects.Container;
  portrait: Phaser.GameObjects.Rectangle;
  initial: Phaser.GameObjects.Text;
  knockout: Phaser.GameObjects.Text;
  fill: Phaser.GameObjects.Rectangle;
  trail: Phaser.GameObjects.Rectangle;
  number: Phaser.GameObjects.Text;
  ticks: Phaser.GameObjects.Graphics;
  /** Last health shown, to tell damage from healing. */
  shown: number;
};

export type HudPlayer = { name: string; color: number };

export class GameHud {
  private readonly objectiveText: Phaser.GameObjects.Text;
  private readonly cards: PlayerCard[] = [];
  private readonly specialFill: Phaser.GameObjects.Rectangle;
  private readonly specialLabel: Phaser.GameObjects.Text;
  private readonly interactHint: Phaser.GameObjects.Text;
  private readonly goHint: Phaser.GameObjects.Text;
  private readonly bossBar: Phaser.GameObjects.Container;
  private readonly bossFill: Phaser.GameObjects.Rectangle;
  private readonly bossTrail: Phaser.GameObjects.Rectangle;
  private readonly messageOverlay: Phaser.GameObjects.Container;
  private readonly scene: Phaser.Scene;
  private pauseHandler: (() => void) | null = null;
  private messageOpen = false;
  private messageOpenedAt = 0;
  private onMessageClose: (() => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const fixed = <T extends Phaser.GameObjects.GameObject & { setScrollFactor(x: number): T; setDepth(d: number): T }>(object: T, depth = DEPTH) =>
      object.setScrollFactor(0).setDepth(depth);

    // Objective: top right, under a small heading.
    fixed(scene.add.text(OBJECTIVE.right, OBJECTIVE.y, 'OBJETIVO', textStyle('caption', { color: '#fbbf24' })).setOrigin(1, 0));
    this.objectiveText = fixed(
      scene.add
        .text(OBJECTIVE.right, OBJECTIVE.y + 18, '', textStyle('bodySmall', { align: 'right', wordWrap: { width: OBJECTIVE.width } }))
        .setOrigin(1, 0),
    );

    // Team special: segmented gauge.
    this.specialLabel = fixed(
      scene.add.text(SPECIAL.x, SPECIAL.y - 24, 'ESPECIAL DE EQUIPO', textStyle('caption', { color: COLORS.textMuted })).setOrigin(0.5),
    );
    fixed(
      scene.add
        .rectangle(SPECIAL.x, SPECIAL.y, SPECIAL.width + 4, SPECIAL.height + 4, BAR_BACK)
        .setStrokeStyle(2, BAR_BORDER),
    );
    this.specialFill = fixed(
      scene.add.rectangle(SPECIAL.x - SPECIAL.width / 2, SPECIAL.y, 0, SPECIAL.height, 0xfbbf24).setOrigin(0, 0.5),
      DEPTH + 1,
    );
    const specialTicks = fixed(scene.add.graphics(), DEPTH + 2);
    specialTicks.fillStyle(BAR_BACK, 1);
    for (let i = 1; i < SPECIAL.segments; i += 1) {
      specialTicks.fillRect(SPECIAL.x - SPECIAL.width / 2 + (SPECIAL.width * i) / SPECIAL.segments - 1, SPECIAL.y - SPECIAL.height / 2, 2, SPECIAL.height);
    }

    // Pause button: two bars, like every pause icon.
    const pauseButton = fixed(
      scene.add
        .rectangle(PAUSE_BUTTON.x, PAUSE_BUTTON.y, PAUSE_BUTTON.size, PAUSE_BUTTON.size, BAR_BACK, 0.85)
        .setStrokeStyle(2, BAR_BORDER),
    );
    const pauseIcon = fixed(scene.add.graphics(), DEPTH + 1);
    pauseIcon.fillStyle(0xffffff, 0.9);
    pauseIcon.fillRect(PAUSE_BUTTON.x - 11, PAUSE_BUTTON.y - 12, 8, 24);
    pauseIcon.fillRect(PAUSE_BUTTON.x + 3, PAUSE_BUTTON.y - 12, 8, 24);
    pauseButton.setInteractive({ useHandCursor: true });
    pauseButton.on('pointerdown', () => this.pauseHandler?.());

    this.interactHint = fixed(scene.add.text(640, 612, '', textStyle('bodySmall', { color: '#fbbf24' })).setOrigin(0.5));

    // Boss: wide bar along the bottom, with the same damage trail as the players'.
    this.bossBar = fixed(scene.add.container(640, 660)).setVisible(false);
    this.bossTrail = scene.add.rectangle(-BOSS_BAR_WIDTH / 2, 12, BOSS_BAR_WIDTH, 16, HP_COLORS.trail).setOrigin(0, 0.5);
    this.bossFill = scene.add.rectangle(-BOSS_BAR_WIDTH / 2, 12, BOSS_BAR_WIDTH, 16, 0xef4444).setOrigin(0, 0.5);
    this.bossBar.add([
      scene.add.text(0, -12, '', textStyle('bodySmall', { color: COLORS.textBright })).setOrigin(0.5).setName('name'),
      scene.add.rectangle(0, 12, BOSS_BAR_WIDTH + 6, 22, BAR_BACK).setStrokeStyle(2, BAR_BORDER),
      this.bossTrail,
      this.bossFill,
    ]);

    this.goHint = scene.add
      .text(1240, 360, '¡ADELANTE! →', textStyle('heading', { color: '#fbbf24' }))
      .setOrigin(1, 0.5)
      .setScrollFactor(0)
      .setDepth(10_000)
      .setVisible(false);

    this.messageOverlay = scene.add.container(640, 360).setVisible(false).setScrollFactor(0).setDepth(20_000);
    this.messageOverlay.add(
      scene.add.rectangle(0, 0, 760, 360, 0x000000, 0.86).setStrokeStyle(2, COLORS.propBorder),
    );
  }

  /** One card per player: color swatch with their initial, name and a segmented health bar. */
  bindPlayers(players: HudPlayer[]) {
    for (const card of this.cards) card.container.destroy();
    this.cards.length = 0;

    players.forEach((player, index) => {
      const x = CARD.x + index * CARD.spacing;
      const container = this.scene.add.container(x, CARD.y).setScrollFactor(0).setDepth(DEPTH);
      const portrait = this.scene.add
        .rectangle(CARD.portrait / 2, CARD.portrait / 2, CARD.portrait, CARD.portrait, player.color)
        .setStrokeStyle(2, 0xffffff, 0.85);
      const initial = this.scene.add
        .text(CARD.portrait / 2, CARD.portrait / 2, player.name.charAt(0).toUpperCase(), textStyle('heading', { color: '#ffffff' }))
        .setOrigin(0.5);
      const knockout = this.scene.add
        .text(CARD.portrait / 2, CARD.portrait / 2, 'K.O.', textStyle('subheading', { color: '#f87171' }))
        .setOrigin(0.5)
        .setVisible(false);
      const name = this.scene.add.text(CARD.barX, 4, `J${index + 1} · ${player.name}`, textStyle('bodySmall', { color: '#ffffff' }));
      const back = this.scene.add
        .rectangle(CARD.barX - 2, CARD.barY, CARD.barWidth + 4, CARD.barHeight + 4, BAR_BACK)
        .setOrigin(0, 0)
        .setStrokeStyle(2, BAR_BORDER);
      const trail = this.scene.add.rectangle(CARD.barX, CARD.barY + 2, CARD.barWidth, CARD.barHeight, HP_COLORS.trail).setOrigin(0, 0);
      const fill = this.scene.add.rectangle(CARD.barX, CARD.barY + 2, CARD.barWidth, CARD.barHeight, HP_COLORS.high).setOrigin(0, 0);
      const ticks = this.scene.add.graphics();
      const number = this.scene.add
        .text(CARD.barX + CARD.barWidth + 8, CARD.barY + 2 + CARD.barHeight / 2, '', textStyle('caption', { color: COLORS.textMuted }))
        .setOrigin(0, 0.5);
      container.add([portrait, initial, knockout, name, back, trail, fill, ticks, number]);
      this.cards.push({ container, portrait, initial, knockout, fill, trail, number, ticks, shown: -1 });
    });
  }

  /** What the on-screen pause button does. */
  onPause(handler: () => void) {
    this.pauseHandler = handler;
  }

  setObjective(text: string) {
    this.objectiveText.setText(text);
  }

  setPlayerHp(index: number, current: number, max: number) {
    const card = this.cards[index];
    if (!card) return;
    const ratio = Phaser.Math.Clamp(current / max, 0, 1);
    const width = CARD.barWidth * ratio;

    if (card.shown < 0) this.drawTicks(card, max);
    card.fill.width = width;
    card.fill.setFillStyle(ratio > 0.5 ? HP_COLORS.high : ratio > 0.25 ? HP_COLORS.mid : HP_COLORS.low);
    card.number.setText(`${current}`);

    // Damage leaves a pale trail that catches up after a beat; healing shows right away.
    this.scene.tweens.killTweensOf(card.trail);
    if (card.shown >= 0 && current < card.shown) {
      this.scene.tweens.add({ targets: card.trail, width, delay: 250, duration: 400, ease: 'Quad.easeOut' });
    } else {
      card.trail.width = width;
    }
    card.shown = current;

    const down = current <= 0;
    card.knockout.setVisible(down);
    card.initial.setVisible(!down);
    card.container.setAlpha(down ? 0.55 : 1);
  }

  setSpecial(charge: number, readyFlash: boolean) {
    const ratio = Phaser.Math.Clamp(charge / COMBAT.specialMax, 0, 1);
    this.specialFill.width = SPECIAL.width * ratio;
    this.specialFill.setFillStyle(readyFlash ? 0xffffff : 0xfbbf24);
    const ready = ratio >= 1;
    this.specialLabel.setText(ready ? '¡ESPECIAL LISTO!' : 'ESPECIAL DE EQUIPO');
    this.specialLabel.setColor(ready ? '#fbbf24' : COLORS.textMuted);
  }

  /** Dark notches every HP_PER_SEGMENT so the bar reads as chunks of life. */
  private drawTicks(card: PlayerCard, max: number) {
    card.ticks.clear().fillStyle(BAR_BACK, 1);
    const segments = Math.max(1, Math.round(max / HP_PER_SEGMENT));
    for (let i = 1; i < segments; i += 1) {
      card.ticks.fillRect(CARD.barX + (CARD.barWidth * i) / segments - 1, CARD.barY + 2, 2, CARD.barHeight);
    }
  }

  setInteractHint(text: string) {
    this.interactHint.setText(text);
  }

  showBossBar(name: string) {
    (this.bossBar.getByName('name') as Phaser.GameObjects.Text).setText(name.toUpperCase());
    this.bossBar.setVisible(true);
  }

  setBossHealth(current: number, max: number) {
    const width = BOSS_BAR_WIDTH * Phaser.Math.Clamp(current / max, 0, 1);
    const tookDamage = width < this.bossFill.width;
    this.bossFill.width = width;
    this.scene.tweens.killTweensOf(this.bossTrail);
    if (tookDamage) {
      this.scene.tweens.add({ targets: this.bossTrail, width, delay: 250, duration: 450, ease: 'Quad.easeOut' });
    } else {
      this.bossTrail.width = width;
    }
  }

  hideBossBar() {
    this.bossBar.setVisible(false);
  }

  /** Classic beat 'em up "GO →" prompt shown when the camera is released. */
  showGoHint() {
    this.scene.tweens.killTweensOf(this.goHint);
    this.goHint.setVisible(true).setAlpha(1);
    this.scene.tweens.add({
      targets: this.goHint,
      alpha: 0,
      duration: 350,
      yoyo: true,
      repeat: 4,
      onComplete: () => this.goHint.setVisible(false),
    });
  }

  isMessageOpen() {
    return this.messageOpen;
  }

  tryDismissMessage(confirmPressed: boolean) {
    if (!this.messageOpen || !confirmPressed) return false;
    if (this.scene.game.loop.time - this.messageOpenedAt < MESSAGE_MIN_VISIBLE_MS) return false;
    this.hideMessage();
    return true;
  }

  showMessage(title: string, body: string, onClose: () => void) {
    this.onMessageClose = onClose;
    this.messageOpen = true;
    this.messageOpenedAt = this.scene.game.loop.time;
    this.messageOverlay.removeAll(true);
    this.messageOverlay.add(
      this.scene.add.rectangle(0, 0, 760, 360, 0x000000, 0.86).setStrokeStyle(2, COLORS.propBorder),
    );
    this.messageOverlay.add(
      this.scene.add
        .text(0, -120, title, textStyle('heading', { color: COLORS.textBright }))
        .setOrigin(0.5),
    );
    this.messageOverlay.add(
      this.scene.add
        .text(0, -20, body, textStyle('body', {
          align: 'center',
          wordWrap: { width: 680 },
        }))
        .setOrigin(0.5),
    );

    const close = this.scene.add
      .text(0, 120, isTouchDevice() ? '[ Toca GOLPE para continuar ]' : '[ Golpea para continuar ]', textStyle('bodySmall', {
        color: COLORS.textMuted,
      }))
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    close.on('pointerdown', () => this.hideMessage());
    this.messageOverlay.add(close);
    this.messageOverlay.setVisible(true);
  }

  private hideMessage() {
    if (!this.messageOpen) return;

    this.messageOpen = false;
    this.messageOverlay.setVisible(false);
    const onClose = this.onMessageClose;
    this.onMessageClose = null;
    onClose?.();
  }
}
