/**
 * Orchestration Commit API Route
 * Commits finalized EventConfig to MongoDB
 *
 * This route:
 * 1. Parses the EventConfig from AI
 * 2. Resolves depends_on_titles to actual task IDs (two-pass)
 * 3. Generates operator codes
 * 4. Saves everything to MongoDB
 */

import { NextResponse } from 'next/server'
import {
  parseEventConfig,
  resolveTaskDependencies,
  generateOperatorCode,
  generateUUID,
} from '@/lib/orchestration-agent'
import { saveOrchestrationEvent } from '@/lib/orchestration-db'
import type { OrchestrationEventConfigInput } from '@/types'

export async function POST(req: Request) {
  try {
    const { configJson, description, directorId } = await req.json()

    if (!configJson) {
      return NextResponse.json(
        { success: false, error: 'configJson is required' },
        { status: 400 }
      )
    }

    if (!directorId) {
      return NextResponse.json(
        { success: false, error: 'directorId is required' },
        { status: 400 }
      )
    }

    // Parse and validate the config
    const config = parseEventConfig(configJson)
    if (!config) {
      return NextResponse.json(
        { success: false, error: 'Invalid event configuration JSON' },
        { status: 400 }
      )
    }

    // Generate event ID
    const eventId = `orch_${Date.now()}_${generateUUID().slice(0, 8)}`

    // Generate director code
    const directorCode = directorId.startsWith('DIR-')
      ? directorId
      : generateOperatorCode('director')

    // Resolve dependencies and build full event structure
    const event = resolveTaskDependencies(config, eventId, directorCode)

    // Add the original description
    event.description = description || ''

    // Save to database (file-based storage)
    console.log(`[Commit] Saving event: ${eventId} with ${event.tasks.length} tasks, ${event.operators.length} operators`)
    const result = await saveOrchestrationEvent(eventId, event)

    if (!result || !result.acknowledged) {
      console.error(`[Commit] Failed to save event: ${eventId}`)
      return NextResponse.json(
        { success: false, error: 'Failed to save event to database' },
        { status: 500 }
      )
    }

    console.log(`[Commit] Event saved successfully: ${eventId}`)
    console.log(`[Commit] Director code: ${directorCode}`)
    console.log(`[Commit] Operator codes:`, event.operators.map(o => `${o.operator_id} (${o.role})`).join(', '))

    // Return the event with all generated codes
    return NextResponse.json({
      success: true,
      data: {
        event_id: event.event_id,
        name: event.name,
        operators: event.operators.map((op) => ({
          operator_id: op.operator_id,
          role: op.role,
          label: op.label,
          scope: op.scope,
        })),
        task_count: event.tasks.length,
        phase_count: config.phases.length,
      },
    })
  } catch (error) {
    console.error('Orchestration commit error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to commit event',
      },
      { status: 500 }
    )
  }
}
