export type RosterCharacterId =
  | 'carol'
  | 'jose'
  | 'arturo'
  | 'fisam'
  | 'armando'
  | 'lucia'
  | 'fatima'
  | 'juaquin'
  | 'flor'
  | 'alberto'
  | 'rody'
  | 'cris'
  | 'crispy';

/** How a character becomes playable in the roster menu. */
export type RosterUnlockKind = 'starter' | 'mvp_rescue' | 'future_rescue';

export type RosterCharacter = {
  id: RosterCharacterId;
  name: string;
  color: number;
  unlock: RosterUnlockKind;
};

export const MAX_PARTY_SIZE = 4;

export const ROSTER: readonly RosterCharacter[] = [
  { id: 'carol', name: 'Carol', color: 0x5b8def, unlock: 'starter' },
  { id: 'jose', name: 'José', color: 0xef8b5b, unlock: 'starter' },
  { id: 'arturo', name: 'Arturo', color: 0xa78bfa, unlock: 'future_rescue' },
  { id: 'fisam', name: 'Fisam', color: 0x34d399, unlock: 'future_rescue' },
  { id: 'armando', name: 'Armando', color: 0xf472b6, unlock: 'future_rescue' },
  { id: 'lucia', name: 'Lucía', color: 0xfbbf24, unlock: 'future_rescue' },
  { id: 'fatima', name: 'Fátima', color: 0xfb7185, unlock: 'future_rescue' },
  { id: 'juaquin', name: 'Juaquin', color: 0x38bdf8, unlock: 'future_rescue' },
  { id: 'flor', name: 'Flor', color: 0x4ade80, unlock: 'future_rescue' },
  { id: 'alberto', name: 'Alberto', color: 0xc084fc, unlock: 'future_rescue' },
  { id: 'rody', name: 'Rody', color: 0x2dd4bf, unlock: 'mvp_rescue' },
  { id: 'cris', name: 'Cris', color: 0xf97316, unlock: 'future_rescue' },
  { id: 'crispy', name: 'Crispy', color: 0x818cf8, unlock: 'future_rescue' },
] as const;

export const DEFAULT_PARTY_SELECTION: RosterCharacterId[] = ['carol'];

export function getRosterCharacter(id: RosterCharacterId) {
  const character = ROSTER.find((entry) => entry.id === id);
  if (!character) throw new Error(`Unknown roster character: ${id}`);
  return character;
}

export function getLockedHint(character: RosterCharacter) {
  if (character.unlock === 'mvp_rescue') {
    return 'Rescue in the court';
  }
  return 'Rescue in a future level';
}
