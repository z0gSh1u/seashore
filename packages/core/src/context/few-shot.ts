interface FewShotExample {
  user: string
  assistant: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function fewShotMessages(examples: FewShotExample[]): Message[] {
  return examples.flatMap((example) => [
    { role: 'user' as const, content: example.user },
    { role: 'assistant' as const, content: example.assistant },
  ])
}
