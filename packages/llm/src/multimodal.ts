/**
 * @seashore/llm - Multimodal Capabilities
 *
 * Image generation, video generation, TTS, and transcription
 */

import type {
  ImageAdapter,
  ImageGenerationOptions,
  ImageGenerationResult,
  VideoAdapter,
  VideoGenerationJob,
  TranscriptionAdapter,
  TranscriptionOptions,
  TranscriptionResult,
  TTSAdapter,
  SpeechOptions,
  SpeechResult,
} from './types';
import { OPENAI_DEFAULT_BASE_URL, GEMINI_DEFAULT_BASE_URL } from './types';

/**
 * Options for configuring multimodal adapters
 */
export interface MultimodalAdapterOptions {
  /**
   * API Key for the provider.
   * If not provided, the adapter will attempt to load it from environment variables.
   */
  readonly apiKey?: string;
  /**
   * Base URL for the API endpoint.
   * Use this for local proxies, enterprise deployments, or compatible third-party APIs.
   */
  readonly baseURL?: string;
}

// ============================================================================
// Image Adapters
// ============================================================================

/**
 * Create an OpenAI image adapter (DALL-E)
 * @param model Model name (default: 'dall-e-3')
 * @param options Optional configuration for apiKey and baseURL
 */
export function openaiImage(
  model: string = 'dall-e-3',
  options?: MultimodalAdapterOptions
): ImageAdapter {
  return {
    provider: 'openai',
    model,
    apiKey: options?.apiKey,
    baseURL: options?.baseURL,
  };
}

/**
 * Create a Gemini image adapter (Imagen)
 * @param model Model name (default: 'imagen-3.0-generate-002')
 * @param options Optional configuration for apiKey and baseURL
 */
export function geminiImage(
  model: string = 'imagen-3.0-generate-002',
  options?: MultimodalAdapterOptions
): ImageAdapter {
  return {
    provider: 'gemini',
    model,
    apiKey: options?.apiKey,
    baseURL: options?.baseURL,
  };
}

/**
 * Generate images from a text prompt
 */
export async function generateImage(
  options: ImageGenerationOptions
): Promise<ImageGenerationResult> {
  const { adapter } = options;

  switch (adapter.provider) {
    case 'openai':
      return generateOpenAIImage(options);
    case 'gemini':
      return generateGeminiImage(options);
    default:
      throw new Error(`Unsupported image provider: ${adapter.provider}`);
  }
}

// OpenAI image generation
async function generateOpenAIImage(
  options: ImageGenerationOptions
): Promise<ImageGenerationResult> {
  const { adapter, prompt, size, quality, style, n, modelOptions } = options;
  const apiKey = getApiKey(adapter.apiKey, 'OPENAI_API_KEY');
  const url = buildOpenAIUrl(adapter.baseURL, '/images/generations');

  const body: Record<string, unknown> = {
    model: adapter.model,
    prompt,
    size: size ?? '1024x1024',
    quality: quality ?? 'standard',
    n: n ?? 1,
    ...modelOptions,
  };

  if (style !== undefined) {
    body['style'] = style;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI image generation error: ${error}`);
  }

  const data = (await response.json()) as OpenAIImageResponse;

  return {
    id: data.created.toString(),
    model: adapter.model,
    images: data.data.map((img) => ({
      url: img.url,
      b64Json: img.b64_json,
      revisedPrompt: img.revised_prompt,
    })),
  };
}

// Gemini image generation
async function generateGeminiImage(
  options: ImageGenerationOptions
): Promise<ImageGenerationResult> {
  const { adapter, prompt, modelOptions } = options;
  const apiKey = getApiKey(adapter.apiKey, 'GOOGLE_API_KEY');
  const url = buildGeminiUrl(adapter.baseURL, adapter.model, 'generateImages', apiKey);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      ...modelOptions,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini image generation error: ${error}`);
  }

  const data = (await response.json()) as GeminiImageResponse;

  return {
    id: Date.now().toString(),
    model: adapter.model,
    images: data.generatedImages.map((img) => ({
      b64Json: img.image.imageBytes,
    })),
  };
}

