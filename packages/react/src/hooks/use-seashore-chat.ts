import { useState, useCallback, useRef } from 'react'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  parts?: Array<{ type: string; content: string }>
  createdAt: Date
}

export interface UseSeashoreChatConfig {
  endpoint: string
  threadId?: string
  onToolCall?: (call: unknown) => void
  onError?: (error: Error) => void
}

export interface UseSeashoreChatReturn {
  messages: Message[]
  sendMessage: (content: string) => void
  isStreaming: boolean
  error: Error | null
  clearMessages: () => void
}

let messageIdCounter = 0
function generateMessageId(): string {
  return `msg_${Date.now()}_${++messageIdCounter}`
}

export function useSeashoreChat(config: UseSeashoreChatConfig): UseSeashoreChatReturn {
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(
    async (content: string) => {
      const userMessage: Message = {
        id: generateMessageId(),
        role: 'user',
        content,
        createdAt: new Date(),
      }

      setMessages((prev) => [...prev, userMessage])
      setIsStreaming(true)
      setError(null)

      const assistantMessage: Message = {
        id: generateMessageId(),
        role: 'assistant',
        content: '',
        createdAt: new Date(),
      }
      setMessages((prev) => [...prev, assistantMessage])

      try {
        abortRef.current = new AbortController()

        const allMessages = [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        }))

        const response = await fetch(config.endpoint + '/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: allMessages,
            threadId: config.threadId,
            stream: true,
          }),
          signal: abortRef.current.signal,
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const reader = response.body?.getReader()
        if (!reader) throw new Error('No response body')

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') continue

              try {
                const chunk = JSON.parse(data) as {
                  type: string
                  delta?: string
                  content?: string
                  name?: string
                }

                if (chunk.type === 'content' && chunk.delta) {
                  setMessages((prev) => {
                    const updated = [...prev]
                    const last = updated[updated.length - 1]
                    if (last?.role === 'assistant') {
                      updated[updated.length - 1] = {
                        ...last,
                        content: last.content + chunk.delta,
                      }
                    }
                    return updated
                  })
                }

                if (chunk.type === 'tool_call' && config.onToolCall) {
                  config.onToolCall(chunk)
                }
              } catch {
                // Skip invalid JSON lines
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err)
          config.onError?.(err)
        }
      } finally {
        setIsStreaming(false)
        abortRef.current = null
      }
    },
    [config, messages],
  )

  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return {
    messages,
    sendMessage,
    isStreaming,
    error,
    clearMessages,
  }
}
