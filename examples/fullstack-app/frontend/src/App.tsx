import { useState, useEffect } from 'react'
import Chat from './Chat'
import './App.css'

interface Thread {
  id: string
  title: string | null
  createdAt: string
  updatedAt: string
}

function App() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [currentThreadId, setCurrentThreadId] = useState<string | undefined>()
  const [isLoadingThreads, setIsLoadingThreads] = useState(true)

  // Load threads on mount
  useEffect(() => {
    loadThreads()
  }, [])

  const loadThreads = async () => {
    setIsLoadingThreads(true)
    try {
      const response = await fetch('http://localhost:3001/api/threads')
      if (!response.ok) throw new Error('Failed to load threads')
      const data = await response.json()
      setThreads(data)
    } catch (error) {
      console.error('Error loading threads:', error)
    } finally {
      setIsLoadingThreads(false)
    }
  }

  const createNewThread = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Conversation ${new Date().toLocaleString()}`,
        }),
      })

      if (!response.ok) throw new Error('Failed to create thread')

      const newThread = await response.json()
      setThreads((prev) => [newThread, ...prev])
      setCurrentThreadId(newThread.id)
    } catch (error) {
      console.error('Error creating thread:', error)
      alert('Failed to create new thread')
    }
  }

  const selectThread = (threadId: string) => {
    setCurrentThreadId(threadId)
  }

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>🌊 Seashore</h1>
          <button onClick={createNewThread} className="new-thread-btn">
            + New Chat
          </button>
        </div>

        <div className="threads-list">
          {isLoadingThreads ? (
            <div className="loading">Loading threads...</div>
          ) : threads.length === 0 ? (
            <div className="empty-state">
              <p>No conversations yet</p>
              <p className="hint">Click "New Chat" to start</p>
            </div>
          ) : (
            threads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => selectThread(thread.id)}
                className={`thread-item ${currentThreadId === thread.id ? 'active' : ''}`}
              >
                <div className="thread-title">
                  {thread.title || 'Untitled Conversation'}
                </div>
                <div className="thread-date">
                  {new Date(thread.updatedAt).toLocaleDateString()}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="sidebar-footer">
          <p className="version">Full-Stack Example</p>
          <p className="tech">React + Hono + Seashore</p>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="main-content">
        {currentThreadId ? (
          <Chat threadId={currentThreadId} />
        ) : (
          <div className="welcome-screen">
            <div className="welcome-content">
              <h2>🌊 Welcome to Seashore Chat</h2>
              <p>
                A full-stack AI chat application powered by Seashore
              </p>
              <div className="features">
                <div className="feature">
                  <span className="icon">🤖</span>
                  <h3>AI Assistant</h3>
                  <p>ReAct agent with tool use</p>
                </div>
                <div className="feature">
                  <span className="icon">⚡</span>
                  <h3>Real-time Streaming</h3>
                  <p>Server-Sent Events (SSE)</p>
                </div>
                <div className="feature">
                  <span className="icon">💾</span>
                  <h3>Persistent Storage</h3>
                  <p>PostgreSQL with threads</p>
                </div>
              </div>
              <button onClick={createNewThread} className="start-btn">
                Start New Conversation
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
