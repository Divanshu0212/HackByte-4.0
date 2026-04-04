import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Sparkles, Zap, RotateCcw, ArrowRight, FileCode } from 'lucide-react';
import { useGameRules } from '../context/GameRulesContext';
import { loadSessionSnapshot } from '../services/persist';
import { EXAMPLE_COMPLEX_RULESET } from '../data/exampleRulesTemplates';

type Props = {
  onStart: (opts: { restoreSnapshot: boolean }) => void;
};

export function SessionSetup({ onStart }: Props) {
  const { compileFromText, setFromCompiled } = useGameRules();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const snap = loadSessionSnapshot();

  const handleCompileAndStart = async () => {
    setErr(null);
    setBusy(true);
    try {
      if (text.trim()) await compileFromText(text.trim());
      else setFromCompiled(null, '');
      onStart({ restoreSnapshot: false });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleSkipLinear = () => {
    setFromCompiled(null, '');
    setErr(null);
    onStart({ restoreSnapshot: false });
  };

  const handleRestore = () => {
    onStart({ restoreSnapshot: true });
  };

  return (
    <div className="setup">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="setup__card"
      >
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="setup__eyebrow"
        >
          <Sparkles size={14} style={{ marginRight: 6 }} />
          Elixa
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="setup__title"
        >
          Create your event
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="setup__lede"
        >
          Describe your game rules in plain language. Our AI compiles them into a Rule Manifest
          that powers voice commands and dynamic scoring throughout your event.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <label className="setup__label" htmlFor="rules">
            Natural language rules (optional)
          </label>
          <textarea
            id="rules"
            className="setup__textarea"
            rows={6}
            placeholder='Example: "Quiz competition with 5 teams. Correct answer gives +10 points, wrong answer -5. Teams can be eliminated after 3 wrong answers. Support undo for score corrections."'
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
          />
        </motion.div>

        <AnimatePresence>
          {err && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="setup__error"
            >
              {err}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="setup__template-row"
        >
          <button
            type="button"
            className="btn btn--secondary"
            disabled={busy}
            onClick={() => {
              setText(EXAMPLE_COMPLEX_RULESET);
              setErr(null);
            }}
          >
            <FileCode size={14} />
            Load example ruleset
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="setup__actions"
        >
          <motion.button
            type="button"
            className="btn btn--primary"
            disabled={busy}
            onClick={handleCompileAndStart}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {busy ? (
              <>
                <Loader2 size={16} className="spinner" />
                Compiling rules...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                {text.trim() ? 'Compile & Start' : 'Start Event'}
              </>
            )}
          </motion.button>

          <motion.button
            type="button"
            className="btn btn--ghost"
            disabled={busy}
            onClick={handleSkipLinear}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Zap size={14} />
            Quick start (linear scoring)
          </motion.button>
        </motion.div>

        <AnimatePresence>
          {snap.state?.participants?.length ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="setup__restore"
            >
              <p className="setup__restore-note">
                <RotateCcw size={14} style={{ marginRight: 6 }} />
                Found saved session with {snap.state.participants.length} participants
              </p>
              <motion.button
                type="button"
                className="btn btn--secondary"
                onClick={handleRestore}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <ArrowRight size={14} />
                Restore & continue
              </motion.button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
