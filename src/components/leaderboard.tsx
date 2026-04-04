'use client'

import { useEffect, useRef, useCallback } from 'react'
import { LayoutGroup, AnimatePresence, motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { Users } from 'lucide-react'
import { TeamCard } from '@/components/team-card'
import type { Team } from '@/types'

interface LeaderboardProps {
  teams: Team[]
  onLayoutComplete?: () => void
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <Users className="w-16 h-16 text-muted-foreground/30 mb-4" />
      <h3 className="text-lg font-semibold text-muted-foreground">No teams yet</h3>
      <p className="text-sm text-muted-foreground/70 mt-1">
        Say &quot;Add 5 teams&quot; to get started
      </p>
    </motion.div>
  )
}

function fireConfetti() {
  const duration = 2500
  const animationEnd = Date.now() + duration
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 }

  function randomInRange(min: number, max: number) {
    return Math.random() * (max - min) + min
  }

  const interval = setInterval(() => {
    const timeLeft = animationEnd - Date.now()

    if (timeLeft <= 0) {
      return clearInterval(interval)
    }

    const particleCount = 50 * (timeLeft / duration)

    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      colors: ['#6366f1', '#8b5cf6', '#a855f7', '#f59e0b', '#10b981'],
    })
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      colors: ['#6366f1', '#8b5cf6', '#a855f7', '#f59e0b', '#10b981'],
    })
  }, 250)
}

export function Leaderboard({ teams, onLayoutComplete }: LeaderboardProps) {
  // Sort teams by score (descending)
  const sorted = [...teams].sort((a, b) => b.score - a.score)
  const prevLeaderRef = useRef<string | null>(null)

  // Track first place changes for confetti
  const currentLeader = sorted[0]?.id || null

  useEffect(() => {
    if (
      currentLeader &&
      prevLeaderRef.current !== null &&
      currentLeader !== prevLeaderRef.current
    ) {
      // First place has changed! Fire confetti
      fireConfetti()
    }
    prevLeaderRef.current = currentLeader
  }, [currentLeader])

  const handleLayoutComplete = useCallback(() => {
    onLayoutComplete?.()
  }, [onLayoutComplete])

  if (teams.length === 0) {
    return <EmptyState />
  }

  return (
    <LayoutGroup id="leaderboard">
      <motion.div
        layout
        onLayoutAnimationComplete={handleLayoutComplete}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 auto-rows-fr"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {sorted.map((team, index) => (
            <motion.div
              key={team.id}
              layout
              className="h-full"
              transition={{
                type: 'spring',
                stiffness: 350,
                damping: 30,
                mass: 0.8,
              }}
            >
              <TeamCard team={team} rank={index + 1} />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </LayoutGroup>
  )
}
