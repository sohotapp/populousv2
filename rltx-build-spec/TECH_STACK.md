# RLTX Tech Stack - Open Source Components & APIs

## Complete Technology Selection

---

## Frontend Stack

### Core Framework

```bash
# Create Next.js 14 app with TypeScript
npx create-next-app@latest rltx-app --typescript --tailwind --eslint --app --src-dir
```

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 14.x | React framework with App Router |
| `react` | 18.x | UI library |
| `typescript` | 5.x | Type safety |

### Canvas/Node Editor (Figma-Style)

**Primary: ReactFlow v12 (@xyflow/react)**

```bash
npm install @xyflow/react
```

ReactFlow is the industry standard for node-based editors. Used by:
- n8n (workflow automation)
- LangFlow (LLM pipelines)
- Flowise (no-code LLM apps)

**Key Features:**
- Infinite canvas with pan/zoom
- Custom node types
- Connection validation
- Minimap
- Background grid
- Undo/redo support
- Export to image

```typescript
// Example: Custom Primitive Node
import { Handle, Position, NodeProps } from '@xyflow/react';

function PrimitiveNode({ data, selected }: NodeProps) {
  return (
    <div className={`
      bg-white rounded-lg border-2 shadow-lg p-4 min-w-[200px]
      ${selected ? 'border-blue-500' : 'border-gray-200'}
      ${data.state === 'running' ? 'animate-pulse' : ''}
    `}>
      <Handle type="target" position={Position.Top} />

      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{data.icon}</span>
        <span className="font-medium">{data.name}</span>
      </div>

      <div className="text-sm text-gray-500">
        {data.description}
      </div>

      {data.state === 'completed' && (
        <div className="mt-2 text-xs text-green-600">
          ✓ {data.timing?.durationMs}ms
        </div>
      )}

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
```

### UI Component Library

**Primary: Radix UI + Tailwind**

```bash
npm install @radix-ui/themes @radix-ui/react-dialog @radix-ui/react-dropdown-menu
npm install tailwindcss-animate class-variance-authority clsx tailwind-merge
```

**Alternative: shadcn/ui (built on Radix)**

```bash
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card dialog dropdown-menu input select tabs
```

### State Management

**Zustand** - Simple, fast, TypeScript-friendly

```bash
npm install zustand
```

```typescript
// stores/canvas.ts
import { create } from 'zustand';

interface CanvasStore {
  nodes: Node[];
  edges: Edge[];
  selectedNodes: string[];

  // Actions
  addNode: (node: Node) => void;
  updateNode: (id: string, data: Partial<Node>) => void;
  deleteNode: (id: string) => void;
  setSelection: (ids: string[]) => void;
}

export const useCanvasStore = create<CanvasStore>((set) => ({
  nodes: [],
  edges: [],
  selectedNodes: [],

  addNode: (node) => set((state) => ({
    nodes: [...state.nodes, node]
  })),

  updateNode: (id, data) => set((state) => ({
    nodes: state.nodes.map(n =>
      n.id === id ? { ...n, ...data } : n
    )
  })),

  deleteNode: (id) => set((state) => ({
    nodes: state.nodes.filter(n => n.id !== id),
    edges: state.edges.filter(e =>
      e.source !== id && e.target !== id
    )
  })),

  setSelection: (ids) => set({ selectedNodes: ids }),
}));
```

### Data Fetching

**TanStack Query (React Query)**

```bash
npm install @tanstack/react-query
```

### Real-Time Communication

**Socket.io Client**

```bash
npm install socket.io-client
```

### Charts & Visualization

**Recharts** - React-native charts

```bash
npm install recharts
```

**D3.js** - For custom visualizations (distributions, tornado charts)

```bash
npm install d3 @types/d3
```

### Code Editor (for power users)

**CodeMirror 6**

```bash
npm install @uiw/react-codemirror @codemirror/lang-json @codemirror/lang-python
```

### Animation

**Framer Motion**

```bash
npm install framer-motion
```

### Additional UI Libraries

```bash
# Date handling
npm install date-fns

# Icons
npm install lucide-react

# Toast notifications
npm install sonner

# Form validation
npm install zod react-hook-form @hookform/resolvers

# Markdown rendering
npm install react-markdown remark-gfm

# PDF generation
npm install @react-pdf/renderer
```

---

## Backend Stack

### API Framework

**Option A: Next.js API Routes (simpler)**

Already included with Next.js. Good for MVP.

**Option B: Hono.js (faster, more flexible)**

```bash
npm install hono @hono/node-server
```

Hono is ultrafast and works great with:
- Cloudflare Workers
- Vercel Edge
- Node.js

### Database ORM

