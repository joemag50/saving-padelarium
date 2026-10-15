import type { WaveKinds } from '../config/level';
import type { EnemyStats } from '../config/enemies';
import type { SceneryDefinition } from '../world/scenery';
import type { RosterCharacterId } from './roster';

/**
 * Story and tuning for every level. All levels share the layout in `config/level.ts`:
 * fight → hallway → boss → walk up to the rescued friends, who share what they saw.
 * Edit the texts here freely; nothing else depends on their wording.
 */
export type LevelDefinition = {
  id: number;
  title: string;
  intro: string;
  palette: { background: number; floor: number };
  /** Labels for zones A (start), B (hallway) and C (boss + rescue). */
  zones: readonly [string, string, string];
  /** Labels for the decor props in zones A, B and C. */
  props: { cover: string; hallway: string; court: string };
  objectives: {
    start: string;
    encounter1: string;
    /** Shown once the first room is cleared. */
    hallway: string;
    encounter2: string;
    rescue: string;
  };
  /** Enemy kinds per wave (see `config/enemies.ts`). The leader joins encounter 2's last wave. */
  encounter1: { waves: readonly WaveKinds[] };
  encounter2: { waves: readonly WaveKinds[] };
  /** Scales regular enemies' health and damage for this level. */
  minionScale: number;
  boss: Partial<EnemyStats> & { label: string };
  /** Last level: encounter 2 ends with the multi-phase "Supremo Galáctico" (see `config/boss.ts`). */
  finalBoss?: boolean;
  /** `line` is what the rescued friends say: it's how the story's clues are told. */
  rescue: { characters: readonly RosterCharacterId[]; line: string };
  /** Tile-based walls, floors and decor. Levels without it render as gray boxes. */
  scenery?: SceneryDefinition;
};

