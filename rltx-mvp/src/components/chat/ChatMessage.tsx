"use client";

import { memo } from "react";
import { User, MessageSquare, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "@/types";

interface ChatMessageProps {
  message: ChatMessageType;
  onWorkflowClick?: (workflowId: string) => void;
}

function ChatMessageComponent({ message, onWorkflowClick }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-2.5", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center",
          isUser ? "bg-foreground" : "bg-secondary"
        )}
      >
        {isUser ? (
          <User className="w-3 h-3 text-background" />
        ) : (
          <MessageSquare className="w-3 h-3 text-muted-foreground" />
        )}
      </div>

      {/* Content */}
      <div className={cn("flex-1 min-w-0", isUser && "flex justify-end")}>
        <div
          className={cn(
            "inline-block max-w-[85%] px-3 py-2 rounded-lg text-sm",
            isUser
              ? "bg-foreground text-background"
              : "bg-transparent text-foreground"
          )}
        >
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>

          {/* Workflow card */}
          {message.workflow && (
            <button
              onClick={() => onWorkflowClick?.(message.workflow!.id)}
              className="mt-2 flex items-center gap-2 w-full px-2.5 py-2 bg-secondary/50 hover:bg-secondary rounded-md transition-colors text-left"
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-foreground truncate">
                  {message.workflow.name}
                </div>
                <div className="text-2xs text-muted-foreground">
                  {message.workflow.nodeCount} nodes
                </div>
              </div>
              <ArrowRight className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export const ChatMessage = memo(ChatMessageComponent);
