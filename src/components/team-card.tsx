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
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { getAvatarUrl, getTeamColor } from '@/lib/avatar'
import type { Team } from '@/types'

interface TeamCardProps {
  team: Team
  rank: number
  previousScore?: number
}

function RankBadge({ rank }: { rank: number }) {
  if (rank > 3) {
    return (
      <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
        #{rank}
      </div>
    )
  }

  const icons = {
    1: <Crown className="w-4 h-4" />,
    2: <Medal className="w-4 h-4" />,
    3: <Star className="w-4 h-4" />,
  }

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className={cn(
        'absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-lg',
        rank === 1 && 'rank-badge-1',
        rank === 2 && 'rank-badge-2',
        rank === 3 && 'rank-badge-3'
      )}
    >
      {icons[rank as 1 | 2 | 3]}
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
    <animated.span className="font-mono text-3xl font-bold tabular-nums">
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
            'absolute -right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-full font-mono text-sm font-bold',
            delta > 0 ? 'score-delta-positive' : 'score-delta-negative'
          )}
        >
          {delta > 0 ? '+' : ''}{delta}
        </motion.span>
      )}
    </AnimatePresence>
  )
}

export function TeamCard({ team, rank, previousScore }: TeamCardProps) {
  const [showDelta, setShowDelta] = useState(false)
  const [delta, setDelta] = useState(0)
  const prevScoreRef = useRef(team.score)

  // Track score changes for delta display
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

  const isDefeated = team.live_status === 'eliminated' || team.live_status === 'disqualified'
  const isFrozen = team.live_status === 'frozen'
  const isShielded = team.live_status === 'shielded'
  const isCursed = team.live_status === 'cursed'

  const statusMeta: Record<Team['live_status'], { label: string; variant: 'success' | 'frozen' | 'shielded' | 'cursed' | 'destructive' }> = {
    active: { label: 'Active', variant: 'success' },
    frozen: { label: 'Frozen', variant: 'frozen' },
    shielded: { label: 'Shielded', variant: 'shielded' },
    cursed: { label: 'Cursed', variant: 'cursed' },
    disqualified: { label: 'Disqualified', variant: 'destructive' },
    eliminated: { label: 'Eliminated', variant: 'destructive' },
  }

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
          'relative overflow-hidden transition-all h-full w-full max-w-[280px] mx-auto',
          'team-card-' + team.live_status,
          isDefeated && 'team-card-defeated'
        )}
      >
        <RankBadge rank={rank} />

        <div className="h-1.5" style={{ backgroundColor: team.color || getTeamColor(rank - 1) }} />

        <div>
          <div
            className="p-3"
          >
            <div className="flex items-start gap-3">
              <div className="relative shrink-0">
                <Image
                  src={team.avatar_url || getAvatarUrl(team.id, 'shapes', { backgroundColor: team.color })}
                  alt={team.name}
                  width={40}
                  height={40}
                  className="rounded-lg"
                />
                {isFrozen && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -bottom-1 -right-1 bg-blue-500 text-white rounded-full p-1"
                  >
                    <Snowflake className="w-3 h-3" />
                  </motion.div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3
                    className={cn(
                      'font-semibold text-base truncate',
                      isDefeated && 'line-through text-muted-foreground'
                    )}
                  >
                    {team.name}
                  </h3>
                </div>

                <div className="mt-1">
                  <Badge variant={statusMeta[team.live_status].variant} className="shrink-0">
                    {statusMeta[team.live_status].label}
                  </Badge>
                </div>

                <div className="relative mt-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      Score
                    </span>
                    <div className="text-2xl font-bold leading-none">
                      <AnimatedScore score={team.score} />
                    </div>
                  </div>
                  <ScoreDelta delta={delta} show={showDelta} />
                </div>

                <div className="flex flex-wrap gap-1.5 mt-2">
                  {isShielded && team.live_status !== 'shielded' && (
                    <Badge variant="shielded">
                      <Shield className="w-3 h-3 mr-1" />
                      Shielded
                    </Badge>
                  )}
                  {isCursed && team.live_status !== 'cursed' && (
                    <Badge variant="cursed">
                      <Star className="w-3 h-3 mr-1" />
                      Cursed
                    </Badge>
                  )}
                  {team.momentum_buff && (
                    <Badge variant="momentum">
                      <Zap className="w-3 h-3 mr-1" />
                      Momentum
                    </Badge>
                  )}
                  {team.shield_rounds_remaining && team.shield_rounds_remaining > 0 && (
                    <Badge variant="shielded">
                      <Shield className="w-3 h-3 mr-1" />
                      {team.shield_rounds_remaining}r
                    </Badge>
                  )}
                  {team.cursed_rounds_remaining && team.cursed_rounds_remaining > 0 && (
                    <Badge variant="cursed">
                      Curse {team.cursed_rounds_remaining}r
                    </Badge>
                  )}
                  {team.revive_token && !team.revive_used && (
                    <Badge variant="token">
                      <Heart className="w-3 h-3 mr-1" />
                      Revive
                    </Badge>
                  )}
                  {team.shield_token && (
                    <Badge variant="token">
                      <Shield className="w-3 h-3 mr-1" />
                      Token
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
