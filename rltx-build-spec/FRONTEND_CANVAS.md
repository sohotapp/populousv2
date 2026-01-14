# RLTX Frontend - Cursor/Figma-Style Canvas

## Implementation Guide

---

## Design Philosophy

RLTX combines two proven UI paradigms:

1. **Cursor-Style**: Chat-first AI interface where conversation drives action
2. **Figma-Style**: Infinite canvas with real-time collaboration and semantic zoom

The canvas is central. The chat generates and manipulates the canvas. Results flow from canvas execution.

---

## Application Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  HEADER                                                           [User] [?] │
├─────────────┬────────────────────────────────────────────────┬───────────────┤
│             │                                                │               │
│   SIDEBAR   │                   MAIN AREA                    │   PANEL       │
│             │                                                │               │
│  Navigation │   Canvas / Chat / Results                      │  Inspector    │
│  Quick      │   (Dynamic based on context)                   │  Properties   │
│  Actions    │                                                │  Config       │
│             │                                                │               │
│             │                                                │               │
│             │                                                │               │
│             │                                                │               │
├─────────────┴────────────────────────────────────────────────┴───────────────┤
│  FOOTER (Status Bar)                                                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Home/Command
│   ├── (auth)/
│   │   ├── sign-in/
│   │   └── sign-up/
│   ├── workflow/
│   │   ├── [id]/
│   │   │   ├── page.tsx        # Canvas view
│   │   │   └── results/
│   │   │       └── page.tsx    # Results view
│   │   └── new/
│   │       └── page.tsx        # New workflow
│   ├── decisions/
│   │   └── page.tsx            # Decision library
│   ├── pulse/
│   │   └── page.tsx            # Morning brief
│   └── api/
│       ├── workflows/
│       ├── executions/
│       └── chat/
│
├── components/
│   ├── canvas/
│   │   ├── Canvas.tsx          # Main canvas wrapper
│   │   ├── CanvasControls.tsx  # Zoom, minimap controls
│   │   ├── CanvasToolbar.tsx   # Top toolbar
│   │   └── nodes/
│   │       ├── PrimitiveNode.tsx
│   │       ├── GroupNode.tsx
│   │       ├── AnnotationNode.tsx
│   │       └── index.ts
│   │
│   ├── chat/
│   │   ├── ChatInterface.tsx   # Main chat component
│   │   ├── ChatMessage.tsx     # Individual message
│   │   ├── ChatInput.tsx       # Input with suggestions
│   │   └── WorkflowPreview.tsx # Inline workflow preview
│   │
│   ├── inspector/
│   │   ├── Inspector.tsx       # Right panel wrapper
│   │   ├── NodeConfig.tsx      # Node configuration
│   │   ├── NodeOutput.tsx      # Execution output
│   │   └── ProvenanceTab.tsx   # Data sources
│   │
│   ├── results/
│   │   ├── ResultsView.tsx     # Main results display
│   │   ├── RecommendationCard.tsx
│   │   ├── ParetoChart.tsx     # Interactive frontier
│   │   ├── SensitivityChart.tsx
│   │   └── MinorityView.tsx
│   │
│   ├── primitives/
│   │   ├── PrimitiveLibrary.tsx
│   │   └── PrimitiveCard.tsx
│   │
│   └── ui/
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── Dialog.tsx
│       └── ... (shadcn components)
│
├── stores/
│   ├── canvas.ts               # Canvas state (Zustand)
│   ├── chat.ts                 # Chat state
│   ├── execution.ts            # Execution state
│   └── ui.ts                   # UI state (panels, modals)
│
├── hooks/
│   ├── useCanvas.ts            # Canvas operations
│   ├── useChat.ts              # Chat operations
│   ├── useExecution.ts         # Execution control
│   ├── useSocket.ts            # WebSocket connection
│   └── useCollaboration.ts     # Real-time collab
│
├── lib/
│   ├── api.ts                  # API client
│   ├── socket.ts               # Socket.io client
│   ├── primitives.ts           # Primitive definitions
│   └── utils.ts                # Utilities
│
└── types/
    ├── canvas.ts               # Canvas types
    ├── workflow.ts             # Workflow types
    ├── execution.ts            # Execution types
    └── primitive.ts            # Primitive types