**Drizzle ORM** - TypeScript-first, fast

```bash
npm install drizzle-orm postgres
npm install -D drizzle-kit
```

```typescript
// db/schema.ts
import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const workflows = pgTable('workflows', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  question: text('question').notNull(),
  graph: jsonb('graph').notNull(),
  status: text('status').notNull().default('draft'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  userId: uuid('user_id').notNull(),
  orgId: uuid('org_id').notNull(),
});

export const executions = pgTable('executions', {
  id: uuid('id').primaryKey().defaultRandom(),
  workflowId: uuid('workflow_id').references(() => workflows.id),
  status: text('status').notNull(),
  results: jsonb('results'),
  startedAt: timestamp('started_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});
```

### Workflow Orchestration

**Option A: Temporal.io** (production-grade)

```bash
npm install @temporalio/client @temporalio/worker @temporalio/workflow
```

Temporal provides:
- Durable execution (survives crashes)
- Automatic retries
- Long-running workflows
- Human-in-the-loop support

**Option B: Inngest** (serverless-friendly)

```bash
npm install inngest
```

Simpler than Temporal, works great with Vercel.

### Serverless Compute

**Modal.com** - For GPU compute (simulations)

```bash
pip install modal
```

```python
# modal_functions.py
import modal

app = modal.App("rltx-compute")

@app.function(gpu="T4", timeout=300)
def run_monte_carlo(params: dict) -> dict:
    import numpy as np

    n_rollouts = params.get('rollouts', 10000)
    # ... simulation logic
    return {
        'mean': float(np.mean(results)),
        'std': float(np.std(results)),
        'percentiles': {...}
    }
```

### Real-Time Server

**Socket.io Server**

```bash
npm install socket.io
```

```typescript
// server/socket.ts
import { Server } from 'socket.io';

export function setupSocketServer(httpServer: any) {
  const io = new Server(httpServer, {
    cors: { origin: process.env.FRONTEND_URL }
  });

  io.on('connection', (socket) => {
    // Join workflow room
    socket.on('workflow:join', (workflowId) => {
      socket.join(`workflow:${workflowId}`);
    });

    // Broadcast canvas updates
    socket.on('canvas:update', (data) => {
      socket.to(`workflow:${data.workflowId}`).emit('canvas:update', data);
    });

    // Broadcast cursor position (collaboration)
    socket.on('canvas:cursor', (data) => {
      socket.to(`workflow:${data.workflowId}`).emit('canvas:cursor', {
        userId: socket.data.userId,
        ...data
      });
    });
  });

  return io;
}
```

### Background Jobs

**BullMQ** (Redis-based queues)

```bash
npm install bullmq
```

```typescript
// jobs/execution.ts
import { Queue, Worker } from 'bullmq';

export const executionQueue = new Queue('execution', {
  connection: { host: 'localhost', port: 6379 }
});

const worker = new Worker('execution', async (job) => {
  const { workflowId, executionId } = job.data;
  // Execute workflow nodes...
}, { connection: { host: 'localhost', port: 6379 } });
```

---

## AI/ML Stack

### LLM APIs

**Claude API (Primary)**

```bash
npm install @anthropic-ai/sdk
```

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

async function analyzeStrategicFit(context: string) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `Analyze the strategic fit: ${context}`
    }]
  });

  return response.content[0].text;
}
```

**OpenAI API (Backup/Embeddings)**

```bash
npm install openai
```

### LLM Orchestration

**LangChain.js**

```bash
npm install langchain @langchain/anthropic @langchain/openai
```

**LangGraph.js** (for complex workflows)

```bash
npm install @langchain/langgraph
```

### Vector Database

**Pinecone** (Managed)

```bash
npm install @pinecone-database/pinecone
```

**Alternative: Weaviate** (Self-hosted option)

```bash
npm install weaviate-ts-client
```

### Embeddings

```typescript
import { OpenAIEmbeddings } from '@langchain/openai';

const embeddings = new OpenAIEmbeddings({
  modelName: 'text-embedding-3-small'
});

// Embed a workflow template for similarity search
const vector = await embeddings.embedQuery(
  'M&A acquisition evaluation with competitor response modeling'
);
```

---

## Database Stack

### PostgreSQL

**Neon.tech** (Serverless Postgres)

```bash
npm install @neondatabase/serverless
```

Features:
- Serverless scaling
- Branching (dev/staging)
- Connection pooling built-in

### Redis

**Upstash** (Serverless Redis)

```bash
npm install @upstash/redis
```

### Graph Database

**Neo4j AuraDB** (For ontology)

```bash
npm install neo4j-driver
```

```typescript
import neo4j from 'neo4j-driver';

