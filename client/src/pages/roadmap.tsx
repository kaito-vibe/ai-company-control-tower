import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/utils";
import type { Agent, Project, AgentTask } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import {
  CalendarClock, ChevronLeft, ChevronRight, GanttChart, List, Calendar as CalendarIcon,
  Loader2, Zap, DollarSign, TrendingUp, Brain, Clock, Shield, Target, Play,
  Pause, RefreshCw, Wallet, AlertTriangle, Sparkles, Settings2, BarChart3,
  FolderKanban, ArrowRight, Filter, CircleDot, Plus, Trash2, ChevronDown,
  ChevronUp, Activity, Search, LayoutGrid
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────
interface RoadmapPlan {
  plannedStart?: string;
  plannedEnd?: string;
  tokenBudget?: number;
  executionMode?: "auto" | "scheduled" | "manual";
  tokensSpent?: number;
  updatedAt?: string;
}

interface BudgetStatus {
  today: { spent: number; limit: number };
  week: { spent: number; limit: number };
  month: { spent: number; limit: number };
  totalAllTime: number;
  totalCalls: number;
  isOverBudget: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────
const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 };
const STATUS_COLORS: Record<string, string> = {
  backlog: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  in_progress: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  completed: "bg-green-500/20 text-green-400 border-green-500/30",
};
const PRIORITY_COLORS: Record<string, string> = {
  urgent: "text-red-400", high: "text-orange-400", medium: "text-yellow-400", low: "text-zinc-400",
};
const EXEC_MODE_COLORS: Record<string, string> = {
  auto: "bg-green-500/15 text-green-400 border-green-500/30",
  scheduled: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  manual: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function shortDate(s: string): string {
  const d = new Date(s);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ─── Budget Status Bar ──────────────────────────────────────────
function BudgetStatusBar({ budget }: { budget: BudgetStatus | undefined }) {
  if (!budget) return null;

  const bars = [
    { label: "Today", spent: budget.today.spent, limit: budget.today.limit, color: "bg-cyan-400" },
    { label: "This Week", spent: budget.week.spent, limit: budget.week.limit, color: "bg-blue-400" },
    { label: "This Month", spent: budget.month.spent, limit: budget.month.limit, color: "bg-purple-400" },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {bars.map(b => {
        const pct = b.limit > 0 ? Math.min(100, (b.spent / b.limit) * 100) : 0;
        const isOver = b.limit > 0 && b.spent >= b.limit;
        return (
          <Card key={b.label} className={`p-3 ${isOver ? "border-red-500/40" : ""}`}>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{b.label}</p>
              {isOver && <AlertTriangle className="h-3 w-3 text-red-400" />}
            </div>
            <div className="flex items-baseline gap-1">
              <span className={`text-sm font-bold ${isOver ? "text-red-400" : ""}`}>{formatCents(b.spent)}</span>
              {b.limit > 0 && <span className="text-[10px] text-muted-foreground">/ {formatCents(b.limit)}</span>}
              {b.limit === 0 && <span className="text-[10px] text-muted-foreground">no limit</span>}
            </div>
            {b.limit > 0 && (
              <div className="mt-1.5 h-1.5 rounded-full bg-muted/30 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${isOver ? "bg-red-400" : b.color}`} style={{ width: `${pct}%` }} />
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ─── Budget Settings Dialog ─────────────────────────────────────
function BudgetSettingsDialog({ budget, open, onOpenChange }: {
  budget: BudgetStatus | undefined; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const [daily, setDaily] = useState(String((budget?.today.limit || 0) / 100));
  const [weekly, setWeekly] = useState(String((budget?.week.limit || 0) / 100));
  const [monthly, setMonthly] = useState(String((budget?.month.limit || 0) / 100));
  const { toast } = useToast();

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", "/api/roadmap/budget", data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roadmap/budget-status"] });
      toast({ title: "Budget updated" });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" /> Token Budget Limits
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Set spending limits. Execution pauses automatically when a limit is hit. Set to 0 for unlimited.</p>
          <div>
            <Label>Daily Limit ($)</Label>
            <Input type="number" step="0.5" min="0" value={daily} onChange={e => setDaily(e.target.value)} className="mt-1" data-testid="input-daily-budget" />
          </div>
          <div>
            <Label>Weekly Limit ($)</Label>
            <Input type="number" step="1" min="0" value={weekly} onChange={e => setWeekly(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Monthly Limit ($)</Label>
            <Input type="number" step="5" min="0" value={monthly} onChange={e => setMonthly(e.target.value)} className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate({
            daily: Math.round(parseFloat(daily || "0") * 100),
            weekly: Math.round(parseFloat(weekly || "0") * 100),
            monthly: Math.round(parseFloat(monthly || "0") * 100),
          })} disabled={saveMutation.isPending} className="gap-1.5">
            {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shield className="h-3.5 w-3.5" />}
            Save Limits
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Project Plan Dialog ────────────────────────────────────────
function ProjectPlanDialog({ project, plan, agents, open, onOpenChange }: {
  project: Project; plan: RoadmapPlan; agents: Agent[]; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const [startDate, setStartDate] = useState(plan.plannedStart || dateStr(new Date()));
  const [endDate, setEndDate] = useState(plan.plannedEnd || dateStr(addDays(new Date(), 3)));
  const [tokenBudget, setTokenBudget] = useState(String((plan.tokenBudget || 1000) / 100));
  const [execMode, setExecMode] = useState(plan.executionMode || "scheduled");
  const { toast } = useToast();
  const agent = agents.find(a => a.id === project.assignedAgentId);

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/roadmap/project/${project.id}`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roadmap"] });
      toast({ title: "Plan updated", description: `"${project.title}" scheduled` });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FolderKanban className="h-4 w-4 text-primary" />
            Plan: {project.title.length > 35 ? project.title.slice(0, 35) + "…" : project.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className={STATUS_COLORS[project.status] || ""}>{project.status}</Badge>
            <Badge variant="outline" className={PRIORITY_COLORS[project.priority] || ""}>{project.priority}</Badge>
            {agent && <span>{agent.avatar} {agent.name}</span>}
            <span>{project.progress}% done</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1" data-testid="input-start-date" />
            </div>
            <div>
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Token Budget ($)</Label>
              <Input type="number" step="1" min="0" value={tokenBudget} onChange={e => setTokenBudget(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Execution Mode</Label>
              <Select value={execMode} onValueChange={(v) => setExecMode(v as any)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (runs immediately)</SelectItem>
                  <SelectItem value="scheduled">Scheduled (on date)</SelectItem>
                  <SelectItem value="manual">Manual (CEO triggers)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate({
            plannedStart: startDate, plannedEnd: endDate,
            tokenBudget: Math.round(parseFloat(tokenBudget || "10") * 100),
            executionMode: execMode,
          })} disabled={saveMutation.isPending} className="gap-1.5">
            {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarClock className="h-3.5 w-3.5" />}
            Save Plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Gantt Chart View ───────────────────────────────────────────
function GanttView({ projects, roadmap, agents, tasks }: {
  projects: Project[]; roadmap: any; agents: Agent[]; tasks: AgentTask[];
}) {
  const [editProject, setEditProject] = useState<Project | null>(null);
  const today = new Date();
  const todayStr = dateStr(today);

  // Determine visible range: from earliest planned start to latest end, with padding
  const { timelineStart, timelineEnd, totalDays } = useMemo(() => {
    let earliest = addDays(today, -2);
    let latest = addDays(today, 21);

    for (const p of projects) {
      const plan = roadmap?.projects?.[String(p.id)];
      if (plan?.plannedStart) {
        const s = new Date(plan.plannedStart);
        if (s < earliest) earliest = s;
      }
      if (plan?.plannedEnd) {
        const e = new Date(plan.plannedEnd);
        if (e > latest) latest = e;
      }
    }
    // Add padding
    earliest = addDays(earliest, -1);
    latest = addDays(latest, 3);
    return { timelineStart: earliest, timelineEnd: latest, totalDays: daysBetween(earliest, latest) + 1 };
  }, [projects, roadmap]);

  // Generate day columns
  const days = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < totalDays; i++) {
      arr.push(addDays(timelineStart, i));
    }
    return arr;
  }, [timelineStart, totalDays]);

  // Sort projects: planned first (by start date), then unplanned (by priority)
  const sortedProjects = useMemo(() => {
    return [...projects]
      .filter(p => p.status !== "completed")
      .sort((a, b) => {
        const ap = roadmap?.projects?.[String(a.id)];
        const bp = roadmap?.projects?.[String(b.id)];
        const aPlanned = !!ap?.plannedStart;
        const bPlanned = !!bp?.plannedStart;
        if (aPlanned && !bPlanned) return -1;
        if (!aPlanned && bPlanned) return 1;
        if (aPlanned && bPlanned) {
          return new Date(ap.plannedStart).getTime() - new Date(bp.plannedStart).getTime();
        }
        return (PRIORITY_ORDER[a.priority as keyof typeof PRIORITY_ORDER] || 2) - (PRIORITY_ORDER[b.priority as keyof typeof PRIORITY_ORDER] || 2);
      });
  }, [projects, roadmap]);

  const dayWidth = 40;
  const rowHeight = 44;

  const editPlan = editProject ? (roadmap?.projects?.[String(editProject.id)] || {}) : {};

  return (
    <div className="space-y-3">
      {/* Gantt container */}
      <Card className="overflow-hidden">
        <div className="overflow-auto w-full" style={{ maxHeight: '70vh' }}>
          <div className="flex" style={{ minWidth: `${280 + totalDays * dayWidth}px` }}>
            {/* Left sidebar: project names */}
            <div className="w-[280px] shrink-0 border-r border-border/30 bg-card sticky left-0 z-10">
              {/* Header */}
              <div className="h-10 border-b border-border/30 px-3 flex items-center">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Project</span>
              </div>
              {/* Rows */}
              {sortedProjects.map(p => {
                const plan = roadmap?.projects?.[String(p.id)];
                const agent = agents.find(a => a.id === p.assignedAgentId);
                return (
                  <div
                    key={p.id}
                    className="border-b border-border/10 px-3 flex items-center gap-2 cursor-pointer hover:bg-muted/20 transition-colors"
                    style={{ height: `${rowHeight}px` }}
                    onClick={() => setEditProject(p)}
                    data-testid={`gantt-row-${p.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{p.title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {agent && <span className="text-[9px]">{agent.avatar}</span>}
                        <Badge variant="outline" className={`text-[8px] px-1 py-0 h-3.5 ${PRIORITY_COLORS[p.priority] || ""}`}>{p.priority}</Badge>
                        {plan?.executionMode && (
                          <Badge variant="outline" className={`text-[8px] px-1 py-0 h-3.5 ${EXEC_MODE_COLORS[plan.executionMode] || ""}`}>{plan.executionMode}</Badge>
                        )}
                        <span className="text-[9px] text-muted-foreground">{p.progress}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right: timeline grid */}
            <div className="flex-1">
              {/* Day headers */}
              <div className="flex h-10 border-b border-border/30 sticky top-0 bg-card z-5">
                {days.map((d, i) => {
                  const isToday = dateStr(d) === todayStr;
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  return (
                    <div
                      key={i}
                      className={`shrink-0 flex flex-col items-center justify-center border-r border-border/10 ${isToday ? "bg-primary/10" : isWeekend ? "bg-muted/10" : ""}`}
                      style={{ width: `${dayWidth}px` }}
                    >
                      <span className={`text-[8px] ${isToday ? "text-primary font-bold" : "text-muted-foreground"}`}>
                        {d.toLocaleDateString(undefined, { weekday: "narrow" })}
                      </span>
                      <span className={`text-[10px] font-medium ${isToday ? "text-primary" : ""}`}>
                        {d.getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Project bars */}
              {sortedProjects.map(p => {
                const plan = roadmap?.projects?.[String(p.id)];
                const hasStart = !!plan?.plannedStart;
                const hasEnd = !!plan?.plannedEnd;

                let barLeft = 0;
                let barWidth = 0;
                let barColor = "bg-zinc-500/30";

                if (hasStart && hasEnd) {
                  const start = new Date(plan.plannedStart);
                  const end = new Date(plan.plannedEnd);
                  barLeft = daysBetween(timelineStart, start) * dayWidth;
                  barWidth = Math.max(dayWidth, (daysBetween(start, end) + 1) * dayWidth);

                  if (p.status === "completed") barColor = "bg-green-500/50";
                  else if (plan.executionMode === "auto") barColor = "bg-cyan-500/50";
                  else if (plan.executionMode === "scheduled") barColor = "bg-blue-500/50";
                  else barColor = "bg-zinc-500/30";
                }

                return (
                  <div
                    key={p.id}
                    className="relative border-b border-border/10"
                    style={{ height: `${rowHeight}px` }}
                  >
                    {/* Grid lines for today */}
                    {days.map((d, i) => {
                      const isToday = dateStr(d) === todayStr;
                      if (!isToday) return null;
                      return (
                        <div
                          key={`today-${i}`}
                          className="absolute top-0 bottom-0 border-l-2 border-primary/40 z-5"
                          style={{ left: `${i * dayWidth + dayWidth / 2}px` }}
                        />
                      );
                    })}

                    {/* Bar */}
                    {hasStart && hasEnd ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={`absolute top-2.5 rounded-md ${barColor} cursor-pointer hover:opacity-80 transition-opacity`}
                              style={{ left: `${barLeft}px`, width: `${barWidth}px`, height: `${rowHeight - 20}px` }}
                              onClick={() => setEditProject(p)}
                            >
                              {/* Progress fill */}
                              <div
                                className="h-full rounded-md bg-white/15"
                                style={{ width: `${p.progress}%` }}
                              />
                              {/* Budget overlay */}
                              {plan.tokenBudget && (
                                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] text-white/70 font-medium">
                                  {formatCents(plan.tokenBudget)}
                                </span>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs font-medium">{p.title}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {shortDate(plan.plannedStart)} → {shortDate(plan.plannedEnd)} · {plan.executionMode} · Budget: {formatCents(plan.tokenBudget || 0)}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <div
                        className="absolute top-2.5 left-2 rounded border border-dashed border-muted-foreground/30 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
                        style={{ width: `${dayWidth * 3}px`, height: `${rowHeight - 20}px` }}
                        onClick={() => setEditProject(p)}
                      >
                        <span className="text-[9px] text-muted-foreground">Click to plan</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      {editProject && (
        <ProjectPlanDialog
          project={editProject}
          plan={editPlan}
          agents={agents}
          open={true}
          onOpenChange={(o) => { if (!o) setEditProject(null); }}
        />
      )}
    </div>
  );
}

// ─── Portfolio List View ────────────────────────────────────────
function PortfolioView({ projects, roadmap, agents, tasks }: {
  projects: Project[]; roadmap: any; agents: Agent[]; tasks: AgentTask[];
}) {
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");

  const filtered = useMemo(() => {
    let list = [...projects].filter(p => p.status !== "completed");
    if (filterStatus !== "all") list = list.filter(p => {
      const plan = roadmap?.projects?.[String(p.id)];
      if (filterStatus === "planned") return !!plan?.plannedStart;
      if (filterStatus === "unplanned") return !plan?.plannedStart;
      return true;
    });
    return list.sort((a, b) => {
      return (PRIORITY_ORDER[a.priority as keyof typeof PRIORITY_ORDER] || 2) -
             (PRIORITY_ORDER[b.priority as keyof typeof PRIORITY_ORDER] || 2);
    });
  }, [projects, roadmap, filterStatus]);

  const planned = projects.filter(p => roadmap?.projects?.[String(p.id)]?.plannedStart).length;
  const unplanned = projects.filter(p => !roadmap?.projects?.[String(p.id)]?.plannedStart && p.status !== "completed").length;
  const editPlan = editProject ? (roadmap?.projects?.[String(editProject.id)] || {}) : {};

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <Filter className="h-3 w-3 mr-1" /><SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({projects.filter(p => p.status !== "completed").length})</SelectItem>
            <SelectItem value="planned">Planned ({planned})</SelectItem>
            <SelectItem value="unplanned">Unplanned ({unplanned})</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground ml-auto">{filtered.length} projects</p>
      </div>

      {filtered.map(p => {
        const plan = roadmap?.projects?.[String(p.id)] || {};
        const agent = agents.find(a => a.id === p.assignedAgentId);
        const projectTasks = tasks.filter(t => t.projectId === p.id);
        const activeTasks = projectTasks.filter(t => ["thinking", "executing"].includes(t.status)).length;

        return (
          <Card
            key={p.id}
            className="p-3.5 cursor-pointer hover:border-primary/30 transition-all"
            onClick={() => setEditProject(p)}
            data-testid={`portfolio-${p.id}`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${plan.plannedStart ? "bg-primary/10 border border-primary/30" : "bg-muted"}`}>
                <FolderKanban className={`h-3.5 w-3.5 ${plan.plannedStart ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{p.title}</p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${STATUS_COLORS[p.status] || ""}`}>{p.status.replace("_", " ")}</Badge>
                  <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${PRIORITY_COLORS[p.priority] || ""}`}>{p.priority}</Badge>
                  {plan.executionMode && (
                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${EXEC_MODE_COLORS[plan.executionMode] || ""}`}>{plan.executionMode}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-1.5 text-[10px] text-muted-foreground">
                  {agent && <span>{agent.avatar} {agent.name}</span>}
                  {plan.plannedStart && <span>{shortDate(plan.plannedStart)} → {shortDate(plan.plannedEnd || plan.plannedStart)}</span>}
                  {plan.tokenBudget && <span className="flex items-center gap-0.5"><DollarSign className="h-2.5 w-2.5" />{formatCents(plan.tokenBudget)}</span>}
                  {activeTasks > 0 && <span className="text-cyan-400">{activeTasks} active tasks</span>}
                  <span>{p.progress}% complete</span>
                </div>
                {/* Progress bar */}
                <div className="mt-2 h-1 rounded-full bg-muted/30 overflow-hidden">
                  <div className="h-full rounded-full bg-primary/60 transition-all" style={{ width: `${p.progress}%` }} />
                </div>
              </div>
              {!plan.plannedStart && (
                <Badge variant="outline" className="text-[9px] border-dashed border-yellow-500/30 text-yellow-400 shrink-0">Unplanned</Badge>
              )}
            </div>
          </Card>
        );
      })}

      {editProject && (
        <ProjectPlanDialog
          project={editProject}
          plan={editPlan}
          agents={agents}
          open={true}
          onOpenChange={(o) => { if (!o) setEditProject(null); }}
        />
      )}
    </div>
  );
}

// ─── Execution Log View ─────────────────────────────────────────
function ExecutionLogView({ agents }: { agents: Agent[] }) {
  const { data: log = [] } = useQuery<any[]>({ queryKey: ["/api/roadmap/execution-log"], refetchInterval: 5000 });

  const recent = useMemo(() => [...log].reverse().slice(0, 50), [log]);

  // Group by date
  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const entry of recent) {
      const day = entry.date?.slice(0, 10) || "unknown";
      if (!groups[day]) groups[day] = [];
      groups[day].push(entry);
    }
    return groups;
  }, [recent]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">AI execution history with cost tracking</p>
      {Object.entries(grouped).map(([day, entries]) => {
        const dayCost = entries.reduce((s, e) => s + (e.costCents || 0), 0);
        return (
          <div key={day}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold">{shortDate(day)}</span>
              <span className="text-[10px] text-muted-foreground">{entries.length} calls · {formatCents(dayCost)}</span>
            </div>
            <div className="space-y-1 ml-2 border-l border-border/30 pl-3">
              {entries.map((entry: any, i: number) => {
                const agent = agents.find(a => a.id === entry.agentId);
                return (
                  <div key={i} className="flex items-center gap-2 text-[10px] text-muted-foreground py-0.5">
                    <span className="w-12 shrink-0 text-right">{new Date(entry.date).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />
                    <span className="truncate flex-1">{entry.label}</span>
                    {agent && <span className="shrink-0">{agent.avatar}</span>}
                    <span className="shrink-0 font-medium text-foreground">{formatCents(entry.costCents || 0)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {recent.length === 0 && (
        <div className="text-center py-12">
          <Activity className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No execution log entries yet. AI calls will appear here with cost tracking.</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Roadmap Page ──────────────────────────────────────────
export default function RoadmapPage() {
  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ["/api/projects"], refetchInterval: 5000 });
  const { data: tasks = [] } = useQuery<AgentTask[]>({ queryKey: ["/api/tasks"], refetchInterval: 5000 });
  const { data: agents = [] } = useQuery<Agent[]>({ queryKey: ["/api/agents"] });
  const { data: roadmap = {} } = useQuery<any>({ queryKey: ["/api/roadmap"], refetchInterval: 5000 });
  const { data: budgetStatus } = useQuery<BudgetStatus>({ queryKey: ["/api/roadmap/budget-status"], refetchInterval: 5000 });
  const { data: scheduled = [] } = useQuery<any[]>({ queryKey: ["/api/scheduled-tasks"], refetchInterval: 10000 });
  const { toast } = useToast();

  const [view, setView] = useState<"gantt" | "portfolio" | "schedules" | "log">("gantt");
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);

  const autoPlanMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/roadmap/auto-plan").then(r => r.json()),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/roadmap"] });
      toast({ title: "Auto-planned", description: `${data.planned} project${data.planned !== 1 ? "s" : ""} scheduled onto calendar` });
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const activeProjects = projects.filter(p => p.status !== "completed");
  const plannedCount = activeProjects.filter(p => roadmap?.projects?.[String(p.id)]?.plannedStart).length;
  const totalBudgetAllocated = Object.values(roadmap?.projects || {}).reduce((s: number, p: any) => s + ((p as RoadmapPlan).tokenBudget || 0), 0);
  const activeSchedules = scheduled.filter((s: any) => s.status === "active").length;

  return (
    <div>
      <div className="p-4 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
              <GanttChart className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Roadmap</h1>
              <p className="text-sm text-muted-foreground">Plan projects on calendar days, set token budgets, track execution</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center bg-muted/30 rounded-lg p-0.5">
              <Button variant={view === "gantt" ? "secondary" : "ghost"} size="sm" onClick={() => setView("gantt")} className="h-7 text-xs gap-1">
                <GanttChart className="h-3 w-3" /> Gantt
              </Button>
              <Button variant={view === "portfolio" ? "secondary" : "ghost"} size="sm" onClick={() => setView("portfolio")} className="h-7 text-xs gap-1">
                <LayoutGrid className="h-3 w-3" /> Portfolio
              </Button>
              <Button variant={view === "schedules" ? "secondary" : "ghost"} size="sm" onClick={() => setView("schedules")} className="h-7 text-xs gap-1">
                <CalendarClock className="h-3 w-3" /> Schedules
              </Button>
              <Button variant={view === "log" ? "secondary" : "ghost"} size="sm" onClick={() => setView("log")} className="h-7 text-xs gap-1">
                <Activity className="h-3 w-3" /> Log
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={() => setBudgetDialogOpen(true)} className="h-7 text-xs gap-1">
              <Wallet className="h-3 w-3" /> Budget
            </Button>
            <Button
              size="sm"
              onClick={() => autoPlanMutation.mutate()}
              disabled={autoPlanMutation.isPending}
              className="h-7 text-xs gap-1"
              data-testid="btn-auto-plan"
            >
              {autoPlanMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
              AI Auto-Plan
            </Button>
          </div>
        </div>

        {/* Budget Status */}
        <BudgetStatusBar budget={budgetStatus} />

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Card className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Active Projects</p>
            <p className="text-lg font-bold mt-0.5">{activeProjects.length}</p>
          </Card>
          <Card className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Planned</p>
            <p className="text-lg font-bold text-blue-400 mt-0.5">{plannedCount}</p>
          </Card>
          <Card className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Unplanned</p>
            <p className="text-lg font-bold text-yellow-400 mt-0.5">{activeProjects.length - plannedCount}</p>
          </Card>
          <Card className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Budget Allocated</p>
            <p className="text-lg font-bold text-cyan-400 mt-0.5">{formatCents(totalBudgetAllocated)}</p>
          </Card>
          <Card className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Active Schedules</p>
            <p className="text-lg font-bold text-green-400 mt-0.5">{activeSchedules}</p>
          </Card>
        </div>

        {/* Budget warning */}
        {budgetStatus?.isOverBudget && (
          <Card className="p-3 border-red-500/40 bg-red-500/5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
              <div>
                <p className="text-xs font-medium text-red-400">Token budget exceeded — execution is paused</p>
                <p className="text-[10px] text-muted-foreground">Increase your budget limits or wait for the next period to resume automatic task execution.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setBudgetDialogOpen(true)} className="shrink-0 h-7 text-xs ml-auto gap-1">
                <Settings2 className="h-3 w-3" /> Adjust
              </Button>
            </div>
          </Card>
        )}

        {/* View Content */}
        {view === "gantt" && <GanttView projects={projects} roadmap={roadmap} agents={agents} tasks={tasks} />}
        {view === "portfolio" && <PortfolioView projects={projects} roadmap={roadmap} agents={agents} tasks={tasks} />}
        {view === "schedules" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{activeSchedules} active recurring schedules</p>
              <Link href="/schedules">
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                  Full Schedules View <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
            {scheduled.filter((s: any) => s.status === "active").map((item: any) => {
              const agent = agents.find(a => a.id === item.assignedAgentId);
              const nextRunStr = item.nextRun
                ? new Date(item.nextRun).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                : "—";
              return (
                <Card key={item.id} className="p-3">
                  <div className="flex items-center gap-3">
                    <RefreshCw className="h-3.5 w-3.5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{item.title}</p>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                        {agent && <span>{agent.avatar} {agent.name}</span>}
                        <span className="capitalize">{item.frequency}</span>
                        <span>Next: {nextRunStr}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
        {view === "log" && <ExecutionLogView agents={agents} />}
      </div>

      <BudgetSettingsDialog budget={budgetStatus} open={budgetDialogOpen} onOpenChange={setBudgetDialogOpen} />
    </div>
  );
}
