import { useState } from 'react';
import { X } from 'lucide-react';
import { useGameStore } from '../../store/gameStore';
import { formatSaveDate, listSaves, saveGame } from '../../utils/save';
import type { SaveSlot } from '../../types';

interface GameMenuProps {
  onClose: () => void;
  onOpenChronicle: () => void;
  onOpenAchievements: () => void;
}

/** Pause menu: save into any of the 3 slots, resume, or quit to title. */
export default function GameMenu({ onClose, onOpenChronicle, onOpenAchievements }: GameMenuProps) {
  const resetGame = useGameStore((s) => s.resetGame);
  const setScreen = useGameStore((s) => s.setScreen);
  const [slots, setSlots] = useState<(SaveSlot | null)[]>(() => listSaves());
  const [savedSlot, setSavedSlot] = useState<number | null>(null);

  const saveToSlot = (index: number) => {
    const slot = saveGame(useGameStore.getState(), index);
    if (slot) {
      setSlots(listSaves());
      setSavedSlot(index);
    }
  };

  const handleQuit = () => {
    resetGame();
    setScreen('title');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-lg border border-surface-elevated bg-surface p-5" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl text-gold">Меню</h2>
          <button type="button" onClick={onClose} aria-label="Close menu" className="text-muted transition-colors hover:text-gold">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-2 text-xs uppercase tracking-wider text-muted">Сохранить в слот</div>
        <div className="mb-4 flex flex-col gap-2">
          {slots.map((slot, index) => (
            <button
              key={index}
              type="button"
              onClick={() => saveToSlot(index)}
              className="flex items-center justify-between gap-2 rounded-md border border-surface-elevated px-3 py-2 text-left text-sm transition-colors hover:border-gold"
            >
              <span className="truncate">
                <span className="text-parchment">Слот {index + 1}</span>
                <span className="ml-2 text-xs text-muted">{slot ? `${slot.characterName} · Ур. ${slot.characterLevel}` : 'Пусто'}</span>
              </span>
              <span className="shrink-0 text-xs text-gold">
                {savedSlot === index ? '✓ Сохранено' : slot ? formatSaveDate(slot.savedAt) : ''}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-surface-elevated px-4 py-2 text-parchment transition-colors hover:border-gold">
            Продолжить
          </button>
          <button type="button" onClick={onOpenChronicle} className="rounded-md border border-surface-elevated px-4 py-2 text-parchment transition-colors hover:border-gold">
            📜 Хроника
          </button>
          <button type="button" onClick={onOpenAchievements} className="rounded-md border border-surface-elevated px-4 py-2 text-parchment transition-colors hover:border-gold">
            🏆 Достижения
          </button>
          <button type="button" onClick={() => setScreen('settings')} className="rounded-md border border-surface-elevated px-4 py-2 text-parchment transition-colors hover:border-gold">
            ⚙ Настройки (ключ ИИ)
          </button>
          <button type="button" onClick={handleQuit} className="rounded-md border border-danger/50 px-4 py-2 text-danger transition-colors hover:bg-danger/10">
            В главное меню
          </button>
        </div>
      </div>
    </div>
  );
}