const driver = neo4j.driver(
  process.env.NEO4J_URI!,
  neo4j.auth.basic(process.env.NEO4J_USER!, process.env.NEO4J_PASSWORD!)
);

// Query ontology
async function getCompanyRelationships(companyId: string) {
  const session = driver.session();
  const result = await session.run(
    `MATCH (c:Company {id: $id})-[r]->(related)
     RETURN type(r) as relationship, related`,
    { id: companyId }
  );
  return result.records;
}
```

---

## Auth & Security

### Authentication

**Clerk** (Full-featured auth)

```bash
npm install @clerk/nextjs
```

Features:
- Social login (Google, Microsoft)
- SSO/SAML for enterprise
- Organizations/teams
- User management UI

```typescript
// middleware.ts
import { clerkMiddleware } from '@clerk/nextjs/server';

export default clerkMiddleware();

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
```

### Rate Limiting

**Upstash Ratelimit**

```bash
npm install @upstash/ratelimit
```

---

## File Storage

### Object Storage

**Cloudflare R2** (S3-compatible, no egress fees)

```bash
npm install @aws-sdk/client-s3
```

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY!,
    secretAccessKey: process.env.R2_SECRET_KEY!,
  },
});
```

---

## External Data APIs

### Web Scraping

**Firecrawl** (AI-powered scraping)

```bash
npm install @mendable/firecrawl-js
```

```typescript
import FirecrawlApp from '@mendable/firecrawl-js';

const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_KEY });

const result = await firecrawl.scrapeUrl('https://targetcompany.com', {
  pageOptions: { onlyMainContent: true }
});
```

### CRM Data

**Salesforce API**

```bash
npm install jsforce
```

### Market Data

**Alpha Vantage** (Free tier available)

```bash
npm install alphavantage
```

**Polygon.io** (Real-time market data)

```bash
npm install @polygon.io/client-js
```

### News

**NewsAPI**

```bash
npm install newsapi
```

---

## Monitoring & Observability

### Error Tracking

**Sentry**

```bash
npm install @sentry/nextjs
```

### Analytics

**PostHog** (Open source, self-hostable)

```bash
npm install posthog-js posthog-node
```

### Logging

**Axiom** (or Logtail)

```bash
npm install @axiomhq/js
```

---

## Development Tools

```bash
# Linting & Formatting
npm install -D eslint prettier eslint-config-prettier

# Testing
npm install -D vitest @testing-library/react @playwright/test

# Type checking
npm install -D typescript @types/node @types/react

# Development
npm install -D tsx dotenv
```

---

## Complete package.json

```json
{
  "name": "rltx-decision-compiler",
  "version": "0.1.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint . --ext .ts,.tsx",
    "db:push": "drizzle-kit push:pg",
    "db:studio": "drizzle-kit studio"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",

    "@xyflow/react": "^12.0.0",
    "@radix-ui/themes": "^3.0.0",
    "zustand": "^4.5.0",
    "@tanstack/react-query": "^5.0.0",
    "framer-motion": "^11.0.0",
    "lucide-react": "^0.300.0",
    "sonner": "^1.3.0",
    "recharts": "^2.10.0",
    "date-fns": "^3.0.0",
    "zod": "^3.22.0",
    "react-hook-form": "^7.49.0",

    "drizzle-orm": "^0.29.0",
    "postgres": "^3.4.0",
    "@neondatabase/serverless": "^0.7.0",
    "@upstash/redis": "^1.28.0",
    "@upstash/ratelimit": "^1.0.0",

    "@anthropic-ai/sdk": "^0.16.0",
    "openai": "^4.24.0",
    "@pinecone-database/pinecone": "^2.0.0",
    "langchain": "^0.1.0",
    "@langchain/anthropic": "^0.1.0",

    "@clerk/nextjs": "^4.29.0",
    "socket.io-client": "^4.7.0",
    "bullmq": "^5.0.0",

    "@aws-sdk/client-s3": "^3.400.0",
    "@mendable/firecrawl-js": "^0.0.20"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^20.10.0",
    "@types/react": "^18.2.0",
    "drizzle-kit": "^0.20.0",
    "eslint": "^8.56.0",
    "vitest": "^1.2.0"
  }
}
```

---

## Environment Variables

```bash
# .env.local

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://default:pass@host:6379

# Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# AI
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=...
PINECONE_ENVIRONMENT=...

# Storage
CF_ACCOUNT_ID=...
R2_ACCESS_KEY=...
R2_SECRET_KEY=...

# External APIs
FIRECRAWL_API_KEY=...
SALESFORCE_CLIENT_ID=...
SALESFORCE_CLIENT_SECRET=...
```
