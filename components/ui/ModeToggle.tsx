'use client';

import { useSettings } from '@/lib/settings-context';

export function ModeToggle() {
  const { mode, toggleMode } = useSettings();

  return (
    <button
      onClick={toggleMode}
      className={`
        flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-mono
        transition-all border cursor-pointer
        ${mode === 'hype'
          ? 'bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30'
          : 'bg-blue-500/20 border-blue-500/50 text-blue-400 hover:bg-blue-500/30'
        }
      `}
      title={mode === 'hype' ? 'Switch to Low-Key Mode' : 'Switch to Hype Mode'}
    >
      <span className={`w-2 h-2 rounded-full ${mode === 'hype' ? 'bg-red-400 animate-pulse' : 'bg-blue-400'}`} />
      {mode === 'hype' ? 'HYPE' : 'LOW-KEY'}
    </button>
  );
}
