'use client'

import { useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowUp,
  ArrowDown,
  Snowflake,
  Flame,
  Shield,
  UserMinus,
  Timer,
  Megaphone,
  Undo2,
  Zap,
  Plus,
} from 'lucide-react'
import type { VoiceAction } from '@/types'

export interface ActivityEntry {
  id: string
  timestamp: number
  action: string
  description: string
  source: 'pattern' | 'agent'
}

function getIcon(action: string) {
  if (action.includes('score') || action === 'update_score') return <ArrowUp className="w-3.5 h-3.5" />
  if (action === 'add_participants') return <Plus className="w-3.5 h-3.5" />
  if (action === 'freeze') return <Snowflake className="w-3.5 h-3.5" />
  if (action === 'thaw') return <Flame className="w-3.5 h-3.5" />
  if (action === 'eliminate' || action === 'disqualify') return <UserMinus className="w-3.5 h-3.5" />
  if (action === 'timer') return <Timer className="w-3.5 h-3.5" />
  if (action === 'announce') return <Megaphone className="w-3.5 h-3.5" />
  if (action === 'undo') return <Undo2 className="w-3.5 h-3.5" />
  if (action.includes('round')) return <Zap className="w-3.5 h-3.5" />
  return <ArrowDown className="w-3.5 h-3.5" />
}

function getColor(action: string) {
  if (action.includes('plus') || action === 'update_score') return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30'
  if (action === 'freeze') return 'text-blue-600 bg-blue-50 dark:bg-blue-950/30'
  if (action === 'thaw') return 'text-orange-600 bg-orange-50 dark:bg-orange-950/30'
  if (action === 'eliminate' || action === 'disqualify') return 'text-red-600 bg-red-50 dark:bg-red-950/30'
  if (action === 'add_participants') return 'text-violet-600 bg-violet-50 dark:bg-violet-950/30'
  return 'text-muted-foreground bg-muted/50'
}

function timeAgo(timestamp: number) {
  const diff = Math.floor((Date.now() - timestamp) / 1000)
  if (diff < 5) return 'just now'
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

interface ActivityFeedProps {
  entries: ActivityEntry[]
}

export function ActivityFeed({ entries }: ActivityFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [entries.length])

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <Zap className="w-8 h-8 text-muted-foreground/30 mb-2" />
        <p className="text-xs text-muted-foreground">No activity yet</p>
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="max-h-[200px] overflow-y-auto space-y-1.5 pr-1">
      <AnimatePresence mode="popLayout" initial={false}>
        {entries.slice(0, 20).map((entry) => (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/30 transition-colors"
          >
            <div className={`p-1.5 rounded-md ${getColor(entry.action)}`}>
              {getIcon(entry.action)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{entry.description}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                entry.source === 'pattern'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                  : 'bg-violet-100 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400'
              }`}>
                {entry.source === 'pattern' ? '⚡' : '🧠'}
              </span>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {timeAgo(entry.timestamp)}
              </span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

/** Build an ActivityEntry from actions */
export function actionsToEntry(
  actions: VoiceAction[],
  source: 'pattern' | 'agent',
  teams: Array<{ id: string; name: string }>
): ActivityEntry | null {
  if (actions.length === 0) return null

  const firstAction = actions[0]
  const teamName = (id: string) => teams.find(t => t.id === id)?.name || id

  let description = ''
  let actionType: string = firstAction.action

  switch (firstAction.action) {
    case 'add_participants':
      if ('teams' in firstAction && Array.isArray(firstAction.teams)) {
        description = `Added ${firstAction.teams.length} team${firstAction.teams.length > 1 ? 's' : ''}: ${firstAction.teams.map(t => t.name).join(', ')}`
      } else if ('count' in firstAction) {
        description = `Added ${firstAction.count} teams`
      }
      break
    case 'update_score':
      description = `${teamName(firstAction.id)} ${firstAction.delta > 0 ? '+' : ''}${firstAction.delta} points`
      break
    case 'set_score':
      description = `${teamName(firstAction.id)} score set to ${firstAction.score}`
      break
    case 'freeze_team':
      description = `${teamName(firstAction.id)} frozen`
      actionType = 'freeze'
      break
    case 'thaw_team':
      description = `${teamName(firstAction.id)} thawed`
      actionType = 'thaw'
      break
    case 'eliminate_team':
      description = `${teamName(firstAction.id)} eliminated`
      actionType = 'eliminate'
      break
    case 'disqualify_team':
      description = `${teamName(firstAction.id)} disqualified`
      actionType = 'disqualify'
      break
    case 'timer':
      description = `Timer ${firstAction.state}${firstAction.duration ? ` (${firstAction.duration}s)` : ''}`
      break
    case 'start_round':
      description = `Round ${firstAction.round} started`
      break
    case 'end_round':
      description = 'Round ended'
      break
    case 'create_announcement':
      description = `Announced: ${firstAction.message}`
      actionType = 'announce'
      break
    case 'undo':
      description = 'Last action undone'
      break
    case 'redo':
      description = 'Action redone'
      break
    default:
      description = `${actions.length} action${actions.length > 1 ? 's' : ''} applied`
  }

  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    action: actionType,
    description,
    source,
  }
}
