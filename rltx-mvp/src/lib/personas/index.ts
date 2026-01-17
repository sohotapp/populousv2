/**
 * Personas Module - VIP persona management for RLTX simulations
 *
 * This module provides:
 * - PersonaStore: Supabase persistence for compiled VIP personas
 * - CollectionOrchestrator: Pipeline for collecting and compiling personas
 * - Political personas: Senator and representative builders
 *
 * Usage:
 *
 * ```typescript
 * // Get persona store
 * import { personaStore, getPersonaStore } from "@/lib/personas";
 *
 * // Query personas ready for simulation
 * const personas = await personaStore.getSimulationReadyPersonas({
 *   vertical: "enterprise",
 *   limit: 100,
 * });
 *
 * // Run collection pipeline
 * import { getCollectionOrchestrator } from "@/lib/personas";
 *
 * const orchestrator = getCollectionOrchestrator({ creditBudget: 5000 });
 * const summary = await orchestrator.runCollection(
 *   { vertical: "enterprise", tier: "A" },
 *   (progress) => console.log(progress)
 * );
 * ```
 */

// Core persona store
export {
  PersonaStore,
  personaStore,
  getPersonaStore,
  type StoredPersona,
  type PersonaInput,
  type PersonaQueryOptions,
  type CollectionStats,
  type CollectionStatus,
  type VIPVertical,
  type VIPTier,
  type CollectionLogEntry,
  type RefreshPolicy,
} from "./persona-store";

// Collection orchestrator
export {
  CollectionOrchestrator,
  getCollectionOrchestrator,
  runCollectionCLI,
  type OrchestratorConfig,
  type CollectionProgress,
  type CollectionSummary,
  type CollectionFilter,
} from "./collection-orchestrator";

// Political personas
export * from "./political";
