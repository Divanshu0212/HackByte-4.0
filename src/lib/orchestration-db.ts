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
  OrchestrationAnnouncement,
  OrchestrationActivityLog,
  OrchestrationActivityType,
  OrchestrationPhaseId,
} from '@/types'

// MongoDB connection
let cachedClient: MongoClient | null = null
let cachedDb: Db | null = null

async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  if (cachedClient && cachedDb) {
    // Verify connection is still alive
    try {
      await cachedDb.command({ ping: 1 })
      return { client: cachedClient, db: cachedDb }
    } catch {
      // Connection lost, reconnect
      cachedClient = null
      cachedDb = null
    }
  }

  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error('MONGODB_URI is not defined in environment variables')
  }

  // Create MongoDB client with TLS workaround for Windows/Node.js compatibility
  const client = new MongoClient(uri, {
    // TLS settings to fix Windows OpenSSL issues
    tls: true,
    tlsAllowInvalidCertificates: true,
    tlsAllowInvalidHostnames: true,
    // Connection settings
    maxPoolSize: 10,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 30000,
    // Retry settings
    retryWrites: true,
    retryReads: true,
  })

  try {
    await client.connect()
    const db = client.db('elixa')
    
    // Verify connection works
    await db.command({ ping: 1 })
    
    cachedClient = client
    cachedDb = db

    console.log('[DB] Successfully connected to MongoDB Atlas')
    return { client, db }
  } catch (error) {
    console.error('[DB] MongoDB connection error:', error)
    try {
      await client.close()
    } catch {
      // Ignore close errors
    }
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
  console.log(`[DB] Saved event: ${eventId}`)
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

  // Log activity
  await logTaskActivity(
    eventId,
    operatorId,
    operator.label,
    'task_completed',
    taskId,
    task.title,
    task.phase,
    { notes }
  )

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

  // Find operator for activity log
  const operator = event.operators.find((o) => o.operator_id === operatorId)

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

  // Log activity
  await logTaskActivity(
    eventId,
    operatorId,
    operator?.label || 'Unknown',
    'task_flagged',
    taskId,
    task.title,
    task.phase,
    { reason }
  )

  return { success: true }
}

export async function addTaskNote(
  eventId: string,
  taskId: string,
  operatorId: string,
  note: string
): Promise<{ success: boolean; error?: string }> {
  const event = await loadOrchestrationEvent(eventId)
  if (!event) return { success: false, error: 'Event not found' }

  const taskIndex = event.tasks.findIndex((t) => t.task_id === taskId)
  if (taskIndex === -1) return { success: false, error: 'Task not found' }

  const task = event.tasks[taskIndex]

  // Find operator for activity log
  const operator = event.operators.find((o) => o.operator_id === operatorId)

  event.tasks[taskIndex] = {
    ...event.tasks[taskIndex],
    notes: note,
  }
  event.updated_at = Date.now()
  await saveOrchestrationEvent(eventId, event)

  // Log activity
  await logTaskActivity(
    eventId,
    operatorId,
    operator?.label || 'Unknown',
    'task_note_added',
    taskId,
    task.title,
    task.phase,
    { note }
  )

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
): Promise<{ success: boolean; error?: string; isGoNoGo?: boolean }> {
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

  // Log activity
  await logActivity({
    log_id: '',
    event_id: eventId,
    operator_id: directorId,
    operator_label: director.label,
    action_type: 'checkpoint_passed',
    checkpoint_id: checkpoint.checkpoint_id,
    phase: phase as OrchestrationPhaseId,
    details: { checkpoint_name: checkpoint.name, is_gonogo: phase === 'gonogo' },
    timestamp: Date.now(),
  })

  console.log(`[DB] Checkpoint passed: ${phase}`)
  return { success: true, isGoNoGo: phase === 'gonogo' }
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

  const checkpoint = event.checkpoints[cpIndex]

  event.checkpoints[cpIndex] = {
    ...checkpoint,
    status: 'failed',
    passed_at: Date.now(),
    passed_by: directorId,
  }
  event.updated_at = Date.now()
  await saveOrchestrationEvent(eventId, event)

  // Log activity
  await logActivity({
    log_id: '',
    event_id: eventId,
    operator_id: directorId,
    operator_label: director.label,
    action_type: 'checkpoint_failed',
    checkpoint_id: checkpoint.checkpoint_id,
    phase: phase as OrchestrationPhaseId,
    details: { checkpoint_name: checkpoint.name },
    timestamp: Date.now(),
  })

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
  await db.collection('orchestration_activity_logs').deleteMany({})

  console.log('[DB] Cleared all events and history')
}

