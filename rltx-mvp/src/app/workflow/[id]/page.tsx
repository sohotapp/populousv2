"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  SlidersHorizontal,
  PanelLeftClose,
  PanelLeft,
  Play,
  Zap,
} from "lucide-react";
import { RLTXIcon } from "@/components/ui/RLTXIcon";
import { Canvas } from "@/components/canvas/Canvas";
import { PrimitiveLibrary } from "@/components/canvas/PrimitiveLibrary";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { Inspector } from "@/components/inspector/Inspector";
import { ExecutionPanel } from "@/components/execution/ExecutionPanel";
import { ResizeHandle } from "@/components/ui/ResizeHandle";
import { useCanvasStore } from "@/stores/canvas";
import { useExecutionStore } from "@/stores/execution";
import { cn } from "@/lib/utils";

// Sidebar width constraints
const LEFT_SIDEBAR_MIN = 180;
const LEFT_SIDEBAR_MAX = 400;
const LEFT_SIDEBAR_DEFAULT = 208; // w-52 = 13rem = 208px

const RIGHT_SIDEBAR_MIN = 280;
const RIGHT_SIDEBAR_MAX = 500;
const RIGHT_SIDEBAR_DEFAULT = 320; // w-80 = 20rem = 320px

interface Workflow {
  id: string;
  name: string;
  question: string;
  graph: {
    nodes: unknown[];
    edges: unknown[];
  };
  status: string;
}

interface PageProps {
  params: { id: string };
}

