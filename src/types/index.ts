// ============================================================================
// AI Dungeon Master — shared domain types.
// Pure data contracts used across the engine, store and UI. No runtime code.
// ============================================================================

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

export type GameScreen =
  | 'title'
  | 'settings'
  | 'character-creation'
  | 'game'
  | 'game-over';

// ---------------------------------------------------------------------------
// Character taxonomy
// ---------------------------------------------------------------------------

export type CharacterRace =
  | 'human'
  | 'elf'
  | 'dwarf'
  | 'halfling'
  | 'half-orc'
  | 'tiefling';

export type CharacterClass =
  | 'fighter'
  | 'rogue'
  | 'wizard'
  | 'cleric'
  | 'ranger'
  | 'bard';

export type CharacterBackground =
  | 'soldier'
  | 'criminal'
  | 'scholar'
  | 'noble'
  | 'folk-hero'
  | 'outlander';

// ---------------------------------------------------------------------------
// Ability scores
// ---------------------------------------------------------------------------

/** The six core ability scores (D&D 5e). Raw values range 8-20. */
export interface Stats {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

/** Ability modifiers — floor((score - 10) / 2). Shares the {@link Stats} shape. */
export type StatModifiers = Stats;

// ---------------------------------------------------------------------------
// Status effects & spells
// ---------------------------------------------------------------------------

export type StatusEffectType =
  | 'poisoned'
  | 'stunned'
  | 'burning'
  | 'bleeding'
  | 'frightened'
  | 'blinded'
  | 'blessed'
  | 'hasted';

export interface StatusEffect {
  type: StatusEffectType;
  /** Remaining duration in combat rounds. */
  duration: number;
  /** Optional per-tick magnitude (e.g. burning damage). */
  magnitude?: number;
}

/** A single tier of spell slots (level 1-9). */
export interface SpellSlotLevel {
  level: number;
  current: number;
  max: number;
}

export type SpellSlots = SpellSlotLevel[];

// ---------------------------------------------------------------------------
// Character
// ---------------------------------------------------------------------------

export interface Character {
  name: string;
  race: CharacterRace;
  class: CharacterClass;
  background: CharacterBackground;
  level: number;
  xp: number;
  /** XP threshold for the next level. */
  xpToNext: number;
  /** Proficiency bonus (2 at level 1, scales with level). */
  proficiencyBonus: number;
  hp: number;
  maxHp: number;
  ac: number;
  gold: number;
  stats: Stats;
  modifiers: StatModifiers;
  statusEffects: StatusEffect[];
  spellSlots: SpellSlots;
  /** Ids of chosen talents (Phase 12). */
  talents: string[];
}

// ---------------------------------------------------------------------------
// Items & equipment
// ---------------------------------------------------------------------------

export type ItemType =
  | 'weapon'
  | 'armor'
  | 'shield'
  | 'potion'
  | 'artifact'
  | 'quest'
  | 'misc';

export type ItemRarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'very-rare'
  | 'legendary';

export type DiceType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';

export type DamageType =
  | 'slashing'
  | 'piercing'
  | 'bludgeoning'
  | 'fire'
  | 'cold'
  | 'poison'
  | 'necrotic'
  | 'radiant'
  | 'lightning';

export type EquipmentSlot =
  | 'head'
  | 'body'
  | 'hands'
  | 'legs'
  | 'mainHand'
  | 'offHand'
  | 'ring1'
  | 'ring2'
  | 'amulet';

export interface WeaponStats {
  /** Damage expressed as {count}{dice}+{bonus}, e.g. 2d6+3. */
  damageDice: DiceType;
  damageCount: number;
  damageBonus: number;
  damageType: DamageType;
  /** Weapon may use the DEX modifier instead of STR. */
  finesse?: boolean;
  twoHanded?: boolean;
  ranged?: boolean;
}

export interface ArmorStats {
  baseAc: number;
  /** Max DEX bonus added to AC (undefined = uncapped). */
  maxDexBonus?: number;
  slot: EquipmentSlot;
}

export type PotionEffectType = 'heal' | 'poison' | 'buff' | 'nightvision';

export interface PotionEffect {
  effect: PotionEffectType;
  /** Magnitude as dice, e.g. heal d4+4 -> count 1, dice d4, bonus 4. */
  diceCount?: number;
  diceType?: DiceType;
  bonus?: number;
  /** Duration in rounds for lasting effects. */
  duration?: number;
}

export interface Item {
  id: string;
  name: string;
  type: ItemType;
  rarity: ItemRarity;
  /** Weight in pounds (encumbrance). */
  weight: number;
  /** Value in gold pieces. */
  value: number;
  description: string;
  /** Emoji or lucide-react icon name. */
  icon: string;
  /** Stack size for consumables (Phase 10). Absent = 1; always read as `?? 1`. */
  quantity?: number;
  weaponStats?: WeaponStats;
  armorStats?: ArmorStats;
  potionEffect?: PotionEffect;
}

/** Equipped item per slot; null when the slot is empty. */
export type EquipmentSlots = Record<EquipmentSlot, Item | null>;

// ---------------------------------------------------------------------------
// Enemies
// ---------------------------------------------------------------------------

export type Biome = 'crypt' | 'forest' | 'castle' | 'cave' | 'ruins';

export type EnemyBehavior = 'aggressive' | 'tactical' | 'support' | 'coward' | 'berserker';

export interface EnemyAttack {
  name: string;
  toHitBonus: number;
  damageDice: DiceType;
  damageCount: number;
  damageBonus: number;
  damageType: DamageType;
  /** Area-of-effect attack (hits multiple targets). */
  aoe?: boolean;
}

export interface LootDrop {
  itemId: string;
  /** Drop probability, 0-1. */
  chance: number;
  minQuantity?: number;
  maxQuantity?: number;
}

export interface Enemy {
  id: string;
  name: string;
  /** Challenge rating; fractions allowed (e.g. 0.25). */
  cr: number;
  hp: number;
  maxHp: number;
  ac: number;
  stats: Stats;
  attacks: EnemyAttack[];
  behavior: EnemyBehavior;
  lootTable: LootDrop[];
  biomes: Biome[];
  xpReward: number;
  statusEffects?: StatusEffect[];
  /** Boss/elite flag (Phase 7): cannot be removed without real combat. */
  mustFight?: boolean;
}

// ---------------------------------------------------------------------------
// Dungeon & rooms
// ---------------------------------------------------------------------------

export type RoomType =
  | 'entrance'
  | 'corridor'
  | 'barracks'
  | 'library'
  | 'crypt'
  | 'treasure'
  | 'boss'
  | 'shop'
  | 'puzzle'
  | 'trap'
  | 'throne';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type TrapType = 'dart' | 'pit' | 'poison-gas' | 'fire' | 'alarm';

export interface Trap {
  type: TrapType;
  /** Difficulty class to detect / disarm. */
  dc: number;
  detected: boolean;
  disarmed: boolean;
  triggered: boolean;
  damageDice: DiceType;
  damageCount: number;
  damageType: DamageType;
}

export interface Room {
  id: string;
  type: RoomType;
  rect: Rect;
  /** Ids of connected rooms. */
  connections: string[];
  enemies: Enemy[];
  items: Item[];
  isVisited: boolean;
  isRevealed: boolean;
  isCleared: boolean;
  trap?: Trap;
  npcId?: string;
  /** Optional flavour text found in the room (inscription, book...). */
  lore?: string;
}

export interface Dungeon {
  rooms: Room[];
  currentRoomId: string;
  floor: number;
  biome: Biome;
  /** Map dimensions in tiles. */
  width: number;
  height: number;
  /** Seed used to deterministically regenerate this floor. */
  seed: number;
}

// ---------------------------------------------------------------------------
// Quests
// ---------------------------------------------------------------------------

export type QuestType = 'main' | 'side' | 'random';

export type QuestStatus = 'active' | 'completed' | 'failed';

export type QuestObjectiveType =
  | 'kill'
  | 'find-item'
  | 'escort'
  | 'explore'
  | 'survive';

export interface QuestObjective {
  id: string;
  type: QuestObjectiveType;
  description: string;
  /** Required amount to complete (e.g. kill 3 goblins). */
  target: number;
  current: number;
  isComplete: boolean;
  /** Optional id of the tracked enemy / item / room. */
  targetId?: string;
}

export interface QuestRewards {
  xp: number;
  gold: number;
  items?: Item[];
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  type: QuestType;
  objectives: QuestObjective[];
  rewards: QuestRewards;
  status: QuestStatus;
  /** Optional turn limit before the quest fails. */
  timeLimit?: number;
}

// ---------------------------------------------------------------------------
// Combat
// ---------------------------------------------------------------------------

export type CombatantKind = 'player' | 'enemy';

export interface TurnEntry {
  /** 'player' or an enemy id. */
  id: string;
  kind: CombatantKind;
  initiative: number;
}

export interface CombatLogEntry {
  id: string;
  text: string;
  timestamp: number;
}

export interface CombatState {
  active: boolean;
  round: number;
  turnOrder: TurnEntry[];
  /** Index into turnOrder for the active combatant. */
  currentTurnIndex: number;
  enemies: Enemy[];
  log: CombatLogEntry[];
}

// ---------------------------------------------------------------------------
// Narrative & stats
// ---------------------------------------------------------------------------

export type NarrativeType =
  | 'narration'
  | 'combat'
  | 'loot'
  | 'dialogue'
  | 'system'
  | 'player'
  | 'action'
  | 'quest';

export interface NarrativeEntry {
  id: string;
  type: NarrativeType;
  text: string;
  timestamp: number;
}

export interface GameStats {
  turnsPlayed: number;
  enemiesKilled: number;
  goldFound: number;
  roomsExplored: number;
  /** Times the hero has died (currently counted on out-of-combat status deaths). */
  deathCount: number;
  /** Quests brought to the 'completed' state (Phase 10). */
  questsCompleted: number;
}

// ---------------------------------------------------------------------------
// World model (Phase 7 — AI-driven locations, NPCs, world memory)
// ---------------------------------------------------------------------------

/** Arbitrary persistent world facts the DM writes/reads as its memory. */
export type WorldFlags = Record<string, string | number | boolean>;

export type LocationType =
  | 'dungeon_room'
  | 'corridor'
  | 'cave'
  | 'crypt'
  | 'library'
  | 'shrine'
  | 'town'
  | 'building_interior'
  | 'wilderness'
  | 'boss_lair'
  | 'other';

export interface LocationConnection {
  toLocationId: string;
  /** Free-text label for the passage, e.g. "на север", "вниз по лестнице". */
  label: string;
}

export interface Location {
  id: string;
  name: string;
  type: LocationType;
  description: string;
  /** Free-form biome string for AI flavour. */
  biome: string;
  /** Local threat level for this place. Old saves may omit it; fall back to GameState.depth. */
  dangerLevel?: number;
  enemiesPresent: Enemy[];
  itemsPresent: Item[];
  npcIds: string[];
  connections: LocationConnection[];
  isSafeZone: boolean;
  lore?: string;
  visitCount: number;
  /** gameStats.turnsPlayed when first discovered (sort key for the atlas). */
  discoveredAt: number;
}

export type NPCAttitude = 'hostile' | 'unfriendly' | 'neutral' | 'friendly' | 'ally';

export interface NPC {
  id: string;
  name: string;
  role: string;
  description: string;
  icon: string;
  /** Recent lines of dialogue (kept short). */
  dialogues: string[];
  shopInventory?: Item[];
}

export interface NPCMemory {
  npcId: string;
  /** Short notes on past interactions. */
  interactions: string[];
  attitude: NPCAttitude;
}

/** A pending out-of-combat skill check awaiting a d20 roll. */
export interface SkillCheckRequest {
  stat: keyof Stats;
  dc: number;
  description: string;
  /** Damage applied ONLY on failure (Phase 10), clamped like any narrative HP. */
  onFailHpChange?: number;
}

/** A single turn in the DM conversation (persisted with saves since Phase 8). */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ---------------------------------------------------------------------------
// Talents (Phase 12). Defined here (canonical) so GameState can reference them
// without a types <-> engine import cycle; talents.ts re-exports these.
// ---------------------------------------------------------------------------

export type TalentEffectKind =
  | 'damage_bonus_low_hp'
  | 'damage_reduction'
  | 'crit_range_expand'
  | 'heal_on_kill';

export interface TalentOption {
  id: string;
  name: string;
  description: string;
  effect: { kind: TalentEffectKind; amount?: number };
  /** Character level where this node can be learned. */
  level?: number;
  /** Talent ids that must be learned before this node is available. */
  requires?: string[];
  /** Visual position inside the pannable skill tree. */
  position?: { x: number; y: number };
}

export interface TalentChoice {
  level: number;
  options: TalentOption[];
}

/** A logged major story decision (Phase 12), for the decision graph. */
export interface DecisionLogEntry {
  id: string;
  turn: number;
  description: string;
  consequence?: string;
  locationName: string;
}

/** A generated run-specific achievement. Static achievements remain global. */
export interface DynamicAchievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  createdAtTurn: number;
}

