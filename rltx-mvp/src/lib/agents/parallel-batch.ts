// Parallel Batch Executor
// Executes LLM calls with concurrency limits per model tier

import Anthropic from "@anthropic-ai/sdk";
import { CompiledPrompt } from "./prompt-compiler";
import { ParsedResponse, parseResponse, ParseOptions } from "./response-parser";
import { ModelTier, MODEL_CONFIGS, RoutingResult } from "./model-router";
import { AgentProfile } from "../population/sampler";

export interface BatchRequest {
  agent: AgentProfile;
  prompt: CompiledPrompt;
  route: RoutingResult;
  parseOptions: ParseOptions;
}

export interface BatchResult {
  agentId: string;
  weight: number;
  response: ParsedResponse;
  modelUsed: ModelTier;
  latencyMs: number;
  success: boolean;
  error?: string;
}

export interface BatchProgress {
  completed: number;
  total: number;
  byTier: Record<ModelTier, { completed: number; total: number }>;
  estimatedRemainingMs: number;
}

export interface BatchExecutorOptions {
  // Override max concurrency per tier
  maxConcurrency?: Partial<Record<ModelTier, number>>;
  // Abort signal for cancellation
  abortSignal?: AbortSignal;
  // Progress callback
  onProgress?: (progress: BatchProgress) => void;
  // Result callback (called as each result comes in)
  onResult?: (result: BatchResult) => void;
  // Retry configuration
  maxRetries?: number;
  retryDelayMs?: number;
}

// Rate limiter per tier
class TierRateLimiter {
  private queues: Map<ModelTier, Array<() => void>> = new Map();
  private active: Map<ModelTier, number> = new Map();
  private maxConcurrency: Record<ModelTier, number>;

  constructor(maxConcurrency?: Partial<Record<ModelTier, number>>) {
    this.maxConcurrency = {
      haiku: maxConcurrency?.haiku ?? MODEL_CONFIGS.haiku.maxConcurrency,
      sonnet: maxConcurrency?.sonnet ?? MODEL_CONFIGS.sonnet.maxConcurrency,
      opus: maxConcurrency?.opus ?? MODEL_CONFIGS.opus.maxConcurrency,
    };

    for (const tier of ["haiku", "sonnet", "opus"] as ModelTier[]) {
      this.queues.set(tier, []);
      this.active.set(tier, 0);
    }
  }

  async acquire(tier: ModelTier): Promise<void> {
    const active = this.active.get(tier) ?? 0;
    const max = this.maxConcurrency[tier];

    if (active < max) {
      this.active.set(tier, active + 1);
      return;
    }

    // Wait in queue
    return new Promise((resolve) => {
      this.queues.get(tier)!.push(resolve);
    });
  }

  release(tier: ModelTier): void {
    const queue = this.queues.get(tier)!;

    if (queue.length > 0) {
      const next = queue.shift()!;
      next();
    } else {
      const active = this.active.get(tier) ?? 1;
      this.active.set(tier, Math.max(0, active - 1));
    }
  }
}