```

---

## Canvas Implementation

### Main Canvas Component

```tsx
// components/canvas/Canvas.tsx
'use client';

import { useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  NodeTypes,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useCanvasStore } from '@/stores/canvas';
import { useSocket } from '@/hooks/useSocket';
import { PrimitiveNode } from './nodes/PrimitiveNode';
import { GroupNode } from './nodes/GroupNode';
import { CanvasToolbar } from './CanvasToolbar';
import { CanvasControls } from './CanvasControls';
import { CollaboratorCursors } from './CollaboratorCursors';

const nodeTypes: NodeTypes = {
  primitive: PrimitiveNode,
  group: GroupNode,
};

interface CanvasProps {
  workflowId: string;
}

export function Canvas({ workflowId }: CanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { project, fitView } = useReactFlow();

  // Store
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    collaborators,
  } = useCanvasStore();

  // Socket for real-time sync
  const socket = useSocket();

  // Sync canvas changes to server
  useEffect(() => {
    if (!socket) return;

    socket.emit('workflow:join', workflowId);

    socket.on('canvas:sync', (data) => {
      setNodes(data.nodes);
      setEdges(data.edges);
    });

    socket.on('canvas:update', (data) => {
      // Apply remote changes
      if (data.type === 'node:update') {
        setNodes((nds) =>
          nds.map((n) => (n.id === data.nodeId ? { ...n, ...data.changes } : n))
        );
      }
    });

    return () => {
      socket.emit('workflow:leave', workflowId);
    };
  }, [socket, workflowId]);

  // Handle new connections
  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdge = addEdge(connection, edges);
      setEdges(newEdge);

      // Broadcast to collaborators
      socket?.emit('canvas:update', {
        workflowId,
        type: 'edge:add',
        edge: connection,
      });
    },
    [edges, socket, workflowId]
  );

  // Handle drop from primitive library
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const primitiveId = event.dataTransfer.getData('primitive/id');
      if (!primitiveId) return;

      const position = project({
        x: event.clientX - reactFlowWrapper.current!.getBoundingClientRect().left,
        y: event.clientY - reactFlowWrapper.current!.getBoundingClientRect().top,
      });

      const newNode: Node = {
        id: `${primitiveId}-${Date.now()}`,
        type: 'primitive',
        position,
        data: {
          primitiveId,
          config: {},
          state: 'idle',
        },
      };

      setNodes((nds) => [...nds, newNode]);

      // Broadcast
      socket?.emit('canvas:update', {
        workflowId,
        type: 'node:add',
        node: newNode,
      });
    },
    [project, socket, workflowId]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  return (
    <div ref={reactFlowWrapper} className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid
        snapGrid={[16, 16]}
        defaultEdgeOptions={{
          animated: true,
          style: { stroke: '#6366f1', strokeWidth: 2 },
        }}
      >
        <Background gap={16} size={1} color="#e5e7eb" />

        <Panel position="top-left">
          <CanvasToolbar workflowId={workflowId} />
        </Panel>

        <Panel position="bottom-right">
          <CanvasControls />
        </Panel>

        <MiniMap
          nodeColor={(node) => {
            switch (node.data?.state) {
              case 'running': return '#3b82f6';
              case 'completed': return '#22c55e';
              case 'failed': return '#ef4444';
              default: return '#9ca3af';
            }
          }}
          maskColor="rgb(0, 0, 0, 0.1)"
          className="bg-white rounded-lg shadow-lg"
        />

        <Controls />

        {/* Collaborator cursors */}
        <CollaboratorCursors collaborators={collaborators} />
      </ReactFlow>
    </div>
  );
}
```

### Primitive Node Component

```tsx
// components/canvas/nodes/PrimitiveNode.tsx
import { memo, useState } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Settings, Play, Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { primitives } from '@/lib/primitives';
import { useCanvasStore } from '@/stores/canvas';

