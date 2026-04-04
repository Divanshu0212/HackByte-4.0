/**
 * Orchestration Events API Route
 * Lists all events (for the landing page)
 */

import { NextResponse } from 'next/server'
import { getAllEvents, listOrchestrationEventsByDirector } from '@/lib/orchestration-db'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const directorId = searchParams.get('director_id')

    let events
    if (directorId) {
      // Filter by director
      events = await listOrchestrationEventsByDirector(directorId)
    } else {
      // Return all events (for demo purposes)
      events = await getAllEvents()
    }

    // Return minimal event data for listing
    const eventSummaries = events.map((event) => ({
      event_id: event.event_id,
      name: event.name,
      date: event.date,
      venue: event.venue,
      participant_count: event.participant_count,
      status: event.status,
      created_at: event.created_at,
      task_count: event.tasks.length,
      completed_count: event.tasks.filter((t) => t.status === 'completed').length,
      director_id: event.director_id,
    }))

    return NextResponse.json({
      success: true,
      data: eventSummaries,
    })
  } catch (error) {
    console.error('Orchestration events error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch events',
      },
      { status: 500 }
    )
  }
}
