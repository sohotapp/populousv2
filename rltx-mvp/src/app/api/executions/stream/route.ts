import { NextRequest } from "next/server";
import { getExecutor } from "@/lib/executors";
import type { ExecutorContext, ExecutorResult, Distribution } from "@/lib/executors";
import { getPersonaStore, type StoredPersona, type VIPVertical, type VIPTier } from "@/lib/personas/persona-store";

// SSE Event Types
export interface ExecutionEvent {
  type:
    | "execution:started"
    | "node:started"
    | "node:progress"
    | "node:completed"
    | "node:error"
    | "execution:completed"
    | "execution:error";
  executionId: string;
  nodeId?: string;
  progress?: number;
  message?: string;
  result?: unknown;
  error?: string;
  timestamp: string;
}

// In-memory store for active executions (use Redis/DB in production)
const activeExecutions = new Map<
  string,
  {
    status: "running" | "completed" | "error";
    workflow: unknown;
    nodeStates: Map<string, { status: string; progress: number; result?: unknown }>;
    subscribers: Set<WritableStreamDefaultWriter<Uint8Array>>;
  }
>();

// Helper to create SSE formatted message
function formatSSE(event: ExecutionEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

// Start execution endpoint - POST creates execution, GET streams updates
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const executionId = searchParams.get("id");

  if (!executionId) {
    return new Response("Execution ID required", { status: 400 });
  }

  // Set up SSE response
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Send initial connection event
  await writer.write(
    encoder.encode(
      formatSSE({
        type: "execution:started",
        executionId,
        timestamp: new Date().toISOString(),
        message: "Connected to execution stream",
      })
    )
  );

  // Get or create execution state
  let execution = activeExecutions.get(executionId);
  if (!execution) {
    // Create mock execution for demo
    execution = {
      status: "running",
      workflow: null,
      nodeStates: new Map(),
      subscribers: new Set(),
    };
    activeExecutions.set(executionId, execution);

    // Simulate workflow execution for demo
    simulateExecution(executionId, writer, encoder).catch((err) => {
      console.error(`[Execution ${executionId}] simulateExecution error:`, err);
    });
  } else {
    // Subscribe to existing execution
    execution.subscribers.add(writer);
  }

  // Clean up on client disconnect
  request.signal.addEventListener("abort", () => {
    const exec = activeExecutions.get(executionId);
    if (exec) {
      exec.subscribers.delete(writer);
    }
    writer.close().catch(() => {
      // Ignore close errors
    });
  });

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// POST to start a new execution - now streams directly instead of separate GET
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workflowId, nodes, edges, streamResponse = false } = body;

    // Generate execution ID
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // If streamResponse is true, stream execution directly instead of returning URL
    if (streamResponse) {
      console.log(`[Execution ${executionId}] Starting streaming execution with ${nodes?.length || 0} nodes`);

      // Use ReadableStream with controller pattern for Next.js compatibility
      const encoder = new TextEncoder();

      // Initialize execution state with actual workflow
      const execution = {
        status: "running" as const,
        workflow: { workflowId, nodes, edges },
        nodeStates: new Map<string, { status: string; progress: number; result?: unknown }>(),
        subscribers: new Set<WritableStreamDefaultWriter<Uint8Array>>(),
      };
      activeExecutions.set(executionId, execution);

      const stream = new ReadableStream({
        async start(controller) {
          let isClosed = false;

          // Helper to send SSE event with closed check
          const sendEvent = (event: ExecutionEvent) => {
            if (isClosed) return; // Don't enqueue if already closed
            try {
              controller.enqueue(encoder.encode(formatSSE(event)));
            } catch (err) {
              // Controller might be closed by client disconnect
              console.warn(`[Execution ${executionId}] Failed to enqueue event:`, (err as Error).message);
              isClosed = true;
            }
          };

          // Send initial event
          sendEvent({
            type: "execution:started",
            executionId,
            timestamp: new Date().toISOString(),
            message: "Execution started",
          });

          // Run simulation synchronously within this controller
          try {
            await runStreamingSimulation(executionId, sendEvent, execution);
          } catch (err) {
            console.error(`[Execution ${executionId}] Simulation error:`, err);
            sendEvent({
              type: "execution:error",
              executionId,
              timestamp: new Date().toISOString(),
              error: err instanceof Error ? err.message : String(err),
            });
          }

          // Only close if not already closed
          if (!isClosed) {
            try {
              controller.close();
            } catch {
              // Ignore close errors
            }
          }
          isClosed = true;
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
          "X-Accel-Buffering": "no",
          "X-Execution-Id": executionId,
        },
      });
    }

    // Default: return execution ID and URL (original behavior)
    activeExecutions.set(executionId, {
      status: "running",
      workflow: { workflowId, nodes, edges },
      nodeStates: new Map(),
      subscribers: new Set(),
    });

    return Response.json({
      executionId,
      status: "started",
      streamUrl: `/api/executions/stream?id=${executionId}`,
    });
  } catch (error) {
    console.error("Failed to start execution:", error);
    return Response.json({ error: "Failed to start execution" }, { status: 500 });
  }
}

