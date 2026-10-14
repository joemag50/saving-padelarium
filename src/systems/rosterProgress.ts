import {
  DEFAULT_PARTY_SELECTION,
  getRosterCharacter,
  MAX_PARTY_SIZE,
  ROSTER,
  type RosterCharacterId,
} from '../data/roster';

const STORAGE_KEY = 'padelarium-roster-unlocks';

const STARTER_IDS: RosterCharacterId[] = ['carol', 'jose'];
const MVP_RESCUE_ID: RosterCharacterId = 'rody';

function readExtraUnlocks(): RosterCharacterId[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is RosterCharacterId =>
      ROSTER.some((character) => character.id === id),
    );
  } catch {
    return [];
  }
}

function writeExtraUnlocks(ids: RosterCharacterId[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export function getUnlockedCharacterIds(): Set<RosterCharacterId> {
  return new Set([...STARTER_IDS, ...readExtraUnlocks()]);
}

export function isCharacterUnlocked(id: RosterCharacterId) {
  return getUnlockedCharacterIds().has(id);
}

export function unlockCharacter(id: RosterCharacterId) {
  if (isCharacterUnlocked(id)) return;
  writeExtraUnlocks([...readExtraUnlocks(), id]);
}

export function unlockMvpRescueCharacter() {
  unlockCharacter(MVP_RESCUE_ID);
}

export type PartySelection = RosterCharacterId[];

export function sanitizePartySelection(selection: PartySelection): PartySelection {
  const unlocked = getUnlockedCharacterIds();
  const unique: RosterCharacterId[] = [];

  for (const id of selection) {
    if (!unlocked.has(id)) continue;
    if (unique.includes(id)) continue;
    if (unique.length >= MAX_PARTY_SIZE) break;
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
