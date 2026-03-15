import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/utils";
import type { Agent, Project } from "@shared/schema";
import { Link } from "wouter";
import {
  Settings2, Cpu, Sparkles, Crown, Zap, DollarSign,
  Loader2, Check, Play, Pause, Gauge, Building2, Bell, Database, ShieldCheck, UserCheck, FileText, Brain,
  Plus, Clock, Trash2, CalendarClock, RefreshCw, Workflow,
  MessageSquare, GitBranch, Mail, LayoutGrid, FolderOpen, BookOpen, Calendar, BarChart3, Plug, CalendarDays, ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { HelpButton } from "@/components/help-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

interface AIModel {
  id: string;
  name: string;
  tier: string;
  costPer1MInput: number;
  costPer1MOutput: number;
}

const TIER_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  premium: { icon: Crown, color: "text-amber-400", label: "Premium" },
  standard: { icon: Sparkles, color: "text-blue-400", label: "Standard" },
  economy: { icon: Zap, color: "text-green-400", label: "Economy" },
};

function formatCost(cents: number): string {
  if (cents < 100) return `${cents}¢`;
  return `$${(cents / 100).toFixed(2)}`;
}

// ─── Integrations Tab ───────────────────────────────────────────
interface Integration {
  id: string;
  name: string;
  icon: LucideIcon;
  description: string;
}

const INTEGRATIONS: Integration[] = [
  { id: "slack", name: "Slack", icon: MessageSquare, description: "Send notifications and receive commands via Slack channels" },
  { id: "github", name: "GitHub", icon: GitBranch, description: "Sync repositories, track commits, and manage pull requests" },
  { id: "email", name: "Email", icon: Mail, description: "Send and receive emails for agent communication" },
  { id: "jira", name: "Jira", icon: LayoutGrid, description: "Sync tasks and projects with Jira boards" },
  { id: "google-drive", name: "Google Drive", icon: FolderOpen, description: "Store and access documents in Google Drive" },
  { id: "notion", name: "Notion", icon: BookOpen, description: "Sync knowledge base with Notion pages" },
  { id: "calendar", name: "Calendar", icon: Calendar, description: "Schedule meetings and manage agent calendars" },
  { id: "analytics", name: "Analytics", icon: BarChart3, description: "Export metrics to external analytics platforms" },
];

