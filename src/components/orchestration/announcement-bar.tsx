'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Megaphone, X, Volume2 } from 'lucide-react'
import { announceMessage } from '@/lib/speak'
import type { OrchestrationAnnouncement } from '@/types'

interface AnnouncementBarProps {
  announcements: OrchestrationAnnouncement[]
  autoPlay?: boolean
}

export function AnnouncementBar({ announcements, autoPlay = true }: AnnouncementBarProps) {
  const [dismissed, setDismissed] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [playedIds, setPlayedIds] = useState<Set<string>>(new Set())

  // Get recent, non-dismissed announcements
  const recentAnnouncements = announcements
    .filter((a) => !dismissed.includes(a.announcement_id))
    .filter((a) => {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
      return (a.sent_at || a.created_at) > fiveMinutesAgo
    })
    .slice(0, 5)

  const currentAnnouncement = recentAnnouncements[currentIndex]

  // Auto-cycle through announcements
  useEffect(() => {
    if (recentAnnouncements.length <= 1) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % recentAnnouncements.length)
    }, 8000)

    return () => clearInterval(interval)
  }, [recentAnnouncements.length])

  // Auto-play voice for new announcements
  useEffect(() => {
    if (!autoPlay || !currentAnnouncement) return

    if (currentAnnouncement.voice_enabled && !playedIds.has(currentAnnouncement.announcement_id)) {
      setPlayedIds((prev) => new Set(prev).add(currentAnnouncement.announcement_id))
      announceMessage(currentAnnouncement.message)
    }
  }, [currentAnnouncement, autoPlay, playedIds])

  const handleDismiss = (id: string) => {
    setDismissed((prev) => [...prev, id])
    if (currentIndex >= recentAnnouncements.length - 1) {
      setCurrentIndex(Math.max(0, currentIndex - 1))
    }
  }

  const handlePlayVoice = () => {
    if (currentAnnouncement) {
      announceMessage(currentAnnouncement.message)
    }
  }

  if (!currentAnnouncement) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="mb-4 rounded-lg border border-violet-500/30 bg-gradient-to-r from-violet-500/10 to-purple-500/10 p-3"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/20">
            <Megaphone className="h-4 w-4 text-violet-400" />
          </div>

          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.p
                key={currentAnnouncement.announcement_id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="text-sm font-medium text-white"
              >
                {currentAnnouncement.message}
              </motion.p>
            </AnimatePresence>

            {recentAnnouncements.length > 1 && (
              <div className="mt-1 flex gap-1">
                {recentAnnouncements.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentIndex(i)}
                    className={`h-1.5 rounded-full transition-all ${
                      i === currentIndex
                        ? 'w-4 bg-violet-400'
                        : 'w-1.5 bg-white/30 hover:bg-white/50'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handlePlayVoice}
              className="rounded-lg p-2 text-violet-300 transition hover:bg-white/10"
              title="Play voice"
            >
              <Volume2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleDismiss(currentAnnouncement.announcement_id)}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
              title="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
