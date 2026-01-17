"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
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
  ExternalLink,
  Bell,
  ArchiveRestore,
  Database,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  Zap,
  AlertTriangle,
  Activity,
  CheckCircle,
  XCircle,
  RefreshCw,
  Lightbulb,
  Key,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Keyboard,
  Boxes,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { RLTXIcon } from "@/components/ui/RLTXIcon";
import { NewWorkflowModal } from "@/components/workflow/NewWorkflowModal";
import { DataPanel } from "@/components/data/DataPanel";
import { SimulationView } from "@/components/simulation/SimulationView";
import {
  useInboxStore,
  groupNotificationsByDate,
  formatNotificationTime,
  type Notification,
} from "@/stores/inbox";
import {
  useSettingsStore,
  MODEL_OPTIONS,
  AGENT_COUNT_OPTIONS,
  AUTO_ARCHIVE_OPTIONS,
  KEYBOARD_SHORTCUTS,
} from "@/stores/settings";

// ============ DESIGN TOKENS FROM DESIGN.MD ============
const colors = {
  // Backgrounds (DESIGN.md)
  bgBase: "hsl(0, 0%, 7%)",
  bgElevated: "hsl(0, 0%, 9%)",
  bgSurface: "hsl(0, 0%, 10%)",
  bgHover: "hsl(0, 0%, 12%)",
  bgActive: "hsl(0, 0%, 14%)",

  // Text (DESIGN.md)
  textPrimary: "hsl(0, 0%, 93%)",
  textSecondary: "hsl(0, 0%, 70%)",
  textTertiary: "hsl(0, 0%, 50%)",
  textQuaternary: "hsl(0, 0%, 35%)",
  textDisabled: "hsl(0, 0%, 25%)",

  // Icons (DESIGN.md)
  iconPrimary: "hsl(0, 0%, 70%)",
  iconSecondary: "hsl(0, 0%, 45%)",
  iconTertiary: "hsl(0, 0%, 30%)",
  iconEmpty: "hsl(0, 0%, 20%)", // For empty states

  // Borders (DESIGN.md)
  borderSubtle: "hsl(0, 0%, 12%)",
  borderDefault: "hsl(0, 0%, 15%)",
  borderHover: "hsl(0, 0%, 20%)",

  // Status Colors (DESIGN.md - exact values)
  statusSuccess: "hsl(142, 70%, 45%)",
  statusWarning: "hsl(38, 90%, 50%)",
  statusError: "hsl(0, 70%, 55%)",
  statusInfo: "hsl(210, 70%, 55%)",
};

interface WorkflowItem {
  id: string;
  name: string;
  question: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
}

type ViewFilter = "all" | "starred" | "inbox" | "analytics" | "archive" | "data" | "settings" | "simulation";

