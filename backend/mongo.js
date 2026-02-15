import 'dotenv/config'
import { MongoClient } from 'mongodb'
import { ObjectId } from 'mongodb'

const uri = process.env.MONGO_URI
const client = new MongoClient(uri)

let db

export async function connectDB() {
  if (!db) {
    if (!uri) throw new Error('MONGO_URI not defined')
    await client.connect()
    db = client.db('aiinterviewer')
    console.log('MongoDB connected')
  }
  return db
}

export async function saveSession(session) {
    const db = await connectDB()
    const result = await db.collection('sessions').insertOne(session)
    console.log('Inserted session with _id:', result.insertedId)
    return result
  }  

export async function getSessions() {
  const db = await connectDB()
  return db.collection('sessions').find().sort({ createdAt: -1 }).toArray()
}

export async function getSessionById(id) {
  const db = await connectDB()
  return db.collection('sessions').findOne({ _id: new ObjectId(id) })
}

export async function getAnalytics() {
    const db = await connectDB()
    const sessions = await db.collection('sessions').find().toArray()
  
    if (sessions.length === 0) return { count: 0, avgScore: null, minScore: null, maxScore: null, allTexts: [] }
  
    const scores = sessions.map(s => s.score).filter(s => typeof s === 'number')
    const allTexts = sessions.flatMap(s => [s.feedback || '', s.resume_summary || '', ...(s.messages?.map(m => m.content) || [])])
  
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length
    const minScore = Math.min(...scores)
    const maxScore = Math.max(...scores)
  
    return { count: sessions.length, avgScore, minScore, maxScore, allTexts }
  }