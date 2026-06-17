import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import {
  checkCombatEnd,
  playerAttack,
  playerDodge,
  playerFlee,
  playerUseItem,
  resolveEnemyTurns,
} from '../../engine/combat/system';
import type { Character, Item } from '../../types';
import type { AttackRoll } from '../../engine/combat/dice';
import DiceRoller from './DiceRoller';
import type { DiceOutcome } from './DiceRoller';
import TurnOrderList from './TurnOrderList';
import CombatActions from './CombatActions';
import { useSound } from '../../hooks/useSound';

interface CombatPanelProps {
  onVictory: () => void;
}

interface DiceState {
  sides: number;
  result: number;
  outcome?: DiceOutcome;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Derive the player's weapon profile from the first weapon in their pack. */
function getWeapon(inventory: Item[], character: Character) {
  const stats = inventory.find((i) => i.type === 'weapon' && i.weaponStats)?.weaponStats;
  const ability = stats?.finesse
    ? Math.max(character.modifiers.str, character.modifiers.dex)
    : character.modifiers.str;
  const dice = stats?.damageDice ?? 'd4';
  const count = stats?.damageCount ?? 1;
  const bonus = (stats?.damageBonus ?? 0) + ability;
  return {
    damage: `${count}d${dice.slice(1)}${bonus >= 0 ? `+${bonus}` : `${bonus}`}`,
    attackBonus: character.proficiencyBonus + ability,
    sides: parseInt(dice.slice(1), 10),
  };
}

function outcomeOf(roll: AttackRoll): DiceOutcome {
  if (roll.isCrit) return 'crit';
  if (roll.isCritFail) return 'fail';
  return roll.isHit ? 'hit' : 'miss';
}

/** Bottom combat overlay: drives the turn loop and applies results to the store. */
export default function CombatPanel({ onVictory }: CombatPanelProps) {
  const combat = useGameStore((s) => s.combat);
  const character = useGameStore((s) => s.character);
  const inventory = useGameStore((s) => s.inventory);
  const damageEnemy = useGameStore((s) => s.damageEnemy);
  const addCombatLog = useGameStore((s) => s.addCombatLog);
  const addNarrative = useGameStore((s) => s.addNarrative);
  const updateHp = useGameStore((s) => s.updateHp);
  const removeItem = useGameStore((s) => s.removeItem);
  const nextCombatRound = useGameStore((s) => s.nextCombatRound);
  const endCombat = useGameStore((s) => s.endCombat);
  const { play } = useSound();

  const [busy, setBusy] = useState(false);
  const [dice, setDice] = useState<DiceState | null>(null);
  const [activeId, setActiveId] = useState('player');
  const isDodgingRef = useRef(false);

  if (!combat || !character) return null;

  const logBoth = (text: string) => {
    addCombatLog(text);
    addNarrative(text, 'combat');
  };

  async function runEnemyPhase() {
    const living = useGameStore.getState().combat?.enemies.filter((e) => e.hp > 0) ?? [];
    const char = useGameStore.getState().character;
    if (!char) return setBusy(false);
    const results = resolveEnemyTurns(living, char, isDodgingRef.current);

    for (let i = 0; i < results.length; i += 1) {
      const result = results[i];
      setActiveId(living[i].id);
      await wait(300);
      if (result.attackRoll) {
        setDice({ sides: 20, result: result.attackRoll.d20, outcome: outcomeOf(result.attackRoll) });
        play('dice_roll');
        await wait(700);
      }
      if (result.killedEnemyId) damageEnemy(result.killedEnemyId, 9999);
      if (result.damageTaken > 0) {
        updateHp(-result.damageTaken);
        play('player_hurt');
      } else if (result.damageTaken !== 0) {
        updateHp(-result.damageTaken);
      }
      logBoth(result.narrative);
      setDice(null);
      if ((useGameStore.getState().character?.hp ?? 0) <= 0) return;
      await wait(250);
    }

    const after = useGameStore.getState();
    if (after.combat && after.character && checkCombatEnd(after.combat.enemies, after.character).playerWon) {
      return onVictory();
    }
    isDodgingRef.current = false;
    nextCombatRound();
    setActiveId('player');
    setBusy(false);
  }

  async function afterPlayerAction() {
    const state = useGameStore.getState();
    if (!state.combat || !state.character) return setBusy(false);
    const end = checkCombatEnd(state.combat.enemies, state.character);
    if (end.ended) {
      if (end.playerWon) onVictory();
      return setBusy(false);
    }
    await runEnemyPhase();
  }

  async function doAttack(targetId: string) {
    const state = useGameStore.getState();
    const target = state.combat?.enemies.find((e) => e.id === targetId);
    if (!state.character || !target || target.hp <= 0) return;
    setBusy(true);
    const weapon = getWeapon(state.inventory, state.character);
    const result = playerAttack(state.character, target, weapon.damage, weapon.attackBonus);
    if (result.attackRoll) {
      const outcome = outcomeOf(result.attackRoll);
      setDice({ sides: 20, result: result.attackRoll.d20, outcome });
      play('dice_roll');
      await wait(700);
      play(outcome === 'crit' ? 'critical_hit' : outcome === 'hit' ? 'attack_hit' : 'attack_miss');
    }
    if (result.damageDealt > 0) {
      setDice({ sides: weapon.sides, result: result.damageDealt });
      damageEnemy(targetId, result.damageDealt);
      await wait(600);
    }
    logBoth(result.narrative);
    if (result.killedEnemyId) play('enemy_death');
    if (result.healToPlayer) {
      updateHp(result.healToPlayer);
      logBoth(`Ты восстанавливаешь ${result.healToPlayer} HP.`);
    }
    setDice(null);
    await wait(150);
    await afterPlayerAction();
  }

  async function doDodge() {
    setBusy(true);
    const char = useGameStore.getState().character;
    if (char) logBoth(playerDodge(char).narrative);
    isDodgingRef.current = true;
    await wait(450);
    await afterPlayerAction();
  }

  async function doFlee() {
    setBusy(true);
    const state = useGameStore.getState();
    if (!state.character) return setBusy(false);
    const result = playerFlee(state.character);
    logBoth(result.narrative);
    await wait(500);
    if (result.combatEnded) return endCombat();
    await afterPlayerAction();
  }

  async function doUseItem(itemId: string) {
    setBusy(true);
    const state = useGameStore.getState();
    const item = state.inventory.find((i) => i.id === itemId);
    if (!state.character || !item) return setBusy(false);
    const result = playerUseItem(state.character, item);
    if (result.damageTaken < 0) {
      updateHp(-result.damageTaken);
      removeItem(itemId);
    }
    logBoth(result.narrative);
    await wait(500);
    await afterPlayerAction();
  }

  return (
    <motion.div
      initial={{ y: 300 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      className="fixed inset-x-0 bottom-0 z-50 grid h-[280px] grid-cols-[minmax(130px,1fr)_2fr_minmax(110px,1fr)] gap-3 overflow-hidden border-t border-danger/30 bg-dungeon p-4 shadow-[0_-8px_30px_rgba(0,0,0,0.5)]"
    >
      <div className="overflow-y-auto">
        <TurnOrderList combat={combat} character={character} activeId={activeId} />
      </div>
      <CombatActions
        combat={combat}
        inventory={inventory}
        isPlayerTurn={activeId === 'player'}
        busy={busy}
        lastLog={combat.log[combat.log.length - 1]?.text ?? ''}
        onAttack={doAttack}
        onDodge={doDodge}
        onFlee={doFlee}
        onUseItem={doUseItem}
      />
      <div className="flex items-center justify-center">
        <DiceRoller result={dice?.result ?? null} sides={dice?.sides ?? 20} outcome={dice?.outcome} />
      </div>
    </motion.div>
  );
}
