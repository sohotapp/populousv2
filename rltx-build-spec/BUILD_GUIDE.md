# RLTX End-to-End Build Guide

## Complete Implementation from Zero to Production

---

## Prerequisites

Before starting, ensure you have:

```bash
# Required tools
node --version    # v20.x or higher
npm --version     # v10.x or higher
git --version     # v2.x or higher

# Optional but recommended
pnpm --version    # v8.x (faster than npm)
```

### Accounts Needed

| Service | Purpose | Sign Up |
|---------|---------|---------|
| **Vercel** | Hosting | https://vercel.com |
| **Clerk** | Authentication | https://clerk.com |
| **Neon** | PostgreSQL | https://neon.tech |
| **Upstash** | Redis | https://upstash.com |
| **Anthropic** | Claude API | https://console.anthropic.com |
| **Pinecone** | Vector DB | https://pinecone.io |
| **Modal** | GPU Compute | https://modal.com |
| **Cloudflare** | R2 Storage | https://cloudflare.com |

---

## Step 1: Project Initialization

### 1.1 Create Next.js Project

```bash
# Create the project
npx create-next-app@latest rltx-app \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

cd rltx-app
```

### 1.2 Install Dependencies

```bash
# Core UI & Framework
npm install @xyflow/react zustand @tanstack/react-query framer-motion

# UI Components (Radix + shadcn)
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu \
  @radix-ui/react-tabs @radix-ui/react-tooltip @radix-ui/react-popover \
  @radix-ui/react-select @radix-ui/react-slider @radix-ui/react-switch
npm install lucide-react sonner class-variance-authority clsx tailwind-merge

# Forms & Validation
npm install zod react-hook-form @hookform/resolvers

# Database
npm install drizzle-orm postgres @neondatabase/serverless
npm install -D drizzle-kit

# Auth
npm install @clerk/nextjs

# Real-time
npm install socket.io socket.io-client

# AI/LLM
npm install @anthropic-ai/sdk openai @pinecone-database/pinecone
npm install ai  # Vercel AI SDK for streaming

# Redis
npm install @upstash/redis @upstash/ratelimit ioredis

# Storage
npm install @aws-sdk/client-s3

# Charts
npm install recharts

# Utilities
npm install date-fns nanoid

# Dev dependencies
npm install -D @types/node tsx dotenv-cli
```

### 1.3 Project Structure

Create the folder structure:

```bash
mkdir -p src/{app,components,lib,stores,hooks,types,db,server}
mkdir -p src/app/{api,workflow,decisions,pulse}
mkdir -p src/app/api/{workflows,executions,chat,primitives}
mkdir -p src/app/workflow/\[id\]
mkdir -p src/components/{canvas,chat,inspector,results,primitives,ui}
mkdir -p src/components/canvas/nodes
mkdir -p src/lib/{primitives,executor,composer,utils}
mkdir -p src/server
```

---

## Step 2: Configuration Files

### 2.1 Environment Variables

```bash
# Create .env.local
cat > .env.local << 'EOF'
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Database (Neon)
DATABASE_URL=postgresql://user:password@host:5432/rltx?sslmode=require

# Redis (Upstash)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# Auth (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# AI (Anthropic)
ANTHROPIC_API_KEY=sk-ant-xxx

# AI (OpenAI - for embeddings)
OPENAI_API_KEY=sk-xxx

# Vector DB (Pinecone)
PINECONE_API_KEY=xxx
PINECONE_INDEX=rltx-templates

# Storage (Cloudflare R2)
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=rltx-artifacts

# WebSocket Server
SOCKET_SERVER_URL=http://localhost:3001
EOF
```

### 2.2 Tailwind Config

```typescript
// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(59, 130, 246, 0.5)" },
          "100%": { boxShadow: "0 0 0 8px rgba(59, 130, 246, 0)" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 1.5s infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
```

### 2.3 Drizzle Config

```typescript
// drizzle.config.ts
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

### 2.4 Package.json Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "db:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "db:migrate": "tsx src/db/migrate.ts",
    "socket:dev": "tsx watch src/server/socket.ts"
  }
}
```

---

## Step 3: Database Schema

### 3.1 Create Schema

