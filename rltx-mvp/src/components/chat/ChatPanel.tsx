"use client";

import { useEffect, useRef, useState } from "react";
import { useChatStore } from "@/stores/chat";
import { useCanvasStore } from "@/stores/canvas";
import { ChatMessage } from "./ChatMessage";
import { cn } from "@/lib/utils";
import { Plus, History, ArrowUp, Loader2 } from "lucide-react";
import { RLTXIcon } from "@/components/ui/RLTXIcon";

interface WorkflowData {
  id: string;
  name: string;
  nodeCount: number;
  nodes: unknown[];
  edges: unknown[];
}

interface ChatPanelProps {
  workflowId: string;
  onWorkflowGenerated?: (workflow: WorkflowData) => void;
  onRunSimulation?: () => void;
  className?: string;
}

export function ChatPanel({
  workflowId,
  onWorkflowGenerated,
  onRunSimulation,
  className,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const {
    messages,
    isGenerating,
    addUserMessage,
    addAssistantMessage,
    setIsGenerating,
    clearMessages,
  } = useChatStore();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [inputValue]);

  const handleSend = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || isGenerating) return;

    setInputValue("");
    addUserMessage(trimmed);
    setIsGenerating(true);

    // Add timeout with AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // Increased to 60s for multi-turn

    try {
      console.log("[ChatPanel] Sending message:", trimmed);

      // Get current canvas state for context
      const canvasState = useCanvasStore.getState();
      const currentWorkflow = canvasState.nodes.length > 0
        ? {
            nodes: canvasState.nodes.map(n => ({
              id: n.id,
              primitiveId: (n.data as { primitiveId?: string })?.primitiveId,
              label: (n.data as { label?: string })?.label,
              config: (n.data as { config?: unknown })?.config,
            })),
            edges: canvasState.edges.map(e => ({
              source: e.source,
              target: e.target,
            })),
          }
        : null;

      // Build conversation history for context (excluding current message which we just added)
      const conversationHistory = messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
        hasWorkflow: !!m.workflow,
      }));

      const response = await fetch("/api/chat/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          workflowId,
          conversationHistory,
          currentWorkflow,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      console.log("[ChatPanel] Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[ChatPanel] API error:", errorText);
        throw new Error(`Failed to compose workflow: ${response.status}`);
      }

      const data = await response.json();
      console.log("[ChatPanel] Received data:", data);

      if (!data.message) {
        console.warn("[ChatPanel] No message in response, using fallback");
        addAssistantMessage("I received your request but couldn't generate a proper response. Please try again with a specific question like 'Would customers buy this product?' or 'How would Congress vote on this bill?'");
      } else {
        // Handle different intents
        const canvasStore = useCanvasStore.getState();

        if (data.intent === 'refine' && data.addNodes && data.addNodes.length > 0) {
          // Add new nodes to canvas
          for (const node of data.addNodes) {
            canvasStore.addNode(node);
          }
          // Add edges if provided
          if (data.addEdges && data.addEdges.length > 0) {
            canvasStore.setEdges((edges) => [...edges, ...data.addEdges]);
          }
          addAssistantMessage(data.message, undefined); // No workflow card, nodes added directly
        } else if (data.intent === 'configure' && data.configUpdates && data.configUpdates.length > 0) {
          // Update node configurations
          for (const update of data.configUpdates) {
            canvasStore.updateNodeData(update.nodeId, {
              config: { ...(canvasStore.nodes.find(n => n.id === update.nodeId)?.data as { config?: Record<string, unknown> })?.config, ...update.config }
            });
          }
          addAssistantMessage(data.message, undefined);
        } else {
          // Standard response with optional workflow
          addAssistantMessage(data.message, data.workflow);
        }
      }
    } catch (error) {
      console.error("[ChatPanel] Error:", error);
      if (error instanceof Error && error.name === "AbortError") {
        addAssistantMessage(
          "Request timed out after 30 seconds. The server might be busy - please try again."
        );
      } else {
        addAssistantMessage(
          "I couldn't process that request. Please try again with a simulation question."
        );
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(inputValue);
    }
  };

  const handleNewChat = () => {
    clearMessages();
  };

  const canSend = inputValue.trim() && !isGenerating;
  const canvasStore = useCanvasStore.getState();
  const hasWorkflowOnCanvas = canvasStore.nodes.length > 0;
  const showSuggestions = messages.length === 0;
  const showFollowUps = messages.length > 0 && hasWorkflowOnCanvas && !isGenerating;

  // Initial suggestions for empty chat
  const suggestions = [
    "Would customers buy a subscription at $25/month?",
    "How would competitors respond if we cut prices?",
    "How would Congress vote on a TikTok ban?",
  ];

  // Follow-up suggestions when workflow exists
  const followUpSuggestions = [
    "Add demographic segmentation",
    "Use 5000 agents for more precision",
    "Focus on millennials only",
    "How does this simulation work?",
  ];

  return (
    <div className={cn("flex flex-col bg-[hsl(0,0%,7%)]", className)}>
      {/* Header */}
      {/* design.md: panel padding 12px (space-3) */}
      <div className="flex items-center justify-between px-3 py-3 flex-shrink-0">
        <span className="text-[hsl(0,0%,65%)] text-[13px] font-medium">
          Simulation Assistant
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleNewChat}
            className="h-6 w-6 flex items-center justify-center rounded text-[hsl(0,0%,45%)] hover:text-[hsl(0,0%,70%)] hover:bg-[hsl(0,0%,10%)] transition-colors duration-100"
            title="New conversation"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={cn(
              "h-6 w-6 flex items-center justify-center rounded transition-colors duration-100",
              showHistory
                ? "text-[hsl(0,0%,70%)] bg-[hsl(0,0%,10%)]"
                : "text-[hsl(0,0%,45%)] hover:text-[hsl(0,0%,70%)] hover:bg-[hsl(0,0%,10%)]"
            )}
            title="History"
          >
            <History className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content area - wrapper for logo positioning */}
      <div className="flex-1 flex flex-col relative min-h-0">
        {/* Logo - positioned relative to entire content area to align with other panels */}
        {messages.length === 0 && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ top: '-10%' }}
          >
            <RLTXIcon className="w-10 h-10 text-[hsl(0,0%,18%)]" />
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto" ref={scrollRef}>
          {messages.length > 0 && (
            <div className="px-3 py-3 space-y-3">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  onWorkflowClick={onWorkflowGenerated}
                  onRunSimulation={onRunSimulation}
                />
              ))}
              {isGenerating && (
                <div className="flex items-center gap-1 pt-1">
                  <div className="w-1 h-1 rounded-full bg-[hsl(0,0%,45%)] animate-pulse" />
                  <div className="w-1 h-1 rounded-full bg-[hsl(0,0%,45%)] animate-pulse" style={{ animationDelay: '150ms' }} />
                  <div className="w-1 h-1 rounded-full bg-[hsl(0,0%,45%)] animate-pulse" style={{ animationDelay: '300ms' }} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input area - Cursor-style */}
        <div className="px-3 pb-3 pt-2 flex-shrink-0">
        {/* Initial suggestions - when chat is empty */}
        {showSuggestions && (
          <div className="mb-3">
            <p className="text-[11px] text-[hsl(0,0%,40%)] mb-2 px-1">Try asking</p>
            <div className="space-y-0.5">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleSend(suggestion)}
                  className="w-full text-left px-2 py-1.5 text-[12px] text-[hsl(0,0%,55%)] hover:text-[hsl(0,0%,75%)] hover:bg-[hsl(0,0%,10%)] rounded transition-colors duration-100 leading-relaxed"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Follow-up suggestions - when workflow exists */}
        {showFollowUps && (
          <div className="mb-3">
            <p className="text-[11px] text-[hsl(0,0%,40%)] mb-2 px-1">Refine your simulation</p>
            <div className="flex flex-wrap gap-1.5">
              {followUpSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleSend(suggestion)}
                  className="px-2 py-1 text-[11px] text-[hsl(0,0%,55%)] hover:text-[hsl(0,0%,75%)] bg-[hsl(0,0%,10%)] hover:bg-[hsl(0,0%,12%)] border border-[hsl(0,0%,18%)] rounded-md transition-colors duration-100"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Boxed input - design.md: 6px radius for cards/panels */}
        <div
          className={cn(
            "rounded-md border transition-colors duration-100",
            isFocused
              ? "border-[hsl(0,0%,25%)] bg-[hsl(0,0%,9%)]"
              : "border-[hsl(0,0%,15%)] bg-[hsl(0,0%,8%)]"
          )}
        >
          <div className="flex items-end gap-2 p-2.5">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Ask a question..."
              disabled={isGenerating}
              rows={1}
              className="flex-1 bg-transparent resize-none text-[13px] leading-[1.4] text-[hsl(0,0%,90%)] placeholder:text-[hsl(0,0%,40%)] focus:outline-none disabled:opacity-50 min-h-[22px] max-h-[120px]"
            />

            {/* Circular send button */}
            <button
              onClick={() => handleSend(inputValue)}
              disabled={!canSend}
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-100",
                canSend
                  ? "bg-[hsl(0,0%,90%)] text-[hsl(0,0%,7%)] hover:bg-[hsl(0,0%,100%)]"
                  : "bg-[hsl(0,0%,15%)] text-[hsl(0,0%,35%)]"
              )}
            >
              {isGenerating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <ArrowUp className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>

        {/* Keyboard hint */}
        <div className="flex items-center justify-end mt-1.5 px-0.5">
          <span className="text-[10px] text-[hsl(0,0%,30%)]">
            <kbd className="px-1 py-0.5 rounded bg-[hsl(0,0%,10%)] font-mono text-[9px] text-[hsl(0,0%,40%)]">Enter</kbd>
            <span className="ml-1">to send</span>
          </span>
        </div>
        </div>
      </div>
    </div>
  );
}
