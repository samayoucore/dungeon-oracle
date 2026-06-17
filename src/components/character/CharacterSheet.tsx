import type { ReactNode } from 'react';
import { Award, Coins, Shield, Zap } from 'lucide-react';
import type { Character, StatusEffectType } from '../../types';
import { CLASS_BY_ID, RACE_BY_ID, STATS_INFO } from '../../engine/character/data';
import { formatModifier } from '../../engine/character/creation';
import Portrait from '../ui/Portrait';

interface CharacterSheetProps {
  character: Character;
}

const STATUS_EMOJI: Record<StatusEffectType, string> = {
  poisoned: '🐍',
  stunned: '⚡',
  burning: '🔥',
  bleeding: '🩸',
  frightened: '😱',
  blinded: '🚫',
  blessed: '✨',
  hasted: '💨',
};

function CombatStat({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-md bg-dungeon/60 py-2">
      <span className="text-gold">{icon}</span>
      <span className="text-lg font-bold text-parchment">{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-muted">{label}</span>
    </div>
  );
}

/** Left-panel hero summary: identity, HP/XP bars, combat stats, abilities, status. */
export default function CharacterSheet({ character }: CharacterSheetProps) {
  const hpPct = character.maxHp > 0 ? (character.hp / character.maxHp) * 100 : 0;
  const xpPct = character.xpToNext > 0 ? Math.min(100, (character.xp / character.xpToNext) * 100) : 0;
  const hpColor =
    hpPct > 60 ? 'bg-[#16a34a]' : hpPct >= 30 ? 'bg-[#ca8a04]' : 'bg-danger animate-pulse';

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-elevated">
          <Portrait seed={character.name + character.race + character.class} roleOrClass={character.class} size={48} />
        </div>
        <div className="min-w-0">
          <div className="truncate font-serif text-lg text-parchment">{character.name}</div>
          <div className="text-xs text-muted">
            Ур.{character.level} · {RACE_BY_ID[character.race].name} {CLASS_BY_ID[character.class].name}
          </div>
          <div className="flex items-center gap-1 text-xs text-gold">
            <Coins className="h-3 w-3" /> {character.gold} зол.
          </div>
        </div>
      </div>

      <div>
        <div className="mb-1 flex justify-between text-xs">
          <span className="text-muted">HP</span>
          <span className="text-parchment">{character.hp} / {character.maxHp}</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-dungeon">
          <div className={`h-full rounded-full transition-all duration-500 ${hpColor}`} style={{ width: `${hpPct}%` }} />
        </div>
      </div>

      <div>
        <div className="mb-1 flex justify-between text-xs text-muted">
          <span>Опыт</span>
          <span>{character.xp} / {character.xpToNext}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-dungeon">
          <div className="h-full rounded-full bg-gold transition-all duration-500" style={{ width: `${xpPct}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <CombatStat icon={<Shield className="h-4 w-4" />} value={`${character.ac}`} label="КБ" />
        <CombatStat icon={<Zap className="h-4 w-4" />} value={formatModifier(character.modifiers.dex)} label="Иниц" />
        <CombatStat icon={<Award className="h-4 w-4" />} value={formatModifier(character.proficiencyBonus)} label="Влад" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {STATS_INFO.map((info) => {
          const mod = character.modifiers[info.key];
          return (
            <div key={info.key} className="rounded-md bg-dungeon/60 p-2 text-center">
              <div className="text-[10px] uppercase text-muted">{info.abbr}</div>
              <div className="text-base font-bold text-parchment">{character.stats[info.key]}</div>
              <div className={`text-xs ${mod >= 0 ? 'text-gold' : 'text-danger'}`}>{formatModifier(mod)}</div>
            </div>
          );
        })}
      </div>

      {character.statusEffects.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {character.statusEffects.map((effect, index) => (
            <span
              key={`${effect.type}-${index}`}
              className="flex items-center gap-1 rounded-full border border-surface-elevated px-2 py-0.5 text-xs capitalize text-parchment"
            >
              {STATUS_EMOJI[effect.type]} {effect.type}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
