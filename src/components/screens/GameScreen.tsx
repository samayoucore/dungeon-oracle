import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { Backpack, Map as MapIcon, ScrollText, Settings, User } from 'lucide-react';
import { useGameStore } from '../../store/gameStore';
import { resolveLoot } from '../../engine/combat/system';
import { useAutosave } from '../../hooks/useAutosave';
import CharacterSheet from '../character/CharacterSheet';
import InventoryPanel from '../character/InventoryPanel';
import LocationAtlas from '../game/LocationAtlas';
import ExitPanel from '../game/ExitPanel';
import LocationInfo from '../game/LocationInfo';
import NarrativeLog from '../game/NarrativeLog';
import PlayerInput from '../game/PlayerInput';
import GameMenu from '../game/GameMenu';
import CombatPanel from '../game/CombatPanel';
import LootPanel from '../game/LootPanel';
import type { LootResult } from '../game/LootPanel';
import SkillCheckModal from '../game/SkillCheckModal';
import LevelUpScreen from './LevelUpScreen';
import Toast, { useToasts } from '../ui/Toast';

const PANEL = 'min-h-0 flex-col overflow-hidden rounded-lg border border-surface-elevated bg-surface';

type Tab = 'character' | 'log' | 'map' | 'bag';

function PanelHeader({ title }: { title: string }) {
  return (
    <div className="shrink-0 border-b border-surface-elevated px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted">
      {title}
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button type="button" onClick={onClick} className={`flex flex-1 flex-col items-center gap-1 py-2 text-xs ${active ? 'text-gold' : 'text-muted'}`}>
      {icon}
      {label}
    </button>
  );
}

function LeftTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${active ? 'border-b-2 border-gold text-gold' : 'text-muted'}`}>
      {label}
    </button>
  );
}

/** Main game screen: AI-driven exploration, narrative, combat and progression. */
export default function GameScreen() {
  const character = useGameStore((s) => s.character);
  const locations = useGameStore((s) => s.locations);
  const currentLocationId = useGameStore((s) => s.currentLocationId);
  const depth = useGameStore((s) => s.depth);
  const combat = useGameStore((s) => s.combat);
  const isLoading = useGameStore((s) => s.isLoading);
  const pendingLevelUp = useGameStore((s) => s.pendingLevelUp);
  const clearLevelUp = useGameStore((s) => s.clearLevelUp);

  const [tab, setTab] = useState<Tab>('map');
  const [isTyping, setIsTyping] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loot, setLoot] = useState<LootResult | null>(null);
  const { toasts, push } = useToasts();

  const onSaved = useCallback((ok: boolean) => push(ok ? '💾 Сохранено' : '⚠ Ошибка сохранения', ok ? 'success' : 'error'), [push]);
  useAutosave(3, onSaved);

  const handleVictory = useCallback(() => {
    const state = useGameStore.getState();
    if (!state.combat || !state.currentLocationId) return;
    const result = resolveLoot(state.combat.enemies);
    setLoot({ ...result, enemyCount: state.combat.enemies.length });
    state.markCombatResolved(state.currentLocationId);
    state.addNarrative('Враги повержены. Победа за тобой!', 'combat');
    state.endCombat();
  }, []);

  const currentLocation = currentLocationId ? locations[currentLocationId] : null;

  if (!currentLocation || !character) {
    return <div className="flex min-h-screen items-center justify-center text-muted">Подземелье готовится…</div>;
  }

  const inCombat = !!combat?.active;
  const leftVisible = tab === 'character' || tab === 'bag';

  return (
    <div className="flex h-[100dvh] flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-surface-elevated bg-surface px-4 py-2">
        <div className="text-sm text-muted">
          Глубина {depth} · <span className="text-parchment">{currentLocation.name}</span>
        </div>
        <button type="button" onClick={() => setMenuOpen(true)} className="flex items-center gap-1 rounded-md border border-surface-elevated px-3 py-1 text-sm text-muted transition-colors hover:border-gold hover:text-gold">
          <Settings className="h-4 w-4" /> Меню
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-3 overflow-hidden p-3 lg:grid lg:grid-cols-[260px_1fr_280px] lg:grid-rows-1">
        <section className={`${leftVisible ? 'flex flex-1' : 'hidden'} lg:flex ${PANEL}`}>
          <div className="hidden shrink-0 border-b border-surface-elevated lg:flex">
            <LeftTab active={tab !== 'bag'} onClick={() => setTab('character')} label="Герой" />
            <LeftTab active={tab === 'bag'} onClick={() => setTab('bag')} label="Сумка" />
          </div>
          {tab === 'bag' ? <InventoryPanel /> : <CharacterSheet character={character} />}
        </section>

        <section className={`${tab === 'log' ? 'flex flex-1' : 'hidden'} lg:flex ${PANEL}`}>
          <NarrativeLog onTypingChange={setIsTyping} />
          <PlayerInput isTyping={isTyping} />
        </section>

        <section className={`${tab === 'map' ? 'flex flex-1' : 'hidden'} lg:flex ${PANEL}`}>
          <PanelHeader title="Карта мира" />
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-3">
            <LocationAtlas />
            <ExitPanel disabled={inCombat || isLoading} />
            <div className="border-t border-surface-elevated pt-3">
              <LocationInfo location={currentLocation} />
            </div>
          </div>
        </section>
      </div>

      <nav className="flex shrink-0 border-t border-surface-elevated bg-surface lg:hidden">
        <TabButton active={tab === 'character'} onClick={() => setTab('character')} icon={<User className="h-5 w-5" />} label="Герой" />
        <TabButton active={tab === 'log'} onClick={() => setTab('log')} icon={<ScrollText className="h-5 w-5" />} label="Лог" />
        <TabButton active={tab === 'map'} onClick={() => setTab('map')} icon={<MapIcon className="h-5 w-5" />} label="Карта" />
        <TabButton active={tab === 'bag'} onClick={() => setTab('bag')} icon={<Backpack className="h-5 w-5" />} label="Сумка" />
      </nav>

      {inCombat && <CombatPanel onVictory={handleVictory} />}
      {loot && <LootPanel loot={loot} onClose={() => setLoot(null)} />}
      <SkillCheckModal />
      {pendingLevelUp && <LevelUpScreen info={pendingLevelUp} onClose={clearLevelUp} />}
      {menuOpen && <GameMenu onClose={() => setMenuOpen(false)} />}
      <Toast toasts={toasts} />
    </div>
  );
}
