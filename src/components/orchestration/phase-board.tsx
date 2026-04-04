'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  Building2,
  Banknote,
  Users,
  ClipboardCheck,
  Rocket,
  ChevronRight,
  CheckCircle2,
  Lock,
  AlertCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { PHASE_LABELS, PHASE_ORDER } from '@/lib/orchestration-agent'
import type {
  OrchestrationTask,
  OrchestrationCheckpoint,
  OrchestrationPhaseId,
  OrchestrationCheckpointStatus,
} from '@/types'

interface PhaseBoardProps {
  tasks: OrchestrationTask[]
  checkpoints: OrchestrationCheckpoint[]
  onTaskSelect?: (task: OrchestrationTask) => void
  onPassCheckpoint?: (phase: OrchestrationPhaseId) => void
  isDirector?: boolean
}

const phaseIcons: Record<OrchestrationPhaseId, React.ComponentType<{ className?: string }>> = {
  permissions: Shield,
  venue: Building2,
  sponsors: Banknote,
  registrations: ClipboardCheck,
  volunteers: Users,
  gonogo: Rocket,
}

const checkpointStatusColors: Record<OrchestrationCheckpointStatus, string> = {
  locked: 'border-slate-500/30 bg-slate-500/20 text-slate-400',
  available: 'border-violet-500/30 bg-violet-500/20 text-purple-300',
  passed: 'border-emerald-500/30 bg-emerald-500/20 text-emerald-300',
  failed: 'border-red-500/30 bg-red-500/20 text-red-300',
}

function getSuggestedPhase(
  tasks: OrchestrationTask[],
  checkpoints: OrchestrationCheckpoint[]
): OrchestrationPhaseId {
  const checkpointReadyPhase = PHASE_ORDER.find((phaseId) =>
    checkpoints.some((checkpoint) => checkpoint.phase === phaseId && checkpoint.status === 'available')
  )

  if (checkpointReadyPhase) {
    return checkpointReadyPhase
  }

  const activeTaskPhase = PHASE_ORDER.find((phaseId) =>
    tasks.some(
      (task) =>
        task.phase === phaseId &&
        (task.status === 'available' || task.status === 'in_progress' || task.status === 'blocked')
    )
  )

  return activeTaskPhase ?? PHASE_ORDER[0]
}

