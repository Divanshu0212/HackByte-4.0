/**
 * Orchestration Action API Route
 * Handles task actions: complete, flag_blocker, add_note
 * Also handles announcements and activity feed
 */

import { NextResponse } from 'next/server'
import {
  completeTask,
  flagTaskBlocked,
  addTaskNote,
  loadOrchestrationEvent,
  createAnnouncement,
  getAnnouncements,
  getActivityFeed,
} from '@/lib/orchestration-db'

type ActionType = 'complete_task' | 'flag_blocker' | 'add_note' | 'create_announcement'

interface ActionPayload {
  event_id: string
  task_id?: string
  operator_id: string
  notes?: string
  reason?: string
  // Announcement fields
  message?: string
  voice_enabled?: boolean
  broadcast_to?: 'all' | 'operators'
}

export async function POST(req: Request) {
  try {
    const { action_type, payload } = (await req.json()) as {
      action_type: ActionType
      payload: ActionPayload
    }

    if (!action_type || !payload) {
      return NextResponse.json(
        { success: false, error: 'action_type and payload are required' },
        { status: 400 }
      )
    }

    const { event_id, operator_id } = payload

    if (!event_id || !operator_id) {
      return NextResponse.json(
        { success: false, error: 'event_id and operator_id are required' },
        { status: 400 }
      )
    }

    // Verify operator exists
    const event = await loadOrchestrationEvent(event_id)
    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      )
    }

    const operator = event.operators.find((o) => o.operator_id === operator_id)
    if (!operator) {
      return NextResponse.json(
        { success: false, error: 'Invalid operator' },
        { status: 401 }
      )
    }

    let result: { success: boolean; error?: string; unlockedTasks?: string[]; announcement?: unknown }

    switch (action_type) {
      case 'complete_task':
        if (!payload.task_id) {
          return NextResponse.json(
            { success: false, error: 'task_id is required for complete_task' },
            { status: 400 }
          )
        }
        result = await completeTask(event_id, payload.task_id, operator_id, payload.notes)
        break

      case 'flag_blocker':
        if (!payload.task_id || !payload.reason) {
          return NextResponse.json(
            { success: false, error: 'task_id and reason are required for flag_blocker' },
            { status: 400 }
          )
        }
        result = await flagTaskBlocked(event_id, payload.task_id, operator_id, payload.reason)
        break

      case 'add_note':
        if (!payload.task_id || !payload.notes) {
          return NextResponse.json(
            { success: false, error: 'task_id and notes are required for add_note' },
            { status: 400 }
          )
        }
        result = await addTaskNote(event_id, payload.task_id, operator_id, payload.notes)
        break

      case 'create_announcement':
        if (!payload.message) {
          return NextResponse.json(
            { success: false, error: 'message is required for create_announcement' },
            { status: 400 }
          )
        }
        result = await createAnnouncement(
          event_id,
          operator_id,
          payload.message,
          payload.voice_enabled ?? false,
          payload.broadcast_to ?? 'all'
        )
        break

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action type: ${action_type}` },
          { status: 400 }
        )
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        action: action_type,
        task_id: payload.task_id,
        unlocked_tasks: result.unlockedTasks || [],
        announcement: result.announcement,
      },
    })
  } catch (error) {
    console.error('Orchestration action error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Action failed',
      },
      { status: 500 }
    )
  }
}

// GET endpoint to fetch current event state, announcements, and activity
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const event_id = searchParams.get('event_id')
    const operator_id = searchParams.get('operator_id')
    const include = searchParams.get('include') // 'announcements', 'activity', or 'all'

    if (!event_id) {
      return NextResponse.json(
        { success: false, error: 'event_id is required' },
        { status: 400 }
      )
    }

    const event = await loadOrchestrationEvent(event_id)
    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      )
    }

    // If operator_id provided, filter tasks to their scope
    if (operator_id) {
      const operator = event.operators.find((o) => o.operator_id === operator_id)
      if (!operator) {
        return NextResponse.json(
          { success: false, error: 'Invalid operator' },
          { status: 401 }
        )
      }

      // Director sees everything
      if (operator.role !== 'director') {
        event.tasks = event.tasks.filter((t) => operator.scope.includes(t.phase))
      }
    }

    // Build response with optional inclusions
    const response: {
      success: boolean
      data: {
        event: typeof event
        announcements?: Awaited<ReturnType<typeof getAnnouncements>>
        activity?: Awaited<ReturnType<typeof getActivityFeed>>
      }
    } = {
      success: true,
      data: { event },
    }

    // Include announcements if requested
    if (include === 'announcements' || include === 'all') {
      response.data.announcements = await getAnnouncements(event_id, 20)
    }

    // Include activity feed if requested
    if (include === 'activity' || include === 'all') {
      const operator = operator_id ? event.operators.find((o) => o.operator_id === operator_id) : null
      response.data.activity = await getActivityFeed(event_id, 50, operator?.role)
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Orchestration fetch error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch event',
      },
      { status: 500 }
    )
  }
}
