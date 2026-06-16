import type { Item } from '../../types';
import { equipmentSlotFor } from '../../engine/character/equipment';
import { RARITY_RU, RARITY_TEXT, TYPE_RU } from './itemMeta';

interface ItemTooltipProps {
  item: Item;
  equipped: boolean;
  onEquip: () => void;
  onUnequip: () => void;
  onUse: () => void;
  onDrop: () => void;
  onClose: () => void;
}

function statLine(item: Item): string | null {
  if (item.weaponStats) {
    const w = item.weaponStats;
    return `${w.damageCount}к${w.damageDice.slice(1)}${w.damageBonus ? `+${w.damageBonus}` : ''} урона`;
  }
  if (item.armorStats) {
    return item.type === 'shield' ? `+${item.armorStats.baseAc} КБ` : `КБ ${item.armorStats.baseAc}`;
  }
  if (item.potionEffect?.effect === 'heal') {
    const p = item.potionEffect;
    return `Лечит ${p.diceCount ?? 1}к${(p.diceType ?? 'd4').slice(1)}${p.bonus ? `+${p.bonus}` : ''} HP`;
  }
  return null;
}

function TooltipButton({ label, onClick, variant }: { label: string; onClick: () => void; variant: 'primary' | 'ghost' | 'danger' }) {
  const cls =
    variant === 'primary'
      ? 'bg-gold text-dungeon'
      : variant === 'danger'
        ? 'border border-danger/50 text-danger'
        : 'border border-surface-elevated text-parchment';
  return (
    <button type="button" onClick={onClick} className={`rounded px-3 py-1 text-xs font-medium transition-opacity hover:opacity-90 ${cls}`}>
      {label}
    </button>
  );
}

/** Item detail popover with equip / use / drop actions. */
export default function ItemTooltip({ item, equipped, onEquip, onUnequip, onUse, onDrop, onClose }: ItemTooltipProps) {
  const canEquip = !equipped && equipmentSlotFor(item) !== null;
  const canUse = !equipped && item.type === 'potion';
  const line = statLine(item);

  return (
    <div className="rounded-lg border border-gold/30 bg-surface-elevated p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className={`font-serif text-base ${RARITY_TEXT[item.rarity]}`}>
            {item.icon} {item.name}
          </div>
          <div className="text-[11px] text-muted">
            {RARITY_RU[item.rarity]} · {TYPE_RU[item.type]} · {item.weight} фнт · {item.value} зол.
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-gold">
          ✕
        </button>
      </div>
      {line && <div className="mt-1 text-xs text-gold">{line}</div>}
      <p className="mt-1 text-xs leading-relaxed text-parchment/80">{item.description}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {equipped && <TooltipButton label="Снять" onClick={onUnequip} variant="ghost" />}
        {canEquip && <TooltipButton label="Надеть" onClick={onEquip} variant="primary" />}
        {canUse && (
          <TooltipButton
            label={(item.quantity ?? 1) > 1 ? `Использовать (1 из ${item.quantity})` : 'Использовать'}
            onClick={onUse}
            variant="primary"
          />
        )}
        {!equipped && <TooltipButton label="Выбросить" onClick={onDrop} variant="danger" />}
      </div>
    </div>
  );
}
