import { describe, it, expect } from 'vitest'
import { firecrawlScrapeDefinition } from './firecrawl.js'

describe('firecrawlScrapeDefinition', () => {
  it('should have correct name', () => {
    expect(firecrawlScrapeDefinition.name).toBe('web_scrape')
  })

  it('should have description', () => {
    expect(firecrawlScrapeDefinition.description).toBeDefined()
  })
})
