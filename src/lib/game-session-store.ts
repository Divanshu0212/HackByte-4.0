import { randomUUID } from 'crypto'
import { getDatabase } from '@/lib/mongodb'

export interface GameSessionRecord {
  session_id: string
  user_id: string
  game_id: string
  session_name: string
  progress?: Record<string, unknown>
  created_at: number
  updated_at: number
}

interface SpaceTimeEnvelope<T> {
  success: boolean
  data?: T
  error?: string
}

interface SpaceTimeConfig {
  relayUrl: string
  moduleName: string
}

function getSpaceTimeConfig(): SpaceTimeConfig | null {
  const relayUrl = process.env.SPACETIMEDB_RELAY_URL
  const moduleName = process.env.SPACETIMEDB_MODULE_NAME

  if (!relayUrl || !moduleName) {
    return null
  }

  return { relayUrl: relayUrl.replace(/\/$/, ''), moduleName }
}

async function callSpaceTime<T>(
  action: string,
  payload: Record<string, unknown>
): Promise<SpaceTimeEnvelope<T>> {
  const config = getSpaceTimeConfig()
  if (!config) {
    return { success: false, error: 'SpaceTimeDB relay not configured' }
  }

  try {
    const response = await fetch(`${config.relayUrl}/game-sessions/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module: config.moduleName, ...payload }),
      cache: 'no-store',
    })

    if (!response.ok) {
      const message = await response.text()
      return {
        success: false,
        error: message || `SpaceTimeDB relay error (${response.status})`,
      }
    }

    return (await response.json()) as SpaceTimeEnvelope<T>
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'SpaceTimeDB relay request failed',
    }
  }
}

async function createSessionMongo(
  userId: string,
  gameId: string,
  sessionName: string,
  progress?: Record<string, unknown>
): Promise<GameSessionRecord> {
  const db = await getDatabase()
  if (!db) {
    throw new Error('Database is not available')
  }

  const now = Date.now()
  const record: GameSessionRecord = {
    session_id: randomUUID(),
    user_id: userId,
    game_id: gameId,
    session_name: sessionName,
    progress,
    created_at: now,
    updated_at: now,
  }

  await db.collection<GameSessionRecord>('game_sessions').insertOne(record)
  return record
}

export async function createGameSession(
  userId: string,
  gameId: string,
  sessionName: string,
  progress?: Record<string, unknown>
): Promise<GameSessionRecord> {
  const spaceTimeResult = await callSpaceTime<GameSessionRecord>('create', {
    userId,
    gameId,
    sessionName,
    progress,
  })

  if (spaceTimeResult.success && spaceTimeResult.data) {
    return spaceTimeResult.data
  }

  if (spaceTimeResult.error) {
    console.warn('[session-store] SpaceTimeDB create failed, falling back to MongoDB:', spaceTimeResult.error)
  }

  return createSessionMongo(userId, gameId, sessionName, progress)
}

export async function listGameSessions(userId: string, gameId: string): Promise<GameSessionRecord[]> {
  const spaceTimeResult = await callSpaceTime<GameSessionRecord[]>('list', { userId, gameId })

  if (spaceTimeResult.success && Array.isArray(spaceTimeResult.data)) {
    return spaceTimeResult.data
  }

  if (spaceTimeResult.error) {
    console.warn('[session-store] SpaceTimeDB list failed, falling back to MongoDB:', spaceTimeResult.error)
  }

  const db = await getDatabase()
  if (!db) {
    return []
  }

  return db
    .collection<GameSessionRecord>('game_sessions')
    .find({ user_id: userId, game_id: gameId })
    .sort({ updated_at: -1 })
    .limit(50)
    .toArray()
}

export async function loadGameSession(
  sessionId: string,
  userId: string
): Promise<GameSessionRecord | null> {
  const spaceTimeResult = await callSpaceTime<GameSessionRecord | null>('load', {
    sessionId,
    userId,
  })

  if (spaceTimeResult.success) {
    return spaceTimeResult.data || null
  }

  if (spaceTimeResult.error) {
    console.warn('[session-store] SpaceTimeDB load failed, falling back to MongoDB:', spaceTimeResult.error)
  }

  const db = await getDatabase()
  if (!db) {
    return null
  }

  return db
    .collection<GameSessionRecord>('game_sessions')
    .findOne({ session_id: sessionId, user_id: userId })
}

export async function saveGameSessionProgress(
  sessionId: string,
  userId: string,
  progress: Record<string, unknown>
): Promise<void> {
  const spaceTimeResult = await callSpaceTime<null>('save-progress', {
    sessionId,
    userId,
    progress,
  })

  if (spaceTimeResult.success) {
    return
  }

  if (spaceTimeResult.error) {
    console.warn('[session-store] SpaceTimeDB save failed, falling back to MongoDB:', spaceTimeResult.error)
  }

  const db = await getDatabase()
  if (!db) {
    throw new Error('Database is not available')
  }

  await db.collection<GameSessionRecord>('game_sessions').updateOne(
    { session_id: sessionId, user_id: userId },
    {
      $set: {
        progress,
        updated_at: Date.now(),
      },
    }
  )
}

export async function appendGameSessionEvent(
  sessionId: string,
  userId: string,
  eventType: 'score_event' | 'agent_log',
  payload: Record<string, unknown>
): Promise<void> {
  const spaceTimeResult = await callSpaceTime<null>('append-event', {
    sessionId,
    userId,
    eventType,
    payload,
    timestamp: Date.now(),
  })

  if (spaceTimeResult.success) {
    return
  }

  if (spaceTimeResult.error) {
    console.warn('[session-store] SpaceTimeDB append event failed, falling back to MongoDB:', spaceTimeResult.error)
  }

  const db = await getDatabase()
  if (!db) {
    throw new Error('Database is not available')
  }

  await db.collection('game_session_events').insertOne({
    session_id: sessionId,
    user_id: userId,
    event_type: eventType,
    payload,
    created_at: Date.now(),
  })
}
