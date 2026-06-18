import { useState } from 'react';
import { hasAnySave } from '../../utils/save';
import MainMenu from './title/MainMenu';
import ParticleField from './title/ParticleField';
import SaveSlotList from './title/SaveSlotList';

type TitleView = 'menu' | 'saves';

/** Soft radial darkening toward the screen edges (complex gradient -> inline style). */
function Vignette() {
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{
        background:
          'radial-gradient(circle at center, transparent 35%, rgba(0,0,0,0.75) 100%)',
      }}
    />
  );
}

/** Landing screen: animated menu with an in-place save-selection view. */
export default function TitleScreen() {
  const [view, setView] = useState<TitleView>('menu');
  const [hasSaves, setHasSaves] = useState<boolean>(() => hasAnySave());

  const openSaves = () => {
    setHasSaves(hasAnySave());
    setView('saves');
  };

  const backToMenu = () => {
    setHasSaves(hasAnySave());
    setView('menu');
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6">
      <ParticleField />
      <Vignette />

      <div className="relative z-10 flex w-full flex-col items-center">
        {/* Keyed remount (not AnimatePresence) keeps the menu/saves swap reliable. */}
        {view === 'menu' ? (
          <MainMenu hasSaves={hasSaves} onContinue={openSaves} />
        ) : (
          <SaveSlotList onBack={backToMenu} />
        )}
      </div>

      <footer className="absolute bottom-4 z-10 text-xs text-muted/50">
        v 1.0.0
      </footer>
    </main>
  );
}
