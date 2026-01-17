// OpenAI Embeddings Client for SSR Calibration
// Uses text-embedding-3-small for semantic similarity computation

import OpenAI from "openai";

// =============================================================================
// TYPES
// =============================================================================

export interface EmbeddingResult {
  text: string;
  embedding: number[];
  model: string;
  tokens: number;
}

export interface EmbeddingCache {
  get(text: string): number[] | undefined;
  set(text: string, embedding: number[]): void;
  has(text: string): boolean;
}

// =============================================================================
// SIMPLE IN-MEMORY CACHE
// =============================================================================

class InMemoryEmbeddingCache implements EmbeddingCache {
  private cache = new Map<string, number[]>();
  private maxSize = 10000;

  get(text: string): number[] | undefined {
    return this.cache.get(this.hash(text));
  }

  set(text: string, embedding: number[]): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(this.hash(text), embedding);
  }

  has(text: string): boolean {
    return this.cache.has(this.hash(text));
  }

  private hash(text: string): string {
    // Simple hash for cache key
    return text.toLowerCase().trim().slice(0, 500);
  }
}

// Global cache instance
const embeddingCache = new InMemoryEmbeddingCache();

// =============================================================================
// EMBEDDINGS CLIENT
// =============================================================================

export class EmbeddingsClient {
  private client: OpenAI | null = null;
  private model = "text-embedding-3-small";
  private dimensions = 1536;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
    }
  }

  /**
   * Embed a single text string
   */
  async embed(text: string): Promise<number[]> {
    // Check cache first
    const cached = embeddingCache.get(text);
    if (cached) return cached;

    if (!this.client) {
      // Return random embedding for demo/testing when no API key
      console.warn("[Embeddings] No OpenAI API key, using random embedding");
      return this.randomEmbedding();
    }

    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: text.trim(),
        dimensions: this.dimensions,
      });

      const embedding = response.data[0].embedding;
      embeddingCache.set(text, embedding);
      return embedding;
    } catch (error) {
      console.error("[Embeddings] Error:", error);
      return this.randomEmbedding();
    }
  }

  /**
   * Embed multiple texts in batch (more efficient)
   */
  async embedBatch(texts: string[]): Promise<Map<string, number[]>> {
    const results = new Map<string, number[]>();
    const uncached: string[] = [];

    // Check cache for each text
    for (const text of texts) {
      const cached = embeddingCache.get(text);
      if (cached) {
        results.set(text, cached);
      } else {
        uncached.push(text);
      }
    }

    // If all cached, return early
    if (uncached.length === 0) {
      return results;
    }

    if (!this.client) {
      // Return random embeddings for demo
      for (const text of uncached) {
        const embedding = this.randomEmbedding();
        embeddingCache.set(text, embedding);
        results.set(text, embedding);
      }
      return results;
    }

    try {
      // Batch embed uncached texts (OpenAI supports up to 2048 inputs)
      const batches: string[][] = [];
      for (let i = 0; i < uncached.length; i += 100) {
        batches.push(uncached.slice(i, i + 100));
      }

      for (const batch of batches) {
        const response = await this.client.embeddings.create({
          model: this.model,
          input: batch.map((t) => t.trim()),
          dimensions: this.dimensions,
        });

        for (let i = 0; i < batch.length; i++) {
          const embedding = response.data[i].embedding;
          embeddingCache.set(batch[i], embedding);
          results.set(batch[i], embedding);
        }
      }
    } catch (error) {
      console.error("[Embeddings] Batch error:", error);
      // Fallback to random for failed texts
      for (const text of uncached) {
        if (!results.has(text)) {
          const embedding = this.randomEmbedding();
          results.set(text, embedding);
        }
      }
    }

    return results;
  }

  /**
   * Compute cosine similarity between two embeddings
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error("Embedding dimensions must match");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    if (magnitude === 0) return 0;

    return dotProduct / magnitude;
  }

  /**
   * Generate random embedding for demo/testing
   */
  private randomEmbedding(): number[] {
    const embedding: number[] = [];
    for (let i = 0; i < this.dimensions; i++) {
      embedding.push((Math.random() - 0.5) * 2);
    }
    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, x) => sum + x * x, 0));
    return embedding.map((x) => x / norm);
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

let clientInstance: EmbeddingsClient | null = null;

export function getEmbeddingsClient(): EmbeddingsClient {
  if (!clientInstance) {
    clientInstance = new EmbeddingsClient();
  }
  return clientInstance;
}

// Convenience function
export async function embed(text: string): Promise<number[]> {
  return getEmbeddingsClient().embed(text);
}

export async function embedBatch(texts: string[]): Promise<Map<string, number[]>> {
  return getEmbeddingsClient().embedBatch(texts);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  return getEmbeddingsClient().cosineSimilarity(a, b);
}
