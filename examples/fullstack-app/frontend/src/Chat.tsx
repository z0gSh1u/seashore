import { useState, useRef, useEffect } from 'react'
import { useSeashoreChat } from '@seashore/react'
import './Chat.css'

interface ChatProps {
  threadId: string
}

function Chat({ threadId }: ChatProps) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { messages, sendMessage, isStreaming, error, clearMessages } = useSeashoreChat({
    endpoint: 'http://localhost:3001/api',
    threadId,
    onError: (err) => {
      console.error('Chat error:', err)
    },
  })

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isStreaming) return

    sendMessage(input)
    setInput('')
  }

  const handleClearMessages = () => {
    if (confirm('Clear all messages in this conversation?')) {
      clearMessages()
    }
  }

  return (
    <div className="chat-container">
      {/* Header */}
      <header className="chat-header">
        <div>
          <h2>Chat</h2>
          <p className="thread-id">Thread: {threadId.slice(0, 8)}...</p>
        </div>
        <button onClick={handleClearMessages} className="clear-btn" disabled={isStreaming}>
          Clear
        </button>
      </header>

      {/* Messages */}
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-chat">
            <p>Start a conversation!</p>
            <p className="hint">Try asking: "What is 42 * 17?" or "What time is it in Tokyo?"</p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`message ${message.role}`}>
              <div className="message-header">
                <span className="role">
                  {message.role === 'user' ? '👤 You' : '🤖 Assistant'}
                </span>
                <span className="timestamp">
                  {message.createdAt.toLocaleTimeString()}
                </span>
              </div>
              <div className="message-content">
                {message.content || <span className="typing">Thinking...</span>}
              </div>
            </div>
          ))
        )}

        {error && (
          <div className="error-message">
            <strong>Error:</strong> {error.message}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="input-container">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isStreaming ? 'Assistant is typing...' : 'Type your message...'}
          disabled={isStreaming}
          className="message-input"
        />
        <button type="submit" disabled={!input.trim() || isStreaming} className="send-btn">
          {isStreaming ? '⏳' : '📤'} Send
        </button>
      </form>
    </div>
  )
}

export default Chat