```typescript
// src/db/schema.ts
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  integer,
  real,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============ USERS & ORGS ============

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const orgMembers = pgTable("org_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .references(() => organizations.id)
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  role: text("role").notNull().default("member"), // admin, member, viewer
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============ WORKFLOWS ============

export const workflows = pgTable("workflows", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  question: text("question").notNull(),
  description: text("description"),
  graph: jsonb("graph").notNull().$type<WorkflowGraph>(),
  status: text("status").notNull().default("draft"), // draft, ready, archived
  orgId: uuid("org_id")
    .references(() => organizations.id)
    .notNull(),
  createdBy: uuid("created_by")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const workflowVersions = pgTable("workflow_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: uuid("workflow_id")
    .references(() => workflows.id)
    .notNull(),
  version: integer("version").notNull(),
  graph: jsonb("graph").notNull().$type<WorkflowGraph>(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============ EXECUTIONS ============

export const executions = pgTable("executions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: uuid("workflow_id")
    .references(() => workflows.id)
    .notNull(),
  workflowVersion: integer("workflow_version").notNull(),
  status: text("status").notNull().default("pending"), // pending, running, paused, completed, failed, cancelled
  nodeResults: jsonb("node_results").$type<Record<string, NodeResult>>(),
  results: jsonb("results").$type<ExecutionResults>(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  startedBy: uuid("started_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const humanCheckpoints = pgTable("human_checkpoints", {
  id: uuid("id").primaryKey().defaultRandom(),
  executionId: uuid("execution_id")
    .references(() => executions.id)
    .notNull(),
  nodeId: text("node_id").notNull(),
  type: text("type").notNull(), // input, review, approve, override
  request: jsonb("request").notNull().$type<HumanRequest>(),
  response: jsonb("response").$type<any>(),
  status: text("status").notNull().default("pending"), // pending, completed, timed_out
  respondedBy: uuid("responded_by").references(() => users.id),
  respondedAt: timestamp("responded_at"),
  timeoutAt: timestamp("timeout_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============ TEMPLATES ============

export const templates = pgTable("templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(), // m-and-a, pricing, market-entry, hiring, capital
  tags: jsonb("tags").$type<string[]>().default([]),
  graph: jsonb("graph").notNull().$type<WorkflowGraph>(),
  isPublic: boolean("is_public").default(false),
  usageCount: integer("usage_count").default(0),
  orgId: uuid("org_id").references(() => organizations.id),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============ TRIPWIRES ============

export const tripwires = pgTable("tripwires", {
  id: uuid("id").primaryKey().defaultRandom(),
  executionId: uuid("execution_id")
    .references(() => executions.id)
    .notNull(),
  name: text("name").notNull(),
  condition: jsonb("condition").notNull().$type<TripwireCondition>(),
  dataSource: jsonb("data_source").notNull().$type<DataSource>(),
  action: text("action").notNull(), // re_evaluate, alert, pause
  status: text("status").notNull().default("active"), // active, triggered, resolved, expired
  currentValue: jsonb("current_value"),
  triggeredAt: timestamp("triggered_at"),
  resolvedAt: timestamp("resolved_at"),
  notifications: jsonb("notifications").$type<NotificationConfig>(),
  orgId: uuid("org_id")
    .references(() => organizations.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============ OUTCOMES & LEARNING ============

export const outcomes = pgTable("outcomes", {
  id: uuid("id").primaryKey().defaultRandom(),
  executionId: uuid("execution_id")
    .references(() => executions.id)
    .notNull(),
  outcomes: jsonb("outcomes").notNull().$type<OutcomeRecord[]>(),
  assumptions: jsonb("assumptions").$type<AssumptionRecord[]>(),
  recordedBy: text("recorded_by").notNull(), // tripwire, manual, integration
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const calibration = pgTable("calibration", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .references(() => organizations.id)
    .notNull(),
  calibrationCurve: jsonb("calibration_curve").$type<Record<string, number>>(),
  decisionCount: integer("decision_count").default(0),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

// ============ CONVERSATIONS ============

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: uuid("workflow_id").references(() => workflows.id),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  messages: jsonb("messages").$type<ChatMessage[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============ TYPES ============

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface WorkflowNode {
  id: string;
  type: "primitive" | "group";
  primitiveId: string;
  position: { x: number; y: number };
  config: Record<string, any>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
  transform?: string;
}

export interface NodeResult {
  state: "pending" | "running" | "completed" | "failed";
  output?: any;
  error?: string;
  timing?: {
    startedAt: string;
    completedAt: string;
    durationMs: number;
  };
}

export interface ExecutionResults {
  recommendation: {
    action: string;
    confidence: number;
    reasoning: string;
  };
  frontier?: {
    points: any[];
    recommended: string;
  };
  drivers: any[];
  assumptions: any[];
  minorityView?: {
    argument: string;
    confidence: number;
  };
}

export interface HumanRequest {
  title: string;
  description: string;
  fields: {
    id: string;
    name: string;
    type: string;
    required: boolean;
    default?: any;
    options?: any[];
  }[];
}

export interface TripwireCondition {
  variable: string;
  operator: "lt" | "gt" | "eq" | "change_by";
  threshold: number | string;
}

export interface DataSource {
  type: "api" | "manual" | "integration";
  endpoint?: string;
  refreshInterval?: string;
}

export interface NotificationConfig {
  channels: string[];
  recipients: string[];
}

export interface OutcomeRecord {
  variable: string;
  actual: number;
  predicted: { mean: number; ci95: [number, number] };
  withinCI: boolean;
}

export interface AssumptionRecord {
  statement: string;
  held: boolean;
  notes?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  workflow?: WorkflowGraph;
  timestamp: string;
}
```

