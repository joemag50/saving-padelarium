import { FIRST_LEVEL_ID, getRescueLevel, LEVELS } from '../data/levels';
import {
  DEFAULT_PARTY_SELECTION,
  getRosterCharacter,
  MAX_PARTY_SIZE,
  ROSTER,
  type RosterCharacter,
  type RosterCharacterId,
} from '../data/roster';

const STORAGE_KEY = 'padelarium-progress';
/** Pre-levels save format: a list of extra unlocked character ids (only ever 'rody'). */
const LEGACY_UNLOCKS_KEY = 'padelarium-roster-unlocks';

type SavedProgress = { completedLevels: number[] };

function readProgress(): SavedProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SavedProgress>;
      const completed = Array.isArray(parsed.completedLevels) ? parsed.completedLevels : [];
      return {
        completedLevels: completed.filter((id): id is number => LEVELS.some((level) => level.id === id)),
      };
    }
    return { completedLevels: readLegacyCompletedLevels() };
  } catch {
    return { completedLevels: [] };
  }
}

function readLegacyCompletedLevels(): number[] {
  const legacy = localStorage.getItem(LEGACY_UNLOCKS_KEY);
  return legacy?.includes('rody') ? [FIRST_LEVEL_ID] : [];
}

function writeProgress(progress: SavedProgress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function isLevelCompleted(levelId: number) {
  return readProgress().completedLevels.includes(levelId);
}

/** A level is playable once the one before it has been completed. */
export function isLevelUnlocked(levelId: number) {
  const index = LEVELS.findIndex((level) => level.id === levelId);
  if (index <= 0) return index === 0;
  return isLevelCompleted(LEVELS[index - 1].id);
}

export function markLevelCompleted(levelId: number) {
  const progress = readProgress();
  if (progress.completedLevels.includes(levelId)) return;
  writeProgress({ completedLevels: [...progress.completedLevels, levelId] });
}

export function getUnlockedCharacterIds(): Set<RosterCharacterId> {
  const completed = readProgress().completedLevels;
  const unlocked = new Set<RosterCharacterId>();
  for (const character of ROSTER) {
    const rescueLevel = getRescueLevel(character.id);
    if (character.starter || (rescueLevel && completed.includes(rescueLevel.id))) {
      unlocked.add(character.id);
    }
  }
  return unlocked;
}

export function isCharacterUnlocked(id: RosterCharacterId) {
  return getUnlockedCharacterIds().has(id);
}

export function getLockedHint(character: RosterCharacter) {
  const rescueLevel = getRescueLevel(character.id);
  return rescueLevel ? `Nivel ${rescueLevel.id}` : 'Próximamente';
}

export type PartySelection = RosterCharacterId[];

export function sanitizePartySelection(
  selection: PartySelection,
  maxSize: number = MAX_PARTY_SIZE,
): PartySelection {
  const unlocked = getUnlockedCharacterIds();
  const unique: RosterCharacterId[] = [];

  for (const id of selection) {
    if (!unlocked.has(id)) continue;
    if (unique.includes(id)) continue;
    if (unique.length >= maxSize) break;
    unique.push(id);
  }

  if (unique.length === 0) {
    return [...DEFAULT_PARTY_SELECTION];
  }

  return unique;
}

export function getPartyNames(selection: PartySelection) {
  return sanitizePartySelection(selection).map((id) => getRosterCharacter(id).name);
}
