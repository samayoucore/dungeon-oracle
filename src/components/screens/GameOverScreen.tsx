import { motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { getDifficulty } from '../../engine/world/validation';
import type { Difficulty } from '../../engine/world/validation';

/** Honest one-liner about whether this run was actually saved. */
function getSaveStatusMessage(hasAutosaved: boolean, difficulty: Difficulty): string {
  if (difficulty === 'hardcore') return 'На хардкоре автосохранение отключено — эта попытка не сохранена.';
  if (hasAutosaved) return 'Прогресс этой попытки был сохранён автоматически.';
  return 'Эта попытка завершилась раньше, чем успело сработать автосохранение.';
}

const EPITAPHS: { max: number; text: string }[] = [
  { max: 1, text: 'Его приключение закончилось, не начавшись.' },
  { max: 3, text: 'Подающий надежды герой, сгинувший во тьме.' },
  { max: 5, text: 'Он сражался храбро, но подземелье взяло верх.' },
  { max: 7, text: 'Бывалый воин, павший от незримого удара.' },
  { max: 9, text: 'Легенды будут говорить о его деяниях... недолго.' },
  { max: 99, text: 'Даже величайшие в конце концов падают.' },
];

const TITLE = 'ТЫ ПОГИБ';

function epitaphFor(level: number): string {
  return (EPITAPHS.find((e) => level <= e.max) ?? EPITAPHS[EPITAPHS.length - 1]).text;
}

function Stat({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-lg">{icon}</span>
      <div>
        <div className="text-base font-bold text-parchment">{value}</div>
        <div className="text-[11px] text-muted">{label}</div>
      </div>
    </div>
  );
}

/** Full-screen, atmospheric death screen with a run summary. */
export default function GameOverScreen() {
  const character = useGameStore((s) => s.character);
  const stats = useGameStore((s) => s.gameStats);
  const quests = useGameStore((s) => s.quests);
  const beginCreation = useGameStore((s) => s.beginCreation);
  const setScreen = useGameStore((s) => s.setScreen);
  const hasAutosaved = useGameStore((s) => s.hasAutosaved);

  const questsDone = quests.filter((q) => q.status === 'completed').length;
  const saveStatus = getSaveStatusMessage(hasAutosaved, getDifficulty());

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
      className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-10 text-center"
    >
      <div className="skull-sway text-7xl">🪦</div>

      <h1 className="font-serif text-5xl font-bold text-danger md:text-6xl">
        {TITLE.split('').map((char, index) => (
          <motion.span
            key={index}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            {char === ' ' ? ' ' : char}
          </motion.span>
        ))}
      </h1>

      <p className="max-w-md font-serif italic text-muted">{epitaphFor(character?.level ?? 1)}</p>

      {character && (
        <div className="w-full max-w-md rounded-xl border border-danger/20 bg-surface p-5 text-left">
          <div className="font-serif text-lg text-parchment">{character.name}</div>
          <div className="text-xs capitalize text-muted">
            {character.race} {character.class}
          </div>
          <div className="my-3 border-t border-surface-elevated" />
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Stat icon="🏆" label="Достигнут уровень" value={character.level} />
            <Stat icon="⚔️" label="Врагов сражено" value={stats.enemiesKilled} />
            <Stat icon="🚪" label="Комнат исследовано" value={stats.roomsExplored} />
            <Stat icon="💰" label="Золота собрано" value={stats.goldFound} />
            <Stat icon="📜" label="Квестов выполнено" value={questsDone} />
            <Stat icon="🎲" label="Ходов прожито" value={stats.turnsPlayed} />
          </div>
        </div>
      )}

      <div className="flex w-full max-w-md flex-col gap-2">
        <button
          type="button"
          onClick={() => beginCreation()}
          className="rounded-md bg-gold px-4 py-3 font-semibold text-dungeon transition-colors hover:bg-gold/90"
        >
          Попробовать снова
        </button>
        <p className="text-xs text-muted">{saveStatus}</p>
        <button
          type="button"
          onClick={() => setScreen('title')}
          className="rounded-md border border-surface-elevated px-4 py-2 text-muted transition-colors hover:border-gold hover:text-gold"
        >
          В главное меню
        </button>
      </div>
    </motion.div>
  );
}
