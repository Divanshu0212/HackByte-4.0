import { motion } from 'framer-motion';

type Props = {
  currentTotal: number;
  target: number;
  label?: string;
};

export function FundraisingProgressBar({ currentTotal, target, label }: Props) {
  const pct = target > 0 ? Math.min(100, (currentTotal / target) * 100) : 0;

  return (
    <div className="goal-panel">
      <div className="goal-panel__header">
        <span className="goal-panel__title">{label || 'Goal progress'}</span>
        <span className="goal-panel__numbers">
          {currentTotal.toLocaleString()} / {target.toLocaleString()}
        </span>
      </div>
      <div className="goal-track">
        <motion.div
          className="goal-fill"
          layout
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 28 }}
        />
      </div>
      <p className="goal-panel__pct">{pct.toFixed(1)}% funded</p>
    </div>
  );
}