function IntegrationsTab() {
  const [connected, setConnected] = useState<Record<string, boolean>>({});

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {INTEGRATIONS.map((integration) => {
        const Icon = integration.icon;
        const isConnected = !!connected[integration.id];
        return (
          <Card key={integration.id} className="p-4" data-testid={`card-${integration.id}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">{integration.name}</span>
              </div>
              <Badge
                variant={isConnected ? "default" : "secondary"}
                className={`text-[9px] ${isConnected ? "bg-green-500/15 text-green-500 border-green-500/25" : ""}`}
              >
                {isConnected ? "Connected" : "Not Connected"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-3">{integration.description}</p>
            <div className="flex items-center gap-2">
              <Switch
                checked={isConnected}
                onCheckedChange={() => setConnected(prev => ({ ...prev, [integration.id]: !prev[integration.id] }))}
                data-testid={`switch-${integration.id}`}
              />
              <span className="text-xs text-muted-foreground">{isConnected ? "Enabled" : "Disabled"}</span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Schedules Tab ──────────────────────────────────────────────
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

function CreateScheduledDialog({ agents, projects, workflows, open, onOpenChange }: {
  agents: Agent[];
  projects: Project[];
  workflows: any[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [agentId, setAgentId] = useState("");
  const [frequency, setFrequency] = useState("daily");
  const [priority, setPriority] = useState("medium");
  const [projectId, setProjectId] = useState("");
  const [taskType, setTaskType] = useState("general");
  const [workflowId, setWorkflowId] = useState("");
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/scheduled-tasks", data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-tasks"] });
      toast({ title: "Scheduled task created", description: `"${title}" will run ${frequency}` });
      onOpenChange(false);
      setTitle(""); setDescription(""); setAgentId(""); setFrequency("daily"); setPriority("medium"); setProjectId(""); setTaskType("general"); setWorkflowId("");
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            Create Scheduled Task
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Task Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Weekly performance review" className="mt-1" data-testid="input-sched-title" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What should the agent do each time..." rows={3} className="mt-1" data-testid="input-sched-desc" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Assign to Agent</Label>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select agent" /></SelectTrigger>
                <SelectContent>
                  {agents.map(a => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.avatar} {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map(f => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
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
              <Label>Task Type</Label>
              <Select value={taskType} onValueChange={setTaskType}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="workflow">Workflow</SelectItem>
                  <SelectItem value="delegate">Delegation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Project (optional)</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Linked Workflow (optional)</Label>
            <Select value={workflowId} onValueChange={setWorkflowId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {workflows.map(w => (
                  <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => createMutation.mutate({
              title,
              description: description || title,
              assignedAgentId: Number(agentId),
              frequency,
              priority,
              taskType,
              projectId: projectId && projectId !== "none" ? Number(projectId) : null,
              workflowId: workflowId && workflowId !== "none" ? Number(workflowId) : null,
              triggeredBy: workflowId && workflowId !== "none" ? "workflow" : "manual",
            })}
            disabled={!title.trim() || !agentId || createMutation.isPending}
            className="gap-1.5"
            data-testid="button-create-scheduled"
          >
            {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Create Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SchedulesTab() {
  const { data: scheduled = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/scheduled-tasks"] });
  const { data: agents = [] } = useQuery<Agent[]>({ queryKey: ["/api/agents"] });
  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ["/api/projects"] });
  const { data: workflows = [] } = useQuery<any[]>({ queryKey: ["/api/workflows"] });
  const [createOpen, setCreateOpen] = useState(false);
  const { toast } = useToast();

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-tasks"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/scheduled-tasks/${id}`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-tasks"] });
      toast({ title: "Deleted", description: "Scheduled task removed" });
    },
  });

  const active = scheduled.filter(s => s.status === "active");
  const paused = scheduled.filter(s => s.status === "paused");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-3 gap-3 flex-1 mr-4">
          <Card className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Active</p>
            <p className="text-lg font-bold mt-0.5 text-green-400">{active.length}</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Paused</p>
            <p className="text-lg font-bold mt-0.5 text-yellow-400">{paused.length}</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Total Runs</p>
            <p className="text-lg font-bold mt-0.5">{scheduled.reduce((s, t) => s + (t.runCount || 0), 0)}</p>
          </Card>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2 shrink-0" data-testid="button-new-schedule">
          <Plus className="h-4 w-4" /> New Schedule
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">Loading schedules...</div>
      ) : scheduled.length === 0 ? (
        <div className="text-center py-12">
          <CalendarClock className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No scheduled tasks yet. Create one to automate recurring work.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {scheduled.map((item: any) => {
            const agent = agents.find(a => a.id === item.assignedAgentId);
            const project = item.projectId ? projects.find(p => p.id === item.projectId) : null;
            const linkedWorkflow = item.workflowId ? workflows.find(w => w.id === item.workflowId) : null;
            const triggeredBy = item.triggeredBy || "manual";
            const freqColor = FREQ_COLORS[item.frequency] || FREQ_COLORS.daily;
            const isActive = item.status === "active";
            const nextRunStr = item.nextRun
              ? new Date(item.nextRun).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
              : "—";
            const lastRunStr = item.lastRun
              ? new Date(item.lastRun).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
              : "Never";

            return (
              <Card key={item.id} className={`p-4 transition-all ${!isActive ? "opacity-60" : ""}`} data-testid={`sched-${item.id}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isActive ? "bg-primary/10 border border-primary/30" : "bg-muted"}`}>
                    {isActive ? <RefreshCw className="h-4 w-4 text-primary" /> : <Pause className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{item.title}</p>
                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${freqColor}`}>{item.frequency}</Badge>
                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${isActive ? "bg-green-500/15 text-green-400 border-green-500/30" : "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"}`}>{item.status}</Badge>
                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${
                        triggeredBy === "workflow" ? "bg-violet-500/15 text-violet-400 border-violet-500/30" :
                        triggeredBy === "cron" ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30" :
                        "bg-zinc-500/15 text-zinc-400 border-zinc-500/30"
                      }`}>{triggeredBy}</Badge>
                    </div>
                    {item.description && item.description !== item.title && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-1.5 text-[10px] text-muted-foreground">
                      {agent && <span>{agent.avatar} {agent.name}</span>}
                      {project && <span>Project: {project.title}</span>}
                      {linkedWorkflow && (
                        <span className="inline-flex items-center gap-1 text-violet-400">
                          <Workflow className="h-3 w-3" />
                          {linkedWorkflow.name}
                        </span>
                      )}
                      <span>Next: {nextRunStr}</span>
                      <span>Last: {lastRunStr}</span>
                      <span>Runs: {item.runCount || 0}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => runMutation.mutate(item.id)} disabled={runMutation.isPending} className="gap-1 h-8 text-xs" data-testid={`button-run-${item.id}`}>
                      {runMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />} Run Now
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleMutation.mutate({ id: item.id, status: isActive ? "paused" : "active" })} className="h-8 text-xs">
                      {isActive ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete scheduled task?</AlertDialogTitle>
                          <AlertDialogDescription>This will permanently remove "{item.title}" schedule.</AlertDialogDescription>
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

      <CreateScheduledDialog agents={agents} projects={projects} workflows={workflows} open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

// ─── Main Settings Page ─────────────────────────────────────────
export default function SettingsPage() {
  const { data: settings } = useQuery<Record<string, any>>({ queryKey: ["/api/settings"] });
  const { data: models = [] } = useQuery<AIModel[]>({ queryKey: ["/api/models"] });
  const { data: agents = [] } = useQuery<Agent[]>({ queryKey: ["/api/agents"] });
  const { data: tokenStats } = useQuery<any>({ queryKey: ["/api/token-stats"] });

  const updateSettingsMutation = useMutation({
    mutationFn: (data: Record<string, any>) => apiRequest("PATCH", "/api/settings", data).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/settings"] }); },
  });

  const updateAgentMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/agents/${id}`, data).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/agents"] }); },
  });

  const defaultModel = settings?.defaultModel || "gpt5_nano";

  return (
    <div>
      <div className="p-4 space-y-4 max-w-4xl mx-auto">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Settings
            </h1>
            <p className="text-sm text-muted-foreground">Configure AI models, schedules, and integrations</p>
          </div>
          <HelpButton page="settings" />
        </div>

        <Tabs defaultValue="general">
          <TabsList className="w-fit">
            <TabsTrigger value="general" data-testid="tab-general">
              <Settings2 className="h-3.5 w-3.5 mr-1.5" /> General
            </TabsTrigger>
            <TabsTrigger value="schedules" data-testid="tab-schedules">
              <CalendarClock className="h-3.5 w-3.5 mr-1.5" /> Schedules
            </TabsTrigger>
            <TabsTrigger value="integrations" data-testid="tab-integrations">
              <Plug className="h-3.5 w-3.5 mr-1.5" /> Integrations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-5 mt-4">
            {/* Token usage summary */}
            {tokenStats && (
              <div className="grid grid-cols-3 gap-3">
                <Card className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total AI Calls</p>
                  <p className="text-lg font-bold mt-0.5">{tokenStats.callCount}</p>
                </Card>
                <Card className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Tokens Used</p>
                  <p className="text-lg font-bold mt-0.5">{((tokenStats.totalInputTokens + tokenStats.totalOutputTokens) / 1000).toFixed(0)}K</p>
                </Card>
                <Card className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total Cost</p>
                  <p className="text-lg font-bold mt-0.5">{formatCost(tokenStats.totalCostCents)}</p>
                </Card>
              </div>
            )}

            {/* Task Automation Settings */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Play className="h-4.5 w-4.5 text-primary" />
                <h2 className="text-sm font-semibold">Task Automation</h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Auto-start tasks</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Agents automatically begin analyzing tasks when created or assigned.</p>
                  </div>
                  <Switch checked={settings?.autoStartTasks !== false} onCheckedChange={(checked) => updateSettingsMutation.mutate({ autoStartTasks: checked })} data-testid="switch-auto-start" />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium flex items-center gap-1.5"><Gauge className="h-3.5 w-3.5" /> Max parallel tasks per agent</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Limit simultaneous tasks. Set to 0 for unlimited.</p>
                  </div>
                  <Input type="number" min={0} max={20} className="w-20 text-center" value={settings?.maxParallelTasksPerAgent ?? 0} onChange={(e) => { const val = Math.max(0, Math.min(20, parseInt(e.target.value) || 0)); updateSettingsMutation.mutate({ maxParallelTasksPerAgent: val }); }} data-testid="input-max-parallel" />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Auto-approve tasks</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">All proposals are automatically approved without manual review.</p>
                  </div>
                  <Switch checked={settings?.autoApproveTasks === true} onCheckedChange={(checked) => updateSettingsMutation.mutate({ autoApproveTasks: checked })} data-testid="switch-auto-approve" />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium flex items-center gap-1.5"><UserCheck className="h-3.5 w-3.5" /> Manager Review Loop</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Manager automatically reviews proposals before final approval. Max 3 rounds.</p>
                  </div>
                  <Switch checked={settings?.managerReviewEnabled !== false} onCheckedChange={(checked) => updateSettingsMutation.mutate({ managerReviewEnabled: checked })} data-testid="switch-manager-review" />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Auto-Generate Deliverables</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Completed tasks auto-generate deliverable documents.</p>
                  </div>
                  <Switch checked={settings?.autoGenerateDeliverables !== false} onCheckedChange={(checked) => updateSettingsMutation.mutate({ autoGenerateDeliverables: checked })} data-testid="switch-auto-deliverables" />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium flex items-center gap-1.5"><Brain className="h-3.5 w-3.5" /> Context Intelligence</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">AI analyzes cross-task connections and consequences.</p>
                  </div>
                  <Switch checked={settings?.contextIntelligence !== false} onCheckedChange={(checked) => updateSettingsMutation.mutate({ contextIntelligence: checked })} data-testid="switch-context-intelligence" />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Self-Verification</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">AI self-checks proposals before marking them ready. Scores below 60% trigger automatic revision (max 2 rounds).</p>
                  </div>
                  <Switch checked={(settings as any)?.verificationEnabled !== false} onCheckedChange={(checked) => updateSettingsMutation.mutate({ verificationEnabled: checked })} data-testid="switch-verification" />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Auto-Plan Projects</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">AI automatically plans new projects onto the roadmap calendar when created, approved, or from meetings. Plans realistically by priority, task count, and agent capacity.</p>
                  </div>
                  <Switch checked={settings?.autoPlanEnabled === true} onCheckedChange={(checked) => updateSettingsMutation.mutate({ autoPlanEnabled: checked })} data-testid="switch-auto-plan" />
                </div>
              </div>
            </Card>

            {/* Global Default Model */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Cpu className="h-4.5 w-4.5 text-primary" />
                <h2 className="text-sm font-semibold">Global Default Model</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Used for all agents unless overridden per-agent below.</p>
              <Select value={defaultModel} onValueChange={(v) => updateSettingsMutation.mutate({ defaultModel: v })}>
                <SelectTrigger className="w-full" data-testid="select-default-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {models.map(m => {
                    const tier = TIER_CONFIG[m.tier] || TIER_CONFIG.economy;
                    const TierIcon = tier.icon;
                    return (
                      <SelectItem key={m.id} value={m.id}>
                        <div className="flex items-center gap-2">
                          <TierIcon className={`h-3.5 w-3.5 ${tier.color}`} />
                          <span>{m.name}</span>
                          <span className="text-[10px] text-muted-foreground ml-1">{formatCost(m.costPer1MInput)}/1M in · {formatCost(m.costPer1MOutput)}/1M out</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {updateSettingsMutation.isPending && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2"><Loader2 className="h-3 w-3 animate-spin" /> Saving...</div>
              )}
              {updateSettingsMutation.isSuccess && (
                <div className="flex items-center gap-1.5 text-xs text-green-400 mt-2"><Check className="h-3 w-3" /> Saved</div>
              )}
            </Card>

            {/* Per-Agent Model Overrides */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-4.5 w-4.5 text-primary" />
                <h2 className="text-sm font-semibold">Per-Agent Model Overrides</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-4">Override the AI model for specific agents.</p>
              {agents.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No agents yet</p>
              ) : (
                <div className="space-y-3">
                  {agents.map(agent => {
                    const currentModel = agent.model || null;
                    const effectiveModel = currentModel || defaultModel;
                    const modelInfo = models.find(m => m.id === effectiveModel);
                    const tier = modelInfo ? (TIER_CONFIG[modelInfo.tier] || TIER_CONFIG.economy) : TIER_CONFIG.economy;
                    return (
                      <div key={agent.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/20">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg shrink-0" style={{ backgroundColor: `${agent.color || "#666"}20`, border: `1px solid ${agent.color || "#666"}40` }}>
                          {agent.avatar || "🧠"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{agent.name}</span>
                            <span className="text-xs text-muted-foreground">{agent.role}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {!currentModel && <Badge variant="outline" className="text-[9px] text-muted-foreground">Using default</Badge>}
                            {currentModel && modelInfo && <Badge variant="outline" className={`text-[9px] ${tier.color}`}>{modelInfo.name}</Badge>}
                          </div>
                        </div>
                        <Select value={currentModel || "default"} onValueChange={(v) => { updateAgentMutation.mutate({ id: agent.id, data: { model: v === "default" ? null : v } }); }}>
                          <SelectTrigger className="w-[200px]" data-testid={`select-agent-model-${agent.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">
                              <span className="text-muted-foreground">Use default ({models.find(m => m.id === defaultModel)?.name || defaultModel})</span>
                            </SelectItem>
                            <Separator className="my-1" />
                            {models.map(m => {
                              const mTier = TIER_CONFIG[m.tier] || TIER_CONFIG.economy;
                              const MTierIcon = mTier.icon;
                              return (
                                <SelectItem key={m.id} value={m.id}>
                                  <div className="flex items-center gap-2">
                                    <MTierIcon className={`h-3 w-3 ${mTier.color}`} />
                                    <span>{m.name}</span>
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Company Profile */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="h-4.5 w-4.5 text-primary" />
                <h2 className="text-sm font-semibold">Company Profile</h2>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm font-medium">Company Name</Label>
                    <Input value={settings?.companyName ?? ""} onChange={(e) => updateSettingsMutation.mutate({ companyName: e.target.value })} placeholder="My AI Company" data-testid="input-company-name" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Industry</Label>
                    <Select value={settings?.industry ?? "technology"} onValueChange={(v) => updateSettingsMutation.mutate({ industry: v })}>
                      <SelectTrigger data-testid="select-industry"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="technology">Technology</SelectItem>
                        <SelectItem value="finance">Finance</SelectItem>
                        <SelectItem value="healthcare">Healthcare</SelectItem>
                        <SelectItem value="education">Education</SelectItem>
                        <SelectItem value="retail">Retail</SelectItem>
                        <SelectItem value="manufacturing">Manufacturing</SelectItem>
                        <SelectItem value="consulting">Consulting</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm font-medium">Logo Emoji</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {["🏢", "🚀", "💡", "🔬", "🎯", "⚡", "🌐", "🛡️"].map(e => (
                        <button key={e} type="button" onClick={() => updateSettingsMutation.mutate({ logoEmoji: e })} className={`w-8 h-8 rounded-md flex items-center justify-center text-lg transition-all ${(settings?.logoEmoji || "🏢") === e ? "bg-primary/20 ring-2 ring-primary" : "bg-muted hover:bg-muted/80"}`} data-testid={`emoji-${e}`}>
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Timezone</Label>
                    <Select value={settings?.timezone ?? "UTC"} onValueChange={(v) => updateSettingsMutation.mutate({ timezone: v })}>
                      <SelectTrigger data-testid="select-timezone"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UTC">UTC</SelectItem>
                        <SelectItem value="America/New_York">Eastern (US)</SelectItem>
                        <SelectItem value="America/Chicago">Central (US)</SelectItem>
                        <SelectItem value="America/Denver">Mountain (US)</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific (US)</SelectItem>
                        <SelectItem value="Europe/London">London</SelectItem>
                        <SelectItem value="Europe/Berlin">Berlin</SelectItem>
                        <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                        <SelectItem value="Asia/Shanghai">Shanghai</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Company Description</Label>
                  <Textarea value={settings?.companyDescription ?? ""} onChange={(e) => updateSettingsMutation.mutate({ companyDescription: e.target.value })} placeholder="Brief description of your AI company..." className="min-h-[60px]" data-testid="input-company-description" />
                </div>
              </div>
            </Card>

            {/* Notification Preferences */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Bell className="h-4.5 w-4.5 text-primary" />
                <h2 className="text-sm font-semibold">Notification Preferences</h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div><Label className="text-sm font-medium">Task Completed</Label><p className="text-xs text-muted-foreground mt-0.5">Get notified when agents complete tasks</p></div>
                  <Switch checked={settings?.notifyTaskCompleted !== false} onCheckedChange={(checked) => updateSettingsMutation.mutate({ notifyTaskCompleted: checked })} data-testid="switch-notify-task-completed" />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div><Label className="text-sm font-medium">Proposal Ready</Label><p className="text-xs text-muted-foreground mt-0.5">Notify when an agent has a proposal ready for review</p></div>
                  <Switch checked={settings?.notifyProposalReady !== false} onCheckedChange={(checked) => updateSettingsMutation.mutate({ notifyProposalReady: checked })} data-testid="switch-notify-proposal-ready" />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div><Label className="text-sm font-medium">Agent Overloaded</Label><p className="text-xs text-muted-foreground mt-0.5">Alert when an agent exceeds the max parallel task limit</p></div>
                  <Switch checked={settings?.notifyAgentOverloaded !== false} onCheckedChange={(checked) => updateSettingsMutation.mutate({ notifyAgentOverloaded: checked })} data-testid="switch-notify-agent-overloaded" />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div><Label className="text-sm font-medium">Meeting Summary</Label><p className="text-xs text-muted-foreground mt-0.5">Receive summary notifications after board meetings conclude</p></div>
                  <Switch checked={settings?.notifyMeetingSummary !== false} onCheckedChange={(checked) => updateSettingsMutation.mutate({ notifyMeetingSummary: checked })} data-testid="switch-notify-meeting-summary" />
                </div>
              </div>
            </Card>

            {/* Data Retention */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Database className="h-4.5 w-4.5 text-primary" />
                <h2 className="text-sm font-semibold">Data Retention</h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div><Label className="text-sm font-medium">Task History Retention</Label><p className="text-xs text-muted-foreground mt-0.5">How long to keep completed task records</p></div>
                  <Select value={settings?.taskRetentionDays?.toString() ?? "90"} onValueChange={(v) => updateSettingsMutation.mutate({ taskRetentionDays: Number(v) })}>
                    <SelectTrigger className="w-36" data-testid="select-task-retention"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="60">60 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                      <SelectItem value="180">180 days</SelectItem>
                      <SelectItem value="365">1 year</SelectItem>
                      <SelectItem value="0">Keep forever</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div><Label className="text-sm font-medium">Meeting Logs Retention</Label><p className="text-xs text-muted-foreground mt-0.5">How long to keep board meeting transcripts</p></div>
                  <Select value={settings?.meetingRetentionDays?.toString() ?? "90"} onValueChange={(v) => updateSettingsMutation.mutate({ meetingRetentionDays: Number(v) })}>
                    <SelectTrigger className="w-36" data-testid="select-meeting-retention"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="60">60 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                      <SelectItem value="180">180 days</SelectItem>
                      <SelectItem value="365">1 year</SelectItem>
                      <SelectItem value="0">Keep forever</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div><Label className="text-sm font-medium">Analytics Data Retention</Label><p className="text-xs text-muted-foreground mt-0.5">How long to keep detailed analytics data</p></div>
                  <Select value={settings?.analyticsRetentionDays?.toString() ?? "180"} onValueChange={(v) => updateSettingsMutation.mutate({ analyticsRetentionDays: Number(v) })}>
                    <SelectTrigger className="w-36" data-testid="select-analytics-retention"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                      <SelectItem value="180">180 days</SelectItem>
                      <SelectItem value="365">1 year</SelectItem>
                      <SelectItem value="0">Keep forever</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            {/* Model reference table */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="h-4.5 w-4.5 text-primary" />
                <h2 className="text-sm font-semibold">Model Pricing Reference</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-2 font-medium text-muted-foreground">Model</th>
                      <th className="text-left py-2 font-medium text-muted-foreground">Tier</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Input /1M</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Output /1M</th>
                    </tr>
                  </thead>
                  <tbody>
                    {models.map(m => {
                      const tier = TIER_CONFIG[m.tier] || TIER_CONFIG.economy;
                      const TierIcon = tier.icon;
                      return (
                        <tr key={m.id} className="border-b border-border/20">
                          <td className="py-2 font-medium">{m.name}</td>
                          <td className="py-2">
                            <div className="flex items-center gap-1.5">
                              <TierIcon className={`h-3 w-3 ${tier.color}`} />
                              <span className={tier.color}>{tier.label}</span>
                            </div>
                          </td>
                          <td className="py-2 text-right font-mono">{formatCost(m.costPer1MInput)}</td>
                          <td className="py-2 text-right font-mono">{formatCost(m.costPer1MOutput)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="schedules" className="mt-4">
            <SchedulesTab />
          </TabsContent>

          <TabsContent value="integrations" className="mt-4">
            <IntegrationsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
