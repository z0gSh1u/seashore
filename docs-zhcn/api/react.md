# @seashore/react API 参考

`@seashore/react` 包提供 React hooks，用于使用服务器发送事件 (SSE) 流式传输构建与 Seashore 智能体的聊天界面。

## 目录

- [useSeashoreChat](#useseashorechat)
  - [配置](#配置)
  - [返回值](#返回值)
  - [使用示例](#使用示例)
- [完整示例](#完整示例)

---

## useSeashoreChat

用于通过支持 SSE 流式传输的 HTTP 管理与 Seashore 智能体的聊天交互的 React hook。

```typescript
function useSeashoreChat(config: UseSeashoreChatConfig): UseSeashoreChatReturn
```

**参数：**
- `config` (`UseSeashoreChatConfig`): Hook 配置

**返回值：**
- `UseSeashoreChatReturn`: 聊天状态和方法

---

### 配置

```typescript
interface UseSeashoreChatConfig {
  endpoint: string
  threadId?: string
  onToolCall?: (call: unknown) => void
  onError?: (error: Error) => void
}
```

**属性：**

- `endpoint` (`string`): Seashore 智能体 API 的基础 URL（例如 `'http://localhost:3000'`）

- `threadId` (`string`, 可选): 用于持久化对话历史的线程 ID。如果提供，消息将保存到后端。

- `onToolCall` (`(call: unknown) => void`, 可选): 当智能体调用工具时触发的回调。用于在 UI 中显示工具使用情况。

- `onError` (`(error: Error) => void`, 可选): 流式传输期间发生错误时触发的回调。

**示例：**

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

### 返回值

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

对话中所有消息的数组，包括用户和助手消息。

**Message 接口：**

```typescript
interface Message {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  parts?: Array<{ type: string; content: string }>
  createdAt: Date
}
```

**示例：**

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

向智能体发送消息。此函数：
1. 将用户消息添加到 `messages` 数组
2. 创建占位符助手消息
3. 通过 SSE 流式传输智能体的响应
4. 随着块的到达更新助手消息内容

**示例：**

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

指示智能体当前是否正在流式传输响应。使用此项禁用发送按钮或显示加载指示器。

**示例：**

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

包含最近的错误（如果有）。如果没有发生错误则为 null。

**示例：**

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

清除对话中的所有消息并重置错误状态。用于开始新对话。

**示例：**

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

## 使用示例

### 基础聊天界面

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

### 带线程的持久对话

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

### 带工具调用可视化

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

### 加载之前的消息

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

## 完整示例

### 功能齐全的聊天应用

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

### CSS 样式

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

## 类型导出

```typescript
import type {
  UseSeashoreChatConfig,
  UseSeashoreChatReturn,
} from '@seashore/react'
```

---

## 最佳实践

1. **优雅地处理错误**：始终向用户显示错误消息并提供恢复方法。

2. **在流式传输期间禁用输入**：防止用户在处理消息时发送多条消息。

3. **自动滚动到底部**：随着新内容的到来，保持最新消息可见。

4. **持久化 threadId**：将线程 ID 存储在 localStorage 或 URL 参数中以恢复对话。

5. **显示输入指示器**：使用 `isStreaming` 显示输入指示器以获得更好的用户体验。

6. **卸载时清理**：Hook 会自动处理清理，但要确保不泄漏订阅。

7. **优化重新渲染**：如果渲染大量消息，对消息组件使用 React.memo。

8. **处理网络错误**：在 try/catch 中包装 API 调用并显示用户友好的错误消息。

9. **支持 markdown**：考虑使用 markdown 渲染器在消息中实现富格式化。

10. **添加消息反应**：扩展 Message 接口以支持用户反应（👍、👎）。
