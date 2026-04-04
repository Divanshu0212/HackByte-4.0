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
  locked: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  available: 'bg-violet-500/20 text-purple-300 border-violet-500/30',
  passed: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  failed: 'bg-red-500/20 text-red-300 border-red-500/30',
}

export function PhaseBoard({
  tasks,
  checkpoints,
  onTaskSelect,
  onPassCheckpoint,
  isDirector = false,
}: PhaseBoardProps) {
  const [selectedPhase, setSelectedPhase] = useState<OrchestrationPhaseId | null>(null)

  const getPhaseStats = (phaseId: OrchestrationPhaseId) => {
    const phaseTasks = tasks.filter((t) => t.phase === phaseId)
    const completed = phaseTasks.filter((t) => t.status === 'completed').length
    const total = phaseTasks.length
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0
    const blocked = phaseTasks.filter((t) => t.status === 'blocked').length
    const checkpoint = checkpoints.find((cp) => cp.phase === phaseId)
    return { completed, total, percentage, blocked, checkpoint }
  }

  return (
    <div className="space-y-4">
      {/* Horizontal Phase Cards */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
        {PHASE_ORDER.map((phaseId, index) => {
          const Icon = phaseIcons[phaseId]
          const stats = getPhaseStats(phaseId)
          const isSelected = selectedPhase === phaseId

          return (
            <motion.button
              key={phaseId}
              onClick={() => setSelectedPhase(isSelected ? null : phaseId)}
              className={`flex-shrink-0 w-[180px] rounded-xl border p-4 text-left transition ${
                isSelected
                  ? 'border-violet-400/50 bg-violet-500/10 shadow-lg shadow-violet-500/10'
                  : 'border-white/15 bg-[#1a1528]/60 hover:border-white/25 hover:bg-[#1a1528]/80'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center justify-between mb-3">
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

              <p className="font-medium text-white text-sm mb-1 truncate">
                {PHASE_LABELS[phaseId]}
              </p>

              <div className="flex items-center gap-2 mb-2">
                <Progress value={stats.percentage} className="h-1.5 flex-1" />
                <span className="text-xs text-slate-400">{stats.percentage}%</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  {stats.completed}/{stats.total} done
                </span>
                {stats.blocked > 0 && (
                  <Badge variant="outline" className="text-xs border-red-500/30 text-red-400">
                    {stats.blocked} blocked
                  </Badge>
                )}
              </div>

              {/* Checkpoint Status */}
              {stats.checkpoint && (
                <div className="mt-2 pt-2 border-t border-white/10">
                  <Badge
                    variant="outline"
                    className={`text-xs w-full justify-center ${
                      checkpointStatusColors[stats.checkpoint.status]
                    }`}
                  >
                    {stats.checkpoint.status === 'locked' && <Lock className="h-3 w-3 mr-1" />}
                    {stats.checkpoint.status === 'available' && '🟢 Ready'}
                    {stats.checkpoint.status === 'passed' && '✓ Passed'}
                    {stats.checkpoint.status === 'failed' && '✗ Failed'}
                    {stats.checkpoint.status === 'locked' && 'Locked'}
                  </Badge>
                </div>
              )}
            </motion.button>
          )
        })}
      </div>

      {/* Expanded Phase Details */}
      <AnimatePresence>
        {selectedPhase && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="border-white/15 bg-[#1a1528]/60 backdrop-blur-md">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-white flex items-center gap-2">
                    {(() => {
                      const Icon = phaseIcons[selectedPhase]
                      return <Icon className="h-5 w-5 text-violet-400" />
                    })()}
                    {PHASE_LABELS[selectedPhase]}
                  </CardTitle>

                  {/* Pass Checkpoint Button */}
                  {isDirector && (() => {
                    const stats = getPhaseStats(selectedPhase)
                    if (stats.checkpoint?.status === 'available') {
                      return (
                        <Button
                          onClick={() => onPassCheckpoint?.(selectedPhase)}
                          className="bg-gradient-to-r from-emerald-500 to-purple-500 text-white hover:from-emerald-600 hover:to-purple-600"
                          size="sm"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Pass Checkpoint
                        </Button>
                      )
                    }
                    return null
                  })()}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {tasks
                    .filter((t) => t.phase === selectedPhase)
                    .sort((a, b) => {
                      // Sort: available first, then in_progress, then locked, then completed
                      const order = { available: 0, in_progress: 1, blocked: 2, locked: 3, completed: 4 }
                      return order[a.status] - order[b.status]
                    })
                    .map((task) => (
                      <button
                        key={task.task_id}
                        onClick={() => onTaskSelect?.(task)}
                        className={`w-full flex items-center gap-3 rounded-lg p-3 text-left transition ${
                          task.status === 'completed'
                            ? 'bg-emerald-500/10 border border-emerald-500/30'
                            : task.status === 'blocked'
                            ? 'bg-red-500/10 border border-red-500/30'
                            : task.status === 'locked'
                            ? 'bg-slate-800/50 border border-white/10 opacity-60'
                            : 'bg-white/5 border border-white/15 hover:bg-white/10'
                        }`}
                      >
                        <div
                          className={`h-2 w-2 rounded-full flex-shrink-0 ${
                            task.status === 'completed'
                              ? 'bg-emerald-400'
                              : task.status === 'blocked'
                              ? 'bg-red-400'
                              : task.status === 'locked'
                              ? 'bg-slate-500'
                              : 'bg-violet-400'
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <p
                            className={`font-medium text-sm truncate ${
                              task.status === 'completed'
                                ? 'text-emerald-300 line-through'
                                : task.status === 'locked'
                                ? 'text-slate-400'
                                : 'text-white'
                            }`}
                          >
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-slate-500">
                              {task.assigned_role.replace('_', ' ')}
                            </span>
                            {task.priority === 'critical' && (
                              <Badge
                                variant="outline"
                                className="text-xs border-red-500/30 text-red-400"
                              >
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
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
