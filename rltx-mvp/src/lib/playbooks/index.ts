import type { CanvasNode, CanvasEdge } from "@/types";

// Playbook types
export interface Playbook {
  id: string;
  name: string;
  description: string;
  type: "template" | "pattern";
  category: PlaybookCategory;
  icon: string;
  color: string;
  nodes: PlaybookNode[];
  edges: PlaybookEdge[];
  // For auto-connect: which input handles accept external connections
  entryPoints: string[];
  // For auto-connect: which output handles can connect to downstream
  exitPoints: string[];
  tags: string[];
}

export type PlaybookCategory =
  | "strategy"
  | "operational"
  | "financial"
  | "defense"
  | "pattern";

export interface PlaybookNode {
  // Relative ID - will be prefixed with unique ID on drop
  relativeId: string;
  primitiveId: string;
  // Relative position from drop point
  offsetX: number;
  offsetY: number;
  label: string;
  config: Record<string, unknown>;
}

export interface PlaybookEdge {
  // References to relative node IDs
  sourceRelativeId: string;
  sourceHandle?: string;
  targetRelativeId: string;
  targetHandle?: string;
}

// Category configuration
export const playbookCategories: Record<PlaybookCategory, {
  label: string;
  order: number;
}> = {
  strategy: { label: "STRATEGY", order: 1 },
  operational: { label: "OPERATIONAL", order: 2 },
  financial: { label: "FINANCIAL", order: 3 },
  defense: { label: "DEFENSE", order: 4 },
  pattern: { label: "PATTERNS", order: 5 },
};

// Import playbooks
import { templates } from "./templates";
import { patterns } from "./patterns";

// Combined playbooks registry
export const playbooks: Record<string, Playbook> = {
  ...templates,
  ...patterns,
};

// Helper to get playbooks by type
export function getPlaybooksByType(type: "template" | "pattern"): Playbook[] {
  return Object.values(playbooks).filter((p) => p.type === type);
}

// Helper to get playbooks by category
export function getPlaybooksByCategory(category: PlaybookCategory): Playbook[] {
  return Object.values(playbooks).filter((p) => p.category === category);
}

// Helper to instantiate a playbook at a position
export function instantiatePlaybook(
  playbook: Playbook,
  dropPosition: { x: number; y: number },
  idPrefix: string
): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const nodes: CanvasNode[] = playbook.nodes.map((pNode) => ({
    id: `${idPrefix}-${pNode.relativeId}`,
    type: "primitive",
    position: {
      x: dropPosition.x + pNode.offsetX,
      y: dropPosition.y + pNode.offsetY,
    },
    data: {
      primitiveId: pNode.primitiveId,
      label: pNode.label,
      icon: getIconForPrimitive(pNode.primitiveId),
      color: getColorForPrimitive(pNode.primitiveId),
      config: { ...pNode.config },
      state: "idle" as const,
    },
  }));

  const edges: CanvasEdge[] = playbook.edges.map((pEdge, idx) => ({
    id: `${idPrefix}-edge-${idx}`,
    source: `${idPrefix}-${pEdge.sourceRelativeId}`,
    sourceHandle: pEdge.sourceHandle,
    target: `${idPrefix}-${pEdge.targetRelativeId}`,
    targetHandle: pEdge.targetHandle,
    animated: true,
  }));

  return { nodes, edges };
}

// Helper to get entry node IDs for auto-connect
export function getEntryNodeIds(
  playbook: Playbook,
  idPrefix: string
): string[] {
  return playbook.entryPoints.map((relId) => `${idPrefix}-${relId}`);
}

// Helper to get exit node IDs for auto-connect
export function getExitNodeIds(
  playbook: Playbook,
  idPrefix: string
): string[] {
  return playbook.exitPoints.map((relId) => `${idPrefix}-${relId}`);
}

// Primitive lookups (simplified - in real app would import from primitives)
function getIconForPrimitive(primitiveId: string): string {
  const iconMap: Record<string, string> = {
    "data.api.fetch": "Globe",
    "data.input": "Database",
    "data.doc.parse": "FileText",
    "data.db.query": "Database",
    "data.crm.salesforce": "Database",
    "reason.analyze": "Brain",
    "reason.compare": "Scale",
    "reason.summarize": "FileText",
    "reason.critique": "AlertTriangle",
    "reason.steelman": "Shield",
    "decompose.question": "Network",
    "causal.explain": "Workflow",
    "sim.scenario": "GitBranch",
    "sim.sensitivity": "BarChart3",
    "sim.montecarlo.oasis": "Users",
    "game.equilibrium": "Target",
    "branch.counterfactual": "GitFork",
    "uncertainty.aggregate": "TrendingUp",
    "opt.pareto": "TrendingUp",
    "human.input": "Users",
    "human.approve": "Shield",
    "output.recommendation": "CheckCircle",
    "output.report": "FileStack",
    "output.chart": "BarChart3",
    "control.condition": "GitBranch",
    "control.loop": "Workflow",
    "control.merge": "Merge",
    "defense.threat-assessment": "AlertTriangle",
    "defense.escalation-ladder": "TrendingUp",
    "defense.red-team": "Eye",
    "defense.course-of-action": "Target",
  };
  return iconMap[primitiveId] || "Database";
}

function getColorForPrimitive(primitiveId: string): string {
  const category = primitiveId.split(".")[0];
  const colorMap: Record<string, string> = {
    data: "#3b82f6",
    reason: "#8b5cf6",
    decompose: "#8b5cf6",
    causal: "#f43f5e",
    sim: "#f59e0b",
    game: "#06b6d4",
    branch: "#10b981",
    uncertainty: "#7c3aed",
    opt: "#06b6d4",
    human: "#ec4899",
    output: "#22c55e",
    control: "#6b7280",
    defense: "#ef4444",
  };
  return colorMap[category] || "#6b7280";
}
