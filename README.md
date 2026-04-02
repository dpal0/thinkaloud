# ThinkAloud

> AI-powered interview preparation — practice like it's the real thing.

Built for **HackFax Hack 2026**. ThinkAloud analyzes your resume against a job description, then conducts a personalized behavioral interview with real-time voice support and detailed scoring feedback.

---

## Features

- **Resume Analysis** — Upload a PDF or paste your resume; Gemini evaluates your fit against the target job and assigns a fit score (0–100).
- **Adaptive Interview** — 5–8 personalized questions generated from your resume and the job description, just like a real interviewer would ask.
- **Voice I/O** — Answer questions via microphone (real-time speech-to-text over WebSocket) and hear questions read aloud via ElevenLabs TTS.
- **Per-Answer Scoring** — Each answer is scored 0–10 by the AI with reasoning.
- **Overall Score** — Combined score: 40% resume fit + 60% interview performance.
- **Session Feedback** — Plain-language summary of strengths and areas to improve.
- **Session History** — All sessions saved to MongoDB; browse past interviews and analytics.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| Backend | Node.js + Express |
| LLM | Google Gemini 2.5 Flash |
| TTS | ElevenLabs |
| STT | WebSocket streaming (backend) |
| Database | MongoDB (Atlas) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Google AI Studio](https://aistudio.google.com) API key (Gemini)
- An [ElevenLabs](https://elevenlabs.io) API key + voice ID (optional — for audio)
- A MongoDB Atlas connection string (or local MongoDB)

### 1. Backend

```bash
cd backend
npm install
```

Create a `.env` file in `backend/`:

```env
GEMINI_API_KEY=your_gemini_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=your_voice_id
MONGO_URI=your_mongodb_connection_string
PORT=3001
```

```bash
npm start          # production
npm run dev        # development (auto-reload)
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev        # starts at http://localhost:5173
```

---

## API Overview

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/analyze` | Upload resume + job description, get first question |
| `POST` | `/api/interview/next` | Submit answer, get next question or scoring |
| `POST` | `/api/tts` | Text-to-speech via ElevenLabs |
| `POST` | `/api/session/save` | Save completed session |
| `GET` | `/api/sessions` | List all sessions |
| `GET` | `/api/session/:id` | Get a specific session |
| `GET` | `/api/analytics` | Aggregated score analytics |
| `WS` | `/ws/stt` | Real-time speech-to-text streaming |

---

## CodeQuestionBot (Unfinished)

ThinkAloud was originally planned to support multiple "expert" personas. One of them was **CodeQuestionBot** — a technical interviewer that would pull a candidate's GitHub repo, extract relevant code snippets, and ask targeted questions about their own implementations, then grade responses with an LLM.

The concept was inspired by an existing auto-grading project (designed for academic settings) that uses GitHub OAuth, repo ingestion, and LLM-based scoring with anti-cheating signals. The ThinkAloud version would have repurposed that core loop as an interview mode: instead of grading student submissions, it would quiz candidates on code they'd actually written.

The integration was stubbed out in the frontend (`src/cqbot/`) but was disconnected and never fully wired up.

---

## Roadmap

- Additional expert personas (technical, system design, PM)
- Rapid-fire round mode
- Side-by-side resume comparison across sessions
- Code question grading (CodeQuestionBot — in progress)
