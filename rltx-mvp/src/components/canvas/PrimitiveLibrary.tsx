"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import {
  Search,
  ChevronDown,
  ChevronRight,
  // Data icons
  Globe,
  Database,
  FileText,
  Table,
  Cloud,
  // Reason icons
  Lightbulb,
  Scale,
  FileSearch,
  AlertCircle,
  Shield,
  Share2,
  Workflow,
  // Simulate icons
  GitBranch,
  BarChart2,
  Users,
  Target,
  TrendingUp,
  Activity,
  // Human icons
  User,
  ShieldCheck,
  // Output icons
  CheckCircle,
  Layers,
  PieChart,
  // Control icons
  GitFork,
  Split,
  Repeat,
  GitMerge,
  // Playbook icons
  BookOpen,
  Puzzle,
  DollarSign,
  Network,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { primitives, type Primitive } from "@/lib/primitives";
import { playbooks, playbookCategories, type Playbook, type PlaybookCategory } from "@/lib/playbooks";
import { cn } from "@/lib/utils";

// Comprehensive icon mapping - Linear style (clean, minimal)
const iconMap: Record<string, LucideIcon> = {
  // Data
  Globe,
  Database,
  FileText,
  Table,
  Cloud,
  // Reason
  Brain: Lightbulb,
  Lightbulb,
  Scale,
  FileSearch,
  AlertTriangle: AlertCircle,
  Shield,
  Network: Share2,
  Workflow,
  // Simulate
  GitBranch,
  BarChart3: BarChart2,
  BarChart2,
  Users,
  Target,
  TrendingUp,
  Gauge: Activity,
  Activity,
  // Human
  UserCircle: User,
  User,
  ShieldCheck,
  // Output
  CheckCircle,
  FileStack: Layers,
  Layers,
  BarChart: PieChart,
  PieChart,
  // Control
  GitFork,
  Split,
  Repeat,
  Merge: GitMerge,
  GitMerge,
  // Playbook specific
  BookOpen,
  Puzzle,
  DollarSign,
  Share2,
};

// Category configuration with proper ordering
const categoryConfig: Record<string, {
  label: string;
  icon: LucideIcon;
  order: number;
}> = {
  data: { label: "DATA", icon: Database, order: 1 },
  reason: { label: "REASON", icon: Lightbulb, order: 2 },
  simulate: { label: "SIMULATE", icon: GitBranch, order: 3 },
  human: { label: "HUMAN", icon: User, order: 4 },
  output: { label: "OUTPUT", icon: CheckCircle, order: 5 },
  control: { label: "CONTROL", icon: Split, order: 6 },
};

// Playbook category icons
const playbookCategoryIcons: Record<PlaybookCategory, LucideIcon> = {
  strategy: Target,
  operational: Users,
  financial: DollarSign,
  defense: Shield,
  pattern: Puzzle,
};

// Split panel constraints
const MIN_PANEL_HEIGHT = 80;
const DEFAULT_SPLIT_RATIO = 0.35; // 35% playbooks, 65% primitives

interface PrimitiveLibraryProps {
  className?: string;
}

