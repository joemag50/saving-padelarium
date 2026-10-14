export type LevelState =
  | 'start'
  | 'encounter_1'
  | 'investigate'
  | 'hallway'
  | 'encounter_2'
  | 'rescue'
  | 'complete';

export const OBJECTIVES: Record<LevelState, string> = {
  start: 'Find the others',
  encounter_1: 'Clear the reception',
  investigate: 'Investigate the alien barrier',
  hallway: 'Reach the court',
  encounter_2: 'Defeat the squad leader',
  rescue: 'Rescue your friend',
  complete: 'Shift complete',
};

export const CLUE = {
  title: 'CLUE FOUND',
  subtitle: 'Holographic projector',
  label: 'Label: "Galactic Events Monterrey"',
  description: 'Someone is using local equipment to fake alien technology.',
  nextObjective: 'Enter the court and find your friend',
} as const;

export const RESCUE_LINE =
  '"They are not aliens. I heard them talking about a setup."';

export const END_SCREEN = {
  headline: 'NEW CLUE',
  reveal: 'The invasion uses earthly technology.',
  subreveal: 'Someone is pretending to be extraterrestrial.',
  rescued: 'Friend rescued',
  continuation: 'The investigation continues.',
} as const;
