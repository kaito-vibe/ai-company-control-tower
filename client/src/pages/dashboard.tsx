import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest, formatCurrency } from "@/lib/utils";
import type { Agent, AgentTask, Project, Goal } from "@shared/schema";
import {
  Users, ListTodo, FolderKanban, DollarSign, TrendingUp, Clock,
  CheckCircle2, XCircle, AlertTriangle, Brain, Sparkles, ArrowRight, Target,
  Activity, UserPlus, Zap, Shield, Plus, Loader2, ChevronDown, ChevronUp,
  FileText, Eye, Gavel, Workflow, Camera, UserCheck, HeartPulse, Lightbulb,
  CalendarPlus, Building, BarChart3, MessageSquarePlus, RefreshCw, CalendarCheck2, Link2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { HelpButton } from "@/components/help-button";

function StatCard({ title, value, subtitle, icon: Icon, trend, color, href }: {
  title: string; value: string | number; subtitle?: string; icon: any; trend?: string; color?: string; href?: string;
}) {
  const card = (
    <Card className={`p-4${href ? " cursor-pointer hover:bg-muted/30 transition-colors" : ""}`} data-testid={`stat-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-medium">{title}</p>
          <p className="text-2xl font-bold mt-1" style={color ? { color } : {}}>{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center">
          <Icon className="h-4.5 w-4.5 text-muted-foreground" />
        </div>
      </div>
      {trend && <p className="text-xs text-green-400 mt-2 flex items-center gap-1"><TrendingUp className="h-3 w-3" />{trend}</p>}
    </Card>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}

const LOAD_COLORS: Record<string, string> = {
  idle: "text-muted-foreground",
  normal: "text-green-400",
  busy: "text-yellow-400",
  overloaded: "text-red-400",
};

function WorkloadCard({ agent }: { agent: any }) {
  const loadColor = LOAD_COLORS[agent.status] || LOAD_COLORS.idle;
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/30 transition-colors" data-testid={`workload-${agent.agentId}`}>
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
        style={{ backgroundColor: `${agent.color || "#666"}20`, border: `1px solid ${agent.color || "#666"}30` }}>
        {agent.avatar || "🧠"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <Link href="/org-chart"><span className="text-sm font-medium truncate hover:underline cursor-pointer">{agent.agentName}</span></Link>
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-medium ${loadColor}`}>{agent.status}</span>
            <span className="text-xs text-muted-foreground">{agent.activeTasks} active</span>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Progress value={Math.min(agent.loadScore * 10, 100)} className="h-1.5 flex-1" />
          <span className="text-[10px] text-muted-foreground w-10 text-right">{agent.completedTasks} done</span>
        </div>
      </div>
    </div>
  );
}

const EVENT_ICONS: Record<string, any> = {
  check: CheckCircle2,
  sparkles: Sparkles,
  user_plus: UserPlus,
  x_circle: XCircle,
  brain: Brain,
  meeting: Users,
  gavel: Gavel,
  alert_triangle: AlertTriangle,
  users: Users,
  workflow: Workflow,
  target: Target,
  camera: Camera,
  folder: FolderKanban,
};

function ActivityFeed() {
  const { data: events = [] } = useQuery<any[]>({
    queryKey: ["/api/activity-feed"],
    refetchInterval: 8000,
  });
  const { data: agents = [] } = useQuery<Agent[]>({ queryKey: ["/api/agents"] });

  if (events.length === 0) {
    return <p className="text-xs text-muted-foreground py-6 text-center">No recent activity</p>;
  }

  return (
    <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
      {events.slice(0, 20).map((event, i) => {
        const Icon = EVENT_ICONS[event.icon] || Activity;
        const agent = agents.find(a => a.id === event.agentId);
        const timeStr = new Date(event.timestamp).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
        const linkHref = event.link || null;
        const inner = (
          <div key={i} className={`flex items-start gap-2.5 p-2 rounded-lg hover:bg-muted/20 transition-colors${linkHref ? " cursor-pointer" : ""}`}>
            <div className="w-6 h-6 rounded-full bg-muted/50 flex items-center justify-center shrink-0 mt-0.5">
              {agent ? (
                <span className="text-xs">{agent.avatar}</span>
              ) : (
                <Icon className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{event.title}</p>
              <p className="text-[10px] text-muted-foreground">{event.detail} · {timeStr}</p>
            </div>
          </div>
        );
        return linkHref ? <Link key={i} href={linkHref}>{inner}</Link> : <div key={i}>{inner}</div>;
      })}
    </div>
  );
}

function QuickAssignDialog({ agents, open, onOpenChange }: {
  agents: Agent[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [agentId, setAgentId] = useState<string>("");
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/tasks", data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Task created", description: "Task assigned and thinking started" });
      onOpenChange(false);
      setTitle(""); setDescription(""); setAgentId("");
    },
    onError: (err: any) => {
      toast({ title: "Failed to create task", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quick Assign Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Task title" className="mt-1" />
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description..." rows={2} className="mt-1" />
          </div>
          <div>
            <Label>Assign to</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select agent" /></SelectTrigger>
              <SelectContent>
                {agents.map(a => (
                  <SelectItem key={a.id} value={a.id.toString()}>{a.avatar} {a.name} — {a.role}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => createMutation.mutate({
              title,
              description: description || title,
              type: "general",
              assignedAgentId: Number(agentId) || agents[0]?.id,
              priority: "medium",
            })}
            disabled={!title.trim() || !agentId || createMutation.isPending}
            className="gap-1.5"
          >
            {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Create & Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  hire_agent: { label: "Hire", color: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  delegate: { label: "Delegation", color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  general: { label: "Proposal", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  workflow: { label: "Workflow", color: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30" },
};

const PRIORITY_BADGE: Record<string, string> = {
  urgent: "bg-red-500/15 text-red-400 border-red-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  low: "bg-muted text-muted-foreground border-border",
};

function ApprovalCard({ task, agent, expanded, onToggle }: { task: AgentTask; agent?: Agent; expanded: boolean; onToggle: () => void }) {
  const { toast } = useToast();

  const approveMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/tasks/${task.id}/approve`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Approved", description: `"${task.title}" approved and executing` });
    },
    onError: (err: any) => {
      toast({ title: "Approve failed", description: err.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/tasks/${task.id}/reject`, {}).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Rejected", description: `"${task.title}" rejected` });
    },
    onError: (err: any) => {
      toast({ title: "Reject failed", description: err.message, variant: "destructive" });
    },
  });

  const isLoading = approveMutation.isPending || rejectMutation.isPending;
  const typeMeta = TYPE_LABELS[task.type] || TYPE_LABELS.general;
  const prioClass = PRIORITY_BADGE[task.priority] || PRIORITY_BADGE.medium;
  const createdStr = task.createdAt ? new Date(task.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <div className="rounded-lg bg-blue-500/5 border border-blue-500/15 hover:border-blue-500/30 transition-all" data-testid={`approval-${task.id}`}>
      <div className="p-2.5 cursor-pointer" onClick={onToggle}>
        <div className="flex items-start gap-2.5">
          <Sparkles className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-snug">{task.title}</p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 shrink-0 ${typeMeta.color}`}>{typeMeta.label}</Badge>
              <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 shrink-0 ${prioClass}`}>{task.priority}</Badge>
              <span className="text-[10px] text-muted-foreground">{agent?.avatar} {agent?.name} · {createdStr}</span>
            </div>
          </div>
          {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />}
        </div>
        <div className="flex items-center gap-1.5 mt-2 ml-6">
          <Button size="sm" onClick={e => { e.stopPropagation(); approveMutation.mutate(); }} disabled={isLoading} className="gap-1 h-7 text-xs bg-green-600 hover:bg-green-700">
            {approveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
            Approve
          </Button>
          <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); rejectMutation.mutate(); }} disabled={isLoading} className="gap-1 h-7 text-xs text-destructive hover:text-destructive">
            {rejectMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
            Reject
          </Button>
        </div>
      </div>
      {expanded && task.proposal && (
        <div className="px-3 pb-3 border-t border-blue-500/10">
          <div className="pt-2 text-xs text-muted-foreground whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">
            {task.proposal.length > 600 ? task.proposal.slice(0, 600) + "..." : task.proposal}
          </div>
          {task.proposal.length > 600 && (
            <Link href="/tasks" className="text-[10px] text-primary hover:underline mt-1 inline-flex items-center gap-0.5">
              <Eye className="h-3 w-3" /> Read full proposal
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function BulkApproveButton({ taskIds }: { taskIds: number[] }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleBulkApprove() {
    setLoading(true);
    try {
      for (const id of taskIds) {
        await apiRequest("POST", `/api/tasks/${id}/approve`).then(r => r.json());
      }
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "All approved", description: `${taskIds.length} proposals approved` });
    } catch (err: any) {
      toast({ title: "Bulk approve failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleBulkApprove}
      disabled={loading}
      className="gap-1 h-7 text-xs border-green-500/30 text-green-400 hover:bg-green-500/10"
      data-testid="button-bulk-approve"
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
      Approve All ({taskIds.length})
    </Button>
  );
}

// ==================== #10 Company Health Score ====================
const METRIC_LABELS: Record<string, string> = {
  taskThroughput: "Task Throughput",
  agentUtilization: "Agent Utilization",
  financialHealth: "Financial Health",
  projectProgress: "Project Progress",
  goalAlignment: "Goal Alignment",
};

const METRIC_COLORS: Record<string, string> = {
  taskThroughput: "border-blue-500/30 text-blue-400",
  agentUtilization: "border-green-500/30 text-green-400",
  financialHealth: "border-emerald-500/30 text-emerald-400",
  projectProgress: "border-orange-500/30 text-orange-400",
  goalAlignment: "border-violet-500/30 text-violet-400",
};

function HealthScoreWidget() {
  const { data: health } = useQuery<any>({
    queryKey: ["/api/company/health"],
    refetchInterval: 15000,
  });
  const { data: agents = [] } = useQuery<Agent[]>({ queryKey: ["/api/agents"] });
  const { toast } = useToast();
  const [loadingFixes, setLoadingFixes] = useState(false);
  const [proposals, setProposals] = useState<any[]>([]);
  const [creatingId, setCreatingId] = useState<number | null>(null);

  async function loadRemediation() {
    setLoadingFixes(true);
    try {
      const resp = await apiRequest("POST", "/api/company/health/remediation");
      const data = await resp.json();
      setProposals(data.proposals || []);
    } catch (err: any) {
      toast({ title: "Failed to load fixes", description: err.message, variant: "destructive" });
    } finally {
      setLoadingFixes(false);
    }
  }

  async function submitForApproval(proposal: any, idx: number) {
    setCreatingId(idx);
    try {
      await apiRequest("POST", "/api/approval-queue", {
        title: proposal.title,
        description: `[Health Remediation] ${proposal.description}\n\nTarget: ${METRIC_LABELS[proposal.targetMetric] || proposal.targetMetric}\nExpected impact: ${proposal.expectedImpact}`,
        priority: proposal.priority || "high",
        assignedAgentId: proposal.assignedAgentId || null,
        source: "health_remediation",
        targetMetric: proposal.targetMetric,
        expectedImpact: proposal.expectedImpact,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/approval-queue"] });
      toast({ title: "Sent for approval", description: `"${proposal.title}" added to CEO approval queue` });
      setProposals(prev => prev.filter((_, i) => i !== idx));
    } catch (err: any) {
      toast({ title: "Failed to submit", description: err.message, variant: "destructive" });
    } finally {
      setCreatingId(null);
    }
  }

  async function submitAllForApproval() {
    for (let i = 0; i < proposals.length; i++) {
      await submitForApproval(proposals[i], i);
    }
  }

  if (!health) return null;

  const score = health.score;
  const color = score >= 70 ? "text-green-400" : score >= 40 ? "text-yellow-400" : "text-red-400";
  const bg = score >= 70 ? "from-green-500/10" : score >= 40 ? "from-yellow-500/10" : "from-red-500/10";
  const label = score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Fair" : "Needs Attention";

  // Find the weakest areas (below 50%)
  const weakAreas = Object.entries(health.breakdown)
    .filter(([, val]: [string, any]) => (val as any).score / (val as any).max < 0.5)
    .sort((a: any, b: any) => (a[1].score / a[1].max) - (b[1].score / b[1].max));

  return (
    <Card className={`p-4 bg-gradient-to-br ${bg} to-transparent border-border/50`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="relative">
          <HeartPulse className={`h-5 w-5 ${color}`} />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full animate-pulse" style={{
            backgroundColor: score >= 70 ? "#4ade80" : score >= 40 ? "#facc15" : "#f87171"
          }} />
        </div>
        <div>
          <h2 className="text-sm font-semibold">Company Health</h2>
          <p className="text-[10px] text-muted-foreground">{label}</p>
        </div>
        <span className={`text-2xl font-bold ml-auto ${color}`}>{score}</span>
      </div>
      <div className="space-y-1.5">
        {Object.entries(health.breakdown).map(([key, val]: [string, any]) => {
          const pct = (val.score / val.max) * 100;
          const barColor = pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-yellow-500" : "bg-red-500";
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-28 truncate capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[10px] text-muted-foreground w-8 text-right">{val.score}/{val.max}</span>
            </div>
          );
        })}
      </div>

      {/* Alerts */}
      {(health.alerts.blockedTasks > 0 || health.alerts.zombieTasks > 0 || health.alerts.idleAgents > 0) && (
        <div className="mt-2 pt-2 border-t border-border/30 flex flex-wrap gap-1.5">
          {health.alerts.blockedTasks > 0 && (
            <Badge variant="outline" className="text-[9px] border-red-500/30 text-red-400">{health.alerts.blockedTasks} blocked</Badge>
          )}
          {health.alerts.zombieTasks > 0 && (
            <Badge variant="outline" className="text-[9px] border-yellow-500/30 text-yellow-400">{health.alerts.zombieTasks} stuck</Badge>
          )}
          {health.alerts.idleAgents > 0 && (
            <Badge variant="outline" className="text-[9px] border-muted-foreground/30 text-muted-foreground">{health.alerts.idleAgents} idle agents</Badge>
          )}
        </div>
      )}

      {/* Propose Fixes button */}
      {weakAreas.length > 0 && proposals.length === 0 && (
        <div className="mt-3 pt-2 border-t border-border/30">
          <Button
            variant="outline"
            size="sm"
            onClick={loadRemediation}
            disabled={loadingFixes}
            className="w-full gap-1.5 h-8 text-xs"
            data-testid="button-propose-fixes"
          >
            {loadingFixes ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> Analyzing issues...</>
            ) : (
              <><Sparkles className="h-3 w-3" /> Propose Fix Projects ({weakAreas.length} weak area{weakAreas.length !== 1 ? "s" : ""})</>
            )}
          </Button>
        </div>
      )}

      {/* Remediation Proposals */}
      {proposals.length > 0 && (
        <div className="mt-3 pt-2 border-t border-border/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
              Proposed Fix Projects
            </span>
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={submitAllForApproval}
                disabled={creatingId !== null}
                className="h-6 text-[10px] gap-1 px-2"
                data-testid="button-submit-all-fixes"
              >
                <Gavel className="h-2.5 w-2.5" /> Submit All for Approval
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setProposals([])}
                className="h-6 text-[10px] px-2"
              >
                Dismiss
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            {proposals.map((p, i) => {
              const agent = agents.find(a => a.id === p.assignedAgentId);
              return (
                <div key={i} className="p-2.5 rounded-lg bg-muted/30 border border-muted/50 hover:border-primary/20 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs font-medium">{p.title}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground line-clamp-2 mb-1.5">{p.description}</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className={`text-[9px] h-4 px-1.5 ${METRIC_COLORS[p.targetMetric] || ""}`}>
                          {METRIC_LABELS[p.targetMetric] || p.targetMetric}
                        </Badge>
                        <span className="text-[9px] text-green-400">{p.expectedImpact}</span>
                        {agent && (
                          <span className="text-[10px] text-muted-foreground">{agent.avatar} {agent.name}</span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => submitForApproval(p, i)}
                      disabled={creatingId === i}
                      className="h-7 text-[10px] gap-1 px-2 shrink-0"
                      data-testid={`button-submit-fix-${i}`}
                    >
                      {creatingId === i ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <><Gavel className="h-3 w-3" /> Submit</>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

// ==================== #9 Smart Task Suggestions ====================
function SmartSuggestions() {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const { toast } = useToast();

  async function loadSuggestions() {
    setLoading(true);
    try {
      const resp = await fetch("/api/suggestions/tasks");
      const data = await resp.json();
      setSuggestions(data.suggestions || []);
    } catch (err: any) {
      toast({ title: "Failed to load suggestions", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function createTask(suggestion: any) {
    try {
      await apiRequest("POST", "/api/tasks", {
        title: suggestion.title,
        description: suggestion.description,
        assignedAgentId: suggestion.assignedAgentId,
        type: "general",
        priority: suggestion.priority || "medium",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Task created", description: `"${suggestion.title}" created and assigned` });
      setSuggestions(prev => prev.filter(s => s.title !== suggestion.title));
    } catch (err: any) {
      toast({ title: "Failed to create task", description: err.message, variant: "destructive" });
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-yellow-400" />
          AI Suggestions
        </h2>
        <Button variant="ghost" size="sm" onClick={loadSuggestions} disabled={loading} className="gap-1 h-7 text-xs">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          {suggestions.length > 0 ? "Refresh" : "Generate"}
        </Button>
      </div>
      {suggestions.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">
          {loading ? "AI is analyzing your company..." : "Click Generate to get AI-powered task suggestions"}
        </p>
      ) : (
        <div className="space-y-2">
          {suggestions.slice(0, 5).map((s, i) => (
            <div key={i} className="flex items-start gap-2.5 p-2 rounded-lg bg-yellow-500/5 border border-yellow-500/10 hover:border-yellow-500/20 transition-all">
              <Lightbulb className="h-3.5 w-3.5 text-yellow-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">{s.title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{s.reasoning || s.description}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${PRIORITY_BADGE[s.priority] || PRIORITY_BADGE.medium}`}>
                    {s.priority}
                  </Badge>
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => createTask(s)} className="h-7 text-xs gap-1 text-primary shrink-0">
                <Plus className="h-3 w-3" /> Create
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ==================== #2 Quick Actions Bar ====================
function QuickActionsBar({ onCreateTask, onCallMeeting }: { onCreateTask: () => void; onCallMeeting: () => void }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button size="sm" onClick={onCreateTask} className="gap-1.5 h-8 text-xs" data-testid="quick-action-task">
        <Plus className="h-3.5 w-3.5" /> Create Task
      </Button>
      <Link href="/meetings">
        <Button size="sm" variant="outline" onClick={onCallMeeting} className="gap-1.5 h-8 text-xs" data-testid="quick-action-meeting">
          <CalendarPlus className="h-3.5 w-3.5" /> Call Meeting
        </Button>
      </Link>
      <Link href="/org-chart">
        <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" data-testid="quick-action-hire">
          <UserPlus className="h-3.5 w-3.5" /> Hire Agent
        </Button>
      </Link>
      <Link href="/analytics">
        <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" data-testid="quick-action-review">
          <BarChart3 className="h-3.5 w-3.5" /> Company Review
        </Button>
      </Link>
    </div>
  );
}

function StrategyConnectionWidget({ goals, agents }: { goals: Goal[]; agents: Agent[] }) {
  const { data: stratDash, isLoading } = useQuery<any>({
    queryKey: ["/api/strategy/dashboard"],
    refetchInterval: 15000,
  });
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const objectives = goals.filter(g => g.type === "objective");

  async function handleStrategySync() {
    setSyncing(true);
    try {
      const resp = await apiRequest("POST", "/api/strategy/sync");
      const data = await resp.json();
      queryClient.invalidateQueries({ queryKey: ["/api/strategy/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-tasks"] });
      toast({ title: "Strategy synced", description: `${data.created} new recurring tasks created` });
    } catch (err: any) {
      toast({ title: "Sync failed", description: err.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  }

  if (objectives.length === 0) return null;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Target className="h-4 w-4 text-violet-400" />
          Strategy Connection
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleStrategySync}
            disabled={syncing}
            className="gap-1.5 h-7 text-xs"
            data-testid="button-strategy-sync"
          >
            {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Sync Strategy
          </Button>
          <Link href="/strategy" className="text-xs text-primary hover:underline flex items-center gap-1">
            View <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {stratDash ? (
        <div className="space-y-3">
          {/* Summary row */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-muted/30 rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold">{stratDash.totalObjectives}</p>
              <p className="text-[10px] text-muted-foreground">Objectives</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold">
                <span className={stratDash.linkageRate >= 50 ? "text-green-400" : "text-orange-400"}>{stratDash.linkageRate}%</span>
              </p>
              <p className="text-[10px] text-muted-foreground">Projects Linked</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold">{stratDash.totalScheduledTasks}</p>
              <p className="text-[10px] text-muted-foreground">Recurring Tasks</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-2.5 text-center">
              <div className="flex justify-center gap-1">
                {stratDash.scheduledBySource.meeting > 0 && (
                  <Badge variant="outline" className="text-[9px] px-1 h-4 border-blue-500/30 text-blue-400">{stratDash.scheduledBySource.meeting} meeting</Badge>
                )}
                {stratDash.scheduledBySource.strategy > 0 && (
                  <Badge variant="outline" className="text-[9px] px-1 h-4 border-violet-500/30 text-violet-400">{stratDash.scheduledBySource.strategy} strategy</Badge>
                )}
                {stratDash.scheduledBySource.manual > 0 && (
                  <Badge variant="outline" className="text-[9px] px-1 h-4">{stratDash.scheduledBySource.manual} manual</Badge>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">By Source</p>
            </div>
          </div>

          {/* Per-objective detail */}
          <div className="space-y-2">
            {(stratDash.objectives || []).map((obj: any) => {
              const owner = agents.find(a => a.id === obj.ownerId);
              return (
                <div key={obj.id} className="p-2.5 rounded-lg bg-muted/20 border border-muted/40">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Target className={`h-3.5 w-3.5 shrink-0 ${obj.progress >= 100 ? "text-green-400" : obj.progress < 25 ? "text-orange-400" : "text-violet-400"}`} />
                    <span className="text-sm font-medium flex-1 truncate">{obj.title}</span>
                    <span className="text-xs text-muted-foreground">{obj.progress}%</span>
                  </div>
                  <Progress value={obj.progress} className="h-1 mb-2" />
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Link2 className="h-2.5 w-2.5" /> {obj.projectCount} projects</span>
                    <span className="flex items-center gap-1"><CalendarCheck2 className="h-2.5 w-2.5" /> {obj.scheduledTasks} recurring</span>
                    {obj.keyResults?.length > 0 && (
                      <span>{obj.keyResults.length} key results</span>
                    )}
                  </div>
                  {obj.projects?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {obj.projects.map((p: any) => (
                        <Badge key={p.id} variant="outline" className="text-[9px] h-4 px-1.5">
                          {p.title.slice(0, 25)}{p.title.length > 25 ? "..." : ""} ({p.status})
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading strategy data...
        </div>
      ) : null}
    </Card>
  );
}

export default function Dashboard() {
  const { data: stats } = useQuery<any>({
    queryKey: ["/api/dashboard/stats"],
    refetchInterval: 5000,
  });
  const { data: tasks = [] } = useQuery<AgentTask[]>({ queryKey: ["/api/tasks"] });
  const { data: agents = [] } = useQuery<Agent[]>({ queryKey: ["/api/agents"] });
  const { data: goals = [] } = useQuery<Goal[]>({ queryKey: ["/api/goals"] });
  const { data: workload = [] } = useQuery<any[]>({
    queryKey: ["/api/agents/workload"],
    refetchInterval: 8000,
  });
  const [quickAssignOpen, setQuickAssignOpen] = useState(false);
  const [expandedApproval, setExpandedApproval] = useState<number | null>(null);
  const objectives = goals.filter(g => g.type === "objective");

  // Credit pause status
  const { data: creditPause } = useQuery<any>({
    queryKey: ["/api/credit-pause"],
    refetchInterval: 15000,
  });

  // #5 Real-time notification toasts
  const { toast } = useToast();
  const { data: notifications = [] } = useQuery<any[]>({
    queryKey: ["/api/notifications/stored"],
    refetchInterval: 10000,
  });

  const { data: approvalQueue = [] } = useQuery<any[]>({ queryKey: ["/api/approval-queue"], refetchInterval: 5000 });

  useEffect(() => {
    const unread = notifications.filter((n: any) => !n.read);
    if (unread.length > 0) {
      const latest = unread[0];
      toast({
        title: latest.title,
        description: latest.message,
      });
      // Mark as read
      apiRequest("PATCH", `/api/notifications/stored/${latest.id}`, { read: true }).catch(() => {});
    }
  }, [notifications.length]);

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">
        <Brain className="h-5 w-5 animate-spin mr-2" />
        Loading dashboard...
      </div>
    );
  }
  const pendingCeoApprovals = approvalQueue.filter((q: any) => q.status === "pending").length;
  const awaitingApproval = tasks.filter(t => t.status === "proposal_ready");
  const thinkingTasks = tasks.filter(t => t.status === "thinking");
  const executingTasks = tasks.filter(t => t.status === "executing");
  const underReviewTasks = tasks.filter(t => t.status === "under_review");
  const completedTasks = tasks.filter(t => t.status === "completed");
  const failedTasks = tasks.filter(t => t.status === "rejected" || t.status === "failed");
  const blockedTasks = tasks.filter(t => t.status === "blocked");

  return (
    <div>
      <div className="p-4 space-y-5">
        {/* Header + Quick Actions */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <div>
              <h1 className="text-xl font-bold">Control Tower</h1>
              <p className="text-sm text-muted-foreground">Company overview and agent activity</p>
            </div>
            <HelpButton page="dashboard" />
          </div>
          <QuickActionsBar onCreateTask={() => setQuickAssignOpen(true)} onCallMeeting={() => {}} />
        </div>

        {/* CEO Approval Alert */}
        {pendingCeoApprovals > 0 && (
          <Link href="/approvals">
            <Card className="p-3 border-yellow-500/30 bg-yellow-500/5 hover:bg-yellow-500/10 transition-colors cursor-pointer" data-testid="ceo-approval-banner">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center shrink-0">
                  <Gavel className="h-5 w-5 text-yellow-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-yellow-400">{pendingCeoApprovals} project proposal{pendingCeoApprovals !== 1 ? "s" : ""} awaiting your decision</p>
                  <p className="text-xs text-muted-foreground">Review and approve, reject, or defer proposed projects</p>
                </div>
                <ArrowRight className="h-4 w-4 text-yellow-400 shrink-0" />
              </div>
            </Card>
          </Link>
        )}

        {/* Credit Pause Banner */}
        {creditPause?.paused && (
          <Card className="p-3 border-orange-500/40 bg-orange-500/10 animate-pulse" data-testid="credit-pause-banner">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-orange-500/20 border border-orange-500/40 flex items-center justify-center shrink-0">
                <Shield className="h-5 w-5 text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-orange-400">Task Processing Paused — Credits / Rate Limit</p>
                <p className="text-xs text-muted-foreground">
                  {creditPause.reason?.slice(0, 120)}
                  {creditPause.resumeAt && (
                    <span> · Auto-retry at {new Date(creditPause.resumeAt).toLocaleTimeString()}</span>
                  )}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-orange-500/40 text-orange-400 hover:bg-orange-500/20 shrink-0"
                onClick={async (e) => {
                  e.preventDefault();
                  await apiRequest("POST", "/api/credit-pause/resume");
                  queryClient.invalidateQueries({ queryKey: ["/api/credit-pause"] });
                }}
              >
                Force Resume
              </Button>
            </div>
          </Card>
        )}

        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard title="Active Agents" value={stats.agents.active} subtitle={`${stats.agents.total} total`} icon={Users} />
          <StatCard title="Active Tasks" value={stats.tasks.active} subtitle={`${stats.tasks.completed} completed`} icon={ListTodo} href="/tasks" />
          <StatCard title="Projects" value={stats.projects.total} subtitle={`${stats.projects.inProgress} in progress`} icon={FolderKanban} href="/projects" />
          <StatCard
            title="Net Revenue"
            value={formatCurrency(stats.finances.profit)}
            subtitle={`${formatCurrency(stats.finances.totalEarnings)} earned`}
            icon={DollarSign}
            color={stats.finances.profit >= 0 ? "#4ade80" : "#f87171"}
          />
        </div>

        {/* Live Pulse: thinking + executing */}
        {(thinkingTasks.length > 0 || executingTasks.length > 0 || underReviewTasks.length > 0) && (
          <Card className="p-3 border-primary/20 bg-primary/5">
            <div className="flex items-center gap-2 mb-2">
              <div className="relative">
                <Brain className="h-4 w-4 text-primary" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              </div>
              <span className="text-xs font-semibold">Live Activity</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {thinkingTasks.map(t => {
                const agent = agents.find(a => a.id === t.assignedAgentId);
                return (
                  <Badge key={t.id} variant="outline" className="text-[10px] gap-1 border-yellow-500/30 text-yellow-400">
                    <Brain className="h-2.5 w-2.5 animate-spin" />
                    {agent?.avatar} {t.title.slice(0, 30)}{t.title.length > 30 ? "..." : ""}
                  </Badge>
                );
              })}
              {executingTasks.map(t => {
                const agent = agents.find(a => a.id === t.assignedAgentId);
                return (
                  <Badge key={t.id} variant="outline" className="text-[10px] gap-1 border-blue-500/30 text-blue-400">
                    <Zap className="h-2.5 w-2.5" />
                    {agent?.avatar} {t.title.slice(0, 30)}{t.title.length > 30 ? "..." : ""}
                  </Badge>
                );
              })}
              {underReviewTasks.map(t => {
                const agent = agents.find(a => a.id === t.assignedAgentId);
                return (
                  <Badge key={t.id} variant="outline" className="text-[10px] gap-1 border-purple-500/30 text-purple-400">
                    <UserCheck className="h-2.5 w-2.5 animate-spin" />
                    {agent?.avatar} {t.title.slice(0, 30)}{t.title.length > 30 ? "..." : ""}
                  </Badge>
                );
              })}
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Awaiting Approval - Extended */}
          <Card className="p-4 lg:col-span-3">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-400" />
                Awaiting Your Approval
                {(awaitingApproval.length + pendingCeoApprovals) > 0 && <Badge className="text-xs">{awaitingApproval.length + pendingCeoApprovals}</Badge>}
              </h2>
              <div className="flex items-center gap-2">
                {awaitingApproval.length > 1 && (
                  <BulkApproveButton taskIds={awaitingApproval.map(t => t.id)} />
                )}
                {pendingCeoApprovals > 0 ? (
                  <Link href="/approvals" className="text-xs text-primary hover:underline flex items-center gap-1">
                    View all <ArrowRight className="h-3 w-3" />
                  </Link>
                ) : (
                  <Link href="/tasks" className="text-xs text-primary hover:underline flex items-center gap-1">
                    View all <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </div>
            {(awaitingApproval.length + pendingCeoApprovals) === 0 ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="h-8 w-8 text-green-400/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">All clear — no proposals awaiting approval</p>
              </div>
            ) : (
              <ScrollArea className={(awaitingApproval.length + pendingCeoApprovals) > 4 ? "h-[380px]" : ""}>
                <div className="space-y-2 pr-2">
                  {/* CEO Approval Queue items */}
                  {approvalQueue.filter((q: any) => q.status === "pending").slice(0, 6).map((item: any) => (
                    <div key={`aq-${item.id}`} className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[10px] border-yellow-500/30 text-yellow-400">Project Proposal</Badge>
                            <span className="text-[10px] text-muted-foreground capitalize">{item.source}</span>
                            {item.priority && <Badge variant="outline" className="text-[10px]">{item.priority}</Badge>}
                          </div>
                        </div>
                        <Link href="/approvals">
                          <Button size="sm" variant="outline" className="h-7 text-xs border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10">
                            Review
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                  {pendingCeoApprovals > 6 && (
                    <Link href="/approvals" className="block text-center py-2 text-xs text-primary hover:underline">
                      +{pendingCeoApprovals - 6} more proposals
                    </Link>
                  )}
                  {/* Task-based approvals */}
                  {awaitingApproval.map(task => {
                    const agent = agents.find(a => a.id === task.assignedAgentId);
                    return (
                      <ApprovalCard
                        key={task.id}
                        task={task}
                        agent={agent}
                        expanded={expandedApproval === task.id}
                        onToggle={() => setExpandedApproval(expandedApproval === task.id ? null : task.id)}
                      />
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </Card>

          {/* Agent Workload */}
          <Card className="p-4 lg:col-span-2">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Agent Workload
              {workload.length > 0 && <span className="text-xs text-muted-foreground font-normal ml-auto">{workload.length} agents</span>}
            </h2>
            {workload.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No agents yet</p>
            ) : (
              <div className="space-y-1 max-h-[360px] overflow-y-auto pr-1">
                {workload.map((w: any) => (
                  <WorkloadCard key={w.agentId} agent={w} />
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Health Score + Activity Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <HealthScoreWidget />

          {/* Activity Feed */}
          <Card className="p-4 min-h-[320px] lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Activity Feed
              </h2>
            </div>
            <ActivityFeed />
          </Card>
        </div>

        {/* AI Suggestions + Departments */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SmartSuggestions />

          {/* Department Breakdown */}
          <Card className="p-4 min-h-[240px]">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Target className="h-4 w-4" />
              Departments
            </h2>
            {Object.keys(stats.departments).length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No departments yet</p>
            ) : (
              <div className="space-y-2.5">
                {Object.entries(stats.departments).map(([dept, count]: [string, any]) => (
                  <div key={dept} className="flex items-center justify-between">
                    <span className="text-sm">{dept}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${(count / stats.agents.total) * 100}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground w-12 text-right">{count} agent{count !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Strategy Connection Status */}
        <StrategyConnectionWidget goals={goals} agents={agents} />

        {/* Quick Stats Footer */}
        <div className="grid grid-cols-4 gap-3">
          <Card className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Meetings</p>
            <p className="text-lg font-bold mt-0.5">{stats.meetings.total}</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-lg font-bold mt-0.5">{stats.tasks.pending}</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Goals</p>
            <p className="text-lg font-bold mt-0.5">{stats.goals.avgProgress}%</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-xs text-muted-foreground">AI Calls</p>
            <p className="text-lg font-bold mt-0.5">{stats.tokenStats?.callCount || 0}</p>
          </Card>
        </div>
      </div>

      {/* Quick Assign FAB */}
      <Button
        onClick={() => setQuickAssignOpen(true)}
        className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg bg-primary hover:bg-primary/90 z-50"
        size="icon"
      >
        <Plus className="h-5 w-5" />
      </Button>
      <QuickAssignDialog agents={agents} open={quickAssignOpen} onOpenChange={setQuickAssignOpen} />
    </div>
  );
}