// ---------------------------------------------------------------------------
// Aggregate game state & saves
// ---------------------------------------------------------------------------

/** Lightweight, serializable summary of a level-up for the modal. */
export interface LevelUpInfo {
  oldLevel: number;
  newLevel: number;
  hpGained: number;
  oldMaxHp: number;
  newMaxHp: number;
  oldProf: number;
  newProf: number;
  features: string[];
}

export interface GameState {
  screen: GameScreen;
  character: Character | null;
  combat: CombatState | null;
  inventory: Item[];
  equipped: EquipmentSlots;
  quests: Quest[];
  narrativeLog: NarrativeEntry[];
  gameStats: GameStats;
  isLoading: boolean;
  /** ISO timestamp of the last successful autosave, or null. */
  savedAt: string | null;
  /** Queue of pending level-ups, shown one-by-one in the LevelUpScreen modal. */
  pendingLevelUps: LevelUpInfo[];

  // --- World model (Phase 7) — replaces the pre-generated dungeon. ---
  locations: Record<string, Location>;
  currentLocationId: string | null;
  /** Abstract difficulty / how deep the story has descended. */
  depth: number;
  /** Location ids where combat actually ended in victory. */
  resolvedCombatAt: Record<string, true>;
  worldFlags: WorldFlags;
  npcs: Record<string, NPC>;
  npcMemory: Record<string, NPCMemory>;
  /** Pending out-of-combat skill check shown in the SkillCheckModal, or null. */
  pendingRoll: SkillCheckRequest | null;