// ============ Announcement Operations ============

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export async function createAnnouncement(
  eventId: string,
  operatorId: string,
  message: string,
  voiceEnabled: boolean = false,
  broadcastTo: 'all' | 'operators' | OrchestrationPhaseId[] = 'all'
): Promise<{ success: boolean; announcement?: OrchestrationAnnouncement; error?: string }> {
  const event = await loadOrchestrationEvent(eventId)
  if (!event) return { success: false, error: 'Event not found' }

  // Verify operator is director
  const operator = event.operators.find((o) => o.operator_id === operatorId)
  if (!operator || operator.role !== 'director') {
    return { success: false, error: 'Only directors can create announcements' }
  }

  const announcement: OrchestrationAnnouncement = {
    announcement_id: generateUUID(),
    event_id: eventId,
    message,
    created_by: operatorId,
    sent_at: Date.now(),
    voice_enabled: voiceEnabled,
    broadcast_to: broadcastTo,
    created_at: Date.now(),
  }

  // Add to event's announcements array
  if (!event.announcements) {
    event.announcements = []
  }
  event.announcements.push(announcement)
  event.updated_at = Date.now()

  await saveOrchestrationEvent(eventId, event)

  // Log the activity
  await logActivity({
    log_id: generateUUID(),
    event_id: eventId,
    operator_id: operatorId,
    operator_label: operator.label,
    action_type: 'announcement_sent',
    details: { message, voice_enabled: voiceEnabled },
    timestamp: Date.now(),
  })

  console.log(`[DB] Announcement created: ${message.substring(0, 50)}...`)
  return { success: true, announcement }
}

export async function getAnnouncements(
  eventId: string,
  limit: number = 50
): Promise<OrchestrationAnnouncement[]> {
  const event = await loadOrchestrationEvent(eventId)
  if (!event || !event.announcements) return []

  return event.announcements
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, limit)
}

// ============ Activity Log Operations ============

export async function logActivity(
  activity: OrchestrationActivityLog
): Promise<void> {
  const { db } = await connectToDatabase()

  await db.collection<OrchestrationActivityLog>('orchestration_activity_logs').insertOne({
    ...activity,
    log_id: activity.log_id || generateUUID(),
    timestamp: activity.timestamp || Date.now(),
  } as any)

  console.log(`[DB] Activity logged: ${activity.action_type}`)
}

export async function getActivityFeed(
  eventId: string,
  limit: number = 100,
  operatorRole?: string
): Promise<OrchestrationActivityLog[]> {
  const { db } = await connectToDatabase()

  const query: Record<string, unknown> = { event_id: eventId }

  const activities = await db
    .collection<OrchestrationActivityLog>('orchestration_activity_logs')
    .find(query as any)
    .sort({ timestamp: -1 })
    .limit(limit)
    .toArray()

  return activities
}

// Helper function to log task-related activities
export async function logTaskActivity(
  eventId: string,
  operatorId: string,
  operatorLabel: string,
  actionType: OrchestrationActivityType,
  taskId: string,
  taskTitle: string,
  phase: OrchestrationPhaseId,
  details?: Record<string, unknown>
): Promise<void> {
  await logActivity({
    log_id: generateUUID(),
    event_id: eventId,
    operator_id: operatorId,
    operator_label: operatorLabel,
    action_type: actionType,
    task_id: taskId,
    task_title: taskTitle,
    phase,
    details,
    timestamp: Date.now(),
  })
}