### 3.2 Database Client

```typescript
// src/db/index.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client, { schema });

export * from "./schema";
```

### 3.3 Push Schema

```bash
# Push schema to database
npm run db:push
```

---

## Step 4: Authentication Setup

### 4.1 Clerk Middleware

```typescript
// src/middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

### 4.2 Clerk Provider

```typescript
// src/app/layout.tsx
import { ClerkProvider } from "@clerk/nextjs";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>{children}</body>
      </html>
    </ClerkProvider>
  );
}
```

---

## Step 5: Core Components

### 5.1 UI Components (shadcn-style)

```typescript
// src/lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

```typescript
// src/components/ui/button.tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

### 5.2 Primitive Definitions

```typescript
// src/lib/primitives/index.ts
export interface Primitive {
  id: string;
  name: string;
  description: string;
  category: "data" | "reason" | "simulate" | "optimize" | "human" | "output" | "control";
  icon: string;
  color: string;
  inputs: Port[];
  outputs: Port[];
  config: ConfigSchema;
  executor: "llm" | "compute" | "external" | "human" | "internal";
  estimatedCost: { dollars: number };
  estimatedTime: { p50: number; p95: number };
}

export interface Port {
  id: string;
  name: string;
  type: "any" | "string" | "number" | "object" | "array" | "distribution";
  required: boolean;
}

export interface ConfigSchema {
  type: "object";
  properties: Record<string, any>;
  required?: string[];
}

