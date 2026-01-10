# Multimodal

Seashore supports multimodal operations including image generation, video generation, transcription, and text-to-speech.

## Image Generation

Generate images from text descriptions:

### OpenAI (DALL-E)

```typescript
import { openaiImage, generateImage } from '@seashore/llm'

const model = openaiImage('dall-e-3')

const result = await generateImage(model, {
  prompt: 'A serene Japanese garden with cherry blossoms',
  size: '1024x1024',
  quality: 'standard',
  n: 1,
})

console.log(result.url)      // URL to the generated image
console.log(result.revisedPrompt) // DALL-E may revise your prompt
```

### Gemini (Imagen)

```typescript
import { geminiImage } from '@seashore/llm'

const model = geminiImage('imagen-3.0-generate-001')

const result = await generateImage(model, {
  prompt: 'A futuristic cityscape at sunset',
  size: '1024x1024',
})
```

## Image Options

```typescript
const result = await generateImage(model, {
  prompt: 'A mountain landscape',
  size: '1024x1024',        // 256x256, 512x512, 1024x1024, 1792x1024
  quality: 'hd',            // 'standard' or 'hd' (DALL-E 3)
  style: 'vivid',           // 'vivid' or 'natural' (DALL-E 3)
  n: 2,                     // Number of images (DALL-E 2: 1-4, DALL-E 3: 1)
})
```

## Video Generation

Generate videos with OpenAI Sora:

```typescript
import { openaiVideo, generateVideo } from '@seashore/llm'

const model = openaiVideo('sora')

const job = await generateVideo(model, {
  prompt: 'A dog running through a field of flowers',
  duration: '5s',
  aspectRatio: '16:9',
})

console.log(job.id)       // Job ID for checking status
console.log(job.status)   // 'processing', 'completed', 'failed'
```

### Check Video Status

```typescript
import { checkVideoStatus } from '@seashore/llm'

const status = await checkVideoStatus(model, job.id)

if (status.status === 'completed') {
  console.log(status.url) // URL to the video
}
```

## Transcription

Convert audio to text:

### OpenAI Whisper

```typescript
import { openaiTranscription, generateTranscription } from '@seashore/llm'

const model = openaiTranscription('whisper-1')

const result = await generateTranscription(model, {
  file: audioFile,        // File or Buffer
  language: 'en',         // Optional: auto-detect
  prompt: 'Meeting notes', // Optional: guide the transcription
})

console.log(result.text)         // Transcribed text
console.log(result.duration)     // Audio duration
console.log(result.segments)     // Timestamps
```

### With Timestamps

```typescript
const result = await generateTranscription(model, {
  file: audioFile,
  timestampGrants: ['word'], // Add timestamps for each word
})

result.segments.forEach(segment => {
  console.log(`${segment.start} - ${segment.end}: ${segment.text}`)
})
```

## Text-to-Speech

Convert text to audio:

### OpenAI TTS

```typescript
import { openaiTTS, generateSpeech } from '@seashore/llm'

const model = openaiTTS('tts-1')

const audio = await generateSpeech(model, {
  text: 'Hello, welcome to Seashore!',
  voice: 'alloy',          // alloy, echo, fable, onyx, nova, shimmer
  speed: 1.0,             // 0.25 to 4.0
})

// audio is a Buffer containing the MP3
```

### Save to File

```typescript
import fs from 'fs'

const audio = await generateSpeech(model, {
  text: 'Hello world',
  voice: 'nova',
})

fs.writeFileSync('output.mp3', audio)
```

### Gemini TTS

```typescript
import { geminiTTS } from '@seashore/llm'

const model = geminiTTS('*') // Use default model

const audio = await generateSpeech(model, {
  text: 'Hello from Gemini',
  languageCode: 'en-US',
  voiceName: 'en-US-Neural2-C',
})
```

## Vision (Image Understanding)

Analyze images with multimodal models:

```typescript
import { openaiText } from '@seashore/llm'

const model = openaiText('gpt-4o') // Supports vision

const result = await model.chat({
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Describe this image:' },
        {
          type: 'image',
          image: 'https://example.com/image.jpg', // URL or base64
        },
      ],
    },
  ],
})

console.log(result.content)
```

## Multimodal Agents

Create agents that can see and hear:

```typescript
import { createAgent } from '@seashore/agent'
import { openaiText } from '@seashore/llm'

const visualAgent = createAgent({
  name: 'visual-assistant',
  model: openaiText('gpt-4o'),
  systemPrompt: 'You are a helpful assistant that can analyze images.',
})

const result = await visualAgent.run({
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'What do you see?' },
        { type: 'image', image: imageUrl },
      ],
    },
  ],
})
```

## Best Practices

1. **Cost Management** — Image/video generation is expensive
2. **Error Handling** — Jobs may fail or take time
3. **Async Processing** — Use job queues for video generation
4. **Storage** — Store generated media efficiently
5. **Caching** — Same prompts generate similar results

## Next Steps

- [Workflows](../workflows/index.md) — Combine multimodal operations
- [Deployment](../integrations/deploy.md) — Serve multimodal agents
