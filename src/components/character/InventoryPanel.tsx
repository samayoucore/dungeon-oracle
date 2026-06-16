import { useMemo, useState } from 'react';
import type { EquipmentSlot, Item } from '../../types';
import { useGameStore } from '../../store/gameStore';
import { roll } from '../../engine/combat/dice';
import { RARITY_DOT } from './itemMeta';
import ItemTooltip from './ItemTooltip';

const SLOTS: { slot: EquipmentSlot; label: string; icon: string }[] = [
  { slot: 'head', label: 'Голова', icon: '🪖' },
  { slot: 'amulet', label: 'Амулет', icon: '📿' },
  { slot: 'body', label: 'Тело', icon: '👘' },
  { slot: 'ring1', label: 'Кольцо', icon: '💍' },
  { slot: 'hands', label: 'Руки', icon: '🧤' },
  { slot: 'ring2', label: 'Кольцо', icon: '💍' },
  { slot: 'legs', label: 'Ноги', icon: '👢' },
  { slot: 'mainHand', label: 'Осн.', icon: '⚔️' },
  { slot: 'offHand', label: 'Доп.', icon: '🛡' },
];

interface Selected {
  item: Item;
  equipped: boolean;
  slot?: EquipmentSlot;
}

/** Equipment slots + bag grid with equip/use/drop and an encumbrance bar. */
export default function InventoryPanel() {
  const character = useGameStore((s) => s.character);
  const inventory = useGameStore((s) => s.inventory);
  const equipped = useGameStore((s) => s.equipped);
  const equipItem = useGameStore((s) => s.equipItem);
  const unequipItem = useGameStore((s) => s.unequipItem);
  const removeItem = useGameStore((s) => s.removeItem);
  const updateHp = useGameStore((s) => s.updateHp);
  const addNarrative = useGameStore((s) => s.addNarrative);
  const [selected, setSelected] = useState<Selected | null>(null);

  const weight = useMemo(() => {
    const bag = inventory.reduce((sum, item) => sum + item.weight * (item.quantity ?? 1), 0);
    const worn = SLOTS.reduce((sum, { slot }) => sum + (equipped[slot]?.weight ?? 0), 0);
    return bag + worn;
  }, [inventory, equipped]);

  if (!character) return null;
  const maxWeight = character.stats.str * 15;
  const weightPct = maxWeight > 0 ? Math.min(100, (weight / maxWeight) * 100) : 0;

  const useItem = (item: Item) => {
    const potion = item.potionEffect;
    if (potion?.effect === 'heal') {
      const healed = roll(`${potion.diceCount ?? 1}d${(potion.diceType ?? 'd4').slice(1)}+${potion.bonus ?? 0}`);
      updateHp(healed);
      addNarrative(`Ты выпиваешь ${item.name} и восстанавливаешь ${healed} HP.`, 'loot');
    }
    removeItem(item.id);
    setSelected(null);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Снаряжение</h3>
        <div className="grid grid-cols-2 gap-2">
          {SLOTS.map(({ slot, label, icon }) => {
            const item = equipped[slot];
            return (
              <button
                key={slot}
                type="button"
                title={item ? item.name : label}
                onClick={() => item && setSelected({ item, equipped: true, slot })}
                className={`flex items-center gap-2 rounded-md border p-2 text-left ${item ? 'border-gold/40 bg-surface' : 'border-surface-elevated bg-surface-elevated/40'}`}
              >
                <span className={`text-xl ${item ? '' : 'opacity-30'}`}>{item ? item.icon : icon}</span>
                <span className="truncate text-[11px] text-muted">{item ? item.name : label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Сумка ({inventory.length})</h3>
        {inventory.length === 0 ? (
          <p className="text-xs text-muted">Сумка пуста.</p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {inventory.map((item) => (
              <button
                key={item.id}
                type="button"
                title={item.name}
                onClick={() => setSelected({ item, equipped: false })}
                className="relative flex aspect-square items-center justify-center rounded-md border border-surface-elevated bg-surface text-2xl transition-colors hover:border-gold"
              >
                {item.icon}
                {(item.quantity ?? 1) > 1 && (
                  <span className="absolute right-0.5 top-0.5 rounded-full bg-surface-elevated px-1 text-[10px] font-semibold leading-tight text-parchment">
                    ×{item.quantity}
                  </span>
                )}
                <span className={`absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full ${RARITY_DOT[item.rarity]}`} />
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <ItemTooltip
          item={selected.item}
          equipped={selected.equipped}
          onEquip={() => { equipItem(selected.item); setSelected(null); }}
          onUnequip={() => { if (selected.slot) unequipItem(selected.slot); setSelected(null); }}
          onUse={() => useItem(selected.item)}
          onDrop={() => { removeItem(selected.item.id); setSelected(null); }}
          onClose={() => setSelected(null)}
        />
      )}

      <div className="mt-auto">
        <div className="mb-1 flex justify-between text-[11px] text-muted">
          <span>Вес</span>
          <span>{weight.toFixed(0)} / {maxWeight} фнт</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-dungeon">
          <div className={`h-full rounded-full transition-all ${weightPct > 80 ? 'bg-danger' : 'bg-gold'}`} style={{ width: `${weightPct}%` }} />
        </div>
      </div>
    </div>
  );
}
