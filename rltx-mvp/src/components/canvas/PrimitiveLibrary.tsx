"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import {
  Search,
  ChevronDown,
  // Agent icons
  User,
  UserPlus,
  Brain,
  MessageSquare,
  // Population icons
  Users,
  Filter,
  PieChart,
  // Orchestrate icons
  Shuffle,
  Target,
  Network,
  // Aggregate icons
  BarChart3,
  Scale,
  CheckCircle2,
  // Branch icons
  GitBranch,
  GitCompare,
  GitMerge,
  // Analyze icons
  TrendingUp,
  Sliders,
  HelpCircle,
  // Playbook icons
  Layers,
  Database,
  ClipboardList,
  Activity,
  Flag,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  specPrimitives,
  categories,
  categoryOrder,
  designTokens,
  type PrimitiveCategory,
} from "@/lib/primitives/spec-primitives";
import {
  getAllPlaybookPatterns,
  type PlaybookPattern,
} from "@/lib/primitives/presets";
import type { Primitive } from "@/types";
import { cn } from "@/lib/utils";

// Icon mapping for all spec primitives (Linear style - monochrome)
const iconMap: Record<string, LucideIcon> = {
  // Agent
  UserPlus,
  Brain,
  MessageSquare,
  User,
  // Population
  Users,
  Filter,
  PieChart,
  // Orchestrate
  Shuffle,
  Target,
  Network,
  // Aggregate
  BarChart3,
  Scale,
  CheckCircle2,
  // Branch
  GitBranch,
  GitCompare,
  GitMerge,
  // Analyze
  TrendingUp,
  Sliders,
  HelpCircle,
  // Fallback
  Database,
  Layers,
};

// Category icons (Linear style - monochrome)
const categoryIcons: Record<PrimitiveCategory, LucideIcon> = {
  agent: User,
  population: Users,
  orchestrate: Network,
  aggregate: BarChart3,
  branch: GitBranch,
  analyze: TrendingUp,
};

// Playbook icons - Linear style: monochrome, 1.5px stroke, outlined
// Icons chosen for functional meaning, not decoration (per design.md)
const playbookTypeIcons: Record<string, LucideIcon> = {
  consumer_survey: ClipboardList,
  change_impact: Scale,
  competitive_response: Target,
  wargame: Flag,
  dynamics: Activity,
  counterfactual: GitBranch,
};

// Split panel constraints
const MIN_PANEL_HEIGHT = 80;
const DEFAULT_SPLIT_RATIO = 0.35;

interface PrimitiveLibraryProps {
  className?: string;
}

