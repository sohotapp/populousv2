import { create } from "zustand";
import {
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  Connection,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from "@xyflow/react";
import { nanoid } from "nanoid";
import type { NodeState } from "@/types";
import { primitives } from "@/lib/primitives";
import {
  playbookPatterns,
  playbookToReactFlow,
  type PlaybookPattern,
} from "@/lib/primitives/presets";

// History snapshot for undo/redo
interface HistorySnapshot {
  nodes: Node[];
  edges: Edge[];
  timestamp: number;
}

// Clipboard data for copy/paste
interface ClipboardData {
  nodes: Node[];
  edges: Edge[];
}

// Connection validation result
interface ValidationResult {
  valid: boolean;
  reason?: string;
}

const MAX_HISTORY_SIZE = 50;

// SSE Event type from execution stream
interface ExecutionEvent {
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

// Execution progress tracking
interface ExecutionProgress {
  nodeProgress: Map<string, { status: string; progress: number; message?: string }>;
  overallProgress: number;
  currentNode: string | null;
  startTime: Date;
  estimatedCompletion?: Date;
}

interface CanvasState {
  // Core state
  workflowId: string | null;
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  selectedNodeIds: Set<string>; // Multi-select support

  // Execution state
  isExecuting: boolean;
  executionId: string | null;
  executionProgress: ExecutionProgress | null;
  executionError: string | null;
  executionResult: unknown | null;

  // History for undo/redo
  history: HistorySnapshot[];
  historyIndex: number;

  // Clipboard for copy/paste
  clipboard: ClipboardData | null;

  // Zoom level for semantic zoom
  zoomLevel: number;

  // Actions
  setWorkflowId: (id: string | null) => void;
  setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (node: Node) => void;
  updateNodeData: (nodeId: string, data: Partial<Node["data"]>) => void;
  setSelectedNode: (nodeId: string | null) => void;
  toggleNodeSelection: (nodeId: string) => void;
  selectMultipleNodes: (nodeIds: string[]) => void;
  clearSelection: () => void;
  deleteNode: (nodeId: string) => void;
  deleteSelected: () => void;

  // Undo/Redo actions
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  pushHistory: () => void;

  // Copy/Paste actions
  copySelected: () => void;
  paste: (position?: { x: number; y: number }) => void;
  duplicate: () => void;
  canPaste: () => boolean;

  // Connection validation
  validateConnection: (connection: Connection) => ValidationResult;
  isValidConnection: (connection: Connection) => boolean;

  // Zoom
  setZoomLevel: (level: number) => void;

  // Execution actions
  startExecution: (executionId: string) => void;
  updateNodeState: (nodeId: string, state: NodeState, output?: unknown, progress?: number) => void;
  completeExecution: () => void;
  resetExecution: () => void;

  // SSE Streaming actions
  connectToExecution: (executionId: string) => void;
  disconnectFromExecution: () => void;
  handleExecutionEvent: (event: ExecutionEvent) => void;
  runWorkflow: () => Promise<void>;

  // Workflow actions
  loadWorkflow: (nodes: Node[], edges: Edge[]) => void;
  clearCanvas: () => void;
  getGraph: () => { nodes: Node[]; edges: Edge[] };

  // View actions
  shouldFitView: boolean;
  clearFitView: () => void;

  // Playbook actions
  addPlaybook: (playbookId: string, position: { x: number; y: number }) => void;
}

// Store EventSource instance outside of state (not serializable)
let eventSourceInstance: EventSource | null = null;

export const useCanvasStore = create<CanvasState>((set, get) => ({
  // Initial state
  workflowId: null,
  nodes: [],
  edges: [],
  selectedNodeId: null,
  selectedNodeIds: new Set(),
  isExecuting: false,
  executionId: null,
  executionProgress: null,
  executionError: null,
  executionResult: null,
  history: [],
  historyIndex: -1,
  clipboard: null,
  zoomLevel: 1,
  shouldFitView: false,

  // Setters
  setWorkflowId: (id) => set({ workflowId: id }),

  setNodes: (nodesOrUpdater) => {
    const state = get();
    const newNodes = typeof nodesOrUpdater === "function"
      ? nodesOrUpdater(state.nodes)
      : nodesOrUpdater;
    set({ nodes: newNodes });
  },

  setEdges: (edgesOrUpdater) => {
    const state = get();
    const newEdges = typeof edgesOrUpdater === "function"
      ? edgesOrUpdater(state.edges)
      : edgesOrUpdater;
    set({ edges: newEdges });
  },

  onNodesChange: (changes) => {
    const state = get();
    // Push history before significant changes (not just selection/position tweaks)
    const hasSignificantChange = changes.some(
      (c) => c.type === "remove" || c.type === "add"
    );
    if (hasSignificantChange) {
      state.pushHistory();
    }
    set({ nodes: applyNodeChanges(changes, state.nodes) });
  },

  onEdgesChange: (changes) => {
    const state = get();
    const hasSignificantChange = changes.some(
      (c) => c.type === "remove" || c.type === "add"
    );
    if (hasSignificantChange) {
      state.pushHistory();
    }
    set({ edges: applyEdgeChanges(changes, state.edges) });
  },

  onConnect: (connection) => {
    const state = get();
    const validation = state.validateConnection(connection);

    if (!validation.valid) {
      console.warn("Invalid connection:", validation.reason);
      return;
    }

    state.pushHistory();
    set({
      edges: addEdge(
        {
          ...connection,
          animated: true,
          style: { stroke: "#6366f1", strokeWidth: 2 },
        },
        state.edges
      ),
    });
  },

  addNode: (node) => {
    const state = get();
    state.pushHistory();
    set({ nodes: [...state.nodes, node] });
  },

  updateNodeData: (nodeId, data) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...data } }
          : node
      ),
    })),

  setSelectedNode: (nodeId) => set({
    selectedNodeId: nodeId,
    selectedNodeIds: nodeId ? new Set([nodeId]) : new Set(),
  }),

  toggleNodeSelection: (nodeId) => {
    const state = get();
    const newSelection = new Set(state.selectedNodeIds);
    if (newSelection.has(nodeId)) {
      newSelection.delete(nodeId);
    } else {
      newSelection.add(nodeId);
    }
    set({
      selectedNodeIds: newSelection,
      selectedNodeId: newSelection.size === 1 ? Array.from(newSelection)[0] : null,
    });
  },

  selectMultipleNodes: (nodeIds) => set({
    selectedNodeIds: new Set(nodeIds),
    selectedNodeId: nodeIds.length === 1 ? nodeIds[0] : null,
  }),

  clearSelection: () => set({
    selectedNodeId: null,
    selectedNodeIds: new Set(),
  }),

  deleteNode: (nodeId) => {
    const state = get();
    state.pushHistory();
    set({
      nodes: state.nodes.filter((n) => n.id !== nodeId),
      edges: state.edges.filter(
        (e) => e.source !== nodeId && e.target !== nodeId
      ),
      selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
      selectedNodeIds: (() => {
        const newSet = new Set(state.selectedNodeIds);
        newSet.delete(nodeId);
        return newSet;
      })(),
    });
  },

  deleteSelected: () => {
    const state = get();
    const selectedIds = state.selectedNodeIds;
    if (selectedIds.size === 0) return;

    state.pushHistory();
    set({
      nodes: state.nodes.filter((n) => !selectedIds.has(n.id)),
      edges: state.edges.filter(
        (e) => !selectedIds.has(e.source) && !selectedIds.has(e.target)
      ),
      selectedNodeId: null,
      selectedNodeIds: new Set(),
    });
  },

  // ==================== UNDO/REDO ====================

  pushHistory: () => {
    const state = get();
    const snapshot: HistorySnapshot = {
      nodes: JSON.parse(JSON.stringify(state.nodes)),
      edges: JSON.parse(JSON.stringify(state.edges)),
      timestamp: Date.now(),
    };

    // Remove any future history if we're not at the end
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(snapshot);

    // Limit history size
    if (newHistory.length > MAX_HISTORY_SIZE) {
      newHistory.shift();
    }

    set({
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  undo: () => {
    const state = get();
    if (state.historyIndex <= 0) return;

    const newIndex = state.historyIndex - 1;
    const snapshot = state.history[newIndex];

    if (snapshot) {
      set({
        nodes: JSON.parse(JSON.stringify(snapshot.nodes)),
        edges: JSON.parse(JSON.stringify(snapshot.edges)),
        historyIndex: newIndex,
        selectedNodeId: null,
        selectedNodeIds: new Set(),
      });
    }
  },

  redo: () => {
    const state = get();
    if (state.historyIndex >= state.history.length - 1) return;

    const newIndex = state.historyIndex + 1;
    const snapshot = state.history[newIndex];

    if (snapshot) {
      set({
        nodes: JSON.parse(JSON.stringify(snapshot.nodes)),
        edges: JSON.parse(JSON.stringify(snapshot.edges)),
        historyIndex: newIndex,
        selectedNodeId: null,
        selectedNodeIds: new Set(),
      });
    }
  },

  canUndo: () => get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().history.length - 1,

  // ==================== COPY/PASTE ====================

  copySelected: () => {
    const state = get();
    const selectedIds = state.selectedNodeIds;
    if (selectedIds.size === 0) return;

    const nodesToCopy = state.nodes.filter((n) => selectedIds.has(n.id));
    const edgesToCopy = state.edges.filter(
      (e) => selectedIds.has(e.source) && selectedIds.has(e.target)
    );

    set({
      clipboard: {
        nodes: JSON.parse(JSON.stringify(nodesToCopy)),
        edges: JSON.parse(JSON.stringify(edgesToCopy)),
      },
    });
  },

  paste: (position) => {
    const state = get();
    if (!state.clipboard || state.clipboard.nodes.length === 0) return;

    state.pushHistory();

    // Calculate offset for pasted nodes
    const offset = position || { x: 50, y: 50 };

    // Create ID mapping for new nodes
    const idMap = new Map<string, string>();

    const newNodes: Node[] = state.clipboard.nodes.map((node) => {
      const newId = `${(node.data?.primitiveId as string)?.replace(/\./g, "-") || "node"}-${nanoid(6)}`;
      idMap.set(node.id, newId);

      return {
        ...node,
        id: newId,
        position: {
          x: node.position.x + offset.x,
          y: node.position.y + offset.y,
        },
        selected: true,
        data: {
          ...node.data,
          state: "idle" as NodeState,
          output: undefined,
          error: undefined,
        },
      };
    });

    // Update edge references
    const newEdges: Edge[] = state.clipboard.edges.map((edge) => ({
      ...edge,
      id: `edge-${nanoid(6)}`,
      source: idMap.get(edge.source) || edge.source,
      target: idMap.get(edge.target) || edge.target,
    }));

    set({
      nodes: [...state.nodes.map(n => ({ ...n, selected: false })), ...newNodes],
      edges: [...state.edges, ...newEdges],
      selectedNodeIds: new Set(newNodes.map((n) => n.id)),
      selectedNodeId: newNodes.length === 1 ? newNodes[0].id : null,
    });
  },

  duplicate: () => {
    const state = get();
    state.copySelected();
    state.paste({ x: 100, y: 100 });
  },

  canPaste: () => {
    const state = get();
    return state.clipboard !== null && state.clipboard.nodes.length > 0;
  },

  // ==================== CONNECTION VALIDATION ====================

  validateConnection: (connection) => {
    const state = get();
    const { source, target, sourceHandle, targetHandle } = connection;

    // Prevent self-connections
    if (source === target) {
      return { valid: false, reason: "Cannot connect node to itself" };
    }

    // Check for existing connection
    const existingConnection = state.edges.find(
      (e) =>
        e.source === source &&
        e.target === target &&
        e.sourceHandle === sourceHandle &&
        e.targetHandle === targetHandle
    );
    if (existingConnection) {
      return { valid: false, reason: "Connection already exists" };
    }

    // Get source and target nodes
    const sourceNode = state.nodes.find((n) => n.id === source);
    const targetNode = state.nodes.find((n) => n.id === target);

    if (!sourceNode || !targetNode) {
      return { valid: false, reason: "Invalid nodes" };
    }

    // Get primitive definitions for type checking
    const sourcePrimitive = primitives[(sourceNode.data as { primitiveId: string })?.primitiveId];
    const targetPrimitive = primitives[(targetNode.data as { primitiveId: string })?.primitiveId];

    if (!sourcePrimitive || !targetPrimitive) {
      // Allow connection if we can't validate (graceful fallback)
      return { valid: true };
    }

    // Find the specific output and input ports
    const outputPort = sourcePrimitive.outputs.find((o) => o.id === sourceHandle);
    const inputPort = targetPrimitive.inputs.find((i) => i.id === targetHandle);

    // If handles aren't specified, allow connection (generic handles)
    if (!sourceHandle || !targetHandle) {
      return { valid: true };
    }

    if (!outputPort || !inputPort) {
      return { valid: true }; // Graceful fallback
    }

    // Type compatibility check
    const outputType = outputPort.type;
    const inputType = inputPort.type;

    // "any" type is compatible with everything
    if (outputType === "any" || inputType === "any") {
      return { valid: true };
    }

    // Direct type match
    if (outputType === inputType) {
      return { valid: true };
    }

    // Type compatibility rules
    const compatibilityRules: Record<string, string[]> = {
      object: ["any"],
      array: ["any"],
      string: ["any"],
      number: ["any"],
      boolean: ["any"],
      distribution: ["object", "any"],
    };

    const compatibleTypes = compatibilityRules[outputType] || [];
    if (compatibleTypes.includes(inputType)) {
      return { valid: true };
    }

    return {
      valid: false,
      reason: `Type mismatch: ${outputType} cannot connect to ${inputType}`,
    };
  },

  isValidConnection: (connection) => {
    return get().validateConnection(connection).valid;
  },

  // ==================== ZOOM ====================

  setZoomLevel: (level) => set({ zoomLevel: level }),

  // ==================== EXECUTION ====================

  startExecution: (executionId) =>
    set((state) => ({
      isExecuting: true,
      executionId,
      nodes: state.nodes.map((node) => ({
        ...node,
        data: { ...node.data, state: "pending" as NodeState },
      })),
    })),

  updateNodeState: (nodeId, nodeState, output, progress) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                state: nodeState,
                ...(output !== undefined && { output }),
                ...(progress !== undefined && { progress }),
              },
            }
          : node
      ),
    })),

  completeExecution: () =>
    set({
      isExecuting: false,
    }),

  resetExecution: () => {
    // Disconnect from any existing SSE stream
    if (eventSourceInstance) {
      eventSourceInstance.close();
      eventSourceInstance = null;
    }

    set((state) => ({
      isExecuting: false,
      executionId: null,
      executionProgress: null,
      executionError: null,
      executionResult: null,
      nodes: state.nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          state: "idle" as NodeState,
          output: undefined,
          error: undefined,
          progress: undefined,
        },
      })),
    }));
  },

  // ==================== SSE STREAMING ====================

  connectToExecution: (executionId: string) => {
    // Close any existing connection
    if (eventSourceInstance) {
      eventSourceInstance.close();
    }

    // Create new EventSource connection
    eventSourceInstance = new EventSource(`/api/executions/stream?id=${executionId}`);

    const handleEvent = get().handleExecutionEvent;

    eventSourceInstance.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ExecutionEvent;
        handleEvent(data);
      } catch (err) {
        console.error("Failed to parse SSE event:", err);
      }
    };

    eventSourceInstance.onerror = (error) => {
      console.error("SSE connection error:", error);
      set({ executionError: "Connection to execution stream lost" });
    };
  },

  disconnectFromExecution: () => {
    if (eventSourceInstance) {
      eventSourceInstance.close();
      eventSourceInstance = null;
    }
  },

  handleExecutionEvent: (event: ExecutionEvent) => {
    const state = get();

    switch (event.type) {
      case "execution:started":
        set({
          isExecuting: true,
          executionId: event.executionId,
          executionProgress: {
            nodeProgress: new Map(),
            overallProgress: 0,
            currentNode: null,
            startTime: new Date(),
          },
        });
        break;

      case "node:started":
        if (event.nodeId) {
          // Find the node by matching part of the ID (since IDs might have prefixes)
          const targetNode = state.nodes.find(
            (n) => n.id.includes(event.nodeId!) || event.nodeId!.includes(n.id.split("-").slice(0, -1).join("-"))
          );

          if (targetNode) {
            set((s) => ({
              nodes: s.nodes.map((node) =>
                node.id === targetNode.id
                  ? {
                      ...node,
                      data: {
                        ...node.data,
                        state: "running" as NodeState,
                        progress: 0,
                      },
                    }
                  : node
              ),
              executionProgress: s.executionProgress
                ? {
                    ...s.executionProgress,
                    currentNode: targetNode.id,
                    nodeProgress: new Map(s.executionProgress.nodeProgress).set(
                      targetNode.id,
                      { status: "running", progress: 0, message: event.message }
                    ),
                  }
                : null,
            }));
          }
        }
        break;

      case "node:progress":
        if (event.nodeId && event.progress !== undefined) {
          const targetNode = state.nodes.find(
            (n) => n.id.includes(event.nodeId!) || event.nodeId!.includes(n.id.split("-").slice(0, -1).join("-"))
          );

          if (targetNode) {
            set((s) => ({
              nodes: s.nodes.map((node) =>
                node.id === targetNode.id
                  ? {
                      ...node,
                      data: {
                        ...node.data,
                        progress: event.progress,
                      },
                    }
                  : node
              ),
              executionProgress: s.executionProgress
                ? {
                    ...s.executionProgress,
                    nodeProgress: new Map(s.executionProgress.nodeProgress).set(
                      targetNode.id,
                      { status: "running", progress: event.progress!, message: event.message }
                    ),
                  }
                : null,
            }));
          }
        }
        break;

      case "node:completed":
        if (event.nodeId) {
          const targetNode = state.nodes.find(
            (n) => n.id.includes(event.nodeId!) || event.nodeId!.includes(n.id.split("-").slice(0, -1).join("-"))
          );

          if (targetNode) {
            set((s) => ({
              nodes: s.nodes.map((node) =>
                node.id === targetNode.id
                  ? {
                      ...node,
                      data: {
                        ...node.data,
                        state: "completed" as NodeState,
                        progress: 100,
                        output: event.result,
                      },
                    }
                  : node
              ),
              executionProgress: s.executionProgress
                ? {
                    ...s.executionProgress,
                    nodeProgress: new Map(s.executionProgress.nodeProgress).set(
                      targetNode.id,
                      { status: "completed", progress: 100, message: event.message }
                    ),
                    // Calculate overall progress based on completed nodes
                    overallProgress: Math.round(
                      (Array.from(s.executionProgress.nodeProgress.values()).filter(
                        (p) => p.status === "completed"
                      ).length +
                        1) /
                        s.nodes.length *
                        100
                    ),
                  }
                : null,
            }));
          }
        }
        break;

      case "node:error":
        if (event.nodeId) {
          const targetNode = state.nodes.find(
            (n) => n.id.includes(event.nodeId!) || event.nodeId!.includes(n.id.split("-").slice(0, -1).join("-"))
          );

          if (targetNode) {
            set((s) => ({
              nodes: s.nodes.map((node) =>
                node.id === targetNode.id
                  ? {
                      ...node,
                      data: {
                        ...node.data,
                        state: "error" as NodeState,
                        error: event.error,
                      },
                    }
                  : node
              ),
            }));
          }
        }
        break;

      case "execution:completed":
        // Close SSE connection
        if (eventSourceInstance) {
          eventSourceInstance.close();
          eventSourceInstance = null;
        }

        set({
          isExecuting: false,
          executionResult: event.result,
          executionProgress: state.executionProgress
            ? {
                ...state.executionProgress,
                overallProgress: 100,
              }
            : null,
        });
        break;

      case "execution:error":
        // Close SSE connection
        if (eventSourceInstance) {
          eventSourceInstance.close();
          eventSourceInstance = null;
        }

        set({
          isExecuting: false,
          executionError: event.error || "Execution failed",
        });
        break;
    }
  },

  runWorkflow: async () => {
    const state = get();

    // Don't run if already executing
    if (state.isExecuting) {
      return;
    }

    // Reset any previous execution state
    state.resetExecution();

    try {
      // Start execution via API
      const response = await fetch("/api/executions/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowId: state.workflowId,
          nodes: state.nodes.map((n) => ({
            id: n.id,
            primitiveId: (n.data as { primitiveId: string })?.primitiveId,
            config: (n.data as { config: unknown })?.config,
          })),
          edges: state.edges.map((e) => ({
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle,
            targetHandle: e.targetHandle,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to start execution");
      }

      const data = await response.json();
      const executionId = data.executionId;

      // Set initial execution state
      set((s) => ({
        isExecuting: true,
        executionId,
        executionProgress: {
          nodeProgress: new Map(),
          overallProgress: 0,
          currentNode: null,
          startTime: new Date(),
        },
        nodes: s.nodes.map((node) => ({
          ...node,
          data: { ...node.data, state: "pending" as NodeState },
        })),
      }));

      // Connect to SSE stream
      state.connectToExecution(executionId);
    } catch (error) {
      set({
        executionError: error instanceof Error ? error.message : "Failed to start execution",
      });
    }
  },

  // ==================== WORKFLOW ====================

  loadWorkflow: (nodes, edges) => {
    // Mark nodes as new for highlight animation
    const nodesWithNewFlag = nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        isNew: true,
      },
    }));

    set({
      nodes: nodesWithNewFlag,
      edges,
      selectedNodeId: null,
      selectedNodeIds: new Set(),
      isExecuting: false,
      executionId: null,
      shouldFitView: true, // Trigger auto-fit
      history: [{
        nodes: JSON.parse(JSON.stringify(nodesWithNewFlag)),
        edges: JSON.parse(JSON.stringify(edges)),
        timestamp: Date.now(),
      }],
      historyIndex: 0,
    });

    // Clear isNew flag after animation duration
    setTimeout(() => {
      set((state) => ({
        nodes: state.nodes.map((node) => ({
          ...node,
          data: {
            ...node.data,
            isNew: false,
          },
        })),
      }));
    }, 1500); // Match animation duration
  },

  clearCanvas: () => {
    const state = get();
    state.pushHistory();
    set({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      selectedNodeIds: new Set(),
      isExecuting: false,
      executionId: null,
    });
  },

  getGraph: () => ({
    nodes: get().nodes,
    edges: get().edges,
  }),

  clearFitView: () => set({ shouldFitView: false }),

  // ==================== PLAYBOOK ====================

  addPlaybook: (playbookId, position) => {
    const state = get();
    const pattern = playbookPatterns[playbookId];

    if (!pattern) {
      console.warn(`Playbook pattern not found: ${playbookId}`);
      return;
    }

    state.pushHistory();

    // Generate unique prefix for this playbook instance
    const instancePrefix = `pb-${nanoid(6)}`;

    // Convert playbook pattern to ReactFlow nodes/edges
    const { nodes: templateNodes, edges: templateEdges } = playbookToReactFlow(pattern);

    // Instantiate nodes with unique IDs and positioned relative to drop point
    const playbookNodes: Node[] = templateNodes.map((node) => {
      const newId = `${instancePrefix}-${node.id}`;
      const primitive = primitives[node.data.primitive as string];

      return {
        ...node,
        id: newId,
        type: "primitive",
        position: {
          x: position.x + (node.position?.x || 0),
          y: position.y + (node.position?.y || 0),
        },
        data: {
          primitiveId: node.data.primitive,
          label: node.data.name as string,
          icon: primitive?.icon || "Database",
          color: primitive?.color || "hsl(0,0%,50%)",
          category: primitive?.category,
          config: node.data.config || {},
          state: "idle" as NodeState,
        },
      };
    });

    // Map edge IDs to new node IDs
    const playbookEdges: Edge[] = templateEdges.map((edge) => ({
      ...edge,
      id: `${instancePrefix}-${edge.id}`,
      source: `${instancePrefix}-${edge.source}`,
      target: `${instancePrefix}-${edge.target}`,
      animated: true,
      style: { stroke: "hsl(0,0%,30%)", strokeWidth: 1.5 },
    }));

    // Get entry nodes (nodes with no incoming edges)
    const targetNodeIds = new Set(playbookEdges.map((e) => e.target));
    const entryNodes = playbookNodes.filter((n) => !targetNodeIds.has(n.id));

    // Auto-connect: if there's a selected node, try to connect its outputs to playbook's entry points
    const autoConnectEdges: Edge[] = [];

    if (state.selectedNodeId && entryNodes.length > 0) {
      const selectedNode = state.nodes.find((n) => n.id === state.selectedNodeId);

      if (selectedNode) {
        const selectedPrimitive = primitives[(selectedNode.data as { primitiveId: string })?.primitiveId];

        if (selectedPrimitive && selectedPrimitive.outputs.length > 0) {
          const firstOutput = selectedPrimitive.outputs[0];
          const firstEntryNode = entryNodes[0];
          const entryPrimitive = primitives[(firstEntryNode.data as { primitiveId: string })?.primitiveId];

          if (entryPrimitive && entryPrimitive.inputs.length > 0) {
            const firstInput = entryPrimitive.inputs[0];

            autoConnectEdges.push({
              id: `auto-${nanoid(6)}`,
              source: state.selectedNodeId,
              sourceHandle: firstOutput.id,
              target: firstEntryNode.id,
              targetHandle: firstInput.id,
              animated: true,
              style: { stroke: "hsl(0,0%,30%)", strokeWidth: 1.5 },
            });
          }
        }
      }
    }

    // Add all nodes and edges
    set({
      nodes: [...state.nodes, ...playbookNodes],
      edges: [...state.edges, ...playbookEdges, ...autoConnectEdges],
      selectedNodeIds: new Set(playbookNodes.map((n) => n.id)),
      selectedNodeId: playbookNodes.length === 1 ? playbookNodes[0].id : null,
    });
  },
}));
