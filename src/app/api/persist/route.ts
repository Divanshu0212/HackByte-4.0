import { NextResponse } from 'next/server'
import { saveEvent, loadEvent, saveScoreEvent, getScoreHistory, saveAgentLog } from '@/lib/mongodb'

export async function POST(request: Request) {
  try {
    const { action, eventId, data } = await request.json()

    if (!action || !eventId) {
      return NextResponse.json(
        { success: false, error: 'Action and eventId are required' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'save_event': {
        await saveEvent(eventId, data)
        return NextResponse.json({ success: true })
      }

      case 'load_event': {
        const event = await loadEvent(eventId)
        return NextResponse.json({ success: true, data: { event } })
      }

      case 'save_score_event': {
        await saveScoreEvent(eventId, data)
        return NextResponse.json({ success: true })
      }

      case 'get_score_history': {
        const history = await getScoreHistory(eventId, data?.limit || 100)
        return NextResponse.json({ success: true, data: { history } })
      }

      case 'save_agent_log': {
        await saveAgentLog(eventId, data)
        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Persist error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Persistence failed',
      },
      { status: 500 }
    )
  }
}
