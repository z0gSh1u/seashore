# @seashore/react API Reference

The `@seashore/react` package provides React hooks for building chat interfaces with Seashore agents using Server-Sent Events (SSE) streaming.

## Table of Contents

- [useSeashoreChat](#useseashorechat)
  - [Configuration](#configuration)
  - [Return Values](#return-values)
  - [Usage Examples](#usage-examples)
- [Complete Examples](#complete-examples)

---

## useSeashoreChat

A React hook for managing chat interactions with a Seashore agent over HTTP with SSE streaming support.

```typescript
function useSeashoreChat(config: UseSeashoreChatConfig): UseSeashoreChatReturn
```

**Parameters:**
- `config` (`UseSeashoreChatConfig`): Hook configuration

**Returns:**
- `UseSeashoreChatReturn`: Chat state and methods

---

### Configuration

```typescript
interface UseSeashoreChatConfig {
  endpoint: string
  threadId?: string
  onToolCall?: (call: unknown) => void
  onError?: (error: Error) => void
}
```

**Properties:**

- `endpoint` (`string`): Base URL of the Seashore agent API (e.g., `'http://localhost:3000'`)

- `threadId` (`string`, optional): Thread ID for persisting conversation history. If provided, messages are saved to the backend.

- `onToolCall` (`(call: unknown) => void`, optional): Callback fired when the agent calls a tool. Useful for displaying tool usage in the UI.

- `onError` (`(error: Error) => void`, optional): Callback fired when an error occurs during streaming.

**Example:**

```typescript
import { useSeashoreChat } from '@seashore/react'

function ChatComponent() {
  const chat = useSeashoreChat({
    endpoint: 'http://localhost:3000',
    threadId: 'thread-123',
    onToolCall: (call) => {
      console.log('Agent called tool:', call)
    },
    onError: (error) => {
      console.error('Chat error:', error)
    },
  })
  
  // Use chat.sendMessage, chat.messages, etc.
}
```

---

### Return Values

```typescript
interface UseSeashoreChatReturn {
  messages: Message[]
  sendMessage: (content: string) => void
  isStreaming: boolean
  error: Error | null
  clearMessages: () => void
}
```

#### messages

```typescript
messages: Message[]
```

Array of all messages in the conversation, including both user and assistant messages.

**Message Interface:**

```typescript
interface Message {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  parts?: Array<{ type: string; content: string }>
  createdAt: Date
}
```

**Example:**

```typescript
const { messages } = useSeashoreChat({ endpoint: 'http://localhost:3000' })

return (
  <div>
    {messages.map((msg) => (
      <div key={msg.id} className={msg.role}>
        <strong>{msg.role}:</strong> {msg.content}
        <span>{msg.createdAt.toLocaleTimeString()}</span>
      </div>
    ))}
  </div>
)
```

#### sendMessage

```typescript
sendMessage: (content: string) => void
```

Sends a message to the agent. This function:
1. Adds the user message to the `messages` array
2. Creates a placeholder assistant message
3. Streams the agent's response via SSE
4. Updates the assistant message content as chunks arrive

**Example:**

```typescript
const { sendMessage, isStreaming } = useSeashoreChat({
  endpoint: 'http://localhost:3000',
})

function handleSubmit(e: FormEvent) {
  e.preventDefault()
  const input = e.currentTarget.message.value
  sendMessage(input)
  e.currentTarget.reset()
}

return (
  <form onSubmit={handleSubmit}>
    <input name="message" disabled={isStreaming} />
    <button type="submit" disabled={isStreaming}>
      Send
    </button>
  </form>
)
```

#### isStreaming

```typescript
isStreaming: boolean
```

Indicates whether the agent is currently streaming a response. Use this to disable the send button or show a loading indicator.

**Example:**

```typescript
const { isStreaming } = useSeashoreChat({ endpoint: 'http://localhost:3000' })

return (
  <div>
    {isStreaming && <span className="spinner">Thinking...</span>}
    <button disabled={isStreaming}>
      {isStreaming ? 'Sending...' : 'Send'}
    </button>
  </div>
)
```

#### error

```typescript
error: Error | null
```

Contains the most recent error, if any. Null if no error has occurred.

**Example:**

```typescript
const { error } = useSeashoreChat({ endpoint: 'http://localhost:3000' })

return (
  <div>
    {error && (
      <div className="error-banner">
        Error: {error.message}
      </div>
    )}
  </div>
)
```

#### clearMessages

```typescript
clearMessages: () => void
```

Clears all messages from the conversation and resets the error state. Useful for starting a new conversation.

**Example:**

```typescript
const { messages, clearMessages } = useSeashoreChat({
  endpoint: 'http://localhost:3000',
})

return (
  <div>
    <button onClick={clearMessages}>New Conversation</button>
    {/* messages display */}
  </div>
)
```

---

## Usage Examples

### Basic Chat Interface

```typescript
import { useSeashoreChat } from '@seashore/react'
import { useState, FormEvent } from 'react'

export function ChatInterface() {
  const { messages, sendMessage, isStreaming, error, clearMessages } = useSeashoreChat({
    endpoint: 'http://localhost:3000',
  })

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const message = formData.get('message') as string
    if (message.trim()) {
      sendMessage(message)
      e.currentTarget.reset()
    }
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h1>AI Assistant</h1>
        <button onClick={clearMessages}>Clear</button>
      </div>

      {error && (
        <div className="error-banner">
          Error: {error.message}
        </div>
      )}

      <div className="messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.role}`}>
            <div className="message-role">{msg.role}</div>
            <div className="message-content">{msg.content}</div>
            <div className="message-time">
              {msg.createdAt.toLocaleTimeString()}
            </div>
          </div>
        ))}
        {isStreaming && (
          <div className="message assistant">
            <div className="typing-indicator">...</div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="chat-input">
        <input
          name="message"
          placeholder="Type a message..."
          disabled={isStreaming}
          autoComplete="off"
        />
        <button type="submit" disabled={isStreaming}>
          {isStreaming ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  )
}
```

### Persistent Conversations with Threads

```typescript
import { useSeashoreChat } from '@seashore/react'
import { useEffect, useState } from 'react'

export function ThreadedChat() {
  const [threadId, setThreadId] = useState<string | null>(null)

  // Create a new thread on mount
  useEffect(() => {
    fetch('http://localhost:3000/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Conversation' }),
    })
      .then((r) => r.json())
      .then((thread) => setThreadId(thread.id))
  }, [])

  const chat = useSeashoreChat({
    endpoint: 'http://localhost:3000',
    threadId: threadId || undefined,
  })

  if (!threadId) {
    return <div>Creating conversation...</div>
  }

  return (
    <div>
      <div>Thread ID: {threadId}</div>
      {/* Chat UI */}
    </div>
  )
}
```

### With Tool Call Visualization

```typescript
import { useSeashoreChat } from '@seashore/react'
import { useState } from 'react'

