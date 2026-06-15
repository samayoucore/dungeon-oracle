import { useEffect, useRef } from 'react';
import { Eraser } from 'lucide-react';
import type { NarrativeType } from '../../types';
import { useGameStore } from '../../store/gameStore';
import TypewriterText from '../ui/TypewriterText';

interface NarrativeLogProps {
  /** Reports whether the latest entry is still being typed out. */
  onTypingChange?: (typing: boolean) => void;
}

function entryClass(type: NarrativeType): string {
  switch (type) {
    case 'action':
      return 'font-sans text-sm italic text-gold/80';
    case 'combat':
      return 'font-sans text-sm font-semibold text-red-400';
    case 'loot':
      return 'font-sans text-sm text-green-400';
    case 'quest':
      return 'font-sans text-sm text-blue-400';
    case 'system':
      return 'text-center font-sans text-xs text-muted';
    case 'dialogue':
      return 'pl-3 font-serif text-sm italic text-parchment/80';
    case 'narration':
    default:
      return 'font-serif text-base leading-relaxed text-parchment';
  }
}

function prefix(type: NarrativeType): string {
  if (type === 'action') return '» ';
  if (type === 'loot') return '◆ ';
  if (type === 'quest') return '! ';
  return '';
}

/** Scrollable event feed. Last entry animates; earlier ones render instantly. */
export default function NarrativeLog({ onTypingChange }: NarrativeLogProps) {
  const entries = useGameStore((s) => s.narrativeLog);
  const clearNarrative = useGameStore((s) => s.clearNarrative);
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (el) atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  };

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
  };

  // A new entry arrives -> it starts typing; keep the view pinned to the bottom.
  useEffect(() => {
    onTypingChange?.(entries.length > 0);
    scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.length]);

  const lastIndex = entries.length - 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-surface-elevated px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">Хроника</span>
        <button
          type="button"
          onClick={() => clearNarrative()}
          className="flex items-center gap-1 text-xs text-muted transition-colors hover:text-gold"
        >
          <Eraser className="h-3 w-3" /> Очистить
        </button>
      </div>
      <div ref={scrollRef} onScroll={handleScroll} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
        {entries.length === 0 && <p className="text-sm text-muted">Подземелье ждёт твою историю…</p>}
        {entries.map((entry, index) => (
          <div key={entry.id} className="border-b border-surface-elevated/40 pb-2 last:border-0">
            <p className={`${entryClass(entry.type)} whitespace-pre-line`}>
              {prefix(entry.type)}
              {index === lastIndex ? (
                <TypewriterText
                  text={entry.text}
                  onComplete={() => {
                    onTypingChange?.(false);
                    scrollToBottom();
                  }}
                />
              ) : (
                <TypewriterText text={entry.text} instant />
              )}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
