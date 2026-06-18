import type { Location } from '../../types';
import { LOCATION_ICON, LOCATION_LABEL } from './locationMeta';

interface LocationInfoProps {
  location: Location;
}

/** Summary of the current location: name, type, threats, loot and lore. */
export default function LocationInfo({ location }: LocationInfoProps) {
  const living = location.enemiesPresent.filter((e) => e.hp > 0);
  const itemCount = location.itemsPresent.length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-lg">{LOCATION_ICON[location.type]}</span>
        <div>
          <h3 className="font-serif text-lg text-gold">{location.name}</h3>
          <p className="text-xs capitalize text-muted">{LOCATION_LABEL[location.type]}</p>
        </div>
      </div>

      <p className="text-sm text-muted">Опасность: <span className="text-parchment">{location.dangerLevel ?? 1}</span></p>
      {location.isSafeZone && <p className="text-sm text-green-400">🛡 Безопасная зона</p>}
      {living.length > 0 && <p className="text-sm text-danger">⚔ Противников рядом: {living.length}</p>}
      {itemCount > 0 && <p className="text-sm text-gold">📦 Предметов: {itemCount}</p>}
      {location.lore && <p className="text-xs italic leading-relaxed text-muted">{location.lore}</p>}
    </div>
  );
}
