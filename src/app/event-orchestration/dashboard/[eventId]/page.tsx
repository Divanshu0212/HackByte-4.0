'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
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
import { PHASE_LABELS } from '@/lib/orchestration-agent'
import { AnnouncementsPanel } from '@/components/orchestration/announcements-panel'
import { ActivityFeed } from '@/components/orchestration/activity-feed'
import { AnnouncementBar } from '@/components/orchestration/announcement-bar'
import { announceCheckpointPassed } from '@/lib/speak'
import type { OrchestrationEvent, OrchestrationTask, OrchestrationSession, OrchestrationPhaseId, OrchestrationAnnouncement } from '@/types'

export default function DashboardPage() {
  const params = useParams()
  const eventId = params.eventId as string

  const [event, setEvent] = useState<OrchestrationEvent | null>(null)
  const [session, setSession] = useState<OrchestrationSession | null>(null)
  const [announcements, setAnnouncements] = useState<OrchestrationAnnouncement[]>([])
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

  // Fetch event data with announcements
  const fetchEvent = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/orchestration/action?event_id=${eventId}${session ? `&operator_id=${session.operator_id}` : ''}&include=announcements`
      )
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch event')
      }

      setEvent(data.data.event || data.data) // Support both new and old response format
      if (data.data.announcements) {
        setAnnouncements(data.data.announcements)
      } else if (data.data.event?.announcements) {
        setAnnouncements(data.data.event.announcements)
      }
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

  useEffect(() => {
    if (!event || !selectedTask) return

    const latestSelectedTask = event.tasks.find((task) => task.task_id === selectedTask.task_id)
    if (!latestSelectedTask) {
      setSelectedTask(null)
      return
    }

    if (latestSelectedTask !== selectedTask) {
      setSelectedTask(latestSelectedTask)
    }
  }, [event, selectedTask])

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

      // Voice announcement for checkpoint
      if (event) {
        announceCheckpointPassed(phase, event.name)
      }

      // Refresh event data
      fetchEvent()
    } catch (error) {
      console.error('Checkpoint error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to pass checkpoint')
    }
  }

  // Calculate progress
  const progress = event
    ? {
        total: event.tasks.length,
        completed: event.tasks.filter((t) => t.status === 'completed').length,
        percentage:
          event.tasks.length > 0
            ? Math.round(
                (event.tasks.filter((t) => t.status === 'completed').length / event.tasks.length) *
                  100
              )
            : 0,
      }
    : { total: 0, completed: 0, percentage: 0 }

  const availableTasks = event?.tasks.filter((task) => task.status === 'available').length ?? 0
  const inProgressTasks = event?.tasks.filter((task) => task.status === 'in_progress').length ?? 0
  const blockedTasks = event?.tasks.filter((task) => task.status === 'blocked').length ?? 0
  const lockedTasks = event?.tasks.filter((task) => task.status === 'locked').length ?? 0
  const criticalOpenTasks =
    event?.tasks.filter((task) => task.priority === 'critical' && task.status !== 'completed').length ?? 0
  const passedCheckpoints = event?.checkpoints.filter((checkpoint) => checkpoint.status === 'passed').length ?? 0
  const readyCheckpoints = event?.checkpoints.filter((checkpoint) => checkpoint.status === 'available').length ?? 0
  const nextCheckpoint = event?.checkpoints.find((checkpoint) => checkpoint.status === 'available') ?? null
  const operatorCount = event?.operators.length ?? 0
  const isDirector = session?.role === 'director'
  const statusBadgeClass =
    event?.status === 'completed'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
      : event?.status === 'active'
      ? 'border-sky-500/30 bg-sky-500/10 text-sky-300'
      : 'border-violet-500/30 bg-violet-500/10 text-violet-300'
  const taskPulse = [
    { label: 'Ready', count: availableTasks, tone: 'text-violet-300' },
    { label: 'In Progress', count: inProgressTasks, tone: 'text-amber-300' },
    { label: 'Blocked', count: blockedTasks, tone: 'text-red-300' },
    { label: 'Locked', count: lockedTasks, tone: 'text-slate-400' },
  ]

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
      <div className="mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6 lg:px-8 lg:pt-8">
        {/* Announcement Bar */}
        <AnnouncementBar announcements={announcements} />

        <header className="mb-8">
          <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-5 shadow-2xl shadow-black/20 backdrop-blur-sm lg:p-8">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-start">
              <div className="space-y-5">
                <Link
                  href="/event-orchestration"
                  className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-violet-300"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to command deck
                </Link>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={statusBadgeClass}>
                    {event.status}
                  </Badge>
                  <Badge variant="outline" className="border-white/15 bg-white/5 text-slate-300">
                    {isDirector ? 'Director console' : 'Read-only task view'}
                  </Badge>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-violet-300">Live operations</p>
                  <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
                    {event.name}
                  </h1>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
                    {event.description?.trim()
                      ? event.description
                      : 'Monitor phase progress, clear blockers, and move checkpoints without bouncing between disconnected panels.'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 text-sm text-slate-300">
                  {event.date && (
                    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2">
                      <Calendar className="h-4 w-4 text-violet-400" />
                      {new Date(event.date).toLocaleDateString()}
                    </div>
                  )}
                  {event.venue && (
                    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2">
                      <MapPin className="h-4 w-4 text-violet-400" />
                      {event.venue}
                    </div>
                  )}
                  {event.participant_count > 0 && (
                    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2">
                      <Users className="h-4 w-4 text-violet-400" />
                      {event.participant_count} participants
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="border-white/20 bg-white/5 text-slate-200 hover:bg-white/10"
                  >
                    <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Refresh board
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowOperatorCodes((value) => !value)}
                    className="border-white/20 bg-white/5 text-slate-200 hover:bg-white/10"
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    {showOperatorCodes ? 'Hide operator codes' : 'Show operator codes'}
                  </Button>
                </div>
              </div>

              <Card className="border-white/10 bg-slate-950/40 shadow-lg shadow-black/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm uppercase tracking-[0.25em] text-slate-400">
                    Mission Progress
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4 pb-6 text-center">
                  <ProgressRing percentage={progress.percentage} />
                  <div className="space-y-1">
                    <p className="text-2xl font-semibold text-white">{progress.percentage}% complete</p>
                    <p className="text-sm text-slate-400">
                      {progress.completed} of {progress.total} tasks finished
                    </p>
                  </div>
                  <div className="grid w-full grid-cols-2 gap-3 text-left">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Critical open</p>
                      <p className="mt-1 text-xl font-semibold text-white">{criticalOpenTasks}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Operators</p>
                      <p className="mt-1 text-xl font-semibold text-white">{operatorCount}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Card className="border-white/10 bg-slate-950/35">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm uppercase tracking-[0.25em] text-slate-400">
                    Task Pulse
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  {taskPulse.map((stat) => (
                    <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">{stat.label}</p>
                      <p className={`mt-2 text-2xl font-semibold ${stat.tone}`}>{stat.count}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-slate-950/35">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm uppercase tracking-[0.25em] text-slate-400">
                    Checkpoint Control
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Next review</p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {nextCheckpoint ? nextCheckpoint.name : 'No open checkpoint'}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      {nextCheckpoint
                        ? `${PHASE_LABELS[nextCheckpoint.phase]} is ready for sign-off.`
                        : `${passedCheckpoints} of ${event.checkpoints.length} checkpoints cleared.`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                      {passedCheckpoints} passed
                    </Badge>
                    <Badge variant="outline" className="border-violet-500/30 bg-violet-500/10 text-violet-300">
                      {readyCheckpoints} ready
                    </Badge>
                    <Badge variant="outline" className="border-white/15 bg-white/5 text-slate-300">
                      {event.checkpoints.length - passedCheckpoints - readyCheckpoints} locked
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-slate-950/35 md:col-span-2 xl:col-span-1">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm uppercase tracking-[0.25em] text-slate-400">
                    Team Access
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Signed in as</p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {session?.label ?? 'Session not detected'}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      {isDirector
                        ? 'You can pass checkpoints, manage tasks, and distribute operator codes.'
                        : 'You can review the board, but editing controls stay locked to the director session.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowOperatorCodes((value) => !value)}
                      className="border-white/20 text-slate-200 hover:bg-white/10"
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      {showOperatorCodes ? 'Hide codes' : 'Open codes'}
                    </Button>
                    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300">
                      {operatorCount} active access codes
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </header>

        {isDirector && (
          <section className="mb-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-4">
              <div className="flex flex-col gap-3 rounded-[28px] border border-violet-500/20 bg-[linear-gradient(135deg,rgba(124,58,237,0.16),rgba(15,23,42,0.45))] p-5 shadow-xl shadow-violet-950/20 sm:flex-row sm:items-end sm:justify-between lg:p-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-violet-300">Director Controls</p>
                  <h2 className="mt-2 text-2xl font-bold text-white">Task Management</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                    Create, reorder, and tune task dependencies here before sending the team back into execution mode.
                    This stays front and center so you can adjust the plan without hunting through the dashboard.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3 sm:min-w-[260px]">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
                    <p className="mt-2 text-xl font-semibold text-white">{progress.total}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Open</p>
                    <p className="mt-2 text-xl font-semibold text-violet-300">
                      {availableTasks + inProgressTasks + blockedTasks}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Blocked</p>
                    <p className="mt-2 text-xl font-semibold text-red-300">{blockedTasks}</p>
                  </div>
                </div>
              </div>

              <TaskManagement
                eventId={eventId}
                operatorId={session.operator_id}
                tasks={event.tasks}
                onTasksUpdated={handleRefresh}
              />
            </div>

            <div className="space-y-6">
              <Card className="border-white/10 bg-slate-950/35">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm uppercase tracking-[0.25em] text-slate-400">
                    Planning Pulse
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Critical tasks still open</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{criticalOpenTasks}</p>
                    <p className="mt-1 text-sm text-slate-400">
                      Use task management to rebalance ownership or dependencies before the next checkpoint review.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Ready</p>
                      <p className="mt-2 text-xl font-semibold text-violet-300">{availableTasks}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Locked</p>
                      <p className="mt-2 text-xl font-semibold text-slate-300">{lockedTasks}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-slate-950/35">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm uppercase tracking-[0.25em] text-slate-400">
                    Workflow Hint
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-slate-300">
                  <p className="leading-6">
                    Adjust tasks here first, then use the phase board below to track execution against the updated plan.
                  </p>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-400">
                    Edit titles, roles, and dependencies in one place before opening individual task detail cards.
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>
        )}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <Card className="border-white/10 bg-[#140f22]/70 shadow-xl shadow-black/20 backdrop-blur-sm">
              <CardHeader className="border-b border-white/10 pb-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <CardTitle className="text-xl text-white">Phase Command Board</CardTitle>
                    <p className="mt-2 text-sm text-slate-400">
                      Review the six orchestration phases, open the active task list, and move checkpoints once the required work is complete.
                    </p>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300">
                    {selectedTask ? `Focused task: ${selectedTask.title}` : 'Select a task to inspect its detail panel'}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <PhaseBoard
                  tasks={event.tasks}
                  checkpoints={event.checkpoints}
                  onTaskSelect={setSelectedTask}
                  onPassCheckpoint={handlePassCheckpoint}
                  isDirector={isDirector}
                />
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-6">
            <div className="space-y-6 xl:sticky xl:top-6">
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm uppercase tracking-[0.25em] text-slate-400">Task Focus</h2>
                  {selectedTask && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedTask(null)}
                      className="h-auto px-0 text-xs text-slate-400 hover:bg-transparent hover:text-slate-200"
                    >
                      Clear selection
                    </Button>
                  )}
                </div>

                {selectedTask ? (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <TaskCard
                      task={selectedTask}
                      onComplete={handleCompleteTask}
                      onFlagBlocker={handleFlagBlocker}
                      onAddNote={handleAddNote}
                      showPhase
                      disabled={!isDirector}
                    />
                  </motion.div>
                ) : (
                  <Card className="border-dashed border-white/15 bg-slate-950/35">
                    <CardContent className="space-y-4 p-6">
                      <p className="text-sm leading-6 text-slate-300">
                        Pick a task from the phase board to review the brief, add notes, or resolve blockers from a dedicated focus panel.
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <p className="text-xs uppercase tracking-wide text-slate-500">Ready now</p>
                          <p className="mt-2 text-xl font-semibold text-violet-300">{availableTasks}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <p className="text-xs uppercase tracking-wide text-slate-500">Need attention</p>
                          <p className="mt-2 text-xl font-semibold text-red-300">{blockedTasks}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </section>

              <Card className="border-white/10 bg-slate-950/35">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm uppercase tracking-[0.25em] text-slate-400">
                    Checkpoint Pulse
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {event.checkpoints.map((checkpoint) => (
                    <div
                      key={checkpoint.checkpoint_id}
                      className={`rounded-2xl border p-3 ${
                        checkpoint.status === 'passed'
                          ? 'border-emerald-500/20 bg-emerald-500/10'
                          : checkpoint.status === 'available'
                          ? 'border-violet-500/20 bg-violet-500/10'
                          : 'border-white/10 bg-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-white">{checkpoint.name}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {PHASE_LABELS[checkpoint.phase]}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            checkpoint.status === 'passed'
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                              : checkpoint.status === 'available'
                              ? 'border-violet-500/30 bg-violet-500/10 text-violet-300'
                              : 'border-white/15 bg-white/5 text-slate-400'
                          }
                        >
                          {checkpoint.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Activity Feed */}
              <ActivityFeed eventId={eventId} />

              {/* Announcements Panel (Director Only) */}
              {isDirector && session && (
                <AnnouncementsPanel
                  eventId={eventId}
                  operatorId={session.operator_id}
                  announcements={announcements}
                  isDirector={isDirector}
                  onAnnouncementSent={handleRefresh}
                />
              )}
            </div>

          </aside>
        </section>

        {showOperatorCodes && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6"
          >
            <OperatorCodesDisplay
              operators={event.operators}
              eventId={event.event_id}
              eventName={event.name}
            />
          </motion.section>
        )}
      </div>
    </main>
  )
}
