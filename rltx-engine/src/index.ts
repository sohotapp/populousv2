import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { nanoid } from "nanoid";

import { WebSocketHub } from "./websocket/hub.js";
import { ExecutionEngine } from "./scheduler/executor.js";
import type {
  StartExecutionRequest,
  StartExecutionResponse,
  WorkflowGraph,
} from "./types/index.js";

const app = express();
const httpServer = createServer(app);

// Configuration
const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";

// Middleware
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: "10mb" }));

// Initialize WebSocket hub
const wsHub = new WebSocketHub(httpServer, CORS_ORIGIN);

// Store active executions
const activeExecutions = new Map<string, ExecutionEngine>();

// ============ API ROUTES ============

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "rltx-engine",
    timestamp: new Date().toISOString(),
    connections: wsHub.getConnectedCount(),
    activeExecutions: activeExecutions.size,
  });
});

// Start execution
app.post("/api/executions/start", async (req, res) => {
  try {
    const body = req.body as StartExecutionRequest;
    const { workflowId, graph, options, startedBy } = body;

    if (!workflowId || !graph) {
      return res.status(400).json({
        error: "workflowId and graph are required",
      });
    }

    // Validate graph structure
    if (!graph.nodes || !Array.isArray(graph.nodes)) {
      return res.status(400).json({
        error: "Invalid graph: nodes array is required",
      });
    }

    // Create execution ID
    const executionId = nanoid(12);

    // Create emit function bound to this execution
    const emit = wsHub.createEmitter(executionId);

    // Create execution engine
    const engine = new ExecutionEngine(
      graph as WorkflowGraph,
      executionId,
      workflowId,
      emit,
      {
        maxParallelism: options?.maxParallelism || 4,
      }
    );

    // Store active execution
    activeExecutions.set(executionId, engine);

    // Get execution plan
    const plan = engine.getPlan();

    // Return immediately with execution info
    const response: StartExecutionResponse = {
      executionId,
      workflowId,
      status: "running",
      plan,
      websocketRoom: `execution:${executionId}`,
    };

    res.json(response);

    // Start execution asynchronously
    engine
      .run()
      .then((results) => {
        console.log(`[Execution ${executionId}] Completed successfully`);
        activeExecutions.delete(executionId);
      })
      .catch((error) => {
        console.error(`[Execution ${executionId}] Failed:`, error);
        activeExecutions.delete(executionId);
      });
  } catch (error) {
    console.error("Start execution error:", error);
    res.status(500).json({
      error: "Failed to start execution",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get execution status
app.get("/api/executions/:id", (req, res) => {
  const { id } = req.params;
  const engine = activeExecutions.get(id);

  if (!engine) {
    return res.status(404).json({
      error: "Execution not found or already completed",
    });
  }

  const state = engine.getState();
  const plan = engine.getPlan();

  res.json({
    executionId: id,
    status: "running",
    nodeStates: state,
    plan,
    watchers: wsHub.getExecutionWatchers(id),
  });
});

// Pause execution
app.post("/api/executions/:id/pause", (req, res) => {
  const { id } = req.params;
  const engine = activeExecutions.get(id);

  if (!engine) {
    return res.status(404).json({ error: "Execution not found" });
  }

  engine.pause();
  res.json({ status: "paused" });
});

// Resume execution
app.post("/api/executions/:id/resume", (req, res) => {
  const { id } = req.params;
  const engine = activeExecutions.get(id);

  if (!engine) {
    return res.status(404).json({ error: "Execution not found" });
  }

  engine.resume();
  res.json({ status: "resumed" });
});

// Cancel execution
app.post("/api/executions/:id/cancel", (req, res) => {
  const { id } = req.params;
  const engine = activeExecutions.get(id);

  if (!engine) {
    return res.status(404).json({ error: "Execution not found" });
  }

  engine.cancel();
  activeExecutions.delete(id);
  res.json({ status: "cancelled" });
});

// ============ START SERVER ============

httpServer.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                   RLTX Execution Engine                    ║
╠═══════════════════════════════════════════════════════════╣
║  Status:    Running                                        ║
║  Port:      ${String(PORT).padEnd(46)}║
║  CORS:      ${CORS_ORIGIN.padEnd(46)}║
║  WebSocket: Enabled                                        ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("Shutting down...");
  for (const [id, engine] of activeExecutions) {
    engine.cancel();
  }
  httpServer.close(() => {
    process.exit(0);
  });
});
