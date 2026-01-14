"use client";

import { useState, useMemo } from "react";
import {
  Search,
  ChevronDown,
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
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { primitives, type Primitive } from "@/lib/primitives";
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

interface PrimitiveLibraryProps {
  className?: string;
}

export function PrimitiveLibrary({
  className,
}: PrimitiveLibraryProps) {
  const [search, setSearch] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(Object.keys(categoryConfig))
  );

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

  const onDragStart = (event: React.DragEvent, primitiveId: string) => {
    event.dataTransfer.setData("application/primitive", primitiveId);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className={cn(
      "flex flex-col h-full bg-[hsl(0,0%,7%)]",
      className
    )}>
      {/* Search - with space for collapse button on right */}
      <div className="p-2.5 pr-10">
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

      {/* Categories List */}
      <div className="flex-1 overflow-y-auto px-1.5">
        {sortedCategories.map((categoryKey) => {
          const config = categoryConfig[categoryKey];
          const categoryPrimitives = groupedPrimitives[categoryKey] || [];
          const isExpanded = expandedCategories.has(categoryKey);

          return (
            <div key={categoryKey} className="mt-1">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(categoryKey)}
                className="flex items-center gap-1.5 w-full px-1.5 py-1.5 text-[hsl(0,0%,50%)] hover:text-[hsl(0,0%,65%)] transition-colors"
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
                        onDragStart={(e) => onDragStart(e, primitive.id)}
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
        })}
      </div>

      {/* Footer hint - very subtle */}
      <div className="px-3 py-2">
        <p className="text-[10px] text-[hsl(0,0%,30%)] text-center">
          Drag to canvas
        </p>
      </div>
    </div>
  );
}
