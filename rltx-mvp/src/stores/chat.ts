import { create } from "zustand";
import type { ChatMessage } from "@/types";
import { nanoid } from "nanoid";

interface ChatState {
  messages: ChatMessage[];
  isGenerating: boolean;
  conversationId: string | null;

  // Actions
  addUserMessage: (content: string) => void;
  addAssistantMessage: (content: string, workflow?: ChatMessage["workflow"]) => void;
  setIsGenerating: (isGenerating: boolean) => void;
  clearMessages: () => void;
  setConversationId: (id: string | null) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isGenerating: false,
  conversationId: null,

  addUserMessage: (content) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: nanoid(),
          role: "user",
          content,
          timestamp: new Date().toISOString(),
        },
      ],
    })),

  addAssistantMessage: (content, workflow) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: nanoid(),
          role: "assistant",
          content,
          workflow,
          timestamp: new Date().toISOString(),
        },
      ],
    })),

  setIsGenerating: (isGenerating) => set({ isGenerating }),

  clearMessages: () => set({ messages: [], conversationId: null }),

  setConversationId: (id) => set({ conversationId: id }),
}));
