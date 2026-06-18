import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Backpack, Map as MapIcon, MapPin, ScrollText, Settings, Sparkles, User } from 'lucide-react';
import { useGameStore } from '../../store/gameStore';
import { resolveLoot } from '../../engine/combat/system';
import { getDifficulty } from '../../engine/world/validation';
import { getWeatherForLocation } from '../../engine/world/weatherMap';
import { getLocationTheme } from '../../engine/world/locationTheme';
import { useAutosave } from '../../hooks/useAutosave';
import CharacterSheet from '../character/CharacterSheet';
import InventoryPanel from '../character/InventoryPanel';
import LocationAtlas from '../game/LocationAtlas';
import ExitPanel from '../game/ExitPanel';
import LocationInfo from '../game/LocationInfo';
import NpcPanel from '../game/NpcPanel';
import NarrativeLog from '../game/NarrativeLog';
import PlayerInput from '../game/PlayerInput';
import GameMenu from '../game/GameMenu';
import CombatPanel from '../game/CombatPanel';
import LootPanel from '../game/LootPanel';
import type { LootResult } from '../game/LootPanel';
import SkillCheckModal from '../game/SkillCheckModal';
import WeatherOverlay from '../game/WeatherOverlay';
import LevelUpScreen from './LevelUpScreen';
import ChronicleScreen from './ChronicleScreen';
import AchievementsScreen from './AchievementsScreen';
import TalentTreeScreen from './TalentTreeScreen';
import Toast, { useToasts } from '../ui/Toast';

const PANEL = 'glass-panel min-h-0 flex-col overflow-hidden rounded-xl';

type Tab = 'character' | 'log' | 'map' | 'bag';

function PanelHeader({ title }: { title: string }) {
  return (
    <div className="panel-title shrink-0 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted">
      {title}
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button type="button" onClick={onClick} className={`flex flex-1 flex-col items-center gap-1 py-2 text-xs transition-colors ${active ? 'text-gold' : 'text-muted'}`}>
      {icon}
      {label}
    </button>
  );
}

function LeftTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${active ? 'border-b-2 border-gold text-gold' : 'text-muted hover:text-parchment'}`}>
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
  const pendingLevelUps = useGameStore((s) => s.pendingLevelUps);
  const consumePendingLevelUp = useGameStore((s) => s.consumePendingLevelUp);

  const [tab, setTab] = useState<Tab>('log');
  const [isTyping, setIsTyping] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [chronicleOpen, setChronicleOpen] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [talentTreeOpen, setTalentTreeOpen] = useState(false);
  const [loot, setLoot] = useState<LootResult | null>(null);
  const { toasts, push } = useToasts();

  const onSaved = useCallback((ok: boolean) => push(ok ? '💾 Сохранено' : '⚠ Ошибка сохранения', ok ? 'success' : 'error'), [push]);
  useAutosave(3, onSaved);

  // One-time per-session warning when playing Hardcore (autosave disabled).
  useEffect(() => {
    if (getDifficulty() !== 'hardcore') return;
    try {
      if (sessionStorage.getItem('dm_hardcore_notice')) return;
      sessionStorage.setItem('dm_hardcore_notice', '1');
    } catch {
      /* ignore storage failures */
    }
    push('⚠ Хардкор: автосохранение отключено', 'error', 4000);
  }, [push]);

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
  const theme = getLocationTheme(currentLocation.type);
  const weather = getWeatherForLocation(currentLocation);
  const danger = currentLocation.dangerLevel ?? depth;
  const shellStyle = { '--location-bg': theme.background } as CSSProperties;

  return (
    <div className="game-shell relative flex h-[100dvh] flex-col overflow-hidden" style={shellStyle}>
      <div className="relative z-10 h-0.5 w-full shrink-0" style={{ background: theme.glow, opacity: 0.72 }} />
      <WeatherOverlay effect={weather} />
      <header className="relative z-10 flex shrink-0 flex-col gap-3 border-b border-white/10 bg-dungeon/70 px-4 py-3 backdrop-blur-md lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gold/30 bg-gold/10 text-gold">
            <MapPin className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate font-serif text-xl text-parchment">{currentLocation.name}</div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
              <span>Опасность {danger}</span>
              {currentLocation.isSafeZone && <span className="text-green-300">Безопасная зона</span>}
              {inCombat && <span className="text-danger">Бой</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setMenuOpen(true)} className="flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-muted transition-colors hover:border-gold hover:text-gold">
            <Settings className="h-4 w-4" /> Меню
          </button>
        </div>
      </header>

      <div className="relative z-10 flex flex-1 flex-col gap-3 overflow-hidden p-3 lg:grid lg:grid-cols-[300px_minmax(0,1fr)_320px] lg:grid-rows-1 lg:p-4">
        <section className={`${leftVisible ? 'flex flex-1' : 'hidden'} lg:flex ${PANEL}`}>
          <div className="panel-title hidden shrink-0 lg:flex">
            <LeftTab active={tab !== 'bag'} onClick={() => setTab('character')} label="Герой" />
            <LeftTab active={tab === 'bag'} onClick={() => setTab('bag')} label="Сумка" />
          </div>
          {tab === 'bag' ? <InventoryPanel /> : <CharacterSheet character={character} />}
        </section>

        <section className={`${tab === 'log' ? 'flex flex-1' : 'hidden'} lg:flex ${PANEL}`}>
          <div className="panel-title shrink-0 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
              <Sparkles className="h-3.5 w-3.5 text-gold" />
              Сцена
            </div>
            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-parchment/80">{currentLocation.description}</p>
          </div>
          <NarrativeLog onTypingChange={setIsTyping} />
          <PlayerInput isTyping={isTyping} />
        </section>

        <section className={`${tab === 'map' ? 'flex flex-1' : 'hidden'} lg:flex ${PANEL}`}>
          <PanelHeader title="Карта мира" />
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-3">
            <LocationAtlas />
            <ExitPanel disabled={inCombat || isLoading} />
            <div className="rounded-lg border border-white/10 bg-dungeon/35 p-3">
              <LocationInfo location={currentLocation} />
            </div>
            <NpcPanel />
          </div>
        </section>
      </div>

      <nav className="relative z-10 flex shrink-0 border-t border-white/10 bg-dungeon/85 backdrop-blur-md lg:hidden">
        <TabButton active={tab === 'character'} onClick={() => setTab('character')} icon={<User className="h-5 w-5" />} label="Герой" />
        <TabButton active={tab === 'log'} onClick={() => setTab('log')} icon={<ScrollText className="h-5 w-5" />} label="Лог" />
        <TabButton active={tab === 'map'} onClick={() => setTab('map')} icon={<MapIcon className="h-5 w-5" />} label="Карта" />
        <TabButton active={tab === 'bag'} onClick={() => setTab('bag')} icon={<Backpack className="h-5 w-5" />} label="Сумка" />
      </nav>

      {inCombat && <CombatPanel onVictory={handleVictory} />}
      {loot && <LootPanel loot={loot} onClose={() => setLoot(null)} />}
      <SkillCheckModal />
      {pendingLevelUps.length > 0 && (
        <LevelUpScreen key={pendingLevelUps[0].newLevel} info={pendingLevelUps[0]} onClose={consumePendingLevelUp} />
      )}
      {menuOpen && (
        <GameMenu
          onClose={() => setMenuOpen(false)}
          onOpenChronicle={() => {
            setMenuOpen(false);
            setChronicleOpen(true);
          }}
          onOpenAchievements={() => {
            setMenuOpen(false);
            setAchievementsOpen(true);
          }}
          onOpenTalentTree={() => {
            setMenuOpen(false);
            setTalentTreeOpen(true);
          }}
        />
      )}
      {chronicleOpen && <ChronicleScreen onClose={() => setChronicleOpen(false)} />}
      {achievementsOpen && <AchievementsScreen onClose={() => setAchievementsOpen(false)} />}
      {talentTreeOpen && <TalentTreeScreen onClose={() => setTalentTreeOpen(false)} />}
      <Toast toasts={toasts} />
    </div>
  );
}
