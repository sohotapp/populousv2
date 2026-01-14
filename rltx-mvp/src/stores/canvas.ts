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
import { playbooks, instantiatePlaybook, getEntryNodeIds, type Playbook } from "@/lib/playbooks";

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
  updateNodeState: (nodeId: string, state: NodeState, output?: unknown) => void;
  completeExecution: () => void;
  resetExecution: () => void;

  // Workflow actions
  loadWorkflow: (nodes: Node[], edges: Edge[]) => void;
  clearCanvas: () => void;
  getGraph: () => { nodes: Node[]; edges: Edge[] };

  // Playbook actions
  addPlaybook: (playbookId: string, position: { x: number; y: number }) => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  // Initial state
  workflowId: null,
  nodes: [],
  edges: [],
  selectedNodeId: null,
  selectedNodeIds: new Set(),
  isExecuting: false,
  executionId: null,
  history: [],
  historyIndex: -1,
  clipboard: null,
  zoomLevel: 1,

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

  updateNodeState: (nodeId, nodeState, output) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                state: nodeState,
                ...(output !== undefined && { output }),
              },
            }
          : node
      ),
    })),

  completeExecution: () =>
    set({
      isExecuting: false,
    }),

  resetExecution: () =>
    set((state) => ({
      isExecuting: false,
      executionId: null,
      nodes: state.nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          state: "idle" as NodeState,
          output: undefined,
          error: undefined,
        },
      })),
    })),

  // ==================== WORKFLOW ====================

  loadWorkflow: (nodes, edges) => {
    set({
      nodes,
      edges,
      selectedNodeId: null,
      selectedNodeIds: new Set(),
      isExecuting: false,
      executionId: null,
      history: [{
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges)),
        timestamp: Date.now(),
      }],
      historyIndex: 0,
    });
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

  // ==================== PLAYBOOK ====================

  addPlaybook: (playbookId, position) => {
    const state = get();
    const playbook = playbooks[playbookId];

    if (!playbook) {
      console.warn(`Playbook not found: ${playbookId}`);
      return;
    }

    state.pushHistory();

    // Generate unique prefix for this playbook instance
    const instancePrefix = `pb-${nanoid(6)}`;

    // Instantiate the playbook nodes and edges
    const { nodes: playbookNodes, edges: playbookEdges } = instantiatePlaybook(
      playbook,
      position,
      instancePrefix
    );

    // Get entry node IDs for auto-connect
    const entryNodeIds = getEntryNodeIds(playbook, instancePrefix);

    // Auto-connect: if there's a selected node, try to connect its outputs to playbook's entry points
    const autoConnectEdges: Edge[] = [];

    if (state.selectedNodeId) {
      const selectedNode = state.nodes.find((n) => n.id === state.selectedNodeId);

      if (selectedNode) {
        const selectedPrimitive = primitives[(selectedNode.data as { primitiveId: string })?.primitiveId];

        if (selectedPrimitive && selectedPrimitive.outputs.length > 0 && entryNodeIds.length > 0) {
          // Get the first output of the selected node
          const firstOutput = selectedPrimitive.outputs[0];

          // Get the first entry node of the playbook
          const firstEntryId = entryNodeIds[0];
          const firstEntryNode = playbookNodes.find((n) => n.id === firstEntryId);

          if (firstEntryNode) {
            const entryPrimitive = primitives[(firstEntryNode.data as { primitiveId: string })?.primitiveId];

            if (entryPrimitive && entryPrimitive.inputs.length > 0) {
              const firstInput = entryPrimitive.inputs[0];

              // Create auto-connect edge
              autoConnectEdges.push({
                id: `auto-${nanoid(6)}`,
                source: state.selectedNodeId,
                sourceHandle: firstOutput.id,
                target: firstEntryId,
                targetHandle: firstInput.id,
                animated: true,
                style: { stroke: "#6366f1", strokeWidth: 2 },
              });
            }
          }
        }
      }
    }

    // Add all nodes and edges
    set({
      nodes: [...state.nodes, ...playbookNodes],
      edges: [...state.edges, ...playbookEdges, ...autoConnectEdges],
      // Select all the newly added nodes
      selectedNodeIds: new Set(playbookNodes.map((n) => n.id)),
      selectedNodeId: playbookNodes.length === 1 ? playbookNodes[0].id : null,
    });
  },
}));
