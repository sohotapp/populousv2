/**
 * Simulation Progress Streaming API
 * 
 * POST /api/simulation/stream
 * 
 * Runs a simulation and streams real-time progress updates via Server-Sent Events (SSE).
 * This provides a much better UX for long-running simulations (30+ seconds).
 * 
 * Event Types:
 * - progress: Current phase, percentage, and message
 * - agent: Individual agent response (if enabled)
 * - complete: Final result
 * - error: Error details
 */

import { NextRequest } from "next/server";
import { runSimulation, SimulationConfig, SimulationResult } from "@/lib/simulation/engine";
import {
  createSimulationRun,
  completeSimulationRun,
  failSimulationRun,
} from "@/lib/simulation/run-store";
import {
  validateSimulationRequest,
  formatValidationErrors,
  type SimulationRequest,
} from "@/lib/simulation/validation";

// Progress event interface
interface ProgressEvent {
  type: "progress" | "agent" | "complete" | "error";
  data: {
    runId?: string;
    auditId?: string;
    phase?: string;
    progress?: number;
    message?: string;
    agentCount?: number;
    completedAgents?: number;
    currentAgent?: {
      id: string;
      archetype?: string;
    };
    result?: SimulationResult;
    error?: string;
    usedFallback?: boolean;
  };
}

/**
 * Format SSE message
 */
