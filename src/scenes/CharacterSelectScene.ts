import Phaser from 'phaser';
import {
  DEFAULT_PARTY_SELECTION,
  getLockedHint,
  getRosterCharacter,
  MAX_PARTY_SIZE,
  ROSTER,
  type RosterCharacter,
  type RosterCharacterId,
} from '../data/roster';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import {
  getUnlockedCharacterIds,
  isCharacterUnlocked,
  sanitizePartySelection,
  type PartySelection,
} from '../systems/rosterProgress';
import { COLORS, FONTS } from '../ui/theme';
import { createButton } from '../ui/createButton';

const GRID = {
  columns: 5,
  cardWidth: 132,
  cardHeight: 76,
  gapX: 14,
  gapY: 12,
  topY: 210,
} as const;

export class CharacterSelectScene extends Phaser.Scene {
  private party: PartySelection = [...DEFAULT_PARTY_SELECTION];
  private partySummaryText!: Phaser.GameObjects.Text;
  private cardBackgrounds = new Map<RosterCharacterId, Phaser.GameObjects.Rectangle>();
  private cardStatusTexts = new Map<RosterCharacterId, Phaser.GameObjects.Text>();

  constructor() {
    super({ key: 'CharacterSelectScene' });
  }

  create() {
    this.party = sanitizePartySelection(this.party);
    this.cameras.main.setBackgroundColor(COLORS.background);

    this.add
      .text(GAME_WIDTH / 2, 48, 'Choose your team', {
        fontFamily: FONTS.title,
        fontSize: '40px',
        color: COLORS.textBright,
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 88, 'Pick 1 to 4 unlocked friends. Click again to remove.', {
        fontFamily: FONTS.ui,
        fontSize: '17px',
        color: COLORS.textMuted,
      })
      .setOrigin(0.5);

    this.partySummaryText = this.add
      .text(GAME_WIDTH / 2, 128, '', {
        fontFamily: FONTS.mono,
        fontSize: '16px',
        color: COLORS.text,
      })
      .setOrigin(0.5);

    this.createRosterGrid();
    this.refreshUi();

    createButton(this, {
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT - 88,
      width: 280,
      height: 52,
      label: 'START LEVEL',
      color: COLORS.playerCarol,
      hoverColor: 0x7aaef7,
      onClick: () => {
        this.registry.set('partySelection', sanitizePartySelection(this.party));
        this.scene.start('LevelScene');
      },
    });

    createButton(this, {
      x: 120,
      y: GAME_HEIGHT - 88,
      width: 160,
      height: 44,
      label: 'BACK',
      color: COLORS.prop,
      hoverColor: COLORS.propBorder,
      onClick: () => this.scene.start('TitleScene'),
    });
  }

  private createRosterGrid() {
    const { columns, cardWidth, cardHeight, gapX, gapY, topY } = GRID;

    for (const [index, character] of ROSTER.entries()) {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const rowCount = row === 2 ? 3 : columns;
      const rowWidth = rowCount * cardWidth + (rowCount - 1) * gapX;
      const rowOriginX = (GAME_WIDTH - rowWidth) / 2;
      const rowColumn = row === 2 ? index - 10 : column;
      const x = rowOriginX + rowColumn * (cardWidth + gapX) + cardWidth / 2;
      const y = topY + row * (cardHeight + gapY) + cardHeight / 2;

      if (row === 2 && column >= 3) continue;

      this.createRosterCard(character, x, y, cardWidth, cardHeight);
    }
  }

  private createRosterCard(character: RosterCharacter, x: number, y: number, width: number, height: number) {
    const background = this.add
      .rectangle(x, y, width, height, character.color, 0.88)
      .setStrokeStyle(2, COLORS.propBorder);

    this.add
      .text(x, y - 10, character.name, {
        fontFamily: FONTS.ui,
        fontSize: '20px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const statusText = this.add
      .text(x, y + 18, '', {
        fontFamily: FONTS.mono,
        fontSize: '12px',
        color: COLORS.textMuted,
        align: 'center',
        wordWrap: { width: width - 12 },
      })
      .setOrigin(0.5);

    this.cardBackgrounds.set(character.id, background);
    this.cardStatusTexts.set(character.id, statusText);

    background.setInteractive({ useHandCursor: true });
    background.on('pointerdown', () => this.toggleCharacter(character.id));
  }

  private toggleCharacter(id: RosterCharacterId) {
    if (!isCharacterUnlocked(id)) return;

    const slotIndex = this.party.indexOf(id);
    if (slotIndex >= 0) {
      if (this.party.length === 1) return;
      this.party = this.party.filter((entry) => entry !== id);
    } else if (this.party.length < MAX_PARTY_SIZE) {
      this.party = [...this.party, id];
    }

    this.party = sanitizePartySelection(this.party);
    this.refreshUi();
  }

  private refreshUi() {
    const unlocked = getUnlockedCharacterIds();
    const partyLabels = this.party.map((id, index) => `P${index + 1} ${getRosterCharacter(id).name}`);
    this.partySummaryText.setText(
      `${this.party.length} player${this.party.length === 1 ? '' : 's'} · ${partyLabels.join(' · ')}`,
    );

    for (const character of ROSTER) {
      const background = this.cardBackgrounds.get(character.id);
      const statusText = this.cardStatusTexts.get(character.id);
      if (!background || !statusText) continue;

      const isUnlocked = unlocked.has(character.id);
      const slotIndex = this.party.indexOf(character.id);

      background.setAlpha(isUnlocked ? 1 : 0.35);
      background.setStrokeStyle(
        2,
        slotIndex >= 0 ? 0xffffff : isUnlocked ? COLORS.propBorder : 0x6b7280,
      );

      if (!isUnlocked) {
        statusText.setText(`LOCKED · ${getLockedHint(character)}`);
      } else if (slotIndex >= 0) {
        statusText.setText(`P${slotIndex + 1} · UNLOCKED`);
      } else if (this.party.length >= MAX_PARTY_SIZE) {
        statusText.setText('UNLOCKED · Team full');
      } else {
        statusText.setText('UNLOCKED');
      }
    }
  }
}
