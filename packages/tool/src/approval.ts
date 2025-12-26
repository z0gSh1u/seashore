/**
 * @seashore/tool - Tool Approval Handling
 *
 * Approval flow for dangerous or sensitive tool operations
 */

import type { Tool, ToolContext, ToolResult } from './types.js';

/**
 * Approval request sent to the client
 */
export interface ApprovalRequest {
  /** Unique request ID */
  readonly id: string;

  /** Tool name */
  readonly toolName: string;

  /** Tool call ID */
  readonly toolCallId: string;

  /** Input arguments being sent to the tool */
  readonly input: unknown;

  /** Reason for requiring approval */
  readonly reason: string;

  /** Risk level */
  readonly riskLevel: 'low' | 'medium' | 'high' | 'critical';

  /** Timestamp when request was created */
  readonly createdAt: Date;

  /** Expiration time for the request */
  readonly expiresAt: Date;
}

/**
 * Approval response from the client
 */
export interface ApprovalResponse {
  /** Request ID this is responding to */
  readonly requestId: string;

  /** Whether the action was approved */
  readonly approved: boolean;

  /** User who approved/rejected */
  readonly userId?: string;

  /** Optional reason for rejection */
  readonly reason?: string;

  /** Timestamp of response */
  readonly respondedAt: Date;
}

/**
 * Approval handler interface
 */
export interface ApprovalHandler {
  /**
   * Request approval for a tool execution
   * Returns true if approved, false if rejected
   */
  requestApproval(request: ApprovalRequest): Promise<ApprovalResponse>;

  /**
   * Cancel a pending approval request
   */
  cancelRequest(requestId: string): void;
}

/**
 * Approval configuration
 */
export interface ApprovalConfig {
  /** Custom reason message */
  readonly reason?: string;

  /** Risk level override */
  readonly riskLevel?: 'low' | 'medium' | 'high' | 'critical';

  /** Timeout for approval request (default: 5 minutes) */
  readonly timeout?: number;

  /** Handler for approval requests */
  readonly handler: ApprovalHandler;
}

/**
 * Default approval timeout (5 minutes)
 */
const DEFAULT_APPROVAL_TIMEOUT = 5 * 60 * 1000;

/**
 * Wrap a tool with approval requirement
 *
 * @example
 * ```typescript
 * import { defineTool, withApproval } from '@seashore/tool';
 *
 * const deleteTool = defineTool({
 *   name: 'delete_file',
 *   description: 'Delete a file from the system',
 *   inputSchema: z.object({ path: z.string() }),
 *   execute: async ({ path }) => {
 *     await fs.unlink(path);
 *     return { deleted: true };
 *   },
 * });
 *
 * const safeDeleteTool = withApproval(deleteTool, {
 *   reason: 'File deletion requires approval',
 *   riskLevel: 'high',
 *   handler: myApprovalHandler,
 * });
 * ```
 */
export function withApproval<TInput, TOutput>(
  tool: Tool<TInput, TOutput>,
  config: ApprovalConfig
): Tool<TInput, TOutput> {
  const {
    reason = `Tool "${tool.name}" requires approval before execution`,
    riskLevel = 'medium',
    timeout = DEFAULT_APPROVAL_TIMEOUT,
    handler,
  } = config;

  return {
    ...tool,
    needsApproval: true,

    async execute(input: TInput, context?: Partial<ToolContext>): Promise<ToolResult<TOutput>> {
      const startTime = Date.now();
      const requestId = crypto.randomUUID();
      const toolCallId = context?.executionId ?? crypto.randomUUID();

      const now = new Date();
      const expiresAt = new Date(now.getTime() + timeout);

      // Create approval request
      const request: ApprovalRequest = {
        id: requestId,
        toolName: tool.name,
        toolCallId,
        input,
        reason,
        riskLevel,
        createdAt: now,
        expiresAt,
      };

      try {
        // Request approval with timeout
        const responsePromise = handler.requestApproval(request);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            handler.cancelRequest(requestId);
            reject(new Error(`Approval request timed out after ${timeout}ms`));
          }, timeout);
        });

        const response = await Promise.race([responsePromise, timeoutPromise]);

        if (!response.approved) {
          return {
            success: false,
            error: response.reason ?? 'Tool execution rejected by user',
            durationMs: Date.now() - startTime,
            metadata: {
              approvalStatus: 'rejected',
              rejectedBy: response.userId,
              rejectionReason: response.reason,
            },
          };
        }

        // Approved - execute the tool
        const result = await tool.execute(input, context);

        return {
          ...result,
          metadata: {
            ...result.metadata,
            approvalStatus: 'approved',
            approvedBy: response.userId,
          },
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        return {
          success: false,
          error: errorMessage,
          durationMs: Date.now() - startTime,
          metadata: {
            approvalStatus: 'error',
          },
        };
      }
    },
  };
}

