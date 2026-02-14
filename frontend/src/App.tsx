// App.tsx
import { useState } from 'react'
import './App.css'

const experts = [
  { id: 1, name: 'Project Manager AI' },
  { id: 2, name: 'ML Researcher AI' },
  { id: 3, name: 'Finance Advisor AI' },
  { id: 4, name: 'Health Coach AI' },
]

function App() {
  const [selectedExpert, setSelectedExpert] = useState(experts[0])
  const [voiceMode, setVoiceMode] = useState(false)
  const [wordLimit, setWordLimit] = useState(200)
  const [timeLimit, setTimeLimit] = useState(60)
  const [sessionSummary, setSessionSummary] = useState('')
  const [feedback, setFeedback] = useState('')
  const [fileName, setFileName] = useState('')

  return (
    <div className="app">
      <header className="header">
        <h1>ThinkAloud</h1>
        <p>Your multi‑expert AI workspace for deep thinking, planning, and collaboration.</p>
      </header>

      <div className="main">
        <aside className="sidebar">
          <h2>AI Experts</h2>
          {experts.map((expert) => (
            <button
              key={expert.id}
              className={`expert-btn ${selectedExpert.id === expert.id ? 'active' : ''}`}
              onClick={() => setSelectedExpert(expert)}
            >
              {expert.name}
            </button>
          ))}
        </aside>

        <section className="chat">
          <div className="chat-header">
            <h2>{selectedExpert.name}</h2>
            <div className="session-buttons">
              <button>Resume Session</button>
              <button onClick={() => setSessionSummary('')}>New Session</button>
            </div>
          </div>

          <div className="chat-window">
            <p className="placeholder">Conversation with AI will appear here...</p>
          </div>

          <div className="controls">
            <div className="toggle-card">
              <span>Voice Mode</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={voiceMode}
                  onChange={() => setVoiceMode(!voiceMode)}
                />
                <span className="slider" />
              </label>
            </div>

            <div className="limit-card">
              {!voiceMode ? (
                <>
                  <label>Word Limit</label>
                  <input
                    type="number"
                    value={wordLimit}
                    onChange={(e) => setWordLimit(Number(e.target.value))}
                  />
                </>
              ) : (
                <>
                  <label>Time Limit (sec)</label>
                  <input
                    type="number"
                    value={timeLimit}
                    onChange={(e) => setTimeLimit(Number(e.target.value))}
                  />
                </>
              )}
            </div>

            <div className="file-card">
              <label>Upload File</label>
              <input
                type="file"
                onChange={(e) => setFileName(e.target.files?.[0]?.name || '')}
              />
              <span className="file-name">{fileName}</span>
            </div>
          </div>

          <div className="summary">
            <h3>Session Summary</h3>
            <textarea
              placeholder="AI-generated summary will appear here..."
              value={sessionSummary}
              onChange={(e) => setSessionSummary(e.target.value)}
            />

            <h3>User Feedback for Future Sessions</h3>
            <textarea
              placeholder="Notes for the agent to remember next time..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />
          </div>
        </section>
      </div>
    </div>
  )
}

export default App