export default function HomePage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeView, setActiveView] = useState<ViewFilter>("all");
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [archivedIds, setArchivedIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    workflowId: string;
  } | null>(null);

  // Keyboard navigation state
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const commandInputRef = useRef<HTMLInputElement>(null);

  // Sidebar collapse state - Linear style
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Inbox store
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useInboxStore();
  const inboxUnreadCount = unreadCount();

  // Load starred, archived IDs, and sidebar state from localStorage
  useEffect(() => {
    const savedStarred = localStorage.getItem("rltx-starred-workflows");
    const savedArchived = localStorage.getItem("rltx-archived-workflows");
    const savedSidebarCollapsed = localStorage.getItem("rltx-sidebar-collapsed");
    if (savedStarred) {
      try {
        setStarredIds(new Set(JSON.parse(savedStarred)));
      } catch {}
    }
    if (savedArchived) {
      try {
        setArchivedIds(new Set(JSON.parse(savedArchived)));
      } catch {}
    }
    if (savedSidebarCollapsed) {
      setSidebarCollapsed(savedSidebarCollapsed === "true");
    }
  }, []);

  // Persist sidebar state
  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("rltx-sidebar-collapsed", String(next));
      return next;
    });
  };

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener("click", handleClick);
      return () => document.removeEventListener("click", handleClick);
    }
  }, [contextMenu]);

  // Filter workflows based on view
  const filteredWorkflows = useMemo(() => {
    let result = workflows;

    // Filter by archived state first
    if (activeView === "archive") {
      result = result.filter((w) => archivedIds.has(w.id));
    } else if (activeView !== "inbox" && activeView !== "analytics") {
      // Non-archive views exclude archived items
      result = result.filter((w) => !archivedIds.has(w.id));
    }

    if (activeView === "starred") {
      result = result.filter((w) => starredIds.has(w.id));
    }

    if (searchQuery && activeView !== "inbox" && activeView !== "analytics") {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (w) =>
          w.name.toLowerCase().includes(query) ||
          w.question.toLowerCase().includes(query)
      );
    }

    return result;
  }, [workflows, activeView, searchQuery, starredIds, archivedIds]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowCommandPalette(true);
        setCommandQuery("");
        return;
      }

      // Close modals on Escape
      if (e.key === "Escape") {
        if (showCommandPalette) {
          setShowCommandPalette(false);
          return;
        }
        if (showCreate) {
          setShowCreate(false);
          return;
        }
        if (contextMenu) {
          setContextMenu(null);
          return;
        }
        setSelectedIndex(-1);
        return;
      }

      // Don't handle navigation when in input, textarea, or modal
      const activeTag = document.activeElement?.tagName;
      const isEditable = document.activeElement instanceof HTMLElement &&
        document.activeElement.isContentEditable;
      if (
        showCreate ||
        showCommandPalette ||
        activeTag === "INPUT" ||
        activeTag === "TEXTAREA" ||
        isEditable
      ) {
        return;
      }

      // Only navigate in list views
      if (activeView === "analytics" || activeView === "inbox") return;

      const maxIndex = filteredWorkflows.length - 1;

      switch (e.key) {
        case "j":
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, maxIndex));
          break;
        case "k":
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex <= maxIndex) {
            router.push(`/workflow/${filteredWorkflows[selectedIndex].id}`);
          }
          break;
        case "s":
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex <= maxIndex) {
            toggleStar(filteredWorkflows[selectedIndex].id);
          }
          break;
        case "n":
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            setShowCreate(true);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    filteredWorkflows,
    selectedIndex,
    showCreate,
    showCommandPalette,
    contextMenu,
    activeView,
    router,
  ]);

  // Focus command input when palette opens
  useEffect(() => {
    if (showCommandPalette && commandInputRef.current) {
      commandInputRef.current.focus();
    }
  }, [showCommandPalette]);

  // Reset selection when view or filter changes
  useEffect(() => {
    setSelectedIndex(-1);
  }, [activeView, searchQuery]);

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

  const toggleArchive = (id: string) => {
    setArchivedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      localStorage.setItem("rltx-archived-workflows", JSON.stringify(Array.from(next)));
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

  const createWorkflow = async (config: {
    name: string;
    question: string;
    pattern: string;
    analysisDepth: "quick" | "standard" | "simulation";
  }) => {
    if (!config.name.trim() || !config.question.trim()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: config.name,
          question: config.question,
          pattern: config.pattern,
          analysisDepth: config.analysisDepth,
        }),
      });

      if (res.ok) {
        const workflow = await res.json();
        setShowCreate(false);
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

  const starredCount = workflows.filter(
    (w) => starredIds.has(w.id) && !archivedIds.has(w.id)
  ).length;
  const archivedCount = workflows.filter((w) => archivedIds.has(w.id)).length;

  const viewTitles: Record<ViewFilter, string> = {
    all: "Workflows",
    starred: "Starred",
    inbox: "Inbox",
    analytics: "Analytics",
    archive: "Archive",
    data: "Data Library",
    settings: "Settings",
    simulation: "Multiagent Simulation",
  };

  // Command palette items
  const commandItems = useMemo(() => {
    const items = [
      { id: "new", label: "New workflow", shortcut: "N", action: () => setShowCreate(true) },
      { id: "home", label: "Go to Home", shortcut: "G H", action: () => setActiveView("all") },
      { id: "starred", label: "Go to Starred", shortcut: "G S", action: () => setActiveView("starred") },
      { id: "analytics", label: "Go to Analytics", shortcut: "G A", action: () => setActiveView("analytics") },
      { id: "simulation", label: "Multiagent Simulation", shortcut: "G M", action: () => setActiveView("simulation") },
      ...workflows.slice(0, 5).map((w) => ({
        id: w.id,
        label: w.name,
        shortcut: "",
        action: () => router.push(`/workflow/${w.id}`),
      })),
    ];

    if (!commandQuery) return items;
    const q = commandQuery.toLowerCase();
    return items.filter((item) => item.label.toLowerCase().includes(q));
  }, [workflows, commandQuery, router]);

  // Show list for these views
  const showList = activeView === "all" || activeView === "starred" || activeView === "archive";

  return (
    <div className="h-screen flex" style={{ background: colors.bgBase }}>
      {/* Sidebar - Linear-style collapsible */}
      <aside
        className="flex-shrink-0 flex flex-col transition-all duration-200 ease-out"
        style={{
          width: sidebarCollapsed ? "52px" : "224px",
          borderRight: `1px solid ${colors.borderSubtle}`
        }}
      >
        {/* Logo + Toggle */}
        <div
          className={cn(
            "h-14 flex items-center",
            sidebarCollapsed ? "justify-center" : "justify-between"
          )}
          style={{
            borderBottom: `1px solid ${colors.borderSubtle}`,
            padding: sidebarCollapsed ? "0" : "0 16px",
          }}
        >
          {sidebarCollapsed ? (
            /* Collapsed: Logo only, clickable to expand */
            <button
              onClick={toggleSidebar}
              className="w-full h-full flex items-center justify-center transition-colors"
              style={{ color: colors.textPrimary }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.bgSurface;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
              title="Expand sidebar"
            >
              <RLTXIcon className="w-6 h-6" />
            </button>
          ) : (
            /* Expanded: Logo + text + toggle */
            <>
              <div className="flex items-center gap-2">
                <span style={{ color: colors.textPrimary }}>
                  <RLTXIcon className="w-6 h-6" />
                </span>
                <div className="flex items-baseline gap-1">
                  <span
                    className="font-semibold text-[13px] tracking-tight"
                    style={{ color: colors.textPrimary }}
                  >
                    rltx
                  </span>
                  <span
                    className="font-normal text-[13px] tracking-wide"
                    style={{ color: colors.textSecondary }}
                  >
                    populous
                  </span>
                </div>
              </div>
              <button
                onClick={toggleSidebar}
                className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded transition-colors"
                style={{ color: colors.iconSecondary }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = colors.bgHover;
                  e.currentTarget.style.color = colors.iconPrimary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = colors.iconSecondary;
                }}
                title="Collapse sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Navigation - DESIGN.md sidebar styling */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          <SidebarItem
            icon={Home}
            label="Home"
            active={activeView === "all"}
            onClick={() => setActiveView("all")}
            collapsed={sidebarCollapsed}
          />
          <SidebarItem
            icon={Boxes}
            label="Multiagent Simulation"
            active={activeView === "simulation"}
            onClick={() => setActiveView("simulation")}
            collapsed={sidebarCollapsed}
          />
          <SidebarItem
            icon={Inbox}
            label="Inbox"
            active={activeView === "inbox"}
            count={inboxUnreadCount > 0 ? inboxUnreadCount : undefined}
            onClick={() => setActiveView("inbox")}
            collapsed={sidebarCollapsed}
          />
          <SidebarItem
            icon={Star}
            label="Starred"
            active={activeView === "starred"}
            count={starredCount > 0 ? starredCount : undefined}
            onClick={() => setActiveView("starred")}
            collapsed={sidebarCollapsed}
          />
          <SidebarItem
            icon={Database}
            label="Data"
            active={activeView === "data"}
            onClick={() => setActiveView("data")}
            collapsed={sidebarCollapsed}
          />
          <SidebarItem
            icon={BarChart2}
            label="Analytics"
            active={activeView === "analytics"}
            onClick={() => setActiveView("analytics")}
            collapsed={sidebarCollapsed}
          />
          <SidebarItem
            icon={Archive}
            label="Archive"
            active={activeView === "archive"}
            count={archivedCount > 0 ? archivedCount : undefined}
            onClick={() => setActiveView("archive")}
            collapsed={sidebarCollapsed}
          />

          {!sidebarCollapsed && (
            <div className="pt-4 pb-2">
              <span
                className="px-2 text-[11px] font-medium uppercase"
                style={{ color: colors.textQuaternary, letterSpacing: "0.02em" }}
              >
                Workflows
              </span>
            </div>
          )}

          {!sidebarCollapsed && workflows
            .filter((w) => !archivedIds.has(w.id))
            .slice(0, 5)
            .map((w) => (
              <SidebarItem
                key={w.id}
                icon={FileText}
                label={w.name}
                onClick={() => router.push(`/workflow/${w.id}`)}
                collapsed={sidebarCollapsed}
              />
            ))}
        </nav>

        {/* Footer */}
        <div className="p-2 space-y-0.5" style={{ borderTop: `1px solid ${colors.borderSubtle}` }}>
          <button
            onClick={() => setShowCommandPalette(true)}
            className={cn(
              "w-full flex items-center rounded transition-colors",
              sidebarCollapsed ? "justify-center" : "gap-2"
            )}
            style={{
              padding: sidebarCollapsed ? "6px" : "6px 8px",
              color: colors.textTertiary,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = colors.bgSurface;
              e.currentTarget.style.color = colors.textSecondary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = colors.textTertiary;
            }}
            title={sidebarCollapsed ? "Search (⌘K)" : undefined}
          >
            <Search className="w-4 h-4 flex-shrink-0" style={{ color: colors.iconSecondary }} />
            {!sidebarCollapsed && (
              <>
                <span className="flex-1 text-left text-[13px]">Search</span>
                <kbd
                  className="text-[11px] px-1.5 py-0.5 rounded"
                  style={{ background: colors.bgHover, color: colors.textQuaternary, fontFamily: "monospace" }}
                >
                  ⌘K
                </kbd>
              </>
            )}
          </button>
          <SidebarItem
            icon={Settings}
            label="Settings"
            active={activeView === "settings"}
            onClick={() => setActiveView("settings")}
            collapsed={sidebarCollapsed}
          />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header - hidden for data view since DataPanel has its own */}
        {activeView !== "data" && (
          <header
            className="h-12 flex items-center justify-between px-6 flex-shrink-0"
            style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}
          >
            <div className="flex items-baseline gap-2">
              <h1 className="text-[13px] font-medium" style={{ color: colors.textPrimary }}>
                {viewTitles[activeView]}
              </h1>
              {showList && filteredWorkflows.length > 0 && (
                <span className="text-[11px]" style={{ color: colors.textTertiary }}>
                  {filteredWorkflows.length}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {showList && (
                <>
                  <div className="relative">
                    <Search
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                      style={{ color: colors.iconTertiary }}
                    />
                    <input
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-48 h-7 pl-8 pr-3 text-[13px] rounded outline-none transition-colors"
                      style={{
                        background: "transparent",
                        border: `1px solid ${colors.borderDefault}`,
                        color: colors.textPrimary,
                      }}
                      onFocus={(e) => (e.target.style.borderColor = colors.borderHover)}
                      onBlur={(e) => (e.target.style.borderColor = colors.borderDefault)}
                    />
                  </div>
                  {/* Only show New button in "all" view, not starred/archive */}
                  {activeView === "all" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCreate(true)}
                      className="h-7 gap-1.5 text-[13px]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      New
                    </Button>
                  )}
                </>
              )}
            </div>
          </header>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {/* Create Modal */}
          {showCreate && (
            <NewWorkflowModal
              onClose={() => setShowCreate(false)}
              onCreate={createWorkflow}
              creating={creating}
            />
          )}

          {/* Command Palette - DESIGN.md lines 698-727 */}
          {showCommandPalette && (
            <CommandPalette
              commandQuery={commandQuery}
              setCommandQuery={setCommandQuery}
              commandInputRef={commandInputRef}
              commandItems={commandItems}
              onClose={() => setShowCommandPalette(false)}
            />
          )}

          {/* View Content */}
          {activeView === "data" ? (
            <div className="h-full">
              <DataPanel />
            </div>
          ) : activeView === "analytics" ? (
            <AnalyticsView workflows={workflows} archivedIds={archivedIds} />
          ) : activeView === "simulation" ? (
            <SimulationView />
          ) : activeView === "inbox" ? (
            <InboxView
              notifications={notifications}
              onMarkRead={markAsRead}
              onMarkAllRead={markAllAsRead}
              onDelete={deleteNotification}
            />
          ) : activeView === "settings" ? (
            <SettingsView />
          ) : loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: colors.textTertiary }} />
            </div>
          ) : filteredWorkflows.length === 0 ? (
            <EmptyState activeView={activeView} onCreateClick={() => setShowCreate(true)} />
          ) : (
            <WorkflowList
              workflows={filteredWorkflows}
              selectedIndex={selectedIndex}
              starredIds={starredIds}
              archivedIds={archivedIds}
              activeView={activeView}
              onRowClick={(id) => router.push(`/workflow/${id}`)}
              onContextMenu={handleContextMenu}
            />
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
          isArchived={archivedIds.has(contextMenu.workflowId)}
          onStar={() => {
            toggleStar(contextMenu.workflowId);
            setContextMenu(null);
          }}
          onArchive={() => {
            toggleArchive(contextMenu.workflowId);
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
        />
      )}
    </div>
  );
}

// ============ SIDEBAR ITEM (DESIGN.md lines 483-502) - Linear-style with collapse support ============
function SidebarItem({
  icon: Icon,
  label,
  active,
  count,
  onClick,
  collapsed = false,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  count?: number;
  onClick: () => void;
  collapsed?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "w-full flex items-center rounded transition-all relative",
        collapsed ? "justify-center" : ""
      )}
      style={{
        padding: collapsed ? "6px" : "6px 8px",
        gap: collapsed ? "0" : "8px",
        background: active ? colors.bgHover : hovered ? colors.bgSurface : "transparent",
        color: active ? colors.textPrimary : hovered ? colors.textSecondary : colors.textTertiary,
      }}
      title={collapsed ? label : undefined}
    >
      <Icon
        className="w-4 h-4 flex-shrink-0"
        style={{ color: active ? colors.iconPrimary : colors.iconSecondary }}
      />
      {!collapsed && (
        <>
          <span className="truncate flex-1 text-left text-[13px]">{label}</span>
          {count !== undefined && (
            <span className="text-[11px] tabular-nums" style={{ color: colors.textQuaternary }}>
              {count}
            </span>
          )}
        </>
      )}
      {collapsed && count !== undefined && count > 0 && (
        <span
          className="absolute top-0 right-0 w-2 h-2 rounded-full"
          style={{ background: colors.statusInfo }}
        />
      )}
    </button>
  );
}