export const primitives: Record<string, Primitive> = {
  // ========== DATA ==========
  "data.api.fetch": {
    id: "data.api.fetch",
    name: "API Fetch",
    description: "Fetch data from REST API",
    category: "data",
    icon: "🔗",
    color: "#3b82f6",
    inputs: [],
    outputs: [{ id: "response", name: "Response", type: "object", required: true }],
    config: {
      type: "object",
      properties: {
        url: { type: "string", title: "URL" },
        method: { type: "string", enum: ["GET", "POST"], default: "GET" },
        headers: { type: "object", title: "Headers" },
        body: { type: "object", title: "Body" },
      },
      required: ["url"],
    },
    executor: "external",
    estimatedCost: { dollars: 0.01 },
    estimatedTime: { p50: 1000, p95: 5000 },
  },

  "data.doc.parse": {
    id: "data.doc.parse",
    name: "Parse Document",
    description: "Extract structured data from PDF/DOCX",
    category: "data",
    icon: "📄",
    color: "#3b82f6",
    inputs: [{ id: "file", name: "File", type: "string", required: true }],
    outputs: [{ id: "content", name: "Content", type: "object", required: true }],
    config: {
      type: "object",
      properties: {
        extractTables: { type: "boolean", default: true },
        extractImages: { type: "boolean", default: false },
      },
    },
    executor: "llm",
    estimatedCost: { dollars: 0.50 },
    estimatedTime: { p50: 5000, p95: 15000 },
  },

  // ========== REASON ==========
  "reason.analyze": {
    id: "reason.analyze",
    name: "Deep Analysis",
    description: "Use Claude for complex reasoning",
    category: "reason",
    icon: "🧠",
    color: "#8b5cf6",
    inputs: [
      { id: "data", name: "Data", type: "any", required: true },
      { id: "context", name: "Context", type: "string", required: false },
    ],
    outputs: [{ id: "analysis", name: "Analysis", type: "object", required: true }],
    config: {
      type: "object",
      properties: {
        prompt: { type: "string", title: "Custom Prompt" },
        focus: { type: "string", title: "Focus Area" },
        model: {
          type: "string",
          enum: ["claude-3-opus", "claude-3-sonnet"],
          default: "claude-3-sonnet",
        },
      },
    },
    executor: "llm",
    estimatedCost: { dollars: 2.50 },
    estimatedTime: { p50: 15000, p95: 45000 },
  },

  "reason.compare": {
    id: "reason.compare",
    name: "Compare Options",
    description: "Compare multiple options with pros/cons",
    category: "reason",
    icon: "⚖️",
    color: "#8b5cf6",
    inputs: [{ id: "options", name: "Options", type: "array", required: true }],
    outputs: [{ id: "comparison", name: "Comparison", type: "object", required: true }],
    config: {
      type: "object",
      properties: {
        criteria: { type: "array", items: { type: "string" }, title: "Criteria" },
        weights: { type: "object", title: "Weights" },
      },
    },
    executor: "llm",
    estimatedCost: { dollars: 1.50 },
    estimatedTime: { p50: 10000, p95: 30000 },
  },

  "reason.critique": {
    id: "reason.critique",
    name: "Pre-Mortem",
    description: "Analyze what could go wrong",
    category: "reason",
    icon: "🔍",
    color: "#ef4444",
    inputs: [{ id: "plan", name: "Plan", type: "object", required: true }],
    outputs: [{ id: "critique", name: "Critique", type: "object", required: true }],
    config: {
      type: "object",
      properties: {
        perspective: {
          type: "string",
          enum: ["skeptic", "competitor", "regulator", "customer"],
          default: "skeptic",
        },
        depth: { type: "string", enum: ["quick", "thorough"], default: "thorough" },
      },
    },
    executor: "llm",
    estimatedCost: { dollars: 2.00 },
    estimatedTime: { p50: 12000, p95: 35000 },
  },

  "reason.steelman": {
    id: "reason.steelman",
    name: "Steelman",
    description: "Build the strongest case for an option",
    category: "reason",
    icon: "💪",
    color: "#22c55e",
    inputs: [{ id: "option", name: "Option", type: "object", required: true }],
    outputs: [{ id: "case", name: "Case", type: "object", required: true }],
    config: {
      type: "object",
      properties: {
        audience: { type: "string", title: "Target Audience" },
      },
    },
    executor: "llm",
    estimatedCost: { dollars: 1.50 },
    estimatedTime: { p50: 10000, p95: 25000 },
  },

  // ========== SIMULATE ==========
  "sim.montecarlo": {
    id: "sim.montecarlo",
    name: "Monte Carlo",
    description: "Run probabilistic simulations",
    category: "simulate",
    icon: "🎲",
    color: "#f59e0b",
    inputs: [
      { id: "model", name: "Model", type: "object", required: true },
      { id: "distributions", name: "Distributions", type: "object", required: true },
    ],
    outputs: [{ id: "results", name: "Results", type: "distribution", required: true }],
    config: {
      type: "object",
      properties: {
        rollouts: { type: "number", default: 10000, minimum: 100, maximum: 100000 },
        timeHorizon: { type: "number", default: 5, title: "Years" },
        confidenceInterval: { type: "number", default: 0.95 },
      },
    },
    executor: "compute",
    estimatedCost: { dollars: 3.00 },
    estimatedTime: { p50: 30000, p95: 90000 },
  },

  "sim.scenario": {
    id: "sim.scenario",
    name: "Scenario Analysis",
    description: "Evaluate multiple scenarios",
    category: "simulate",
    icon: "🌳",
    color: "#f59e0b",
    inputs: [{ id: "baseCase", name: "Base Case", type: "object", required: true }],
    outputs: [{ id: "scenarios", name: "Scenarios", type: "array", required: true }],
    config: {
      type: "object",
      properties: {
        scenarioCount: { type: "number", default: 3 },
        includeBlackSwan: { type: "boolean", default: true },
      },
    },
    executor: "llm",
    estimatedCost: { dollars: 2.00 },
    estimatedTime: { p50: 15000, p95: 40000 },
  },

  "sim.sensitivity": {
    id: "sim.sensitivity",
    name: "Sensitivity Analysis",
    description: "Find key drivers of outcomes",
    category: "simulate",
    icon: "📊",
    color: "#f59e0b",
    inputs: [{ id: "model", name: "Model", type: "object", required: true }],
    outputs: [{ id: "sensitivity", name: "Sensitivity", type: "object", required: true }],
    config: {
      type: "object",
      properties: {
        variables: { type: "array", items: { type: "string" } },
        range: { type: "number", default: 0.2, title: "Range (±%)" },
      },
    },
    executor: "compute",
    estimatedCost: { dollars: 1.00 },
    estimatedTime: { p50: 10000, p95: 25000 },
  },

  // ========== OPTIMIZE ==========
  "opt.pareto": {
    id: "opt.pareto",
    name: "Pareto Frontier",
    description: "Find optimal trade-offs",
    category: "optimize",
    icon: "📈",
    color: "#06b6d4",
    inputs: [{ id: "options", name: "Options", type: "array", required: true }],
    outputs: [{ id: "frontier", name: "Frontier", type: "object", required: true }],
    config: {
      type: "object",
      properties: {
        objectives: { type: "array", items: { type: "string" }, title: "Objectives" },
        constraints: { type: "array", items: { type: "object" }, title: "Constraints" },
      },
    },
    executor: "compute",
    estimatedCost: { dollars: 0.50 },
    estimatedTime: { p50: 5000, p95: 15000 },
  },

  // ========== HUMAN ==========
  "human.input": {
    id: "human.input",
    name: "Human Input",
    description: "Collect input from user",
    category: "human",
    icon: "✋",
    color: "#ec4899",
    inputs: [],
    outputs: [{ id: "response", name: "Response", type: "any", required: true }],
    config: {
      type: "object",
      properties: {
        title: { type: "string", title: "Title" },
        description: { type: "string", title: "Description" },
        fields: { type: "array", title: "Fields" },
        timeout: { type: "number", default: 86400, title: "Timeout (seconds)" },
      },
    },
    executor: "human",
    estimatedCost: { dollars: 0 },
    estimatedTime: { p50: 3600000, p95: 86400000 },
  },

  "human.approve": {
    id: "human.approve",
    name: "Approval Gate",
    description: "Require human approval to continue",
    category: "human",
    icon: "✅",
    color: "#ec4899",
    inputs: [{ id: "summary", name: "Summary", type: "object", required: true }],
    outputs: [{ id: "approved", name: "Approved", type: "boolean", required: true }],
    config: {
      type: "object",
      properties: {
        title: { type: "string", title: "Title" },
        approvers: { type: "array", items: { type: "string" }, title: "Approvers" },
        timeout: { type: "number", default: 86400 },
        autoAction: { type: "string", enum: ["approve", "reject", "escalate"] },
      },
    },
    executor: "human",
    estimatedCost: { dollars: 0 },
    estimatedTime: { p50: 1800000, p95: 86400000 },
  },

  // ========== OUTPUT ==========
  "output.report": {
    id: "output.report",
    name: "Evidence Pack",
    description: "Generate board-ready report",
    category: "output",
    icon: "📋",
    color: "#22c55e",
    inputs: [
      { id: "recommendation", name: "Recommendation", type: "object", required: true },
      { id: "evidence", name: "Evidence", type: "array", required: true },
    ],
    outputs: [{ id: "report", name: "Report", type: "object", required: true }],
    config: {
      type: "object",
      properties: {
        format: { type: "string", enum: ["pdf", "markdown", "docx"], default: "pdf" },
        template: { type: "string", enum: ["executive", "detailed", "technical"] },
        includeMinorityView: { type: "boolean", default: true },
      },
    },
    executor: "llm",
    estimatedCost: { dollars: 1.00 },
    estimatedTime: { p50: 20000, p95: 60000 },
  },

  "output.recommendation": {
    id: "output.recommendation",
    name: "Recommendation",
    description: "Generate final recommendation",
    category: "output",
    icon: "🎯",
    color: "#22c55e",
    inputs: [{ id: "analysis", name: "Analysis", type: "object", required: true }],
    outputs: [{ id: "recommendation", name: "Recommendation", type: "object", required: true }],
    config: {
      type: "object",
      properties: {
        format: { type: "string", enum: ["bluf", "detailed"], default: "bluf" },
        includeConfidence: { type: "boolean", default: true },
        includeTripwires: { type: "boolean", default: true },
      },
    },
    executor: "llm",
    estimatedCost: { dollars: 0.50 },
    estimatedTime: { p50: 8000, p95: 20000 },
  },

  // ========== CONTROL ==========
  "control.condition": {
    id: "control.condition",
    name: "Condition",
    description: "Branch based on condition",
    category: "control",
    icon: "🔀",
    color: "#6b7280",
    inputs: [{ id: "value", name: "Value", type: "any", required: true }],
    outputs: [
      { id: "true", name: "True", type: "any", required: false },
      { id: "false", name: "False", type: "any", required: false },
    ],
    config: {
      type: "object",
      properties: {
        condition: { type: "string", title: "Condition (JS expression)" },
      },
    },
    executor: "internal",
    estimatedCost: { dollars: 0 },
    estimatedTime: { p50: 10, p95: 50 },
  },

  "control.merge": {
    id: "control.merge",
    name: "Merge",
    description: "Combine multiple inputs",
    category: "control",
    icon: "🔗",
    color: "#6b7280",
    inputs: [
      { id: "input1", name: "Input 1", type: "any", required: true },
      { id: "input2", name: "Input 2", type: "any", required: false },
      { id: "input3", name: "Input 3", type: "any", required: false },
    ],
    outputs: [{ id: "merged", name: "Merged", type: "object", required: true }],
    config: {
      type: "object",
      properties: {
        strategy: { type: "string", enum: ["object", "array", "concat"], default: "object" },
      },
    },
    executor: "internal",
    estimatedCost: { dollars: 0 },
    estimatedTime: { p50: 10, p95: 50 },
  },
};

