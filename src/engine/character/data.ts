// ============================================================================
// Static character-creation data (Russian): races, classes, backgrounds,
// names, point-buy. Pure data only — no React, no logic.
// ============================================================================

import type {
  ArmorStats,
  CharacterBackground,
  CharacterClass,
  CharacterRace,
  ItemRarity,
  ItemType,
  Stats,
  WeaponStats,
} from '../../types';

// ---------------------------------------------------------------------------
// Ability scores
// ---------------------------------------------------------------------------

/** Ability-score keys in canonical display order. */
export const STAT_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export type StatKey = (typeof STAT_KEYS)[number];

export interface StatInfo {
  key: StatKey;
  abbr: string;
  name: string;
  hint: string;
}

export const STATS_INFO: StatInfo[] = [
  { key: 'str', abbr: 'СИЛ', name: 'Сила', hint: 'Ближний бой, переносимый вес' },
  { key: 'dex', abbr: 'ЛОВ', name: 'Ловкость', hint: 'КБ, инициатива, дальний бой' },
  { key: 'con', abbr: 'ТЕЛ', name: 'Телосложение', hint: 'Здоровье и выносливость' },
  { key: 'int', abbr: 'ИНТ', name: 'Интеллект', hint: 'Арканная магия и знания' },
  { key: 'wis', abbr: 'МДР', name: 'Мудрость', hint: 'Божественная магия, внимательность' },
  { key: 'cha', abbr: 'ХАР', name: 'Харизма', hint: 'Социальные навыки, магия барда' },
];

/** Short Russian abbreviation per ability (for class priority hints). */
export const STAT_ABBR: Record<StatKey, string> = {
  str: 'СИЛ',
  dex: 'ЛОВ',
  con: 'ТЕЛ',
  int: 'ИНТ',
  wis: 'МДР',
  cha: 'ХАР',
};

/** Full Russian ability name per key (used in stat-change log lines). */
export const STAT_LABELS_RU: Record<StatKey, string> = {
  str: 'Сила',
  dex: 'Ловкость',
  con: 'Телосложение',
  int: 'Интеллект',
  wis: 'Мудрость',
  cha: 'Харизма',
};

// ---------------------------------------------------------------------------
// Point buy
// ---------------------------------------------------------------------------

export const POINT_BUY_BUDGET = 27;
export const STAT_MIN = 8;
export const STAT_MAX = 15;

/** Cost in points to raise a score to the given value (before racial bonuses). */
export const POINT_BUY_COST: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};

// ---------------------------------------------------------------------------
// Lookup helper
// ---------------------------------------------------------------------------

function byId<K extends string, T extends { id: K }>(items: T[]): Record<K, T> {
  return Object.fromEntries(items.map((item): [K, T] => [item.id, item])) as Record<K, T>;
}

// ---------------------------------------------------------------------------
// Races
// ---------------------------------------------------------------------------

export interface RaceData {
  id: CharacterRace;
  name: string;
  icon: string;
  bonuses: Partial<Stats>;
  traits: string[];
  description: string;
}

