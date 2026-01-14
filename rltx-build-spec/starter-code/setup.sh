#!/bin/bash

# ===========================================
# RLTX Decision Compiler - Setup Script
# ===========================================

set -e

echo "🚀 Setting up RLTX Decision Compiler..."
echo ""

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js 20+ required. Current version: $(node -v)"
    exit 1
fi
echo "✅ Node.js version: $(node -v)"

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ npm is required but not installed."
    exit 1
fi
echo "✅ npm version: $(npm -v)"

# Create Next.js project
echo ""
echo "📦 Creating Next.js project..."
npx create-next-app@latest rltx-app \
    --typescript \
    --tailwind \
    --eslint \
    --app \
    --src-dir \
    --import-alias "@/*" \
    --no-git

cd rltx-app

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install \
    @xyflow/react \
    zustand \
    @tanstack/react-query \
    framer-motion \
    @radix-ui/react-dialog \
    @radix-ui/react-dropdown-menu \
    @radix-ui/react-tabs \
    @radix-ui/react-tooltip \
    @radix-ui/react-popover \
    @radix-ui/react-select \
    @radix-ui/react-slider \
    @radix-ui/react-switch \
    lucide-react \
    sonner \
    class-variance-authority \
    clsx \
    tailwind-merge \
    zod \
    react-hook-form \
    @hookform/resolvers \
    drizzle-orm \
    postgres \
    @neondatabase/serverless \
    @clerk/nextjs \
    @anthropic-ai/sdk \
    openai \
    @pinecone-database/pinecone \
    ai \
    @upstash/redis \
    @upstash/ratelimit \
    socket.io \
    socket.io-client \
    @aws-sdk/client-s3 \
    recharts \
    date-fns \
    nanoid

npm install -D \
    drizzle-kit \
    tsx \
    dotenv-cli \
    tailwindcss-animate

# Create folder structure
echo ""
echo "📁 Creating folder structure..."
mkdir -p src/{components,lib,stores,hooks,types,db,server}
mkdir -p src/app/{api,workflow,decisions,pulse}
mkdir -p src/app/api/{workflows,executions,chat,primitives}
mkdir -p src/app/workflow/\[id\]
mkdir -p src/components/{canvas,chat,inspector,results,primitives,ui}
mkdir -p src/components/canvas/nodes
mkdir -p src/lib/{primitives,executor,composer,utils}

# Copy starter files (if they exist in the parent directory)
if [ -f "../.env.example" ]; then
    cp ../.env.example .env.local
    echo "✅ Created .env.local from template"
else
    echo "⚠️ No .env.example found. Create .env.local manually."
fi

# Update package.json scripts
echo ""
echo "📝 Updating package.json scripts..."
npm pkg set scripts.db:generate="drizzle-kit generate"
npm pkg set scripts.db:push="drizzle-kit push"
npm pkg set scripts.db:studio="drizzle-kit studio"
npm pkg set scripts.db:migrate="tsx src/db/migrate.ts"
npm pkg set scripts.socket:dev="tsx watch src/server/socket.ts"
npm pkg set scripts.typecheck="tsc --noEmit"

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. cd rltx-app"
echo "2. Copy .env.example to .env.local and fill in your API keys"
echo "3. Run: npm run db:push (to create database tables)"
echo "4. Run: npm run dev (to start development server)"
echo ""
echo "🎉 Happy building!"
