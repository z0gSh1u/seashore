/**
 * @seashore/storage - Integration Tests
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

/**
 * These tests require a PostgreSQL database connection.
 * Testcontainers automatically provides DATABASE_URL via globalSetup.
 * In CI, DATABASE_URL is provided by the postgres service.
 */
describe('@seashore/storage integration', () => {
  let database: Awaited<ReturnType<typeof import('../src/database').createDatabase>>;
  let threadRepo: Awaited<
    ReturnType<typeof import('../src/repositories/thread').createThreadRepository>
  >;
  let messageRepo: Awaited<
    ReturnType<typeof import('../src/repositories/message').createMessageRepository>
  >;
  let traceRepo: Awaited<
    ReturnType<typeof import('../src/repositories/trace').createTraceRepository>
  >;

  beforeAll(async () => {
    const { createDatabase } = await import('../src/database');
    const { createThreadRepository } = await import('../src/repositories/thread');
    const { createMessageRepository } = await import('../src/repositories/message');
    const { createTraceRepository } = await import('../src/repositories/trace');

    database = createDatabase({
      connectionString: process.env['DATABASE_URL']!,
    });

    threadRepo = createThreadRepository(database.db);
    messageRepo = createMessageRepository(database.db);
    traceRepo = createTraceRepository(database.db);
  });

  afterAll(async () => {
    await database?.close();
  });

  describe('database', () => {
    it('should health check', async () => {
      const isHealthy = await database.healthCheck();
      expect(isHealthy).toBe(true);
    });
  });

  describe('threadRepository', () => {
    let testThreadId: string;

    it('should create a thread', async () => {
      const thread = await threadRepo.create({
        agentId: 'test-agent',
        userId: 'test-user',
        title: 'Test Thread',
        metadata: { source: 'test' },
      });

      expect(thread.id).toBeDefined();
      expect(thread.agentId).toBe('test-agent');
      expect(thread.userId).toBe('test-user');
      expect(thread.title).toBe('Test Thread');
      expect(thread.metadata).toEqual({ source: 'test' });
      expect(thread.createdAt).toBeInstanceOf(Date);

      testThreadId = thread.id;
    });

    it('should find thread by id', async () => {
      const thread = await threadRepo.findById(testThreadId);

      expect(thread).not.toBeNull();
      expect(thread?.id).toBe(testThreadId);
    });

    it('should find threads by user id', async () => {
      const threads = await threadRepo.findByUserId('test-user');

      expect(threads.length).toBeGreaterThan(0);
      expect(threads.some((t) => t.id === testThreadId)).toBe(true);
    });

    it('should update a thread', async () => {
      const updated = await threadRepo.update(testThreadId, {
        title: 'Updated Title',
      });

      expect(updated?.title).toBe('Updated Title');
    });

    it('should list threads with pagination', async () => {
      const threads = await threadRepo.list({ limit: 10, offset: 0 });

      expect(Array.isArray(threads)).toBe(true);
    });

    it('should delete a thread', async () => {
      const deleted = await threadRepo.delete(testThreadId);

      expect(deleted).toBe(true);

      const thread = await threadRepo.findById(testThreadId);
      expect(thread).toBeNull();
    });
  });

  describe('messageRepository', () => {
    let testThreadId: string;

    beforeEach(async () => {
      const thread = await threadRepo.create({
        agentId: 'test-agent',
      });
      testThreadId = thread.id;
    });

    it('should create a message', async () => {
      const message = await messageRepo.create({
        threadId: testThreadId,
        role: 'user',
        content: 'Hello!',
      });

      expect(message.id).toBeDefined();
      expect(message.threadId).toBe(testThreadId);
      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello!');
    });

    it('should create multiple messages', async () => {
      const messages = await messageRepo.createMany([
        { threadId: testThreadId, role: 'user', content: 'First' },
        { threadId: testThreadId, role: 'assistant', content: 'Second' },
      ]);

      expect(messages).toHaveLength(2);
    });

    it('should find messages by thread id', async () => {
      await messageRepo.create({
        threadId: testThreadId,
        role: 'user',
        content: 'Test message',
      });

      const messages = await messageRepo.findByThreadId(testThreadId);

      expect(messages.length).toBeGreaterThan(0);
    });

    it('should cascade delete messages when thread is deleted', async () => {
      await messageRepo.create({
        threadId: testThreadId,
        role: 'user',
        content: 'Will be deleted',
      });

      await threadRepo.delete(testThreadId);

      const messages = await messageRepo.findByThreadId(testThreadId);
      expect(messages).toHaveLength(0);
    });
  });

  describe('traceRepository', () => {
    let testThreadId: string;

    beforeEach(async () => {
      const thread = await threadRepo.create({
        agentId: 'test-agent',
      });
      testThreadId = thread.id;
    });

    it('should create a trace', async () => {
      const trace = await traceRepo.create({
        name: 'test_trace',
        type: 'agent',
        threadId: testThreadId,
        input: { query: 'test' },
      });

      expect(trace.id).toBeDefined();
      expect(trace.name).toBe('test_trace');
      expect(trace.type).toBe('agent');
      expect(trace.threadId).toBe(testThreadId);
    });

    it('should update a trace', async () => {
      const trace = await traceRepo.create({
        name: 'updateable_trace',
        type: 'llm',
      });

      const updated = await traceRepo.update(trace.id, {
        output: { result: 'done' },
        durationMs: 500,
        endedAt: new Date(),
      });

      expect(updated?.output).toEqual({ result: 'done' });
      expect(updated?.durationMs).toBe(500);
      expect(updated?.endedAt).toBeInstanceOf(Date);
    });

    it('should find root traces', async () => {
      await traceRepo.create({
        name: 'root_trace',
        type: 'chain',
      });

      const roots = await traceRepo.findRootTraces();

      expect(roots.length).toBeGreaterThan(0);
      expect(roots.every((t) => t.parentId === null)).toBe(true);
    });

    it('should find child traces', async () => {
      const parent = await traceRepo.create({
        name: 'parent',
        type: 'agent',
      });

      await traceRepo.create({
        name: 'child',
        type: 'tool',
        parentId: parent.id,
      });

      const children = await traceRepo.findByParentId(parent.id);

      expect(children).toHaveLength(1);
      expect(children[0].name).toBe('child');
    });
  });
});
