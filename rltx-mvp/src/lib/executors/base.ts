// Base executor class with retry logic and common functionality

import {
  ExecutorContext,
  ExecutorResult,
  ExecutorType,
  ExecutionError,
} from "./types";

export abstract class BaseExecutor {
  abstract type: ExecutorType;
  abstract primitiveIds: string[]; // Which primitives this executor handles

  abstract execute(ctx: ExecutorContext): Promise<ExecutorResult>;

  /**
   * Execute with automatic retry logic for recoverable errors
   */
  async executeWithRetry(
    ctx: ExecutorContext,
    maxRetries = 3,
    baseDelayMs = 1000
  ): Promise<ExecutorResult> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        ctx.onProgress(0, attempt > 0 ? `Retry attempt ${attempt + 1}` : "Starting");
        return await this.execute(ctx);
      } catch (error) {
        lastError = error as Error;

        // Check if error is recoverable
        if (error instanceof ExecutionError && !error.recoverable) {
          throw error;
        }

        // Check abort signal
        if (ctx.abortSignal?.aborted) {
          throw new ExecutionError("ABORTED", "Execution was cancelled", false);
        }

        // Exponential backoff
        if (attempt < maxRetries - 1) {
          const delay = baseDelayMs * Math.pow(2, attempt);
          ctx.onProgress(0, `Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new ExecutionError("UNKNOWN", "Execution failed after retries", false);
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected createTiming(startedAt: Date): ExecutorResult["timing"] {
    const completedAt = new Date();
    return {
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - startedAt.getTime(),
    };
  }

  /**
   * Validate required inputs are present
   */
  protected validateInputs(
    inputs: Record<string, unknown>,
    required: string[]
  ): void {
    for (const key of required) {
      if (inputs[key] === undefined || inputs[key] === null) {
        throw new ExecutionError(
          "MISSING_INPUT",
          `Required input "${key}" is missing`,
          false
        );
      }
    }
  }

  /**
   * Validate required config is present
   */
  protected validateConfig(
    config: Record<string, unknown>,
    required: string[]
  ): void {
    for (const key of required) {
      if (config[key] === undefined || config[key] === null) {
        throw new ExecutionError(
          "MISSING_CONFIG",
          `Required config "${key}" is missing`,
          false
        );
      }
    }
  }
}

// Registry of all executors
const executorRegistry: Map<string, BaseExecutor> = new Map();

export function registerExecutor(executor: BaseExecutor): void {
  for (const primitiveId of executor.primitiveIds) {
    executorRegistry.set(primitiveId, executor);
  }
}

export function getExecutor(primitiveId: string): BaseExecutor | undefined {
  return executorRegistry.get(primitiveId);
}

export function getExecutorByType(type: ExecutorType): BaseExecutor | undefined {
  const values = Array.from(executorRegistry.values());
  for (const executor of values) {
    if (executor.type === type) {
      return executor;
    }
  }
  return undefined;
}
