'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSpring, animated } from '@react-spring/web'
import Image from 'next/image'
import {
  Shield,
  Zap,
  Snowflake,
  Heart,
  Star,
  Crown,
  Medal,
  Skull,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { getAvatarUrl, getTeamColor } from '@/lib/avatar'
import type { Team } from '@/types'

interface TeamCardProps {
  team: Team
  rank: number
}

function RankBadge({ rank }: { rank: number }) {
  if (rank > 3) {
    return (
      <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground z-10">
        #{rank}
      </div>
    )
  }

  const icons: Record<number, React.ReactNode> = {
    1: <Crown className="w-3.5 h-3.5" />,
    2: <Medal className="w-3.5 h-3.5" />,
    3: <Star className="w-3.5 h-3.5" />,
  }

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className={cn(
        'absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-lg z-10',
        rank === 1 && 'rank-badge-1',
        rank === 2 && 'rank-badge-2',
        rank === 3 && 'rank-badge-3'
      )}
    >
      {icons[rank]}
    </motion.div>
  )
}

function AnimatedScore({ score }: { score: number }) {
  const { number } = useSpring({
    number: score,
    from: { number: 0 },
    config: { mass: 1, tension: 180, friction: 24 },
  })

  return (
    <animated.span className="font-mono text-2xl font-bold tabular-nums leading-none">
      {number.to((n) => Math.floor(n))}
    </animated.span>
  )
}

function ScoreDelta({ delta, show }: { delta: number; show: boolean }) {
  if (!show || delta === 0) return null

  return (
    <AnimatePresence>
      {show && (
        <motion.span
          initial={{ opacity: 0, scale: 0.5, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.5, y: -10 }}
          className={cn(
            'absolute -right-1 top-0 px-1.5 py-0.5 rounded-full font-mono text-xs font-bold',
            delta > 0 ? 'score-delta-positive' : 'score-delta-negative'
          )}
        >
          {delta > 0 ? '+' : ''}{delta}
        </motion.span>
      )}
    </AnimatePresence>
  )
}

