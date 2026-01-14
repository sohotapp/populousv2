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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { RLTXIcon } from "@/components/ui/RLTXIcon";

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

type ViewFilter = "all" | "starred" | "inbox" | "analytics" | "archive";

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

  // Load starred and archived IDs from localStorage
  useEffect(() => {
    const savedStarred = localStorage.getItem("rltx-starred-workflows");
    const savedArchived = localStorage.getItem("rltx-archived-workflows");
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
  }, []);

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

      // Don't handle navigation when in input or modal
      if (
        showCreate ||
        showCommandPalette ||
        document.activeElement?.tagName === "INPUT"
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
  };

  // Command palette items
  const commandItems = useMemo(() => {
    const items = [
      { id: "new", label: "New workflow", shortcut: "N", action: () => setShowCreate(true) },
      { id: "home", label: "Go to Home", shortcut: "G H", action: () => setActiveView("all") },
      { id: "starred", label: "Go to Starred", shortcut: "G S", action: () => setActiveView("starred") },
      { id: "analytics", label: "Go to Analytics", shortcut: "G A", action: () => setActiveView("analytics") },
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
      {/* Sidebar */}
      <aside
        className="w-56 flex-shrink-0 flex flex-col"
        style={{ borderRight: `1px solid ${colors.borderSubtle}` }}
      >
        {/* Logo */}
        <div
          className="h-14 flex items-center px-4"
          style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}
        >
          <div className="flex items-center gap-2">
            <span style={{ color: colors.textPrimary }}><RLTXIcon className="w-6 h-6" /></span>
            <div className="flex items-baseline gap-1">
              <span
                className="font-semibold text-[13px] tracking-tight"
                style={{ color: colors.textPrimary }}
              >
                rltx
              </span>
              <span
                className="font-[family-name:var(--font-space-grotesk)] font-medium text-[13px] tracking-wide"
                style={{ color: colors.textSecondary }}
              >
                populous
              </span>
            </div>
          </div>
        </div>

        {/* Navigation - DESIGN.md sidebar styling */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          <SidebarItem
            icon={Home}
            label="Home"
            active={activeView === "all"}
            onClick={() => setActiveView("all")}
          />
          <SidebarItem
            icon={Inbox}
            label="Inbox"
            active={activeView === "inbox"}
            onClick={() => setActiveView("inbox")}
          />
          <SidebarItem
            icon={Star}
            label="Starred"
            active={activeView === "starred"}
            count={starredCount > 0 ? starredCount : undefined}
            onClick={() => setActiveView("starred")}
          />
          <SidebarItem
            icon={BarChart2}
            label="Analytics"
            active={activeView === "analytics"}
            onClick={() => setActiveView("analytics")}
          />
          <SidebarItem
            icon={Archive}
            label="Archive"
            active={activeView === "archive"}
            count={archivedCount > 0 ? archivedCount : undefined}
            onClick={() => setActiveView("archive")}
          />

          <div className="pt-4 pb-2">
            <span
              className="px-2 text-[11px] font-medium uppercase"
              style={{ color: colors.textQuaternary, letterSpacing: "0.02em" }}
            >
              Workflows
            </span>
          </div>

          {workflows
            .filter((w) => !archivedIds.has(w.id))
            .slice(0, 5)
            .map((w) => (
              <SidebarItem
                key={w.id}
                icon={FileText}
                label={w.name}
                onClick={() => router.push(`/workflow/${w.id}`)}
              />
            ))}
        </nav>

        {/* Footer */}
        <div className="p-2 space-y-0.5" style={{ borderTop: `1px solid ${colors.borderSubtle}` }}>
          <button
            onClick={() => setShowCommandPalette(true)}
            className="w-full flex items-center gap-2 rounded transition-colors"
            style={{
              padding: "6px 8px",
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
          >
            <Search className="w-4 h-4" style={{ color: colors.iconSecondary }} />
            <span className="flex-1 text-left text-[13px]">Search</span>
            <kbd
              className="text-[11px] px-1.5 py-0.5 rounded"
              style={{ background: colors.bgHover, color: colors.textQuaternary, fontFamily: "monospace" }}
            >
              ⌘K
            </kbd>
          </button>
          <SidebarItem icon={Settings} label="Settings" onClick={() => {}} />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreate(true)}
                  className="h-7 gap-1.5 text-[13px]"
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
            <CreateModal
              newName={newName}
              setNewName={setNewName}
              newQuestion={newQuestion}
              setNewQuestion={setNewQuestion}
              creating={creating}
              onClose={() => setShowCreate(false)}
              onCreate={createWorkflow}
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
          {activeView === "analytics" ? (
            <AnalyticsView workflows={workflows.filter((w) => !archivedIds.has(w.id))} />
          ) : activeView === "inbox" ? (
            <InboxView />
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

// ============ SIDEBAR ITEM (DESIGN.md lines 483-502) ============
function SidebarItem({
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
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full flex items-center rounded transition-all"
      style={{
        padding: "6px 8px",
        gap: "8px",
        background: active ? colors.bgHover : hovered ? colors.bgSurface : "transparent",
        color: active ? colors.textPrimary : hovered ? colors.textSecondary : colors.textTertiary,
      }}
    >
      <Icon
        className="w-4 h-4 flex-shrink-0"
        style={{ color: active ? colors.iconPrimary : colors.iconSecondary }}
      />
      <span className="truncate flex-1 text-left text-[13px]">{label}</span>
      {count !== undefined && (
        <span className="text-[11px] tabular-nums" style={{ color: colors.textQuaternary }}>
          {count}
        </span>
      )}
    </button>
  );
}

// ============ CREATE MODAL ============
function CreateModal({
  newName,
  setNewName,
  newQuestion,
  setNewQuestion,
  creating,
  onClose,
  onCreate,
}: {
  newName: string;
  setNewName: (v: string) => void;
  newQuestion: string;
  setNewQuestion: (v: string) => void;
  creating: boolean;
  onClose: () => void;
  onCreate: () => void;
}) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 animate-fade-in"
      style={{ background: "rgba(0,0,0,0.6)" }}
    >
      <div
        className="w-full max-w-md rounded-lg animate-slide-up"
        style={{
          background: colors.bgElevated,
          border: `1px solid ${colors.borderDefault}`,
          boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
        }}
      >
        <div className="p-4" style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}>
          <h2 className="text-[13px] font-medium" style={{ color: colors.textPrimary }}>
            New Workflow
          </h2>
          <p className="text-[11px] mt-1" style={{ color: colors.textTertiary }}>
            Define your decision or analysis question
          </p>
        </div>
        <div className="p-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium" style={{ color: colors.textTertiary }}>
              Name
            </label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Market Expansion Analysis"
              className="h-8 text-[13px]"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium" style={{ color: colors.textTertiary }}>
              Question
            </label>
            <Input
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="Should we expand into Europe?"
              className="h-8 text-[13px]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName && newQuestion) onCreate();
              }}
            />
          </div>
        </div>
        <div
          className="p-4 flex justify-end gap-2"
          style={{ borderTop: `1px solid ${colors.borderSubtle}` }}
        >
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 text-[13px]">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onCreate}
            disabled={creating || !newName.trim() || !newQuestion.trim()}
            className="h-7 text-[13px]"
          >
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Create"}
          </Button>
        </div>
      </div>
    </div>
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

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="grid grid-cols-[1fr,80px,80px,28px] gap-4 px-4 py-2 cursor-pointer transition-colors group"
      style={{
        background: isSelected ? colors.bgHover : hovered ? colors.bgSurface : "transparent",
      }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
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

      <div className="flex items-center">
        <StatusBadge status={workflow.status} />
      </div>

      <div
        className="text-[11px] flex items-center tabular-nums"
        style={{ color: colors.textTertiary }}
      >
        {formatDate(workflow.updatedAt)}
      </div>

      <div className="flex items-center justify-end">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onContextMenu(e);
          }}
          className="w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity"
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
  };

  const { icon: Icon, title, desc } = config[activeView];

  return (
    <div className="flex flex-col items-center justify-center h-64 text-center px-6">
      {/* DESIGN.md: icon color hsl(0,0%,20%) for empty states */}
      <Icon className="w-6 h-6 mb-4" style={{ color: colors.iconEmpty }} />
      <h2
        className="text-[13px] font-medium mb-1"
        style={{ color: colors.textTertiary }}
      >
        {title}
      </h2>
      <p className="text-[13px] max-w-xs" style={{ color: colors.textQuaternary }}>
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

// ============ INBOX VIEW ============
function InboxView() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center px-6">
      <Bell className="w-6 h-6 mb-4" style={{ color: colors.iconEmpty }} />
      <h2 className="text-[13px] font-medium mb-1" style={{ color: colors.textTertiary }}>
        No notifications
      </h2>
      <p className="text-[13px] max-w-xs" style={{ color: colors.textQuaternary }}>
        Workflow updates and activity will appear here
      </p>
    </div>
  );
}

