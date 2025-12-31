/**
 * @seashore/security - External API Rule Tests
 *
 * Tests for creating security rules that call external APIs
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSecurityRule, createGuardrails } from '../src/index';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('External API Security Rule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createSecurityRule with external API', () => {
    it('should create a rule that calls an external content moderation API', async () => {
      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          safe: true,
          categories: [],
        }),
      });

      const externalModerationRule = createSecurityRule({
        name: 'external_moderation',
        description: 'External content moderation API',
        type: 'input',

        check: async (content: string) => {
          const response = await fetch('https://api.moderation.example.com/check', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer test-api-key',
            },
            body: JSON.stringify({ text: content }),
          });

          if (!response.ok) {
            // API error - fail safe
            return {
              passed: false,
              violations: [
                {
                  rule: 'external_moderation',
                  severity: 'high' as const,
                  message: 'Content moderation API unavailable',
                },
              ],
            };
          }

          const result = await response.json();

          if (!result.safe) {
            return {
              passed: false,
              violations: result.categories.map((cat: string) => ({
                rule: 'external_moderation',
                severity: 'high' as const,
                message: `Content flagged for: ${cat}`,
              })),
            };
          }

          return {
            passed: true,
            violations: [],
          };
        },
      });

      const result = await externalModerationRule.check('Hello, this is a safe message');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.moderation.example.com/check',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-api-key',
          }),
          body: JSON.stringify({ text: 'Hello, this is a safe message' }),
        })
      );
      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should handle API returning violations', async () => {
      // Mock API flagging content
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          safe: false,
          categories: ['hate_speech', 'violence'],
        }),
      });

      const externalModerationRule = createSecurityRule({
        name: 'external_moderation',
        description: 'External content moderation API',
        type: 'input',

        check: async (content: string) => {
          const response = await fetch('https://api.moderation.example.com/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: content }),
          });

          const result = await response.json();

          if (!result.safe) {
            return {
              passed: false,
              violations: result.categories.map((cat: string) => ({
                rule: 'external_moderation',
                severity: 'high' as const,
                message: `Content flagged for: ${cat}`,
              })),
            };
          }

          return { passed: true, violations: [] };
        },
      });

      const result = await externalModerationRule.check('Some bad content');

      expect(result.passed).toBe(false);
      expect(result.violations).toHaveLength(2);
      expect(result.violations[0].message).toBe('Content flagged for: hate_speech');
      expect(result.violations[1].message).toBe('Content flagged for: violence');
    });

    it('should handle API timeout with graceful degradation', async () => {
      // Mock fetch timeout
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((_, reject) => setTimeout(() => reject(new Error('Network timeout')), 100))
      );

      const externalModerationRule = createSecurityRule({
        name: 'external_moderation',
        description: 'External content moderation API with timeout handling',
        type: 'input',

        check: async (content: string) => {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch('https://api.moderation.example.com/check', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: content }),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);
            const result = await response.json();

            return {
              passed: result.safe,
              violations: result.safe
                ? []
                : [
                    {
                      rule: 'external_moderation',
                      severity: 'high' as const,
                      message: 'Content flagged by moderation API',
                    },
                  ],
            };
          } catch (error) {
            // Graceful degradation: warn but allow content through
            console.warn('External moderation API failed, allowing content through');
            return {
              passed: true,
              violations: [
                {
                  rule: 'external_moderation',
                  severity: 'low' as const,
                  message: 'External moderation check skipped due to API error',
                  details: {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    action: 'allowed_with_warning',
                  },
                },
              ],
            };
          }
        },
      });

      const result = await externalModerationRule.check('Test content');

      // Content should pass through with a warning
      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].severity).toBe('low');
      expect(result.violations[0].message).toContain('skipped');
    });

    it('should handle API returning error status with fail-safe behavior', async () => {
      // Mock API returning 500 error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const externalModerationRule = createSecurityRule({
        name: 'external_moderation_strict',
        description: 'External moderation with strict fail-safe',
        type: 'input',

        check: async (content: string) => {
          try {
            const response = await fetch('https://api.moderation.example.com/check', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: content }),
            });

            if (!response.ok) {
              // Strict mode: block content if API fails
              return {
                passed: false,
                violations: [
                  {
                    rule: 'external_moderation_strict',
                    severity: 'high' as const,
                    message: `Moderation API error: ${response.status} ${response.statusText}`,
                    details: { blocked_reason: 'api_error' },
                  },
                ],
              };
            }

            const result = await response.json();
            return {
              passed: result.safe,
              violations: result.safe
                ? []
                : [
                    {
                      rule: 'external_moderation_strict',
                      severity: 'high' as const,
                      message: 'Content flagged by moderation',
                    },
                  ],
            };
          } catch (error) {
            // Strict mode: block on any error
            return {
              passed: false,
              violations: [
                {
                  rule: 'external_moderation_strict',
                  severity: 'critical' as const,
                  message: 'Moderation check failed - content blocked for safety',
                  details: { error: error instanceof Error ? error.message : 'Unknown' },
                },
              ],
            };
          }
        },
      });

      const result = await externalModerationRule.check('Test content');

      // Strict mode should block content on API error
      expect(result.passed).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].message).toContain('500');
    });
  });

  describe('integration with Guardrails', () => {
    it('should work with Guardrails for input checking', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ safe: true, categories: [] }),
      });

      const externalRule = createSecurityRule({
        name: 'company_moderation',
        description: 'Company internal moderation API',
        type: 'input',

        check: async (content: string) => {
          const response = await fetch('https://internal.company.com/api/moderate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': 'internal-key',
            },
            body: JSON.stringify({ content }),
          });

          const result = await response.json();
          return {
            passed: result.safe,
            violations: result.safe
              ? []
              : [
                  {
                    rule: 'company_moderation',
                    severity: 'high' as const,
                    message: 'Content blocked by company policy',
                  },
                ],
          };
        },
      });

      const guardrails = createGuardrails({
        inputRules: [externalRule],
        outputRules: [],
      });

      const result = await guardrails.checkInput('Hello, check this content');

      expect(result.passed).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://internal.company.com/api/moderate',
        expect.any(Object)
      );
    });

    it('should support combining external API rule with built-in rules', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ safe: true }),
      });

      const externalRule = createSecurityRule({
        name: 'external_check',
        description: 'External API check',
        type: 'input',
        check: async () => {
          await fetch('https://api.example.com/check');
          return { passed: true, violations: [] };
        },
      });

      const localRule = createSecurityRule({
        name: 'local_check',
        description: 'Local keyword check',
        type: 'input',
        check: async (content: string) => {
          const banned = ['banned_word'];
          const found = banned.filter((w) => content.toLowerCase().includes(w));
          return {
            passed: found.length === 0,
            violations: found.map((w) => ({
              rule: 'local_check',
              severity: 'medium' as const,
              message: `Found banned word: ${w}`,
            })),
          };
        },
      });

      const guardrails = createGuardrails({
        inputRules: [externalRule, localRule],
        outputRules: [],
      });

      // Test with clean content
      const cleanResult = await guardrails.checkInput('This is safe content');
      expect(cleanResult.passed).toBe(true);

      // Test with banned word
      const badResult = await guardrails.checkInput('This has banned_word in it');
      expect(badResult.passed).toBe(false);
      expect(badResult.violations).toHaveLength(1);
      expect(badResult.violations[0].rule).toBe('local_check');
    });
  });
});
