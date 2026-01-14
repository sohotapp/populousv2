"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  FileText,
  Clock,
  Loader2,
  Trash2,
  Search,
  LayoutGrid,
  List,
  Settings,
  ChevronRight,
  Home,
  Inbox,
  Star,
  Archive,
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

export default function HomePage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newQuestion, setNewQuestion] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeView, setActiveView] = useState("all");

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

  const deleteWorkflow = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this workflow?")) return;

    try {
      await fetch(`/api/workflows/${id}`, { method: "DELETE" });
      setWorkflows((prev) => prev.filter((w) => w.id !== id));
    } catch (error) {
      console.error("Failed to delete workflow:", error);
    }
  };

  const filteredWorkflows = workflows.filter(
    (w) =>
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.question.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <NavItem icon={Home} label="Home" active={activeView === "all"} onClick={() => setActiveView("all")} />
          <NavItem icon={Inbox} label="Inbox" count={0} onClick={() => {}} />
          <NavItem icon={Star} label="Starred" onClick={() => {}} />
          <NavItem icon={Archive} label="Archive" onClick={() => {}} />

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
        {/* Header - Linear style */}
        <header className="h-12 flex items-center justify-between px-6 border-b border-border flex-shrink-0">
          <div className="flex items-baseline gap-2">
            <h1 className="text-sm font-medium text-foreground">Workflows</h1>
            <span className="text-xs text-muted-foreground">{workflows.length} total</span>
          </div>

          <div className="flex items-center gap-3">
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

          {loading ? (
            <div className="flex items-center justify-center h-64 px-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredWorkflows.length === 0 ? (
            <EmptyState
              onCreateClick={() => setShowCreate(true)}
              hasWorkflows={workflows.length > 0}
            />
          ) : (
            <div>
              {/* Table Header - Linear style */}
              <div className="grid grid-cols-[1fr,100px,100px,40px] gap-4 px-4 py-2 border-b border-border">
                <span className="text-2xs font-medium text-muted-foreground uppercase tracking-wider">Name</span>
                <span className="text-2xs font-medium text-muted-foreground uppercase tracking-wider">Status</span>
                <span className="text-2xs font-medium text-muted-foreground uppercase tracking-wider">Updated</span>
                <span></span>
              </div>

              {/* Rows */}
              <div className="divide-y divide-border/50">
                {filteredWorkflows.map((workflow) => (
                  <div
                    key={workflow.id}
                    onClick={() => router.push(`/workflow/${workflow.id}`)}
                    className="grid grid-cols-[1fr,100px,100px,40px] gap-4 px-4 py-3 cursor-pointer hover:bg-secondary/30 transition-colors group"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {workflow.name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        {workflow.question}
                      </div>
                    </div>
                    <div className="flex items-center">
                      <StatusBadge status={workflow.status} />
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center">
                      {formatDate(workflow.updatedAt)}
                    </div>
                    <div className="flex items-center justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400"
                        onClick={(e) => deleteWorkflow(workflow.id, e)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
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
        "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors",
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
  const styles: Record<string, string> = {
    draft: "bg-secondary text-muted-foreground",
    running: "bg-blue-500/10 text-blue-400",
    completed: "bg-emerald-500/10 text-emerald-400",
    failed: "bg-red-500/10 text-red-400",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
        styles[status] || styles.draft
      )}
    >
      {status}
    </span>
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
}: {
  onCreateClick: () => void;
  hasWorkflows: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center px-6">
      <div className="w-10 h-10 rounded-lg bg-secondary/50 flex items-center justify-center mb-3">
        <FileText className="w-5 h-5 text-muted-foreground/60" />
      </div>
      <h2 className="text-sm font-medium text-foreground mb-1">
        {hasWorkflows ? "No matching workflows" : "No workflows yet"}
      </h2>
      <p className="text-xs text-muted-foreground max-w-xs mb-4">
        {hasWorkflows
          ? "Try adjusting your search query"
          : "Create your first workflow to start analyzing decisions"}
      </p>
      {!hasWorkflows && (
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

