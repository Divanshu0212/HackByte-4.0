'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Loader2,
  Link as LinkIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { OrchestrationTask, OrchestrationPhaseId, OrchestrationOperatorRole } from '@/types'

interface TaskManagementProps {
  eventId: string
  operatorId: string
  tasks: OrchestrationTask[]
  onTasksUpdated: () => void
}

const PHASES: { id: OrchestrationPhaseId; label: string }[] = [
  { id: 'permissions', label: 'Permissions' },
  { id: 'venue', label: 'Venue' },
  { id: 'sponsors', label: 'Sponsors' },
  { id: 'registrations', label: 'Registrations' },
  { id: 'volunteers', label: 'Volunteers' },
  { id: 'gonogo', label: 'Go/No-Go' },
]

const ROLES: { id: OrchestrationOperatorRole; label: string }[] = [
  { id: 'director', label: 'Director' },
  { id: 'venue_lead', label: 'Venue Lead' },
  { id: 'sponsor_lead', label: 'Sponsor Lead' },
  { id: 'tech_lead', label: 'Tech Lead' },
  { id: 'volunteer_coord', label: 'Volunteer Coordinator' },
  { id: 'volunteer', label: 'Volunteer' },
]

const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const

interface TaskForm {
  title: string
  description: string
  phase: OrchestrationPhaseId
  assigned_role: OrchestrationOperatorRole
  priority: 'critical' | 'high' | 'medium' | 'low'
  depends_on: string[]
}

const defaultForm: TaskForm = {
  title: '',
  description: '',
  phase: 'permissions',
  assigned_role: 'director',
  priority: 'medium',
  depends_on: [],
}