export function PhaseBoard({
  tasks,
  checkpoints,
  onTaskSelect,
  onPassCheckpoint,
  isDirector = false,
}: PhaseBoardProps) {
  const [selectedPhase, setSelectedPhase] = useState<OrchestrationPhaseId>(() =>
    getSuggestedPhase(tasks, checkpoints)
  )

  const getPhaseStats = (phaseId: OrchestrationPhaseId) => {
    const phaseTasks = tasks.filter((task) => task.phase === phaseId)
    const completed = phaseTasks.filter((task) => task.status === 'completed').length
    const total = phaseTasks.length
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0
    const blocked = phaseTasks.filter((task) => task.status === 'blocked').length
    const checkpoint = checkpoints.find((entry) => entry.phase === phaseId)
    return { completed, total, percentage, blocked, checkpoint }
  }

  const phaseTasks = tasks
    .filter((task) => task.phase === selectedPhase)
    .sort((a, b) => {
      const order = { available: 0, in_progress: 1, blocked: 2, locked: 3, completed: 4 }
      return order[a.status] - order[b.status]
    })

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {PHASE_ORDER.map((phaseId, index) => {
          const Icon = phaseIcons[phaseId]
          const stats = getPhaseStats(phaseId)
          const isSelected = selectedPhase === phaseId

          return (
            <motion.button
              key={phaseId}
              onClick={() => setSelectedPhase(phaseId)}
              className={`w-full rounded-2xl border p-4 text-left transition ${
                isSelected
                  ? 'border-violet-400/50 bg-violet-500/10 shadow-lg shadow-violet-500/10'
                  : 'border-white/15 bg-[#1a1528]/60 hover:border-white/25 hover:bg-[#1a1528]/80'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="mb-3 flex items-center justify-between">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                    stats.checkpoint?.status === 'passed'
                      ? 'bg-emerald-500/20'
                      : 'bg-gradient-to-br from-violet-500/30 to-purple-500/30'
                  }`}
                >
                  {stats.checkpoint?.status === 'passed' ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <Icon className="h-5 w-5 text-purple-300" />
                  )}
                </div>
                <span className="text-xs text-slate-500">{index + 1}/6</span>
              </div>

              <p className="mb-1 truncate text-sm font-medium text-white">{PHASE_LABELS[phaseId]}</p>

              <div className="mb-2 flex items-center gap-2">
                <Progress value={stats.percentage} className="h-1.5 flex-1" />
                <span className="text-xs text-slate-400">{stats.percentage}%</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  {stats.completed}/{stats.total} done
                </span>
                {stats.blocked > 0 && (
                  <Badge variant="outline" className="border-red-500/30 text-xs text-red-400">
                    {stats.blocked} blocked
                  </Badge>
                )}
              </div>

              {stats.checkpoint && (
                <div className="mt-2 border-t border-white/10 pt-2">
                  <Badge
                    variant="outline"
                    className={`w-full justify-center text-xs ${checkpointStatusColors[stats.checkpoint.status]}`}
                  >
                    {stats.checkpoint.status === 'locked' && <Lock className="mr-1 h-3 w-3" />}
                    {stats.checkpoint.status === 'available' && 'Ready'}
                    {stats.checkpoint.status === 'passed' && 'Passed'}
                    {stats.checkpoint.status === 'failed' && 'Failed'}
                    {stats.checkpoint.status === 'locked' && 'Locked'}
                  </Badge>
                </div>
              )}
            </motion.button>
          )
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={selectedPhase}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.2 }}
        >
          <Card className="border-white/15 bg-[#1a1528]/60 backdrop-blur-md">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <CardTitle className="flex items-center gap-2 text-lg text-white">
                  {(() => {
                    const Icon = phaseIcons[selectedPhase]
                    return <Icon className="h-5 w-5 text-violet-400" />
                  })()}
                  {PHASE_LABELS[selectedPhase]}
                </CardTitle>

                {isDirector && (() => {
                  const stats = getPhaseStats(selectedPhase)
                  if (stats.checkpoint?.status === 'available') {
                    return (
                      <Button
                        onClick={() => onPassCheckpoint?.(selectedPhase)}
                        className="bg-gradient-to-r from-emerald-500 to-purple-500 text-white hover:from-emerald-600 hover:to-purple-600"
                        size="sm"
                      >
                        <CheckCircle2 className="mr-1 h-4 w-4" />
                        Pass Checkpoint
                      </Button>
                    )
                  }
                  return null
                })()}
              </div>
            </CardHeader>
            <CardContent>
              {phaseTasks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-4 text-sm text-slate-400">
                  No tasks are assigned to this phase yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {phaseTasks.map((task) => (
                    <button
                      key={task.task_id}
                      onClick={() => onTaskSelect?.(task)}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                        task.status === 'completed'
                          ? 'border-emerald-500/30 bg-emerald-500/10'
                          : task.status === 'blocked'
                          ? 'border-red-500/30 bg-red-500/10'
                          : task.status === 'locked'
                          ? 'border-white/10 bg-slate-800/50 opacity-60'
                          : 'border-white/15 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div
                        className={`h-2 w-2 flex-shrink-0 rounded-full ${
                          task.status === 'completed'
                            ? 'bg-emerald-400'
                            : task.status === 'blocked'
                            ? 'bg-red-400'
                            : task.status === 'locked'
                            ? 'bg-slate-500'
                            : 'bg-violet-400'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate text-sm font-medium ${
                            task.status === 'completed'
                              ? 'text-emerald-300 line-through'
                              : task.status === 'locked'
                              ? 'text-slate-400'
                              : 'text-white'
                          }`}
                        >
                          {task.title}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-xs text-slate-500">
                            {task.assigned_role.replace('_', ' ')}
                          </span>
                          {task.priority === 'critical' && (
                            <Badge variant="outline" className="border-red-500/30 text-xs text-red-400">
                              critical
                            </Badge>
                          )}
                        </div>
                      </div>
                      {task.status === 'locked' ? (
                        <Lock className="h-4 w-4 text-slate-500" />
                      ) : task.status === 'blocked' ? (
                        <AlertCircle className="h-4 w-4 text-red-400" />
                      ) : task.status === 'completed' ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