export default function WorkflowPage({ params }: PageProps) {
  const { id } = params;
  const router = useRouter();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [rightPanel, setRightPanel] = useState<"chat" | "inspector" | "execution" | null>("chat");
  const [isRunning, setIsRunning] = useState(false);
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(LEFT_SIDEBAR_DEFAULT);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(RIGHT_SIDEBAR_DEFAULT);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);

  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const startExecution = useCanvasStore((s) => s.startExecution);
  const loadWorkflow = useCanvasStore((s) => s.loadWorkflow);

  const { connect, joinExecution, executionStatus } = useExecutionStore();

  // Connect to engine on mount
  useEffect(() => {
    connect();
  }, [connect]);

  // Handle running the workflow
  const handleRun = async () => {
    if (nodes.length === 0) return;

    setIsRunning(true);
    setRightPanel("execution");

    try {
      const res = await fetch("/api/executions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowId: id,
          graph: { nodes, edges },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        startExecution(data.executionId);
        joinExecution(data.executionId);
      }
    } catch (error) {
      console.error("Failed to start execution:", error);
    } finally {
      setIsRunning(false);
    }
  };

  // Handle workflow generated from chat - load into canvas
  const handleWorkflowGenerated = useCallback((generatedWorkflow: {
    id: string;
    name: string;
    nodeCount: number;
    nodes: unknown[];
    edges: unknown[];
  }) => {
    // Load the generated nodes and edges into the canvas
    loadWorkflow(
      generatedWorkflow.nodes as Parameters<typeof loadWorkflow>[0],
      generatedWorkflow.edges as Parameters<typeof loadWorkflow>[1]
    );
  }, [loadWorkflow]);

  useEffect(() => {
    const fetchWorkflow = async () => {
      try {
        const res = await fetch(`/api/workflows/${id}`);
        if (res.ok) {
          const data = await res.json();
          setWorkflow(data);
        } else {
          router.push("/");
        }
      } catch (error) {
        console.error("Failed to fetch workflow:", error);
        router.push("/");
      } finally {
        setLoading(false);
      }
    };

    fetchWorkflow();
  }, [id, router]);

  // Auto-show inspector when node is selected
  useEffect(() => {
    if (selectedNodeId) {
      setRightPanel("inspector");
    }
  }, [selectedNodeId]);

  // Sidebar resize handlers
  const handleLeftResize = useCallback((delta: number) => {
    setLeftSidebarWidth((prev) =>
      Math.min(LEFT_SIDEBAR_MAX, Math.max(LEFT_SIDEBAR_MIN, prev + delta))
    );
  }, []);

  const handleRightResize = useCallback((delta: number) => {
    setRightSidebarWidth((prev) =>
      Math.min(RIGHT_SIDEBAR_MAX, Math.max(RIGHT_SIDEBAR_MIN, prev + delta))
    );
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!workflow) {
    return null;
  }

  return (
    <div className="h-screen flex flex-col bg-[hsl(0,0%,7%)]">
      {/* Header - Linear style */}
      <header className="h-11 flex items-center justify-between px-3 border-b border-[hsl(0,0%,12%)] flex-shrink-0 bg-[hsl(0,0%,7%)]">
        {/* Left: Navigation & Title */}
        <div className="flex items-center gap-1 min-w-0">
          <button
            onClick={() => router.push("/")}
            className="h-6 w-6 flex items-center justify-center rounded text-[hsl(0,0%,50%)] hover:text-[hsl(0,0%,75%)] hover:bg-[hsl(0,0%,12%)] transition-colors duration-100"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
            className="h-6 w-6 flex items-center justify-center rounded text-[hsl(0,0%,50%)] hover:text-[hsl(0,0%,75%)] hover:bg-[hsl(0,0%,12%)] transition-colors duration-100"
            title={isLeftSidebarOpen ? "Hide library" : "Show library"}
          >
            {isLeftSidebarOpen ? (
              <PanelLeftClose className="w-4 h-4" />
            ) : (
              <PanelLeft className="w-4 h-4" />
            )}
          </button>

          <div className="w-px h-4 bg-[hsl(0,0%,15%)] mx-1" />

          <h1 className="text-[13px] font-medium text-[hsl(0,0%,85%)] truncate">
            {workflow.name}
          </h1>

          <span className="text-[11px] text-[hsl(0,0%,40%)] hidden sm:block tabular-nums ml-2">
            {nodes.length} nodes
          </span>
        </div>

        {/* Right: Actions & Panel Toggles */}
        <div className="flex items-center gap-1">
          {/* Run - Primary action */}
          <button
            onClick={handleRun}
            disabled={isRunning || nodes.length === 0}
            className={cn(
              "h-7 px-3 rounded text-[12px] font-medium flex items-center gap-1.5 transition-colors duration-100",
              isRunning || nodes.length === 0
                ? "bg-[hsl(0,0%,15%)] text-[hsl(0,0%,40%)] cursor-not-allowed"
                : "bg-[hsl(0,0%,90%)] text-[hsl(0,0%,7%)] hover:bg-[hsl(0,0%,100%)]"
            )}
          >
            {isRunning ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Play className="w-3 h-3" />
            )}
            Run
          </button>

          <div className="w-px h-4 bg-[hsl(0,0%,15%)] mx-1" />

          {/* Panel toggles */}
          <button
            onClick={() => setRightPanel(rightPanel === "execution" ? null : "execution")}
            className={cn(
              "h-6 w-6 flex items-center justify-center rounded transition-colors duration-100",
              rightPanel === "execution"
                ? "text-[hsl(0,0%,85%)] bg-[hsl(0,0%,12%)]"
                : "text-[hsl(0,0%,45%)] hover:text-[hsl(0,0%,70%)] hover:bg-[hsl(0,0%,10%)]",
              executionStatus === "running" && "text-[hsl(210,60%,60%)]"
            )}
            title="Execution"
          >
            <Zap className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setRightPanel(rightPanel === "inspector" ? null : "inspector")}
            className={cn(
              "h-6 w-6 flex items-center justify-center rounded transition-colors duration-100",
              rightPanel === "inspector"
                ? "text-[hsl(0,0%,85%)] bg-[hsl(0,0%,12%)]"
                : "text-[hsl(0,0%,45%)] hover:text-[hsl(0,0%,70%)] hover:bg-[hsl(0,0%,10%)]"
            )}
            title="Inspector"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setRightPanel(rightPanel === "chat" ? null : "chat")}
            className={cn(
              "h-6 w-6 flex items-center justify-center rounded transition-colors duration-100",
              rightPanel === "chat"
                ? "text-[hsl(0,0%,85%)] bg-[hsl(0,0%,12%)]"
                : "text-[hsl(0,0%,45%)] hover:text-[hsl(0,0%,70%)] hover:bg-[hsl(0,0%,10%)]"
            )}
            title="Assistant"
          >
            <RLTXIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Primitives Library - collapsible & resizable */}
        {isLeftSidebarOpen && (
          <div
            className="relative flex-shrink-0 border-r border-[hsl(0,0%,12%)]"
            style={{ width: leftSidebarWidth }}
          >
            <PrimitiveLibrary className="h-full" />
            <ResizeHandle side="left" onResize={handleLeftResize} />
          </div>
        )}

        {/* Center: Canvas */}
        <div className="flex-1 relative min-w-0">
          <Canvas
            workflowId={workflow.id}
            initialGraph={workflow.graph as { nodes: never[]; edges: never[] }}
          />
        </div>

        {/* Right Panel - resizable */}
        {rightPanel && (
          <div
            className="relative flex-shrink-0 border-l border-[hsl(0,0%,12%)]"
            style={{ width: rightSidebarWidth }}
          >
            <ResizeHandle side="right" onResize={handleRightResize} />
            {rightPanel === "chat" && (
              <ChatPanel
                workflowId={workflow.id}
                onWorkflowGenerated={handleWorkflowGenerated}
                className="h-full"
              />
            )}
            {rightPanel === "inspector" && (
              <Inspector className="h-full" />
            )}
            {rightPanel === "execution" && (
              <ExecutionPanel />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
