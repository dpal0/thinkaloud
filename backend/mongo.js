import 'dotenv/config'
import { MongoClient, ObjectId } from 'mongodb'

const uri = process.env.MONGO_URI || process.env.MONGODB_URI

let client = null
let db = null

async function connectDB() {
  if (db) return db

  if (!uri) {
    console.warn('⚠️ No Mongo URI found — running without database')
    return null
  }

  try {
    client = new MongoClient(uri)
    await client.connect()
    db = client.db('aiinterviewer')
    console.log('✅ MongoDB connected')
    return db
  } catch (err) {
    console.error('⚠️ Mongo connection failed, continuing without DB:', err.message)
    return null
  }
}

export async function saveSession(session) {
  const db = await connectDB()
  if (!db) return { skipped: true }

  const result = await db.collection('sessions').insertOne(session)
  console.log('Inserted session with _id:', result.insertedId)
  return result
}

export async function getSessions() {
  const db = await connectDB()
  if (!db) return []

  return db.collection('sessions').find().sort({ createdAt: -1 }).toArray()
}

export async function getSessionById(id) {
  const db = await connectDB()
  if (!db) return null

  return db.collection('sessions').findOne({ _id: new ObjectId(id) })
}

export async function getAnalytics() {
  const db = await connectDB()
  if (!db) {
    return { count: 0, avgScore: null, minScore: null, maxScore: null, allTexts: [] }
  }

  const sessions = await db.collection('sessions').find().toArray()

  if (sessions.length === 0) {
    return { count: 0, avgScore: null, minScore: null, maxScore: null, allTexts: [] }
  }

  const scores = sessions.map(s => s.score).filter(s => typeof s === 'number')
  const allTexts = sessions.flatMap(s => [
    s.feedback || '',
    s.resume_summary || '',
    ...(s.messages?.map(m => m.content) || [])
  ])

  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null
  const minScore = scores.length ? Math.min(...scores) : null
  const maxScore = scores.length ? Math.max(...scores) : null

  return { count: sessions.length, avgScore, minScore, maxScore, allTexts }
}