// ============ ANALYTICS VIEW ============
function AnalyticsView({ workflows }: { workflows: WorkflowItem[] }) {
  const analytics = useMemo(() => {
    const total = workflows.length;
    const completed = workflows.filter((w) => w.status === "completed").length;
    const failed = workflows.filter((w) => w.status === "failed").length;
    const running = workflows.filter((w) => w.status === "running").length;
    const draft = workflows.filter((w) => w.status === "draft").length;

    const byDate = new Map<string, number>();
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      byDate.set(d.toISOString().split("T")[0], 0);
    }

    workflows.forEach((w) => {
      const date = new Date(w.createdAt).toISOString().split("T")[0];
      if (byDate.has(date)) byDate.set(date, (byDate.get(date) || 0) + 1);
    });

    const activityHistory = Array.from(byDate.entries()).map(([date, value]) => ({ date, value }));
    const recentWorkflows = [...workflows]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5);

    return { total, completed, failed, running, draft, activityHistory, recentWorkflows };
  }, [workflows]);

  if (workflows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-6">
        <BarChart2 className="w-6 h-6 mb-4" style={{ color: colors.iconEmpty }} />
        <h2 className="text-[13px] font-medium mb-1" style={{ color: colors.textTertiary }}>
          No analytics yet
        </h2>
        <p className="text-[13px] max-w-xs" style={{ color: colors.textQuaternary }}>
          Create and run workflows to see analytics
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <MetricCard label="Total" value={analytics.total} />
        <MetricCard label="Completed" value={analytics.completed} />
        <MetricCard label="Running" value={analytics.running} />
        <MetricCard label="Draft" value={analytics.draft} />
      </div>

      {/* Activity Chart - design.md: cards use 6px radius */}
      <div
        className="rounded-md p-4 mb-6"
        style={{ border: `1px solid ${colors.borderSubtle}` }}
      >
        <h3
          className="text-[11px] font-medium uppercase mb-4"
          style={{ color: colors.textQuaternary, letterSpacing: "0.02em" }}
        >
          Activity (14 days)
        </h3>
        <div className="h-40">
          {analytics.activityHistory.some((d) => d.value > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.activityHistory}>
                <defs>
                  <linearGradient id="activityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colors.textQuaternary} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={colors.textQuaternary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.borderSubtle} vertical={false} />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: colors.textQuaternary }}
                  tickFormatter={(v) =>
                    new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  }
                  interval="preserveStartEnd"
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: colors.textQuaternary }}
                  width={20}
                  allowDecimals={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={colors.textTertiary}
                  strokeWidth={1.5}
                  fill="url(#activityGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div
              className="h-full flex items-center justify-center text-[11px]"
              style={{ color: colors.textQuaternary }}
            >
              No activity in the last 14 days
            </div>
          )}
        </div>
      </div>

      {/* Status & Recent */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-md" style={{ border: `1px solid ${colors.borderSubtle}` }}>
          <div className="px-4 py-3" style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}>
            <h3
              className="text-[11px] font-medium uppercase"
              style={{ color: colors.textQuaternary, letterSpacing: "0.02em" }}
            >
              Status
            </h3>
          </div>
          <div className="p-4 space-y-3">
            <StatusBar label="Completed" count={analytics.completed} total={analytics.total} color={colors.statusSuccess} />
            <StatusBar label="Running" count={analytics.running} total={analytics.total} color={colors.statusInfo} />
            <StatusBar label="Draft" count={analytics.draft} total={analytics.total} color={colors.textQuaternary} />
            <StatusBar label="Failed" count={analytics.failed} total={analytics.total} color={colors.statusError} />
          </div>
        </div>

        <div className="rounded-md" style={{ border: `1px solid ${colors.borderSubtle}` }}>
          <div className="px-4 py-3" style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}>
            <h3
              className="text-[11px] font-medium uppercase"
              style={{ color: colors.textQuaternary, letterSpacing: "0.02em" }}
            >
              Recent
            </h3>
          </div>
          <div>
            {analytics.recentWorkflows.map((wf, i) => (
              <div
                key={wf.id}
                className="px-4 py-2.5 flex items-center gap-3"
                style={{ borderBottom: i < 4 ? `1px solid ${colors.borderSubtle}` : "none" }}
              >
                <span className="text-[11px] w-3 tabular-nums" style={{ color: colors.textQuaternary }}>
                  {i + 1}
                </span>
                <span className="text-[13px] flex-1 truncate" style={{ color: colors.textPrimary }}>
                  {wf.name}
                </span>
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor:
                      wf.status === "completed"
                        ? colors.statusSuccess
                        : wf.status === "running"
                        ? colors.statusInfo
                        : wf.status === "failed"
                        ? colors.statusError
                        : colors.textQuaternary,
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md p-3" style={{ border: `1px solid ${colors.borderSubtle}` }}>
      <p className="text-[11px] mb-0.5" style={{ color: colors.textTertiary }}>
        {label}
      </p>
      <span className="text-xl font-semibold tabular-nums" style={{ color: colors.textPrimary }}>
        {value}
      </span>
    </div>
  );
}

function StatusBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-[11px] mb-1">
        <span style={{ color: colors.textSecondary }}>{label}</span>
        <span className="tabular-nums" style={{ color: colors.textTertiary }}>
          {count}
        </span>
      </div>
      <div className="h-1 rounded-full overflow-hidden" style={{ background: colors.bgHover }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
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
      <p className="text-[11px]" style={{ color: colors.textTertiary }}>
        {label ? new Date(label).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
      </p>
      <p className="text-[13px] font-medium tabular-nums" style={{ color: colors.textPrimary }}>
        {payload[0].value} workflow{payload[0].value !== 1 ? "s" : ""}
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
