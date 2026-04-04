import { NextResponse } from 'next/server'
import {
  createGameSession,
  listGameSessions,
  loadGameSession,
  saveGameSessionProgress,
  appendGameSessionEvent,
} from '@/lib/game-session-store'

export async function POST(request: Request) {
  try {
    const { action, eventId, data, userId, gameId, sessionId, sessionName } = await request.json()

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Action is required' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'create_game_session': {
        if (!userId || !gameId) {
          return NextResponse.json(
            { success: false, error: 'userId and gameId are required' },
            { status: 400 }
          )
        }

        const session = await createGameSession(
          userId,
          gameId,
          sessionName || `Session ${new Date().toLocaleString()}`,
          (data as Record<string, unknown> | undefined) || undefined
        )
        return NextResponse.json({ success: true, data: { session } })
      }

      case 'list_game_sessions': {
        if (!userId || !gameId) {
          return NextResponse.json(
            { success: false, error: 'userId and gameId are required' },
            { status: 400 }
          )
        }

        const sessions = await listGameSessions(userId, gameId)
        return NextResponse.json({ success: true, data: { sessions } })
      }

      case 'load_game_session':
      case 'save_event': {
        const targetSessionId = sessionId || eventId
        if (!targetSessionId || !userId) {
          return NextResponse.json(
            { success: false, error: 'sessionId (or eventId) and userId are required' },
            { status: 400 }
          )
        }

        if (action === 'load_game_session') {
          const session = await loadGameSession(targetSessionId, userId)
          return NextResponse.json({ success: true, data: { session } })
        }

        await saveGameSessionProgress(targetSessionId, userId, (data || {}) as Record<string, unknown>)
        return NextResponse.json({ success: true, data: { sessionId: targetSessionId } })
      }

      case 'save_game_session':
      case 'save_game_progress': {
        const targetSessionId = sessionId || eventId
        if (!targetSessionId || !userId) {
          return NextResponse.json(
            { success: false, error: 'sessionId (or eventId) and userId are required' },
            { status: 400 }
          )
        }

        await saveGameSessionProgress(targetSessionId, userId, (data || {}) as Record<string, unknown>)
        return NextResponse.json({ success: true, data: { sessionId: targetSessionId } })
      }

      case 'load_event': {
        const targetSessionId = sessionId || eventId
        if (!targetSessionId || !userId) {
          return NextResponse.json(
            { success: false, error: 'sessionId (or eventId) and userId are required' },
            { status: 400 }
          )
        }

        const session = await loadGameSession(targetSessionId, userId)
        return NextResponse.json({ success: true, data: { event: session?.progress || null, session } })
      }

      case 'save_score_event': {
        const targetSessionId = sessionId || eventId
        if (!targetSessionId || !userId) {
          return NextResponse.json(
            { success: false, error: 'sessionId (or eventId) and userId are required' },
            { status: 400 }
          )
        }

        await appendGameSessionEvent(
          targetSessionId,
          userId,
          'score_event',
          (data || {}) as Record<string, unknown>
        )
        return NextResponse.json({ success: true })
      }

      case 'get_score_history': {
        return NextResponse.json({ success: true, data: { history: [] } })
      }

      case 'save_agent_log': {
        const targetSessionId = sessionId || eventId
        if (!targetSessionId || !userId) {
          return NextResponse.json(
            { success: false, error: 'sessionId (or eventId) and userId are required' },
            { status: 400 }
          )
        }

        await appendGameSessionEvent(
          targetSessionId,
          userId,
          'agent_log',
          (data || {}) as Record<string, unknown>
        )
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
