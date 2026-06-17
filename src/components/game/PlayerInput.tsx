import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Loader2, Send } from 'lucide-react';
import { useGameStore } from '../../store/gameStore';

interface PlayerInputProps {
  /** Disables submission while the narrative is still typing out. */
  isTyping: boolean;
}

const HISTORY_LIMIT = 20;

const QUICK_ACTIONS = [
  { label: '🔍 Осмотреться', command: 'Осмотреться вокруг.' },
  { label: '🔎 Обыскать', command: 'Обыскать местность в поисках чего-нибудь полезного.' },
  { label: '💤 Отдохнуть', command: 'Отдохнуть и перевести дух.' },
  { label: '👂 Прислушаться', command: 'Прислушаться к окружению.' },
];

/** Free-text command box. Everything flows to the DM via submitPlayerAction. */
export default function PlayerInput({ isTyping }: PlayerInputProps) {
  const [value, setValue] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const isLoading = useGameStore((s) => s.isLoading);
  const inCombat = useGameStore((s) => !!s.combat?.active);
  const pendingRoll = useGameStore((s) => s.pendingRoll);
  const suggestions = useGameStore((s) => s.lastSuggestedActions);
  const submitPlayerAction = useGameStore((s) => s.submitPlayerAction);

  const locked = isTyping || isLoading || inCombat || !!pendingRoll;

  const submit = (raw: string) => {
    const input = raw.trim();
    if (locked || !input) return;
    void submitPlayerAction(input);
    setHistory((prev) => [input, ...prev].slice(0, HISTORY_LIMIT));
    setHistoryIndex(-1);
    setValue('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      submit(value);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (history.length === 0) return;
      const next = Math.min(historyIndex + 1, history.length - 1);
      setHistoryIndex(next);
      setValue(history[next]);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (historyIndex <= 0) {
        setHistoryIndex(-1);
        setValue('');
        return;
      }
      const next = historyIndex - 1;
      setHistoryIndex(next);
      setValue(history[next]);
    }
  };

  const placeholder = inCombat
    ? 'Идёт бой…'
    : isLoading
      ? 'Мастер Подземелий размышляет…'
      : 'Что ты делаешь?';

  return (
    <div className="flex shrink-0 flex-col gap-2 border-t border-surface-elevated p-3">
      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-gold">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Мастер Подземелий ведёт повествование…
        </div>
      )}
      {suggestions.length > 0 && !inCombat && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((suggestion, i) => (
            <button
              key={`${suggestion}-${i}`}
              type="button"
              onClick={() => submit(suggestion)}
              disabled={locked}
              className="rounded-full border border-gold/20 bg-surface px-3 py-1 text-sm text-parchment transition-colors hover:border-gold disabled:cursor-not-allowed disabled:opacity-40"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={locked}
          placeholder={placeholder}
          className="flex-1 rounded-md border border-surface-elevated bg-dungeon px-3 py-2 text-sm text-parchment placeholder:text-muted/60 focus:border-gold focus:outline-none disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => submit(value)}
          disabled={locked || value.trim().length === 0}
          aria-label="Отправить команду"
          className="flex items-center rounded-md bg-gold px-3 py-2 text-dungeon transition-colors hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => submit(action.command)}
            disabled={locked}
            className="rounded-md border border-surface-elevated px-2 py-1 text-xs text-muted transition-colors hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-40"
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
