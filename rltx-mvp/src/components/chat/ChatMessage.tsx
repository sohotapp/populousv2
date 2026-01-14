"use client";

import { memo } from "react";
import { ArrowRight } from "lucide-react";
import type { ChatMessage as ChatMessageType } from "@/types";

interface ChatMessageProps {
  message: ChatMessageType;
  onWorkflowClick?: (workflow: NonNullable<ChatMessageType["workflow"]>) => void;
}

function ChatMessageComponent({ message, onWorkflowClick }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div>
      {isUser ? (
        /* User message - muted, minimal */
        <p className="text-[13px] text-[hsl(0,0%,50%)] leading-[1.5]">
          {message.content}
        </p>
      ) : (
        /* Assistant message */
        <div>
          <p className="text-[13px] text-[hsl(0,0%,88%)] leading-[1.5]">
            {message.content}
          </p>

          {/* Workflow link - Linear style: pure text, hover reveals */}
          {message.workflow && (
            <button
              onClick={() => onWorkflowClick?.(message.workflow!)}
              className="group/link mt-2 -ml-1.5 flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-[hsl(0,0%,12%)] transition-colors duration-100 text-left"
            >
              <span className="text-[13px] text-[hsl(0,0%,55%)] group-hover/link:text-[hsl(0,0%,85%)] transition-colors duration-100">
                {message.workflow.name}
              </span>
              <span className="text-[11px] text-[hsl(0,0%,35%)]">
                · {message.workflow.nodeCount} nodes
              </span>
              <ArrowRight className="w-3 h-3 text-[hsl(0,0%,30%)] group-hover/link:text-[hsl(0,0%,55%)] transition-colors duration-100 ml-0.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export const ChatMessage = memo(ChatMessageComponent);
