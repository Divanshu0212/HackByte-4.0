import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSpring, animated } from '@react-spring/web';
import { Shield, Zap, Snowflake, Skull, Heart, Trophy, Star } from 'lucide-react';
import type { Participant } from '../types';

function DefeatedBadge() {
  return (
    <motion.span
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="defeated-badge"
      aria-label="Eliminated"
    >
      <Skull size={10} />
      Out
    </motion.span>
  );
}

function norm(s?: string) {
  return String(s ?? 'active').toLowerCase();
}

function RankBadge({ rank }: { rank: number }) {
  const rankClass = rank === 1 ? 'team-card__rank--first' :
                    rank === 2 ? 'team-card__rank--second' :
                    rank === 3 ? 'team-card__rank--third' : '';

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      className={`team-card__rank ${rankClass}`}
    >
      {rank === 1 && <Trophy size={12} style={{ marginRight: 4 }} />}
      #{rank}
    </motion.div>
  );
}

function AnimatedScore({ score }: { score: number }) {
  const { number } = useSpring({
    number: score,
    from: { number: 0 },
    config: { mass: 1, tension: 180, friction: 24 },
  });

  return (
    <animated.span className="team-card__score">
      {number.to((n) => Math.floor(n))}
    </animated.span>
  );
}

function ScoreDelta({ delta, show }: { delta: number; show: boolean }) {
  if (!show || delta === 0) return null;

  const isPositive = delta > 0;

  return (
    <AnimatePresence>
      {show && (
        <motion.span
          initial={{ opacity: 0, scale: 0.5, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.5, y: -10 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className={`team-card__score-delta team-card__score-delta--${isPositive ? 'positive' : 'negative'}`}
        >
          {isPositive ? '+' : ''}{delta}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

interface TeamCardProps {
  data: Participant;
  rank?: number;
}

export function TeamCard({ data, rank }: TeamCardProps) {
  const st = norm(data.status);
  const isDefeated = st === 'defeated';
  const isFrozen = st === 'frozen';

  // Track score changes for delta display
  const [showDelta, setShowDelta] = useState(false);
  const [delta, setDelta] = useState(0);
  const prevScoreRef = useRef(data.score);

  useEffect(() => {
    const scoreDiff = data.score - prevScoreRef.current;
    if (scoreDiff !== 0) {
      setDelta(scoreDiff);
      setShowDelta(true);
      prevScoreRef.current = data.score;

      // Hide delta after animation
      const timeout = setTimeout(() => {
        setShowDelta(false);
      }, 2000);

      return () => clearTimeout(timeout);
    }
  }, [data.score]);

  const cardVariants = {
    initial: { opacity: 0, x: 30, scale: 0.95 },
    animate: {
      opacity: isDefeated ? 0.5 : 1,
      x: 0,
      scale: 1,
      filter: isDefeated ? 'grayscale(0.8)' : 'none',
    },
    exit: {
      opacity: 0,
      x: -50,
      scale: 0.9,
      backgroundColor: 'rgba(239, 68, 68, 0.15)',
    },
    frozen: {
      opacity: 0.7,
      x: 0,
      filter: 'saturate(0.5)',
    },
  };

  return (
    <motion.div
      layout
      initial="initial"
      animate={isFrozen ? 'frozen' : 'animate'}
      exit="exit"
      variants={cardVariants}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`team-card team-card--${st} ${isDefeated ? 'team-card--defeated' : ''}`}
      style={{
        borderLeftColor: data.avatarColor || '#6366f1',
      }}
    >
      <div className="team-card__accent" style={{ background: data.avatarColor }} />

      {rank && rank <= 10 && <RankBadge rank={rank} />}

      <div className="team-card__body">
        <div className="team-card__top">
          <h3 className={`team-card__name ${isDefeated ? 'strike' : ''}`}>
            {data.name}
          </h3>
          {isDefeated && <DefeatedBadge />}
          {isFrozen && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="team-card__pill team-card__pill--frozen"
            >
              <Snowflake size={10} /> Frozen
            </motion.span>
          )}
        </div>

        <div className="team-card__score-row">
          <span className="team-card__score-label">Score</span>
          <AnimatedScore score={data.score} />
          <ScoreDelta delta={delta} show={showDelta} />
        </div>

        <div className="team-card__badges">
          {/* Status badges */}
          {!isDefeated && !isFrozen && st !== 'active' && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={`team-card__pill team-card__pill--${st}`}
            >
              {st}
            </motion.span>
          )}

          {/* Momentum buff */}
          {data.momentumBuff && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="team-card__pill team-card__pill--momentum"
            >
              <Zap size={10} /> Momentum
            </motion.span>
          )}

          {/* Shield rounds */}
          {typeof data.shieldRoundsRemaining === 'number' && data.shieldRoundsRemaining > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="team-card__pill team-card__pill--shield"
            >
              <Shield size={10} /> Shield {data.shieldRoundsRemaining}r
            </motion.span>
          )}

          {/* Curse rounds */}
          {typeof data.cursedRoundsRemaining === 'number' && data.cursedRoundsRemaining > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="team-card__pill team-card__pill--curse"
            >
              <Star size={10} /> Curse {data.cursedRoundsRemaining}r
            </motion.span>
          )}

          {/* Tokens */}
          {(data.reviveToken !== undefined || data.shieldToken !== undefined) && (
            <>
              {data.reviveToken !== false && data.reviveUsed !== true && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="team-card__pill team-card__pill--token"
                  title="Revive token available"
                >
                  <Heart size={10} /> Revive
                </motion.span>
              )}
              {data.shieldToken !== false && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="team-card__pill team-card__pill--token"
                  title="Shield token available"
                >
                  <Shield size={10} /> Token
                </motion.span>
              )}
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