interface PrimitiveNodeData {
  primitiveId: string;
  config: Record<string, any>;
  state: 'idle' | 'pending' | 'running' | 'completed' | 'failed';
  output?: any;
  timing?: { startedAt: string; completedAt: string; durationMs: number };
  error?: string;
}

export const PrimitiveNode = memo(function PrimitiveNode({
  id,
  data,
  selected,
}: NodeProps<PrimitiveNodeData>) {
  const primitive = primitives[data.primitiveId];
  const setSelectedNode = useCanvasStore((s) => s.setSelectedNode);

  const stateColors = {
    idle: 'border-gray-200 bg-white',
    pending: 'border-gray-300 bg-gray-50',
    running: 'border-blue-500 bg-blue-50',
    completed: 'border-green-500 bg-green-50',
    failed: 'border-red-500 bg-red-50',
  };

  const StateIcon = () => {
    switch (data.state) {
      case 'running':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'completed':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <X className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        'rounded-xl border-2 shadow-lg min-w-[220px] transition-all duration-200',
        stateColors[data.state],
        selected && 'ring-2 ring-blue-500 ring-offset-2',
        data.state === 'running' && 'animate-pulse'
      )}
      onClick={() => setSelectedNode(id)}
    >
      {/* Input handles */}
      {primitive?.inputs.map((input, i) => (
        <Handle
          key={input.id}
          type="target"
          position={Position.Top}
          id={input.id}
          className="w-3 h-3 bg-gray-400 border-2 border-white"
          style={{ left: `${((i + 1) / (primitive.inputs.length + 1)) * 100}%` }}
        />
      ))}

      {/* Header */}
      <div className="flex items-center gap-3 p-3 border-b border-gray-100">
        <span className="text-2xl">{primitive?.icon || '📦'}</span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">
            {primitive?.name || data.primitiveId}
          </div>
          <div className="text-xs text-gray-500">
            {primitive?.category}
          </div>
        </div>
        <StateIcon />
      </div>

      {/* Body */}
      <div className="p-3">
        {data.state === 'idle' && (
          <div className="text-xs text-gray-400">
            {primitive?.description || 'Configure this node'}
          </div>
        )}

        {data.state === 'running' && (
          <div className="flex items-center gap-2 text-xs text-blue-600">
            <div className="w-full bg-blue-100 rounded-full h-1.5">
              <motion.div
                className="bg-blue-500 h-1.5 rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
          </div>
        )}

        {data.state === 'completed' && data.timing && (
          <div className="text-xs text-green-600">
            Completed in {data.timing.durationMs}ms
          </div>
        )}

        {data.state === 'failed' && data.error && (
          <div className="text-xs text-red-600 truncate">
            {data.error}
          </div>
        )}
      </div>

      {/* Output preview (when completed) */}
      {data.state === 'completed' && data.output && (
        <div className="px-3 pb-3">
          <div className="bg-gray-50 rounded-lg p-2 text-xs font-mono max-h-20 overflow-hidden">
            {typeof data.output === 'object'
              ? JSON.stringify(data.output, null, 2).slice(0, 100) + '...'
              : String(data.output).slice(0, 100)
            }
          </div>
        </div>
      )}

      {/* Output handles */}
      {primitive?.outputs.map((output, i) => (
        <Handle
          key={output.id}
          type="source"
          position={Position.Bottom}
          id={output.id}
          className="w-3 h-3 bg-gray-400 border-2 border-white"
          style={{ left: `${((i + 1) / (primitive.outputs.length + 1)) * 100}%` }}
        />
      ))}
    </motion.div>
  );
});
```

---

## Chat Interface (Cursor-Style)

```tsx
// components/chat/ChatInterface.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Mic, Sparkles } from 'lucide-react';
import { useChatStore } from '@/stores/chat';
import { useChat } from '@/hooks/useChat';
import { ChatMessage } from './ChatMessage';
import { WorkflowPreview } from './WorkflowPreview';
import { SuggestionChips } from './SuggestionChips';

