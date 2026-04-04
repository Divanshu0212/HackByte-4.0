'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  ArrowLeft,
  RefreshCw,
  Settings,
  Calendar,
  MapPin,
  Users,
  Volume2,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PhaseBoard } from '@/components/orchestration/phase-board'
import { TaskCard } from '@/components/orchestration/task-card'
import { ProgressRing } from '@/components/orchestration/progress-ring'
import { OperatorCodesDisplay } from '@/components/orchestration/operator-codes-display'
import { TaskManagement } from '@/components/orchestration/task-management'
import type { OrchestrationEvent, OrchestrationTask, OrchestrationSession, OrchestrationPhaseId } from '@/types'

export default function DashboardPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string

  const [event, setEvent] = useState<OrchestrationEvent | null>(null)
  const [session, setSession] = useState<OrchestrationSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedTask, setSelectedTask] = useState<OrchestrationTask | null>(null)
  const [showOperatorCodes, setShowOperatorCodes] = useState(false)

  // Load session from localStorage
  useEffect(() => {
    const storedSession = localStorage.getItem('elixa:orchestration:session')
    if (storedSession) {
      try {
        const parsed = JSON.parse(storedSession) as OrchestrationSession
        if (parsed.event_id === eventId && parsed.role === 'director') {
          setSession(parsed)
        }
      } catch {
        // Invalid session
      }
    }
  }, [eventId])

  // Fetch event data
  const fetchEvent = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/orchestration/action?event_id=${eventId}${session ? `&operator_id=${session.operator_id}` : ''}`
      )
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch event')
      }

      setEvent(data.data)
    } catch (error) {
      console.error('Fetch error:', error)
      toast.error('Failed to load event data')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [eventId, session])

  useEffect(() => {
    fetchEvent()
    // Poll for updates every 10 seconds
    const interval = setInterval(fetchEvent, 10000)
    return () => clearInterval(interval)
  }, [fetchEvent])

  const handleRefresh = () => {
    setIsRefreshing(true)
    fetchEvent()
  }

  const handleCompleteTask = async (taskId: string, notes?: string) => {
    if (!session) {
      toast.error('Not authenticated')
      return
    }

    try {
      const response = await fetch('/api/orchestration/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_type: 'complete_task',
          payload: {
            event_id: eventId,
            task_id: taskId,
            operator_id: session.operator_id,
            notes,
          },
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to complete task')
      }

      toast.success('Task completed!')

      // Optimistic update
      if (event) {
        const updatedTasks = event.tasks.map((t) =>
          t.task_id === taskId ? { ...t, status: 'completed' as const, completed_at: Date.now() } : t
        )
        // Unlock dependent tasks
        if (data.data.unlocked_tasks?.length > 0) {
          data.data.unlocked_tasks.forEach((unlockedId: string) => {
            const idx = updatedTasks.findIndex((t) => t.task_id === unlockedId)
            if (idx !== -1) {
              updatedTasks[idx] = { ...updatedTasks[idx], status: 'available' }
            }
          })
          toast.info(`${data.data.unlocked_tasks.length} task(s) unlocked!`)
        }
        setEvent({ ...event, tasks: updatedTasks })
      }

      setSelectedTask(null)
    } catch (error) {
      console.error('Complete error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to complete task')
    }
  }

  const handleFlagBlocker = async (taskId: string, reason: string) => {
    if (!session) {
      toast.error('Not authenticated')
      return
    }

    try {
      const response = await fetch('/api/orchestration/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_type: 'flag_blocker',
          payload: {
            event_id: eventId,
            task_id: taskId,
            operator_id: session.operator_id,
            reason,
          },
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to flag blocker')
      }

      toast.success('Task flagged as blocked')

      // Optimistic update
      if (event) {
        const updatedTasks = event.tasks.map((t) =>
          t.task_id === taskId ? { ...t, status: 'blocked' as const, notes: reason } : t
        )
        setEvent({ ...event, tasks: updatedTasks })
      }

      setSelectedTask(null)
    } catch (error) {
      console.error('Flag error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to flag blocker')
    }
  }

  const handleAddNote = async (taskId: string, note: string) => {
    if (!session) {
      toast.error('Not authenticated')
      return
    }

    try {
      const response = await fetch('/api/orchestration/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_type: 'add_note',
          payload: {
            event_id: eventId,
            task_id: taskId,
            operator_id: session.operator_id,
            notes: note,
          },
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to add note')
      }

      toast.success('Note added')

      // Optimistic update
      if (event) {
        const updatedTasks = event.tasks.map((t) =>
          t.task_id === taskId ? { ...t, notes: note } : t
        )
        setEvent({ ...event, tasks: updatedTasks })
      }
    } catch (error) {
      console.error('Note error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to add note')
    }
  }

  const handlePassCheckpoint = async (phase: OrchestrationPhaseId) => {
    if (!session) {
      toast.error('Not authenticated')
      return
    }

    try {
      const response = await fetch('/api/orchestration/checkpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          phase,
          action: 'pass',
          director_id: session.operator_id,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to pass checkpoint')
      }

      toast.success(`${phase} checkpoint passed!`)

      // Voice announcement for go/no-go
      if (phase === 'gonogo' && event) {
        speak(`All systems confirmed. ${event.name} is ready to launch.`)
      }

      // Refresh event data
      fetchEvent()
    } catch (error) {
      console.error('Checkpoint error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to pass checkpoint')
    }
  }

  // Simple TTS function
  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.9
      window.speechSynthesis.speak(utterance)
    }
  }

  // Calculate progress
  const progress = event
    ? {
        total: event.tasks.length,
        completed: event.tasks.filter((t) => t.status === 'completed').length,
        percentage: Math.round(
          (event.tasks.filter((t) => t.status === 'completed').length / event.tasks.length) * 100
        ),
      }
    : { total: 0, completed: 0, percentage: 0 }

  if (isLoading) {
    return (
      <main
        className="min-h-screen bg-[#06040d] text-slate-100 flex items-center justify-center"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 10%, rgba(124,58,237,0.24), transparent 35%), radial-gradient(circle at 80% 20%, rgba(168,85,247,0.2), transparent 30%), linear-gradient(120deg, #06040d 0%, #0c0818 45%, #1a1528 100%)',
        }}
      >
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-violet-400 mx-auto mb-4" />
          <p className="text-slate-400">Loading event...</p>
        </div>
      </main>
    )
  }

  if (!event) {
    return (
      <main
        className="min-h-screen bg-[#06040d] text-slate-100 flex items-center justify-center"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 10%, rgba(124,58,237,0.24), transparent 35%), radial-gradient(circle at 80% 20%, rgba(168,85,247,0.2), transparent 30%), linear-gradient(120deg, #06040d 0%, #0c0818 45%, #1a1528 100%)',
        }}
      >
        <div className="text-center">
          <p className="text-xl text-slate-300 mb-4">Event not found</p>
          <Link href="/event-orchestration/setup">
            <Button>Create New Event</Button>
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main
      className="min-h-screen bg-[#06040d] text-slate-100"
      style={{
        backgroundImage:
          'radial-gradient(circle at 20% 10%, rgba(124,58,237,0.24), transparent 35%), radial-gradient(circle at 80% 20%, rgba(168,85,247,0.2), transparent 30%), linear-gradient(120deg, #06040d 0%, #0c0818 45%, #1a1528 100%)',
      }}
    >
      <div className="mx-auto max-w-7xl px-6 pb-20 pt-10 sm:px-10">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <Link
                href="/event-orchestration"
                className="mb-2 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-purple-300"
              >
                <ArrowLeft className="h-4 w-4" />
                Command Deck
              </Link>
              <h1 className="text-3xl font-bold text-white">{event.name}</h1>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-slate-400">
                {event.date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4 text-violet-400" />
                    {new Date(event.date).toLocaleDateString()}
                  </span>
                )}
                {event.venue && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4 text-violet-400" />
                    {event.venue}
                  </span>
                )}
                {event.participant_count > 0 && (
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4 text-violet-400" />
                    {event.participant_count} participants
                  </span>
                )}
                <Badge
                  variant="outline"
                  className={
                    event.status === 'completed'
                      ? 'border-emerald-500/30 text-emerald-300'
                      : 'border-violet-500/30 text-violet-300'
                  }
                >
                  {event.status}
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="border-white/20 text-slate-300 hover:bg-white/10"
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowOperatorCodes(!showOperatorCodes)}
                className="border-white/20 text-slate-300 hover:bg-white/10"
              >
                <Settings className="h-4 w-4 mr-1" />
                Codes
              </Button>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          {/* Main Content */}
          <div className="space-y-6">
            {/* Phase Board */}
            <PhaseBoard
              tasks={event.tasks}
              checkpoints={event.checkpoints}
              onTaskSelect={setSelectedTask}
              onPassCheckpoint={handlePassCheckpoint}
              isDirector={session?.role === 'director'}
            />

            {/* Selected Task Detail */}
            {selectedTask && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <TaskCard
                  task={selectedTask}
                  onComplete={handleCompleteTask}
                  onFlagBlocker={handleFlagBlocker}
                  onAddNote={handleAddNote}
                  showPhase
                  disabled={session?.role !== 'director'}
                />
              </motion.div>
            )}

            {/* Operator Codes Panel */}
            {showOperatorCodes && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <OperatorCodesDisplay
                  operators={event.operators as any}
                  eventId={event.event_id}
                  eventName={event.name}
                />
              </motion.div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Progress Ring */}
            <Card className="border-white/15 bg-slate-900/60 backdrop-blur-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-400 uppercase tracking-wide">
                  Overall Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center pb-6">
                <ProgressRing percentage={progress.percentage} />
                <p className="mt-4 text-center text-sm text-slate-400">
                  {progress.completed} of {progress.total} tasks complete
                </p>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card className="border-white/15 bg-[#1a1528]/60 backdrop-blur-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-400 uppercase tracking-wide">
                  Task Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { label: 'Available', count: event.tasks.filter((t) => t.status === 'available').length, color: 'text-violet-400' },
                  { label: 'Completed', count: event.tasks.filter((t) => t.status === 'completed').length, color: 'text-emerald-400' },
                  { label: 'Blocked', count: event.tasks.filter((t) => t.status === 'blocked').length, color: 'text-red-400' },
                  { label: 'Locked', count: event.tasks.filter((t) => t.status === 'locked').length, color: 'text-slate-400' },
                ].map((stat) => (
                  <div key={stat.label} className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">{stat.label}</span>
                    <span className={`font-mono font-medium ${stat.color}`}>{stat.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Checkpoints */}
            <Card className="border-white/15 bg-[#1a1528]/60 backdrop-blur-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-400 uppercase tracking-wide">
                  Checkpoints
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {event.checkpoints.map((cp) => (
                  <div
                    key={cp.checkpoint_id}
                    className={`flex items-center justify-between rounded-lg p-2 text-sm ${
                      cp.status === 'passed'
                        ? 'bg-emerald-500/10'
                        : cp.status === 'available'
                        ? 'bg-violet-500/10'
                        : 'bg-white/5'
                    }`}
                  >
                    <span className="text-slate-300 capitalize">{cp.phase.replace('_', ' ')}</span>
                    <Badge
                      variant="outline"
                      className={
                        cp.status === 'passed'
                          ? 'border-emerald-500/30 text-emerald-300'
                          : cp.status === 'available'
                          ? 'border-violet-500/30 text-violet-300'
                          : 'border-white/20 text-slate-400'
                      }
                    >
                      {cp.status}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Task Management (Director Only) */}
            {session?.role === 'director' && (
              <TaskManagement
                eventId={eventId}
                operatorId={session.operator_id}
                tasks={event.tasks}
                onTasksUpdated={handleRefresh}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
