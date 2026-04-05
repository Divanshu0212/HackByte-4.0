'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Megaphone, Send, Volume2, VolumeX, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { announceMessage } from '@/lib/speak'
import type { OrchestrationAnnouncement } from '@/types'

interface AnnouncementsPanelProps {
  eventId: string
  operatorId: string
  announcements: OrchestrationAnnouncement[]
  isDirector: boolean
  onAnnouncementSent: () => void
}

export function AnnouncementsPanel({
  eventId,
  operatorId,
  announcements,
  isDirector,
  onAnnouncementSent,
}: AnnouncementsPanelProps) {
  const [message, setMessage] = useState('')
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [lastAnnouncementId, setLastAnnouncementId] = useState<string | null>(null)

  // Auto-play new announcements with voice
  useEffect(() => {
    if (announcements.length > 0) {
      const latestAnnouncement = announcements[0]
      if (latestAnnouncement.announcement_id !== lastAnnouncementId) {
        setLastAnnouncementId(latestAnnouncement.announcement_id)
        // Play voice if enabled and this is a new announcement
        if (latestAnnouncement.voice_enabled) {
          announceMessage(latestAnnouncement.message)
        }
      }
    }
  }, [announcements, lastAnnouncementId])

  const handleSendAnnouncement = async () => {
    if (!message.trim() || isLoading) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/orchestration/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_type: 'create_announcement',
          payload: {
            event_id: eventId,
            operator_id: operatorId,
            message: message.trim(),
            voice_enabled: voiceEnabled,
            broadcast_to: 'all',
          },
        }),
      })

      const data = await response.json()
      if (data.success) {
        setMessage('')
        onAnnouncementSent()

        // Speak immediately for the sender
        if (voiceEnabled) {
          announceMessage(message.trim())
        }
      }
    } catch (error) {
      console.error('Failed to send announcement:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendAnnouncement()
    }
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
    return date.toLocaleDateString()
  }

  return (
    <Card className="border-white/15 bg-[#1a1528]/60 backdrop-blur-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-purple-200">
          <Megaphone className="h-4 w-4" />
          Announcements
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Director Input Section */}
        {isDirector && (
          <div className="space-y-2">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Broadcast a message to all team members..."
              className="w-full resize-none rounded-lg border border-white/15 bg-black/30 p-3 text-sm text-white placeholder:text-slate-500 focus:border-violet-400/50 focus:outline-none"
              rows={2}
              disabled={isLoading}
            />
            <div className="flex items-center gap-2">
              <Button
                onClick={handleSendAnnouncement}
                disabled={isLoading || !message.trim()}
                size="sm"
                className="flex-1 bg-gradient-to-r from-violet-500 to-purple-500 text-white hover:from-violet-600 hover:to-purple-600"
              >
                <Send className="mr-2 h-3 w-3" />
                {isLoading ? 'Sending...' : 'Broadcast'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVoiceEnabled(!voiceEnabled)}
                className={`border-white/15 ${voiceEnabled ? 'bg-violet-500/20 text-violet-300' : 'bg-transparent text-slate-400'}`}
                title={voiceEnabled ? 'Voice enabled' : 'Voice disabled'}
              >
                {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        {/* Announcements List */}
        <div className="max-h-48 space-y-2 overflow-y-auto">
          <AnimatePresence>
            {announcements.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500">No announcements yet</p>
            ) : (
              announcements.slice(0, 10).map((ann, index) => (
                <motion.div
                  key={ann.announcement_id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="rounded-lg border border-white/10 bg-slate-800/30 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="flex-1 text-sm text-slate-200">{ann.message}</p>
                    {ann.voice_enabled && (
                      <Volume2 className="mt-0.5 h-3 w-3 flex-shrink-0 text-violet-400" />
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    <Clock className="h-3 w-3" />
                    {formatTime(ann.sent_at || ann.created_at)}
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  )
}