export function PrimitiveLibrary({ className }: PrimitiveLibraryProps) {
  const [search, setSearch] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["playbooks", ...categoryOrder])
  );
  const [splitRatio, setSplitRatio] = useState(DEFAULT_SPLIT_RATIO);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Handle split drag
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const containerHeight = containerRect.height;
      const relativeY = e.clientY - containerRect.top;

      const newRatio = Math.max(
        MIN_PANEL_HEIGHT / containerHeight,
        Math.min(
          1 - MIN_PANEL_HEIGHT / containerHeight,
          relativeY / containerHeight
        )
      );

      setSplitRatio(newRatio);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, []);

  // Filter and group primitives by category
  const { groupedPrimitives, sortedCategories } = useMemo(() => {
    const searchLower = search.toLowerCase();

    const filtered = Object.values(specPrimitives).filter(
      (primitive) =>
        primitive.name.toLowerCase().includes(searchLower) ||
        primitive.description.toLowerCase().includes(searchLower) ||
        primitive.id.toLowerCase().includes(searchLower)
    );

    const grouped = filtered.reduce(
      (acc, primitive) => {
        const category = primitive.category as PrimitiveCategory;
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(primitive);
        return acc;
      },
      {} as Record<PrimitiveCategory, Primitive[]>
    );

    // Use spec category order
    const sorted = categoryOrder.filter(
      (cat) => grouped[cat]?.length > 0 || !search
    );

    return { groupedPrimitives: grouped, sortedCategories: sorted };
  }, [search]);

  // Filter playbooks
  const filteredPlaybooks = useMemo(() => {
    const searchLower = search.toLowerCase();
    return getAllPlaybookPatterns().filter(
      (playbook) =>
        playbook.name.toLowerCase().includes(searchLower) ||
        playbook.description.toLowerCase().includes(searchLower) ||
        playbook.keywords.some((k) => k.toLowerCase().includes(searchLower))
    );
  }, [search]);

  const onPrimitiveDragStart = (
    event: React.DragEvent,
    primitiveId: string
  ) => {
    event.dataTransfer.setData("application/primitive", primitiveId);
    event.dataTransfer.effectAllowed = "move";
  };

  const onPlaybookDragStart = (event: React.DragEvent, playbookId: string) => {
    event.dataTransfer.setData("application/playbook", playbookId);
    event.dataTransfer.effectAllowed = "move";
  };

  const hasPlaybookResults = filteredPlaybooks.length > 0;
  const hasPrimitiveResults = sortedCategories.length > 0;

  return (
    <div
      className={cn("flex flex-col h-full", className)}
      style={{ backgroundColor: designTokens.bgBase }}
    >
      {/* Search - Linear style */}
      <div className="p-2.5 flex-shrink-0">
        <div className="relative">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
            style={{ color: designTokens.iconSecondary }}
          />
          <Input
            placeholder="Search primitives..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-[13px] rounded-md focus-visible:ring-0"
            style={{
              backgroundColor: designTokens.bgSurface,
              borderColor: designTokens.borderSubtle,
              color: designTokens.textPrimary,
            }}
          />
        </div>
      </div>

      {/* Split container */}
      <div ref={containerRef} className="flex-1 flex flex-col min-h-0">
        {/* Top: Playbooks Section */}
        <div
          className="flex-shrink-0 overflow-hidden flex flex-col"
          style={{ height: `${splitRatio * 100}%` }}
        >
          <div className="flex-1 overflow-y-auto px-1.5">
            {hasPlaybookResults || !search ? (
              <div className="mt-1.5">
                {/* Playbooks section header - Linear style */}
                <button
                  onClick={() => toggleCategory("playbooks")}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md transition-colors duration-100"
                  style={{ color: designTokens.textTertiary }}
                >
                  <ChevronDown
                    className={cn(
                      "w-3 h-3 transition-transform duration-100",
                      !expandedCategories.has("playbooks") && "-rotate-90"
                    )}
                  />
                  <Layers
                    className="w-3.5 h-3.5"
                    style={{ color: designTokens.iconSecondary }}
                  />
                  <span className="text-[11px] font-semibold tracking-wide uppercase">
                    Playbooks
                  </span>
                  <span
                    className="text-[10px] ml-auto tabular-nums"
                    style={{ color: designTokens.textQuaternary }}
                  >
                    {filteredPlaybooks.length}
                  </span>
                </button>

                {expandedCategories.has("playbooks") && (
                  <div className="ml-1 mt-0.5">
                    {filteredPlaybooks.map((playbook) => (
                      <PlaybookItem
                        key={playbook.id}
                        playbook={playbook}
                        onDragStart={onPlaybookDragStart}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div
                className="flex items-center justify-center h-full text-[11px]"
                style={{ color: designTokens.textQuaternary }}
              >
                No playbooks found
              </div>
            )}
          </div>
        </div>

        {/* Drag Handle - Linear style */}
        <div
          className="flex-shrink-0 h-[1px] relative group cursor-row-resize"
          onMouseDown={handleDragStart}
        >
          <div
            className="absolute inset-x-0 top-0 h-[1px]"
            style={{ backgroundColor: designTokens.borderSubtle }}
          />
          <div className="absolute inset-x-0 -top-1 h-[9px] flex items-center justify-center">
            <div
              className="w-8 h-[3px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-100"
              style={{ backgroundColor: designTokens.borderDefault }}
            />
          </div>
        </div>

        {/* Bottom: Primitives Section */}
        <div
          className="flex-1 overflow-hidden flex flex-col min-h-0"
          style={{ height: `${(1 - splitRatio) * 100}%` }}
        >
          <div className="flex-1 overflow-y-auto px-1.5">
            {hasPrimitiveResults ? (
              sortedCategories.map((categoryKey) => {
                const categoryDef = categories[categoryKey];
                const CategoryIcon = categoryIcons[categoryKey];
                const categoryPrimitives =
                  groupedPrimitives[categoryKey] || [];
                const isExpanded = expandedCategories.has(categoryKey);

                return (
                  <div key={categoryKey} className="mt-1.5">
                    {/* Category Header - Linear style */}
                    <button
                      onClick={() => toggleCategory(categoryKey)}
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md transition-colors duration-100"
                      style={{ color: designTokens.textTertiary }}
                    >
                      <ChevronDown
                        className={cn(
                          "w-3 h-3 transition-transform duration-100",
                          !isExpanded && "-rotate-90"
                        )}
                      />
                      {CategoryIcon && (
                        <CategoryIcon
                          className="w-3.5 h-3.5"
                          style={{ color: designTokens.iconSecondary }}
                        />
                      )}
                      <span className="text-[11px] font-semibold tracking-wide uppercase">
                        {categoryDef.name}
                      </span>
                      <span
                        className="text-[10px] ml-auto tabular-nums"
                        style={{ color: designTokens.textQuaternary }}
                      >
                        {categoryPrimitives.length}
                      </span>
                    </button>

                    {/* Primitives List */}
                    {isExpanded && (
                      <div className="ml-1 mt-0.5">
                        {categoryPrimitives.map((primitive) => {
                          const IconComponent =
                            iconMap[primitive.icon] || Database;

                          return (
                            <div
                              key={primitive.id}
                              draggable
                              onDragStart={(e) =>
                                onPrimitiveDragStart(e, primitive.id)
                              }
                              className={cn(
                                "group/item flex items-center gap-2.5 px-2 py-1.5 rounded-md",
                                "cursor-grab active:cursor-grabbing",
                                "hover:bg-[hsl(0,0%,12%)] transition-colors duration-100"
                              )}
                            >
                              {/* Category accent - subtle left edge */}
                              <div
                                className="w-0.5 h-5 rounded-full"
                                style={{
                                  backgroundColor: `${categoryDef.color}30`,
                                }}
                              />
                              <IconComponent
                                className="w-4 h-4 flex-shrink-0"
                                style={{ color: designTokens.iconSecondary }}
                              />
                              <span
                                className="text-[13px] truncate"
                                style={{ color: designTokens.textSecondary }}
                              >
                                {primitive.name}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div
                className="flex items-center justify-center h-full text-[11px]"
                style={{ color: designTokens.textQuaternary }}
              >
                No primitives found
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer hint - Linear style */}
      <div
        className="px-3 py-2.5 flex-shrink-0 border-t"
        style={{ borderColor: designTokens.borderSubtle }}
      >
        <p
          className="text-[11px] text-center"
          style={{ color: designTokens.textQuaternary }}
        >
          Drag to canvas
        </p>
      </div>
    </div>
  );
}

// Playbook item component - Linear design: monochrome, minimal chrome
// Per design.md: "No colorful backgrounds for containers"
function PlaybookItem({
  playbook,
  onDragStart,
}: {
  playbook: PlaybookPattern;
  onDragStart: (e: React.DragEvent, id: string) => void;
}) {
  const nodeCount = playbook.structure.nodes.length;
  const PlaybookIcon = playbookTypeIcons[playbook.id] || Layers;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, playbook.id)}
      className={cn(
        "group/item flex items-center gap-2.5 px-2 py-1.5 rounded-md",
        "cursor-grab active:cursor-grabbing",
        "hover:bg-[hsl(0,0%,12%)] transition-colors duration-100"
      )}
    >
      {/* Icon - monochrome per design.md */}
      <PlaybookIcon
        className="w-4 h-4 flex-shrink-0"
        style={{ color: designTokens.iconSecondary }}
      />

      {/* Text content */}
      <div className="flex-1 min-w-0">
        <span
          className="text-[13px] font-medium truncate block"
          style={{ color: designTokens.textSecondary }}
        >
          {playbook.name}
        </span>
      </div>

      {/* Node count - subtle badge */}
      <span
        className="text-[10px] tabular-nums flex-shrink-0"
        style={{ color: designTokens.textQuaternary }}
      >
        {nodeCount}
      </span>
    </div>
  );
}
