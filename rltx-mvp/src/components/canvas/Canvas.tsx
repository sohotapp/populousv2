"use client";

import { useCallback, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlowProvider,
  useReactFlow,
  useOnViewportChange,
  type Node,
  type Viewport,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useCanvasStore } from "@/stores/canvas";
import { PrimitiveNode } from "./nodes/PrimitiveNode";
import { CanvasToolbar } from "./CanvasToolbar";
import { primitives } from "@/lib/primitives";
import { nanoid } from "nanoid";
import type { WorkflowGraph } from "@/db/schema";

const nodeTypes = {
  primitive: PrimitiveNode,
};

interface CanvasInnerProps {
  workflowId: string;
  initialGraph?: WorkflowGraph;
}

function CanvasInner({ workflowId, initialGraph }: CanvasInnerProps) {
  const { screenToFlowPosition, getViewport } = useReactFlow();

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    setSelectedNode,
    toggleNodeSelection,
    clearSelection,
    setWorkflowId,
    loadWorkflow,
    setZoomLevel,
    isValidConnection,
    // Undo/Redo
    undo,
    redo,
    canUndo,
    canRedo,
    // Copy/Paste
    copySelected,
    paste,
    duplicate,
    deleteSelected,
  } = useCanvasStore();

  // Track zoom level for semantic zoom
  useOnViewportChange({
    onChange: useCallback((viewport: Viewport) => {
      setZoomLevel(viewport.zoom);
    }, [setZoomLevel]),
  });

  // Initialize
  useEffect(() => {
    setWorkflowId(workflowId);
    if (initialGraph) {
      loadWorkflow(initialGraph.nodes as Node[], initialGraph.edges);
    }
  }, [workflowId, initialGraph, setWorkflowId, loadWorkflow]);

  // Handle drop from primitive library
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const primitiveId = event.dataTransfer.getData("application/primitive");
      if (!primitiveId || !primitives[primitiveId]) return;

      const primitive = primitives[primitiveId];
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: `${primitiveId.replace(/\./g, "-")}-${nanoid(6)}`,
        type: "primitive",
        position,
        data: {
          primitiveId,
          label: primitive.name,
          icon: primitive.icon,
          color: primitive.color,
          config: {},
          state: "idle",
        },
      };

      addNode(newNode);
    },
    [screenToFlowPosition, addNode]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      // Multi-select with Shift key
      if (event.shiftKey) {
        toggleNodeSelection(node.id);
      } else {
        setSelectedNode(node.id);
      }
    },
    [setSelectedNode, toggleNodeSelection]
  );

  const onPaneClick = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  // Connection validation
  const handleIsValidConnection = useCallback(
    (connection: Connection) => {
      return isValidConnection(connection);
    },
    [isValidConnection]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if we're in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Undo: Cmd/Ctrl+Z
      if (modKey && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (canUndo()) undo();
        return;
      }

      // Redo: Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y
      if ((modKey && e.key === "z" && e.shiftKey) || (modKey && e.key === "y")) {
        e.preventDefault();
        if (canRedo()) redo();
        return;
      }

      // Copy: Cmd/Ctrl+C
      if (modKey && e.key === "c") {
        e.preventDefault();
        copySelected();
        return;
      }

      // Paste: Cmd/Ctrl+V
      if (modKey && e.key === "v") {
        e.preventDefault();
        const viewport = getViewport();
        paste({ x: -viewport.x / viewport.zoom + 200, y: -viewport.y / viewport.zoom + 200 });
        return;
      }

      // Duplicate: Cmd/Ctrl+D
      if (modKey && e.key === "d") {
        e.preventDefault();
        duplicate();
        return;
      }

      // Select All: Cmd/Ctrl+A
      if (modKey && e.key === "a") {
        e.preventDefault();
        const { nodes, selectMultipleNodes } = useCanvasStore.getState();
        selectMultipleNodes(nodes.map((n) => n.id));
        return;
      }

      // Delete: Delete or Backspace
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelected();
        return;
      }

      // Escape: Clear selection
      if (e.key === "Escape") {
        clearSelection();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, canUndo, canRedo, copySelected, paste, duplicate, deleteSelected, clearSelection, getViewport]);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        isValidConnection={handleIsValidConnection}
        fitView
        snapToGrid
        snapGrid={[16, 16]}
        selectionOnDrag
        selectionMode={1} // Partial selection
        multiSelectionKeyCode="Shift"
        defaultEdgeOptions={{
          animated: true,
          style: { stroke: "#6366f1", strokeWidth: 2 },
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} size={1} color="hsl(0,0%,18%)" />
        <Controls className="!bg-[hsl(0,0%,9%)] !border-[hsl(0,0%,18%)] !rounded-lg !shadow-lg [&>button]:!bg-transparent [&>button]:!border-[hsl(0,0%,18%)] [&>button]:!text-[hsl(0,0%,60%)] [&>button:hover]:!bg-[hsl(0,0%,14%)] [&>button:hover]:!text-[hsl(0,0%,95%)]" />
        <MiniMap
          nodeColor={(node) => {
            const state = (node.data as { state?: string })?.state;
            if (state === "running") return "#3b82f6";
            if (state === "completed") return "#22c55e";
            if (state === "failed") return "#ef4444";
            return "#6b7280";
          }}
          className="!bg-[hsl(0,0%,9%)] !border-[hsl(0,0%,18%)] !rounded-lg"
          maskColor="rgba(0, 0, 0, 0.6)"
        />

        <Panel position="top-center">
          <CanvasToolbar workflowId={workflowId} />
        </Panel>
      </ReactFlow>
    </div>
  );
}

interface CanvasProps {
  workflowId: string;
  initialGraph?: WorkflowGraph;
}

export function Canvas({ workflowId, initialGraph }: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner workflowId={workflowId} initialGraph={initialGraph} />
    </ReactFlowProvider>
  );
}
