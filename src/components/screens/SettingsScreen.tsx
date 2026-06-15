import { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Volume2, VolumeX } from 'lucide-react';
import { useGameStore } from '../../store/gameStore';
import { isSoundEnabled, setSoundEnabled } from '../../hooks/useSound';
import { soundEngine } from '../../engine/audio/soundEngine';
import { AVAILABLE_MODELS, getApiKey, getModel, setApiKey, setModel } from '../../engine/ai/settings';

export default function SettingsScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const character = useGameStore((s) => s.character);
  const [sound, setSound] = useState(isSoundEnabled());
  const [apiKey, setApiKeyState] = useState(getApiKey());
  const [model, setModelState] = useState(getModel());
  const [showKey, setShowKey] = useState(false);

  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    setSoundEnabled(next);
    if (next) soundEngine.play('menu_click');
  };

  const onKeyChange = (value: string) => {
    setApiKeyState(value);
    setApiKey(value);
  };

  const onModelChange = (value: string) => {
    setModelState(value);
    setModel(value);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-10">
      <h1 className="font-serif text-4xl text-gold">Настройки</h1>

      <div className="flex w-full max-w-sm flex-col gap-6">
        <button
          type="button"
          onClick={toggleSound}
          className="flex w-full items-center justify-between rounded-lg border border-surface-elevated bg-surface px-4 py-3 transition-colors hover:border-gold"
        >
          <span className="flex items-center gap-2 text-parchment">
            {sound ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />} Звуковые эффекты
          </span>
          <span className={`relative h-6 w-11 rounded-full transition-colors ${sound ? 'bg-gold' : 'bg-surface-elevated'}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-dungeon transition-all ${sound ? 'left-[22px]' : 'left-0.5'}`} />
          </span>
        </button>

        <div className="rounded-lg border border-surface-elevated bg-surface p-4">
          <h2 className="mb-1 font-serif text-lg text-gold">Мастер Подземелий (ИИ)</h2>
          <p className="mb-3 text-xs leading-relaxed text-muted">
            Историю ведёт модель Groq. Введи свой API-ключ — он хранится только в этом браузере и никуда больше не
            отправляется (кроме самого Groq). Получить ключ:{' '}
            <span className="text-parchment/80">console.groq.com/keys</span>
          </p>

          <label className="mb-1 block text-xs uppercase tracking-wider text-muted">API-ключ Groq</label>
          <div className="mb-3 flex items-center gap-2">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => onKeyChange(e.target.value)}
              placeholder="gsk_..."
              spellCheck={false}
              autoComplete="off"
              className="flex-1 rounded-md border border-surface-elevated bg-dungeon px-3 py-2 text-sm text-parchment placeholder:text-muted/60 focus:border-gold focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              aria-label={showKey ? 'Скрыть ключ' : 'Показать ключ'}
              className="rounded-md border border-surface-elevated p-2 text-muted transition-colors hover:border-gold hover:text-gold"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <label className="mb-1 block text-xs uppercase tracking-wider text-muted">Модель</label>
          <select
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className="w-full rounded-md border border-surface-elevated bg-dungeon px-3 py-2 text-sm text-parchment focus:border-gold focus:outline-none"
          >
            {AVAILABLE_MODELS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <p className="mt-2 text-xs text-muted">
            {apiKey.trim() ? '✓ Ключ сохранён' : '⚠ Без ключа Мастер Подземелий не сможет вести историю.'}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setScreen(character ? 'game' : 'title')}
        className="group flex items-center gap-2 text-muted transition-colors hover:text-gold"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" /> {character ? 'Назад к игре' : 'Назад в меню'}
      </button>
    </div>
  );
}