// Topological sort for processing nodes in dependency order
// Supports both flat format (primitiveId) and ReactFlow format (data.primitiveId)
interface WorkflowNode {
  id: string;
  primitiveId?: string;
  config?: Record<string, unknown>;
  // ReactFlow format - nodes from canvas have data wrapper
  data?: {
    primitiveId?: string;
    config?: Record<string, unknown>;
    label?: string;
  };
}

// Normalize node format - extract primitiveId and config from either format
function normalizeNode(node: WorkflowNode): { id: string; primitiveId?: string; config: Record<string, unknown> } {
  return {
    id: node.id,
    primitiveId: node.primitiveId || node.data?.primitiveId,
    config: node.config || node.data?.config || {},
  };
}

interface WorkflowEdge {
  source: string;
  target: string;
  sourceHandle?: string;  // Output port ID on source node
  targetHandle?: string;  // Input port ID on target node
}

function topologicalSort(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): WorkflowNode[] {
  // Build adjacency list and in-degree map
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  const nodeMap = new Map<string, WorkflowNode>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
    nodeMap.set(node.id, node);
  }

  for (const edge of edges) {
    const targets = adjacency.get(edge.source) || [];
    targets.push(edge.target);
    adjacency.set(edge.source, targets);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  // Kahn's algorithm
  const queue: string[] = [];
  const result: WorkflowNode[] = [];

  // Find all nodes with no incoming edges (entry points)
  Array.from(inDegree.entries()).forEach(([nodeId, degree]) => {
    if (degree === 0) {
      queue.push(nodeId);
    }
  });

  while (queue.length > 0) {
    const current = queue.shift()!;
    const node = nodeMap.get(current);
    if (node) {
      result.push(node);
    }

    for (const neighbor of adjacency.get(current) || []) {
      const newDegree = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  // If result doesn't contain all nodes, there's a cycle - return original order
  if (result.length !== nodes.length) {
    console.warn("Cycle detected in workflow graph, using original order");
    return nodes;
  }

  return result;
}

// Get display name for a node based on its primitiveId
function getNodeDisplayName(primitiveId?: string, label?: string): string {
  if (label) return label;

  const primitiveLabels: Record<string, string> = {
    "population.sample": "Sample Population",
    "population.segment": "Segment Analysis",
    "population.census": "Census Data",
    "scenario.define": "Define Scenario",
    "scenario.branch": "Scenario Branch",
    "scenario.monteCarlo": "Monte Carlo Simulation",
    "orchestrate.monte_carlo": "Monte Carlo Simulation",
    "agent.prompt": "Agent Prompt",
    "agent.llm": "LLM Response",
    "agent.calibrate": "SSR Calibration",
    "compute.aggregate": "Aggregate Results",
    "compute.compare": "Compare Scenarios",
    "compute.transform": "Transform Data",
    "output.chart": "Generate Chart",
    "output.distribution": "Distribution Analysis",
    "aggregate.distribution": "Aggregate Results",
    "output.export": "Export Results",
    "output.insight": "Factor Analysis",
    "analyze.factors": "Factor Analysis",
    "input.scenario": "Scenario Input",
    "input.population": "Population Input",
  };

  return primitiveLabels[primitiveId || ""] || primitiveId || "Processing Node";
}

// Get number of simulation steps based on primitive type
function getStepsForNode(primitiveId?: string): number {
  const stepsByPrimitive: Record<string, number> = {
    // Population nodes - moderate complexity
    "population.sample": 10,
    "population.segment": 5,
    "population.census": 3,
    // Scenario nodes - quick setup
    "scenario.define": 2,
    "scenario.branch": 3,
    "scenario.monteCarlo": 20, // More iterations for Monte Carlo
    // Agent nodes - most intensive (LLM calls)
    "agent.prompt": 5,
    "agent.llm": 50, // Main simulation work
    "agent.calibrate": 10,
    // Compute nodes - fast
    "compute.aggregate": 3,
    "compute.compare": 4,
    "compute.transform": 2,
    // Output nodes - quick
    "output.chart": 2,
    "output.distribution": 3,
    "output.export": 2,
    "output.insight": 5,
    // Input nodes - instant
    "input.scenario": 1,
    "input.population": 1,
  };

  return stepsByPrimitive[primitiveId || ""] || 5; // Default to 5 steps
}

// Configuration for execution mode
const USE_REAL_EXECUTORS = process.env.USE_REAL_EXECUTORS === "true";

// Map primitiveIds from canvas to executor primitiveIds
function mapCanvasPrimitiveToExecutor(primitiveId?: string): string | undefined {
  // Canvas uses different naming conventions than executors
  const mapping: Record<string, string> = {
    // Canvas → Executor
    "scenario.monteCarlo": "orchestrate.monte_carlo",
    "agent.llm": "sim.vip_decision", // Agent LLM now uses VIP persona simulation
    "agent.prompt": "agent.reason",
    "compute.aggregate": "aggregate.distribution",
    "compute.compare": "branch.counterfactual",
    "output.insight": "analyze.factors",
    "output.distribution": "aggregate.distribution",
    // Direct mappings (same in both)
    "population.sample": "population.sample",
    "population.segment": "population.segment",
    "population.filter": "population.filter",
    "branch.scenario": "branch.scenario",
    "branch.merge": "branch.merge",
    "game.equilibrium": "game.equilibrium",
    "output.chart": "output.chart",
    "data.doc.parse": "data.doc.parse",
    // VIP persona simulations
    "orchestrate.congressional_vote": "sim.congressional_vote",
    "sim.congressional_vote": "sim.congressional_vote",
    "sim.boardroom": "sim.boardroom",
    "sim.stakeholder_analysis": "sim.stakeholder_analysis",
    "sim.vip_decision": "sim.vip_decision",
  };

  return primitiveId ? (mapping[primitiveId] || primitiveId) : undefined;
}

// Get inputs from upstream nodes with port-specific mapping
function getUpstreamInputs(
  nodeId: string,
  edges: WorkflowEdge[],
  nodeOutputs: Map<string, Record<string, unknown>>
): Record<string, unknown> {
  const inputs: Record<string, unknown> = {};

  // Find all edges targeting this node
  const incomingEdges = edges.filter(e => e.target === nodeId);

  for (const edge of incomingEdges) {
    const sourceOutput = nodeOutputs.get(edge.source);
    if (!sourceOutput) continue;

    // Port-to-port mapping if handles are specified
    if (edge.sourceHandle && edge.targetHandle) {
      // Map specific output port to specific input port
      const outputValue = sourceOutput[edge.sourceHandle];
      if (outputValue !== undefined) {
        inputs[edge.targetHandle] = outputValue;
      }
    }

    // Also merge all upstream outputs for backwards compatibility
    // This ensures common keys like 'agents', 'scenario', 'distribution' are available
    Object.assign(inputs, sourceOutput);

    // Provide typed access to specific upstream results
    inputs[`from_${edge.source}`] = sourceOutput;
  }

  // Smart input mapping: executors expect certain key names
  // Map common output keys to expected input keys
  const keyMappings: Record<string, string[]> = {
    // Output key → Expected input keys to check
    "agents": ["agents"],
    "sample_metadata": ["sample_metadata"],
    "scenario": ["scenario"],
    "question": ["question"],
    "context": ["context"],
    "results": ["results", "agent_results"],
    "distribution": ["distribution"],
    "outcomeDistribution": ["distribution"],
    "segments": ["segments"],
  };

  // Ensure common inputs are properly exposed
  for (const [outputKey, inputKeys] of Object.entries(keyMappings)) {
    if (inputs[outputKey] !== undefined) {
      // The key is already present, ensure it's accessible
      for (const inputKey of inputKeys) {
        if (inputs[inputKey] === undefined) {
          inputs[inputKey] = inputs[outputKey];
        }
      }
    }
  }

  // Special handling for population data flow
  // If we have agents array, extract scenario/question from config of upstream scenario nodes
  if (inputs.scenario === undefined) {
    // Try to extract scenario from any upstream node that produced one
    for (const edge of incomingEdges) {
      const sourceOutput = nodeOutputs.get(edge.source);
      if (sourceOutput?.scenarioId || sourceOutput?.modified_context) {
        const modCtx = sourceOutput.modified_context as Record<string, unknown> | undefined;
        inputs.scenario = modCtx?.scenario || sourceOutput.description;
        break;
      }
    }
  }

  return inputs;
}

// Streaming simulation for ReadableStream controller pattern
async function runStreamingSimulation(
  executionId: string,
  sendEvent: (event: ExecutionEvent) => void,
  execution: {
    status: string;
    workflow: { workflowId: string; nodes: WorkflowNode[]; edges: WorkflowEdge[] } | null;
    nodeStates: Map<string, { status: string; progress: number; result?: unknown }>;
    subscribers: Set<WritableStreamDefaultWriter<Uint8Array>>;
  }
) {
  console.log(`[Execution ${executionId}] runStreamingSimulation started`);

  const workflowData = execution.workflow;

  // Sort nodes in topological order
  const sortedNodes = workflowData?.nodes && workflowData?.edges
    ? topologicalSort(workflowData.nodes, workflowData.edges)
    : [];

  // Build nodes to process
  const nodesToProcess = sortedNodes.length > 0
    ? sortedNodes.map(node => {
        const normalized = normalizeNode(node);
        const label = node.data?.label;
        return {
          id: normalized.id,
          name: getNodeDisplayName(normalized.primitiveId, label),
          primitiveId: normalized.primitiveId,
          config: normalized.config,
          totalSteps: getStepsForNode(normalized.primitiveId),
        };
      })
    : [
        { id: "sample-node", name: "Sample Population", primitiveId: "population.sample", config: {}, totalSteps: 5 },
        { id: "simulate-node", name: "Agent Simulation", primitiveId: "agent.llm", config: {}, totalSteps: 10 },
      ];

  console.log(`[Execution ${executionId}] Processing ${nodesToProcess.length} nodes:`,
    nodesToProcess.map(n => `${n.id} (${n.primitiveId})`).join(", "));

  const nodeOutputs = new Map<string, Record<string, unknown>>();
  const edges = workflowData?.edges || [];

  // Process each node
  for (const node of nodesToProcess) {
    // Node started
    sendEvent({
      type: "node:started",
      executionId,
      nodeId: node.id,
      timestamp: new Date().toISOString(),
      message: `Starting ${node.name}...`,
    });

    // Fetch personas if this is an agent node
    let fetchedPersonas: StoredPersona[] = [];
    if (nodeNeedsPersonas(node.primitiveId)) {
      sendEvent({
        type: "node:progress",
        executionId,
        nodeId: node.id,
        progress: 5,
        timestamp: new Date().toISOString(),
        message: `Fetching VIP personas...`,
      });

      fetchedPersonas = await fetchPersonasForNode(node.config);
      if (fetchedPersonas.length > 0) {
        console.log(`[Execution ${executionId}] Node ${node.id}: Using ${fetchedPersonas.length} personas`);
        sendEvent({
          type: "node:progress",
          executionId,
          nodeId: node.id,
          progress: 10,
          timestamp: new Date().toISOString(),
          message: `Loaded ${fetchedPersonas.length} VIP personas`,
        });
      }
    }

    // Simulate progress
    for (let i = 1; i <= node.totalSteps; i++) {
      await sleep(100 + Math.random() * 100);
      const progress = Math.round((i / node.totalSteps) * 100);

      sendEvent({
        type: "node:progress",
        executionId,
        nodeId: node.id,
        progress,
        timestamp: new Date().toISOString(),
        message: `Processing... ${progress}%`,
      });
    }

    // Generate mock result, enhanced with persona info if available
    let result = generateMockResult(node.id, node.primitiveId);
    if (fetchedPersonas.length > 0) {
      (result as Record<string, unknown>).personasUsed = fetchedPersonas.map(p => ({
        name: p.name,
        role: p.role,
        vertical: p.vertical,
      }));
    }
    nodeOutputs.set(node.id, result as Record<string, unknown>);

    // Node completed
    sendEvent({
      type: "node:completed",
      executionId,
      nodeId: node.id,
      timestamp: new Date().toISOString(),
      result,
    });
  }

  // Build final summary
  const summary = buildExecutionSummary(nodeOutputs);

  // Execution completed
  sendEvent({
    type: "execution:completed",
    executionId,
    timestamp: new Date().toISOString(),
    result: { summary },
  });

  console.log(`[Execution ${executionId}] Simulation complete`);
}

// Execute workflow with actual nodes from canvas (legacy)
async function simulateExecution(
  executionId: string,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder
) {
  console.log(`[Execution ${executionId}] simulateExecution started`);

  const execution = activeExecutions.get(executionId);
  if (!execution) {
    console.log(`[Execution ${executionId}] No execution found, exiting`);
    return;
  }

  // Get actual workflow data
  const workflowData = execution.workflow as {
    workflowId: string;
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
  } | null;

  // Sort nodes in topological order (respecting dependencies)
  const sortedNodes = workflowData?.nodes && workflowData?.edges
    ? topologicalSort(workflowData.nodes, workflowData.edges)
    : [];

  // If no nodes from workflow, fall back to demo nodes (for backwards compatibility)
  const nodesToProcess = sortedNodes.length > 0
    ? sortedNodes.map(node => {
        // Normalize node format (handles both flat and ReactFlow format)
        const normalized = normalizeNode(node);
        const label = node.data?.label;
        return {
          id: normalized.id,
          name: getNodeDisplayName(normalized.primitiveId, label),
          primitiveId: normalized.primitiveId,
          config: normalized.config,
          totalSteps: getStepsForNode(normalized.primitiveId),
        };
      })
    : [
        { id: "sample-node", name: "Sample Population", primitiveId: "population.sample", config: {}, totalSteps: 10 },
        { id: "simulate-node", name: "Agent Simulation", primitiveId: "agent.llm", config: {}, totalSteps: 100 },
        { id: "segment-node", name: "Segment Analysis", primitiveId: "population.segment", config: {}, totalSteps: 5 },
        { id: "factors-node", name: "Factor Analysis", primitiveId: "output.insight", config: {}, totalSteps: 3 },
      ];

  // Store outputs from each node for data flow to downstream nodes
  const nodeOutputs = new Map<string, Record<string, unknown>>();
  const edges = workflowData?.edges || [];

  console.log(`[Execution ${executionId}] Processing ${nodesToProcess.length} nodes (mode: ${USE_REAL_EXECUTORS ? "REAL" : "MOCK"}):`,
    nodesToProcess.map(n => `${n.id} (${n.primitiveId})`).join(", "));

  // Create abort controller for cancellation
  const abortController = new AbortController();

  try {
    for (const node of nodesToProcess) {
      // Node started
      await writer.write(
        encoder.encode(
          formatSSE({
            type: "node:started",
            executionId,
            nodeId: node.id,
            timestamp: new Date().toISOString(),
            message: `Starting ${node.name}...`,
          })
        )
      );

      // Broadcast to other subscribers
      broadcastToSubscribers(execution, {
        type: "node:started",
        executionId,
        nodeId: node.id,
        timestamp: new Date().toISOString(),
        message: `Starting ${node.name}...`,
      });

      let result: unknown;

      if (USE_REAL_EXECUTORS) {
        // ===== REAL EXECUTOR MODE =====
        const executorPrimitiveId = mapCanvasPrimitiveToExecutor(node.primitiveId);
        const executor = executorPrimitiveId ? getExecutor(executorPrimitiveId) : null;

        if (executor && executorPrimitiveId) {
          console.log(`[Execution ${executionId}] Node ${node.id}: Using executor for ${executorPrimitiveId}`);

          // Fetch personas if this is an agent node
          let personasForNode: StoredPersona[] = [];
          if (nodeNeedsPersonas(node.primitiveId)) {
            console.log(`[Execution ${executionId}] Node ${node.id}: Fetching personas...`);
            personasForNode = await fetchPersonasForNode(node.config);
            console.log(`[Execution ${executionId}] Node ${node.id}: Fetched ${personasForNode.length} personas`);
          }

          // Build inputs with persona data
          const baseInputs = getUpstreamInputs(node.id, edges, nodeOutputs);

          // Inject personas if available
          if (personasForNode.length > 0) {
            // Format personas for prompt injection
            baseInputs.personas = personasForNode;
            baseInputs.personaCount = personasForNode.length;

            // For single-persona prompts, format the first one
            if (personasForNode.length === 1) {
              baseInputs.persona = formatPersonaForPrompt(personasForNode[0]);
            } else {
              // For multi-persona simulations, provide formatted list
              baseInputs.personaList = personasForNode.map(p => ({
                id: p.id,
                name: p.name,
                role: p.role,
                affiliation: p.affiliation,
                formatted: formatPersonaForPrompt(p),
              }));
            }
          }

          // Build executor context
          const ctx: ExecutorContext = {
            primitiveId: executorPrimitiveId,  // Now guaranteed to be string
            nodeId: node.id,
            config: node.config,
            inputs: baseInputs,
            abortSignal: abortController.signal,
            onProgress: (percent: number, message?: string) => {
              // Fire and forget - don't await to avoid blocking executor
              writer.write(
                encoder.encode(
                  formatSSE({
                    type: "node:progress",
                    executionId,
                    nodeId: node.id,
                    progress: percent,
                    timestamp: new Date().toISOString(),
                    message: message || `Processing... ${percent}%`,
                  })
                )
              ).catch(() => {});
              broadcastToSubscribers(execution, {
                type: "node:progress",
                executionId,
                nodeId: node.id,
                progress: percent,
                timestamp: new Date().toISOString(),
                message: message || `Processing... ${percent}%`,
              });
            },
            onStream: (text: string) => {
              // Stream reasoning/debug output to clients - fire and forget
              writer.write(
                encoder.encode(
                  formatSSE({
                    type: "node:progress",
                    executionId,
                    nodeId: node.id,
                    timestamp: new Date().toISOString(),
                    message: text.trim(),
                  })
                )
              ).catch(() => {});
            },
          };

          try {
            const executorResult = await executor.execute(ctx);
            result = executorResult.outputs;

            // Store outputs for downstream nodes
            nodeOutputs.set(node.id, executorResult.outputs);

            // If we have a distribution, include it in the result
            if (executorResult.distribution) {
              (result as Record<string, unknown>).distribution = executorResult.distribution;
            }
          } catch (execError) {
            console.error(`[Execution ${executionId}] Executor error for ${node.id}:`, execError);
            // Fall back to mock result on executor error
            result = generateMockResult(node.id, node.primitiveId);
            nodeOutputs.set(node.id, result as Record<string, unknown>);
          }
        } else {
          // No executor found, use mock
          console.log(`[Execution ${executionId}] Node ${node.id}: No executor for ${node.primitiveId}, using mock`);
          result = generateMockResult(node.id, node.primitiveId);
          nodeOutputs.set(node.id, result as Record<string, unknown>);

          // Simulate progress for mock
          for (let i = 1; i <= node.totalSteps; i++) {
            await sleep(50 + Math.random() * 50);
            const progress = Math.round((i / node.totalSteps) * 100);

            await writer.write(
              encoder.encode(
                formatSSE({
                  type: "node:progress",
                  executionId,
                  nodeId: node.id,
                  progress,
                  timestamp: new Date().toISOString(),
                  message: `Processing... ${progress}%`,
                })
              )
            );
          }
        }
      } else {
        // ===== MOCK MODE (default for fast demos) =====

        // Still fetch personas in mock mode for testing the data flow
        if (nodeNeedsPersonas(node.primitiveId)) {
          const personas = await fetchPersonasForNode(node.config);
          if (personas.length > 0) {
            console.log(`[Execution ${executionId}] Node ${node.id}: [MOCK] Using ${personas.length} real personas`);
            // Store for downstream nodes
            nodeOutputs.set(`${node.id}_personas`, {
              personas,
              count: personas.length,
              names: personas.map(p => p.name),
            });
          }
        }

        // Simulate progress updates
        for (let i = 1; i <= node.totalSteps; i++) {
          await sleep(50 + Math.random() * 100); // Simulate work

          const progress = Math.round((i / node.totalSteps) * 100);

          // Generate context-appropriate progress message based on primitive type
          let progressMessage: string;
          const primitiveCategory = node.primitiveId?.split(".")[0];

          if (primitiveCategory === "agent") {
            progressMessage = `Processing agent responses ${i * 10}/${node.totalSteps * 10}...`;
          } else if (primitiveCategory === "population") {
            progressMessage = `Sampling agents... ${progress}%`;
          } else if (node.primitiveId === "scenario.monteCarlo") {
            progressMessage = `Monte Carlo iteration ${i}/${node.totalSteps}...`;
          } else if (primitiveCategory === "compute") {
            progressMessage = `Computing... ${progress}%`;
          } else if (primitiveCategory === "output") {
            progressMessage = `Generating output... ${progress}%`;
          } else {
            progressMessage = `Step ${i}/${node.totalSteps}...`;
          }

          await writer.write(
            encoder.encode(
              formatSSE({
                type: "node:progress",
                executionId,
                nodeId: node.id,
                progress,
                timestamp: new Date().toISOString(),
                message: progressMessage,
              })
            )
          );

          broadcastToSubscribers(execution, {
            type: "node:progress",
            executionId,
            nodeId: node.id,
            progress,
            timestamp: new Date().toISOString(),
            message: progressMessage,
          });
        }

        // Generate mock result
        result = generateMockResult(node.id, node.primitiveId);
        nodeOutputs.set(node.id, result as Record<string, unknown>);
      }

      // Node completed
      await writer.write(
        encoder.encode(
          formatSSE({
            type: "node:completed",
            executionId,
            nodeId: node.id,
            timestamp: new Date().toISOString(),
            message: `${node.name} completed`,
            result,
          })
        )
      );

      broadcastToSubscribers(execution, {
        type: "node:completed",
        executionId,
        nodeId: node.id,
        timestamp: new Date().toISOString(),
        message: `${node.name} completed`,
        result,
      });

      // Update node state
      execution.nodeStates.set(node.id, {
        status: "completed",
        progress: 100,
        result,
      });
    }

    // Execution completed - build summary from final node outputs
    execution.status = "completed";

    // Try to extract meaningful summary from node outputs
    const summary = buildExecutionSummary(nodeOutputs);

    await writer.write(
      encoder.encode(
        formatSSE({
          type: "execution:completed",
          executionId,
          timestamp: new Date().toISOString(),
          message: "Workflow execution completed successfully",
          result: { summary },
        })
      )
    );

    broadcastToSubscribers(execution, {
      type: "execution:completed",
      executionId,
      timestamp: new Date().toISOString(),
      message: "Workflow execution completed successfully",
    });
  } catch (error) {
    // Execution error
    execution.status = "error";

    await writer.write(
      encoder.encode(
        formatSSE({
          type: "execution:error",
          executionId,
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : "Unknown error",
        })
      )
    );
  } finally {
    await writer.close().catch(() => {
      // Ignore close errors
    });
  }
}

// Build summary from node outputs
function buildExecutionSummary(nodeOutputs: Map<string, Record<string, unknown>>): Record<string, unknown> {
  let summary: Record<string, unknown> = {
    yesRate: 0.62,
    confidenceInterval: { lower: 0.58, upper: 0.66 },
    topSegment: "25-34, High Income",
    keyDriver: "Price sensitivity",
  };

  // Look for distribution results from executors
  Array.from(nodeOutputs.entries()).forEach(([nodeId, outputs]) => {
    if (outputs.outcomeDistribution) {
      const dist = outputs.outcomeDistribution as Distribution;
      if (dist.mean !== undefined) {
        summary.yesRate = dist.mean / 100;
      }
      if (dist.percentiles) {
        summary.confidenceInterval = {
          lower: dist.percentiles.p5 / 100,
          upper: dist.percentiles.p95 / 100,
        };
      }
    }
    if (outputs.prediction) {
      const pred = outputs.prediction as Record<string, unknown>;
      if (pred.value !== undefined) {
        summary.yesRate = pred.value;
      }
      if (pred.confidenceInterval) {
        summary.confidenceInterval = pred.confidenceInterval;
      }
    }
    if (outputs.segmentAnalysis) {
      const segments = outputs.segmentAnalysis as Record<string, number>;
      const topSegment = Object.entries(segments)
        .sort((a, b) => b[1] - a[1])[0];
      if (topSegment) {
        summary.topSegment = topSegment[0].replace(/_/g, " ");
      }
    }
    // Congressional vote specific
    if (outputs.voteCount) {
      const votes = outputs.voteCount as { yes: number; no: number; total: number };
      summary.yesRate = votes.yes / votes.total;
      summary.outcome = (outputs.prediction as Record<string, unknown>)?.outcome;
    }
  });

  return summary;
}

// Broadcast event to all subscribers
function broadcastToSubscribers(
  execution: NonNullable<ReturnType<typeof activeExecutions.get>>,
  event: ExecutionEvent
) {
  const encoder = new TextEncoder();
  const message = encoder.encode(formatSSE(event));

  Array.from(execution.subscribers).forEach((subscriber) => {
    subscriber.write(message).catch(() => {
      // Remove failed subscriber
      execution.subscribers.delete(subscriber);
    });
  });
}

// Generate mock results based on primitive type
function generateMockResult(nodeId: string, primitiveId?: string): unknown {
  // Match by primitive type first (more accurate)
  const primitiveType = primitiveId?.split(".")[0];
  const primitiveAction = primitiveId?.split(".")[1];

  switch (primitiveId) {
    case "population.sample":
      return {
        agentCount: 1000,
        demographics: {
          ageGroups: { "18-24": 115, "25-34": 175, "35-44": 163, "45-54": 157, "55-64": 169, "65+": 221 },
          incomeGroups: { low: 200, medium: 450, high: 350 },
        },
        samplingMethod: "stratified",
      };

    case "population.segment":
      return {
        segments: [
          { name: "25-34, High Income", yesRate: 0.78, count: 145 },
          { name: "35-44, Medium Income", yesRate: 0.65, count: 198 },
          { name: "45-54, High Income", yesRate: 0.58, count: 134 },
          { name: "55-64, Medium Income", yesRate: 0.45, count: 156 },
        ],
        highestSegment: "25-34, High Income",
        lowestSegment: "65+, Low Income",
      };

    case "population.census":
      return {
        totalPopulation: 1000000,
        regions: ["Northeast", "Midwest", "South", "West"],
        demographicWeights: { age: 0.3, income: 0.25, education: 0.25, location: 0.2 },
      };

    case "scenario.define":
    case "input.scenario":
      return {
        scenarioId: `scenario_${Date.now()}`,
        parameters: { pricePoint: 25, productCategory: "subscription" },
        defined: true,
      };

    case "scenario.branch":
      return {
        branches: [
          { id: "control", description: "No change", probability: 0.33 },
          { id: "treatment_a", description: "10% discount", probability: 0.33 },
          { id: "treatment_b", description: "20% discount", probability: 0.34 },
        ],
      };

    case "scenario.monteCarlo":
      return {
        iterations: 1000,
        distribution: {
          mean: 0.62,
          std: 0.08,
          confidence95: { lower: 0.58, upper: 0.66 },
        },
        convergenceReached: true,
      };

    case "agent.llm":
    case "agent.prompt":
      return {
        distribution: {
          yes: 0.62,
          no: 0.28,
          maybe: 0.10,
        },
        confidence: 0.85,
        confidenceInterval: { lower: 0.58, upper: 0.66 },
        sampleSize: 1000,
        agentResponses: "aggregated",
      };

    case "agent.calibrate":
      return {
        calibrationMethod: "SSR",
        ksSimilarity: 0.87,
        anchorStatements: 5,
        calibrated: true,
      };

    case "compute.aggregate":
      return {
        aggregationType: "weighted_mean",
        result: { yes: 0.62, no: 0.28, maybe: 0.10 },
        totalWeight: 1000,
      };

    case "compute.compare":
      return {
        comparison: "A vs B",
        delta: 0.15,
        significance: 0.95,
        winner: "Treatment A",
      };

    case "compute.transform":
      return {
        transformationType: "normalize",
        inputRows: 1000,
        outputRows: 1000,
      };

    case "output.chart":
      return {
        chartType: "bar",
        dataPoints: 6,
        rendered: true,
      };

    case "output.distribution":
      return {
        type: "histogram",
        bins: 10,
        data: [0.05, 0.08, 0.12, 0.18, 0.22, 0.15, 0.10, 0.06, 0.03, 0.01],
      };

    case "output.insight":
      return {
        keyDrivers: [
          { factor: "Price Sensitivity", importance: 0.34, direction: "negative" },
          { factor: "Brand Awareness", importance: 0.28, direction: "positive" },
          { factor: "Tech Adoption", importance: 0.22, direction: "positive" },
          { factor: "Age Group", importance: 0.16, direction: "mixed" },
        ],
        reasoningThemes: [
          { theme: "Value for money", frequency: 0.45 },
          { theme: "Current subscription fatigue", frequency: 0.32 },
          { theme: "Interest in features", frequency: 0.23 },
        ],
      };

    case "output.export":
      return {
        format: "csv",
        rows: 1000,
        exported: true,
      };

    default:
      // Fallback based on primitive category
      if (primitiveType === "population") {
        return { agentCount: 1000, processed: true };
      } else if (primitiveType === "scenario") {
        return { scenarioProcessed: true };
      } else if (primitiveType === "agent") {
        return { agentResponsesCollected: true, count: 1000 };
      } else if (primitiveType === "compute") {
        return { computed: true };
      } else if (primitiveType === "output") {
        return { generated: true };
      } else if (primitiveType === "input") {
        return { received: true };
      }

      // Legacy fallback for old demo node IDs
      switch (nodeId) {
        case "sample-node":
          return { agentCount: 1000, demographics: { total: 1000 } };
        case "simulate-node":
          return { distribution: { yes: 0.62, no: 0.28, maybe: 0.10 } };
        case "segment-node":
          return { segments: [{ name: "All", count: 1000 }] };
        case "factors-node":
          return { keyDrivers: [{ factor: "Price", importance: 0.34 }] };
        default:
          return { completed: true };
      }
  }
}

// Helper sleep function
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// PERSONA INTEGRATION
// =============================================================================

interface PersonaQueryOptions {
  vertical?: VIPVertical;
  tier?: VIPTier;
  domain?: string;
  limit?: number;
  names?: string[]; // Specific names to fetch
}

/**
 * Fetch personas from PersonaStore for agent/actor nodes
 */
async function fetchPersonasForNode(
  nodeConfig: Record<string, unknown>
): Promise<StoredPersona[]> {
  try {
    const store = getPersonaStore();

    // Extract persona query options from node config
    const options: PersonaQueryOptions = {};

    // Support various config formats
    if (nodeConfig.vertical) {
      options.vertical = nodeConfig.vertical as VIPVertical;
    }
    if (nodeConfig.tier) {
      options.tier = nodeConfig.tier as VIPTier;
    }
    if (nodeConfig.domain) {
      options.domain = nodeConfig.domain as string;
    }
    if (nodeConfig.actorCount || nodeConfig.limit) {
      options.limit = (nodeConfig.actorCount || nodeConfig.limit) as number;
    }
    if (nodeConfig.actorNames || nodeConfig.names) {
      options.names = (nodeConfig.actorNames || nodeConfig.names) as string[];
    }

    // If specific names are requested, fetch them directly
    if (options.names && options.names.length > 0) {
      const personas: StoredPersona[] = [];
      for (const name of options.names) {
        const persona = await store.getPersonaByName(name);
        if (persona) {
          personas.push(persona);
        }
      }
      return personas;
    }

    // Otherwise query by filters using queryPersonas which supports tier
    const { personas } = await store.queryPersonas({
      vertical: options.vertical,
      tier: options.tier,
      collectionStatus: "complete", // Only use fully collected personas
      limit: options.limit || 50, // Default limit
      orderBy: "priority",
    });

    return personas;
  } catch (error) {
    console.warn("[Persona Fetch] Error fetching personas:", error);
    return []; // Return empty array on error, let execution continue with mock
  }
}

/**
 * Format a stored persona for LLM prompt injection
 */
function formatPersonaForPrompt(persona: StoredPersona): string {
  const parts: string[] = [];

  // Basic identity
  parts.push(`Name: ${persona.name}`);
  if (persona.role) parts.push(`Role: ${persona.role}`);
  if (persona.affiliation) parts.push(`Affiliation: ${persona.affiliation}`);
  if (persona.domain) parts.push(`Domain: ${persona.domain}`);

  // Biography if available
  if (persona.biography) {
    parts.push(`\nBackground: ${persona.biography}`);
  }

  // Big Five personality traits
  if (persona.bigFive) {
    const bf = persona.bigFive;
    const traits: string[] = [];
    if (bf.openness !== undefined) traits.push(`Openness: ${(bf.openness * 100).toFixed(0)}%`);
    if (bf.conscientiousness !== undefined) traits.push(`Conscientiousness: ${(bf.conscientiousness * 100).toFixed(0)}%`);
    if (bf.extraversion !== undefined) traits.push(`Extraversion: ${(bf.extraversion * 100).toFixed(0)}%`);
    if (bf.agreeableness !== undefined) traits.push(`Agreeableness: ${(bf.agreeableness * 100).toFixed(0)}%`);
    if (bf.neuroticism !== undefined) traits.push(`Neuroticism: ${(bf.neuroticism * 100).toFixed(0)}%`);
    if (traits.length > 0) {
      parts.push(`\nPersonality (Big Five): ${traits.join(", ")}`);
    }
  }

  // Communication style
  if (persona.communicationStyle) {
    parts.push(`\nCommunication Style: ${persona.communicationStyle}`);
  }

  // Topic interests
  if (persona.topicInterests && persona.topicInterests.length > 0) {
    const topics = persona.topicInterests.slice(0, 10).map(t =>
      typeof t === "string" ? t : (t as { topic: string }).topic
    );
    parts.push(`\nKey Interests: ${topics.join(", ")}`);
  }

  // Known positions (most important for simulations)
  if (persona.knownPositions && Object.keys(persona.knownPositions).length > 0) {
    const positions = Object.entries(persona.knownPositions)
      .slice(0, 8)
      .map(([topic, stance]) => {
        const stanceObj = stance as { position?: string; confidence?: number };
        return `${topic}: ${stanceObj.position || stance}`;
      });
    parts.push(`\nKnown Positions:\n${positions.join("\n")}`);
  }

  // Psychographics
  if (persona.psychographics) {
    const psych = persona.psychographics;
    const psychTraits: string[] = [];
    if (psych.riskTolerance !== undefined) psychTraits.push(`Risk Tolerance: ${psych.riskTolerance}`);
    if (psych.decisionStyle) psychTraits.push(`Decision Style: ${psych.decisionStyle}`);
    if (psychTraits.length > 0) {
      parts.push(`\nPsychographics: ${psychTraits.join(", ")}`);
    }
  }

  // Sample content (representative quotes)
  if (persona.sampleContent && persona.sampleContent.length > 0) {
    const quotes = persona.sampleContent.slice(0, 3).map(q =>
      typeof q === "string" ? q : (q as { text: string }).text
    );
    parts.push(`\nRepresentative Quotes:\n${quotes.map(q => `- "${q}"`).join("\n")}`);
  }

  return parts.join("\n");
}

/**
 * Check if a node is an agent/actor type that needs personas
 */
function nodeNeedsPersonas(primitiveId?: string): boolean {
  const agentPrimitives = [
    "agent.llm",
    "agent.prompt",
    "agent.reason",
    "population.sample",
    "population.actor",
    "orchestrate.congressional_vote",
    "sim.montecarlo.oasis",
  ];
  return primitiveId ? agentPrimitives.some(p => primitiveId.includes(p) || p.includes(primitiveId)) : false;
}