// ============================================================================
// Video Adapters
// ============================================================================

/**
 * Create an OpenAI video adapter (Sora)
 * @param model Model name (default: 'sora-2')
 * @param options Optional configuration for apiKey and baseURL
 */
export function openaiVideo(
  model: string = 'sora-2',
  options?: MultimodalAdapterOptions
): VideoAdapter {
  return {
    provider: 'openai',
    model,
    apiKey: options?.apiKey,
    baseURL: options?.baseURL,
  };
}

/**
 * Generate video from a text prompt
 * Returns a job that can be polled for completion
 */
export async function generateVideo(options: {
  adapter: VideoAdapter;
  prompt: string;
  duration?: number;
  size?: string;
}): Promise<VideoGenerationJob> {
  const { adapter, prompt, duration, size } = options;

  if (adapter.provider !== 'openai') {
    throw new Error(`Unsupported video provider: ${adapter.provider}`);
  }

  const apiKey = getApiKey(adapter.apiKey, 'OPENAI_API_KEY');
  const url = buildOpenAIUrl(adapter.baseURL, '/videos/generations');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: adapter.model,
      prompt,
      duration: duration ?? 5,
      size: size ?? '1280x720',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI video generation error: ${error}`);
  }

  const data = (await response.json()) as { id: string };

  return {
    jobId: data.id,
    status: 'pending',
  };
}

/**
 * Check video generation job status
 * @param jobId The job ID to check
 * @param adapter Optional adapter to use for apiKey and baseURL configuration
 */
export async function checkVideoStatus(
  jobId: string,
  adapter?: VideoAdapter
): Promise<VideoGenerationJob> {
  const apiKey = getApiKey(adapter?.apiKey, 'OPENAI_API_KEY');
  const url = buildOpenAIUrl(adapter?.baseURL, `/videos/generations/${jobId}`);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI video status error: ${error}`);
  }

  const data = (await response.json()) as {
    id: string;
    status: string;
    video_url?: string;
    error?: string;
  };

  return {
    jobId: data.id,
    status: data.status as VideoGenerationJob['status'],
    videoUrl: data.video_url,
    error: data.error,
  };
}

// ============================================================================
// Transcription Adapters
// ============================================================================

/**
 * Create an OpenAI transcription adapter (Whisper)
 * @param model Model name (default: 'whisper-1')
 * @param options Optional configuration for apiKey and baseURL
 */
export function openaiTranscription(
  model: string = 'whisper-1',
  options?: MultimodalAdapterOptions
): TranscriptionAdapter {
  return {
    provider: 'openai',
    model,
    apiKey: options?.apiKey,
    baseURL: options?.baseURL,
  };
}

/**
 * Transcribe audio to text
 */
