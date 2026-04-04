/**
 * Orchestration Auth API Route
 * Validates access codes and returns operator info
 */

import { NextResponse } from 'next/server'
import { getOperatorByCode, updateOperatorLastActive, loadOrchestrationEvent } from '@/lib/orchestration-db'

export async function POST(req: Request) {
  try {
    const { access_code, event_id } = await req.json()

    if (!access_code || !event_id) {
      return NextResponse.json(
        { success: false, error: 'access_code and event_id are required' },
        { status: 400 }
      )
    }

    // First check if event exists
    let event
    try {
      event = await loadOrchestrationEvent(event_id)
    } catch (dbError) {
      console.error('[Auth] Database error:', dbError)
      return NextResponse.json(
        { success: false, error: 'Database connection error. Please try again.' },
        { status: 503 }
      )
    }

    if (!event) {
      console.log(`[Auth] Event not found: ${event_id}`)
      return NextResponse.json(
        { success: false, error: 'Event not found. Please check the event ID.' },
        { status: 404 }
      )
    }

    console.log(`[Auth] Event found: ${event.name}, operators: ${event.operators.map(o => o.operator_id).join(', ')}`)
    console.log(`[Auth] Looking for access code: ${access_code}`)

    // Look up operator by code
    const operator = await getOperatorByCode(event_id, access_code)

    if (!operator) {
      console.log(`[Auth] Operator not found for code: ${access_code}`)
      console.log(`[Auth] Available operators:`, event.operators.map(o => `${o.operator_id} (${o.role})`))
      return NextResponse.json(
        { success: false, error: `Invalid access code "${access_code}". Please check the code and try again.` },
        { status: 401 }
      )
    }

    console.log(`[Auth] Operator authenticated: ${operator.operator_id} (${operator.role})`)

    // Update last active timestamp (don't fail auth if this fails)
    try {
      await updateOperatorLastActive(event_id, operator.operator_id)
    } catch {
      console.warn('[Auth] Failed to update last active timestamp')
    }

    // Return operator info (client stores in localStorage)
    return NextResponse.json({
      success: true,
      data: {
        operator_id: operator.operator_id,
        event_id: operator.event_id,
        role: operator.role,
        label: operator.label,
        scope: operator.scope,
        name: operator.name,
      },
    })
  } catch (error) {
    console.error('Orchestration auth error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Authentication failed. Please try again.',
      },
      { status: 500 }
    )
  }
}
