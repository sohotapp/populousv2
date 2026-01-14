/**
 * RLTX Primitives Index
 *
 * This module exports all primitives from the spec and playbook patterns.
 * The spec-primitives.ts contains all 18 primitives from the domain architecture.
 * The presets.ts contains all 6 canonical playbook patterns.
 */

import type { Primitive } from "@/types";

export type { Primitive };

// Re-export everything from spec-primitives as the primary source
export {
  specPrimitives as primitives,
  categories,
  designTokens,
  getSpecPrimitivesByCategory as getPrimitivesByCategory,
  getSpecPrimitive as getPrimitive,
  getCategoryForPrimitive,
  categoryOrder,
  primitiveSelectionGuide,
  type PrimitiveCategory,
  type CategoryDefinition,
} from "./spec-primitives";

// Re-export playbook patterns
export {
  playbookPatterns,
  selectPattern,
  requiredPrimitivesByPattern,
  getAllPlaybookPatterns,
  getPlaybookPattern,
  playbookToReactFlow,
  getPresetsForPrimitive,
  PRIMITIVE_PRESETS,
  type PlaybookPattern,
  type PatternType,
  type Preset,
} from "./presets";

// Legacy compatibility - maps category names
export interface LegacyPrimitiveCategory {
  name: string;
  color: string;
}

export const primitiveCategories: Record<string, LegacyPrimitiveCategory> = {
  agent: { name: "Agent", color: "hsl(270, 60%, 50%)" },
  population: { name: "Population", color: "hsl(210, 60%, 50%)" },
  orchestrate: { name: "Orchestrate", color: "hsl(38, 70%, 50%)" },
  aggregate: { name: "Aggregate", color: "hsl(142, 60%, 45%)" },
  branch: { name: "Branch", color: "hsl(330, 60%, 50%)" },
  analyze: { name: "Analyze", color: "hsl(0, 60%, 50%)" },
};

export const categoryLabels: Record<string, string> = {
  agent: "Agent",
  population: "Population",
  orchestrate: "Orchestrate",
  aggregate: "Aggregate",
  branch: "Branch",
  analyze: "Analyze",
};

export const categoryColors: Record<string, string> = {
  agent: "hsl(270, 60%, 50%)",
  population: "hsl(210, 60%, 50%)",
  orchestrate: "hsl(38, 70%, 50%)",
  aggregate: "hsl(142, 60%, 45%)",
  branch: "hsl(330, 60%, 50%)",
  analyze: "hsl(0, 60%, 50%)",
};