function formatSSE(event: ProgressEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

/**
 * Parse query from request (same logic as run/route.ts)
 */
function parseQuery(request: SimulationRequest): SimulationConfig {
  const { query, question, questionType, options, world, population, psychographics, counterfactuals } = request;

  let inferredQuestionType = questionType || "binary";
  const inferredQuestion = question || query;

  const queryLower = query.toLowerCase();
  if (queryLower.includes("how much") || queryLower.includes("how many")) {
    inferredQuestionType = "numeric";
  } else if (queryLower.includes("which") || queryLower.includes("choose")) {
    inferredQuestionType = "choice";
  } else if (queryLower.includes("rate") || queryLower.includes("scale") || queryLower.includes("1-10")) {
    inferredQuestionType = "scale";
  }

  const sampleSize = population?.sampleSize || 1000;
  const populationConfig: SimulationConfig["population"] = {
    mode: population?.mode === "single_vip" ? "vip" : "population",
    sampleSize,
    useArchetypes: sampleSize > 100,
    archetypeCount: Math.min(100, Math.ceil(sampleSize / 10)),
  };

  const cfScenarios = counterfactuals?.map(cf => ({
    id: cf.id,
    label: cf.label,
    worldModification: {
      hypotheticalEvents: [cf.event]
    }
  }));

  return {
    id: request.id,
    query,
    scenario: query,
    question: inferredQuestion,
    questionType: inferredQuestionType,
    options,
    world: world ? {
      hypotheticalEvents: world.hypotheticalEvents || [],
      marketConditions: world.marketConditions,
      timeHorizon: world.timeHorizon
    } : undefined,
    population: populationConfig,
    psychographics: psychographics ? {
      bigFive: psychographics.bigFive,
      values: psychographics.values,
      biases: psychographics.biases,
      traits: psychographics.traits,
    } : undefined,
    execution: {
      pilotMode: request.execution?.pilotMode ?? false,
      pilotSize: 100,
      confidenceTarget: request.execution?.confidenceLevel || 95,
    },
    counterfactuals: cfScenarios
  };
}

/**
 * POST handler - streaming simulation
 */
export async function POST(request: NextRequest) {
  // Parse and validate request
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(
      formatSSE({
        type: "error",
        data: { error: "Invalid JSON in request body" }
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      }
    );
  }

  const validation = validateSimulationRequest(body);
  if (!validation.success) {
    return new Response(
      formatSSE({
        type: "error",
        data: { error: JSON.stringify(formatValidationErrors(validation.errors!)) }
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      }
    );
  }

  const validatedBody = validation.data as SimulationRequest;
  const config = parseQuery(validatedBody);

  // Create the stream
  const encoder = new TextEncoder();
  let runRecord: Awaited<ReturnType<typeof createSimulationRun>> | null = null;
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Create run record
        runRecord = await createSimulationRun(
          { ...config, id: config.id },
          {
            ip: request.headers.get("x-forwarded-for") || undefined,
            userAgent: request.headers.get("user-agent") || undefined,
          }
        );

        config.id = runRecord.id;

        // Send initial event
        controller.enqueue(encoder.encode(formatSSE({
          type: "progress",
          data: {
            runId: runRecord.id,
            auditId: runRecord.auditId,
            phase: "initializing",
            progress: 0,
            message: "Starting simulation...",
          }
        })));

        const startTime = Date.now();
        let usedFallback = false;
        let result: SimulationResult;

        try {
          // Run simulation with progress callback
          result = await runSimulation(config, (progress) => {
            controller.enqueue(encoder.encode(formatSSE({
              type: "progress",
              data: {
                runId: runRecord!.id,
                auditId: runRecord!.auditId,
                phase: progress.phase,
                progress: progress.progress,
                message: progress.message,
                agentCount: progress.totalAgents,
                completedAgents: progress.completedAgents,
              }
            })));
          });
        } catch (simError) {
          const errorMessage = simError instanceof Error ? simError.message : String(simError);
          console.error("[Stream] Multi-agent engine failed:", errorMessage);
          usedFallback = true;

          // Send fallback notification
          controller.enqueue(encoder.encode(formatSSE({
            type: "progress",
            data: {
              runId: runRecord.id,
              auditId: runRecord.auditId,
              phase: "fallback",
              progress: 0.5,
              message: "Using simplified analysis mode...",
            }
          })));

          // Run fallback simulation
          result = await runFallbackSimulation(config);
        }

        const executionTime = Date.now() - startTime;

        // Complete the run
        await completeSimulationRun(runRecord.id, { ...result, auditId: runRecord.auditId });

        // Send complete event
        controller.enqueue(encoder.encode(formatSSE({
          type: "complete",
          data: {
            runId: runRecord.id,
            auditId: runRecord.auditId,
            result: { ...result, auditId: runRecord.auditId },
            usedFallback,
            message: `Completed in ${executionTime}ms`,
          }
        })));

        controller.close();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("[Stream] Error:", errorMessage);

        if (runRecord) {
          await failSimulationRun(runRecord.id, errorMessage);
        }

        controller.enqueue(encoder.encode(formatSSE({
          type: "error",
          data: {
            runId: runRecord?.id,
            auditId: runRecord?.auditId,
            error: errorMessage,
          }
        })));

        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}

/**
 * Fallback simulation (simplified version)
 */
async function runFallbackSimulation(config: SimulationConfig): Promise<SimulationResult> {
  const simulationId = `sim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const sampleSize = config.population.sampleSize;

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const anthropic = new Anthropic();

    const systemPrompt = `You are an expert behavioral simulation analyst. Given a query about how people will respond, provide calibrated predictions.
Respond with ONLY valid JSON: { "primaryOutcome": { "label": "string", "probability": number }, "distribution": [{ "label": "string", "value": number }], "segments": [], "drivers": [] }`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: config.query }]
    });

    const textContent = response.content.find(c => c.type === "text");
    const text = textContent && "text" in textContent ? textContent.text : "";

    let data;
    try {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
      data = JSON.parse(jsonMatch[1]?.trim() || text.trim());
    } catch {
      data = {
        primaryOutcome: { label: "Uncertain", probability: 0.5 },
        distribution: [
          { label: "Reject", value: 0.3 },
          { label: "Negotiate", value: 0.4 },
          { label: "Accept", value: 0.3 }
        ],
      };
    }

    return {
      id: simulationId,
      query: config.query,
      timestamp: new Date().toISOString(),
      summary: {
        primaryMetric: data.primaryOutcome?.probability || 0.5,
        primaryMetricLabel: data.primaryOutcome?.label || "Uncertain",
        confidenceInterval: { lower: 0.35, upper: 0.65 },
        sampleSize,
        effectiveSampleSize: 1,
        executionTimeMs: Date.now()
      },
      distribution: {
        type: "categorical",
        values: data.distribution || []
      },
      segments: [],
      drivers: [],
      counterfactuals: [],
      accuracy: {
        ssrCalibration: 0.6,
        sampleQuality: 0.4,
        responseQuality: 0.7,
        diversityIndex: 0.3
      },
      metadata: {
        populationId: "fallback",
        agentsGenerated: 1,
        agentsExecuted: 1,
        archetypesUsed: false,
        modelTierDistribution: { sonnet: 1 },
        avgLatencyMs: 2000
      }
    };
  } catch (error) {
    console.error("[Stream Fallback] Error:", error);
    return {
      id: simulationId,
      query: config.query,
      timestamp: new Date().toISOString(),
      summary: {
        primaryMetric: 0.5,
        primaryMetricLabel: "Error",
        confidenceInterval: { lower: 0, upper: 1 },
        sampleSize,
        effectiveSampleSize: 0,
        executionTimeMs: 0
      },
      distribution: { type: "categorical", values: [] },
      segments: [],
      drivers: [],
      counterfactuals: [],
      accuracy: { ssrCalibration: 0, sampleQuality: 0, responseQuality: 0, diversityIndex: 0 },
      metadata: {
        populationId: "error",
        agentsGenerated: 0,
        agentsExecuted: 0,
        archetypesUsed: false,
        modelTierDistribution: {},
        avgLatencyMs: 0
      }
    };
  }
}
