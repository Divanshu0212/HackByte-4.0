'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface TimerState {
  state: 'idle' | 'running' | 'paused'
  duration_sec?: number
  ends_at?: number
}

export function useTimer(timer: TimerState) {
  const [remaining, setRemaining] = useState(0)
  const frameRef = useRef<number | null>(null)

  const tick = useCallback(() => {
    if (timer.state === 'running' && timer.ends_at) {
      const left = Math.max(0, Math.ceil((timer.ends_at - Date.now()) / 1000))
      setRemaining(left)
      if (left > 0) {
        frameRef.current = requestAnimationFrame(tick)
      }
    } else if (timer.state === 'paused') {
      // Keep the remaining frozen
    } else {
      setRemaining(timer.duration_sec || 0)
    }
  }, [timer])

  useEffect(() => {
    if (timer.state === 'running') {
      tick()
    } else if (timer.state === 'idle') {
      setRemaining(timer.duration_sec || 0)
    }

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current)
      }
    }
  }, [timer, tick])

  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60
  const formatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  const percent = timer.duration_sec ? Math.max(0, (remaining / timer.duration_sec) * 100) : 0

  return {
    remaining,
    minutes,
    seconds,
    formatted,
    percent,
    isRunning: timer.state === 'running',
    isPaused: timer.state === 'paused',
    isIdle: timer.state === 'idle',
    isExpired: timer.state === 'running' && remaining === 0,
  }
}
