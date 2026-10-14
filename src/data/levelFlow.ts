export type LevelState =
  | 'start'
  | 'encounter_1'
  | 'investigate'
  | 'hallway'
  | 'encounter_2'
  | 'rescue'
  | 'complete';

export const OBJECTIVES: Record<LevelState, string> = {
  start: 'Encuentra a los demás',
  encounter_1: 'Despeja la recepción',
  investigate: 'Investiga la barrera alienígena',
  hallway: 'Llega a la cancha',
  encounter_2: 'Derrota al líder del escuadrón',
  rescue: 'Rescata a tu amigo',
  complete: 'Nivel completado',
};

export const CLUE = {
  title: 'PISTA ENCONTRADA',
  subtitle: 'Proyector holográfico',
  label: 'Etiqueta: "Eventos Galácticos Monterrey"',
  description: 'Alguien está usando equipo local para fingir tecnología extraterrestre.',
  nextObjective: 'Entra a la cancha y encuentra a tu amigo',
} as const;

export const RESCUE_LINE =
  '"No son aliens. Escuché que hablaban de un montaje."';

export const END_SCREEN = {
  headline: 'NUEVA PISTA',
  reveal: 'La invasión utiliza tecnología terrestre.',
  subreveal: 'Alguien está fingiendo ser extraterrestre.',
  rescued: 'Amigo rescatado',
  continuation: 'La investigación continuará.',
} as const;
