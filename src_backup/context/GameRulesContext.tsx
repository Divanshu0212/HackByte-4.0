import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { RuleManifest } from '../types';
import { compileRuleManifest } from '../services/groq';

type GameRulesValue = {
  ruleManifest: RuleManifest | null;
  rawDescription: string;
  /** Linear mode when user skipped rules */
  isLinearDefault: boolean;
  setFromCompiled: (manifest: RuleManifest | null, description: string) => void;
  compileFromText: (text: string) => Promise<RuleManifest>;
  clear: () => void;
};

const GameRulesContext = createContext<GameRulesValue | null>(null);

export function GameRulesProvider({ children }: { children: ReactNode }) {
  const [ruleManifest, setRuleManifest] = useState<RuleManifest | null>(null);
  const [rawDescription, setRawDescription] = useState('');
  const [isLinearDefault, setIsLinearDefault] = useState(false);

  const setFromCompiled = useCallback(
    (manifest: RuleManifest | null, description: string) => {
      setRuleManifest(manifest);
      setRawDescription(description);
      setIsLinearDefault(manifest == null && description.length === 0);
    },
    [],
  );

  const compileFromText = useCallback(async (text: string) => {
    const manifest = await compileRuleManifest(text);
    setRuleManifest(manifest);
    setRawDescription(text);
    setIsLinearDefault(false);
    return manifest;
  }, []);

  const clear = useCallback(() => {
    setRuleManifest(null);
    setRawDescription('');
    setIsLinearDefault(false);
  }, []);

  const value = useMemo(
    () => ({
      ruleManifest,
      rawDescription,
      isLinearDefault,
      setFromCompiled,
      compileFromText,
      clear,
    }),
    [
      ruleManifest,
      rawDescription,
      isLinearDefault,
      setFromCompiled,
      compileFromText,
      clear,
    ],
  );

  return (
    <GameRulesContext.Provider value={value}>{children}</GameRulesContext.Provider>
  );
}

export function useGameRules() {
  const v = useContext(GameRulesContext);
  if (!v) throw new Error('useGameRules outside provider');
  return v;
}
