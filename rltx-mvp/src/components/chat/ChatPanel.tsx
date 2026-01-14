"use client";

import { useEffect, useRef, useState } from "react";
import { useChatStore } from "@/stores/chat";
import { ChatMessage } from "./ChatMessage";
import { cn } from "@/lib/utils";
import { Plus, History, ArrowUp, Loader2 } from "lucide-react";
import { RLTXIcon } from "@/components/ui/RLTXIcon";

interface ChatPanelProps {
  workflowId: string;
  onWorkflowClick?: (workflowId: string) => void;
  className?: string;
}

export function ChatPanel({
  workflowId,
  onWorkflowClick,
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

    try {
      const response = await fetch("/api/chat/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          workflowId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to compose workflow");
      }

      const data = await response.json();
      addAssistantMessage(data.message, data.workflow);
    } catch (error) {
      console.error("Chat error:", error);
      addAssistantMessage(
        "I couldn't process that request. Please try again."
      );
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
  const showSuggestions = messages.length === 0 && !inputValue;

  const suggestions = [
    "Should we raise prices by 15%?",
    "What if a competitor enters our market?",
    "Evaluate this acquisition target",
  ];

  return (
    <div className={cn("flex flex-col bg-[hsl(0,0%,7%)]", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 flex-shrink-0">
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

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        {messages.length === 0 ? (
          // Empty state - just the logo centered
          <div className="h-full flex items-center justify-center">
            <RLTXIcon className="w-16 h-16 text-[hsl(0,0%,15%)]" />
          </div>
        ) : (
          <div className="p-3 space-y-3">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                onWorkflowClick={onWorkflowClick}
              />
            ))}
            {isGenerating && (
              <div className="flex items-center gap-1.5 py-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[hsl(0,0%,40%)] animate-pulse" />
                <div className="w-1.5 h-1.5 rounded-full bg-[hsl(0,0%,40%)] animate-pulse" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-[hsl(0,0%,40%)] animate-pulse" style={{ animationDelay: '300ms' }} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input area - Cursor-style */}
      <div className="px-3 pb-3 pt-2">
        {/* Suggestions - above input */}
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

        {/* Boxed input */}
        <div
          className={cn(
            "rounded-lg border transition-colors duration-100",
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
  );
}
