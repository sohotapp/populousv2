import { Server as SocketIOServer, Socket } from "socket.io";
import type { Server as HTTPServer } from "http";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from "../types/index.js";

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/**
 * WebSocket Hub - Manages real-time connections and execution streaming
 */
export class WebSocketHub {
  private io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>;
  private executionSockets: Map<string, Set<string>> = new Map(); // executionId -> socketIds

  constructor(httpServer: HTTPServer, corsOrigin: string) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: corsOrigin,
        methods: ["GET", "POST"],
        credentials: true,
      },
      transports: ["websocket", "polling"],
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.io.on("connection", (socket: TypedSocket) => {
      console.log(`[WS] Client connected: ${socket.id}`);

      // Join execution room
      socket.on("execution:join", ({ executionId }) => {
        socket.join(`execution:${executionId}`);
        this.trackSocket(executionId, socket.id);
        console.log(`[WS] ${socket.id} joined execution ${executionId}`);
      });

      // Leave execution room
      socket.on("execution:leave", ({ executionId }) => {
        socket.leave(`execution:${executionId}`);
        this.untrackSocket(executionId, socket.id);
        console.log(`[WS] ${socket.id} left execution ${executionId}`);
      });

      // Pause execution request
      socket.on("execution:pause", ({ executionId }) => {
        console.log(`[WS] Pause requested for ${executionId}`);
        // Emit to the execution engine (handled elsewhere)
        this.io.to(`execution:${executionId}`).emit("execution:phase", {
          executionId,
          phase: "paused",
          level: 0,
          totalLevels: 0,
        });
      });

      // Resume execution request
      socket.on("execution:resume", ({ executionId }) => {
        console.log(`[WS] Resume requested for ${executionId}`);
      });

      // Cancel execution request
      socket.on("execution:cancel", ({ executionId }) => {
        console.log(`[WS] Cancel requested for ${executionId}`);
      });

      // Cleanup on disconnect
      socket.on("disconnect", () => {
        console.log(`[WS] Client disconnected: ${socket.id}`);
        this.removeSocketFromAllExecutions(socket.id);
      });
    });
  }

  /**
   * Emit event to all clients watching an execution
   */
  emitToExecution<K extends keyof ServerToClientEvents>(
    executionId: string,
    event: K,
    data: ServerToClientEvents[K]
  ): void {
    this.io.to(`execution:${executionId}`).emit(event, data);
  }

  /**
   * Create emit function for an execution (used by ExecutionEngine)
   */
  createEmitter(executionId: string): <K extends keyof ServerToClientEvents>(
    event: K,
    data: ServerToClientEvents[K]
  ) => void {
    return (event, data) => {
      this.emitToExecution(executionId, event, data);
    };
  }

  /**
   * Get count of clients watching an execution
   */
  getExecutionWatchers(executionId: string): number {
    return this.executionSockets.get(executionId)?.size || 0;
  }

  /**
   * Get total connected clients
   */
  getConnectedCount(): number {
    return this.io.sockets.sockets.size;
  }

  private trackSocket(executionId: string, socketId: string): void {
    if (!this.executionSockets.has(executionId)) {
      this.executionSockets.set(executionId, new Set());
    }
    this.executionSockets.get(executionId)!.add(socketId);
  }

  private untrackSocket(executionId: string, socketId: string): void {
    const sockets = this.executionSockets.get(executionId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        this.executionSockets.delete(executionId);
      }
    }
  }

  private removeSocketFromAllExecutions(socketId: string): void {
    for (const [executionId, sockets] of this.executionSockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        this.executionSockets.delete(executionId);
      }
    }
  }
}
