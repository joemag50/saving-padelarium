import Phaser from 'phaser';
import {
  getDefaultParty,
  getRosterCharacter,
  ROSTER,
  type RosterCharacter,
  type RosterCharacterId,
} from '../data/roster';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import {
  getLockedHint,
  getUnlockedCharacterIds,
  isCharacterUnlocked,
  sanitizePartySelection,
  type PartySelection,
} from '../systems/rosterProgress';
import { getCurrentLevel, getPlayerCount } from '../systems/session';
import type { PlayerCount } from '../types/player';
import { COLORS, textStyle } from '../ui/theme';
import { createButton } from '../ui/createButton';
import { bindMenuInput } from '../ui/menuInput';
import { addMenuBackground, MENU_TEXTURES } from '../ui/menuBackground';

const GRID = {
  columns: 5,
  cardWidth: 132,
  cardHeight: 76,
  gapX: 14,
  gapY: 12,
  topY: 210,
} as const;

export class CharacterSelectScene extends Phaser.Scene {
  private playerCount: PlayerCount = 1;
  private party: PartySelection = [];
  private partySummaryText!: Phaser.GameObjects.Text;
  private startButton?: Phaser.GameObjects.Container;
  private cardBackgrounds = new Map<RosterCharacterId, Phaser.GameObjects.Rectangle>();
  private cardStatusTexts = new Map<RosterCharacterId, Phaser.GameObjects.Text>();

  constructor() {
    super({ key: 'CharacterSelectScene' });
  }

  create() {
    this.playerCount = getPlayerCount(this.registry);
    this.party = this.initialParty();
    this.cameras.main.setBackgroundColor(COLORS.background);
    addMenuBackground(this, MENU_TEXTURES.menu, 0.35);

    this.add
      .text(GAME_WIDTH / 2, 48, this.playerCount === 1 ? 'Elige tu personaje' : 'Elijan su equipo', textStyle('display', {
        color: COLORS.textBright,
      }))
      .setOrigin(0.5);

    const instructions =
      this.playerCount === 1
        ? 'Elige a un amigo desbloqueado.'
        : 'Elijan 2 amigos desbloqueados. Clic de nuevo para quitar.';
    this.add
      .text(GAME_WIDTH / 2, 88, instructions, textStyle('bodySmall', {
        color: COLORS.textMuted,
      }))
      .setOrigin(0.5);

    this.partySummaryText = this.add
      .text(GAME_WIDTH / 2, 128, '', textStyle('bodySmall'))
      .setOrigin(0.5);

    const level = getCurrentLevel(this.registry);
    this.add
      .text(GAME_WIDTH / 2, 165, `Nivel ${level.id}: ${level.title}`, textStyle('bodySmall', {
        color: '#fbbf24',
      }))
      .setOrigin(0.5);

    this.createRosterGrid();

    this.startButton = createButton(this, {
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT - 88,
      width: 280,
      height: 52,
      label: 'EMPEZAR',
      color: COLORS.playerCarol,
      hoverColor: 0x7aaef7,
      onClick: () => this.startLevel(),
    });
    this.refreshUi();

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 44, 'Enter, J o botón A para empezar · Esc o B para volver', textStyle('label', {
        color: COLORS.textMuted,
      }))
      .setOrigin(0.5);

    bindMenuInput(this, {
      confirm: () => this.startLevel(),
      back: () => this.scene.start('LevelSelectScene'),
    });

    createButton(this, {
      x: 120,
      y: GAME_HEIGHT - 88,
      width: 160,
      height: 44,
      label: 'ATRÁS',
      color: COLORS.prop,
      hoverColor: COLORS.propBorder,
      onClick: () => this.scene.start('LevelSelectScene'),
    });
  }

  /** Keeps the previous pick when possible, topping up with defaults/unlocked friends. */
  private initialParty(): PartySelection {
    const previous = (this.registry.get('partySelection') as PartySelection | undefined) ?? [];
    const candidates = [...previous, ...getDefaultParty(this.playerCount), ...getUnlockedCharacterIds()];
    return sanitizePartySelection(candidates, this.playerCount);
  }

  private startLevel() {
    if (this.party.length !== this.playerCount) return;
    this.registry.set('partySelection', [...this.party]);
    this.scene.start('LevelScene');
  }

  private createRosterGrid() {
    const { columns, cardWidth, cardHeight, gapX, gapY, topY } = GRID;

    for (const [index, character] of ROSTER.entries()) {
      const column = index % columns;
      const row = Math.floor(index / columns);
      // The last row may be shorter; it's centered like the full ones.
      const rowCount = Math.min(columns, ROSTER.length - row * columns);
      const rowWidth = rowCount * cardWidth + (rowCount - 1) * gapX;
      const rowOriginX = (GAME_WIDTH - rowWidth) / 2;
      const x = rowOriginX + column * (cardWidth + gapX) + cardWidth / 2;
      const y = topY + row * (cardHeight + gapY) + cardHeight / 2;

      this.createRosterCard(character, x, y, cardWidth, cardHeight);
    }
  }

  private createRosterCard(character: RosterCharacter, x: number, y: number, width: number, height: number) {
    const background = this.add
      .rectangle(x, y, width, height, character.color, 0.88)
      .setStrokeStyle(2, COLORS.propBorder);

    this.add
      .text(x, y - 10, character.name, textStyle('body', {
        color: '#ffffff',
      }))
      .setOrigin(0.5);

    const statusText = this.add
      .text(x, y + 18, '', textStyle('caption', {
        color: COLORS.textMuted,
        align: 'center',
        wordWrap: { width: width - 12 },
      }))
      .setOrigin(0.5);

    this.cardBackgrounds.set(character.id, background);
    this.cardStatusTexts.set(character.id, statusText);

    background.setInteractive({ useHandCursor: true });
    background.on('pointerdown', () => this.toggleCharacter(character.id));
  }

  private toggleCharacter(id: RosterCharacterId) {
    if (!isCharacterUnlocked(id)) return;

    if (this.party.includes(id)) {
      this.party = this.party.filter((entry) => entry !== id);
    } else if (this.party.length < this.playerCount) {
      this.party = [...this.party, id];
    } else {
      // Team is full: swap out the last pick so a click always does something.
      this.party = [...this.party.slice(0, -1), id];
    }

    this.refreshUi();
  }

  private refreshUi() {
    const unlocked = getUnlockedCharacterIds();
    const partyLabels = this.party.map((id, index) => `J${index + 1} ${getRosterCharacter(id).name}`);
    const missing = this.playerCount - this.party.length;
    this.partySummaryText.setText(
      missing > 0
        ? `Falta${missing === 1 ? '' : 'n'} ${missing} por elegir${partyLabels.length ? ` · ${partyLabels.join(' · ')}` : ''}`
        : partyLabels.join(' · '),
    );
    this.startButton?.setAlpha(missing > 0 ? 0.4 : 1);

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
        statusText.setText(`BLOQUEADO · ${getLockedHint(character)}`);
      } else if (slotIndex >= 0) {
        statusText.setText(`J${slotIndex + 1} · ELEGIDO`);
      } else {
        statusText.setText('DISPONIBLE');
      }
    }
  }
}
