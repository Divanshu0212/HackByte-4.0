/**
 * Orchestration Database Functions
 * MongoDB-based storage for persistent, cloud-accessible data
 */

import { MongoClient, Db } from 'mongodb'
import type {
  OrchestrationEvent,
  OrchestrationTask,
  OrchestrationOperator,
  OrchestrationTaskHistoryEntry,
} from '@/types'

// MongoDB connection
let cachedClient: MongoClient | null = null
let cachedDb: Db | null = null

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb }
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined in environment variables')
  }

  const client = new MongoClient(process.env.MONGODB_URI, {
    tls: true,
    tlsAllowInvalidCertificates: false,
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
  })
  
  try {
    await client.connect()
    const db = client.db('elixa')

    cachedClient = client
    cachedDb = db

    console.log('[DB] Connected to MongoDB')
    return { client, db }
  } catch (error) {
    console.error('[DB] MongoDB connection failed:', error)
    throw error
  }
}

// ============ Event Operations ============

export async function saveOrchestrationEvent(
  eventId: string,
  data: Partial<OrchestrationEvent>
): Promise<{ acknowledged: boolean }> {
  const { db } = await connectToDatabase()

  const updated = {
    ...data,
    event_id: eventId,
    updated_at: Date.now(),
  } as OrchestrationEvent

  const result = await db.collection<OrchestrationEvent>('orchestration_events').updateOne(
    { event_id: eventId } as any,
    { $set: updated },
    { upsert: true }
  )

  console.log(`[DB] Saved event: ${eventId} with ${updated.tasks?.length || 0} tasks, ${updated.operators?.length || 0} operators`)

  return { acknowledged: result.acknowledged }
}

export async function loadOrchestrationEvent(
  eventId: string
): Promise<OrchestrationEvent | null> {
  const { db } = await connectToDatabase()

  const event = await db.collection<OrchestrationEvent>('orchestration_events').findOne({ event_id: eventId } as any)

  console.log(`[DB] Load event: ${eventId} - ${event ? 'found' : 'NOT FOUND'}`)
  return event
}

export async function listOrchestrationEventsByDirector(
  directorId: string
): Promise<OrchestrationEvent[]> {
  const { db } = await connectToDatabase()

  const events = await db
    .collection<OrchestrationEvent>('orchestration_events')
    .find({ director_id: directorId } as any)
    .sort({ created_at: -1 })
    .toArray()

  return events
}

// ============ Task Operations ============

export async function updateTask(
  eventId: string,
  taskId: string,
  updates: Partial<OrchestrationTask>
): Promise<boolean> {
  const event = await loadOrchestrationEvent(eventId)
  if (!event) return false

  const taskIndex = event.tasks.findIndex((t) => t.task_id === taskId)
  if (taskIndex === -1) return false

  event.tasks[taskIndex] = { ...event.tasks[taskIndex], ...updates }
  event.updated_at = Date.now()
  await saveOrchestrationEvent(eventId, event)

  return true
}

