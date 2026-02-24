import { describe, it, expect } from 'vitest'
import { serperSearchDefinition } from '../../../src/tool/presets/serper.js'

describe('serperSearchDefinition', () => {
  it('should have correct name', () => {
    expect(serperSearchDefinition.name).toBe('web_search')
  })

  it('should have description', () => {
    expect(serperSearchDefinition.description).toBeDefined()
  })
})
