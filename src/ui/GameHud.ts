import Phaser from 'phaser';
import { COMBAT } from '../config/combat';
import { COLORS, FONTS } from '../ui/theme';
import { getControlHintLines, type PlayerCount } from '../types/player';

export class GameHud {
  private readonly objectiveText: Phaser.GameObjects.Text;
  private readonly controlsText: Phaser.GameObjects.Text;
  private readonly hpTexts: Phaser.GameObjects.Text[] = [];
  private readonly specialFill: Phaser.GameObjects.Rectangle;
  private readonly interactHint: Phaser.GameObjects.Text;
  private readonly messageOverlay: Phaser.GameObjects.Container;
  private readonly scene: Phaser.Scene;
  private messageOpen = false;
  private onMessageClose: (() => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.objectiveText = scene.add
      .text(24, 16, '', { fontFamily: FONTS.ui, fontSize: '20px', color: COLORS.text })
      .setScrollFactor(0)
      .setDepth(10_000);

    this.controlsText = scene.add
      .text(1256, 12, '', {
        fontFamily: FONTS.mono,
        fontSize: '12px',
        color: COLORS.textMuted,
        align: 'right',
        lineSpacing: 2,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(10_000);

    scene.add
      .rectangle(640, 34, 220, 14, 0x30363d)
      .setStrokeStyle(1, COLORS.propBorder)
      .setScrollFactor(0)
      .setDepth(10_000);

    scene.add
      .text(640, 14, 'ESPECIAL DE EQUIPO', {
        fontFamily: FONTS.mono,
        fontSize: '12px',
        color: COLORS.textMuted,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(10_000);

    this.specialFill = scene.add
      .rectangle(531, 34, 0, 10, 0xfbbf24)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(10_001);

    this.interactHint = scene.add
      .text(640, 680, '', {
        fontFamily: FONTS.mono,
        fontSize: '18px',
        color: '#fbbf24',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(10_000);

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
          .text(24, 48 + index * 20, `${name} Vida: --/--`, {
            fontFamily: FONTS.mono,
            fontSize: '14px',
            color: index % 2 === 0 ? COLORS.text : COLORS.textMuted,
          })
          .setScrollFactor(0)
          .setDepth(10_000),
      );
    });

    this.controlsText.setText(getControlHintLines(playerCount).join('\n'));
  }

  setObjective(text: string) {
    this.objectiveText.setText(`Objetivo: ${text}`);
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

  isMessageOpen() {
    return this.messageOpen;
  }

  tryDismissMessage(interactPressed: boolean) {
    if (!this.messageOpen || !interactPressed) return false;
    this.hideMessage();
    return true;
  }

  showMessage(title: string, body: string, onClose: () => void) {
    this.onMessageClose = onClose;
    this.messageOpen = true;
    this.messageOverlay.removeAll(true);
    this.messageOverlay.add(
      this.scene.add.rectangle(0, 0, 760, 360, 0x000000, 0.86).setStrokeStyle(2, COLORS.propBorder),
    );
    this.messageOverlay.add(
      this.scene.add
        .text(0, -120, title, { fontFamily: FONTS.mono, fontSize: '28px', color: COLORS.textBright })
        .setOrigin(0.5),
    );
    this.messageOverlay.add(
      this.scene.add
        .text(0, -20, body, {
          fontFamily: FONTS.ui,
          fontSize: '20px',
          color: COLORS.text,
          align: 'center',
          wordWrap: { width: 680 },
        })
        .setOrigin(0.5),
    );

    const close = this.scene.add
      .text(0, 120, '[ Presiona interactuar (E · P · botón B) para continuar ]', {
        fontFamily: FONTS.mono,
        fontSize: '16px',
        color: COLORS.textMuted,
      })
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