export async function generateTranscription(
  options: TranscriptionOptions
): Promise<TranscriptionResult> {
  const { adapter, audio, language, prompt, modelOptions } = options;

  if (adapter.provider !== 'openai') {
    throw new Error(`Unsupported transcription provider: ${adapter.provider}`);
  }

  const apiKey = getApiKey(adapter.apiKey, 'OPENAI_API_KEY');
  const url = buildOpenAIUrl(adapter.baseURL, '/audio/transcriptions');

  const formData = new FormData();
  formData.append('file', audio);
  formData.append('model', adapter.model);

  if (language !== undefined) {
    formData.append('language', language);
  }

  if (prompt !== undefined) {
    formData.append('prompt', prompt);
  }

  // Check if verbose JSON is requested
  const responseFormat = modelOptions?.['response_format'] ?? 'json';
  formData.append('response_format', responseFormat as string);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI transcription error: ${error}`);
  }

  const data = (await response.json()) as OpenAITranscriptionResponse;

  return {
    text: data.text,
    language: data.language,
    duration: data.duration,
    segments: data.segments?.map((seg, i) => ({
      id: i,
      start: seg.start,
      end: seg.end,
      text: seg.text,
    })),
  };
}

// ============================================================================
// Text-to-Speech Adapters
// ============================================================================

/**
 * Create an OpenAI TTS adapter
 * @param model Model name (default: 'tts-1')
 * @param options Optional configuration for apiKey and baseURL
 */
export function openaiTTS(model: string = 'tts-1', options?: MultimodalAdapterOptions): TTSAdapter {
  return {
    provider: 'openai',
    model,
    apiKey: options?.apiKey,
    baseURL: options?.baseURL,
  };
}

/**
 * Create a Gemini TTS adapter
 * @param model Model name (default: 'gemini-2.0-flash')
 * @param options Optional configuration for apiKey and baseURL
 */
export function geminiTTS(
  model: string = 'gemini-2.0-flash',
  options?: MultimodalAdapterOptions
): TTSAdapter {
  return {
    provider: 'gemini',
    model,
    apiKey: options?.apiKey,
    baseURL: options?.baseURL,
  };
}

/**
 * Generate speech from text
 */
export async function generateSpeech(options: SpeechOptions): Promise<SpeechResult> {
  const { adapter } = options;

  switch (adapter.provider) {
    case 'openai':
      return generateOpenAISpeech(options);
    case 'gemini':
      return generateGeminiSpeech(options);
    default:
      throw new Error(`Unsupported TTS provider: ${adapter.provider}`);
  }
}

// OpenAI TTS implementation
async function generateOpenAISpeech(options: SpeechOptions): Promise<SpeechResult> {
  const { adapter, text, voice, speed, format } = options;
  const apiKey = getApiKey(adapter.apiKey, 'OPENAI_API_KEY');
  const url = buildOpenAIUrl(adapter.baseURL, '/audio/speech');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: adapter.model,
      input: text,
      voice: voice ?? 'alloy',
      speed: speed ?? 1.0,
      response_format: format ?? 'mp3',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI TTS error: ${error}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

  return {
    audio: base64,
    format: format ?? 'mp3',
  };
}

// Gemini TTS implementation (experimental)
async function generateGeminiSpeech(options: SpeechOptions): Promise<SpeechResult> {
  const { adapter, text, voice } = options;
  const apiKey = getApiKey(adapter.apiKey, 'GOOGLE_API_KEY');
  const url = buildGeminiUrl(adapter.baseURL, adapter.model, 'generateContent', apiKey);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        response_modalities: ['AUDIO'],
        speech_config: {
          voice_config: {
            prebuilt_voice_config: {
              voice_name: voice ?? 'Aoede',
            },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini TTS error: ${error}`);
  }

  const data = (await response.json()) as GeminiSpeechResponse;
  const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!audioData) {
    throw new Error('Gemini TTS error: No audio data returned');
  }

  return {
    audio: audioData.data,
    format: 'wav', // Gemini returns WAV
  };
}

// ============================================================================
// Helpers
// ============================================================================

function getEnvVar(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Get API key with priority: adapter config > environment variable
 */
function getApiKey(adapterApiKey: string | undefined, envVarName: string): string {
  if (adapterApiKey !== undefined && adapterApiKey !== '') {
    return adapterApiKey;
  }
  return getEnvVar(envVarName);
}

/**
 * Build the full API URL for OpenAI endpoints
 */
function buildOpenAIUrl(baseURL: string | undefined, path: string): string {
  const base = baseURL ?? OPENAI_DEFAULT_BASE_URL;
  // Remove trailing slash from base and leading slash from path for clean concatenation
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

/**
 * Build the full API URL for Gemini endpoints
 */
function buildGeminiUrl(
  baseURL: string | undefined,
  model: string,
  action: string,
  apiKey: string
): string {
  const base = baseURL ?? GEMINI_DEFAULT_BASE_URL;
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${cleanBase}/models/${model}:${action}?key=${apiKey}`;
}

// Response types
interface OpenAIImageResponse {
  created: number;
  data: Array<{
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }>;
}

interface GeminiImageResponse {
  generatedImages: Array<{
    image: {
      imageBytes: string;
    };
  }>;
}

interface OpenAITranscriptionResponse {
  text: string;
  language?: string;
  duration?: number;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

interface GeminiSpeechResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        inlineData: {
          mimeType: string;
          data: string;
        };
      }>;
    };
  }>;
}
