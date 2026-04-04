import { motion } from 'framer-motion';
import type { Participant } from '../types';

/** pass_fail layout — grid of cards with pass/fail emphasis */
export function QualifyingGrid({ participants }: { participants: Participant[] }) {
  return (
    <div className="qual-grid">
      {participants.map((p) => {
        const pass = (p.score ?? 0) >= 1;
        return (
          <motion.div
            key={p.id}
            layout
            className={`qual-tile ${pass ? 'qual-tile--pass' : 'qual-tile--fail'}`}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <span className="qual-tile__name">{p.name}</span>
            <span className="qual-tile__badge">{pass ? 'PASS' : 'FAIL'}</span>
          </motion.div>
        );
      })}
    </div>
  );
}
