# RLTX Quick Start Guide

## Option 1: Automated Setup (Recommended)

```bash
# Make setup script executable and run it
chmod +x setup.sh
./setup.sh
```

This will:
- Create a new Next.js 14 project
- Install all dependencies
- Set up folder structure
- Create environment template

## Option 2: Manual Setup

### 1. Create Next.js Project

```bash
npx create-next-app@latest rltx-app \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

cd rltx-app
```

### 2. Install Dependencies

```bash
# Core
npm install @xyflow/react zustand @tanstack/react-query framer-motion

# UI
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu \
  @radix-ui/react-tabs @radix-ui/react-tooltip lucide-react sonner \
  class-variance-authority clsx tailwind-merge

# Forms
npm install zod react-hook-form @hookform/resolvers

# Database
npm install drizzle-orm postgres @neondatabase/serverless
npm install -D drizzle-kit

# Auth
npm install @clerk/nextjs

# AI
npm install @anthropic-ai/sdk openai @pinecone-database/pinecone ai

# Real-time & Storage
npm install socket.io socket.io-client @aws-sdk/client-s3

# Charts & Utils
npm install recharts date-fns nanoid
```

### 3. Set Up Environment

```bash
cp .env.example .env.local
# Edit .env.local with your API keys
```

### 4. Set Up Database

```bash
npm run db:push
```

### 5. Start Development

```bash
npm run dev
```

Open http://localhost:3000

---

## Required API Keys

| Service | Sign Up | Purpose |
|---------|---------|---------|
| **Clerk** | https://clerk.com | Authentication |
| **Neon** | https://neon.tech | PostgreSQL database |
| **Anthropic** | https://console.anthropic.com | Claude AI |
| **Upstash** | https://upstash.com | Redis (optional) |
| **Pinecone** | https://pinecone.io | Vector DB (optional) |

---

## Project Structure

```
rltx-app/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API routes
│   │   ├── workflow/[id]/     # Workflow canvas page
│   │   └── page.tsx           # Home (Command)
│   │
│   ├── components/
│   │   ├── canvas/            # ReactFlow canvas
│   │   ├── chat/              # Chat interface
│   │   ├── inspector/         # Right panel
│   │   ├── primitives/        # Primitive library
│   │   └── ui/                # Base components
│   │
│   ├── lib/
│   │   ├── primitives/        # Primitive definitions
│   │   ├── executor/          # Workflow execution
│   │   └── composer/          # AI workflow generation
│   │
│   ├── stores/                # Zustand stores
│   ├── hooks/                 # React hooks
│   ├── types/                 # TypeScript types
│   └── db/                    # Database schema
│
├── .env.local                 # Environment variables
├── drizzle.config.ts          # Drizzle ORM config
└── package.json
```

---

## Key Files to Create

After setup, you'll need to create these files. See `BUILD_GUIDE.md` for full code:

1. `src/db/schema.ts` - Database schema
2. `src/db/index.ts` - Database client
3. `src/lib/primitives/index.ts` - Primitive definitions
4. `src/stores/canvas.ts` - Canvas state management
5. `src/components/canvas/Canvas.tsx` - Main canvas
6. `src/components/canvas/nodes/PrimitiveNode.tsx` - Node component
7. `src/app/api/workflows/route.ts` - Workflows API
8. `src/app/api/workflows/compose/route.ts` - AI composer API
9. `src/middleware.ts` - Clerk auth middleware

---

## Need Help?

- See `BUILD_GUIDE.md` for complete code examples
- See `ARCHITECTURE.md` for system design
- See `TECH_STACK.md` for technology choices
- See `API_SPEC.md` for API documentation
