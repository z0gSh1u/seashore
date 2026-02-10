/**
 * Deployment middleware for Hono
 *
 * Provides ready-to-use HTTP endpoints for deploying Seashore agents
 * with SSE streaming, storage integration, and thread management.
 */

export { seashoreMiddleware } from './middleware.js'
export type { SeashoreMiddlewareConfig } from './middleware.js'