export function getPrimitivesByCategory() {
  const categories: Record<string, Primitive[]> = {};

  Object.values(primitives).forEach((p) => {
    if (!categories[p.category]) {
      categories[p.category] = [];
    }
    categories[p.category].push(p);
  });

  return categories;
}
```

---

## Step 6: Canvas Components

### 6.1 Canvas Store

```typescript
// src/stores/canvas.ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  Connection,
  addEdge,
} from "@xyflow/react";

export interface CanvasState {
  // State
  workflowId: string | null;
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  isExecuting: boolean;
  executionId: string | null;

  // Actions
  setWorkflowId: (id: string) => void;
  setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (node: Node) => void;
  updateNodeData: (nodeId: string, data: Partial<any>) => void;
  setSelectedNode: (nodeId: string | null) => void;
  deleteSelected: () => void;

  // Execution
  startExecution: (executionId: string) => void;
  updateNodeState: (nodeId: string, state: string, output?: any) => void;
  completeExecution: () => void;

  // Persistence
  loadWorkflow: (graph: { nodes: Node[]; edges: Edge[] }) => void;
  getGraph: () => { nodes: Node[]; edges: Edge[] };
}

export const useCanvasStore = create<CanvasState>()(
  immer((set, get) => ({
    workflowId: null,
    nodes: [],
    edges: [],
    selectedNodeId: null,
    isExecuting: false,
    executionId: null,

    setWorkflowId: (id) =>
      set((state) => {
        state.workflowId = id;
      }),

    setNodes: (nodesOrUpdater) =>
      set((state) => {
        state.nodes =
          typeof nodesOrUpdater === "function"
            ? nodesOrUpdater(state.nodes)
            : nodesOrUpdater;
      }),

    setEdges: (edgesOrUpdater) =>
      set((state) => {
        state.edges =
          typeof edgesOrUpdater === "function"
            ? edgesOrUpdater(state.edges)
            : edgesOrUpdater;
      }),

    onNodesChange: (changes) =>
      set((state) => {
        state.nodes = applyNodeChanges(changes, state.nodes) as Node[];
      }),

    onEdgesChange: (changes) =>
      set((state) => {
        state.edges = applyEdgeChanges(changes, state.edges) as Edge[];
      }),

    onConnect: (connection) =>
      set((state) => {
        state.edges = addEdge(connection, state.edges);
      }),

    addNode: (node) =>
      set((state) => {
        state.nodes.push(node);
      }),

    updateNodeData: (nodeId, data) =>
      set((state) => {
        const node = state.nodes.find((n) => n.id === nodeId);
        if (node) {
          node.data = { ...node.data, ...data };
        }
      }),

    setSelectedNode: (nodeId) =>
      set((state) => {
        state.selectedNodeId = nodeId;
      }),

    deleteSelected: () =>
      set((state) => {
        if (state.selectedNodeId) {
          state.nodes = state.nodes.filter((n) => n.id !== state.selectedNodeId);
          state.edges = state.edges.filter(
            (e) =>
              e.source !== state.selectedNodeId &&
              e.target !== state.selectedNodeId
          );
          state.selectedNodeId = null;
        }
      }),

    startExecution: (executionId) =>
      set((state) => {
        state.isExecuting = true;
        state.executionId = executionId;
        state.nodes.forEach((node) => {
          node.data = { ...node.data, state: "pending" };
        });
      }),

    updateNodeState: (nodeId, nodeState, output) =>
      set((state) => {
        const node = state.nodes.find((n) => n.id === nodeId);
        if (node) {
          node.data = {
            ...node.data,
            state: nodeState,
            ...(output !== undefined && { output }),
          };
        }
      }),

    completeExecution: () =>
      set((state) => {
        state.isExecuting = false;
      }),

    loadWorkflow: (graph) =>
      set((state) => {
        state.nodes = graph.nodes;
        state.edges = graph.edges;
      }),

    getGraph: () => ({
      nodes: get().nodes,
      edges: get().edges,
    }),
  }))
);
```

### 6.2 Main Canvas Component

```typescript
// src/components/canvas/Canvas.tsx
"use client";

