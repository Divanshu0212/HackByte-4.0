'use client'

import { motion } from 'framer-motion'
import { Timer, Pause, Play, Square } from 'lucide-react'
import { useTimer } from '@/hooks/useTimer'
import { cn } from '@/lib/utils'

interface TimerDisplayProps {
  timer: {
    state: 'idle' | 'running' | 'paused'
    duration_sec?: number
    ends_at?: number
  }
  className?: string
}

export function TimerDisplay({ timer, className }: TimerDisplayProps) {
  const { formatted, percent, isRunning, isPaused, isIdle, isExpired } = useTimer(timer)

  if (isIdle && !timer.duration_sec) return null

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'relative flex items-center gap-3 px-4 py-3 rounded-xl border overflow-hidden',
        isRunning && !isExpired && 'border-primary/30 bg-primary/5',
        isPaused && 'border-warning/30 bg-warning/5',
        isExpired && 'border-destructive/30 bg-destructive/5',
        isIdle && 'border-border bg-muted/30',
        className
      )}
    >
      {/* Progress bar background */}
      {(isRunning || isPaused) && (
        <motion.div
          className={cn(
            'absolute inset-0 origin-left',
            isExpired ? 'bg-destructive/10' : 'bg-primary/5'
          )}
          initial={{ scaleX: 1 }}
          animate={{ scaleX: percent / 100 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      )}

      <div className="relative z-10 flex items-center gap-3 w-full">
        <div className={cn(
          'p-1.5 rounded-lg',
          isRunning && !isExpired && 'bg-primary/10 text-primary',
          isPaused && 'bg-warning/10 text-warning',
          isExpired && 'bg-destructive/10 text-destructive animate-pulse',
          isIdle && 'bg-muted text-muted-foreground'
        )}>
          {isRunning && !isExpired && <Play className="w-4 h-4" />}
          {isPaused && <Pause className="w-4 h-4" />}
          {isExpired && <Square className="w-4 h-4" />}
          {isIdle && <Timer className="w-4 h-4" />}
        </div>

        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className={cn(
              'font-mono text-2xl font-bold tabular-nums tracking-tight',
              isExpired && 'text-destructive'
            )}>
              {formatted}
            </span>
            <span className={cn(
              'text-xs font-semibold uppercase tracking-wider',
              isRunning && !isExpired && 'text-primary',
              isPaused && 'text-warning',
              isExpired && 'text-destructive',
              isIdle && 'text-muted-foreground'
            )}>
              {isExpired ? 'TIME UP!' : isRunning ? 'Running' : isPaused ? 'Paused' : 'Ready'}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
