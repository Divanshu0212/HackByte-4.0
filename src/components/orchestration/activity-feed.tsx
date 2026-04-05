'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  AlertCircle,
  Flag,
  MessageSquare,
  Megaphone,
  UserPlus,
  Clock,
  Activity,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { OrchestrationActivityLog, OrchestrationActivityType } from '@/types'

interface ActivityFeedProps {
  eventId: string
  operatorId?: string
  pollingInterval?: number // in milliseconds
}

const ACTION_ICONS: Record<OrchestrationActivityType, React.ReactNode> = {
  task_completed: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
  task_flagged: <AlertCircle className="h-4 w-4 text-red-400" />,
  task_note_added: <MessageSquare className="h-4 w-4 text-blue-400" />,
  checkpoint_passed: <Flag className="h-4 w-4 text-violet-400" />,
  checkpoint_failed: <Flag className="h-4 w-4 text-red-400" />,
  announcement_sent: <Megaphone className="h-4 w-4 text-purple-400" />,
  operator_joined: <UserPlus className="h-4 w-4 text-cyan-400" />,
}

const ACTION_LABELS: Record<OrchestrationActivityType, string> = {
  task_completed: 'completed',
  task_flagged: 'flagged',
  task_note_added: 'added note to',
  checkpoint_passed: 'passed checkpoint',
  checkpoint_failed: 'failed checkpoint',
  announcement_sent: 'sent announcement',
  operator_joined: 'joined the event',
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now()
  const diffMs = now - timestamp
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return new Date(timestamp).toLocaleDateString()
}

function formatActivityMessage(activity: OrchestrationActivityLog): string {
  const actor = activity.operator_label || activity.operator_id.split('-').slice(-1)[0]
  const action = ACTION_LABELS[activity.action_type]

  switch (activity.action_type) {
    case 'task_completed':
    case 'task_flagged':
    case 'task_note_added':
      return `${actor} ${action} "${activity.task_title || 'a task'}"`
    case 'checkpoint_passed':
    case 'checkpoint_failed':
      return `${actor} ${action} for ${activity.phase || 'unknown'} phase`
    case 'announcement_sent':
      const msg = activity.details?.message as string | undefined
      return `${actor} ${action}: "${msg?.substring(0, 30) || '...'}${msg && msg.length > 30 ? '...' : ''}"`
    case 'operator_joined':
      return `${actor} ${action}`
    default:
      return `${actor} performed an action`
  }
}

export function ActivityFeed({
  eventId,
  operatorId,
  pollingInterval = 5000,
}: ActivityFeedProps) {
  const [activities, setActivities] = useState<OrchestrationActivityLog[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchActivities = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        event_id: eventId,
        include: 'activity',
      })
      if (operatorId) {
        params.set('operator_id', operatorId)
      }

      const response = await fetch(`/api/orchestration/action?${params}`)
      const data = await response.json()

      if (data.success && data.data.activity) {
        setActivities(data.data.activity)
      }
    } catch (error) {
      console.error('Failed to fetch activity:', error)
    } finally {
      setIsLoading(false)
    }
  }, [eventId, operatorId])

  useEffect(() => {
    fetchActivities()
    const interval = setInterval(fetchActivities, pollingInterval)
    return () => clearInterval(interval)
  }, [fetchActivities, pollingInterval])

  return (
    <Card className="border-white/15 bg-[#1a1528]/60 backdrop-blur-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-purple-200">
          <Activity className="h-4 w-4" />
          Activity Feed
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
            </div>
          ) : activities.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No activity yet
            </p>
          ) : (
            <AnimatePresence>
              {activities.slice(0, 20).map((activity, index) => (
                <motion.div
                  key={activity.log_id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="flex items-start gap-3 border-b border-white/5 py-2.5 last:border-0"
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {ACTION_ICONS[activity.action_type]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-300">
                      {formatActivityMessage(activity)}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                      <Clock className="h-3 w-3" />
                      {formatTimeAgo(activity.timestamp)}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