export function TeamCard({ team, rank }: TeamCardProps) {
  const [showDelta, setShowDelta] = useState(false)
  const [delta, setDelta] = useState(0)
  const prevScoreRef = useRef(team.score)

  useEffect(() => {
    const scoreDiff = team.score - prevScoreRef.current
    if (scoreDiff !== 0) {
      setDelta(scoreDiff)
      setShowDelta(true)
      prevScoreRef.current = team.score
      const timeout = setTimeout(() => setShowDelta(false), 2500)
      return () => clearTimeout(timeout)
    }
  }, [team.score])

  let normalizedStatus = (team.live_status || 'active').toLowerCase()
  if (normalizedStatus.includes('freez')) normalizedStatus = 'frozen'
  else if (normalizedStatus.match(/elimin|defeat|out|dead/)) normalizedStatus = 'eliminated'
  else if (normalizedStatus.includes('disqual')) normalizedStatus = 'disqualified'
  else if (normalizedStatus.includes('shield')) normalizedStatus = 'shielded'
  else if (normalizedStatus.includes('curs')) normalizedStatus = 'cursed'
  else if (!['active', 'frozen', 'shielded', 'cursed', 'disqualified', 'eliminated'].includes(normalizedStatus)) {
    // If it's a completely custom status we don't recognize, we can leave it as-is for the label, 
    // but the card won't have special defeated/frozen styling.
  }

  const isDefeated = normalizedStatus === 'eliminated' || normalizedStatus === 'disqualified'
  const isFrozen = normalizedStatus === 'frozen'

  const statusConfig: Record<string, { label: string; className: string }> = {
    active: { label: 'Active', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' },
    frozen: { label: 'Frozen', className: 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400' },
    shielded: { label: 'Shielded', className: 'bg-violet-100 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400' },
    cursed: { label: 'Cursed', className: 'bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400' },
    disqualified: { label: 'DQ\'d', className: 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400' },
    eliminated: { label: 'Out', className: 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400' },
  }

  const status = statusConfig[normalizedStatus] || { label: team.live_status || 'Unknown', className: 'bg-muted text-muted-foreground' }

  const cardVariants = {
    initial: { opacity: 0, x: 50, scale: 0.9 },
    animate: {
      opacity: isDefeated ? 0.5 : 1,
      x: 0,
      scale: 1,
      filter: isDefeated ? 'grayscale(0.8)' : 'none',
    },
    exit: {
      opacity: 0,
      x: -100,
      scale: 0.8,
    },
    frozen: {
      opacity: 0.7,
      x: 0,
      scale: 1,
      filter: 'saturate(0.5)',
    },
  }

  return (
    <motion.div
      layout
      initial="initial"
      animate={isFrozen ? 'frozen' : 'animate'}
      exit="exit"
      variants={cardVariants}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      <Card
        className={cn(
          'relative overflow-hidden transition-all h-full hover:shadow-md',
          isFrozen && 'border-blue-300 bg-blue-50/30 dark:bg-blue-950/10',
          isDefeated && 'border-destructive/20 opacity-60 grayscale',
        )}
      >
        <RankBadge rank={rank} />

        {/* Color strip */}
        <div className="h-1" style={{ backgroundColor: team.color || getTeamColor(rank - 1) }} />

        <div className="p-3">
          <div className="flex items-start gap-2.5">
            {/* Avatar */}
            <div className="relative shrink-0">
              <Image
                src={team.avatar_url || getAvatarUrl(team.id, 'shapes', { backgroundColor: team.color })}
                alt={team.name}
                width={36}
                height={36}
                className="rounded-lg"
                unoptimized
              />
              {isFrozen && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -bottom-1 -right-1 bg-blue-500 text-white rounded-full p-0.5"
                >
                  <Snowflake className="w-2.5 h-2.5" />
                </motion.div>
              )}
              {isDefeated && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -bottom-1 -right-1 bg-destructive text-white rounded-full p-0.5"
                >
                  <Skull className="w-2.5 h-2.5" />
                </motion.div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              {/* Name + Status */}
              <div className="flex items-center gap-1.5 mb-0.5">
                <h3
                  className={cn(
                    'font-semibold text-sm truncate',
                    isDefeated && 'line-through text-muted-foreground'
                  )}
                >
                  {team.name}
                </h3>
              </div>

              <div className="flex items-center gap-1.5 mb-1.5">
                <span className={cn(
                  'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider',
                  status.className
                )}>
                  {status.label}
                </span>
              </div>

              {/* Score */}
              <div className="relative">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                    Score
                  </span>
                  <AnimatedScore score={team.score} />
                </div>
                <ScoreDelta delta={delta} show={showDelta} />
              </div>

              {/* Token/Effect Badges */}
              <div className="flex flex-wrap gap-1 mt-1.5">
                {team.momentum_buff && (
                  <Badge variant="warning" className="text-[9px] px-1.5 py-0">
                    <Zap className="w-2.5 h-2.5 mr-0.5" />
                    Momentum
                  </Badge>
                )}
                {team.shield_rounds_remaining && team.shield_rounds_remaining > 0 && (
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                    <Shield className="w-2.5 h-2.5 mr-0.5" />
                    {team.shield_rounds_remaining}r
                  </Badge>
                )}
                {team.cursed_rounds_remaining && team.cursed_rounds_remaining > 0 && (
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                    <Star className="w-2.5 h-2.5 mr-0.5" />
                    Curse {team.cursed_rounds_remaining}r
                  </Badge>
                )}
                {team.revive_token && !team.revive_used && (
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                    <Heart className="w-2.5 h-2.5 mr-0.5" />
                    Revive
                  </Badge>
                )}
                {team.shield_token && (
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                    <Shield className="w-2.5 h-2.5 mr-0.5" />
                    Token
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
