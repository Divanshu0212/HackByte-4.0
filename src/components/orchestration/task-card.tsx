'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  CheckCircle2,
  Lock,
  AlertCircle,
  Clock,
  User,
  Flag,
  MessageSquare,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PHASE_LABELS } from '@/lib/orchestration-agent'
import type { OrchestrationTask, OrchestrationTaskStatus, OrchestrationTaskPriority } from '@/types'

interface TaskCardProps {
  task: OrchestrationTask
  onComplete?: (taskId: string, notes?: string) => Promise<void>
  onFlagBlocker?: (taskId: string, reason: string) => Promise<void>
  onAddNote?: (taskId: string, note: string) => Promise<void>
  showPhase?: boolean
  disabled?: boolean
}

const statusConfig: Record<
  OrchestrationTaskStatus,
  { bg: string; border: string; text: string; icon: typeof CheckCircle2 }
> = {
  locked: {
    bg: 'bg-slate-800/50',
    border: 'border-white/10',
    text: 'text-slate-400',
    icon: Lock,
  },
  available: {
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/30',
    text: 'text-purple-300',
    icon: Clock,
  },
  in_progress: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-300',
    icon: Clock,
  },
  completed: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-300',
    icon: CheckCircle2,
  },
  blocked: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-300',
    icon: AlertCircle,
  },
}

const priorityColors: Record<OrchestrationTaskPriority, string> = {
  critical: 'bg-red-500/20 text-red-300 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  low: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
}

export function TaskCard({
  task,
  onComplete,
  onFlagBlocker,
  onAddNote,
  showPhase = false,
  disabled = false,
}: TaskCardProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [showBlockerInput, setShowBlockerInput] = useState(false)
  const [noteText, setNoteText] = useState(task.notes || '')
  const [blockerReason, setBlockerReason] = useState('')

  const config = statusConfig[task.status]
  const StatusIcon = config.icon
  const canComplete = task.status === 'available' || task.status === 'in_progress'
  const canFlag = task.status !== 'completed' && task.status !== 'locked'

  const handleComplete = async () => {
    if (!onComplete || isLoading) return
    setIsLoading(true)
    try {
      await onComplete(task.task_id, noteText || undefined)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFlagBlocker = async () => {
    if (!onFlagBlocker || !blockerReason.trim() || isLoading) return
    setIsLoading(true)
    try {
      await onFlagBlocker(task.task_id, blockerReason)
      setShowBlockerInput(false)
      setBlockerReason('')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveNote = async () => {
    if (!onAddNote || isLoading) return
    setIsLoading(true)
    try {
      await onAddNote(task.task_id, noteText)
      setShowNoteInput(false)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <Card className={`${config.bg} border ${config.border}`}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <StatusIcon className={`h-5 w-5 ${config.text}`} />
              <CardTitle className={`text-base ${config.text}`}>{task.title}</CardTitle>
            </div>
            <Badge variant="outline" className={`text-xs ${priorityColors[task.priority]}`}>
              {task.priority}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <p className="text-sm text-slate-300">{task.description}</p>

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
            {showPhase && (
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                {PHASE_LABELS[task.phase]}
              </span>
            )}
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {task.assigned_role.replace('_', ' ')}
            </span>
            {task.deadline && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(task.deadline).toLocaleDateString()}
              </span>
            )}
            {task.completed_at && (
              <span className="flex items-center gap-1 text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                Completed {new Date(task.completed_at).toLocaleString()}
              </span>
            )}
          </div>

          {/* Dependencies info */}
          {task.status === 'locked' && task.depends_on.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-amber-400">
              <Lock className="h-3 w-3" />
              Waiting for {task.depends_on.length} task(s) to complete
            </div>
          )}

          {/* Notes */}
          {task.notes && !showNoteInput && (
            <div className="rounded-lg bg-white/5 p-2 text-sm text-slate-300">
              <span className="text-xs text-slate-500">Note: </span>
              {task.notes}
            </div>
          )}

          {/* Note Input */}
          {showNoteInput && (
            <div className="space-y-2">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note..."
                rows={2}
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-400/50 focus:outline-none"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveNote}
                  disabled={isLoading}
                  className="bg-violet-500/20 text-purple-300 hover:bg-violet-500/30"
                >
                  {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save Note'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowNoteInput(false)}
                  className="text-slate-400 hover:text-slate-300"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Blocker Input */}
          {showBlockerInput && (
            <div className="space-y-2">
              <textarea
                value={blockerReason}
                onChange={(e) => setBlockerReason(e.target.value)}
                placeholder="Describe what's blocking this task..."
                rows={2}
                className="w-full rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-red-400/50 focus:outline-none"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleFlagBlocker}
                  disabled={isLoading || !blockerReason.trim()}
                  className="bg-red-500/20 text-red-300 hover:bg-red-500/30"
                >
                  {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Flag Blocked'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowBlockerInput(false)}
                  className="text-slate-400 hover:text-slate-300"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Actions */}
          {!showNoteInput && !showBlockerInput && task.status !== 'completed' && !disabled && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
              {canComplete && (
                <Button
                  size="sm"
                  onClick={handleComplete}
                  disabled={isLoading}
                  className="bg-gradient-to-r from-emerald-500 to-purple-500 text-white hover:from-emerald-600 hover:to-purple-600"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Mark Complete
                    </>
                  )}
                </Button>
              )}
              {canFlag && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowBlockerInput(true)}
                  className="border-red-500/30 text-red-300 hover:bg-red-500/10"
                >
                  <Flag className="h-4 w-4 mr-1" />
                  Flag Blocker
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowNoteInput(true)}
                className="text-slate-400 hover:text-slate-300"
              >
                <MessageSquare className="h-4 w-4 mr-1" />
                Add Note
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
