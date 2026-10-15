import Phaser from 'phaser';
import { COMBAT } from '../config/combat';
import { COLORS, textStyle } from '../ui/theme';
import { getControlHintLines, type PlayerCount } from '../types/player';

/**
 * Messages are closed with the attack button, so ignore presses for a moment after one opens;
 * otherwise a player mashing attack when a fight ends would skip it unread.
 */
const MESSAGE_MIN_VISIBLE_MS = 600;
const BOSS_BAR_WIDTH = 600;

export class GameHud {
  private readonly objectiveText: Phaser.GameObjects.Text;
  private readonly controlsText: Phaser.GameObjects.Text;
  private readonly hpTexts: Phaser.GameObjects.Text[] = [];
  private readonly specialFill: Phaser.GameObjects.Rectangle;
  private readonly interactHint: Phaser.GameObjects.Text;
  private readonly goHint: Phaser.GameObjects.Text;
  private readonly bossBar: Phaser.GameObjects.Container;
  private readonly bossFill: Phaser.GameObjects.Rectangle;
  private readonly messageOverlay: Phaser.GameObjects.Container;
  private readonly scene: Phaser.Scene;
  private messageOpen = false;
  private messageOpenedAt = 0;
  private onMessageClose: (() => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.objectiveText = scene.add
      // Wraps before reaching the special bar in the top center.
      .text(24, 16, '', textStyle('bodySmall', { wordWrap: { width: 490 } }))
      .setScrollFactor(0)
      .setDepth(10_000);

    this.controlsText = scene.add
      .text(1256, 12, '', textStyle('caption', {
        color: COLORS.textMuted,
        align: 'right',
        lineSpacing: 2,
      }))
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(10_000);

    scene.add
      .rectangle(640, 34, 220, 14, 0x30363d)
      .setStrokeStyle(1, COLORS.propBorder)
      .setScrollFactor(0)
      .setDepth(10_000);

    scene.add
      .text(640, 14, 'ESPECIAL DE EQUIPO', textStyle('caption', {
        color: COLORS.textMuted,
      }))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(10_000);

    this.specialFill = scene.add
      .rectangle(531, 34, 0, 10, 0xfbbf24)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(10_001);

    this.interactHint = scene.add
      .text(640, 612, '', textStyle('bodySmall', {
        color: '#fbbf24',
      }))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(10_000);

    this.bossBar = scene.add.container(640, 660).setScrollFactor(0).setDepth(10_000).setVisible(false);
    this.bossFill = scene.add.rectangle(-BOSS_BAR_WIDTH / 2, 12, BOSS_BAR_WIDTH, 12, 0xef4444).setOrigin(0, 0.5);
    this.bossBar.add([
      scene.add.text(0, -10, '', textStyle('label', { color: COLORS.textBright })).setOrigin(0.5).setName('name'),
      scene.add.rectangle(0, 12, BOSS_BAR_WIDTH + 4, 16, 0x30363d).setStrokeStyle(1, COLORS.propBorder),
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

  bindPlayers(names: string[], playerCount: PlayerCount) {
    for (const text of this.hpTexts) text.destroy();
    this.hpTexts.length = 0;

    names.forEach((name, index) => {
      this.hpTexts.push(
        this.scene.add
          .text(24, this.hpTop() + index * 20, `${name} Vida: --/--`, textStyle('label', {
            color: index % 2 === 0 ? COLORS.text : COLORS.textMuted,
          }))
          .setScrollFactor(0)
          .setDepth(10_000),
      );
    });

    this.controlsText.setText(getControlHintLines(playerCount).join('\n'));
  }

  setObjective(text: string) {
    this.objectiveText.setText(`Objetivo: ${text}`);
    // Keep the HP lines just below the objective, which may wrap to two lines.
    this.hpTexts.forEach((label, index) => label.setY(this.hpTop() + index * 20));
  }

  private hpTop() {
    return this.objectiveText.y + Math.max(this.objectiveText.height, 20) + 6;
  }

  setPlayerHp(index: number, current: number, max: number) {
    const label = this.hpTexts[index];
    if (!label) return;
    const name = label.text.split(' Vida:')[0];
    label.setText(`${name} Vida: ${current}/${max}`);
  }

  setSpecial(charge: number, readyFlash: boolean) {
    const width = (charge / COMBAT.specialMax) * 218;
    this.specialFill.width = width;
    this.specialFill.setFillStyle(readyFlash ? 0xffffff : 0xfbbf24);
  }

  setInteractHint(text: string) {
    this.interactHint.setText(text);
  }

  showBossBar(name: string) {
    (this.bossBar.getByName('name') as Phaser.GameObjects.Text).setText(name.toUpperCase());
    this.bossBar.setVisible(true);
  }

  setBossHealth(current: number, max: number) {
    this.bossFill.width = BOSS_BAR_WIDTH * Phaser.Math.Clamp(current / max, 0, 1);
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
      .text(0, 120, '[ Presiona golpe (J · L · botón X) para continuar ]', textStyle('bodySmall', {
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
