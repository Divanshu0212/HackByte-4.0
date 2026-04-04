import { useCallback, useReducer, useRef, useState } from 'react';
import type { LiveState } from '../types';

export interface StateCommand {
  /** Human-readable label for debugging */
  label: string;
  apply: (s: LiveState) => LiveState;
  revert: (s: LiveState) => LiveState;
}

function cloneState(s: LiveState): LiveState {
  return structuredClone(s);
}

/**
 * Command pattern undo/redo — stores inverse patches, not full mementos.
 */
export function useUndoRedo(initialState: LiveState) {
  const [state, setState] = useState<LiveState>(() => cloneState(initialState));
  const past = useRef<StateCommand[]>([]);
  const future = useRef<StateCommand[]>([]);
  const [, bump] = useReducer((n: number) => n + 1, 0);

  const executeCommand = useCallback((cmd: StateCommand) => {
    setState((prev) => {
      const next = cmd.apply(cloneState(prev));
      past.current.push(cmd);
      future.current = [];
      return next;
    });
    bump();
  }, []);

  const undo = useCallback(() => {
    const cmd = past.current.pop();
    if (!cmd) return;
    setState((prev) => {
      const next = cmd.revert(cloneState(prev));
      future.current.push(cmd);
      return next;
    });
    bump();
  }, []);

  const redo = useCallback(() => {
    const cmd = future.current.pop();
    if (!cmd) return;
    setState((prev) => {
      const next = cmd.apply(cloneState(prev));
      past.current.push(cmd);
      return next;
    });
    bump();
  }, []);

  const reset = useCallback((next: LiveState) => {
    past.current = [];
    future.current = [];
    setState(cloneState(next));
    bump();
  }, []);

  return {
    state,
    setState,
    executeCommand,
    undo,
    redo,
    reset,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}
