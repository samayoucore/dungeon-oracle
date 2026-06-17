// ============================================================================
// Achievement definitions (Phase 12). Pure data; `icon` is a lucide-react
// component name resolved in the UI layer.
// ============================================================================

export interface Achievement {
  id: string;
  title: string;
  description: string;
  /** lucide-react icon component name. */
  icon: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_blood', title: 'Первая кровь', description: 'Победи первого врага.', icon: 'Sword' },
  { id: 'close_call', title: 'На волоске', description: 'Выживи с 1 HP.', icon: 'HeartCrack' },
  { id: 'gold_hoarder', title: 'Скряга', description: 'Накопи 500 золота одновременно.', icon: 'Coins' },
  { id: 'silver_tongue', title: 'Хитрец', description: 'Получи отказ при попытке обмануть ключевого противника без боя.', icon: 'Drama' },
  { id: 'deep_diver', title: 'В глубину', description: 'Достигни глубины 10.', icon: 'ArrowDownToLine' },
  { id: 'quest_master', title: 'Искатель приключений', description: 'Заверши 5 квестов.', icon: 'ScrollText' },
  { id: 'friend_of_many', title: 'Душа компании', description: 'Достигни дружеского отношения с 3 персонажами.', icon: 'Users' },
  { id: 'cursed', title: 'Проклят', description: 'Получи постоянное снижение характеристики.', icon: 'Skull' },
  { id: 'blessed', title: 'Благословлён', description: 'Получи постоянное повышение характеристики.', icon: 'Sparkles' },
  { id: 'survivor', title: 'Выживший', description: 'Сыграй 100 ходов за один забег.', icon: 'Hourglass' },
];

export const ACHIEVEMENT_BY_ID: Record<string, Achievement> = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.id, a]),
);
