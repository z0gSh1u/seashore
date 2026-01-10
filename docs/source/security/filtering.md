# Content Filtering

Advanced content filtering for more control over what your agents can process and generate.

## Filtering Strategies

### Keyword Filtering

```typescript
import { createKeywordFilter } from '@seashore/security'

const filter = createKeywordFilter({
  keywords: ['spam', 'scam', 'fake'],
  mode: 'exact', // 'exact' or 'contains'
  caseSensitive: false,
})

const result = filter.check('This is spam content')
// { passed: false, matched: ['spam'] }
```

### Pattern Filtering

```typescript
import { createPatternFilter } from '@seashore/security'

const filter = createPatternFilter({
  patterns: [
    { name: 'email', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g },
    { name: 'phone', regex: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g },
  ],
  action: 'redact',
})

const result = filter.check('Contact me at john@example.com or 555-123-4567')
// { passed: true, output: 'Contact me at [REDACTED] or [REDACTED]', transformed: true }
```

### Semantic Filtering

```typescript
import { createSemanticFilter } from '@seashore/security'

const filter = createSemanticFilter({
  categories: {
    violence: 0.7,
    adult_content: 0.8,
    hate_speech: 0.9,
  },
  model: openaiText('gpt-4o'),
})

const result = await filter.check('Some potentially violent content')
// { passed: false, scores: { violence: 0.85, ... } }
```

## Input Filters

Filter user inputs:

```typescript
import { createInputFilter } from '@seashore/security'

const filter = createInputFilter({
  rules: [
    {
      name: 'no-html',
      check: (content) => {
        if (/<[^>]*>/.test(content)) {
          return { passed: false, reason: 'HTML not allowed' }
        }
        return { passed: true }
      },
    },
    {
      name: 'max-length',
      check: (content) => {
        if (content.length > 5000) {
          return { passed: false, reason: 'Content too long' }
        }
        return { passed: true }
      },
    },
  ],
})

const result = await filter.check(userInput)
if (!result.passed) {
  console.log('Input blocked:', result.reason)
}
```

## Output Filters

Filter agent outputs:

```typescript
import { createOutputFilter } from '@seashore/security'

const filter = createOutputFilter({
  rules: [
    {
      name: 'no-links',
      check: (content) => {
        const links = content.match(/https?:\/\/[^\s]+/g)
        if (links) {
          return {
            passed: false,
            reason: 'Links not allowed',
            details: { links },
          }
        }
        return { passed: true }
      },
    },
  ],
})

const result = await filter.check(agentOutput)
if (!result.passed) {
  console.log('Output blocked:', result.reason)
}
```

## Sanitization

Sanitize content without blocking:

```typescript
import { createSanitizer } from '@seashore/security'

const sanitizer = createSanitizer({
  rules: [
    {
      name: 'remove-html',
      sanitize: (content) => {
        return content.replace(/<[^>]*>/g, '')
      },
    },
    {
      name: 'normalize-whitespace',
      sanitize: (content) => {
        return content.replace(/\s+/g, ' ').trim()
      },
    },
  ],
})

const sanitized = sanitizer.sanitize('  <p>Hello</p>  world  ')
// "Hello world"
```

## Progressive Filtering

Apply filters in stages:

```typescript
import { createProgressiveFilter } from '@seashore/security'

const filter = createProgressiveFilter({
  stages: [
    {
      name: 'pre-check',
      rules: [promptInjectionRule(), piiDetectionRule()],
      action: 'block',
    },
    {
      name: 'sanitize',
      rules: [htmlRemoverRule(), whitespaceNormalizerRule()],
      action: 'transform',
    },
    {
      name: 'final-check',
      rules: [topicBlockRule()],
      action: 'block',
    },
  ],
})

const result = await filter.process(content)
// Goes through each stage sequentially
```

## Context-Aware Filtering

Filter based on conversation context:

```typescript
import { createContextualFilter } from '@seashore/security'

const filter = createContextualFilter({
  rules: [
    {
      name: 'no-repetition',
      check: (content, context) => {
        const recentMessages = context.messages.slice(-5)
        const repeated = recentMessages.filter(m => m.content === content)

        if (repeated.length > 2) {
          return {
            passed: false,
            reason: 'Too much repetition',
          }
        }

        return { passed: true }
      },
    },
  ],
})

const result = await filter.check(content, { messages: conversationHistory })
```

## Filter Chains

Combine multiple filters:

```typescript
import { createFilterChain } from '@seashore/security'

const chain = createFilterChain({
  filters: [
    keywordFilter,
    patternFilter,
    semanticFilter,
  ],
  mode: 'all', // 'all' = must pass all, 'any' = must pass at least one
})

const result = await chain.check(content)
// Returns aggregated results from all filters
```

## Best Practices

1. **Early Detection** — Filter inputs before expensive processing
2. **Clear Feedback** — Explain why content was filtered
3. **False Positives** — Monitor and adjust for false positives
4. **Performance** — Cache filter results for repeated content
5. **Customization** — Customize filters for your use case

## Next Steps

- [Guardrails](./guardrails.md) — Add comprehensive guardrails
- [Evaluation](./evaluation.md) — Measure filter effectiveness
