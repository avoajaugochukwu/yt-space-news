'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

export type ContentMode = 'hype' | 'lowkey';

interface SettingsContextType {
  mode: ContentMode;
  setMode: (mode: ContentMode) => void;
  toggleMode: () => void;
}

const SETTINGS_STORAGE_KEY = 'gfpd-settings';

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ContentMode>(() => {
    if (typeof window === 'undefined') return 'hype';
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.mode || 'hype';
      }
    } catch {
      // Ignore parse errors
    }
    return 'hype';
  });

  // Persist settings to localStorage on every change
  useEffect(() => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ mode }));
  }, [mode]);

  const setMode = useCallback((newMode: ContentMode) => {
    setModeState(newMode);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState(prev => prev === 'hype' ? 'lowkey' : 'hype');
  }, []);

  return (
    <SettingsContext.Provider value={{ mode, setMode, toggleMode }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