import { useCallback, useRef, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useCanvasStore } from "@/stores/canvas";
import { PrimitiveNode } from "./nodes/PrimitiveNode";
import { CanvasToolbar } from "./CanvasToolbar";
import { primitives } from "@/lib/primitives";
import { nanoid } from "nanoid";

const nodeTypes = {
  primitive: PrimitiveNode,
};

function CanvasInner({ workflowId }: { workflowId: string }) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    setSelectedNode,
    selectedNodeId,
  } = useCanvasStore();

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

      const newNode = {
        id: `${primitiveId}-${nanoid(6)}`,
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
    (_: React.MouseEvent, node: any) => {
      setSelectedNode(node.id);
    },
    [setSelectedNode]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

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
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid
        snapGrid={[16, 16]}
        defaultEdgeOptions={{
          animated: true,
          style: { stroke: "#6366f1", strokeWidth: 2 },
        }}
      >
        <Background gap={16} size={1} color="#e5e7eb" />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const state = node.data?.state;
            if (state === "running") return "#3b82f6";
            if (state === "completed") return "#22c55e";
            if (state === "failed") return "#ef4444";
            return "#9ca3af";
          }}
          className="bg-white rounded-lg shadow-lg"
        />

        <Panel position="top-center">
          <CanvasToolbar workflowId={workflowId} />
        </Panel>
      </ReactFlow>
    </div>
  );
}