/**
 * Create an in-memory approval handler (for testing)
 */
export function createMemoryApprovalHandler(): ApprovalHandler & {
  pendingRequests: Map<string, ApprovalRequest>;
  approve: (requestId: string, userId?: string) => void;
  reject: (requestId: string, reason?: string, userId?: string) => void;
} {
  const pendingRequests = new Map<string, ApprovalRequest>();
  const responseCallbacks = new Map<
    string,
    { resolve: (response: ApprovalResponse) => void; reject: (error: Error) => void }
  >();

  return {
    pendingRequests,

    async requestApproval(request: ApprovalRequest): Promise<ApprovalResponse> {
      pendingRequests.set(request.id, request);

      return new Promise((resolve, reject) => {
        responseCallbacks.set(request.id, { resolve, reject });
      });
    },

    cancelRequest(requestId: string): void {
      pendingRequests.delete(requestId);
      const callback = responseCallbacks.get(requestId);
      if (callback) {
        callback.reject(new Error('Request cancelled'));
        responseCallbacks.delete(requestId);
      }
    },

    approve(requestId: string, userId?: string): void {
      const callback = responseCallbacks.get(requestId);
      if (callback) {
        pendingRequests.delete(requestId);
        responseCallbacks.delete(requestId);
        callback.resolve({
          requestId,
          approved: true,
          userId,
          respondedAt: new Date(),
        });
      }
    },

    reject(requestId: string, reason?: string, userId?: string): void {
      const callback = responseCallbacks.get(requestId);
      if (callback) {
        pendingRequests.delete(requestId);
        responseCallbacks.delete(requestId);
        callback.resolve({
          requestId,
          approved: false,
          userId,
          reason,
          respondedAt: new Date(),
        });
      }
    },
  };
}

/**
 * Create an auto-approving handler (for development/testing)
 */
export function createAutoApprovalHandler(options?: {
  delay?: number;
  userId?: string;
}): ApprovalHandler {
  const { delay = 0, userId = 'auto-approve' } = options ?? {};

  return {
    async requestApproval(request: ApprovalRequest): Promise<ApprovalResponse> {
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      return {
        requestId: request.id,
        approved: true,
        userId,
        respondedAt: new Date(),
      };
    },

    cancelRequest(): void {
      // No-op for auto-approving handler
    },
  };
}

/**
 * Determine risk level based on tool name patterns
 */
export function inferRiskLevel(toolName: string): 'low' | 'medium' | 'high' | 'critical' {
  const name = toolName.toLowerCase();

  // Critical operations
  if (
    name.includes('delete') ||
    name.includes('remove') ||
    name.includes('drop') ||
    name.includes('destroy')
  ) {
    return 'critical';
  }

  // High risk operations
  if (
    name.includes('update') ||
    name.includes('modify') ||
    name.includes('write') ||
    name.includes('execute') ||
    name.includes('run')
  ) {
    return 'high';
  }

  // Medium risk operations
  if (
    name.includes('create') ||
    name.includes('send') ||
    name.includes('publish') ||
    name.includes('post')
  ) {
    return 'medium';
  }

  // Default to low risk
  return 'low';
}