export async function completeTask(
  eventId: string,
  taskId: string,
  operatorId: string,
  notes?: string
): Promise<{ success: boolean; unlockedTasks?: string[]; error?: string }> {
  const event = await loadOrchestrationEvent(eventId)
  if (!event) return { success: false, error: 'Event not found' }

  // Find the task
  const taskIndex = event.tasks.findIndex((t) => t.task_id === taskId)
  if (taskIndex === -1) return { success: false, error: 'Task not found' }

  const task = event.tasks[taskIndex]

  // Validate operator scope
  const operator = event.operators.find((o) => o.operator_id === operatorId)
  if (!operator) return { success: false, error: 'Operator not found' }

  if (!operator.scope.includes(task.phase)) {
    return { success: false, error: 'Operator not authorized for this task' }
  }

  // Check task is available
  if (task.status !== 'available' && task.status !== 'in_progress') {
    return { success: false, error: `Task is ${task.status}, cannot complete` }
  }

  // Update the task
  const oldStatus = task.status
  event.tasks[taskIndex] = {
    ...task,
    status: 'completed',
    completed_at: Date.now(),
    completed_by: operatorId,
    notes: notes || task.notes,
  }

  // Check and unlock dependent tasks
  const unlockedTasks: string[] = []
  for (let i = 0; i < event.tasks.length; i++) {
    const t = event.tasks[i]
    if (t.status === 'locked' && t.depends_on.includes(taskId)) {
      // Check if all dependencies are now complete
      const allDepsComplete = t.depends_on.every((depId) => {
        const dep = event.tasks.find((dt) => dt.task_id === depId)
        return dep?.status === 'completed'
      })
      if (allDepsComplete) {
        event.tasks[i] = { ...t, status: 'available' }
        unlockedTasks.push(t.task_id)
      }
    }
  }

  // Check if checkpoint should become available
  const checkpoint = event.checkpoints.find((cp) => cp.phase === task.phase)
  if (checkpoint && checkpoint.status === 'locked') {
    const phaseTasks = event.tasks.filter((t) => t.phase === task.phase)
    const criticalTasks = phaseTasks.filter((t) => t.priority === 'critical')
    const allCriticalComplete = criticalTasks.every((t) => t.status === 'completed')
    if (allCriticalComplete) {
      const cpIndex = event.checkpoints.findIndex((cp) => cp.phase === task.phase)
      event.checkpoints[cpIndex] = { ...checkpoint, status: 'available' }
    }
  }

  event.updated_at = Date.now()
  await saveOrchestrationEvent(eventId, event)

  // Log task history
  await saveTaskHistory(eventId, {
    task_id: taskId,
    event_id: eventId,
    from_status: oldStatus,
    to_status: 'completed',
    changed_by: operatorId,
    timestamp: Date.now(),
    notes,
  })

  console.log(`[DB] Task completed: ${task.title} - unlocked ${unlockedTasks.length} tasks`)
  return { success: true, unlockedTasks }
}

export async function flagTaskBlocked(
  eventId: string,
  taskId: string,
  operatorId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const event = await loadOrchestrationEvent(eventId)
  if (!event) return { success: false, error: 'Event not found' }

  const taskIndex = event.tasks.findIndex((t) => t.task_id === taskId)
  if (taskIndex === -1) return { success: false, error: 'Task not found' }

  const task = event.tasks[taskIndex]
  const oldStatus = task.status

  event.tasks[taskIndex] = {
    ...task,
    status: 'blocked',
    notes: reason,
  }
  event.updated_at = Date.now()
  await saveOrchestrationEvent(eventId, event)

  await saveTaskHistory(eventId, {
    task_id: taskId,
    event_id: eventId,
    from_status: oldStatus,
    to_status: 'blocked',
    changed_by: operatorId,
    timestamp: Date.now(),
    notes: reason,
  })

  return { success: true }
}

export async function addTaskNote(
  eventId: string,
  taskId: string,
  _operatorId: string,
  note: string
): Promise<{ success: boolean; error?: string }> {
  const event = await loadOrchestrationEvent(eventId)
  if (!event) return { success: false, error: 'Event not found' }

  const taskIndex = event.tasks.findIndex((t) => t.task_id === taskId)
  if (taskIndex === -1) return { success: false, error: 'Task not found' }

  event.tasks[taskIndex] = {
    ...event.tasks[taskIndex],
    notes: note,
  }
  event.updated_at = Date.now()
  await saveOrchestrationEvent(eventId, event)

  return { success: true }
}

// ============ Operator Operations ============

export async function getOperatorByCode(
  eventId: string,
  code: string
): Promise<OrchestrationOperator | null> {
  const event = await loadOrchestrationEvent(eventId)
  if (!event) return null

  return event.operators.find((o) => o.operator_id === code) || null
}

export async function updateOperatorLastActive(
  eventId: string,
  operatorId: string
): Promise<void> {
  const event = await loadOrchestrationEvent(eventId)
  if (!event) return

  const opIndex = event.operators.findIndex((o) => o.operator_id === operatorId)
  if (opIndex === -1) return

  event.operators[opIndex] = {
    ...event.operators[opIndex],
    last_active: Date.now(),
  }
  await saveOrchestrationEvent(eventId, event)
}

// ============ Checkpoint Operations ============