export function Canvas({ workflowId }: { workflowId: string }) {
  return (
    <ReactFlowProvider>
      <CanvasInner workflowId={workflowId} />
    </ReactFlowProvider>
  );
}
```

### 6.3 Primitive Node Component

```typescript
// src/components/canvas/nodes/PrimitiveNode.tsx
import { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Loader2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/stores/canvas";

interface PrimitiveNodeData {
  primitiveId: string;
  label: string;
  icon: string;
  color: string;
  config: Record<string, any>;
  state: "idle" | "pending" | "running" | "completed" | "failed";
  output?: any;
  error?: string;
}

export const PrimitiveNode = memo(function PrimitiveNode({
  id,
  data,
  selected,
}: NodeProps<PrimitiveNodeData>) {
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const isSelected = selected || selectedNodeId === id;

  const stateStyles = {
    idle: "border-gray-200 bg-white",
    pending: "border-gray-300 bg-gray-50",
    running: "border-blue-500 bg-blue-50 animate-pulse-ring",
    completed: "border-green-500 bg-green-50",
    failed: "border-red-500 bg-red-50",
  };

  const StateIcon = () => {
    switch (data.state) {
      case "running":
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case "completed":
        return <Check className="w-4 h-4 text-green-500" />;
      case "failed":
        return <X className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border-2 shadow-lg min-w-[180px] max-w-[220px] transition-all duration-200",
        stateStyles[data.state],
        isSelected && "ring-2 ring-blue-500 ring-offset-2"
      )}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-gray-400 border-2 border-white"
      />

      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b"
        style={{ borderColor: data.color + "40" }}
      >
        <span className="text-xl">{data.icon}</span>
        <span className="font-medium text-sm truncate flex-1">{data.label}</span>
        <StateIcon />
      </div>

      {/* Body */}
      <div className="px-3 py-2">
        {data.state === "idle" && (
          <div className="text-xs text-gray-400">Click to configure</div>
        )}

        {data.state === "running" && (
          <div className="text-xs text-blue-600">Processing...</div>
        )}

        {data.state === "completed" && (
          <div className="text-xs text-green-600">Complete</div>
        )}

        {data.state === "failed" && (
          <div className="text-xs text-red-600 truncate">{data.error}</div>
        )}
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-gray-400 border-2 border-white"
      />
    </div>
  );
});
```

---

## Step 7: API Routes

### 7.1 Workflows API

```typescript
// src/app/api/workflows/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, workflows } from "@/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

const createWorkflowSchema = z.object({
  question: z.string().min(1),
  name: z.string().optional(),
  graph: z.object({
    nodes: z.array(z.any()),
    edges: z.array(z.any()),
  }).optional(),
});

export async function GET(req: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userWorkflows = await db.query.workflows.findMany({
    where: eq(workflows.orgId, orgId),
    orderBy: desc(workflows.createdAt),
    limit: 50,
  });

  return NextResponse.json({ workflows: userWorkflows });
}

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createWorkflowSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { question, name, graph } = parsed.data;

  // Get user from Clerk ID
  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, userId),
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const [workflow] = await db
    .insert(workflows)
    .values({
      name: name || question.slice(0, 50),
      question,
      graph: graph || { nodes: [], edges: [] },
      orgId,
      createdBy: user.id,
    })
    .returning();

  return NextResponse.json({ workflow });
}
```

### 7.2 Composer API

```typescript
// src/app/api/workflows/compose/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { primitives } from "@/lib/primitives";
import { db, workflows, users } from "@/db";
import { eq } from "drizzle-orm";

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { question, context } = await req.json();

  // Build primitive catalog for the LLM
  const primitiveCatalog = Object.values(primitives)
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      category: p.category,
      inputs: p.inputs.map((i) => `${i.name} (${i.type})`).join(", "),
      outputs: p.outputs.map((o) => `${o.name} (${o.type})`).join(", "),
    }))
    .map((p) => `- ${p.id}: ${p.description} [${p.category}] Inputs: ${p.inputs || "none"} Outputs: ${p.outputs}`)
    .join("\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `You are a decision workflow composer. Given a business question, design an optimal workflow using the available primitives.

## Available Primitives:
${primitiveCatalog}

## User Question:
${question}

${context ? `## Additional Context:\n${context}` : ""}

## Instructions:
1. Analyze the question to understand what kind of decision this is
2. Select appropriate primitives to gather data, analyze, simulate, and generate recommendations
3. Connect them in a logical flow (outputs of one primitive feed into inputs of another)
4. Position nodes in a readable layout (x: 100-800, y: 100-600)

## Output Format (JSON only, no explanation):
{
  "name": "Workflow Name",
  "nodes": [
    {
      "id": "node_1",
      "type": "primitive",
      "primitiveId": "primitive.id.here",
      "position": { "x": 100, "y": 100 },
      "data": {
        "primitiveId": "primitive.id.here",
        "label": "Node Label",
        "icon": "emoji",
        "color": "#hex",
        "config": {},
        "state": "idle"
      }
    }
  ],
  "edges": [
    {
      "id": "edge_1",
      "source": "node_1",
      "sourceHandle": "output_id",
      "target": "node_2",
      "targetHandle": "input_id"
    }
  ]
}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    return NextResponse.json({ error: "Unexpected response" }, { status: 500 });
  }

  // Extract JSON from response
  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return NextResponse.json({ error: "Failed to parse workflow" }, { status: 500 });
  }

  const graph = JSON.parse(jsonMatch[0]);

  // Get user
  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, userId),
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Save workflow
  const [workflow] = await db
    .insert(workflows)
    .values({
      name: graph.name || question.slice(0, 50),
      question,
      graph: { nodes: graph.nodes, edges: graph.edges },
      orgId,
      createdBy: user.id,
    })
    .returning();

  return NextResponse.json({
    workflow,
    explanation: content.text.replace(jsonMatch[0], "").trim(),
  });
}
```

### 7.3 Execution API

```typescript
// src/app/api/executions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, executions, workflows, users } from "@/db";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workflowId } = await req.json();

  // Get workflow
  const workflow = await db.query.workflows.findFirst({
    where: eq(workflows.id, workflowId),
  });

  if (!workflow || workflow.orgId !== orgId) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  // Get user
  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, userId),
  });

  // Create execution
  const [execution] = await db
    .insert(executions)
    .values({
      workflowId,
      workflowVersion: 1,
      status: "pending",
      startedBy: user?.id,
    })
    .returning();

  // TODO: Trigger async execution via Temporal or queue

  return NextResponse.json({ execution });
}
```

---

## Step 8: Main Pages

### 8.1 Home Page (Command)

```typescript
// src/app/page.tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { CommandInterface } from "@/components/command/CommandInterface";

