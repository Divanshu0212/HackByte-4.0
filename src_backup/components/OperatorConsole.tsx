import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Undo2,
  Redo2,
  Loader2,
  Volume2,
  Settings,
  Sparkles,
  Brain,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useVoiceTrack } from '../context/VoiceTrackContext';
import { useGameRules } from '../context/GameRulesContext';

function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="console__section">
      <button
        type="button"
        className="console__section-header"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          width: '100%',
          background: 'none',
          border: 'none',
          padding: '0.25rem 0',
          cursor: 'pointer',
          justifyContent: 'space-between',
          color: 'inherit',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Icon size={12} style={{ opacity: 0.6 }} />
          <h3 style={{ margin: 0, fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b' }}>
            {title}
          </h3>
        </span>
        {isOpen ? <ChevronUp size={14} style={{ color: '#94a3b8' }} /> : <ChevronDown size={14} style={{ color: '#94a3b8' }} />}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden', marginTop: '0.5rem' }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export function OperatorConsole() {
  const {
    runTranscript,
    processing,
    lastTranscript,
    lastAgentTrace,
    undo,
    redo,
    canUndo,
    canRedo,
    state,
  } = useVoiceTrack();
  const { ruleManifest, rawDescription } = useGameRules();

  const { status, lastError, start, stop } = useSpeechRecognition((t) => {
    void runTranscript(t);
  });

  const isListening = status === 'listening';

  return (
    <aside className="console">
      {/* Header */}
      <div className="console__header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2>Operator Console</h2>
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            title="Settings"
            style={{ padding: '0.375rem' }}
          >
            <Settings size={16} />
          </button>
        </div>
        <div className="console__chips">
          <span className="chip">
            <Sparkles size={10} />
            {ruleManifest ? 'Non-linear' : 'Linear'}
          </span>
          <span className="chip chip--muted">{state.scoring_mode.replace('_', ' ')}</span>
          {state.suddenDeath && (
            <span className="chip chip--danger">
              Late-stage
            </span>
          )}
          {ruleManifest?.rulesetLabel && (
            <span className="chip chip--ruleset" title="Ruleset label">
              {ruleManifest.rulesetLabel}
            </span>
          )}
        </div>
      </div>

      {/* Microphone Control */}
      <div className="console__mic">
        <motion.button
          type="button"
          className={`btn btn--lg ${isListening ? 'btn--danger' : 'btn--primary'}`}
          onClick={isListening ? stop : start}
          whileTap={{ scale: 0.98 }}
        >
          {isListening ? (
            <>
              <motion.span
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                <MicOff size={18} />
              </motion.span>
              Stop Listening
            </>
          ) : (
            <>
              <Mic size={18} />
              Start Listening
            </>
          )}
        </motion.button>

        {isListening && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginTop: '0.5rem',
              fontSize: '0.8rem',
              color: '#10b981',
            }}
          >
            <motion.span
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#10b981',
              }}
            />
            Listening for commands...
          </motion.div>
        )}

        {lastError && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="console__error"
          >
            {lastError}
          </motion.p>
        )}
      </div>

      {/* Undo/Redo */}
      <div className="console__row">
        <button
          type="button"
          className="btn btn--ghost"
          disabled={!canUndo}
          onClick={() => undo()}
          style={{ flex: 1 }}
        >
          <Undo2 size={14} />
          Undo
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={!canRedo}
          onClick={() => redo()}
          style={{ flex: 1 }}
        >
          <Redo2 size={14} />
          Redo
        </button>
      </div>

      {/* Processing Indicator */}
      <AnimatePresence>
        {processing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="console__processing"
          >
            <Loader2 size={16} className="spinner" />
            Agent processing command...
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transcript */}
      <Section title="Last Transcript" icon={Volume2}>
        <pre className="console__pre">
          {lastTranscript || 'Waiting for voice input...'}
        </pre>
      </Section>

      {/* Agent Trace */}
      <Section title="Agent Reasoning" icon={Brain}>
        <pre className="console__pre console__pre--sm">
          {lastAgentTrace || 'No agent activity yet'}
        </pre>
      </Section>

      {/* Rule Manifest Summary */}
      {ruleManifest && (
        <Section title="Rule Manifest" icon={Sparkles} defaultOpen={false}>
          <pre className="console__pre console__pre--sm">
            {JSON.stringify(
              {
                scoringType: ruleManifest.scoringType,
                triggers: ruleManifest.triggers?.length ?? 0,
                statusValues: ruleManifest.statusValues,
              },
              null,
              2
            )}
          </pre>
        </Section>
      )}

      {/* Raw Rules */}
      {rawDescription.length > 0 && (
        <Section title="Raw Rules" icon={FileText} defaultOpen={false}>
          <p className="console__muted">
            {rawDescription.length > 300
              ? `${rawDescription.slice(0, 300)}...`
              : rawDescription}
          </p>
        </Section>
      )}
    </aside>
  );
}