export function ChatInterface() {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, isGenerating, suggestedQuestions } = useChatStore();
  const { sendMessage, regenerate } = useChat();

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;

    await sendMessage(input);
    setInput('');
  };

  const handleSuggestion = (question: string) => {
    setInput(question);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <EmptyState onSuggestion={handleSuggestion} />
        ) : (
          <AnimatePresence>
            {messages.map((message, i) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                {message.type === 'user' ? (
                  <UserMessage content={message.content} />
                ) : message.type === 'assistant' ? (
                  <AssistantMessage
                    content={message.content}
                    workflow={message.workflow}
                  />
                ) : message.type === 'workflow' ? (
                  <WorkflowPreview workflow={message.workflow} />
                ) : null}
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {isGenerating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-gray-500"
          >
            <Sparkles className="w-4 h-4 animate-pulse" />
            <span className="text-sm">Designing workflow...</span>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {suggestedQuestions.length > 0 && (
        <div className="px-4 pb-2">
          <SuggestionChips
            suggestions={suggestedQuestions}
            onSelect={handleSuggestion}
          />
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t bg-white">
        <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="What decision are you thinking through?"
            className="flex-1 bg-transparent px-3 py-2 outline-none text-sm"
            disabled={isGenerating}
          />
          <button
            type="button"
            className="p-2 text-gray-400 hover:text-gray-600"
          >
            <Mic className="w-5 h-5" />
          </button>
          <button
            type="submit"
            disabled={!input.trim() || isGenerating}
            className="p-2 bg-blue-500 text-white rounded-lg disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
}

function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="bg-blue-500 text-white rounded-2xl rounded-br-sm px-4 py-2 max-w-[80%]">
        {content}
      </div>
    </div>
  );
}

function AssistantMessage({
  content,
  workflow,
}: {
  content: string;
  workflow?: any;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm max-w-[90%]">
        <div className="prose prose-sm">{content}</div>
      </div>
      {workflow && <WorkflowPreview workflow={workflow} />}
    </div>
  );
}

function EmptyState({ onSuggestion }: { onSuggestion: (q: string) => void }) {
  const suggestions = [
    'Should we acquire TargetCo at $500M?',
    "What's our best pricing for enterprise?",
    'Re-run Q3 capital with new forecasts',
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <h2 className="text-2xl font-semibold text-gray-700 mb-2">
        What decision are you thinking through?
      </h2>
      <p className="text-gray-500 mb-6">
        I'll design a workflow to analyze it
      </p>
      <div className="flex flex-wrap gap-2 justify-center">
        {suggestions.map((q) => (
          <button
            key={q}
            onClick={() => onSuggestion(q)}
            className="px-4 py-2 bg-white rounded-full text-sm text-gray-600 hover:bg-gray-100 shadow-sm"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
```

---

## Inspector Panel (Node Configuration)

```tsx
// components/inspector/Inspector.tsx
'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCanvasStore } from '@/stores/canvas';
import { NodeConfig } from './NodeConfig';
import { NodeInputs } from './NodeInputs';
import { NodeOutput } from './NodeOutput';
import { NodeSensitivity } from './NodeSensitivity';
import { NodeProvenance } from './NodeProvenance';

export function Inspector() {
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const nodes = useCanvasStore((s) => s.nodes);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  if (!selectedNode) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 p-4 text-center">
        <div>
          <p className="mb-2">Select a node to configure</p>
          <p className="text-sm">Or drag a primitive from the library</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{selectedNode.data.icon || '📦'}</span>
          <div>
            <h3 className="font-semibold">{selectedNode.data.name}</h3>
            <p className="text-xs text-gray-500">{selectedNode.data.primitiveId}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="config" className="flex-1 flex flex-col">
        <TabsList className="px-4 pt-2">
          <TabsTrigger value="config">Config</TabsTrigger>
          <TabsTrigger value="inputs">Inputs</TabsTrigger>
          <TabsTrigger value="output">Output</TabsTrigger>
          <TabsTrigger value="sensitivity">Sensitivity</TabsTrigger>
          <TabsTrigger value="provenance">Provenance</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto">
          <TabsContent value="config" className="p-4">
            <NodeConfig node={selectedNode} />
          </TabsContent>

          <TabsContent value="inputs" className="p-4">
            <NodeInputs node={selectedNode} />
          </TabsContent>

          <TabsContent value="output" className="p-4">
            <NodeOutput node={selectedNode} />
          </TabsContent>

          <TabsContent value="sensitivity" className="p-4">
            <NodeSensitivity node={selectedNode} />
          </TabsContent>

          <TabsContent value="provenance" className="p-4">
            <NodeProvenance node={selectedNode} />
          </TabsContent>
        </div>
      </Tabs>

      {/* Footer with cost/time estimates */}
      <div className="p-4 border-t bg-gray-50">
        <div className="flex justify-between text-sm text-gray-500">
          <span>Est. time: ~{selectedNode.data.estimatedTime || 30}s</span>
          <span>Est. cost: ${selectedNode.data.estimatedCost || 2.50}</span>
        </div>
      </div>
    </div>
  );
}
```

---

## Zustand Store

```tsx
// stores/canvas.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import {
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';

interface Collaborator {
  userId: string;
  name: string;
  color: string;
  cursor: { x: number; y: number };
}

interface CanvasStore {
  // State
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  collaborators: Collaborator[];
  isExecuting: boolean;

  // Actions
  setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  setSelectedNode: (id: string | null) => void;
  updateNodeData: (id: string, data: Partial<Node['data']>) => void;
  updateNodeState: (id: string, state: string) => void;
  addCollaborator: (collaborator: Collaborator) => void;
  removeCollaborator: (userId: string) => void;
  updateCollaboratorCursor: (userId: string, cursor: { x: number; y: number }) => void;
  setIsExecuting: (isExecuting: boolean) => void;

  // Execution
  startExecution: () => void;
  updateExecution: (nodeId: string, state: string, output?: any) => void;
  completeExecution: () => void;
}

export const useCanvasStore = create<CanvasStore>()(
  immer((set, get) => ({
    nodes: [],
    edges: [],
    selectedNodeId: null,
    collaborators: [],
    isExecuting: false,

    setNodes: (nodesOrUpdater) =>
      set((state) => {
        state.nodes =
          typeof nodesOrUpdater === 'function'
            ? nodesOrUpdater(state.nodes)
            : nodesOrUpdater;
      }),

    setEdges: (edgesOrUpdater) =>
      set((state) => {
        state.edges =
          typeof edgesOrUpdater === 'function'
            ? edgesOrUpdater(state.edges)
            : edgesOrUpdater;
      }),

    onNodesChange: (changes) =>
      set((state) => {
        state.nodes = applyNodeChanges(changes, state.nodes);
      }),

    onEdgesChange: (changes) =>
      set((state) => {
        state.edges = applyEdgeChanges(changes, state.edges);
      }),

    setSelectedNode: (id) =>
      set((state) => {
        state.selectedNodeId = id;
      }),

    updateNodeData: (id, data) =>
      set((state) => {
        const node = state.nodes.find((n) => n.id === id);
        if (node) {
          node.data = { ...node.data, ...data };
        }
      }),

    updateNodeState: (id, nodeState) =>
      set((state) => {
        const node = state.nodes.find((n) => n.id === id);
        if (node) {
          node.data.state = nodeState;
        }
      }),

    addCollaborator: (collaborator) =>
      set((state) => {
        state.collaborators.push(collaborator);
      }),

    removeCollaborator: (userId) =>
      set((state) => {
        state.collaborators = state.collaborators.filter(
          (c) => c.userId !== userId
        );
      }),

    updateCollaboratorCursor: (userId, cursor) =>
      set((state) => {
        const collaborator = state.collaborators.find(
          (c) => c.userId === userId
        );
        if (collaborator) {
          collaborator.cursor = cursor;
        }
      }),

    setIsExecuting: (isExecuting) =>
      set((state) => {
        state.isExecuting = isExecuting;
      }),

    startExecution: () =>
      set((state) => {
        state.isExecuting = true;
        // Set all nodes to pending
        state.nodes.forEach((node) => {
          node.data.state = 'pending';
        });
      }),

    updateExecution: (nodeId, nodeState, output) =>
      set((state) => {
        const node = state.nodes.find((n) => n.id === nodeId);
        if (node) {
          node.data.state = nodeState;
          if (output) {
            node.data.output = output;
          }
        }
      }),

    completeExecution: () =>
      set((state) => {
        state.isExecuting = false;
      }),
  }))
);
```

---

## Real-Time Collaboration

```tsx
// components/canvas/CollaboratorCursors.tsx
import { motion } from 'framer-motion';

interface Collaborator {
  userId: string;
  name: string;
  color: string;
  cursor: { x: number; y: number };
}

export function CollaboratorCursors({
  collaborators,
}: {
  collaborators: Collaborator[];
}) {
  return (
    <>
      {collaborators.map((collaborator) => (
        <motion.div
          key={collaborator.userId}
          className="absolute pointer-events-none z-50"
          animate={{
            x: collaborator.cursor.x,
            y: collaborator.cursor.y,
          }}
          transition={{ type: 'spring', damping: 30, stiffness: 200 }}
        >
          {/* Cursor */}
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill={collaborator.color}
          >
            <path d="M0 0 L20 8 L8 8 L8 20 Z" />
          </svg>

          {/* Name tag */}
          <div
            className="mt-1 px-2 py-0.5 rounded text-xs text-white whitespace-nowrap"
            style={{ backgroundColor: collaborator.color }}
          >
            {collaborator.name}
          </div>
        </motion.div>
      ))}
    </>
  );
}
```

---

## Semantic Zoom (Phase-Level Grouping)

```tsx
// components/canvas/SemanticZoom.tsx
import { useEffect } from 'react';
import { useReactFlow, useViewport } from '@xyflow/react';
import { useCanvasStore } from '@/stores/canvas';

export function useSemanticZoom() {
  const { zoom } = useViewport();
  const { setNodes } = useCanvasStore();

  useEffect(() => {
    // At low zoom levels, collapse nodes into groups
    if (zoom < 0.3) {
      setNodes((nodes) =>
        nodes.map((node) => ({
          ...node,
          hidden: node.type !== 'group',
        }))
      );
    }
    // At medium zoom, show all nodes
    else if (zoom < 0.7) {
      setNodes((nodes) =>
        nodes.map((node) => ({
          ...node,
          hidden: false,
          // Simplify node display
          data: {
            ...node.data,
            showDetails: false,
          },
        }))
      );
    }
    // At high zoom, show full details
    else {
      setNodes((nodes) =>
        nodes.map((node) => ({
          ...node,
          hidden: false,
          data: {
            ...node.data,
            showDetails: true,
          },
        }))
      );
    }
  }, [zoom, setNodes]);
}
```

---

## Theme & Styling

```css
/* styles/canvas.css */

/* Node animations */
@keyframes pulse-ring {
  0% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.5);
  }
  100% {
    box-shadow: 0 0 0 8px rgba(59, 130, 246, 0);
  }
}

.node-running {
  animation: pulse-ring 1.5s infinite;
}

/* Edge animations */
.react-flow__edge-path {
  stroke-dasharray: 5;
  animation: dash 0.5s linear infinite;
}

@keyframes dash {
  to {
    stroke-dashoffset: -10;
  }
}

/* Cursor trail effect */
.cursor-trail {
  position: absolute;
  pointer-events: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  opacity: 0;
  animation: trail 0.3s ease-out;
}

@keyframes trail {
  from {
    opacity: 0.6;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(2);
  }
}
```

---

## Next: API_SPEC.md

Continue to the API specification for the backend endpoints.