export function ChatWithTools() {
  const [toolCalls, setToolCalls] = useState<any[]>([])

  const { messages, sendMessage, isStreaming } = useSeashoreChat({
    endpoint: 'http://localhost:3000',
    onToolCall: (call) => {
      console.log('Tool called:', call)
      setToolCalls((prev) => [...prev, call])
    },
  })

  return (
    <div>
      <div className="messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.role}`}>
            {msg.content}
          </div>
        ))}
      </div>

      {toolCalls.length > 0 && (
        <div className="tool-calls">
          <h3>Tool Calls</h3>
          {toolCalls.map((call, i) => (
            <div key={i} className="tool-call">
              <strong>{(call as any).name}</strong>
              <pre>{JSON.stringify((call as any).arguments, null, 2)}</pre>
            </div>
          ))}
        </div>
      )}

      {/* Input form */}
    </div>
  )
}
```

### Loading Previous Messages

```typescript
import { useSeashoreChat } from '@seashore/react'
import { useEffect, useState } from 'react'

export function ChatWithHistory({ threadId }: { threadId: string }) {
  const [initialMessages, setInitialMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const chat = useSeashoreChat({
    endpoint: 'http://localhost:3000',
    threadId,
  })

  // Load existing messages
  useEffect(() => {
    fetch(`http://localhost:3000/threads/${threadId}/messages`)
      .then((r) => r.json())
      .then((msgs) => {
        setInitialMessages(msgs)
        setLoading(false)
      })
  }, [threadId])

  if (loading) {
    return <div>Loading conversation...</div>
  }

  return (
    <div>
      {/* Display initial messages */}
      {initialMessages.map((msg) => (
        <div key={msg.id}>
          <strong>{msg.role}:</strong> {msg.content}
        </div>
      ))}

      {/* Display new messages from hook */}
      {chat.messages.map((msg) => (
        <div key={msg.id}>
          <strong>{msg.role}:</strong> {msg.content}
        </div>
      ))}

      {/* Input form */}
    </div>
  )
}
```

---

## Complete Examples

### Full-Featured Chat Application

```typescript
import { useSeashoreChat } from '@seashore/react'
import { useState, useRef, useEffect, FormEvent } from 'react'
import './Chat.css'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export function AdvancedChat() {
  const [threadId, setThreadId] = useState<string>()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const {
    messages,
    sendMessage,
    isStreaming,
    error,
    clearMessages,
  } = useSeashoreChat({
    endpoint: import.meta.env.VITE_API_URL || 'http://localhost:3000',
    threadId,
    onToolCall: (call) => {
      console.log('Tool used:', call)
    },
    onError: (err) => {
      console.error('Chat error:', err)
    },
  })

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Create thread on mount
  useEffect(() => {
    const createThread = async () => {
      const response = await fetch('http://localhost:3000/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Chat - ${new Date().toLocaleString()}`,
        }),
      })
      const thread = await response.json()
      setThreadId(thread.id)
    }
    createThread()
  }, [])

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const message = formData.get('message') as string
    
    if (message.trim() && !isStreaming) {
      sendMessage(message)
      e.currentTarget.reset()
    }
  }

  const handleNewChat = () => {
    clearMessages()
    setThreadId(undefined)
    // Create new thread
    fetch('http://localhost:3000/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Chat' }),
    })
      .then((r) => r.json())
      .then((thread) => setThreadId(thread.id))
  }

  return (
    <div className="chat-app">
      <header className="chat-header">
        <h1>🌊 Seashore Chat</h1>
        <button onClick={handleNewChat} className="new-chat-btn">
          New Chat
        </button>
      </header>

      {error && (
        <div className="error-alert">
          <span>⚠️ {error.message}</span>
          <button onClick={() => clearMessages()}>Dismiss</button>
        </div>
      )}

      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-state">
            <h2>Welcome to Seashore!</h2>
            <p>Start a conversation by typing a message below.</p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`message ${msg.role}`}
                data-role={msg.role}
              >
                <div className="message-avatar">
                  {msg.role === 'user' ? '👤' : '🤖'}
                </div>
                <div className="message-content">
                  <div className="message-text">{msg.content}</div>
                  <div className="message-timestamp">
                    {msg.createdAt.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            {isStreaming && (
              <div className="message assistant typing">
                <div className="message-avatar">🤖</div>
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <form onSubmit={handleSubmit} className="chat-input-form">
        <input
          name="message"
          type="text"
          placeholder="Type your message..."
          disabled={isStreaming}
          className="chat-input"
          autoFocus
        />
        <button
          type="submit"
          disabled={isStreaming}
          className="send-button"
        >
          {isStreaming ? '⏳' : '➤'}
        </button>
      </form>

      {threadId && (
        <div className="thread-info">
          Thread: {threadId}
        </div>
      )}
    </div>
  )
}
```

### CSS Styles

```css
/* Chat.css */
.chat-app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: 800px;
  margin: 0 auto;
  background: #f5f5f5;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #2563eb;
  color: white;
}

