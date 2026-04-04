import { useEffect, useRef, useCallback } from 'react';
import { LayoutGroup, AnimatePresence, motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Users } from 'lucide-react';
import { TeamCard } from './TeamCard';
import type { Participant } from '../types';

type Props = {
  participants: Participant[];
  onLayoutRootComplete?: () => void;
};

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="empty-state"
    >
      <Users className="empty-state__icon" size={64} />
      <h3 className="empty-state__title">No teams yet</h3>
      <p className="empty-state__description">
        Say "Add 5 teams" to get started with your event
      </p>
    </motion.div>
  );
}

function fireConfetti() {
  const duration = 2000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

  function randomInRange(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  const interval = setInterval(() => {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      return clearInterval(interval);
    }

    const particleCount = 50 * (timeLeft / duration);

    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      colors: ['#6366f1', '#8b5cf6', '#a855f7', '#f59e0b', '#10b981'],
    });
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      colors: ['#6366f1', '#8b5cf6', '#a855f7', '#f59e0b', '#10b981'],
    });
  }, 250);
}

/** Sorted leaderboard with FLIP layout, confetti on first place takeover */
export function NumericLeaderboard({ participants, onLayoutRootComplete }: Props) {
  const sorted = [...participants].sort((a, b) => b.score - a.score);
  const prevLeaderRef = useRef<string | null>(null);

  // Track first place changes for confetti
  const currentLeader = sorted[0]?.id || null;

  useEffect(() => {
    if (
      currentLeader &&
      prevLeaderRef.current !== null &&
      currentLeader !== prevLeaderRef.current
    ) {
      // First place has changed! Fire confetti
      fireConfetti();
    }
    prevLeaderRef.current = currentLeader;
  }, [currentLeader]);

  const handleLayoutComplete = useCallback(() => {
    onLayoutRootComplete?.();
  }, [onLayoutRootComplete]);

  if (participants.length === 0) {
    return <EmptyState />;
  }

  return (
    <LayoutGroup id="leaderboard">
      <motion.div
        layout
        className="leaderboard-shell"
        onLayoutAnimationComplete={handleLayoutComplete}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      >
        <ul className="leaderboard-list">
          <AnimatePresence mode="popLayout" initial={false}>
            {sorted.map((p, index) => (
              <motion.li
                key={p.id}
                layout
                className="leaderboard-item"
                transition={{
                  type: 'spring',
                  stiffness: 350,
                  damping: 30,
                  mass: 0.8,
                }}
              >
                <TeamCard data={p} rank={index + 1} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </motion.div>
    </LayoutGroup>
  );
}