export function TaskManagement({ eventId, operatorId, tasks, onTasksUpdated }: TaskManagementProps) {
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [editingTask, setEditingTask] = useState<OrchestrationTask | null>(null)
  const [form, setForm] = useState<TaskForm>(defaultForm)
  const [isLoading, setIsLoading] = useState(false)
  const [showDependencies, setShowDependencies] = useState(false)

  const handleAddTask = async () => {
    if (!form.title.trim()) {
      toast.error('Task title is required')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/orchestration/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          operator_id: operatorId,
          task: form,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to add task')
      }

      toast.success('Task added successfully!')
      setForm(defaultForm)
      setIsAddingTask(false)
      onTasksUpdated()
    } catch (error) {
      console.error('Add task error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to add task')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditTask = async () => {
    if (!editingTask || !form.title.trim()) {
      toast.error('Task title is required')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/orchestration/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          operator_id: operatorId,
          task_id: editingTask.task_id,
          updates: form,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to update task')
      }

      toast.success('Task updated successfully!')
      setForm(defaultForm)
      setEditingTask(null)
      onTasksUpdated()
    } catch (error) {
      console.error('Edit task error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update task')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteTask = async (taskId: string, taskTitle: string) => {
    if (!confirm(`Delete task "${taskTitle}"? This will update any tasks that depend on it.`)) {
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(
        `/api/orchestration/tasks?event_id=${eventId}&operator_id=${operatorId}&task_id=${taskId}`,
        { method: 'DELETE' }
      )

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete task')
      }

      toast.success('Task deleted successfully!')
      onTasksUpdated()
    } catch (error) {
      console.error('Delete task error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete task')
    } finally {
      setIsLoading(false)
    }
  }

  const startEditing = (task: OrchestrationTask) => {
    setEditingTask(task)
    setForm({
      title: task.title,
      description: task.description,
      phase: task.phase,
      assigned_role: task.assigned_role,
      priority: task.priority,
      depends_on: task.depends_on,
    })
    setIsAddingTask(false)
  }

  const startAdding = () => {
    setIsAddingTask(true)
    setEditingTask(null)
    setForm(defaultForm)
  }

  const cancelForm = () => {
    setIsAddingTask(false)
    setEditingTask(null)
    setForm(defaultForm)
  }

  const toggleDependency = (taskId: string) => {
    setForm((prev) => ({
      ...prev,
      depends_on: prev.depends_on.includes(taskId)
        ? prev.depends_on.filter((id) => id !== taskId)
        : [...prev.depends_on, taskId],
    }))
  }

  const availableForDependencies = tasks.filter(
    (t) => t.task_id !== editingTask?.task_id
  )

  return (
    <Card className="border-white/15 bg-slate-900/60 backdrop-blur-md">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm text-slate-400 uppercase tracking-wide">
            Task Management
          </CardTitle>
          {!isAddingTask && !editingTask && (
            <Button
              size="sm"
              onClick={startAdding}
              className="bg-violet-600 hover:bg-violet-500 text-white"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Task
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add/Edit Form */}
        <AnimatePresence>
          {(isAddingTask || editingTask) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3 border-b border-white/10 pb-4"
            >
              <h4 className="text-sm font-medium text-white">
                {editingTask ? 'Edit Task' : 'New Task'}
              </h4>

              {/* Title */}
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Task title *"
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-400/50 focus:outline-none"
              />

              {/* Description */}
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Description"
                rows={2}
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-400/50 focus:outline-none resize-none"
              />

              {/* Phase + Role Row */}
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={form.phase}
                  onChange={(e) => setForm({ ...form, phase: e.target.value as OrchestrationPhaseId })}
                  className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100 focus:border-violet-400/50 focus:outline-none"
                >
                  {PHASES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>

                <select
                  value={form.assigned_role}
                  onChange={(e) => setForm({ ...form, assigned_role: e.target.value as OrchestrationOperatorRole })}
                  className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100 focus:border-violet-400/50 focus:outline-none"
                >
                  {ROLES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as any })}
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100 focus:border-violet-400/50 focus:outline-none"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    Priority: {p.charAt(0).toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>

              {/* Dependencies Toggle */}
              <button
                onClick={() => setShowDependencies(!showDependencies)}
                className="flex items-center gap-2 text-sm text-purple-300 hover:text-purple-200"
              >
                <LinkIcon className="h-4 w-4" />
                Dependencies ({form.depends_on.length} selected)
              </button>

              {/* Dependencies List */}
              {showDependencies && (
                <div className="max-h-40 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-2 space-y-1">
                  {availableForDependencies.length === 0 ? (
                    <p className="text-xs text-slate-500">No other tasks available</p>
                  ) : (
                    availableForDependencies.map((t) => (
                      <label
                        key={t.task_id}
                        className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer hover:text-white p-1 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={form.depends_on.includes(t.task_id)}
                          onChange={() => toggleDependency(t.task_id)}
                          className="rounded border-white/30"
                        />
                        <span className="flex-1 truncate">{t.title}</span>
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          {t.phase}
                        </Badge>
                      </label>
                    ))
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={editingTask ? handleEditTask : handleAddTask}
                  disabled={isLoading}
                  className="bg-violet-600 hover:bg-violet-500 text-white flex-1"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-1" />
                      {editingTask ? 'Save Changes' : 'Add Task'}
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={cancelForm}
                  disabled={isLoading}
                  className="border-white/20 text-slate-300 hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Task List */}
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {tasks.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No tasks yet</p>
          ) : (
            tasks.map((task) => (
              <div
                key={task.task_id}
                className={`group flex items-center gap-2 rounded-lg p-2 text-sm transition ${
                  editingTask?.task_id === task.task_id
                    ? 'bg-violet-500/20 border border-violet-500/30'
                    : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-slate-200 truncate">{task.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1 py-0 ${
                        task.status === 'completed'
                          ? 'border-emerald-500/30 text-emerald-300'
                          : task.status === 'blocked'
                          ? 'border-red-500/30 text-red-300'
                          : task.status === 'available'
                          ? 'border-violet-500/30 text-purple-300'
                          : 'border-white/20 text-slate-400'
                      }`}
                    >
                      {task.status}
                    </Badge>
                    <span className="text-[10px] text-slate-500 capitalize">{task.phase}</span>
                    {task.depends_on.length > 0 && (
                      <span className="text-[10px] text-slate-500">
                        <LinkIcon className="h-3 w-3 inline" /> {task.depends_on.length}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => startEditing(task)}
                    className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-purple-300"
                    title="Edit task"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteTask(task.task_id, task.title)}
                    className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-red-400"
                    title="Delete task"
                    disabled={isLoading}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