// ============ COMMAND PALETTE (DESIGN.MD lines 698-727) ============
function CommandPalette({
  commandQuery,
  setCommandQuery,
  commandInputRef,
  commandItems,
  onClose,
}: {
  commandQuery: string;
  setCommandQuery: (v: string) => void;
  commandInputRef: React.RefObject<HTMLInputElement>;
  commandItems: { id: string; label: string; shortcut: string; action: () => void }[];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 flex items-start justify-center pt-[20vh] z-50 animate-fade-in"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="overflow-hidden animate-slide-up"
        style={{
          width: "560px", // DESIGN.md: 560px
          maxHeight: "400px",
          background: colors.bgSurface,
          border: `1px solid ${colors.borderDefault}`,
          borderRadius: "8px", // DESIGN.md: 8px
          boxShadow: "0 16px 48px rgba(0,0,0,0.6)", // DESIGN.md: modal shadow
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input - NO search icon per Linear design */}
        <div style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}>
          <input
            ref={commandInputRef}
            value={commandQuery}
            onChange={(e) => setCommandQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="w-full outline-none"
            style={{
              padding: "12px 16px", // DESIGN.md: 12px 16px
              fontSize: "15px", // DESIGN.md: 15px
              background: "transparent",
              color: colors.textPrimary,
            }}
          />
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: "calc(400px - 48px)", padding: "4px" }}>
          {commandItems.length === 0 ? (
            <div
              className="py-8 text-center text-[13px]"
              style={{ color: colors.textTertiary }}
            >
              No results found
            </div>
          ) : (
            commandItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  item.action();
                  onClose();
                }}
                className="w-full flex items-center justify-between rounded transition-colors"
                style={{
                  padding: "8px 12px", // DESIGN.md: 8px 12px
                  color: colors.textSecondary,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = colors.bgActive)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span className="text-[13px]">{item.label}</span>
                {item.shortcut && (
                  <span
                    className="text-[11px]"
                    style={{ color: colors.textQuaternary, fontFamily: "monospace" }}
                  >
                    {item.shortcut}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ============ WORKFLOW LIST ============
function WorkflowList({
  workflows,
  selectedIndex,
  starredIds,
  archivedIds,
  activeView,
  onRowClick,
  onContextMenu,
}: {
  workflows: WorkflowItem[];
  selectedIndex: number;
  starredIds: Set<string>;
  archivedIds: Set<string>;
  activeView: ViewFilter;
  onRowClick: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}) {
  return (
    <div>
      {/* Table Header */}
      <div
        className="grid grid-cols-[1fr,80px,80px,28px] gap-4 px-4 py-2"
        style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}
      >
        <span
          className="text-[11px] font-medium uppercase"
          style={{ color: colors.textQuaternary, letterSpacing: "0.02em" }}
        >
          Name
        </span>
        <span
          className="text-[11px] font-medium uppercase"
          style={{ color: colors.textQuaternary, letterSpacing: "0.02em" }}
        >
          Status
        </span>
        <span
          className="text-[11px] font-medium uppercase"
          style={{ color: colors.textQuaternary, letterSpacing: "0.02em" }}
        >
          Updated
        </span>
        <span></span>
      </div>

      {/* Rows */}
      {workflows.map((workflow, index) => (
        <WorkflowRow
          key={workflow.id}
          workflow={workflow}
          isSelected={selectedIndex === index}
          isStarred={starredIds.has(workflow.id)}
          onClick={() => onRowClick(workflow.id)}
          onContextMenu={(e) => onContextMenu(e, workflow.id)}
        />
      ))}
    </div>
  );
}

function WorkflowRow({
  workflow,
  isSelected,
  isStarred,
  onClick,
  onContextMenu,
}: {
  workflow: WorkflowItem;
  isSelected: boolean;
  isStarred: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const [hovered, setHovered] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    // Prevent double-firing and ensure click registers
    e.preventDefault();
    onClick();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="grid grid-cols-[1fr,80px,80px,28px] gap-4 px-4 py-2 cursor-pointer transition-colors group select-none"
      style={{
        background: isSelected ? colors.bgHover : hovered ? colors.bgSurface : "transparent",
      }}
    >
      <div className="flex items-center gap-2.5 min-w-0 pointer-events-none">
        {isStarred && (
          <Star
            className="w-3 h-3 flex-shrink-0"
            style={{ color: colors.statusWarning }}
            fill="currentColor"
          />
        )}
        <div className="min-w-0">
          <div className="text-[13px] truncate" style={{ color: colors.textPrimary }}>
            {workflow.name}
          </div>
          <div className="text-[11px] truncate" style={{ color: colors.textTertiary }}>
            {workflow.question}
          </div>
        </div>
      </div>

      <div className="flex items-center pointer-events-none">
        <StatusBadge status={workflow.status} />
      </div>

      <div
        className="text-[11px] flex items-center tabular-nums pointer-events-none"
        style={{ color: colors.textTertiary }}
      >
        {formatDate(workflow.updatedAt)}
      </div>

      <div className="flex items-center justify-end">
        <button
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onContextMenu(e);
          }}
          className="w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto"
          style={{ color: colors.iconSecondary }}
          onMouseEnter={(e) => (e.currentTarget.style.background = colors.bgHover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ============ STATUS BADGE (using DESIGN.md status colors) ============
function StatusBadge({ status }: { status: string }) {
  const getStatusColor = () => {
    switch (status) {
      case "completed":
        return colors.statusSuccess;
      case "running":
        return colors.statusInfo;
      case "failed":
        return colors.statusError;
      default:
        return colors.textQuaternary;
    }
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: getStatusColor() }}
      />
      <span className="text-[11px]" style={{ color: colors.textTertiary }}>
        {status}
      </span>
    </span>
  );
}

// ============ CONTEXT MENU ============
function ContextMenu({
  x,
  y,
  workflowId,
  isStarred,
  isArchived,
  onStar,
  onArchive,
  onDelete,
  onOpen,
}: {
  x: number;
  y: number;
  workflowId: string;
  isStarred: boolean;
  isArchived: boolean;
  onStar: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onOpen: () => void;
}) {
  return (
    <div
      className="fixed rounded-md py-1 min-w-[160px] z-50 animate-fade-in"
      style={{
        left: x,
        top: y,
        background: colors.bgSurface,
        border: `1px solid ${colors.borderDefault}`,
        boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <ContextMenuItem icon={ExternalLink} label="Open" onClick={onOpen} />
      <ContextMenuItem
        icon={Star}
        label={isStarred ? "Remove star" : "Add star"}
        onClick={onStar}
      />
      <ContextMenuItem
        icon={isArchived ? ArchiveRestore : Archive}
        label={isArchived ? "Unarchive" : "Archive"}
        onClick={onArchive}
      />
      <div className="h-px my-1" style={{ background: colors.borderSubtle }} />
      <ContextMenuItem icon={Trash2} label="Delete" onClick={onDelete} destructive />
    </div>
  );
}

function ContextMenuItem({
  icon: Icon,
  label,
  onClick,
  destructive,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-[13px] transition-colors"
      style={{
        background: hovered ? colors.bgActive : "transparent",
        color: destructive ? colors.statusError : colors.textSecondary,
      }}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

// ============ EMPTY STATE (DESIGN.MD lines 755-778) ============
function EmptyState({
  activeView,
  onCreateClick,
}: {
  activeView: ViewFilter;
  onCreateClick: () => void;
}) {
  const config: Record<ViewFilter, { icon: React.ElementType; title: string; desc: string }> = {
    all: {
      icon: FileText,
      title: "No workflows yet",
      desc: "Create your first workflow to get started",
    },
    starred: {
      icon: Star,
      title: "No starred workflows",
      desc: "Star workflows to quickly access them here",
    },
    inbox: {
      icon: Inbox,
      title: "Inbox is empty",
      desc: "Notifications and updates will appear here",
    },
    analytics: {
      icon: BarChart2,
      title: "No analytics",
      desc: "Run workflows to see analytics",
    },
    archive: {
      icon: Archive,
      title: "Archive is empty",
      desc: "Archived workflows will appear here",
    },
    data: {
      icon: Database,
      title: "No data yet",
      desc: "Upload CSV, JSON, or PDF files to use in workflows",
    },
    settings: {
      icon: Settings,
      title: "Settings",
      desc: "Configure your account and preferences",
    },
  };

  const { icon: Icon, title, desc } = config[activeView];

  return (
    // design.md: padding 48px 24px, centered
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{ padding: "48px 24px" }}
    >
      {/* design.md: icon color hsl(0,0%,20%), margin-bottom 16px */}
      <Icon className="w-6 h-6" style={{ color: colors.iconEmpty, marginBottom: "16px" }} />
      {/* design.md: 13px, font-weight 500, hsl(0,0%,50%) */}
      <h2
        className="text-[13px] font-medium"
        style={{ color: colors.textTertiary }}
      >
        {title}
      </h2>
      {/* design.md: 13px, hsl(0,0%,35%), margin-top 4px */}
      <p className="text-[13px] max-w-xs" style={{ color: colors.textQuaternary, marginTop: "4px" }}>
        {desc}
      </p>
      {activeView === "all" && (
        <Button
          variant="outline"
          size="sm"
          onClick={onCreateClick}
          className="mt-4 h-7 text-[13px] gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          New Workflow
        </Button>
      )}
    </div>
  );
}

// ============ INBOX VIEW - DESIGN.MD VERBATIM ============
function InboxView({
  notifications,
  onMarkRead,
  onMarkAllRead,
  onDelete,
}: {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDelete: (id: string) => void;
}) {
  const groupedNotifications = groupNotificationsByDate(notifications);
  const hasUnread = notifications.some((n) => !n.read);

  // Empty state
  if (notifications.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center text-center"
        style={{ padding: "48px 24px" }}
      >
        <Bell className="w-6 h-6" style={{ color: colors.iconEmpty, marginBottom: "16px" }} />
        <h2 className="text-[13px] font-medium" style={{ color: colors.textTertiary }}>
          No notifications
        </h2>
        <p className="text-[13px] max-w-xs" style={{ color: colors.textQuaternary, marginTop: "4px" }}>
          Workflow updates and activity will appear here
        </p>
      </div>
    );
  }

  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "simulation_complete":
        return <CheckCircle className="w-4 h-4" style={{ color: "hsl(142, 70%, 45%)" }} />;
      case "simulation_failed":
        return <XCircle className="w-4 h-4" style={{ color: "hsl(0, 70%, 55%)" }} />;
      case "data_sync":
        return <RefreshCw className="w-4 h-4" style={{ color: "hsl(210, 70%, 55%)" }} />;
      case "insight":
        return <Lightbulb className="w-4 h-4" style={{ color: "hsl(38, 90%, 50%)" }} />;
      case "threshold_alert":
        return <AlertTriangle className="w-4 h-4" style={{ color: "hsl(0, 70%, 55%)" }} />;
      default:
        return <Bell className="w-4 h-4" style={{ color: colors.iconSecondary }} />;
    }
  };

  return (
    <div className="h-full overflow-auto">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 sticky top-0"
        style={{ background: colors.bgBase, borderBottom: `1px solid ${colors.borderSubtle}` }}
      >
        <h2 className="text-[13px] font-medium" style={{ color: colors.textPrimary }}>
          Inbox
        </h2>
        {hasUnread && (
          <button
            onClick={onMarkAllRead}
            className="text-[12px] px-2 py-1 rounded transition-colors"
            style={{ color: colors.textTertiary }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = colors.bgHover;
              e.currentTarget.style.color = colors.textSecondary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = colors.textTertiary;
            }}
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Notification groups */}
      <div className="py-1">
        {groupedNotifications.map((group) => (
          <div key={group.label}>
            {/* Group label */}
            <div
              className="px-4 py-2 text-[11px] font-medium"
              style={{ color: colors.textQuaternary }}
            >
              {group.label}
            </div>

            {/* Notifications */}
            {group.notifications.map((notification) => (
              <div
                key={notification.id}
                className="group flex items-start gap-3 px-4 py-2.5 cursor-pointer transition-colors"
                style={{ background: notification.read ? "transparent" : colors.bgSurface }}
                onClick={() => !notification.read && onMarkRead(notification.id)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = colors.bgHover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = notification.read ? "transparent" : colors.bgSurface;
                }}
              >
                {/* Unread indicator */}
                <div className="w-1.5 flex-shrink-0 pt-1.5">
                  {!notification.read && (
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: "hsl(210, 70%, 55%)" }}
                    />
                  )}
                </div>

                {/* Icon */}
                <div className="flex-shrink-0 pt-0.5">
                  {getNotificationIcon(notification.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className="text-[13px] truncate"
                      style={{ color: notification.read ? colors.textSecondary : colors.textPrimary }}
                    >
                      {notification.title}
                    </span>
                    <span className="text-[11px] flex-shrink-0" style={{ color: colors.textQuaternary }}>
                      {formatNotificationTime(notification.timestamp)}
                    </span>
                  </div>
                  {notification.description && (
                    <p
                      className="text-[12px] mt-0.5 line-clamp-2"
                      style={{ color: colors.textTertiary }}
                    >
                      {notification.description}
                    </p>
                  )}
                </div>

                {/* Delete button - hover reveal */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(notification.id);
                  }}
                  className="flex-shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: colors.iconSecondary }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = colors.bgActive;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ SETTINGS VIEW - DESIGN.MD VERBATIM ============
function SettingsView() {
  const settings = useSettingsStore();
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showMergeKey, setShowMergeKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);

  // Input component for settings - inline label style
  const SettingInput = ({
    label,
    value,
    onChange,
    type = "text",
    placeholder,
    showToggle,
    isVisible,
    onToggleVisibility,
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
    placeholder?: string;
    showToggle?: boolean;
    isVisible?: boolean;
    onToggleVisibility?: () => void;
  }) => (
    <div className="flex items-center justify-between py-2">
      <label className="text-[13px]" style={{ color: colors.textSecondary }}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type={showToggle && !isVisible ? "password" : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-48 px-2 py-1 text-[13px] rounded outline-none transition-colors text-right"
          style={{
            background: colors.bgSurface,
            border: `1px solid ${colors.borderDefault}`,
            color: colors.textPrimary,
          }}
          onFocus={(e) => (e.target.style.borderColor = colors.borderHover)}
          onBlur={(e) => (e.target.style.borderColor = colors.borderDefault)}
        />
        {showToggle && (
          <button
            onClick={onToggleVisibility}
            className="p-1 rounded transition-colors"
            style={{ color: colors.iconSecondary }}
            onMouseEnter={(e) => (e.currentTarget.style.background = colors.bgHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );

  // Select component for settings
  const SettingSelect = <T extends string | number>({
    label,
    value,
    options,
    onChange,
  }: {
    label: string;
    value: T;
    options: { value: T; label: string }[];
    onChange: (value: T) => void;
  }) => (
    <div className="flex items-center justify-between py-2">
      <label className="text-[13px]" style={{ color: colors.textSecondary }}>
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          className="appearance-none w-36 px-2 py-1 pr-7 text-[13px] rounded outline-none cursor-pointer"
          style={{
            background: colors.bgSurface,
            border: `1px solid ${colors.borderDefault}`,
            color: colors.textPrimary,
          }}
        >
          {options.map((opt) => (
            <option key={String(opt.value)} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
          style={{ color: colors.iconSecondary }}
        />
      </div>
    </div>
  );

  // Toggle component for settings
  const SettingToggle = ({
    label,
    checked,
    onChange,
  }: {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
  }) => (
    <div className="flex items-center justify-between py-2">
      <label className="text-[13px]" style={{ color: colors.textSecondary }}>
        {label}
      </label>
      <button
        onClick={() => onChange(!checked)}
        className="w-9 h-5 rounded-full transition-colors relative"
        style={{
          background: checked ? "hsl(210, 70%, 55%)" : colors.bgHover,
        }}
      >
        <div
          className="absolute top-0.5 w-4 h-4 rounded-full transition-transform"
          style={{
            background: colors.textPrimary,
            transform: checked ? "translateX(18px)" : "translateX(2px)",
          }}
        />
      </button>
    </div>
  );

  return (
    <div className="h-full overflow-auto">
      {/* Header */}
      <div
        className="px-4 py-3 sticky top-0"
        style={{ background: colors.bgBase, borderBottom: `1px solid ${colors.borderSubtle}` }}
      >
        <h2 className="text-[13px] font-medium" style={{ color: colors.textPrimary }}>
          Settings
        </h2>
      </div>

      {/* Settings sections */}
      <div className="px-4 py-4 space-y-6 max-w-xl">
        {/* Account */}
        <section>
          <h3
            className="text-[11px] font-medium uppercase tracking-wide mb-2"
            style={{ color: colors.textQuaternary }}
          >
            Account
          </h3>
          <div style={{ borderTop: `1px solid ${colors.borderSubtle}` }}>
            <SettingInput
              label="Name"
              value={settings.name}
              onChange={(v) => settings.updateSetting("name", v)}
              placeholder="Your name"
            />
            <SettingInput
              label="Email"
              value={settings.email}
              onChange={(v) => settings.updateSetting("email", v)}
              placeholder="you@example.com"
              type="email"
            />
          </div>
        </section>

        {/* API Keys */}
        <section>
          <h3
            className="text-[11px] font-medium uppercase tracking-wide mb-2 flex items-center gap-2"
            style={{ color: colors.textQuaternary }}
          >
            <Key className="w-3 h-3" />
            API Keys
          </h3>
          <div style={{ borderTop: `1px solid ${colors.borderSubtle}` }}>
            <SettingInput
              label="Anthropic API Key"
              value={settings.anthropicApiKey}
              onChange={(v) => settings.updateSetting("anthropicApiKey", v)}
              placeholder="sk-ant-..."
              showToggle
              isVisible={showAnthropicKey}
              onToggleVisibility={() => setShowAnthropicKey(!showAnthropicKey)}
            />
            <SettingInput
              label="Merge.dev API Key"
              value={settings.mergeApiKey}
              onChange={(v) => settings.updateSetting("mergeApiKey", v)}
              placeholder="prod_..."
              showToggle
              isVisible={showMergeKey}
              onToggleVisibility={() => setShowMergeKey(!showMergeKey)}
            />
            <SettingInput
              label="OpenAI API Key"
              value={settings.openaiApiKey}
              onChange={(v) => settings.updateSetting("openaiApiKey", v)}
              placeholder="sk-..."
              showToggle
              isVisible={showOpenaiKey}
              onToggleVisibility={() => setShowOpenaiKey(!showOpenaiKey)}
            />
          </div>
        </section>

        {/* Defaults */}
        <section>
          <h3
            className="text-[11px] font-medium uppercase tracking-wide mb-2"
            style={{ color: colors.textQuaternary }}
          >
            Defaults
          </h3>
          <div style={{ borderTop: `1px solid ${colors.borderSubtle}` }}>
            <SettingSelect
              label="Default Model"
              value={settings.defaultModel}
              options={MODEL_OPTIONS}
              onChange={(v) => settings.updateSetting("defaultModel", v)}
            />
            <SettingSelect
              label="Default Agent Count"
              value={settings.defaultAgentCount}
              options={AGENT_COUNT_OPTIONS}
              onChange={(v) => settings.updateSetting("defaultAgentCount", v)}
            />
            <SettingSelect
              label="Auto-archive after"
              value={settings.autoArchiveDays}
              options={AUTO_ARCHIVE_OPTIONS}
              onChange={(v) => settings.updateSetting("autoArchiveDays", v)}
            />
          </div>
        </section>

        {/* Notifications */}
        <section>
          <h3
            className="text-[11px] font-medium uppercase tracking-wide mb-2"
            style={{ color: colors.textQuaternary }}
          >
            Notifications
          </h3>
          <div style={{ borderTop: `1px solid ${colors.borderSubtle}` }}>
            <SettingToggle
              label="Simulation complete"
              checked={settings.notifications.simulationComplete}
              onChange={(v) => settings.updateNotificationPref("simulationComplete", v)}
            />
            <SettingToggle
              label="Simulation failed"
              checked={settings.notifications.simulationFailed}
              onChange={(v) => settings.updateNotificationPref("simulationFailed", v)}
            />
            <SettingToggle
              label="Data sync updates"
              checked={settings.notifications.dataSyncUpdates}
              onChange={(v) => settings.updateNotificationPref("dataSyncUpdates", v)}
            />
            <SettingToggle
              label="Threshold alerts"
              checked={settings.notifications.thresholdAlerts}
              onChange={(v) => settings.updateNotificationPref("thresholdAlerts", v)}
            />
            <SettingToggle
              label="Weekly digest"
              checked={settings.notifications.weeklyDigest}
              onChange={(v) => settings.updateNotificationPref("weeklyDigest", v)}
            />
          </div>
        </section>

        {/* Data */}
        <section>
          <h3
            className="text-[11px] font-medium uppercase tracking-wide mb-2"
            style={{ color: colors.textQuaternary }}
          >
            Data
          </h3>
          <div
            className="flex items-center gap-3 pt-2"
            style={{ borderTop: `1px solid ${colors.borderSubtle}` }}
          >
            <button
              onClick={settings.clearAllData}
              className="px-3 py-1.5 text-[13px] rounded transition-colors"
              style={{
                background: "transparent",
                border: `1px solid ${colors.borderDefault}`,
                color: colors.textSecondary,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.bgHover;
                e.currentTarget.style.borderColor = colors.borderHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = colors.borderDefault;
              }}
            >
              Clear cached data
            </button>
            <button
              onClick={settings.exportData}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] rounded transition-colors"
              style={{
                background: "transparent",
                border: `1px solid ${colors.borderDefault}`,
                color: colors.textSecondary,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.bgHover;
                e.currentTarget.style.borderColor = colors.borderHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = colors.borderDefault;
              }}
            >
              <Download className="w-3.5 h-3.5" />
              Export all data
            </button>
          </div>
        </section>

        {/* Keyboard Shortcuts */}
        <section>
          <h3
            className="text-[11px] font-medium uppercase tracking-wide mb-2 flex items-center gap-2"
            style={{ color: colors.textQuaternary }}
          >
            <Keyboard className="w-3 h-3" />
            Keyboard Shortcuts
          </h3>
          <div style={{ borderTop: `1px solid ${colors.borderSubtle}` }}>
            {KEYBOARD_SHORTCUTS.map((shortcut) => (
              <div
                key={shortcut.keys}
                className="flex items-center justify-between py-2"
              >
                <span className="text-[13px]" style={{ color: colors.textSecondary }}>
                  {shortcut.description}
                </span>
                <kbd
                  className="px-2 py-0.5 text-[11px] rounded"
                  style={{
                    background: colors.bgHover,
                    color: colors.textTertiary,
                    fontFamily: "monospace",
                  }}
                >
                  {shortcut.keys}
                </kbd>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

// ============ COMPREHENSIVE ANALYTICS VIEW (Real Data) ============
function AnalyticsView({
  workflows,
  archivedIds,
}: {
  workflows: WorkflowItem[];
  archivedIds: Set<string>;
}) {
  const [period, setPeriod] = useState<"7d" | "14d" | "30d">("14d");
  const periodDays = period === "7d" ? 7 : period === "30d" ? 30 : 14;

  // Compute real metrics from local workflow data
  const metrics = useMemo(() => {
    const activeWorkflows = workflows.filter((w) => !archivedIds.has(w.id));
    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - periodDays);

    // Filter workflows within period
    const workflowsInPeriod = activeWorkflows.filter(
      (w) => new Date(w.createdAt) >= periodStart
    );

    // Status counts
    const completed = activeWorkflows.filter((w) => w.status === "completed").length;
    const running = activeWorkflows.filter((w) => w.status === "running").length;
    const failed = activeWorkflows.filter((w) => w.status === "failed").length;
    const draft = activeWorkflows.filter((w) => w.status === "draft").length;

    // Success rate
    const finishedWorkflows = completed + failed;
    const successRate = finishedWorkflows > 0 ? Math.round((completed / finishedWorkflows) * 100) : 0;

    // Generate activity history (workflows created per day)
    const activityHistory: { date: string; value: number }[] = [];
    for (let i = periodDays - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      const count = activeWorkflows.filter((w) => {
        const created = new Date(w.createdAt).toISOString().split("T")[0];
        return created === dateStr;
      }).length;
      activityHistory.push({ date: dateStr, value: count });
    }

    // Previous period for comparison
    const prevPeriodStart = new Date(periodStart);
    prevPeriodStart.setDate(prevPeriodStart.getDate() - periodDays);
    const workflowsInPrevPeriod = activeWorkflows.filter((w) => {
      const created = new Date(w.createdAt);
      return created >= prevPeriodStart && created < periodStart;
    });

    const prevCount = workflowsInPrevPeriod.length;
    const currCount = workflowsInPeriod.length;
    const change = prevCount > 0 ? Math.round(((currCount - prevCount) / prevCount) * 100) : currCount > 0 ? 100 : 0;

    return {
      total: activeWorkflows.length,
      completed,
      running,
      failed,
      draft,
      successRate,
      activityHistory,
      change,
      workflowsInPeriod: currCount,
    };
  }, [workflows, archivedIds, periodDays]);

  const formatChartDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (periodDays <= 7) {
      return date.toLocaleDateString("en-US", { weekday: "short" });
    }
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Empty state if no workflows
  if (workflows.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center text-center"
        style={{ padding: "48px 24px" }}
      >
        <BarChart2 className="w-6 h-6" style={{ color: colors.iconEmpty, marginBottom: "16px" }} />
        <h2 className="text-[13px] font-medium" style={{ color: colors.textTertiary }}>
          No analytics yet
        </h2>
        <p className="text-[13px] max-w-xs" style={{ color: colors.textQuaternary, marginTop: "4px" }}>
          Create workflows to see analytics
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      {/* Period Selector */}
      <div className="flex items-center justify-end gap-1 px-6 pt-4 pb-2">
        {(["7d", "14d", "30d"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              "px-2.5 py-1 rounded text-[11px] font-medium transition-all duration-100",
              period === p
                ? "bg-[hsl(0,0%,14%)] text-[hsl(0,0%,93%)]"
                : "text-[hsl(0,0%,50%)] hover:text-[hsl(0,0%,70%)] hover:bg-[hsl(0,0%,10%)]"
            )}
          >
            {p === "7d" ? "7 days" : p === "14d" ? "14 days" : "30 days"}
          </button>
        ))}
      </div>

      <div className="px-6 pb-6 space-y-4">
        {/* Primary Metrics Row */}
        <div className="grid grid-cols-4 gap-3">
          <AnalyticsMetricCard label="Total Workflows" value={metrics.total.toString()} change={metrics.change} />
          <AnalyticsMetricCard label="Completed" value={metrics.completed.toString()} change={0} />
          <AnalyticsMetricCard label="Running" value={metrics.running.toString()} change={0} />
          <AnalyticsMetricCard label="Success Rate" value={`${metrics.successRate}%`} change={0} />
        </div>

        {/* Status Breakdown */}
        <AnalyticsSectionCard title="Workflow Status" icon={<Target className="w-3.5 h-3.5" />}>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <div className="text-[20px] font-semibold tabular-nums" style={{ color: colors.statusSuccess }}>
                {metrics.completed}
              </div>
              <div className="text-[11px]" style={{ color: colors.textTertiary }}>Completed</div>
            </div>
            <div>
              <div className="text-[20px] font-semibold tabular-nums" style={{ color: colors.statusInfo }}>
                {metrics.running}
              </div>
              <div className="text-[11px]" style={{ color: colors.textTertiary }}>Running</div>
            </div>
            <div>
              <div className="text-[20px] font-semibold tabular-nums" style={{ color: colors.textSecondary }}>
                {metrics.draft}
              </div>
              <div className="text-[11px]" style={{ color: colors.textTertiary }}>Draft</div>
            </div>
            <div>
              <div className="text-[20px] font-semibold tabular-nums" style={{ color: colors.statusError }}>
                {metrics.failed}
              </div>
              <div className="text-[11px]" style={{ color: colors.textTertiary }}>Failed</div>
            </div>
          </div>
        </AnalyticsSectionCard>

        {/* Activity Chart */}
        <AnalyticsSectionCard title="Workflow Activity">
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.activityHistory}>
                <defs>
                  <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(0, 0%, 45%)" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="hsl(0, 0%, 45%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.borderSubtle} vertical={false} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: colors.textQuaternary }} tickFormatter={formatChartDate} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: colors.textQuaternary }} width={28} allowDecimals={false} />
                <Tooltip content={<AnalyticsTooltip />} />
                <Area type="monotone" dataKey="value" stroke="hsl(0, 0%, 55%)" strokeWidth={1.5} fill="url(#activityGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </AnalyticsSectionCard>

        {/* Execution Metrics (requires database) */}
        <div className="grid grid-cols-2 gap-4">
          <AnalyticsSectionCard title="Decision Quality" icon={<Target className="w-3.5 h-3.5" />}>
            <div className="flex flex-col items-center justify-center h-24 text-center">
              <p className="text-[11px]" style={{ color: colors.textQuaternary }}>
                Requires workflow execution data
              </p>
              <p className="text-[10px] mt-1" style={{ color: colors.textDisabled }}>
                Run workflows to see confidence metrics
              </p>
            </div>
          </AnalyticsSectionCard>

          <AnalyticsSectionCard title="Model Usage" icon={<Zap className="w-3.5 h-3.5" />}>
            <div className="flex flex-col items-center justify-center h-24 text-center">
              <p className="text-[11px]" style={{ color: colors.textQuaternary }}>
                Requires workflow execution data
              </p>
              <p className="text-[10px] mt-1" style={{ color: colors.textDisabled }}>
                Run workflows to see model tier usage
              </p>
            </div>
          </AnalyticsSectionCard>
        </div>

        {/* Simulation & Uncertainty (requires database) */}
        <div className="grid grid-cols-2 gap-4">
          <AnalyticsSectionCard title="Uncertainty Analysis" icon={<AlertTriangle className="w-3.5 h-3.5" />}>
            <div className="flex flex-col items-center justify-center h-24 text-center">
              <p className="text-[11px]" style={{ color: colors.textQuaternary }}>
                Requires workflow execution data
              </p>
              <p className="text-[10px] mt-1" style={{ color: colors.textDisabled }}>
                Run workflows with simulations
              </p>
            </div>
          </AnalyticsSectionCard>

          <AnalyticsSectionCard title="Simulation Insights" icon={<Activity className="w-3.5 h-3.5" />}>
            <div className="flex flex-col items-center justify-center h-24 text-center">
              <p className="text-[11px]" style={{ color: colors.textQuaternary }}>
                Requires workflow execution data
              </p>
              <p className="text-[10px] mt-1" style={{ color: colors.textDisabled }}>
                Run game theory simulations
              </p>
            </div>
          </AnalyticsSectionCard>
        </div>

        {/* Causal & Primitive (requires database) */}
        <div className="grid grid-cols-2 gap-4">
          <AnalyticsSectionCard title="Top Causal Drivers">
            <div className="flex flex-col items-center justify-center h-24 text-center">
              <p className="text-[11px]" style={{ color: colors.textQuaternary }}>
                Requires workflow execution data
              </p>
              <p className="text-[10px] mt-1" style={{ color: colors.textDisabled }}>
                Run causal analysis primitives
              </p>
            </div>
          </AnalyticsSectionCard>

          <AnalyticsSectionCard title="Primitive Performance">
            <div className="flex flex-col items-center justify-center h-24 text-center">
              <p className="text-[11px]" style={{ color: colors.textQuaternary }}>
                Requires workflow execution data
              </p>
              <p className="text-[10px] mt-1" style={{ color: colors.textDisabled }}>
                Execute primitives to track performance
              </p>
            </div>
          </AnalyticsSectionCard>
        </div>
      </div>
    </div>
  );
}

// Analytics helper components - design.md compliant
function AnalyticsMetricCard({
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
    <div className="rounded-md p-4" style={{ background: colors.bgElevated, border: `1px solid ${colors.borderSubtle}` }}>
      <p className="text-[11px] uppercase tracking-wide mb-1" style={{ color: colors.textTertiary }}>{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-[20px] font-semibold tabular-nums" style={{ color: colors.textPrimary }}>{value}</span>
        <span
          className={cn(
            "flex items-center gap-0.5 text-[11px] font-medium",
            isPositive && "text-emerald-400",
            isNegative && "text-rose-400",
            !isPositive && !isNegative && "text-[hsl(0,0%,50%)]"
          )}
        >
          {change > 0 ? <TrendingUp className="w-3 h-3" /> : change < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
          {Math.abs(change)}%
        </span>
      </div>
    </div>
  );
}

function AnalyticsSectionCard({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-md p-4" style={{ background: colors.bgElevated, border: `1px solid ${colors.borderSubtle}` }}>
      <div className="flex items-center gap-2 mb-4">
        {icon && <span style={{ color: colors.iconSecondary }}>{icon}</span>}
        <h3 className="text-[11px] font-medium uppercase tracking-wide" style={{ color: colors.textTertiary }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

function AnalyticsTooltip({
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
    <div
      className="rounded px-2.5 py-1.5"
      style={{
        background: colors.bgElevated,
        border: `1px solid ${colors.borderDefault}`,
        boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
      }}
    >
      <p className="text-[11px] mb-0.5" style={{ color: colors.textTertiary }}>
        {label ? new Date(label).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
      </p>
      <p className="text-[13px] font-medium tabular-nums" style={{ color: colors.textPrimary }}>
        {prefix}
        {typeof payload[0].value === "number" ? payload[0].value.toFixed(suffix === "%" ? 0 : 2) : payload[0].value}
        {suffix}
      </p>
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
