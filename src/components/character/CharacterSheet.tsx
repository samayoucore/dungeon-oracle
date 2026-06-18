import { useState } from 'react';
import type { ReactNode } from 'react';
import { Award, Coins, Shield, Zap } from 'lucide-react';
import type { Character, StatusEffect } from '../../types';
import { CLASS_BY_ID, RACE_BY_ID, STATS_INFO } from '../../engine/character/data';
import { formatModifier } from '../../engine/character/creation';
import { STATUS_EFFECT_META } from '../../engine/combat/statusLabels';
import Portrait from '../ui/Portrait';

interface CharacterSheetProps {
  character: Character;
}

function CombatStat({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-md border border-white/10 bg-dungeon/55 py-2">
      <span className="text-gold">{icon}</span>
      <span className="text-lg font-bold text-parchment">{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-muted">{label}</span>
    </div>
  );
}

/** Left-panel hero summary: identity, HP/XP bars, combat stats, abilities, status. */
export default function CharacterSheet({ character }: CharacterSheetProps) {
  const [selectedEffect, setSelectedEffect] = useState<StatusEffect | null>(null);
  const hpPct = character.maxHp > 0 ? (character.hp / character.maxHp) * 100 : 0;
  const xpPct = character.xpToNext > 0 ? Math.min(100, (character.xp / character.xpToNext) * 100) : 0;
  const hpColor =
    hpPct > 60 ? 'bg-[#16a34a]' : hpPct >= 30 ? 'bg-[#ca8a04]' : 'bg-danger animate-pulse';

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gold/25 bg-surface-elevated shadow-lg shadow-black/25">
          <Portrait seed={character.name + character.race + character.class} roleOrClass={character.class} race={character.race} size={64} />
        </div>
        <div className="min-w-0">
          <div className="truncate font-serif text-xl text-parchment">{character.name}</div>
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
            <div key={info.key} className="rounded-md border border-white/10 bg-dungeon/55 p-2 text-center">
              <div className="text-[10px] uppercase text-muted">{info.abbr}</div>
              <div className="text-base font-bold text-parchment">{character.stats[info.key]}</div>
              <div className={`text-xs ${mod >= 0 ? 'text-gold' : 'text-danger'}`}>{formatModifier(mod)}</div>
            </div>
          );
        })}
      </div>

      {character.statusEffects.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            {character.statusEffects.map((effect, index) => {
              const meta = STATUS_EFFECT_META[effect.type];
              const selected = selectedEffect?.type === effect.type;
              return (
                <button
                  key={`${effect.type}-${index}`}
                  type="button"
                  onClick={() => setSelectedEffect(selected ? null : effect)}
                  className={`flex items-center gap-1 rounded-full border px-2 py-1 text-xs text-parchment transition-colors ${
                    selected ? 'border-gold bg-gold/10 text-gold' : 'border-surface-elevated hover:border-gold'
                  }`}
                >
                  <span>{meta.icon}</span>
                  <span>{meta.label}</span>
                  <span className="text-muted">{effect.duration} х.</span>
                </button>
              );
            })}
          </div>
          {selectedEffect && (
            <div className="rounded-md border border-gold/25 bg-dungeon/55 p-3 text-sm">
              <div className="font-serif text-base text-gold">{STATUS_EFFECT_META[selectedEffect.type].label}</div>
              <p className="mt-1 text-xs leading-relaxed text-parchment/85">{STATUS_EFFECT_META[selectedEffect.type].description}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted">{STATUS_EFFECT_META[selectedEffect.type].mechanics}</p>
              {selectedEffect.magnitude !== undefined && <p className="mt-2 text-xs text-gold">Сила эффекта: {selectedEffect.magnitude}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