export function PrimitiveLibrary({
  className,
}: PrimitiveLibraryProps) {
  const [search, setSearch] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["templates", "patterns", ...Object.keys(categoryConfig)])
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

      // Calculate new ratio with constraints
      const newRatio = Math.max(
        MIN_PANEL_HEIGHT / containerHeight,
        Math.min(1 - MIN_PANEL_HEIGHT / containerHeight, relativeY / containerHeight)
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

  // Filter and group primitives
  const { groupedPrimitives, sortedCategories } = useMemo(() => {
    const searchLower = search.toLowerCase();

    const filtered = Object.values(primitives).filter(
      (primitive) =>
        primitive.name.toLowerCase().includes(searchLower) ||
        primitive.description.toLowerCase().includes(searchLower)
    );

    const grouped = filtered.reduce((acc, primitive) => {
      const category = primitive.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(primitive);
      return acc;
    }, {} as Record<string, Primitive[]>);

    // Sort categories by order
    const sorted = Object.keys(categoryConfig)
      .filter((cat) => grouped[cat]?.length > 0 || !search)
      .sort((a, b) => categoryConfig[a].order - categoryConfig[b].order);

    return { groupedPrimitives: grouped, sortedCategories: sorted };
  }, [search]);

  // Filter and group playbooks
  const { filteredTemplates, filteredPatterns } = useMemo(() => {
    const searchLower = search.toLowerCase();

    const allPlaybooks = Object.values(playbooks);

    const templates = allPlaybooks.filter(
      (p) => p.type === "template" && (
        p.name.toLowerCase().includes(searchLower) ||
        p.description.toLowerCase().includes(searchLower) ||
        p.tags.some(t => t.toLowerCase().includes(searchLower))
      )
    );

    const patterns = allPlaybooks.filter(
      (p) => p.type === "pattern" && (
        p.name.toLowerCase().includes(searchLower) ||
        p.description.toLowerCase().includes(searchLower) ||
        p.tags.some(t => t.toLowerCase().includes(searchLower))
      )
    );

    return { filteredTemplates: templates, filteredPatterns: patterns };
  }, [search]);

  // Group templates by category
  const templatesByCategory = useMemo(() => {
    const grouped: Record<string, Playbook[]> = {};
    filteredTemplates.forEach((t) => {
      if (!grouped[t.category]) {
        grouped[t.category] = [];
      }
      grouped[t.category].push(t);
    });
    return grouped;
  }, [filteredTemplates]);

  const onPrimitiveDragStart = (event: React.DragEvent, primitiveId: string) => {
    event.dataTransfer.setData("application/primitive", primitiveId);
    event.dataTransfer.effectAllowed = "move";
  };

  const onPlaybookDragStart = (event: React.DragEvent, playbookId: string) => {
    event.dataTransfer.setData("application/playbook", playbookId);
    event.dataTransfer.effectAllowed = "move";
  };

  const hasPlaybookResults = filteredTemplates.length > 0 || filteredPatterns.length > 0;
  const hasPrimitiveResults = sortedCategories.length > 0;

  return (
    <div className={cn(
      "flex flex-col h-full bg-[hsl(0,0%,7%)]",
      className
    )}>
      {/* Search - fixed at top */}
      <div className="p-2.5 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[hsl(0,0%,40%)]" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs bg-[hsl(0,0%,10%)] border-[hsl(0,0%,14%)] text-[hsl(0,0%,98%)] placeholder:text-[hsl(0,0%,35%)] focus-visible:ring-0 focus-visible:border-[hsl(0,0%,25%)] rounded-md"
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
              <>
                {/* Templates Sub-section */}
                {(filteredTemplates.length > 0 || !search) && (
                  <div className="mt-1">
                    <button
                      onClick={() => toggleCategory("templates")}
                      className="flex items-center gap-1.5 w-full px-1.5 py-1.5 text-[hsl(0,0%,50%)] hover:text-[hsl(0,0%,65%)] transition-colors duration-100"
                    >
                      <ChevronDown
                        className={cn(
                          "w-3 h-3 transition-transform duration-100",
                          !expandedCategories.has("templates") && "-rotate-90"
                        )}
                      />
                      <BookOpen className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-medium tracking-wide">
                        TEMPLATES
                      </span>
                      <span className="text-[9px] text-[hsl(0,0%,30%)] ml-auto tabular-nums">
                        {filteredTemplates.length}
                      </span>
                    </button>

                    {expandedCategories.has("templates") && (
                      <div className="ml-1">
                        {Object.entries(templatesByCategory).map(([category, templates]) => (
                          <div key={category} className="mt-0.5">
                            <div className="flex items-center gap-1.5 px-1.5 py-0.5">
                              {(() => {
                                const CategoryIcon = playbookCategoryIcons[category as PlaybookCategory] || Target;
                                return <CategoryIcon className="w-3 h-3 text-[hsl(0,0%,30%)]" />;
                              })()}
                              <span className="text-[9px] text-[hsl(0,0%,35%)] uppercase tracking-wide">
                                {playbookCategories[category as PlaybookCategory]?.label || category}
                              </span>
                            </div>
                            {templates.map((playbook) => (
                              <PlaybookItem
                                key={playbook.id}
                                playbook={playbook}
                                onDragStart={onPlaybookDragStart}
                              />
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Patterns Sub-section */}
                {(filteredPatterns.length > 0 || !search) && (
                  <div className="mt-1">
                    <button
                      onClick={() => toggleCategory("patterns")}
                      className="flex items-center gap-1.5 w-full px-1.5 py-1.5 text-[hsl(0,0%,50%)] hover:text-[hsl(0,0%,65%)] transition-colors duration-100"
                    >
                      <ChevronDown
                        className={cn(
                          "w-3 h-3 transition-transform duration-100",
                          !expandedCategories.has("patterns") && "-rotate-90"
                        )}
                      />
                      <Puzzle className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-medium tracking-wide">
                        PATTERNS
                      </span>
                      <span className="text-[9px] text-[hsl(0,0%,30%)] ml-auto tabular-nums">
                        {filteredPatterns.length}
                      </span>
                    </button>

                    {expandedCategories.has("patterns") && (
                      <div className="ml-1">
                        {filteredPatterns.map((playbook) => (
                          <PlaybookItem
                            key={playbook.id}
                            playbook={playbook}
                            onDragStart={onPlaybookDragStart}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-[11px] text-[hsl(0,0%,35%)]">
                No playbooks found
              </div>
            )}
          </div>
        </div>

        {/* Drag Handle - Linear style: subtle, reveals on hover */}
        <div
          className="flex-shrink-0 h-[1px] relative group cursor-row-resize"
          onMouseDown={handleDragStart}
        >
          {/* Base line */}
          <div className="absolute inset-x-0 top-0 h-[1px] bg-[hsl(0,0%,12%)]" />
          {/* Hover indicator - wider hit area */}
          <div className="absolute inset-x-0 -top-1 h-[9px] flex items-center justify-center">
            {/* Visual handle that appears on hover */}
            <div className="w-8 h-[3px] rounded-full bg-[hsl(0,0%,20%)] opacity-0 group-hover:opacity-100 transition-opacity duration-100" />
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
                const config = categoryConfig[categoryKey];
                const categoryPrimitives = groupedPrimitives[categoryKey] || [];
                const isExpanded = expandedCategories.has(categoryKey);

                return (
                  <div key={categoryKey} className="mt-1">
                    {/* Category Header */}
                    <button
                      onClick={() => toggleCategory(categoryKey)}
                      className="flex items-center gap-1.5 w-full px-1.5 py-1.5 text-[hsl(0,0%,50%)] hover:text-[hsl(0,0%,65%)] transition-colors duration-100"
                    >
                      <ChevronDown
                        className={cn(
                          "w-3 h-3 transition-transform duration-100",
                          !isExpanded && "-rotate-90"
                        )}
                      />
                      <span className="text-[11px] font-medium tracking-wide">
                        {config.label}
                      </span>
                      <span className="text-[9px] text-[hsl(0,0%,30%)] ml-auto tabular-nums">
                        {categoryPrimitives.length}
                      </span>
                    </button>

                    {/* Primitives List */}
                    {isExpanded && (
                      <div className="ml-1">
                        {categoryPrimitives.map((primitive) => {
                          const IconComponent = iconMap[primitive.icon] || Database;

                          return (
                            <div
                              key={primitive.id}
                              draggable
                              onDragStart={(e) => onPrimitiveDragStart(e, primitive.id)}
                              className={cn(
                                "group/item flex items-center gap-2 px-1.5 py-[5px] rounded",
                                "cursor-grab active:cursor-grabbing",
                                "hover:bg-[hsl(0,0%,10%)] transition-colors duration-100"
                              )}
                            >
                              <IconComponent className="w-4 h-4 text-[hsl(0,0%,45%)] flex-shrink-0" />
                              <span className="text-[13px] text-[hsl(0,0%,75%)] truncate">
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
              <div className="flex items-center justify-center h-full text-[11px] text-[hsl(0,0%,35%)]">
                No primitives found
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer hint - very subtle */}
      <div className="px-3 py-2 flex-shrink-0">
        <p className="text-[10px] text-[hsl(0,0%,30%)] text-center">
          Drag to canvas
        </p>
      </div>
    </div>
  );
}

// Playbook item component
function PlaybookItem({
  playbook,
  onDragStart,
}: {
  playbook: Playbook;
  onDragStart: (e: React.DragEvent, id: string) => void;
}) {
  const IconComponent = iconMap[playbook.icon] || BookOpen;
  const nodeCount = playbook.nodes.length;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, playbook.id)}
      className={cn(
        "group/item flex items-center gap-2 px-1.5 py-[5px] rounded",
        "cursor-grab active:cursor-grabbing",
        "hover:bg-[hsl(0,0%,10%)] transition-colors duration-100"
      )}
    >
      <div
        className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${playbook.color}20` }}
      >
        <IconComponent
          className="w-3 h-3"
          style={{ color: playbook.color }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-[12px] text-[hsl(0,0%,75%)] truncate block">
          {playbook.name}
        </span>
      </div>
      <span className="text-[9px] text-[hsl(0,0%,35%)] tabular-nums">
        {nodeCount}n
      </span>
    </div>
  );
}