.new-chat-btn {
  padding: 0.5rem 1rem;
  border: none;
  background: white;
  color: #2563eb;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
}

.error-alert {
  display: flex;
  justify-content: space-between;
  padding: 1rem;
  background: #fee;
  color: #c00;
  border-bottom: 2px solid #c00;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: #666;
}

.message {
  display: flex;
  gap: 0.75rem;
  animation: slideIn 0.2s ease-out;
}

.message.user {
  flex-direction: row-reverse;
}

.message-avatar {
  width: 32px;
  height: 32px;
  font-size: 24px;
  flex-shrink: 0;
}

.message-content {
  max-width: 70%;
  padding: 0.75rem;
  border-radius: 8px;
  background: white;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.message.user .message-content {
  background: #2563eb;
  color: white;
}

.message-timestamp {
  font-size: 0.75rem;
  color: #999;
  margin-top: 0.25rem;
}

.message.user .message-timestamp {
  color: rgba(255, 255, 255, 0.7);
}

.typing-indicator {
  display: flex;
  gap: 0.25rem;
  padding: 0.75rem;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #999;
  animation: bounce 1.4s infinite ease-in-out;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

.chat-input-form {
  display: flex;
  gap: 0.5rem;
  padding: 1rem;
  background: white;
  border-top: 1px solid #ddd;
}

.chat-input {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1rem;
}

.send-button {
  padding: 0.75rem 1.5rem;
  border: none;
  background: #2563eb;
  color: white;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1.2rem;
}

.send-button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.thread-info {
  padding: 0.5rem;
  font-size: 0.75rem;
  color: #666;
  text-align: center;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}
```

---

## Type Exports

```typescript
import type {
  UseSeashoreChatConfig,
  UseSeashoreChatReturn,
} from '@seashore/react'
```

---

## Best Practices

1. **Handle errors gracefully**: Always display error messages to users and provide a way to recover.

2. **Disable input during streaming**: Prevent users from sending multiple messages while one is being processed.

3. **Auto-scroll to bottom**: Keep the latest messages visible as new content arrives.

4. **Persist threadId**: Store thread IDs in localStorage or URL params to restore conversations.

5. **Show typing indicators**: Use `isStreaming` to display a typing indicator for better UX.

6. **Clean up on unmount**: The hook handles cleanup automatically, but ensure you don't leak subscriptions.

7. **Optimize re-renders**: Use React.memo for message components if rendering many messages.

8. **Handle network errors**: Wrap API calls in try/catch and show user-friendly error messages.

9. **Support markdown**: Consider using a markdown renderer for rich formatting in messages.

10. **Add message reactions**: Extend the Message interface to support user reactions (👍, 👎).
