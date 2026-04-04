'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  Users,
  MapPin,
  Calendar,
  AlertTriangle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { parseEventConfig, PHASE_LABELS, PHASE_ORDER } from '@/lib/orchestration-agent'
import type { OrchestrationEventConfigInput, OrchestrationPhaseId, OrchestrationTaskPriority } from '@/types'

interface EventConfigPreviewProps {
  configJson: string
}

const priorityColors: Record<OrchestrationTaskPriority, string> = {
  critical: 'bg-red-500/20 text-red-300 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  low: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
}

export function EventConfigPreview({ configJson }: EventConfigPreviewProps) {
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set())

  const config = useMemo(() => {
    return parseEventConfig(configJson)
  }, [configJson])

  if (!config) {
    return (
      <Card className="border-red-500/30 bg-red-500/10">
        <CardContent className="flex items-center gap-3 p-6">
          <AlertTriangle className="h-5 w-5 text-red-400" />
          <div>
            <p className="font-medium text-red-300">Invalid Configuration</p>
            <p className="text-sm text-red-300/70">
              The AI response could not be parsed. Please try again with a clearer description.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const togglePhase = (phaseId: string) => {
    const newExpanded = new Set(expandedPhases)
    if (newExpanded.has(phaseId)) {
      newExpanded.delete(phaseId)
    } else {
      newExpanded.add(phaseId)
    }
    setExpandedPhases(newExpanded)
  }

  const totalTasks = config.phases.reduce((acc, phase) => acc + phase.tasks.length, 0)
  const criticalTasks = config.phases.reduce(
    (acc, phase) => acc + phase.tasks.filter((t) => t.priority === 'critical').length,
    0
  )

  return (
    <Card className="border-white/15 bg-[#1a1528]/60 backdrop-blur-md">
      <CardHeader className="border-b border-white/10 pb-4">
        <CardTitle className="flex items-center justify-between">
          <span className="text-xl text-white">{config.name}</span>
          <Badge className="bg-emerald-500/20 text-emerald-300">Ready to Launch</Badge>
        </CardTitle>

        {/* Summary Stats */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Calendar className="h-4 w-4 text-violet-400" />
            <span>{new Date(config.date).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <MapPin className="h-4 w-4 text-violet-400" />
            <span>{config.venue || 'TBD'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Users className="h-4 w-4 text-violet-400" />
            <span>{config.participant_count} participants</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <CheckCircle2 className="h-4 w-4 text-violet-400" />
            <span>{totalTasks} tasks</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        <div className="mb-4 flex items-center justify-between text-sm">
          <span className="text-slate-400">
            {config.phases.length} phases • {criticalTasks} critical tasks
          </span>
          <button
            onClick={() => {
              if (expandedPhases.size === config.phases.length) {
                setExpandedPhases(new Set())
              } else {
                setExpandedPhases(new Set(config.phases.map((p) => p.id)))
              }
            }}
            className="text-purple-300 hover:text-purple-200"
          >
            {expandedPhases.size === config.phases.length ? 'Collapse All' : 'Expand All'}
          </button>
        </div>

        <div className="space-y-3">
          {PHASE_ORDER.map((phaseId) => {
            const phase = config.phases.find((p) => p.id === phaseId)
            if (!phase) return null

            const isExpanded = expandedPhases.has(phase.id)
            const phaseCritical = phase.tasks.filter((t) => t.priority === 'critical').length

            return (
              <div
                key={phase.id}
                className="overflow-hidden rounded-lg border border-white/10 bg-white/5"
              >
                <button
                  onClick={() => togglePhase(phase.id)}
                  className="flex w-full items-center justify-between p-3 text-left transition hover:bg-white/5"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/30 to-purple-500/30 text-xs font-bold text-purple-200">
                      {PHASE_ORDER.indexOf(phaseId as OrchestrationPhaseId) + 1}
                    </div>
                    <div>
                      <p className="font-medium text-white">
                        {PHASE_LABELS[phase.id as OrchestrationPhaseId] || phase.label}
                      </p>
                      <p className="text-xs text-slate-400">
                        {phase.tasks.length} tasks
                        {phaseCritical > 0 && (
                          <span className="ml-2 text-red-400">• {phaseCritical} critical</span>
                        )}
                      </p>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-white/10"
                    >
                      <div className="p-3 space-y-2">
                        {phase.tasks.map((task, index) => (
                          <div
                            key={index}
                            className="flex items-start gap-3 rounded-lg bg-black/20 p-3"
                          >
                            <div className="mt-0.5 h-2 w-2 rounded-full bg-slate-500" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-slate-200 text-sm">{task.title}</p>
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${priorityColors[task.priority]}`}
                                >
                                  {task.priority}
                                </Badge>
                              </div>
                              <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                                {task.description}
                              </p>
                              <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {task.assigned_role.replace('_', ' ')}
                                </span>
                                {task.deadline && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {new Date(task.deadline).toLocaleDateString()}
                                  </span>
                                )}
                                {task.depends_on_titles.length > 0 && (
                                  <span className="text-amber-400">
                                    Depends on {task.depends_on_titles.length} task(s)
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>

        {/* Roles Summary */}
        {config.roles && config.roles.length > 0 && (
          <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3">
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">
              Operator Roles to Generate
            </p>
            <div className="flex flex-wrap gap-2">
              {config.roles.map((role, i) => (
                <Badge key={i} variant="outline" className="border-white/20 text-slate-300">
                  {role.label}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