export const RACES: RaceData[] = [
  {
    id: 'human',
    name: 'Человек',
    icon: '🧑',
    bonuses: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
    traits: ['Универсальность'],
    description:
      'Честолюбивые и приспособляемые, люди не мастера в чём-то одном, но любой путь сгибают под себя. Бонус ко всем характеристикам подходит для любого класса.',
  },
  {
    id: 'elf',
    name: 'Эльф',
    icon: '🧝',
    bonuses: { dex: 2, int: 1 },
    traits: ['Тёмное зрение', 'Фейское наследие'],
    description:
      'Грациозные и долгоживущие, эльфы движутся с неестественной точностью. Острые чувства и гибкое тело хороши для разведчиков, лучников и арканных ловкачей.',
  },
  {
    id: 'dwarf',
    name: 'Дварф',
    icon: '🧔',
    bonuses: { con: 2, wis: 1 },
    traits: ['Тёмное зрение', 'Дварфская стойкость'],
    description:
      'Крепкий, упрямый народ камня и кузни. Стойкость и могучее телосложение позволяют им пережить почти любого врага в войне на истощение.',
  },
  {
    id: 'halfling',
    name: 'Полурослик',
    icon: '🧒',
    bonuses: { dex: 2, cha: 1 },
    traits: ['Везучесть', 'Храбрость'],
    description:
      'Маленькие, проворные и невероятно везучие. Полурослики ускользают от опасности с усмешкой, обращая беды в счастливые случайности.',
  },
  {
    id: 'half-orc',
    name: 'Полуорк',
    icon: '👹',
    bonuses: { str: 2, con: 1 },
    traits: ['Тёмное зрение', 'Неумолимая стойкость'],
    description:
      'Рождённые двумя мирами и чужие обоим, полуорки обращают ярость в чистую силу. Они отказываются падать, пока в них остаётся хоть один вздох.',
  },
  {
    id: 'tiefling',
    name: 'Тифлинг',
    icon: '😈',
    bonuses: { cha: 2, int: 1 },
    traits: ['Тёмное зрение', 'Адское сопротивление'],
    description:
      'Отмеченные инфернальной кровью, тифлинги несут тревожное обаяние и стойкость к пламени. Многими гонимые, они куют собственную судьбу.',
  },
];

export const RACE_BY_ID = byId(RACES);

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------

export interface ClassData {
  id: CharacterClass;
  name: string;
  icon: string;
  hitDie: number;
  primary: StatKey[];
  feature: string;
  featureDesc: string;
  description: string;
  startingGold: number;
  isCaster: boolean;
}

export const CLASSES: ClassData[] = [
  {
    id: 'fighter',
    name: 'Воин',
    icon: '⚔️',
    hitDie: 10,
    primary: ['str', 'con'],
    feature: 'Второе дыхание',
    featureDesc: 'Лечит 1к10 + уровень раз за отдых.',
    description:
      'Мастер оружия и доспеха, побеждающий дисциплиной и выносливостью. Воины бьют крепко, держат удар ещё крепче и редко выдыхаются.',
    startingGold: 10,
    isCaster: false,
  },
  {
    id: 'rogue',
    name: 'Плут',
    icon: '🗡️',
    hitDie: 8,
    primary: ['dex'],
    feature: 'Скрытая атака',
    featureDesc: '+1к6 урона при ударе с преимуществом.',
    description:
      'Точный оппортунист, обращающий одну брешь в смертельный удар. Плуты процветают на скрытности, ловушках и поиске слабых мест в любой защите.',
    startingGold: 15,
    isCaster: false,
  },
  {
    id: 'wizard',
    name: 'Волшебник',
    icon: '🪄',
    hitDie: 6,
    primary: ['int'],
    feature: 'Заклинания',
    featureDesc: 'Арканные заклинания; восстановление ячеек Магическим восстановлением.',
    description:
      'Знаток арканного, сгибающий реальность через учёбу. Хрупкий телом, но сокрушительный в нужный миг — волшебник владеет самым широким списком заклинаний.',
    startingGold: 10,
    isCaster: true,
  },
  {
    id: 'cleric',
    name: 'Жрец',
    icon: '✨',
    hitDie: 8,
    primary: ['wis'],
    feature: 'Заклинания',
    featureDesc: 'Божественные заклинания, дарованные Доменом.',
    description:
      'Святой воин-жрец, что лечит союзников и карает недостойных. Жрецы сочетают крепкий доспех с божественной магией и сильны в сердце любого отряда.',
    startingGold: 10,
    isCaster: true,
  },
  {
    id: 'ranger',
    name: 'Следопыт',
    icon: '🏹',
    hitDie: 10,
    primary: ['dex', 'wis'],
    feature: 'Избранный враг',
    featureDesc: 'Выслеживай добычу и выживай в дикости как Естествоиспытатель.',
    description:
      'Охотник приграничья, равно смертоносный с луком и клинком. Следопыты читают местность, метят добычу и редко теряют след.',
    startingGold: 10,
    isCaster: false,
  },
  {
    id: 'bard',
    name: 'Бард',
    icon: '🎵',
    hitDie: 8,
    primary: ['cha'],
    feature: 'Бардовское вдохновение',
    featureDesc: 'Дай союзникам бонус к6; твори разнообразные заклинания.',
    description:
      'Обаятельный мастер на все руки, чья магия течёт через искусство. Барды вдохновляют союзников, очаровывают врагов и понемногу умеют всё.',
    startingGold: 15,
    isCaster: true,
  },
];

