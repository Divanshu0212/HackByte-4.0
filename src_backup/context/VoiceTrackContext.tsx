import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { LiveState } from '../types';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { interpretVoiceCommand } from '../services/groq';
import { persistSessionSnapshot } from '../services/persist';
import { voiceResponseToCommand } from '../dispatcher/applyVoiceActions';
import { matchPattern } from '../dispatcher/patternMatcher';
import { useGameRules } from './GameRulesContext';

export const defaultLiveState = (): LiveState => ({
  participants: [],
  scoring_mode: 'numeric',
  round: 1,
  timer: { state: 'idle' },
  suddenDeath: false,
});

type VoiceTrackCtx = {
  state: LiveState;
  sessionStarted: boolean;
  setSessionStarted: (v: boolean) => void;
  lastTranscript: string;
  lastAgentTrace: string;
  processing: boolean;
  stagedCommentaryRef: React.MutableRefObject<string | null>;
  layoutGenerationRef: React.MutableRefObject<number>;
  onRootLayoutComplete: () => void;
  scheduleCommentarySpeak: (text: string | null) => void;
  runTranscript: (text: string) => Promise<void>;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  resetSessionState: () => void;
  importLiveState: (s: LiveState) => void;
};

const Ctx = createContext<VoiceTrackCtx | null>(null);

export function VoiceTrackProvider({ children }: { children: ReactNode }) {
  const { ruleManifest, rawDescription } = useGameRules();
  const {
    state,
    executeCommand,
    undo,
    redo,
    reset,
    canUndo,
    canRedo,
  } = useUndoRedo(defaultLiveState());

  const [sessionStarted, setSessionStarted] = useState(false);
  const [lastTranscript, setLastTranscript] = useState('');
  const [lastAgentTrace, setLastAgentTrace] = useState('');
  const [processing, setProcessing] = useState(false);

  const stagedCommentaryRef = useRef<string | null>(null);
  const layoutGenerationRef = useRef(0);
  const speakTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(state);
  const ruleRef = useRef(ruleManifest);
  stateRef.current = state;
  ruleRef.current = ruleManifest;

  const speak = useCallback((text: string) => {
    if (!text.trim() || typeof window.speechSynthesis === 'undefined') return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.1;
    u.onstart = () => document.body.classList.add('voicetrack-speaking');
    u.onend = () => document.body.classList.remove('voicetrack-speaking');
    u.onerror = () => document.body.classList.remove('voicetrack-speaking');
    window.speechSynthesis.speak(u);
  }, []);

  const flushCommentary = useCallback(() => {
    const q = stagedCommentaryRef.current;
    if (q) {
      stagedCommentaryRef.current = null;
      speak(q);
    }
  }, [speak]);

  const onRootLayoutComplete = useCallback(() => {
    if (speakTimeoutRef.current) {
      clearTimeout(speakTimeoutRef.current);
      speakTimeoutRef.current = null;
    }
    flushCommentary();
  }, [flushCommentary]);

  const scheduleCommentarySpeak = useCallback(
    (text: string | null) => {
      if (speakTimeoutRef.current) {
        clearTimeout(speakTimeoutRef.current);
        speakTimeoutRef.current = null;
      }
      if (!text) {
        stagedCommentaryRef.current = null;
        return;
      }
      stagedCommentaryRef.current = text;
      layoutGenerationRef.current += 1;
      speakTimeoutRef.current = setTimeout(() => {
        speakTimeoutRef.current = null;
        flushCommentary();
      }, 520);
    },
    [flushCommentary],
  );

  useEffect(() => {
    if (!sessionStarted) return;
    persistSessionSnapshot(state, ruleManifest, rawDescription);
  }, [state, ruleManifest, rawDescription, sessionStarted]);

  const runTranscript = useCallback(
    async (text: string) => {
      setLastTranscript(text);

      // ===== STEP 1: Try pattern matching first (fast, no LLM) =====
      const patternResult = matchPattern(text, stateRef.current);

      if (patternResult.matched) {
        // Pattern matched! Process locally without LLM call
        console.log('[Elixa] Pattern matched locally:', patternResult.actions);

        const response = {
          thought: 'Pattern matched locally - no LLM call needed',
          observation: `Matched pattern for: "${text}"`,
          actions: patternResult.actions,
          commentary: patternResult.commentary,
        };

        const {
          command,
          commentary,
          systemUndo,
          systemRedo,
        } = voiceResponseToCommand(response);

        const traceWithActions = `Pattern Match (local, instant)\n\nActions: ${JSON.stringify(response.actions, null, 2)}`;
        setLastAgentTrace(traceWithActions);

        if (systemUndo) undo();
        if (systemRedo) redo();
        if (command) executeCommand(command);

        if (commentary?.trim()) {
          scheduleCommentarySpeak(commentary.trim());
        } else {
          scheduleCommentarySpeak(null);
        }

        return;
      }

      // ===== STEP 2: No pattern match - use LLM =====
      setProcessing(true);
      try {
        const response = await interpretVoiceCommand(
          ruleRef.current,
          stateRef.current,
          text,
          rawDescription,
        );
        const trace = [
          response.thought && `Thought: ${response.thought}`,
          response.observation && `Observation: ${response.observation}`,
        ]
          .filter(Boolean)
          .join('\n');

        const {
          command,
          commentary,
          systemUndo,
          systemRedo,
        } = voiceResponseToCommand(response);

        const actionCount = response.actions?.length ?? 0;
        let traceWithActions = `LLM Response (Groq)\n\n${trace}`;
        if (actionCount === 0) {
          traceWithActions += `\n\n(No "actions" in model response — UI will not change.)`;
        } else {
          traceWithActions += `\n\nActions (${actionCount}): ${JSON.stringify(response.actions)}`;
        }
        if (!command && actionCount > 0) {
          traceWithActions += `\n\n⚠️ Actions could not be applied. Check browser console.`;
        }
        setLastAgentTrace(traceWithActions);

        if (systemUndo) undo();
        if (systemRedo) redo();
        if (command) executeCommand(command);

        if (commentary?.trim()) {
          scheduleCommentarySpeak(commentary.trim());
        } else {
          scheduleCommentarySpeak(null);
        }
      } catch (e) {
        console.error(e);
        setLastAgentTrace(`Error: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setProcessing(false);
      }
    },
    [executeCommand, undo, redo, scheduleCommentarySpeak, rawDescription],
  );

  const resetSessionState = useCallback(() => {
    reset(defaultLiveState());
    setLastTranscript('');
    setLastAgentTrace('');
  }, [reset]);

  const importLiveState = useCallback(
    (s: LiveState) => {
      reset(s);
      setLastTranscript('');
      setLastAgentTrace('');
    },
    [reset],
  );

  const value = useMemo(
    () => ({
      state,
      sessionStarted,
      setSessionStarted,
      lastTranscript,
      lastAgentTrace,
      processing,
      stagedCommentaryRef,
      layoutGenerationRef,
      onRootLayoutComplete,
      scheduleCommentarySpeak,
      runTranscript,
      undo,
      redo,
      canUndo,
      canRedo,
      resetSessionState,
      importLiveState,
    }),
    [
      state,
      sessionStarted,
      lastTranscript,
      lastAgentTrace,
      processing,
      onRootLayoutComplete,
      scheduleCommentarySpeak,
      runTranscript,
      undo,
      redo,
      canUndo,
      canRedo,
      resetSessionState,
      importLiveState,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useVoiceTrack() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useVoiceTrack outside provider');
  return v;
}
