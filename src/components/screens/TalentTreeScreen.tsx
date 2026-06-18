import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useGameStore } from '../../store/gameStore';
import TalentTree from '../character/TalentTree';

interface TalentTreeScreenProps {
  onClose: () => void;
}

export default function TalentTreeScreen({ onClose }: TalentTreeScreenProps) {
  const character = useGameStore((s) => s.character);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!character) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-surface-elevated bg-surface"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-surface-elevated px-5 py-3">
          <div>
            <h2 className="font-serif text-xl text-gold">Дерево навыков</h2>
            <p className="text-xs text-muted">Выбранные таланты: {character.talents.length}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="text-muted transition-colors hover:text-gold">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto p-4">
          <TalentTree
            characterClass={character.class}
            selectedTalentIds={character.talents}
            currentLevel={character.level}
            height={520}
          />
        </div>
      </motion.div>
    </div>
  );
}