export const CLASS_BY_ID = byId(CLASSES);

// ---------------------------------------------------------------------------
// Starting inventory (templates -> Item objects are built in creation.ts)
// ---------------------------------------------------------------------------

export interface StartItemSpec {
  name: string;
  type: ItemType;
  icon: string;
  description: string;
  rarity?: ItemRarity;
  weight?: number;
  value?: number;
  weaponStats?: WeaponStats;
  armorStats?: ArmorStats;
}

const LEATHER_ARMOR: StartItemSpec = {
  name: 'Кожаный доспех',
  type: 'armor',
  icon: '🥋',
  description: 'Мягкая варёная кожа. КБ 11 + модификатор Ловкости.',
  weight: 10,
  value: 10,
  armorStats: { baseAc: 11, slot: 'body' },
};

const CHAIN_MAIL: StartItemSpec = {
  name: 'Кольчуга',
  type: 'armor',
  icon: '🛡️',
  description: 'Тяжёлые сцепленные кольца. КБ 16.',
  weight: 55,
  value: 75,
  armorStats: { baseAc: 16, maxDexBonus: 0, slot: 'body' },
};

export const STARTING_INVENTORY: Record<CharacterClass, StartItemSpec[]> = {
  fighter: [
    {
      name: 'Длинный меч',
      type: 'weapon',
      icon: '🗡️',
      description: 'Универсальный клинок. 1к8 рубящего урона.',
      weight: 3,
      value: 15,
      weaponStats: { damageDice: 'd8', damageCount: 1, damageBonus: 0, damageType: 'slashing' },
    },
    CHAIN_MAIL,
    {
      name: 'Щит',
      type: 'shield',
      icon: '🛡️',
      description: 'Крепкий щит. +2 КБ, когда надет.',
      weight: 6,
      value: 10,
      armorStats: { baseAc: 2, slot: 'offHand' },
    },
  ],
  rogue: [
    {
      name: 'Короткий меч',
      type: 'weapon',
      icon: '🗡️',
      description: 'Лёгкий фехтовальный клинок. 1к6 колющего урона.',
      weight: 2,
      value: 10,
      weaponStats: { damageDice: 'd6', damageCount: 1, damageBonus: 0, damageType: 'piercing', finesse: true },
    },
    LEATHER_ARMOR,
    {
      name: 'Воровские инструменты',
      type: 'misc',
      icon: '🛠️',
      description: 'Отмычки и щупы для замков и ловушек.',
      weight: 1,
      value: 25,
    },
  ],
  wizard: [
    {
      name: 'Боевой посох',
      type: 'weapon',
      icon: '🪄',
      description: 'Простой посох. 1к6 дробящего урона.',
      weight: 4,
      value: 2,
      weaponStats: { damageDice: 'd6', damageCount: 1, damageBonus: 0, damageType: 'bludgeoning' },
    },
    { name: 'Книга заклинаний', type: 'misc', icon: '📖', description: 'Твой арканный том известных заклинаний.', weight: 3, value: 50 },
    { name: 'Мешочек с компонентами', type: 'misc', icon: '🎒', description: 'Материальные компоненты для заклинаний.', weight: 2, value: 25 },
  ],
  cleric: [
    {
      name: 'Булава',
      type: 'weapon',
      icon: '🔨',
      description: 'Тупое орудие веры. 1к6 дробящего урона.',
      weight: 4,
      value: 5,
      weaponStats: { damageDice: 'd6', damageCount: 1, damageBonus: 0, damageType: 'bludgeoning' },
    },
    CHAIN_MAIL,
    { name: 'Священный символ', type: 'misc', icon: '✨', description: 'Божественная фокусировка для сотворения чудес.', weight: 1, value: 5 },
  ],
  ranger: [
    {
      name: 'Длинный лук',
      type: 'weapon',
      icon: '🏹',
      description: 'Высокий лук с большой дальностью. 1к8 колющего урона.',
      weight: 2,
      value: 50,
      weaponStats: { damageDice: 'd8', damageCount: 1, damageBonus: 0, damageType: 'piercing', ranged: true, twoHanded: true },
    },
    { name: 'Колчан', type: 'misc', icon: '🎯', description: 'Вмещает 20 стрел.', weight: 1, value: 1 },
    LEATHER_ARMOR,
  ],
  bard: [
    {
      name: 'Рапира',
      type: 'weapon',
      icon: '🤺',
      description: 'Изящный фехтовальный клинок. 1к8 колющего урона.',
      weight: 2,
      value: 25,
      weaponStats: { damageDice: 'd8', damageCount: 1, damageBonus: 0, damageType: 'piercing', finesse: true },
    },
    LEATHER_ARMOR,
    { name: 'Лютня', type: 'misc', icon: '🎵', description: 'Прекрасный инструмент и фокусировка для заклинаний.', weight: 2, value: 35 },
  ],
};

