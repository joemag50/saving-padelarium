import { MAX_PLAYERS, type PlayerCount } from '../types/player';

export type RosterCharacterId =
  | 'carol'
  | 'jose'
  | 'arturo'
  | 'fisam'
  | 'armando'
  | 'lucia'
  | 'fatima'
  | 'casillas'
  | 'juaquin'
  | 'flor'
  | 'alberto'
  | 'rody'
  | 'cris'
  | 'crispy';

/** Starters are always playable; everyone else unlocks when rescued (see `data/levels.ts`). */
export type RosterCharacter = {
  id: RosterCharacterId;
  name: string;
  color: number;
  starter: boolean;
};

export const MAX_PARTY_SIZE = MAX_PLAYERS;

export const ROSTER: readonly RosterCharacter[] = [
  { id: 'carol', name: 'Carol', color: 0x5b8def, starter: true },
  { id: 'jose', name: 'José', color: 0xef8b5b, starter: true },
  { id: 'arturo', name: 'Arturo', color: 0xa78bfa, starter: false },
  { id: 'fisam', name: 'Fisam', color: 0x34d399, starter: false },
  { id: 'armando', name: 'Armando', color: 0xf472b6, starter: false },
  { id: 'lucia', name: 'Lucía', color: 0xfbbf24, starter: false },
  { id: 'fatima', name: 'Fátima', color: 0xfb7185, starter: false },
  { id: 'casillas', name: 'Casillas', color: 0xdc2626, starter: false },
  { id: 'juaquin', name: 'Juaquin', color: 0x38bdf8, starter: false },
  { id: 'flor', name: 'Flor', color: 0x4ade80, starter: false },
  { id: 'alberto', name: 'Alberto', color: 0xc084fc, starter: false },
  { id: 'rody', name: 'Rody', color: 0x2dd4bf, starter: false },
  { id: 'cris', name: 'Cris', color: 0xf97316, starter: false },
  { id: 'crispy', name: 'Crispy', color: 0x818cf8, starter: false },
] as const;

export const DEFAULT_PARTY_SELECTION: RosterCharacterId[] = ['carol'];

const DEFAULT_PARTY_BY_COUNT: Record<PlayerCount, RosterCharacterId[]> = {
  1: ['carol'],
  2: ['carol', 'jose'],
};

export function getDefaultParty(playerCount: PlayerCount): RosterCharacterId[] {
  return [...DEFAULT_PARTY_BY_COUNT[playerCount]];
}

export function getRosterCharacter(id: RosterCharacterId) {
  const character = ROSTER.find((entry) => entry.id === id);
  if (!character) throw new Error(`Unknown roster character: ${id}`);
  return character;
}
