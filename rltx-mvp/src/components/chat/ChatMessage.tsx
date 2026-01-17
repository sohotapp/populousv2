"use client";

import { memo, useState, useMemo } from "react";
import { ArrowRight, Play, Check } from "lucide-react";
import type { ChatMessage as ChatMessageType } from "@/types";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  message: ChatMessageType;
  onWorkflowClick?: (workflow: NonNullable<ChatMessageType["workflow"]>) => void;
  onRunSimulation?: () => void;
  isWorkflowLoaded?: boolean;
}

// Simple markdown renderer for chat messages
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  lines.forEach((line, lineIndex) => {
    if (lineIndex > 0) {
      elements.push(<br key={`br-${lineIndex}`} />);
    }

    // Handle bullet points
    const bulletMatch = line.match(/^[•\-\*]\s+(.*)$/);
    if (bulletMatch) {
      elements.push(
        <span key={`line-${lineIndex}`} className="flex items-start gap-2 my-0.5">
          <span className="text-[hsl(0,0%,40%)] mt-[2px]">•</span>
          <span>{renderInlineMarkdown(bulletMatch[1], lineIndex)}</span>
        </span>
      );
      return;
    }

    // Handle numbered lists
    const numberedMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (numberedMatch) {
      elements.push(
        <span key={`line-${lineIndex}`} className="flex items-start gap-2 my-0.5">
          <span className="text-[hsl(0,0%,50%)] min-w-[1.2em] text-right">{numberedMatch[1]}.</span>
          <span>{renderInlineMarkdown(numberedMatch[2], lineIndex)}</span>
        </span>
      );
      return;
    }

    // Regular line
    elements.push(
      <span key={`line-${lineIndex}`}>{renderInlineMarkdown(line, lineIndex)}</span>
    );
  });

  return elements;
}

// Handle inline markdown: **bold**, `code`, and links
function renderInlineMarkdown(text: string, keyPrefix: number): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let partIndex = 0;

  while (remaining.length > 0) {
    // Match **bold**
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
    // Match `code`
    const codeMatch = remaining.match(/`([^`]+)`/);
    // Match "quoted text"
    const quoteMatch = remaining.match(/"([^"]+)"/);

    // Find earliest match
    const matches = [
      { match: boldMatch, type: 'bold' },
      { match: codeMatch, type: 'code' },
      { match: quoteMatch, type: 'quote' },
    ].filter(m => m.match !== null)
     .sort((a, b) => (a.match?.index ?? Infinity) - (b.match?.index ?? Infinity));

    if (matches.length === 0) {
      // No more matches, add remaining text
      if (remaining) {
        parts.push(<span key={`${keyPrefix}-${partIndex++}`}>{remaining}</span>);
      }
      break;
    }

    const { match, type } = matches[0];
    const index = match!.index!;

    // Add text before match
    if (index > 0) {
      parts.push(<span key={`${keyPrefix}-${partIndex++}`}>{remaining.slice(0, index)}</span>);
    }

    // Add formatted text
    if (type === 'bold') {
      parts.push(
        <strong key={`${keyPrefix}-${partIndex++}`} className="font-semibold text-[hsl(0,0%,95%)]">
          {match![1]}
        </strong>
      );
      remaining = remaining.slice(index + match![0].length);
    } else if (type === 'code') {
      parts.push(
        <code key={`${keyPrefix}-${partIndex++}`} className="px-1.5 py-0.5 rounded bg-[hsl(0,0%,15%)] text-[hsl(0,0%,70%)] font-mono text-[11px]">
          {match![1]}
        </code>
      );
      remaining = remaining.slice(index + match![0].length);
    } else if (type === 'quote') {
      parts.push(
        <span key={`${keyPrefix}-${partIndex++}`} className="text-[hsl(0,0%,70%)]">
          &quot;{match![1]}&quot;
        </span>
      );
      remaining = remaining.slice(index + match![0].length);
    }
  }

  return parts;
}

function ChatMessageComponent({
  message,
  onWorkflowClick,
  onRunSimulation,
  isWorkflowLoaded = false,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const [hasClicked, setHasClicked] = useState(false);

  const handleWorkflowClick = () => {
    onWorkflowClick?.(message.workflow!);
    setHasClicked(true);
  };

  const handleRunClick = () => {
    // If not yet loaded, load first then run
    if (!hasClicked && !isWorkflowLoaded) {
      onWorkflowClick?.(message.workflow!);
      setHasClicked(true);
    }
    // Small delay to let the workflow load
    setTimeout(() => {
      onRunSimulation?.();
    }, 100);
  };

  // Memoize markdown rendering
  const renderedContent = useMemo(() => {
    if (isUser) return null;
    return renderMarkdown(message.content);
  }, [message.content, isUser]);

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
          <div className="text-[13px] text-[hsl(0,0%,88%)] leading-[1.6]">
            {renderedContent}
          </div>

          {/* Workflow card with load and run actions */}
          {message.workflow && (
            <div className="mt-3 p-3 rounded-md bg-[hsl(0,0%,10%)] border border-[hsl(0,0%,15%)]">
              {/* Workflow info */}
              <button
                onClick={handleWorkflowClick}
                className="group/link flex items-center gap-1.5 text-left w-full"
              >
                <span className="text-[13px] text-[hsl(0,0%,75%)] group-hover/link:text-[hsl(0,0%,95%)] transition-colors duration-100 font-medium">
                  {message.workflow.name}
                </span>
                <span className="text-[11px] text-[hsl(0,0%,40%)]">
                  · {message.workflow.nodeCount} nodes
                </span>
                {(hasClicked || isWorkflowLoaded) ? (
                  <Check className="w-3 h-3 text-[hsl(142,50%,50%)] ml-auto" />
                ) : (
                  <ArrowRight className="w-3 h-3 text-[hsl(0,0%,35%)] group-hover/link:text-[hsl(0,0%,60%)] transition-colors duration-100 ml-auto" />
                )}
              </button>

              {/* Run Simulation button */}
              <button
                onClick={handleRunClick}
                className={cn(
                  "mt-2.5 w-full h-8 text-[12px] font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors duration-100",
                  "bg-[hsl(0,0%,90%)] text-[hsl(0,0%,7%)] hover:bg-[hsl(0,0%,100%)]"
                )}
              >
                <Play className="w-3 h-3" />
                Run Simulation
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const ChatMessage = memo(ChatMessageComponent);