export const LEVELS: readonly LevelDefinition[] = [
  {
    id: 1,
    title: 'La recepción',
    intro:
      'Unos extraterrestres tomaron Padelirium.\nEl grupo quedó separado y nadie contesta el chat.',
    palette: { background: 0x1a1f2e, floor: 0x3a3f4b },
    zones: ['ZONA A — RECEPCIÓN', 'ZONA B — PASILLO', 'ZONA C — CANCHA'],
    props: { cover: 'MOSTRADOR', hallway: 'COLUMNA', court: 'COLUMNA' },
    objectives: {
      start: 'Encuentra a los demás',
      encounter1: 'Despeja la recepción',
      hallway: 'Entra a la cancha y encuentra a Rody y a Alberto',
      encounter2: 'Derrota al líder del escuadrón',
      rescue: 'Rescata a Rody y a Alberto',
    },
    encounter1: {
      waves: [['invasor', 'invasor', 'invasor']],
    },
    encounter2: {
      waves: [['invasor', 'invasor']],
    },
    minionScale: 1,
    boss: { label: 'Líder del escuadrón' },
    rescue: {
      characters: ['rody', 'alberto'],
      line: '"¡Se los llevaron en una luz verde!\nNos escondimos debajo del mostrador.\nLas cajas decían ‘Eventos Gal…’, no se leía más."',
    },
    scenery: {
      rooms: [
        { fromX: 0, toX: 1040, wall: 'woodLight', floor: 'yellowTile' },
        { fromX: 1040, toX: 1720, wall: 'grayBlue', floor: 'concrete' },
        { fromX: 1720, toX: 2400, wall: 'mint', floor: 'blueTile' },
      ],
      decor: [
        // Recepción
        { frame: 'plantTree', x: 50, mount: 'floor' },
        { frame: 'window', x: 180, mount: 'wall', y: 200 },
        { frame: 'sofa', x: 340, mount: 'floor' },
        { frame: 'aquarium', x: 340, mount: 'wall', y: 160 },
        { frame: 'paintingSun', x: 620, mount: 'wall', y: 190 },
        { frame: 'snackFridge', x: 830, mount: 'floor' },
        // Pasillo
        { frame: 'elevator', x: 1220, mount: 'floor' },
        { frame: 'plantSmall', x: 1360, mount: 'floor' },
        { frame: 'paintingForest', x: 1600, mount: 'wall', y: 190 },
        // Cancha
        { frame: 'glassDoors', x: 1880, mount: 'floor' },
        { frame: 'palm', x: 2030, mount: 'floor' },
        { frame: 'curtainWindow', x: 2220, mount: 'wall', y: 235 },
        { frame: 'plantTree', x: 2360, mount: 'floor' },
      ],
      props: { cover: 'counter' },
    },
  },
  {
    id: 2,
    title: 'Los vestidores',
    intro:
      'Rody y Alberto vieron a Arturo y a Fisam correr hacia los vestidores.\nDesde ahí sale una niebla verde muy sospechosa.',
    palette: { background: 0x14231f, floor: 0x34433e },
    zones: ['ZONA A — VESTIDORES', 'ZONA B — CASILLEROS', 'ZONA C — REGADERAS'],
    props: { cover: 'BANCAS', hallway: 'CASILLEROS', court: 'CASILLEROS' },
    objectives: {
      start: 'Encuentra a Arturo y a Fisam',
      encounter1: 'Despeja los vestidores',
      hallway: 'Busca a Arturo y a Fisam en las regaderas',
      encounter2: 'Derrota al Comandante Vapor',
      rescue: 'Rescata a Arturo y a Fisam',
    },
    encounter1: {
      waves: [
        ['invasor', 'invasor', 'humero'],
        ['invasor', 'invasor'],
      ],
    },
    encounter2: {
      waves: [['invasor', 'humero']],
    },
    minionScale: 1.1,
    boss: { label: 'Comandante Vapor', maxHealth: 150, color: 0x059669 },
    rescue: {
      characters: ['arturo', 'fisam'],
      line: '"Un alien se quejaba de la espalda…\ny otro de que todavía no le pagan.\nLe reportaban por radio a un tal ‘P.S.’"',
    },
  },
  {
    id: 3,
    title: 'La cafetería',
    intro:
      'Arturo jura que Armando y Lucía se escondieron en la cafetería.\nUn zumbido alienígena no deja pensar a nadie.',
    palette: { background: 0x231a2b, floor: 0x433a4d },
    zones: ['ZONA A — CAFETERÍA', 'ZONA B — TERRAZA', 'ZONA C — COCINA'],
    props: { cover: 'BARRA', hallway: 'MESAS', court: 'REFRIGERADOR' },
    objectives: {
      start: 'Encuentra a Armando y a Lucía',
      encounter1: 'Despeja la cafetería',
      hallway: 'Entra a la cocina y busca a Armando y a Lucía',
      encounter2: 'Derrota a la Capitana Decibel',
      rescue: 'Rescata a Armando y a Lucía',
    },
    encounter1: {
      waves: [
        ['veloz', 'veloz', 'tirador'],
        ['veloz', 'tirador'],
      ],
    },
    encounter2: {
      waves: [['veloz', 'veloz', 'tirador']],
    },
    minionScale: 1.2,
    boss: { label: 'Capitana Decibel', maxHealth: 170, attackDamage: 17, color: 0x7c3aed },
    rescue: {
      characters: ['armando', 'lucia'],
      line: '"¡Vi a un alien quitarse la cabeza para comerse un taco!\nEra un señor normal, con una playera de ‘P.S.’\nY subieron los trofeos del club a un camión."',
    },
  },
  {
    id: 4,
    title: 'El estacionamiento',
    intro:
      'Armando vio a Juaquin y a Flor cerca del camión de los trofeos.\nUn rayo abductor ilumina todo el estacionamiento.',
    palette: { background: 0x1c1f24, floor: 0x45484f },
    zones: ['ZONA A — ENTRADA', 'ZONA B — CAJONES', 'ZONA C — ZONA DE CARGA'],
    props: { cover: 'CAMIONETA', hallway: 'CONOS', court: 'CAMIÓN' },
    objectives: {
      start: 'Encuentra a Juaquin y a Flor',
      encounter1: 'Despeja la entrada',
      hallway: 'Llega a la zona de carga y busca a Juaquin y a Flor',
      encounter2: 'Derrota al Sargento Grúa',
      rescue: 'Rescata a Juaquin y a Flor',
    },
    encounter1: {
      waves: [
        ['grandote', 'invasor', 'tirador'],
        ['grandote', 'tirador'],
      ],
    },
    encounter2: {
      waves: [['grandote', 'tirador', 'invasor']],
    },
    minionScale: 1.3,
    boss: { label: 'Sargento Grúa', maxHealth: 190, attackDamage: 18, moveSpeed: 95, color: 0xca8a04 },
    rescue: {
      characters: ['juaquin', 'flor'],
      line: '"Los camiones dicen ‘Constructora Supremo’.\n¡P.S. es Pádel Supremo, el club de enfrente!\nY su jefe va a firmar algo en la oficina."',
    },
  },
  {
    id: 5,
    title: 'La oficina',
    intro:
      'Juaquin dice que Fátima y Casillas quedaron atrapados en la oficina.\nHay luces láser alienígenas por todo el pasillo.',
    palette: { background: 0x26191b, floor: 0x4a3a3c },
    zones: ['ZONA A — PASILLO ADMINISTRATIVO', 'ZONA B — ARCHIVO', 'ZONA C — OFICINA DEL DUEÑO'],
    props: { cover: 'ESCRITORIO', hallway: 'ARCHIVEROS', court: 'LIBRERO' },
    objectives: {
      start: 'Encuentra a Fátima y a Casillas',
      encounter1: 'Despeja el pasillo',
      hallway: 'Entra a la oficina del dueño y busca a Fátima y a Casillas',
      encounter2: 'Derrota a la Agente Firma',
      rescue: 'Rescata a Fátima y a Casillas',
    },
    encounter1: {
      waves: [
        ['escudero', 'veloz', 'tirador'],
        ['escudero', 'escudero', 'veloz'],
      ],
    },
    encounter2: {
      waves: [
        ['escudero', 'tirador', 'veloz'],
        ['escudero', 'grandote'],
      ],
    },
    minionScale: 1.4,
    boss: { label: 'Agente Firma', maxHealth: 210, attackDamage: 19, attackWindupMs: 520, color: 0xdc2626 },
    rescue: {
      characters: ['fatima', 'casillas'],
      line: '"Galán, el dueño de Pádel Supremo, tiene un contrato:\nsi el club cierra ‘por aliens’, el terreno es suyo.\n¡Se fue corriendo a la cancha central!"',
    },
  },
  {
    id: 6,
    title: 'La cancha central',
    intro:
      'Todos juntos hacia la cancha central. Ahí tienen a Cris y a Crispy.\nY ahí está esperando el "Supremo Galáctico".',
    palette: { background: 0x10182b, floor: 0x2f3d5c },
    zones: ['ZONA A — GRADAS', 'ZONA B — TÚNEL', 'ZONA C — CANCHA CENTRAL'],
    props: { cover: 'GRADAS', hallway: 'BANDERAS', court: 'RED' },
    objectives: {
      start: 'Encuentra a Cris y a Crispy',
      encounter1: 'Despeja las gradas',
      hallway: 'Entra a la cancha central y detén al Supremo Galáctico',
      encounter2: 'Derrota al Supremo Galáctico',
      rescue: 'Rescata a Cris y a Crispy',
    },
    encounter1: {
      waves: [
        ['invasor', 'veloz', 'tirador', 'humero'],
        ['grandote', 'escudero', 'tirador', 'veloz'],
      ],
    },
    encounter2: {
      waves: [['grandote', 'escudero', 'tirador']],
    },
    minionScale: 1.5,
    finalBoss: true,
    boss: { label: 'Supremo Galáctico' },
    rescue: {
      characters: ['cris', 'crispy'],
      line: '"¡Ese no es un alien!\nEs el Ingeniero Galán con un disfraz de foami.\nTodo fue un montaje para quedarse con Padelirium."',
    },
  },
];

export const FIRST_LEVEL_ID = LEVELS[0].id;

export function getLevel(id: number): LevelDefinition {
  return LEVELS.find((level) => level.id === id) ?? LEVELS[0];
}

export function getNextLevel(id: number): LevelDefinition | undefined {
  const index = LEVELS.findIndex((level) => level.id === id);
  return index >= 0 ? LEVELS[index + 1] : undefined;
}

export function getRescueLevel(characterId: RosterCharacterId): LevelDefinition | undefined {
  return LEVELS.find((level) => level.rescue.characters.includes(characterId));
}
