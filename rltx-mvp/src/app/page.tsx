"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Plus,
  FileText,
  Loader2,
  Search,
  Settings,
  Home,
  Inbox,
  Star,
  Archive,
  BarChart2,
  MoreHorizontal,
  Trash2,
  Copy,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { RLTXIcon } from "@/components/ui/RLTXIcon";

interface WorkflowItem {
  id: string;
  name: string;
  question: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

type ViewFilter = "all" | "starred" | "analytics" | "archive";

export default function HomePage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newQuestion, setNewQuestion] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeView, setActiveView] = useState<ViewFilter>("all");
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    workflowId: string;
  } | null>(null);

  // Load starred IDs from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("rltx-starred-workflows");
    if (saved) {
      try {
        setStarredIds(new Set(JSON.parse(saved)));
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener("click", handleClick);
      return () => document.removeEventListener("click", handleClick);
    }
  }, [contextMenu]);

  const toggleStar = (id: string) => {
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      localStorage.setItem("rltx-starred-workflows", JSON.stringify(Array.from(next)));
      return next;
    });
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const fetchWorkflows = async () => {
    try {
      const res = await fetch("/api/workflows");
      if (res.ok) {
        const data = await res.json();
        setWorkflows(data);
      }
    } catch (error) {
      console.error("Failed to fetch workflows:", error);
    } finally {
      setLoading(false);
    }
  };

  const createWorkflow = async () => {
    if (!newName.trim() || !newQuestion.trim()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, question: newQuestion }),
      });

      if (res.ok) {
        const workflow = await res.json();
        router.push(`/workflow/${workflow.id}`);
      }
    } catch (error) {
      console.error("Failed to create workflow:", error);
    } finally {
      setCreating(false);
    }
  };

  const deleteWorkflow = async (id: string) => {
    try {
      await fetch(`/api/workflows/${id}`, { method: "DELETE" });
      setWorkflows((prev) => prev.filter((w) => w.id !== id));
    } catch (error) {
      console.error("Failed to delete workflow:", error);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, workflowId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, workflowId });
  };

  // Filter workflows
  const filteredWorkflows = useMemo(() => {
    let result = workflows;

    if (activeView === "starred") {
      result = result.filter((w) => starredIds.has(w.id));
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (w) =>
          w.name.toLowerCase().includes(query) ||
          w.question.toLowerCase().includes(query)
      );
    }

    return result;
  }, [workflows, activeView, searchQuery, starredIds]);

  const starredCount = workflows.filter((w) => starredIds.has(w.id)).length;

  // View title
  const viewTitles: Record<ViewFilter, string> = {
    all: "Workflows",
    starred: "Starred",
    analytics: "Analytics",
    archive: "Archive",
  };

  return (
    <div className="h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 border-r border-border flex flex-col">
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-border">
          <div className="flex items-center gap-2">
            <RLTXIcon className="w-6 h-6 text-foreground" />
            <div className="flex items-baseline gap-1">
              <span className="font-semibold text-foreground text-sm tracking-tight">rltx</span>
              <span className="font-[family-name:var(--font-space-grotesk)] font-medium text-foreground/70 text-sm tracking-wide">populous</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          <NavItem
            icon={Home}
            label="Home"
            active={activeView === "all"}
            onClick={() => setActiveView("all")}
          />
          <NavItem
            icon={Inbox}
            label="Inbox"
            count={0}
            onClick={() => {}}
          />
          <NavItem
            icon={Star}
            label="Starred"
            active={activeView === "starred"}
            count={starredCount}
            onClick={() => setActiveView("starred")}
          />
          <NavItem
            icon={BarChart2}
            label="Analytics"
            active={activeView === "analytics"}
            onClick={() => setActiveView("analytics")}
          />
          <NavItem
            icon={Archive}
            label="Archive"
            active={activeView === "archive"}
            onClick={() => setActiveView("archive")}
          />

          <div className="pt-4 pb-2">
            <span className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Workflows
            </span>
          </div>

          {workflows.slice(0, 5).map((w) => (
            <NavItem
              key={w.id}
              icon={FileText}
              label={w.name}
              onClick={() => router.push(`/workflow/${w.id}`)}
            />
          ))}
        </nav>

        {/* Footer */}
        <div className="p-2 border-t border-border">
          <NavItem icon={Settings} label="Settings" onClick={() => {}} />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-12 flex items-center justify-between px-6 border-b border-border flex-shrink-0">
          <div className="flex items-baseline gap-2">
            <h1 className="text-sm font-medium text-foreground">
              {viewTitles[activeView]}
            </h1>
            {activeView !== "analytics" && (
              <span className="text-xs text-muted-foreground">
                {filteredWorkflows.length} total
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {activeView !== "analytics" && (
              <>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-52 h-8 pl-8 text-xs bg-transparent border border-border hover:border-muted-foreground/30 focus:border-muted-foreground/50 placeholder:text-muted-foreground/40"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreate(true)}
                  className="h-8 gap-1.5 text-xs border-border hover:bg-secondary"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New
                </Button>
              </>
            )}
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {/* Create Modal */}
          {showCreate && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in">
              <div className="w-full max-w-md bg-card border border-border rounded-lg shadow-elevated animate-slide-up">
                <div className="p-4 border-b border-border">
                  <h2 className="text-sm font-medium text-foreground">New Workflow</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Define your decision or analysis question
                  </p>
                </div>
                <div className="p-4 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Name</label>
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Market Expansion Analysis"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Question</label>
                    <Input
                      value={newQuestion}
                      onChange={(e) => setNewQuestion(e.target.value)}
                      placeholder="Should we expand into Europe?"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
                <div className="p-4 border-t border-border flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCreate(false)}
                    className="h-8 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={createWorkflow}
                    disabled={creating || !newName.trim() || !newQuestion.trim()}
                    className="h-8 text-xs"
                  >
                    {creating ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      "Create"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Analytics View */}
          {activeView === "analytics" ? (
            <AnalyticsView />
          ) : loading ? (
            <div className="flex items-center justify-center h-64 px-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredWorkflows.length === 0 ? (
            <EmptyState
              onCreateClick={() => setShowCreate(true)}
              hasWorkflows={workflows.length > 0}
              activeView={activeView}
            />
          ) : (
            <div>
              {/* Table Header */}
              <div className="grid grid-cols-[1fr,100px,100px,32px] gap-4 px-4 py-2 border-b border-border">
                <span className="text-2xs font-medium text-muted-foreground uppercase tracking-wider">Name</span>
                <span className="text-2xs font-medium text-muted-foreground uppercase tracking-wider">Status</span>
                <span className="text-2xs font-medium text-muted-foreground uppercase tracking-wider">Updated</span>
                <span></span>
              </div>

              {/* Rows - Linear style: subtle hover, context menu */}
              <div>
                {filteredWorkflows.map((workflow) => (
                  <div
                    key={workflow.id}
                    onClick={() => router.push(`/workflow/${workflow.id}`)}
                    onContextMenu={(e) => handleContextMenu(e, workflow.id)}
                    className="grid grid-cols-[1fr,100px,100px,32px] gap-4 px-4 py-2.5 cursor-pointer hover:bg-[hsl(0,0%,8%)] transition-colors duration-75 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Star indicator - always visible if starred */}
                      {starredIds.has(workflow.id) && (
                        <Star className="w-3 h-3 text-amber-400 flex-shrink-0" fill="currentColor" />
                      )}
                      <div className="min-w-0">
                        <div className="text-sm text-foreground truncate">
                          {workflow.name}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {workflow.question}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center">
                      <StatusBadge status={workflow.status} />
                    </div>

                    <div className="text-xs text-muted-foreground flex items-center">
                      {formatDate(workflow.updatedAt)}
                    </div>

                    {/* More button - subtle, appears on hover */}
                    <div className="flex items-center justify-end">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleContextMenu(e, workflow.id);
                        }}
                        className="w-6 h-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-secondary text-muted-foreground hover:text-foreground transition-all duration-75"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          workflowId={contextMenu.workflowId}
          isStarred={starredIds.has(contextMenu.workflowId)}
          onStar={() => {
            toggleStar(contextMenu.workflowId);
            setContextMenu(null);
          }}
          onDelete={() => {
            deleteWorkflow(contextMenu.workflowId);
            setContextMenu(null);
          }}
          onOpen={() => {
            router.push(`/workflow/${contextMenu.workflowId}`);
            setContextMenu(null);
          }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

function NavItem({
  icon: Icon,
  label,
  active,
  count,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors duration-75",
        active
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
      )}
    >
      <Icon className="w-4 h-4 flex-shrink-0 opacity-70" />
      <span className="truncate flex-1 text-left text-[13px]">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="text-xs text-muted-foreground/60">{count}</span>
      )}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; dot: string }> = {
    draft: { bg: "bg-secondary", dot: "bg-muted-foreground/50" },
    running: { bg: "bg-blue-500/10", dot: "bg-blue-400" },
    completed: { bg: "bg-emerald-500/10", dot: "bg-emerald-400" },
    failed: { bg: "bg-red-500/10", dot: "bg-red-400" },
  };

  const style = config[status] || config.draft;

  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs", style.bg)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", style.dot)} />
      <span className="text-muted-foreground">{status}</span>
    </span>
  );
}

function ContextMenu({
  x,
  y,
  workflowId,
  isStarred,
  onStar,
  onDelete,
  onOpen,
  onClose,
}: {
  x: number;
  y: number;
  workflowId: string;
  isStarred: boolean;
  onStar: () => void;
  onDelete: () => void;
  onOpen: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed bg-popover border border-border rounded-lg shadow-elevated py-1 min-w-[160px] z-50 animate-fade-in"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={onOpen}
        className="w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-secondary flex items-center gap-2"
      >
        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
        Open
      </button>
      <button
        onClick={onStar}
        className="w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-secondary flex items-center gap-2"
      >
        <Star className="w-3.5 h-3.5 text-muted-foreground" fill={isStarred ? "currentColor" : "none"} />
        {isStarred ? "Remove star" : "Add star"}
      </button>
      <div className="h-px bg-border my-1" />
      <button
        onClick={onDelete}
        className="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-secondary flex items-center gap-2"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Delete
      </button>
    </div>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function EmptyState({
  onCreateClick,
  hasWorkflows,
  activeView,
}: {
  onCreateClick: () => void;
  hasWorkflows: boolean;
  activeView: ViewFilter;
}) {
  const messages: Record<ViewFilter, { icon: React.ElementType; title: string; desc: string }> = {
    all: {
      icon: FileText,
      title: hasWorkflows ? "No matching workflows" : "No workflows yet",
      desc: hasWorkflows
        ? "Try adjusting your search query"
        : "Create your first workflow to start analyzing decisions",
    },
    starred: {
      icon: Star,
      title: "No starred workflows",
      desc: "Star workflows to quickly access them here",
    },
    analytics: {
      icon: BarChart2,
      title: "Analytics",
      desc: "View workflow analytics and insights",
    },
    archive: {
      icon: Archive,
      title: "Archive is empty",
      desc: "Archived workflows will appear here",
    },
  };

  const { icon: Icon, title, desc } = messages[activeView];

  return (
    <div className="flex flex-col items-center justify-center h-64 text-center px-6">
      <div className="w-10 h-10 rounded-lg bg-secondary/50 flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-muted-foreground/60" />
      </div>
      <h2 className="text-sm font-medium text-foreground mb-1">{title}</h2>
      <p className="text-xs text-muted-foreground max-w-xs mb-4">{desc}</p>
      {!hasWorkflows && activeView === "all" && (
        <Button
          variant="outline"
          size="sm"
          onClick={onCreateClick}
          className="h-8 text-xs gap-1.5 border-border hover:bg-secondary"
        >
          <Plus className="w-3.5 h-3.5" />
          New Workflow
        </Button>
      )}
    </div>
  );
}

// ============ ANALYTICS VIEW ============

function AnalyticsView() {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");
  const data = useMemo(() => generateAnalyticsData(period), [period]);

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      {/* Period Selector */}
      <div className="flex items-center justify-end mb-6">
        <div className="flex items-center gap-1 p-1 bg-secondary/50 rounded-md">
          {(["7d", "30d", "90d"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded transition-colors",
                period === p
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p === "7d" ? "7 days" : p === "30d" ? "30 days" : "90 days"}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="Total Runs"
          value={data.totalRuns.toString()}
          change={data.runsChange}
        />
        <MetricCard
          label="Success Rate"
          value={`${data.successRate}%`}
          change={data.successChange}
        />
        <MetricCard
          label="Avg Duration"
          value={`${data.avgDuration}s`}
          change={data.durationChange}
          invertTrend
        />
        <MetricCard
          label="Total Cost"
          value={`$${data.totalCost.toFixed(2)}`}
          change={data.costChange}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="border border-border rounded-lg p-4">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Executions
          </h3>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.executionHistory}>
                <defs>
                  <linearGradient id="execGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(0,0%,40%)" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="hsl(0,0%,40%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,12%)" vertical={false} />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "hsl(0,0%,35%)" }}
                  tickFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "hsl(0,0%,35%)" }}
                  width={24}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(0,0%,50%)"
                  strokeWidth={1.5}
                  fill="url(#execGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="border border-border rounded-lg p-4">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Success Rate
          </h3>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.successHistory}>
                <defs>
                  <linearGradient id="successGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(145,40%,40%)" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="hsl(145,40%,40%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,12%)" vertical={false} />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "hsl(0,0%,35%)" }}
                  tickFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "hsl(0,0%,35%)" }}
                  width={24}
                  domain={[0, 100]}
                />
                <Tooltip content={<ChartTooltip suffix="%" />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(145,40%,45%)"
                  strokeWidth={1.5}
                  fill="url(#successGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border border-border rounded-lg">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Top Workflows
            </h3>
          </div>
          <div>
            {data.topWorkflows.map((wf, i) => (
              <div key={i} className="px-4 py-2.5 flex items-center gap-3 border-b border-border/50 last:border-0">
                <span className="text-xs text-muted-foreground/40 w-3 tabular-nums">{i + 1}</span>
                <span className="text-sm text-foreground flex-1 truncate">{wf.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{wf.runs}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-border rounded-lg">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Top Primitives
            </h3>
          </div>
          <div className="p-4 space-y-3">
            {data.topPrimitives.map((prim, i) => (
              <div key={i}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-foreground">{prim.name}</span>
                  <span className="text-muted-foreground tabular-nums">{prim.uses}</span>
                </div>
                <div className="h-1 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-foreground/25 rounded-full"
                    style={{ width: `${prim.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  change,
  invertTrend = false,
}: {
  label: string;
  value: string;
  change: number;
  invertTrend?: boolean;
}) {
  const isPositive = invertTrend ? change < 0 : change > 0;
  const isNegative = invertTrend ? change > 0 : change < 0;

  return (
    <div className="border border-border rounded-lg p-3">
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-semibold text-foreground tabular-nums">{value}</span>
        <span
          className={cn(
            "flex items-center gap-0.5 text-xs",
            isPositive && "text-emerald-400",
            isNegative && "text-rose-400",
            !isPositive && !isNegative && "text-muted-foreground"
          )}
        >
          {change > 0 ? <TrendingUp className="w-3 h-3" /> : change < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
          {Math.abs(change)}%
        </span>
      </div>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  prefix = "",
  suffix = "",
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  prefix?: string;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded px-2.5 py-1.5 shadow-lg">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground tabular-nums">
        {prefix}{payload[0].value}{suffix}
      </p>
    </div>
  );
}

function generateAnalyticsData(period: "7d" | "30d" | "90d") {
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;

  const genHistory = (base: number, variance: number) => {
    const arr = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      arr.push({
        date: d.toISOString().split("T")[0],
        value: Math.round(Math.max(0, base + (Math.random() - 0.5) * variance * 2)),
      });
    }
    return arr;
  };

  return {
    totalRuns: 47 + Math.round(Math.random() * 20),
    runsChange: Math.round((Math.random() - 0.3) * 25),
    successRate: 90 + Math.round(Math.random() * 8),
    successChange: Math.round((Math.random() - 0.4) * 10),
    avgDuration: Math.round((10 + Math.random() * 8) * 10) / 10,
    durationChange: Math.round((Math.random() - 0.5) * 15),
    totalCost: 40 + Math.random() * 30,
    costChange: Math.round((Math.random() - 0.3) * 20),
    executionHistory: genHistory(4, 3),
    successHistory: genHistory(92, 8),
    topWorkflows: [
      { name: "Market Expansion Analysis", runs: 23 },
      { name: "Pricing Strategy", runs: 18 },
      { name: "Competitor Response", runs: 15 },
      { name: "Investment Decision", runs: 12 },
      { name: "Risk Assessment", runs: 9 },
    ],
    topPrimitives: [
      { name: "Deep Analysis", uses: 89, pct: 100 },
      { name: "Monte Carlo", uses: 67, pct: 75 },
      { name: "Scenario Analysis", uses: 54, pct: 61 },
      { name: "Compare Options", uses: 43, pct: 48 },
      { name: "API Fetch", uses: 38, pct: 43 },
    ],
  };
}