export async function passCheckpoint(
  eventId: string,
  phase: string,
  directorId: string
): Promise<{ success: boolean; error?: string }> {
  const event = await loadOrchestrationEvent(eventId)
  if (!event) return { success: false, error: 'Event not found' }

  // Verify director
  const director = event.operators.find((o) => o.operator_id === directorId)
  if (!director || director.role !== 'director') {
    return { success: false, error: 'Only director can pass checkpoints' }
  }

  const cpIndex = event.checkpoints.findIndex((cp) => cp.phase === phase)
  if (cpIndex === -1) return { success: false, error: 'Checkpoint not found' }

  const checkpoint = event.checkpoints[cpIndex]
  if (checkpoint.status !== 'available') {
    return { success: false, error: `Checkpoint is ${checkpoint.status}, cannot pass` }
  }

  event.checkpoints[cpIndex] = {
    ...checkpoint,
    status: 'passed',
    passed_at: Date.now(),
    passed_by: directorId,
  }

  // Check if all checkpoints passed - event complete
  const allPassed = event.checkpoints.every((cp) => cp.status === 'passed')
  if (allPassed) {
    event.status = 'completed'
  }

  event.updated_at = Date.now()
  await saveOrchestrationEvent(eventId, event)

  console.log(`[DB] Checkpoint passed: ${phase}`)
  return { success: true }
}

export async function failCheckpoint(
  eventId: string,
  phase: string,
  directorId: string
): Promise<{ success: boolean; error?: string }> {
  const event = await loadOrchestrationEvent(eventId)
  if (!event) return { success: false, error: 'Event not found' }

  // Verify director
  const director = event.operators.find((o) => o.operator_id === directorId)
  if (!director || director.role !== 'director') {
    return { success: false, error: 'Only director can fail checkpoints' }
  }

  const cpIndex = event.checkpoints.findIndex((cp) => cp.phase === phase)
  if (cpIndex === -1) return { success: false, error: 'Checkpoint not found' }

  event.checkpoints[cpIndex] = {
    ...event.checkpoints[cpIndex],
    status: 'failed',
    passed_at: Date.now(),
    passed_by: directorId,
  }
  event.updated_at = Date.now()
  await saveOrchestrationEvent(eventId, event)

  return { success: true }
}

// ============ History Operations ============

export async function saveTaskHistory(
  eventId: string,
  entry: OrchestrationTaskHistoryEntry
): Promise<void> {
  const { db } = await connectToDatabase()

  await db.collection<OrchestrationTaskHistoryEntry>('orchestration_task_history').insertOne({
    ...entry,
    timestamp: Date.now(),
  } as any)
}

export async function getTaskHistory(
  eventId: string,
  limit = 50
): Promise<OrchestrationTaskHistoryEntry[]> {
  const { db } = await connectToDatabase()

  const history = await db
    .collection<OrchestrationTaskHistoryEntry>('orchestration_task_history')
    .find({ event_id: eventId } as any)
    .sort({ timestamp: -1 })
    .limit(limit)
    .toArray()

  return history
}

// ============ Query Helpers ============

export async function getTasksByOperatorScope(
  eventId: string,
  operatorId: string
): Promise<OrchestrationTask[]> {
  const event = await loadOrchestrationEvent(eventId)
  if (!event) return []

  const operator = event.operators.find((o) => o.operator_id === operatorId)
  if (!operator) return []

  // Director sees all tasks
  if (operator.role === 'director') {
    return event.tasks
  }

  // Others see only their scoped phases
  return event.tasks.filter((t) => operator.scope.includes(t.phase))
}

export async function getEventProgress(eventId: string): Promise<{
  total: number
  completed: number
  percentage: number
  byPhase: Record<string, { total: number; completed: number }>
}> {
  const event = await loadOrchestrationEvent(eventId)
  if (!event) {
    return { total: 0, completed: 0, percentage: 0, byPhase: {} }
  }

  const total = event.tasks.length
  const completed = event.tasks.filter((t) => t.status === 'completed').length
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

  const byPhase: Record<string, { total: number; completed: number }> = {}
  for (const task of event.tasks) {
    if (!byPhase[task.phase]) {
      byPhase[task.phase] = { total: 0, completed: 0 }
    }
    byPhase[task.phase].total++
    if (task.status === 'completed') {
      byPhase[task.phase].completed++
    }
  }

  return { total, completed, percentage, byPhase }
}

// ============ Debug Helpers ============

export async function getAllEvents(): Promise<OrchestrationEvent[]> {
  const { db } = await connectToDatabase()

  const events = await db
    .collection<OrchestrationEvent>('orchestration_events')
    .find()
    .sort({ created_at: -1 })
    .toArray()

  return events
}

export async function clearAllEvents(): Promise<void> {
  const { db } = await connectToDatabase()

  await db.collection('orchestration_events').deleteMany({})
  await db.collection('orchestration_task_history').deleteMany({})

  console.log('[DB] Cleared all events and history')
}
