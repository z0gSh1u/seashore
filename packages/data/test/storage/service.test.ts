import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createStorageService } from '../../src/storage/service.js'

// Create a mock Drizzle db
function createMockDb() {
  const mockResult = { id: 'test-id', title: 'Test', createdAt: new Date(), updatedAt: new Date() }
  const chain = {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([mockResult]),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    then: vi.fn(),
  }
  return {
    insert: vi.fn().mockReturnValue(chain),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue(chain),
    }),
    update: vi.fn().mockReturnValue(chain),
    delete: vi.fn().mockReturnValue(chain),
    _chain: chain,
    _mockResult: mockResult,
  }
}

describe('createStorageService', () => {
  it('should create a storage service', () => {
    const db = createMockDb()
    const service = createStorageService(db as never)
    expect(service).toBeDefined()
    expect(typeof service.createThread).toBe('function')
    expect(typeof service.getThread).toBe('function')
    expect(typeof service.listThreads).toBe('function')
    expect(typeof service.addMessage).toBe('function')
    expect(typeof service.getMessages).toBe('function')
  })
})