export default async function HomePage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <CommandInterface />
    </main>
  );
}
```

### 8.2 Workflow Page

```typescript
// src/app/workflow/[id]/page.tsx
import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { db, workflows } from "@/db";
import { eq } from "drizzle-orm";
import { Canvas } from "@/components/canvas/Canvas";
import { PrimitiveLibrary } from "@/components/primitives/PrimitiveLibrary";
import { Inspector } from "@/components/inspector/Inspector";
import { WorkflowHeader } from "@/components/workflow/WorkflowHeader";

export default async function WorkflowPage({
  params,
}: {
  params: { id: string };
}) {
  const { userId, orgId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const workflow = await db.query.workflows.findFirst({
    where: eq(workflows.id, params.id),
  });

  if (!workflow || workflow.orgId !== orgId) {
    notFound();
  }

  return (
    <div className="h-screen flex flex-col">
      <WorkflowHeader workflow={workflow} />

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Primitive Library */}
        <div className="w-64 border-r bg-gray-50 overflow-y-auto flex-shrink-0">
          <PrimitiveLibrary />
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 relative">
          <Canvas workflowId={params.id} initialGraph={workflow.graph} />
        </div>

        {/* Right: Inspector */}
        <div className="w-80 border-l bg-white overflow-y-auto flex-shrink-0">
          <Inspector />
        </div>
      </div>
    </div>
  );
}
```

---

## Step 9: Run the Application

### 9.1 Database Setup

```bash
# Push schema to Neon
npm run db:push

# Open Drizzle Studio to view data
npm run db:studio
```

### 9.2 Start Development Server

```bash
# Start Next.js
npm run dev

# In another terminal, start Socket server (if using)
npm run socket:dev
```

### 9.3 Access the App

Open http://localhost:3000

---

## Step 10: Deployment

### 10.1 Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
# Or via CLI:
vercel env add DATABASE_URL
vercel env add CLERK_SECRET_KEY
# ... etc
```

### 10.2 Production Checklist

- [ ] Set all environment variables in Vercel
- [ ] Configure Clerk production keys
- [ ] Set up Neon production database
- [ ] Configure custom domain
- [ ] Enable Vercel Analytics
- [ ] Set up Sentry for error tracking
- [ ] Configure rate limiting
- [ ] Test authentication flows
- [ ] Test workflow execution
- [ ] Load test with multiple users

---

## Next Steps

1. **Add more primitives** - Expand the primitive library
2. **Implement execution engine** - Add Temporal or Inngest
3. **Add real-time collaboration** - Socket.io server
4. **Build results view** - Charts, Pareto frontier
5. **Add tripwire monitoring** - Background jobs
6. **Implement learning** - Track outcomes, calibration

---

## Troubleshooting

### Common Issues

**Database connection fails:**
```bash
# Check DATABASE_URL format
# Must include ?sslmode=require for Neon
```

**Clerk auth not working:**
```bash
# Ensure middleware.ts is in src/ root
# Check publishable key is NEXT_PUBLIC_
```

**ReactFlow not rendering:**
```bash
# Ensure parent has explicit height
# Import the CSS: @xyflow/react/dist/style.css
```

**Canvas drops not working:**
```bash
# Check dataTransfer.setData/getData keys match
# Ensure ReactFlowProvider wraps component
```
