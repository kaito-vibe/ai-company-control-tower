import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/utils";
import type { Agent, Project } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  CalendarClock, Plus, Play, Pause, Trash2, RefreshCw, Loader2,
  ChevronLeft, ChevronRight, List, Calendar as CalendarIcon, Clock,
  Zap, Target, Users, LayoutGrid, Filter, ArrowUpDown, CircleDot,
  Workflow, HelpCircle, TrendingUp, BarChart3, Search
} from "lucide-react";

// ─── Constants ──────────────────────────────────────────────────
const FREQUENCIES = [
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
];

const FREQ_COLORS: Record<string, string> = {
  hourly: "bg-red-500/15 text-red-400 border-red-500/30",
  daily: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  weekly: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  biweekly: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  monthly: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

const FREQ_DOT_COLORS: Record<string, string> = {
  hourly: "bg-red-400",
  daily: "bg-blue-400",
  weekly: "bg-emerald-400",
  biweekly: "bg-purple-400",
  monthly: "bg-amber-400",
};

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  strategy: { label: "Strategy", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" },
  meeting: { label: "Meeting", color: "text-violet-400 bg-violet-500/10 border-violet-500/20" },
  manual: { label: "Manual", color: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20" },
  health: { label: "Health", color: "text-green-400 bg-green-500/10 border-green-500/20" },
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "text-red-400",
  high: "text-orange-400",
  medium: "text-yellow-400",
  low: "text-zinc-400",
};

// ─── Helpers ────────────────────────────────────────────────────
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  // 0 = Sunday, we want Monday = 0
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function formatDateShort(d: Date) {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatTime(d: Date) {
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

// Compute all occurrences for a schedule within a date range
function getOccurrences(schedule: any, startDate: Date, endDate: Date): Date[] {
  const occurrences: Date[] = [];
  if (!schedule.nextRun) return occurrences;

  const nextRun = new Date(schedule.nextRun);
  if (nextRun > endDate) return occurrences;

  // Add the nextRun if in range
  if (nextRun >= startDate && nextRun <= endDate) {
    occurrences.push(new Date(nextRun));
  }

  // Project future occurrences based on frequency
  const freqDays: Record<string, number> = {
    hourly: 0, // handled separately
    daily: 1,
    weekly: 7,
    biweekly: 14,
    monthly: 30,
  };

  let cursor = new Date(nextRun);
  const freq = schedule.frequency;
  const maxIterations = 100;
  let i = 0;

  while (i < maxIterations) {
    i++;
    if (freq === "hourly") {
      cursor = new Date(cursor.getTime() + 60 * 60 * 1000);
    } else if (freq === "monthly") {
      cursor = new Date(cursor);
      cursor.setMonth(cursor.getMonth() + 1);
    } else {
      cursor = new Date(cursor.getTime() + (freqDays[freq] || 7) * 24 * 60 * 60 * 1000);
    }

    if (cursor > endDate) break;
    if (cursor >= startDate) {
      occurrences.push(new Date(cursor));
    }
  }

  // Add past occurrences from lastRun and createdAt
  if (schedule.lastRun) {
    const lastRun = new Date(schedule.lastRun);
    if (lastRun >= startDate && lastRun <= endDate) {
      const alreadyHas = occurrences.some(o => isSameDay(o, lastRun));
      if (!alreadyHas) occurrences.push(lastRun);
    }
  }

  return occurrences;
}

// ─── Create Schedule Dialog ─────────────────────────────────────
function CreateScheduleDialog({ agents, projects, open, onOpenChange }: {
  agents: Agent[]; projects: Project[]; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [agentId, setAgentId] = useState("");
  const [frequency, setFrequency] = useState("weekly");
  const [priority, setPriority] = useState("medium");
  const [projectId, setProjectId] = useState("");
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/scheduled-tasks", data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-tasks"] });
      toast({ title: "Schedule created", description: `"${title}" will run ${frequency}` });
      onOpenChange(false);
      setTitle(""); setDescription(""); setAgentId(""); setFrequency("weekly"); setPriority("medium"); setProjectId("");
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            Create Schedule
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Weekly sprint review" className="mt-1" data-testid="input-sched-title" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What should happen each time..." rows={2} className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Assign to Agent</Label>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select agent" /></SelectTrigger>
                <SelectContent>
                  {agents.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.avatar} {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Project (optional)</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => createMutation.mutate({
              title, description: description || title, assignedAgentId: Number(agentId),
              frequency, priority, projectId: projectId && projectId !== "none" ? Number(projectId) : null,
            })}
            disabled={!title.trim() || !agentId || createMutation.isPending}
            className="gap-1.5"
            data-testid="button-create-sched"
          >
            {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Schedule Detail Dialog ─────────────────────────────────────
function ScheduleDetailDialog({ schedule, agent, onClose }: {
  schedule: any; agent?: Agent; onClose: () => void;
}) {
  const { toast } = useToast();
  const freqColor = FREQ_COLORS[schedule.frequency] || FREQ_COLORS.weekly;
  const srcInfo = SOURCE_LABELS[schedule.source] || SOURCE_LABELS.manual;

  const runMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/scheduled-tasks/${id}/run`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Task triggered", description: "Created task from schedule" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PATCH", `/api/scheduled-tasks/${id}`, { status }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/scheduled-tasks"] }),
  });

  const isActive = schedule.status === "active";
  const nextRunStr = schedule.nextRun
    ? new Date(schedule.nextRun).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";
  const lastRunStr = schedule.lastRun
    ? new Date(schedule.lastRun).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "Never";
  const createdStr = schedule.createdAt
    ? new Date(schedule.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "—";

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base pr-6">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isActive ? "bg-primary/10 border border-primary/30" : "bg-muted"}`}>
              {isActive ? <RefreshCw className="h-4 w-4 text-primary" /> : <Pause className="h-4 w-4 text-muted-foreground" />}
            </div>
            <span className="truncate">{schedule.title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tags */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`text-[10px] ${freqColor}`}>{schedule.frequency}</Badge>
            <Badge variant="outline" className={`text-[10px] ${srcInfo.color}`}>{srcInfo.label}</Badge>
            <Badge variant="outline" className={`text-[10px] ${isActive ? "bg-green-500/15 text-green-400 border-green-500/30" : "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"}`}>
              {schedule.status}
            </Badge>
            {schedule.priority && (
              <Badge variant="outline" className={`text-[10px] ${PRIORITY_COLORS[schedule.priority] || ""}`}>
                {schedule.priority}
              </Badge>
            )}
          </div>

          {/* Description */}
          {schedule.description && schedule.description !== schedule.title && (
            <p className="text-xs text-muted-foreground leading-relaxed">{schedule.description}</p>
          )}

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg bg-muted/30 p-2.5">
              <p className="text-[10px] text-muted-foreground mb-0.5">Assigned Agent</p>
              <p className="font-medium">{agent ? `${agent.avatar} ${agent.name}` : "Unassigned"}</p>
            </div>
            <div className="rounded-lg bg-muted/30 p-2.5">
              <p className="text-[10px] text-muted-foreground mb-0.5">Total Runs</p>
              <p className="font-medium">{schedule.runCount || 0}</p>
            </div>
            <div className="rounded-lg bg-muted/30 p-2.5">
              <p className="text-[10px] text-muted-foreground mb-0.5">Next Run</p>
              <p className="font-medium">{nextRunStr}</p>
            </div>
            <div className="rounded-lg bg-muted/30 p-2.5">
              <p className="text-[10px] text-muted-foreground mb-0.5">Last Run</p>
              <p className="font-medium">{lastRunStr}</p>
            </div>
            <div className="rounded-lg bg-muted/30 p-2.5 col-span-2">
              <p className="text-[10px] text-muted-foreground mb-0.5">Created</p>
              <p className="font-medium">{createdStr}</p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" size="sm" onClick={() => toggleMutation.mutate({ id: schedule.id, status: isActive ? "paused" : "active" })} className="gap-1.5">
            {isActive ? <><Pause className="h-3.5 w-3.5" /> Pause</> : <><Play className="h-3.5 w-3.5" /> Resume</>}
          </Button>
          <Button size="sm" onClick={() => runMutation.mutate(schedule.id)} disabled={runMutation.isPending} className="gap-1.5">
            {runMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            Run Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Calendar View ──────────────────────────────────────────────
function CalendarView({ schedules, agents }: { schedules: any[]; agents: Agent[] }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedSchedule, setSelectedSchedule] = useState<any | null>(null);

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  // Compute calendar range
  const calStart = new Date(year, month, 1);
  const calEnd = new Date(year, month, daysInMonth, 23, 59, 59);

  // Build occurrence map: day number -> schedule entries
  const dayMap = useMemo(() => {
    const map: Record<number, { schedule: any; time: Date }[]> = {};
    const activeSchedules = schedules.filter(s => s.status === "active");
    for (const sched of activeSchedules) {
      const occs = getOccurrences(sched, calStart, calEnd);
      for (const occ of occs) {
        if (occ.getMonth() === month && occ.getFullYear() === year) {
          const day = occ.getDate();
          if (!map[day]) map[day] = [];
          // Avoid duplicates for same schedule on same day
          if (!map[day].some(e => e.schedule.id === sched.id)) {
            map[day].push({ schedule: sched, time: occ });
          }
        }
      }
    }
    return map;
  }, [schedules, year, month]);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  }
  function goToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  }

  // Build cells
  const cells: (null | number)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const selectedAgent = selectedSchedule ? agents.find(a => a.id === selectedSchedule.assignedAgentId) : undefined;

  return (
    <div className="space-y-4">
      {/* Calendar header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-sm font-semibold w-40 text-center">
            {monthNames[month]} {year}
          </h3>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={goToday} className="text-xs h-7">
          Today
        </Button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-px">
        {dayNames.map(d => (
          <div key={d} className="text-center text-[10px] text-muted-foreground font-medium py-1.5">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px rounded-lg overflow-hidden border border-border/50">
        {cells.map((day, idx) => {
          const entries = day ? (dayMap[day] || []) : [];
          const todayClass = day && isToday(day) ? "ring-1 ring-primary/60 ring-inset" : "";
          const emptyClass = day === null ? "bg-muted/10" : "bg-card hover:bg-muted/20";

          return (
            <div
              key={idx}
              className={`min-h-[80px] p-1.5 transition-colors ${emptyClass} ${todayClass}`}
            >
              {day !== null && (
                <>
                  <div className={`text-[11px] font-medium mb-1 ${isToday(day) ? "text-primary font-bold" : "text-muted-foreground"}`}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {entries.slice(0, 3).map((entry, i) => {
                      const dotColor = FREQ_DOT_COLORS[entry.schedule.frequency] || "bg-zinc-400";
                      return (
                        <TooltipProvider key={i}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => setSelectedSchedule(entry.schedule)}
                                className="w-full text-left flex items-center gap-1 rounded px-1 py-0.5 hover:bg-muted/40 transition-colors group"
                              >
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                                <span className="text-[9px] truncate text-muted-foreground group-hover:text-foreground transition-colors">
                                  {entry.schedule.title.length > 18 ? entry.schedule.title.slice(0, 18) + "…" : entry.schedule.title}
                                </span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[200px]">
                              <p className="text-xs font-medium">{entry.schedule.title}</p>
                              <p className="text-[10px] text-muted-foreground">{entry.schedule.frequency} · {formatTime(entry.time)}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })}
                    {entries.length > 3 && (
                      <p className="text-[9px] text-muted-foreground px-1">+{entries.length - 3} more</p>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Frequency Legend */}
      <div className="flex items-center gap-4 justify-center pt-1">
        {Object.entries(FREQ_DOT_COLORS).map(([freq, color]) => (
          <div key={freq} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${color}`} />
            <span className="text-[10px] text-muted-foreground capitalize">{freq}</span>
          </div>
        ))}
      </div>

      {selectedSchedule && (
        <ScheduleDetailDialog
          schedule={selectedSchedule}
          agent={selectedAgent}
          onClose={() => setSelectedSchedule(null)}
        />
      )}
    </div>
  );
}

// ─── List View ──────────────────────────────────────────────────
function ListView({ schedules, agents, projects }: {
  schedules: any[]; agents: Agent[]; projects: Project[];
}) {
  const { toast } = useToast();
  const [selectedSchedule, setSelectedSchedule] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterFreq, setFilterFreq] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState<"next" | "title" | "frequency" | "runs">("next");

  const runMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/scheduled-tasks/${id}/run`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Task triggered", description: "Created task from schedule" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PATCH", `/api/scheduled-tasks/${id}`, { status }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/scheduled-tasks"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/scheduled-tasks/${id}`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-tasks"] });
      toast({ title: "Deleted", description: "Schedule removed" });
    },
  });

  // Filter & sort
  const filtered = useMemo(() => {
    let list = [...schedules];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s => s.title.toLowerCase().includes(q) || (s.description || "").toLowerCase().includes(q));
    }
    if (filterFreq !== "all") list = list.filter(s => s.frequency === filterFreq);
    if (filterStatus !== "all") list = list.filter(s => s.status === filterStatus);

    list.sort((a, b) => {
      if (sortBy === "next") {
        const aNext = a.nextRun ? new Date(a.nextRun).getTime() : Infinity;
        const bNext = b.nextRun ? new Date(b.nextRun).getTime() : Infinity;
        return aNext - bNext;
      }
      if (sortBy === "title") return a.title.localeCompare(b.title);
      if (sortBy === "frequency") {
        const order = ["hourly", "daily", "weekly", "biweekly", "monthly"];
        return order.indexOf(a.frequency) - order.indexOf(b.frequency);
      }
      if (sortBy === "runs") return (b.runCount || 0) - (a.runCount || 0);
      return 0;
    });
    return list;
  }, [schedules, searchQuery, filterFreq, filterStatus, sortBy]);

  const selectedAgent = selectedSchedule ? agents.find(a => a.id === selectedSchedule.assignedAgentId) : undefined;

  return (
    <div className="space-y-3">
      {/* Filters Row */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search schedules..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs"
            data-testid="input-search-schedules"
          />
        </div>
        <Select value={filterFreq} onValueChange={setFilterFreq}>
          <SelectTrigger className="h-8 w-[120px] text-xs">
            <Filter className="h-3 w-3 mr-1" /><SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All frequencies</SelectItem>
            {FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-[110px] text-xs">
            <CircleDot className="h-3 w-3 mr-1" /><SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
          <SelectTrigger className="h-8 w-[120px] text-xs">
            <ArrowUpDown className="h-3 w-3 mr-1" /><SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="next">Next run</SelectItem>
            <SelectItem value="title">Title</SelectItem>
            <SelectItem value="frequency">Frequency</SelectItem>
            <SelectItem value="runs">Most runs</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <p className="text-[10px] text-muted-foreground">
        {filtered.length} schedule{filtered.length !== 1 ? "s" : ""}{searchQuery && ` matching "${searchQuery}"`}
      </p>

      {/* Schedule Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <CalendarClock className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            {schedules.length === 0 ? "No schedules yet. Create one to automate recurring work." : "No schedules match your filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item: any) => {
            const agent = agents.find(a => a.id === item.assignedAgentId);
            const freqColor = FREQ_COLORS[item.frequency] || FREQ_COLORS.weekly;
            const srcInfo = SOURCE_LABELS[item.source] || SOURCE_LABELS.manual;
            const isActive = item.status === "active";
            const nextRunStr = item.nextRun
              ? new Date(item.nextRun).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
              : "—";
            const lastRunStr = item.lastRun
              ? new Date(item.lastRun).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
              : "Never";

            return (
              <Card
                key={item.id}
                className={`p-3.5 transition-all cursor-pointer hover:border-primary/30 ${!isActive ? "opacity-50" : ""}`}
                onClick={() => setSelectedSchedule(item)}
                data-testid={`sched-card-${item.id}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isActive ? "bg-primary/10 border border-primary/30" : "bg-muted"}`}>
                    {isActive ? <RefreshCw className="h-3.5 w-3.5 text-primary" /> : <Pause className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{item.title}</p>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${freqColor}`}>{item.frequency}</Badge>
                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${srcInfo.color}`}>{srcInfo.label}</Badge>
                      {item.priority && (
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${PRIORITY_COLORS[item.priority] || ""}`}>{item.priority}</Badge>
                      )}
                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${isActive ? "bg-green-500/15 text-green-400 border-green-500/30" : "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"}`}>
                        {item.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-[10px] text-muted-foreground">
                      {agent && <span>{agent.avatar} {agent.name}</span>}
                      <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> Next: {nextRunStr}</span>
                      <span>Last: {lastRunStr}</span>
                      <span>Runs: {item.runCount || 0}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <Button variant="outline" size="sm" onClick={() => runMutation.mutate(item.id)} disabled={runMutation.isPending} className="gap-1 h-7 text-xs" data-testid={`btn-run-${item.id}`}>
                      {runMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />} Run
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleMutation.mutate({ id: item.id, status: isActive ? "paused" : "active" })} className="h-7 w-7 p-0">
                      {isActive ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete schedule?</AlertDialogTitle>
                          <AlertDialogDescription>This will permanently remove "{item.title}".</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(item.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {selectedSchedule && (
        <ScheduleDetailDialog
          schedule={selectedSchedule}
          agent={selectedAgent}
          onClose={() => setSelectedSchedule(null)}
        />
      )}
    </div>
  );
}

// ─── Timeline View (upcoming & recent) ──────────────────────────
function TimelineView({ schedules, agents }: { schedules: any[]; agents: Agent[] }) {
  const now = new Date();
  const [selectedSchedule, setSelectedSchedule] = useState<any | null>(null);

  // Build upcoming events for next 14 days
  const upcoming = useMemo(() => {
    const start = new Date(now);
    const end = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const events: { schedule: any; date: Date; type: "upcoming" }[] = [];

    for (const sched of schedules.filter(s => s.status === "active")) {
      const occs = getOccurrences(sched, start, end);
      for (const occ of occs) {
        events.push({ schedule: sched, date: occ, type: "upcoming" });
      }
    }
    events.sort((a, b) => a.date.getTime() - b.date.getTime());
    return events.slice(0, 30);
  }, [schedules]);

  // Group by day
  const groupedByDay = useMemo(() => {
    const groups: { label: string; date: Date; events: typeof upcoming }[] = [];
    for (const ev of upcoming) {
      const dayLabel = isSameDay(ev.date, now)
        ? "Today"
        : isSameDay(ev.date, new Date(now.getTime() + 86400000))
        ? "Tomorrow"
        : ev.date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

      const existing = groups.find(g => g.label === dayLabel);
      if (existing) {
        existing.events.push(ev);
      } else {
        groups.push({ label: dayLabel, date: ev.date, events: [ev] });
      }
    }
    return groups;
  }, [upcoming]);

  const selectedAgent = selectedSchedule ? agents.find(a => a.id === selectedSchedule.assignedAgentId) : undefined;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Next 14 days of scheduled activity</p>

      {groupedByDay.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No upcoming schedules in the next 14 days.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByDay.map((group, gi) => (
            <div key={gi}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`h-2 w-2 rounded-full ${group.label === "Today" ? "bg-primary" : "bg-muted-foreground/40"}`} />
                <h3 className={`text-xs font-semibold ${group.label === "Today" ? "text-primary" : ""}`}>
                  {group.label}
                </h3>
                <span className="text-[10px] text-muted-foreground">({group.events.length})</span>
              </div>
              <div className="space-y-1.5 ml-3 border-l border-border/40 pl-3">
                {group.events.map((ev, ei) => {
                  const agent = agents.find(a => a.id === ev.schedule.assignedAgentId);
                  const dotColor = FREQ_DOT_COLORS[ev.schedule.frequency] || "bg-zinc-400";
                  return (
                    <button
                      key={ei}
                      onClick={() => setSelectedSchedule(ev.schedule)}
                      className="w-full text-left flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-muted/30 transition-colors group"
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate group-hover:text-primary transition-colors">{ev.schedule.title}</p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                          <span>{formatTime(ev.date)}</span>
                          {agent && <span>{agent.avatar} {agent.name}</span>}
                          <span className="capitalize">{ev.schedule.frequency}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedSchedule && (
        <ScheduleDetailDialog
          schedule={selectedSchedule}
          agent={selectedAgent}
          onClose={() => setSelectedSchedule(null)}
        />
      )}
    </div>
  );
}

// ─── Main Schedules Page ────────────────────────────────────────
export default function SchedulesPage() {
  const { data: schedules = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/scheduled-tasks"],
    refetchInterval: 10000,
  });
  const { data: agents = [] } = useQuery<Agent[]>({ queryKey: ["/api/agents"] });
  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ["/api/projects"] });
  const [createOpen, setCreateOpen] = useState(false);
  const [view, setView] = useState<"list" | "calendar" | "timeline">("list");

  const active = schedules.filter(s => s.status === "active").length;
  const paused = schedules.filter(s => s.status === "paused").length;
  const totalRuns = schedules.reduce((s, t) => s + (t.runCount || 0), 0);

  // Frequency distribution
  const freqDist = useMemo(() => {
    const dist: Record<string, number> = {};
    for (const s of schedules) {
      dist[s.frequency] = (dist[s.frequency] || 0) + 1;
    }
    return dist;
  }, [schedules]);

  // Next upcoming
  const nextUp = useMemo(() => {
    const activeSorted = schedules
      .filter(s => s.status === "active" && s.nextRun)
      .sort((a, b) => new Date(a.nextRun).getTime() - new Date(b.nextRun).getTime());
    return activeSorted[0];
  }, [schedules]);

  const nextUpAgent = nextUp ? agents.find(a => a.id === nextUp.assignedAgentId) : null;
  const nextUpStr = nextUp?.nextRun
    ? new Date(nextUp.nextRun).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading schedules...
      </div>
    );
  }

  return (
    <div>
      <div className="p-4 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
              <CalendarClock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Schedules</h1>
              <p className="text-sm text-muted-foreground">Recurring tasks, meetings, and automated workflows</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center bg-muted/30 rounded-lg p-0.5">
              <Button
                variant={view === "list" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setView("list")}
                className="h-7 text-xs gap-1"
              >
                <List className="h-3 w-3" /> List
              </Button>
              <Button
                variant={view === "calendar" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setView("calendar")}
                className="h-7 text-xs gap-1"
              >
                <CalendarIcon className="h-3 w-3" /> Calendar
              </Button>
              <Button
                variant={view === "timeline" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setView("timeline")}
                className="h-7 text-xs gap-1"
              >
                <Clock className="h-3 w-3" /> Timeline
              </Button>
            </div>
            <Button onClick={() => setCreateOpen(true)} className="gap-2 h-8 text-xs" data-testid="btn-new-schedule">
              <Plus className="h-3.5 w-3.5" /> New Schedule
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Card className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Active</p>
                <p className="text-lg font-bold text-green-400 mt-0.5">{active}</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                <RefreshCw className="h-3.5 w-3.5 text-green-400" />
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Paused</p>
                <p className="text-lg font-bold text-yellow-400 mt-0.5">{paused}</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <Pause className="h-3.5 w-3.5 text-yellow-400" />
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Runs</p>
                <p className="text-lg font-bold mt-0.5">{totalRuns}</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Zap className="h-3.5 w-3.5 text-blue-400" />
              </div>
            </div>
          </Card>
          <Card className="p-3 col-span-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Next Upcoming</p>
                {nextUp ? (
                  <div className="mt-0.5">
                    <p className="text-xs font-medium truncate">{nextUp.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {nextUpStr} {nextUpAgent ? `· ${nextUpAgent.avatar} ${nextUpAgent.name}` : ""}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mt-0.5">No upcoming schedules</p>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Frequency Distribution */}
        {schedules.length > 0 && (
          <Card className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Frequency Distribution</p>
            </div>
            <div className="flex items-end gap-1" style={{ height: '48px' }}>
              {["hourly", "daily", "weekly", "biweekly", "monthly"].map(freq => {
                const count = freqDist[freq] || 0;
                const max = Math.max(...Object.values(freqDist), 1);
                const barH = count > 0 ? Math.max(8, Math.round((count / max) * 36)) : 3;
                const dotColor = FREQ_DOT_COLORS[freq] || "bg-zinc-400";
                return (
                  <TooltipProvider key={freq}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex-1 flex flex-col items-center justify-end gap-1" style={{ height: '48px' }}>
                          <div className={`w-full rounded-t ${dotColor} transition-all`} style={{ height: `${barH}px`, opacity: count > 0 ? 1 : 0.15 }} />
                          <span className="text-[8px] text-muted-foreground capitalize">{freq.slice(0, 3)}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs capitalize">{freq}: {count} schedule{count !== 1 ? "s" : ""}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
          </Card>
        )}

        {/* View Content */}
        {view === "list" && <ListView schedules={schedules} agents={agents} projects={projects} />}
        {view === "calendar" && <CalendarView schedules={schedules} agents={agents} />}
        {view === "timeline" && <TimelineView schedules={schedules} agents={agents} />}
      </div>

      <CreateScheduleDialog agents={agents} projects={projects} open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
