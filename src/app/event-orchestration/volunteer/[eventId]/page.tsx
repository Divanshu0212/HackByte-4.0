'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  ArrowLeft,
  RefreshCw,
  LogIn,
  Loader2,
  CheckCircle2,
  Calendar,
  User,
  LogOut,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TaskCard } from '@/components/orchestration/task-card'
import { ProgressRing } from '@/components/orchestration/progress-ring'
import { PHASE_LABELS } from '@/lib/orchestration-agent'
import type { OrchestrationEvent, OrchestrationSession, OrchestrationTask } from '@/types'

export default function VolunteerPage() {
  const params = useParams()
  const eventId = params.eventId as string

  const [event, setEvent] = useState<OrchestrationEvent | null>(null)
  const [session, setSession] = useState<OrchestrationSession | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [accessCode, setAccessCode] = useState('')
  const [tasks, setTasks] = useState<OrchestrationTask[]>([])

  // Load existing session
  useEffect(() => {
    const storedSession = localStorage.getItem(`elixa:orchestration:volunteer:${eventId}`)
    if (storedSession) {
      try {
        const parsed = JSON.parse(storedSession) as OrchestrationSession
        if (parsed.event_id === eventId) {
          setSession(parsed)
        }
      } catch {
        // Invalid session
      }
    }
  }, [eventId])

  // Fetch event data when session is available
  const fetchEvent = useCallback(async () => {
    if (!session) return

    setIsLoading(true)
    try {
      const response = await fetch(
        `/api/orchestration/action?event_id=${eventId}&operator_id=${session.operator_id}`
      )
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch event')
      }

      setEvent(data.data)
      // Tasks are already filtered to operator scope by the API
      setTasks(data.data.tasks)
    } catch (error) {
      console.error('Fetch error:', error)
      toast.error('Failed to load tasks')
    } finally {
      setIsLoading(false)
    }
  }, [eventId, session])

  useEffect(() => {
    if (session) {
      fetchEvent()
      // Poll for updates every 15 seconds
      const interval = setInterval(fetchEvent, 15000)
      return () => clearInterval(interval)
    }
  }, [session, fetchEvent])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accessCode.trim() || isAuthenticating) return

    setIsAuthenticating(true)
    try {
      const response = await fetch('/api/orchestration/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_code: accessCode.trim().toUpperCase(),
          event_id: eventId,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Invalid access code')
      }

      const newSession: OrchestrationSession = {
        operator_id: data.data.operator_id,
        event_id: data.data.event_id,
        role: data.data.role,
        scope: data.data.scope,
        label: data.data.label,
      }

      localStorage.setItem(`elixa:orchestration:volunteer:${eventId}`, JSON.stringify(newSession))
      setSession(newSession)
      setAccessCode('')
      toast.success(`Welcome, ${data.data.label}!`)
    } catch (error) {
      console.error('Auth error:', error)
      toast.error(error instanceof Error ? error.message : 'Authentication failed')
    } finally {
      setIsAuthenticating(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem(`elixa:orchestration:volunteer:${eventId}`)
    setSession(null)
    setEvent(null)
    setTasks([])
    toast.success('Logged out')
  }

  const handleCompleteTask = async (taskId: string, notes?: string) => {
    if (!session) return

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
      setTasks((prev) =>
        prev.map((t) =>
          t.task_id === taskId
            ? { ...t, status: 'completed' as const, completed_at: Date.now() }
            : t
        )
      )

      // Show any unlocked tasks
      if (data.data.unlocked_tasks?.length > 0) {
        toast.info(`${data.data.unlocked_tasks.length} task(s) unlocked!`)
        // Refresh to get updated task list
        fetchEvent()
      }
    } catch (error) {
      console.error('Complete error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to complete task')
    }
  }

  const handleFlagBlocker = async (taskId: string, reason: string) => {
    if (!session) return

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

      toast.success('Task flagged - director notified')

      // Optimistic update
      setTasks((prev) =>
        prev.map((t) =>
          t.task_id === taskId ? { ...t, status: 'blocked' as const, notes: reason } : t
        )
      )
    } catch (error) {
      console.error('Flag error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to flag blocker')
    }
  }

  const handleAddNote = async (taskId: string, note: string) => {
    if (!session) return

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
      setTasks((prev) =>
        prev.map((t) => (t.task_id === taskId ? { ...t, notes: note } : t))
      )
    } catch (error) {
      console.error('Note error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to add note')
    }
  }

  // Calculate progress for scoped tasks
  const progress = {
    total: tasks.length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    percentage:
      tasks.length > 0
        ? Math.round((tasks.filter((t) => t.status === 'completed').length / tasks.length) * 100)
        : 0,
  }

  // Group tasks by status
  const availableTasks = tasks.filter(
    (t) => t.status === 'available' || t.status === 'in_progress'
  )
  const completedTasks = tasks.filter((t) => t.status === 'completed')
  const blockedTasks = tasks.filter((t) => t.status === 'blocked')
  const lockedTasks = tasks.filter((t) => t.status === 'locked')

  return (
    <main
      className="min-h-screen bg-[#06040d] text-slate-100"
      style={{
        backgroundImage:
          'radial-gradient(circle at 20% 10%, rgba(124,58,237,0.24), transparent 35%), radial-gradient(circle at 80% 20%, rgba(168,85,247,0.2), transparent 30%), linear-gradient(120deg, #06040d 0%, #0c0818 45%, #1a1528 100%)',
      }}
    >
      <div className="mx-auto max-w-2xl px-6 pb-20 pt-10 sm:px-10">
        {/* Header */}
        <header className="mb-8">
          <Link
            href="/event-orchestration"
            className="mb-4 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-purple-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-purple-200">ELIXA</p>
              <h1 className="text-2xl font-bold text-white">
                {event?.name || 'Volunteer Portal'}
              </h1>
            </div>
            {session && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleLogout}
                className="text-slate-400 hover:text-slate-300"
              >
                <LogOut className="h-4 w-4 mr-1" />
                Logout
              </Button>
            )}
          </div>
        </header>

        {/* Login Form */}
        {!session ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="border-white/15 bg-[#1a1528]/60 backdrop-blur-md">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/30 to-purple-500/30">
                  <LogIn className="h-8 w-8 text-purple-300" />
                </div>
                <CardTitle className="text-xl text-white">Enter Access Code</CardTitle>
                <CardDescription className="text-slate-400">
                  Enter the access code provided by your event organizer
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <input
                    type="text"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                    placeholder="e.g., OP-VEN-4A2B"
                    className="w-full rounded-lg border border-white/15 bg-black/30 px-4 py-3 text-center font-mono text-lg tracking-wider text-slate-100 placeholder:text-slate-500 focus:border-violet-400/50 focus:outline-none focus:ring-1 focus:ring-violet-400/50"
                    maxLength={15}
                    autoFocus
                  />
                  <Button
                    type="submit"
                    disabled={!accessCode.trim() || isAuthenticating}
                    className="w-full bg-gradient-to-r from-violet-500 to-purple-500 text-white hover:from-violet-600 hover:to-purple-600"
                  >
                    {isAuthenticating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <LogIn className="h-4 w-4 mr-2" />
                        Access Tasks
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          /* Authenticated View */
          <div className="space-y-6">
            {/* Role & Progress Card */}
            <Card className="border-white/15 bg-[#1a1528]/60 backdrop-blur-md">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/30 to-purple-500/30">
                      <User className="h-6 w-6 text-purple-300" />
                    </div>
                    <div>
                      <p className="font-medium text-white">{session.label}</p>
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <code className="rounded bg-black/30 px-2 py-0.5 font-mono text-xs">
                          {session.operator_id}
                        </code>
                        <span>•</span>
                        <span>{session.scope.length} phase(s)</span>
                      </div>
                    </div>
                  </div>
                  <ProgressRing percentage={progress.percentage} size={80} strokeWidth={6} />
                </div>

                {/* Scope badges */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {session.scope.map((phase) => (
                    <Badge
                      key={phase}
                      variant="outline"
                      className="border-white/20 text-slate-300"
                    >
                      {PHASE_LABELS[phase]}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Refresh Button */}
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => fetchEvent()}
                disabled={isLoading}
                className="text-slate-400 hover:text-slate-300"
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            {/* Available Tasks */}
            {availableTasks.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm uppercase tracking-wide text-purple-300">
                  Available Tasks ({availableTasks.length})
                </h2>
                <AnimatePresence>
                  {availableTasks.map((task) => (
                    <TaskCard
                      key={task.task_id}
                      task={task}
                      onComplete={handleCompleteTask}
                      onFlagBlocker={handleFlagBlocker}
                      onAddNote={handleAddNote}
                      showPhase
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Blocked Tasks */}
            {blockedTasks.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm uppercase tracking-wide text-red-400">
                  Blocked ({blockedTasks.length})
                </h2>
                {blockedTasks.map((task) => (
                  <TaskCard
                    key={task.task_id}
                    task={task}
                    onComplete={handleCompleteTask}
                    onFlagBlocker={handleFlagBlocker}
                    onAddNote={handleAddNote}
                    showPhase
                  />
                ))}
              </div>
            )}

            {/* Locked Tasks */}
            {lockedTasks.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm uppercase tracking-wide text-slate-500">
                  Locked ({lockedTasks.length})
                </h2>
                {lockedTasks.map((task) => (
                  <TaskCard
                    key={task.task_id}
                    task={task}
                    showPhase
                    disabled
                  />
                ))}
              </div>
            )}

            {/* Completed Tasks */}
            {completedTasks.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm uppercase tracking-wide text-emerald-400">
                  Completed ({completedTasks.length})
                </h2>
                {completedTasks.map((task) => (
                  <TaskCard
                    key={task.task_id}
                    task={task}
                    showPhase
                    disabled
                  />
                ))}
              </div>
            )}

            {/* No tasks */}
            {tasks.length === 0 && !isLoading && (
              <Card className="border-white/15 bg-slate-900/60">
                <CardContent className="p-8 text-center">
                  <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
                  <p className="text-slate-300">No tasks assigned to your scope</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
