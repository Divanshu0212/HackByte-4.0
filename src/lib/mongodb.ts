import { MongoClient, Db } from 'mongodb'

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

const uri = process.env.MONGODB_URI
const options = {}

let client: MongoClient
let clientPromise: Promise<MongoClient>

if (!uri) {
  console.warn('MONGODB_URI not set - database features will be disabled')
  // Create a mock client promise that rejects
  clientPromise = Promise.reject(new Error('MongoDB not configured'))
} else {
  if (process.env.NODE_ENV === 'development') {
    // In development mode, use a global variable so that the value
    // is preserved across module reloads caused by HMR
    if (!global._mongoClientPromise) {
      client = new MongoClient(uri, options)
      global._mongoClientPromise = client.connect()
    }
    clientPromise = global._mongoClientPromise
  } else {
    // In production mode, create a new client for each request
    client = new MongoClient(uri, options)
    clientPromise = client.connect()
  }
}

export async function getDatabase(): Promise<Db | null> {
  try {
    const client = await clientPromise
    return client.db('elixa')
  } catch (error) {
    console.warn('MongoDB connection failed:', error)
    return null
  }
}

export async function saveEvent(eventId: string, data: Record<string, unknown>) {
  const db = await getDatabase()
  if (!db) return null

  return db.collection('events').updateOne(
    { event_id: eventId },
    { $set: { ...data, updated_at: Date.now() } },
    { upsert: true }
  )
}

export async function loadEvent(eventId: string) {
  const db = await getDatabase()
  if (!db) return null

  return db.collection('events').findOne({ event_id: eventId })
}

export async function saveScoreEvent(eventId: string, scoreEvent: Record<string, unknown>) {
  const db = await getDatabase()
  if (!db) return null

  return db.collection('score_events').insertOne({
    event_id: eventId,
    ...scoreEvent,
    created_at: Date.now(),
  })
}

export async function getScoreHistory(eventId: string, limit = 100) {
  const db = await getDatabase()
  if (!db) return []

  return db
    .collection('score_events')
    .find({ event_id: eventId })
    .sort({ created_at: -1 })
    .limit(limit)
    .toArray()
}

export async function saveAgentLog(eventId: string, log: Record<string, unknown>) {
  const db = await getDatabase()
  if (!db) return null

  return db.collection('agent_logs').insertOne({
    event_id: eventId,
    ...log,
    created_at: Date.now(),
  })
}

export default clientPromise