// ---------------------------------------------------------------------------
// Backgrounds
// ---------------------------------------------------------------------------

export interface BackgroundData {
  id: CharacterBackground;
  name: string;
  icon: string;
  skills: string[];
  bonus: string;
  bonusGold: number;
}

export const BACKGROUNDS: BackgroundData[] = [
  { id: 'soldier', name: 'Солдат', icon: '🎖️', skills: ['Атлетика', 'Запугивание'], bonus: '+10 золота и воинское звание, внушающее уважение.', bonusGold: 10 },
  { id: 'criminal', name: 'Преступник', icon: '🗝️', skills: ['Обман', 'Скрытность'], bonus: 'Воровские инструменты и преступный связной в каждом городе.', bonusGold: 0 },
  { id: 'scholar', name: 'Учёный', icon: '📚', skills: ['История', 'Магия'], bonus: 'Два дополнительных языка и запасной свиток.', bonusGold: 0 },
  { id: 'noble', name: 'Дворянин', icon: '👑', skills: ['История', 'Убеждение'], bonus: '+20 золота и фамильный перстень с печатью.', bonusGold: 20 },
  { id: 'folk-hero', name: 'Народный герой', icon: '🌾', skills: ['Уход за животными', 'Выживание'], bonus: 'Инструменты ремесленника и слава среди простого люда.', bonusGold: 0 },
  { id: 'outlander', name: 'Чужеземец', icon: '🏔️', skills: ['Атлетика', 'Выживание'], bonus: 'Музыкальный инструмент и безошибочное чутьё на местность.', bonusGold: 0 },
];

export const BACKGROUND_BY_ID = byId(BACKGROUNDS);

// ---------------------------------------------------------------------------
// Random names, per race (proper names, left untranslated)
// ---------------------------------------------------------------------------

export const NAMES: Record<CharacterRace, string[]> = {
  human: ['Альдрик', 'Мара', 'Седрик', 'Елена', 'Гаррет', 'Розалинда', 'Тобиас', 'Линнея', 'Родерик', 'Изольда', 'Брам', 'Кора'],
  elf: ['Аэлар', 'Сильвара', 'Талион', 'Найвара', 'Эреван', 'Лириэль', 'Каэлинн', 'Фаэлар', 'Шанайра', 'Варис', 'Арамил', 'Миали'],
  dwarf: ['Торин', 'Хельга', 'Балин', 'Дагна', 'Гимли', 'Брунхильда', 'Дурин', 'Вистра', 'Харбек', 'Аудхильда', 'Орсик', 'Гуннлода'],
  halfling: ['Пип', 'Рози', 'Майло', 'Лавиния', 'Венна', 'Кейд', 'Серафина', 'Осборн', 'Тилли', 'Роско', 'Меррик', 'Недда'],
  'half-orc': ['Грош', 'Йевельда', 'Мхуррен', 'Шаута', 'Карг', 'Багги', 'Токк', 'Эмен', 'Денч', 'Волен', 'Ронт', 'Сута'],
  tiefling: ['Акменос', 'Немея', 'Дамайя', 'Мордай', 'Каллиста', 'Скамос', 'Криэлла', 'Терай', 'Баракас', 'Риета', 'Пелайос', 'Орианна'],
};
