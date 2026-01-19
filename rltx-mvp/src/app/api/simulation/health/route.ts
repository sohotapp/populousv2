/**
 * Simulation Engine Health Check
 * 
 * GET /api/simulation/health
 * 
 * Validates that all required services are available:
 * - Anthropic API key is valid
 * - Database connection is working
 * - Core dependencies are loaded
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

interface HealthCheck {
  name: string;
  status: "healthy" | "degraded" | "unhealthy";
  message?: string;
  latencyMs?: number;
}

interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  checks: HealthCheck[];
  version: string;
}

/**
 * Check if Anthropic API key is valid
 */
async function checkAnthropicApiKey(): Promise<HealthCheck> {
  const startTime = Date.now();
  
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      return {
        name: "anthropic_api",
        status: "unhealthy",
        message: "ANTHROPIC_API_KEY environment variable is not set",
      };
    }

    if (!apiKey.startsWith("sk-ant-")) {
      return {
        name: "anthropic_api",
        status: "unhealthy",
        message: "ANTHROPIC_API_KEY appears to be invalid (should start with 'sk-ant-')",
      };
    }

    // Try a minimal API call to validate the key
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const anthropic = new Anthropic({ apiKey });

    // Use a minimal prompt to validate credentials
    await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1,
      messages: [{ role: "user", content: "test" }],
    });

    return {
      name: "anthropic_api",
      status: "healthy",
      message: "API key is valid and model is accessible",
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes("authentication") || errorMessage.includes("401")) {
      return {
        name: "anthropic_api",
        status: "unhealthy",
        message: "API key authentication failed",
        latencyMs: Date.now() - startTime,
      };
    }

    if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
      return {
        name: "anthropic_api",
        status: "degraded",
        message: "API is rate limited but key appears valid",
        latencyMs: Date.now() - startTime,
      };
    }

    return {
      name: "anthropic_api",
      status: "degraded",
      message: `API check failed: ${errorMessage}`,
      latencyMs: Date.now() - startTime,
    };
  }
}

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<HealthCheck> {
  const startTime = Date.now();
  
  try {
    if (!db) {
      return {
        name: "database",
        status: "degraded",
        message: "DATABASE_URL not configured, using in-memory storage",
      };
    }

    // Simple query to verify connection
    await db.execute(sql`SELECT 1`);

    return {
      name: "database",
      status: "healthy",
      message: "PostgreSQL connection successful",
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      name: "database",
      status: "unhealthy",
      message: `Database connection failed: ${errorMessage}`,
      latencyMs: Date.now() - startTime,
    };
  }
}

/**
 * Check embedding service (for SSR calibration)
 */
async function checkEmbeddings(): Promise<HealthCheck> {
  const startTime = Date.now();
  
  try {
    const openaiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiKey) {
      return {
        name: "embeddings",
        status: "degraded",
        message: "OPENAI_API_KEY not set - SSR calibration may use fallback",
      };
    }

    // Minimal embedding call to verify
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: "test",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        name: "embeddings",
        status: "degraded",
        message: `Embedding API error: ${errorText.slice(0, 100)}`,
        latencyMs: Date.now() - startTime,
      };
    }

    return {
      name: "embeddings",
      status: "healthy",
      message: "OpenAI embeddings available for SSR calibration",
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      name: "embeddings",
      status: "degraded",
      message: `Embedding check failed: ${errorMessage}`,
      latencyMs: Date.now() - startTime,
    };
  }
}

/**
 * GET handler - health check
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const detailed = searchParams.get("detailed") === "true";

  // Run all checks in parallel
  const checks = await Promise.all([
    checkAnthropicApiKey(),
    checkDatabase(),
    ...(detailed ? [checkEmbeddings()] : []),
  ]);

  // Determine overall status
  const hasUnhealthy = checks.some(c => c.status === "unhealthy");
  const hasDegraded = checks.some(c => c.status === "degraded");
  
  let overallStatus: "healthy" | "degraded" | "unhealthy";
  if (hasUnhealthy) {
    overallStatus = "unhealthy";
  } else if (hasDegraded) {
    overallStatus = "degraded";
  } else {
    overallStatus = "healthy";
  }

  const response: HealthResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks,
    version: process.env.npm_package_version || "1.0.0",
  };

  // Return appropriate HTTP status code
  const httpStatus = overallStatus === "unhealthy" ? 503 : overallStatus === "degraded" ? 200 : 200;

  return NextResponse.json(response, { status: httpStatus });
}