// Single LLM call with retry
async function executeWithRetry(
  client: Anthropic,
  request: BatchRequest,
  options: { maxRetries: number; retryDelayMs: number; abortSignal?: AbortSignal }
): Promise<{ response: string; latencyMs: number }> {
  const { prompt, route } = request;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    if (options.abortSignal?.aborted) {
      throw new Error("Aborted");
    }

    try {
      const startTime = Date.now();

      const response = await client.messages.create({
        model: route.config.modelId,
        max_tokens: route.config.maxOutputTokens,
        system: prompt.systemPrompt,
        messages: [{ role: "user", content: prompt.userPrompt }],
      });

      const latencyMs = Date.now() - startTime;

      // Extract text content
      const textContent = response.content.find((c) => c.type === "text");
      const text = textContent && "text" in textContent ? textContent.text : "";

      return { response: text, latencyMs };
    } catch (error) {
      lastError = error as Error;

      // Don't retry on abort
      if (options.abortSignal?.aborted) {
        throw error;
      }

      // Check if retryable
      const isRetryable =
        error instanceof Error &&
        (error.message.includes("rate_limit") ||
          error.message.includes("overloaded") ||
          error.message.includes("timeout") ||
          error.message.includes("529") ||
          error.message.includes("503"));

      if (!isRetryable || attempt === options.maxRetries) {
        throw error;
      }

      // Exponential backoff
      const delay = options.retryDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error("Max retries exceeded");
}

// Main batch executor
export async function executeBatch(
  requests: BatchRequest[],
  options: BatchExecutorOptions = {}
): Promise<BatchResult[]> {
  const {
    maxConcurrency,
    abortSignal,
    onProgress,
    onResult,
    maxRetries = 3,
    retryDelayMs = 1000,
  } = options;

  // Initialize Anthropic client
  const client = new Anthropic();

  // Initialize rate limiter
  const rateLimiter = new TierRateLimiter(maxConcurrency);

  // Track progress
  const progress: BatchProgress = {
    completed: 0,
    total: requests.length,
    byTier: {
      haiku: { completed: 0, total: 0 },
      sonnet: { completed: 0, total: 0 },
      opus: { completed: 0, total: 0 },
    },
    estimatedRemainingMs: 0,
  };

  // Count requests by tier
  for (const req of requests) {
    progress.byTier[req.route.tier].total++;
  }

  // Execute all requests with concurrency control
  const results: BatchResult[] = [];

  const executeOne = async (request: BatchRequest): Promise<BatchResult> => {
    const { agent, route, parseOptions } = request;
    const startTime = Date.now();

    // Acquire slot for this tier
    await rateLimiter.acquire(route.tier);

    try {
      // Check abort
      if (abortSignal?.aborted) {
        return {
          agentId: agent.id,
          weight: agent.weight,
          response: {
            value: "",
            normalizedValue: 0.5,
            confidence: "low",
            confidenceScore: 0,
            reasoning: "",
            success: false,
            raw: "",
            errors: ["Aborted"],
          },
          modelUsed: route.tier,
          latencyMs: Date.now() - startTime,
          success: false,
          error: "Aborted",
        };
      }

      // Execute LLM call
      const { response: rawResponse, latencyMs } = await executeWithRetry(
        client,
        request,
        { maxRetries, retryDelayMs, abortSignal }
      );

      // Parse response
      const parsedResponse = parseResponse(rawResponse, parseOptions);

      return {
        agentId: agent.id,
        weight: agent.weight,
        response: parsedResponse,
        modelUsed: route.tier,
        latencyMs,
        success: parsedResponse.success,
      };
    } catch (error) {
      return {
        agentId: agent.id,
        weight: agent.weight,
        response: {
          value: "",
          normalizedValue: 0.5,
          confidence: "low",
          confidenceScore: 0,
          reasoning: "",
          success: false,
          raw: "",
          errors: [(error as Error).message],
        },
        modelUsed: route.tier,
        latencyMs: Date.now() - startTime,
        success: false,
        error: (error as Error).message,
      };
    } finally {
      // Release slot
      rateLimiter.release(route.tier);

      // Update progress
      progress.completed++;
      progress.byTier[route.tier].completed++;

      // Estimate remaining time
      const elapsed = Date.now() - startTime;
      const avgTimePerRequest = elapsed / progress.completed;
      progress.estimatedRemainingMs =
        avgTimePerRequest * (progress.total - progress.completed);

      // Report progress
      onProgress?.({ ...progress });
    }
  };

  // Execute all in parallel (rate limiter controls actual concurrency)
  const promises = requests.map(async (request) => {
    const result = await executeOne(request);
    results.push(result);
    onResult?.(result);
    return result;
  });

  await Promise.all(promises);

  return results;
}

// Helper: Create batch requests from agents and scenario
export function createBatchRequests(
  agents: AgentProfile[],
  prompts: CompiledPrompt[],
  routes: RoutingResult[],
  parseOptions: ParseOptions
): BatchRequest[] {
  return agents.map((agent, i) => ({
    agent,
    prompt: prompts[i],
    route: routes[i],
    parseOptions,
  }));
}

// Quick batch execution for simple scenarios
export async function executeQuickBatch(
  client: Anthropic,
  prompts: Array<{ system: string; user: string }>,
  model: string = "claude-3-5-haiku-20241022",
  maxConcurrency: number = 50
): Promise<string[]> {
  const results: string[] = new Array(prompts.length).fill("");
  const queue = prompts.map((p, i) => ({ ...p, index: i }));

  const semaphore = {
    count: maxConcurrency,
    waiting: [] as Array<() => void>,
    async acquire() {
      if (this.count > 0) {
        this.count--;
        return;
      }
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    },
    release() {
      if (this.waiting.length > 0) {
        this.waiting.shift()!();
      } else {
        this.count++;
      }
    },
  };

  await Promise.all(
    queue.map(async ({ system, user, index }) => {
      await semaphore.acquire();
      try {
        const response = await client.messages.create({
          model,
          max_tokens: 1024,
          system,
          messages: [{ role: "user", content: user }],
        });
        const textContent = response.content.find((c) => c.type === "text");
        results[index] = textContent && "text" in textContent ? textContent.text : "";
      } catch {
        results[index] = "";
      } finally {
        semaphore.release();
      }
    })
  );

  return results;
}
