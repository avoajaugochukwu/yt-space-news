'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import type {
  WorkflowState,
  WorkflowPhase,
  StoryCard,
  IntelligenceBriefing,
  PackagingResult,
  TitleOption,
  HookResult,
  HookVariation,
  ScriptOutline,
  GeneratedScript,
} from '@/types';

interface WorkflowContextType extends WorkflowState {
  setPhase: (phase: WorkflowPhase) => void;
  selectStory: (story: StoryCard) => void;
  setBriefing: (briefing: IntelligenceBriefing) => void;
  setPackaging: (packaging: PackagingResult) => void;
  selectTitle: (title: TitleOption) => void;
  setHookResult: (result: HookResult) => void;
  selectHook: (hook: HookVariation) => void;
  setOutline: (outline: ScriptOutline) => void;
  setScript: (script: GeneratedScript) => void;
  reset: () => void;
  canAdvance: (toPhase: WorkflowPhase) => boolean;
}

const initialState: WorkflowState = {
  currentPhase: 'radar',
  selectedStory: null,
  briefing: null,
  packaging: null,
  selectedTitle: null,
  hookResult: null,
  selectedHook: null,
  outline: null,
  script: null,
};

const WorkflowContext = createContext<WorkflowContextType | null>(null);

const STORAGE_KEY = 'gfpd-workflow-state';

export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WorkflowState>(() => {
    if (typeof window === 'undefined') return initialState;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : initialState;
    } catch {
      return initialState;
    }
  });

  // Persist state to localStorage on every change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const setPhase = useCallback((phase: WorkflowPhase) => {
    setState((prev) => ({ ...prev, currentPhase: phase }));
  }, []);

  const selectStory = useCallback((story: StoryCard) => {
    setState((prev) => ({
      ...prev,
      selectedStory: story,
      currentPhase: 'briefing',
      // Reset downstream state
      briefing: null,
      packaging: null,
      selectedTitle: null,
      hookResult: null,
      selectedHook: null,
      outline: null,
      script: null,
    }));
  }, []);

  const setBriefing = useCallback((briefing: IntelligenceBriefing) => {
    setState((prev) => ({ ...prev, briefing }));
  }, []);

  const setPackaging = useCallback((packaging: PackagingResult) => {
    setState((prev) => ({
      ...prev,
      packaging,
      currentPhase: 'packaging',
    }));
  }, []);

  const selectTitle = useCallback((title: TitleOption) => {
    setState((prev) => ({
      ...prev,
      selectedTitle: title,
      currentPhase: 'hook',
      // Reset downstream state
      hookResult: null,
      selectedHook: null,
      outline: null,
      script: null,
    }));
  }, []);

  const setHookResult = useCallback((hookResult: HookResult) => {
    setState((prev) => ({ ...prev, hookResult }));
  }, []);

  const selectHook = useCallback((hook: HookVariation) => {
    setState((prev) => ({
      ...prev,
      selectedHook: hook,
      currentPhase: 'outline',
      // Reset downstream state
      outline: null,
      script: null,
    }));
  }, []);

  const setOutline = useCallback((outline: ScriptOutline) => {
    setState((prev) => ({
      ...prev,
      outline,
      currentPhase: 'script',
    }));
  }, []);

  const setScript = useCallback((script: GeneratedScript) => {
    setState((prev) => ({ ...prev, script }));
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState(initialState);
  }, []);

  const canAdvance = useCallback(
    (toPhase: WorkflowPhase): boolean => {
      switch (toPhase) {
        case 'radar':
          return true;
        case 'briefing':
          return state.selectedStory !== null;
        case 'packaging':
          return state.selectedStory !== null;
        case 'hook':
          return state.selectedTitle !== null;
        case 'outline':
          return state.selectedHook !== null;
        case 'script':
          return state.outline !== null;
        default:
          return false;
      }
    },
    [state]
  );

  return (
    <WorkflowContext.Provider
      value={{
        ...state,
        setPhase,
        selectStory,
        setBriefing,
        setPackaging,
        selectTitle,
        setHookResult,
        selectHook,
        setOutline,
        setScript,
        reset,
        canAdvance,
      }}
    >
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflow() {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error('useWorkflow must be used within a WorkflowProvider');
  }
  return context;
}
