/**
 * @seashore/llm - Configuration Tests
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createTextAdapter,
  createOpenAIAdapter,
  createAnthropicAdapter,
  createGeminiAdapter,
} from '../src/adapters';

// Mock the underlying adapters
vi.mock('@tanstack/ai-openai', () => ({
  openaiText: vi.fn((config, model) => ({ provider: 'openai', config, model })),
}));
vi.mock('@tanstack/ai-anthropic', () => ({
  anthropicText: vi.fn((config, model) => ({ provider: 'anthropic', config, model })),
}));
vi.mock('@tanstack/ai-gemini', () => ({
  geminiText: vi.fn((config, model) => ({ provider: 'gemini', config, model })),
}));

describe('TextAdapterConfig', () => {
  it('should be defined', () => {
    expect(createTextAdapter).toBeDefined();
  });

  describe('OpenAI', () => {
    it('should create adapter with basic config', () => {
      const adapter = createTextAdapter({
        provider: 'openai',
        model: 'gpt-4',
      });
      expect(adapter).toEqual({
        provider: 'openai',
        config: { apiKey: undefined, organization: undefined, baseURL: undefined },
        model: 'gpt-4',
      });
    });

    it('should create adapter with custom baseURL', () => {
      const adapter = createTextAdapter({
        provider: 'openai',
        model: 'gpt-4',
        baseURL: 'http://localhost:1234/v1',
      });
      expect(adapter).toEqual({
        provider: 'openai',
        config: { apiKey: undefined, organization: undefined, baseURL: 'http://localhost:1234/v1' },
        model: 'gpt-4',
      });
    });

    it('should create adapter with apiKey and organization', () => {
      const adapter = createTextAdapter({
        provider: 'openai',
        model: 'gpt-4',
        apiKey: 'sk-test',
        organization: 'org-test',
      });
      expect(adapter).toEqual({
        provider: 'openai',
        config: { apiKey: 'sk-test', organization: 'org-test', baseURL: undefined },
        model: 'gpt-4',
      });
    });

    it('should use helper to create config', () => {
      const config = createOpenAIAdapter('gpt-4', {
        apiKey: 'sk-test',
        baseURL: 'http://local',
      });
      expect(config).toEqual({
        provider: 'openai',
        model: 'gpt-4',
        apiKey: 'sk-test',
        baseURL: 'http://local',
      });
    });
  });

  describe('Anthropic', () => {
    it('should create adapter with apiKey', () => {
      const adapter = createTextAdapter({
        provider: 'anthropic',
        model: 'claude-3',
        apiKey: 'sk-ant-test',
      });
      expect(adapter).toEqual({
        provider: 'anthropic',
        config: { apiKey: 'sk-ant-test' },
        model: 'claude-3',
      });
    });

    it('should use helper to create config', () => {
      const config = createAnthropicAdapter('claude-3', { apiKey: 'sk-ant-test' });
      expect(config).toEqual({
        provider: 'anthropic',
        model: 'claude-3',
        apiKey: 'sk-ant-test',
      });
    });
  });

  describe('Gemini', () => {
    it('should create adapter with apiKey', () => {
      const adapter = createTextAdapter({
        provider: 'gemini',
        model: 'gemini-pro',
        apiKey: 'AIza-test',
      });
      expect(adapter).toEqual({
        provider: 'gemini',
        config: { apiKey: 'AIza-test' },
        model: 'gemini-pro',
      });
    });

    it('should use helper to create config', () => {
      const config = createGeminiAdapter('gemini-pro', { apiKey: 'AIza-test' });
      expect(config).toEqual({
        provider: 'gemini',
        model: 'gemini-pro',
        apiKey: 'AIza-test',
      });
    });
  });
});