  // --- Context compression (Phase 8) ---
  /** Rolling AI-written summary of the story so far (keeps the prompt small). */
  storySummary: string;
  /** turnsPlayed value at which storySummary was last regenerated. */
  summarizedUpToTurn: number;

  /** True once this run has been autosaved at least once (Phase 11). */
  hasAutosaved: boolean;

  // --- Phase 12 ---
  /** Talent choices queued by level-ups, consumed in the LevelUpScreen. */
  pendingTalentChoices: TalentChoice[];
  /** Latest AI-suggested quick actions (chips above the input). */
  lastSuggestedActions: string[];
  /** Globally-unlocked achievement ids (mirrors localStorage). */
  unlockedAchievements: string[];
  /** Queue of achievement ids awaiting a "trophy unlocked" toast. */
  pendingAchievementToasts: string[];
  /** Random achievements generated during this run. */
  dynamicAchievements: DynamicAchievement[];
  /** Major story decisions logged this run (drives the decision graph). */
  decisionLog: DecisionLogEntry[];
}

export interface SaveSlot {
  slotIndex: number;
  /** Save schema version — drives migrations on load. */
  version: number;
  characterName: string;
  characterClass: CharacterClass;
  characterLevel: number;
  /** Current location danger level (legacy field name kept for save compatibility). */
  floor: number;
  /** ISO timestamp. */
  savedAt: string;
  /** Total play time in minutes. */
  playtime: number;
  gameState: GameState;
  /** DM short-term conversational memory (Phase 8). */
  aiMessageHistory: ChatMessage[];
}
