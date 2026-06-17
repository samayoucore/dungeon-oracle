import { useEffect } from 'react';
import { motion } from 'framer-motion';
import type { ComponentType } from 'react';
import { useGameStore } from './store/gameStore';
import { loadUnlockedAchievements } from './utils/achievements';
import type { GameScreen as ScreenId } from './types';
import TitleScreen from './components/screens/TitleScreen';
import SettingsScreen from './components/screens/SettingsScreen';
import CharacterCreationScreen from './components/screens/CharacterCreationScreen';
import GameScreen from './components/screens/GameScreen';
import GameOverScreen from './components/screens/GameOverScreen';

/** Maps each screen id to its top-level component. */
const SCREENS: Record<ScreenId, ComponentType> = {
  title: TitleScreen,
  settings: SettingsScreen,
  'character-creation': CharacterCreationScreen,
  game: GameScreen,
  'game-over': GameOverScreen,
};

/**
 * Root router. Each screen is a keyed motion.div that fades/rises in on mount.
 *
 * We deliberately avoid wrapping this in AnimatePresence with `mode="wait"`.
 * Several screens (the title's menu/saves toggle, the creation-wizard steps)
 * contain their OWN nested AnimatePresence, which reports "safe to remove" to
 * its own presence context rather than the outer one. An outer mode="wait"
 * exit can then intermittently never complete, freezing navigation on a
 * now-invisible screen. Remounting via `key` gives a reliable enter transition
 * with no exit-completion dependency.
 */
export default function App() {
  const screen = useGameStore((state) => state.screen);
  const setUnlockedAchievements = useGameStore((state) => state.setUnlockedAchievements);
  const Screen = SCREENS[screen];

  // Mirror globally-persisted achievements into the store once on startup.
  useEffect(() => {
    setUnlockedAchievements(loadUnlockedAchievements());
  }, [setUnlockedAchievements]);

  return (
    <motion.div
      key={screen}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen"
    >
      <Screen />
    </motion.div>
  );
}
