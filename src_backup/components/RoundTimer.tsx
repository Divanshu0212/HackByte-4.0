import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { TimerState } from '../types';

export function RoundTimer({ timer }: { timer: TimerState }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (timer.state !== 'running' || !timer.endsAt) return;
    const id = setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, [timer.state, timer.endsAt]);

  const remainSec =
    timer.state === 'running' && timer.endsAt
      ? Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000))
      : timer.durationSec ?? 0;

  const m = Math.floor(remainSec / 60);
  const s = remainSec % 60;
  const label = `${m}:${s.toString().padStart(2, '0')}`;

  return (
    <motion.div
      layout
      className={`round-timer round-timer--${timer.state}`}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <span className="round-timer__label">Round timer</span>
      <span className="round-timer__clock">{label}</span>
      <span className="round-timer__state">{timer.state}</span>
    </motion.div>
  );
}
