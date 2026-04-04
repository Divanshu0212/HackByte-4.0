'use client'

import { useEffect, useRef, useCallback } from 'react'
import { LayoutGroup, AnimatePresence, motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { Users, Trophy } from 'lucide-react'
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
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="p-6 rounded-3xl bg-muted/30 mb-6">
        <Users className="w-16 h-16 text-muted-foreground/30" />
      </div>
      <h3 className="text-xl font-bold text-muted-foreground mb-2">No teams yet</h3>
      <p className="text-sm text-muted-foreground/70 max-w-xs">
        Say &quot;Add 5 teams&quot; or type it in the command input to get started
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {['add 5 teams', 'add teams alpha beta gamma'].map((cmd) => (
          <code
            key={cmd}
            className="text-xs px-3 py-1.5 rounded-full bg-primary/5 text-primary border border-primary/10 font-mono"
          >
            &quot;{cmd}&quot;
          </code>
        ))}
      </div>
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
  // Sort teams: active first (by score desc), then frozen (by score desc), then eliminated
  const sorted = [...teams].sort((a, b) => {
    const statusOrder = { active: 0, shielded: 0, cursed: 0, frozen: 1, eliminated: 2, disqualified: 3 }
    const aOrder = statusOrder[a.live_status] ?? 0
    const bOrder = statusOrder[b.live_status] ?? 0
    if (aOrder !== bOrder) return aOrder - bOrder
    return b.score - a.score
  })

  const prevLeaderRef = useRef<string | null>(null)

  // Track first place changes for confetti
  const activeTeams = sorted.filter(t => t.live_status === 'active' || t.live_status === 'shielded' || t.live_status === 'cursed')
  const currentLeader = activeTeams[0]?.id || null

  useEffect(() => {
    if (
      currentLeader &&
      prevLeaderRef.current !== null &&
      currentLeader !== prevLeaderRef.current
    ) {
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
    <div>
      {/* Stats bar */}
      <div className="flex items-center gap-3 mb-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5 text-amber-500" />
          <span className="font-medium">{activeTeams[0]?.name || '—'}</span>
          <span className="font-mono">{activeTeams[0]?.score ?? 0}pts</span>
        </div>
        <span className="text-border">•</span>
        <span>{teams.filter(t => t.live_status === 'active').length} active</span>
        {teams.filter(t => t.live_status === 'frozen').length > 0 && (
          <>
            <span className="text-border">•</span>
            <span className="text-blue-500">{teams.filter(t => t.live_status === 'frozen').length} frozen</span>
          </>
        )}
        {teams.filter(t => t.live_status === 'eliminated' || t.live_status === 'disqualified').length > 0 && (
          <>
            <span className="text-border">•</span>
            <span className="text-destructive">{teams.filter(t => t.live_status === 'eliminated' || t.live_status === 'disqualified').length} out</span>
          </>
        )}
      </div>

      <LayoutGroup id="leaderboard">
        <motion.div
          layout
          onLayoutAnimationComplete={handleLayoutComplete}
          className="grid gap-3 auto-rows-fr"
          style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(${teams.length <= 4 ? '280px' : teams.length <= 8 ? '240px' : '200px'}, 1fr))`,
          }}
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
    </div>
  )
}
