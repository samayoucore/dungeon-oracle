import { motion } from 'framer-motion';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useGameStore } from '../../../store/gameStore';
import {
  CLASS_ICONS,
  deleteSave,
  formatPlaytime,
  formatSaveDate,
  listSaves,
} from '../../../utils/save';
import type { SaveSlot } from '../../../types';
import { CLASS_BY_ID } from '../../../engine/character/data';
import { messageHistory } from '../../../engine/ai/messageHistory';

interface SaveSlotListProps {
  onBack: () => void;
}

interface RowProps {
  index: number;
  slot: SaveSlot | null;
  onLoad: (slot: SaveSlot) => void;
  onDelete: (index: number) => void;
}

/** A single save slot row — either a populated card or an empty placeholder. */
function SaveRow({ index, slot, onLoad, onDelete }: RowProps) {
  if (!slot) {
    return (
      <div className="flex h-[4.5rem] items-center justify-center rounded-lg border border-dashed border-surface-elevated text-sm text-muted">
        Пустой слот {index + 1}
      </div>
    );
  }

  return (
    <div className="group relative flex items-center gap-4 rounded-lg border border-surface-elevated bg-surface p-4 transition-colors hover:border-gold">
      <button
        type="button"
        onClick={() => onLoad(slot)}
        className="flex flex-1 items-center gap-4 text-left"
      >
        <span className="text-3xl">{CLASS_ICONS[slot.characterClass]}</span>
        <span className="flex flex-col gap-0.5">
          <span className="font-serif text-lg text-parchment">{slot.characterName}</span>
          <span className="text-xs text-muted">
            {CLASS_BY_ID[slot.characterClass].name} · Ур. {slot.characterLevel} · Этаж {slot.floor}
          </span>
          <span className="text-xs text-muted/80">
            {formatSaveDate(slot.savedAt)} · {formatPlaytime(slot.playtime)}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => onDelete(index)}
        aria-label={`Удалить слот ${index + 1}`}
        className="text-muted opacity-0 transition group-hover:opacity-100 hover:text-danger"
      >
        <Trash2 className="h-5 w-5" />
      </button>
    </div>
  );
}

/** Continue-game view: pick, load or delete one of the save slots. */
export default function SaveSlotList({ onBack }: SaveSlotListProps) {
  const [saves, setSaves] = useState<(SaveSlot | null)[]>(() => listSaves());
  const loadState = useGameStore((state) => state.loadState);

  const handleDelete = (index: number) => {
    deleteSave(index);
    setSaves(listSaves());
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.3 }}
      className="flex w-full max-w-md flex-col gap-5"
    >
      <h2 className="text-center font-serif text-3xl text-gold">Загрузка</h2>
      <div className="flex flex-col gap-3">
        {saves.map((slot, index) => (
          <SaveRow
            key={index}
            index={index}
            slot={slot}
            onLoad={(picked) => {
              loadState(picked.gameState);
              messageHistory.loadHistory(picked.aiMessageHistory ?? []);
            }}
            onDelete={handleDelete}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={onBack}
        className="group mx-auto flex items-center gap-2 text-muted transition-colors hover:text-gold"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
        Назад
      </button>
    </motion.div>
  );
}
