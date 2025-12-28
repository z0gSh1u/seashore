/**
 * @seashore/llm - Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('@seashore/llm', () => {
  describe('adapters', () => {
    it('should export text adapters', async () => {
      const { createOpenAIAdapter, createAnthropicAdapter, createGeminiAdapter } = await import(
        '../src/adapters'
      );

      const openai = createOpenAIAdapter('gpt-4o');
      expect(openai.provider).toBe('openai');
      expect(openai.model).toBe('gpt-4o');

      const anthropic = createAnthropicAdapter('claude-3-5-sonnet-20241022');
      expect(anthropic.provider).toBe('anthropic');
      expect(anthropic.model).toBe('claude-3-5-sonnet-20241022');

      const gemini = createGeminiAdapter('gemini-2.0-flash');
      expect(gemini.provider).toBe('gemini');
      expect(gemini.model).toBe('gemini-2.0-flash');
    });

    it('should export default models', async () => {
      const { DEFAULT_MODELS } = await import('../src/adapters');

      expect(DEFAULT_MODELS.openai).toBe('gpt-4o');
      expect(DEFAULT_MODELS.anthropic).toBe('claude-3-5-sonnet-20241022');
      expect(DEFAULT_MODELS.gemini).toBe('gemini-2.0-flash');
    });
  });

  describe('embedding', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    it('should create OpenAI embedding adapter', async () => {
      const { openaiEmbed } = await import('../src/embedding');

      const adapter = openaiEmbed('text-embedding-3-large', 1024);
      expect(adapter.provider).toBe('openai');
      expect(adapter.model).toBe('text-embedding-3-large');
      expect(adapter.dimensions).toBe(1024);
    });

    it('should create Gemini embedding adapter', async () => {
      const { geminiEmbed } = await import('../src/embedding');

      const adapter = geminiEmbed('text-embedding-004');
      expect(adapter.provider).toBe('gemini');
      expect(adapter.model).toBe('text-embedding-004');
    });

    it('should throw error for missing API key', async () => {
      const { generateEmbedding, openaiEmbed } = await import('../src/embedding');

      // Clear env var
      const originalEnv = process.env['OPENAI_API_KEY'];
      delete process.env['OPENAI_API_KEY'];

      await expect(
        generateEmbedding({
          adapter: openaiEmbed(),
          input: 'test',
        })
      ).rejects.toThrow('Missing required environment variable: OPENAI_API_KEY');

      // Restore
      if (originalEnv !== undefined) {
        process.env['OPENAI_API_KEY'] = originalEnv;
      }
    });
  });

  describe('multimodal', () => {
    it('should create image adapters', async () => {
      const { openaiImage, geminiImage } = await import('../src/multimodal');

      const dalle = openaiImage('dall-e-3');
      expect(dalle.provider).toBe('openai');
      expect(dalle.model).toBe('dall-e-3');

      const imagen = geminiImage();
      expect(imagen.provider).toBe('gemini');
      expect(imagen.model).toBe('imagen-3.0-generate-002');
    });

    it('should create video adapter', async () => {
      const { openaiVideo } = await import('../src/multimodal');

      const sora = openaiVideo('sora-2');
      expect(sora.provider).toBe('openai');
      expect(sora.model).toBe('sora-2');
    });

    it('should create transcription adapter', async () => {
      const { openaiTranscription } = await import('../src/multimodal');

      const whisper = openaiTranscription('whisper-1');
      expect(whisper.provider).toBe('openai');
      expect(whisper.model).toBe('whisper-1');
    });

    it('should create TTS adapters', async () => {
      const { openaiTTS, geminiTTS } = await import('../src/multimodal');

      const tts = openaiTTS('tts-1-hd');
      expect(tts.provider).toBe('openai');
      expect(tts.model).toBe('tts-1-hd');

      const geminiSpeech = geminiTTS();
      expect(geminiSpeech.provider).toBe('gemini');
      expect(geminiSpeech.model).toBe('gemini-2.0-flash');
    });
  });

  describe('types', () => {
    it('should export all types', async () => {
      const types = await import('../src/types');

      // Type definitions are compile-time only, but we can check the module loads
      expect(types).toBeDefined();
    });
  });

  describe('index', () => {
    it('should export all public APIs', async () => {
      const llm = await import('../src/index');

      // Adapters
      expect(llm.createOpenAIAdapter).toBeDefined();
      expect(llm.createAnthropicAdapter).toBeDefined();
      expect(llm.createGeminiAdapter).toBeDefined();
      expect(llm.DEFAULT_MODELS).toBeDefined();

      // Embedding
      expect(llm.openaiEmbed).toBeDefined();
      expect(llm.geminiEmbed).toBeDefined();
      expect(llm.generateEmbedding).toBeDefined();
      expect(llm.generateBatchEmbeddings).toBeDefined();

      // Multimodal
      expect(llm.openaiImage).toBeDefined();
      expect(llm.geminiImage).toBeDefined();
      expect(llm.generateImage).toBeDefined();
      expect(llm.openaiVideo).toBeDefined();
      expect(llm.generateVideo).toBeDefined();
      expect(llm.checkVideoStatus).toBeDefined();
      expect(llm.openaiTranscription).toBeDefined();
      expect(llm.generateTranscription).toBeDefined();
      expect(llm.openaiTTS).toBeDefined();
      expect(llm.geminiTTS).toBeDefined();
      expect(llm.generateSpeech).toBeDefined();
    });
  });
});
