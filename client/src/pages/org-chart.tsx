import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { apiRequest, formatCurrency } from "@/lib/utils";
import type { Agent, AgentMemory, AgentMessage, AgentCapability } from "@shared/schema";
import { Plus, Edit2, Trash2, ChevronDown, ChevronRight, User, Sparkles, Loader2, Cpu, ListTodo, CheckCircle2, DollarSign, Clock, ArrowRight, Shield, Brain, MessageSquare, Star, Zap, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AIButton } from "@/components/ai-button";
import { HelpButton } from "@/components/help-button";

const CAPABILITY_CATEGORIES = ["technical", "creative", "analytical", "management"] as const;
const CAPABILITY_LEVELS = ["beginner", "intermediate", "expert"] as const;
const LEVEL_COLORS: Record<string, string> = {
  beginner: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  intermediate: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  expert: "bg-green-500/20 text-green-400 border-green-500/30",
};

const EMOJIS = ["👑", "🔧", "📊", "📣", "⚙️", "💡", "🎯", "🤝", "🧠", "🎨", "🔬", "🛡️", "📱", "🌐", "💰", "📈"];

function AgentForm({ agent, agents, onSave, onClose }: {
  agent?: Agent;
  agents: Agent[];
  onSave: (data: any) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(agent?.name || "");
  const [role, setRole] = useState(agent?.role || "");
  const [department, setDepartment] = useState(agent?.department || "");
  const [avatar, setAvatar] = useState(agent?.avatar || "🧠");
  const [instructions, setInstructions] = useState(agent?.instructions || "");
  const [skills, setSkills] = useState(agent?.skills?.join(", ") || "");
  const [parentId, setParentId] = useState<string>(agent?.parentId?.toString() || "none");
  const [color, setColor] = useState(agent?.color || "#4F98A3");
  const [model, setModel] = useState<string>(agent?.model || "default");
  const [autonomyLevel, setAutonomyLevel] = useState<string>((agent as any)?.autonomyLevel || "manual");
  const [capabilities, setCapabilities] = useState<AgentCapability[]>((agent as any)?.capabilities || []);
  const [aiLoading, setAiLoading] = useState(false);

  const { data: models = [] } = useQuery<any[]>({ queryKey: ["/api/models"] });

  async function handleAIInstructions() {
    if (!name || !role) return;
    setAiLoading(true);
    try {
      const res = await apiRequest("POST", "/api/ai/generate-text", {
        prompt: `Generate detailed persona instructions for an AI agent named "${name}" who is the ${role} in the ${department} department. Include personality traits, decision-making style, areas of expertise, and how they should interact in board meetings. Make it specific and actionable.`,
        context: `This is for an AI company simulation where each agent plays a specific executive role.`,
      });
      const data = await res.json();
      setInstructions(data.text);
    } catch (e) {
      console.error(e);
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Agent name" data-testid="input-agent-name" />
        </div>
        <div>
          <Label>Role</Label>
          <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. CTO, CMO" data-testid="input-agent-role" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Department</Label>
          <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Technology" data-testid="input-agent-dept" />
        </div>
        <div>
          <Label>Reports To</Label>
          <Select value={parentId} onValueChange={setParentId}>
            <SelectTrigger data-testid="select-agent-parent">
              <SelectValue placeholder="None (Top level)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None (Top level)</SelectItem>
              {agents.filter(a => a.id !== agent?.id).map(a => (
                <SelectItem key={a.id} value={a.id.toString()}>{a.avatar} {a.name} ({a.role})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Avatar</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {EMOJIS.map(e => (
              <button
                key={e}
                type="button"
                onClick={() => setAvatar(e)}
                className={`w-8 h-8 rounded-md flex items-center justify-center text-lg transition-all ${avatar === e ? "bg-primary/20 ring-2 ring-primary" : "bg-muted hover:bg-muted/80"}`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>Accent Color</Label>
          <div className="flex items-center gap-2 mt-1">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent" />
            <Input value={color} onChange={(e) => setColor(e.target.value)} className="flex-1 font-mono text-xs" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Skills (comma-separated)</Label>
          <Input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Strategy, Leadership, Vision" data-testid="input-agent-skills" />
        </div>
        <div>
          <Label className="flex items-center gap-1.5"><Cpu className="h-3 w-3" /> AI Model</Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger data-testid="select-agent-model">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Use default (company-wide)</SelectItem>
              {models.map((m: any) => (
                <SelectItem key={m.id} value={m.id}>{m.name} ({m.tier})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="flex items-center gap-1.5"><Shield className="h-3 w-3" /> Autonomy Level</Label>
        <Select value={autonomyLevel} onValueChange={setAutonomyLevel}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">Manual (all tasks need approval)</SelectItem>
            <SelectItem value="supervised">Supervised (auto-approve low priority)</SelectItem>
            <SelectItem value="autonomous">Autonomous (auto-approve low + medium)</SelectItem>
            <SelectItem value="full_auto">Full Auto (auto-approve everything)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {/* Capabilities */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label className="flex items-center gap-1.5"><Zap className="h-3 w-3" /> Capabilities</Label>
          <Button type="button" variant="outline" size="sm" onClick={() => setCapabilities([...capabilities, { name: "", level: "beginner", category: "technical" }])}>
            <Plus className="h-3 w-3 mr-1" /> Add
          </Button>
        </div>
        {capabilities.map((cap, idx) => (
          <div key={idx} className="flex items-center gap-2 mt-1.5">
            <Input
              value={cap.name}
              onChange={e => { const u = [...capabilities]; u[idx] = { ...u[idx], name: e.target.value }; setCapabilities(u); }}
              placeholder="Skill name"
              className="h-7 text-xs flex-1"
            />
            <Select value={cap.level} onValueChange={v => { const u = [...capabilities]; u[idx] = { ...u[idx], level: v as any }; setCapabilities(u); }}>
              <SelectTrigger className="h-7 text-xs w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CAPABILITY_LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={cap.category} onValueChange={v => { const u = [...capabilities]; u[idx] = { ...u[idx], category: v as any }; setCapabilities(u); }}>
              <SelectTrigger className="h-7 text-xs w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CAPABILITY_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setCapabilities(capabilities.filter((_, i) => i !== idx))}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
        {capabilities.length === 0 && <p className="text-xs text-muted-foreground mt-1">No capabilities defined yet.</p>}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <Label>Persona Instructions</Label>
          <div className="flex gap-2">
            <AIButton
              onGenerated={setInstructions}
              context={`Agent: ${name}, Role: ${role}, Department: ${department}`}
              placeholder="Describe the agent's personality and behavior..."
            />
            <Button type="button" variant="ghost" size="sm" onClick={handleAIInstructions} disabled={aiLoading || !name || !role} className="gap-1.5 text-xs">
              {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              Auto-Generate
            </Button>
          </div>
        </div>
        <Textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Describe this agent's personality, expertise, decision-making style..."
          className="min-h-[120px]"
          data-testid="input-agent-instructions"
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button
          onClick={() => onSave({
            name, role, department, avatar, instructions,
            skills: skills.split(",").map(s => s.trim()).filter(Boolean),
            parentId: parentId === "none" ? null : Number(parentId),
            color, status: "active",
            model: model === "default" ? null : model,
            autonomyLevel,
            capabilities: capabilities.filter(c => c.name.trim()),
          })}
          disabled={!name || !role || !department}
          data-testid="button-save-agent"
        >
          {agent ? "Update Agent" : "Create Agent"}
        </Button>
      </DialogFooter>
    </div>
  );
}

// #3 Agent Status Indicator + #7 Performance Sparkline
const STATUS_INDICATOR: Record<string, { label: string; color: string; pulse: boolean }> = {
  thinking: { label: "Thinking", color: "bg-yellow-400", pulse: true },
  executing: { label: "Working", color: "bg-blue-400", pulse: true },
  under_review: { label: "Reviewing", color: "bg-purple-400", pulse: true },
  proposal_ready: { label: "Awaiting", color: "bg-cyan-400", pulse: false },
  meeting: { label: "In Meeting", color: "bg-orange-400", pulse: true },
  idle: { label: "Idle", color: "bg-muted-foreground/50", pulse: false },
};

function MiniSparkline({ data }: { data: number[] }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1);
  const w = 60;
  const h = 18;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(" ");
  return (
    <svg width={w} height={h} className="inline-block ml-1 opacity-60">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function OrgNode({ agent, agents, level, onEdit, onDelete, onProfile, workload, messageCounts }: {
  agent: Agent;
  agents: Agent[];
  level: number;
  onEdit: (a: Agent) => void;
  onDelete: (a: Agent) => void;
  onProfile: (a: Agent) => void;
  workload: any[];
  messageCounts: Record<number, number>;
}) {
  const [expanded, setExpanded] = useState(true);
  const children = agents.filter(a => a.parentId === agent.id);
  const agentWork = workload.find((w: any) => w.agentId === agent.id);
  const { data: models = [] } = useQuery<any[]>({ queryKey: ["/api/models"] });
  const { data: settings } = useQuery<Record<string, any>>({ queryKey: ["/api/settings"] });
  const { data: perf } = useQuery<any>({
    queryKey: ["/api/agents", agent.id, "performance"],
    queryFn: async () => {
      const res = await fetch(`/api/agents/${agent.id}/performance`);
      return res.json();
    },
    refetchInterval: 15000,
  });
  const effectiveModel = agent.model || settings?.defaultModel || "gpt5_nano";
  const modelInfo = models.find((m: any) => m.id === effectiveModel);

  // Determine current status from workload
  const currentStatus = agentWork?.status === "busy" || agentWork?.status === "overloaded"
    ? (agentWork.activeTasks > 0 ? "executing" : "idle")
    : "idle";
  const statusInfo = STATUS_INDICATOR[currentStatus] || STATUS_INDICATOR.idle;

  return (
    <div className="relative" data-testid={`org-node-${agent.id}`}>
      <div
        className="flex items-start gap-3 group"
        style={{ paddingLeft: level > 0 ? `${level * 32}px` : 0 }}
      >
        {level > 0 && (
          <div className="absolute left-0 top-5 border-l-2 border-b-2 border-border rounded-bl-lg"
            style={{ left: `${(level - 1) * 32 + 12}px`, width: "20px", height: "20px" }} />
        )}
        {children.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-3 p-0.5 rounded hover:bg-muted/50 shrink-0"
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        )}
        {children.length === 0 && <div className="w-5 shrink-0" />}
        <Card
          className="flex-1 p-3 border transition-all hover:border-primary/30 cursor-pointer group relative"
          onClick={() => onProfile(agent)}
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0"
                style={{ backgroundColor: `${agent.color}20`, border: `1px solid ${agent.color}40` }}
              >
                {agent.avatar || "🧠"}
              </div>
              <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${statusInfo.color} ${statusInfo.pulse ? "animate-pulse" : ""}`}
                title={statusInfo.label} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{agent.name}</span>
                <Badge variant="secondary" className="text-xs" style={{ borderColor: `${agent.color}40`, color: agent.color }}>
                  {agent.role}
                </Badge>
                <span className="text-xs text-muted-foreground">{agent.department}</span>
              </div>
              {agent.skills && agent.skills.length > 0 && (
                <div className="flex gap-1 mt-1 flex-wrap">
                  {agent.skills.slice(0, 4).map((s, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{s}</span>
                  ))}
                  {agent.skills.length > 4 && <span className="text-[10px] text-muted-foreground">+{agent.skills.length - 4}</span>}
                </div>
              )}
              <div className="flex items-center gap-3 mt-1.5">
                {modelInfo && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Cpu className="h-2.5 w-2.5" />
                    {modelInfo.name}
                    {!agent.model && <span className="opacity-60">(default)</span>}
                  </span>
                )}
                {agentWork && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <ListTodo className="h-2.5 w-2.5" />
                    {agentWork.activeTasks} active
                    <CheckCircle2 className="h-2.5 w-2.5 ml-1" />
                    {agentWork.completedTasks} done
                    <Link href="/tasks" onClick={(e) => e.stopPropagation()}>
                      <span className="text-primary hover:underline ml-1 flex items-center gap-0.5">
                        View Tasks <ArrowRight className="h-2.5 w-2.5" />
                      </span>
                    </Link>
                  </span>
                )}
                {messageCounts[agent.id] > 0 && (
                  <span className="text-[10px] flex items-center gap-1 text-blue-400">
                    <MessageSquare className="h-2.5 w-2.5" />
                    {messageCounts[agent.id]} unread
                  </span>
                )}
                {perf && (
                  <span className="text-[10px] flex items-center gap-1 text-muted-foreground">
                    {perf.approvalRate}% approval
                    <MiniSparkline data={perf.sparkline?.map((s: any) => s.completed) || []} />
                  </span>
                )}
              </div>
              {(agent as any).capabilities && (agent as any).capabilities.length > 0 && (
                <div className="flex gap-1 mt-1 flex-wrap">
                  {((agent as any).capabilities as AgentCapability[]).slice(0, 3).map((cap, i) => (
                    <Badge key={i} variant="outline" className={`text-[10px] px-1 py-0 ${LEVEL_COLORS[cap.level] || ""}`}>
                      {cap.name}
                    </Badge>
                  ))}
                  {(agent as any).capabilities.length > 3 && <span className="text-[10px] text-muted-foreground">+{(agent as any).capabilities.length - 3}</span>}
                </div>
              )}
              {agent.autonomyLevel && (
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 mt-1 ${
                    agent.autonomyLevel === "full_auto" ? "border-green-500/40 text-green-400" :
                    agent.autonomyLevel === "autonomous" ? "border-blue-500/40 text-blue-400" :
                    agent.autonomyLevel === "supervised" || agent.autonomyLevel === "low_auto" ? "border-yellow-500/40 text-yellow-400" :
                    "border-muted-foreground/40 text-muted-foreground"
                  }`}
                  data-testid={`autonomy-badge-${agent.id}`}
                >
                  {{ manual: "Manual", supervised: "Supervised", autonomous: "Autonomous", full_auto: "Full Auto", low_auto: "Supervised", medium_auto: "Autonomous" }[agent.autonomyLevel] || agent.autonomyLevel}
                </Badge>
              )}
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); onEdit(agent); }}>
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(agent); }}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
      {expanded && children.map(child => (
        <OrgNode key={child.id} agent={child} agents={agents} level={level + 1} onEdit={onEdit} onDelete={onDelete} onProfile={onProfile} workload={workload} messageCounts={messageCounts} />
      ))}
    </div>
  );
}

export default function OrgChart() {
  const [, navigate] = useLocation();
  const [editAgent, setEditAgent] = useState<Agent | undefined>();
  const [showForm, setShowForm] = useState(false);
  const [deleteAgent, setDeleteAgent] = useState<Agent | undefined>();
  const [profileAgent, setProfileAgent] = useState<Agent | undefined>();

  const { data: agents = [], isLoading } = useQuery<Agent[]>({ queryKey: ["/api/agents"], refetchInterval: 5000 });
  const { data: workload = [] } = useQuery<any[]>({ queryKey: ["/api/agents/workload"], refetchInterval: 8000 });
  const { data: models = [] } = useQuery<any[]>({ queryKey: ["/api/models"] });
  const { data: settings } = useQuery<Record<string, any>>({ queryKey: ["/api/settings"] });

  // Unread message counts per agent
  const [messageCounts, setMessageCounts] = useState<Record<number, number>>({});
  useQuery<AgentMessage[]>({
    queryKey: ["/api/messages", "all-agents"],
    queryFn: async () => {
      const counts: Record<number, number> = {};
      for (const a of agents) {
        try {
          const res = await apiRequest("GET", `/api/messages?agentId=${a.id}`);
          const msgs: AgentMessage[] = await res.json();
          counts[a.id] = msgs.filter(m => m.toAgentId === a.id && !m.read).length;
        } catch { counts[a.id] = 0; }
      }
      setMessageCounts(counts);
      return [];
    },
    enabled: agents.length > 0,
    refetchInterval: 10000,
  });

  const { data: profileStats } = useQuery<{
    totalTasks: number; completedTasks: number; pendingTasks: number; rejectedTasks: number;
    recentTasks: { id: number; title: string; completedAt: string }[];
    totalCost: number;
  }>({
    queryKey: ["/api/agents", profileAgent?.id, "stats"],
    queryFn: () => apiRequest("GET", `/api/agents/${profileAgent!.id}/stats`).then(r => r.json()),
    enabled: !!profileAgent,
  });

  const { data: profileMemories = [] } = useQuery<AgentMemory[]>({
    queryKey: ["/api/agents", profileAgent?.id, "memories"],
    queryFn: () => apiRequest("GET", `/api/agents/${profileAgent!.id}/memories`).then(r => r.json()),
    enabled: !!profileAgent,
  });

  const { data: profileMessages = [] } = useQuery<AgentMessage[]>({
    queryKey: ["/api/messages", profileAgent?.id],
    queryFn: () => apiRequest("GET", `/api/messages?agentId=${profileAgent!.id}`).then(r => r.json()),
    enabled: !!profileAgent,
  });

  // Chat state (Iteration 9)
  const [chatInput, setChatInput] = useState("");
  const { data: chatHistory = [], refetch: refetchChat } = useQuery<any[]>({
    queryKey: ["/api/agents", profileAgent?.id, "chat"],
    queryFn: () => apiRequest("GET", `/api/agents/${profileAgent!.id}/chat`).then(r => r.json()),
    enabled: !!profileAgent,
  });

  const chatMutation = useMutation({
    mutationFn: (message: string) =>
      apiRequest("POST", `/api/agents/${profileAgent!.id}/chat`, { message }).then(r => r.json()),
    onSuccess: () => {
      setChatInput("");
      refetchChat();
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/agents", data).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/agents"] }); setShowForm(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/agents/${id}`, data).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/agents"] }); setEditAgent(undefined); setShowForm(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/agents/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/agents"] }); setDeleteAgent(undefined); },
  });

  const rootAgents = agents.filter(a => !a.parentId);

  function handleSave(data: any) {
    if (editAgent) {
      updateMutation.mutate({ id: editAgent.id, data });
    } else {
      createMutation.mutate(data);
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 pb-2">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-xl font-bold">Organization Chart</h1>
            <p className="text-sm text-muted-foreground">{agents.length} {agents.length === 1 ? 'agent' : 'agents'} in the company</p>
          </div>
          <HelpButton page="org-chart" />
        </div>
        <Button onClick={() => { setEditAgent(undefined); setShowForm(true); }} className="gap-2" data-testid="button-add-agent">
          <Plus className="h-4 w-4" />
          Add Agent
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4 pt-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground">Loading agents...</div>
        ) : agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <User className="h-10 w-10 mb-3 opacity-40" />
            <p>No agents yet. Add your first agent to get started.</p>
          </div>
        ) : (
          <div className="space-y-2 max-w-3xl">
            {rootAgents.map(agent => (
              <OrgNode
                key={agent.id}
                agent={agent}
                agents={agents}
                level={0}
                onEdit={(a) => { setEditAgent(a); setShowForm(true); }}
                onDelete={setDeleteAgent}
                onProfile={setProfileAgent}
                workload={workload}
                messageCounts={messageCounts}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditAgent(undefined); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editAgent ? `Edit ${editAgent.name}` : "Add New Agent"}</DialogTitle>
          </DialogHeader>
          <AgentForm
            agent={editAgent}
            agents={agents}
            onSave={handleSave}
            onClose={() => { setShowForm(false); setEditAgent(undefined); }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteAgent} onOpenChange={(o) => { if (!o) setDeleteAgent(undefined); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteAgent?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this agent. Any subordinates will become top-level agents.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteAgent && deleteMutation.mutate(deleteAgent.id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Agent Profile Sheet */}
      <Sheet open={!!profileAgent} onOpenChange={(o) => { if (!o) setProfileAgent(undefined); }}>
        <SheetContent className="overflow-y-auto">
          {profileAgent && (() => {
            const effectiveModel = profileAgent.model || settings?.defaultModel || "gpt5_nano";
            const modelInfo = models.find((m: any) => m.id === effectiveModel);
            const agentCaps = (profileAgent as any).capabilities as AgentCapability[] | undefined;
            return (
              <>
                <SheetHeader>
                  <div className="flex items-center gap-3 mt-2">
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl shrink-0"
                      style={{ backgroundColor: `${profileAgent.color}20`, border: `2px solid ${profileAgent.color}40` }}
                    >
                      {profileAgent.avatar || "🧠"}
                    </div>
                    <div>
                      <SheetTitle className="text-lg">{profileAgent.name}</SheetTitle>
                      <Badge variant="secondary" style={{ borderColor: `${profileAgent.color || "#4F98A3"}40`, color: profileAgent.color || "#4F98A3" }}>
                        {profileAgent.role}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-0.5">{profileAgent.department}</p>
                    </div>
                  </div>
                </SheetHeader>

                <Tabs defaultValue="overview" className="mt-4">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="memory" className="gap-1"><Brain className="h-3 w-3" /> Memory</TabsTrigger>
                    <TabsTrigger value="messages" className="gap-1">
                      <MessageSquare className="h-3 w-3" />
                      Msgs
                      {profileMessages.filter(m => m.toAgentId === profileAgent.id && !m.read).length > 0 && (
                        <span className="ml-1 bg-blue-500 text-white text-[10px] rounded-full px-1.5 py-0.5 leading-none">
                          {profileMessages.filter(m => m.toAgentId === profileAgent.id && !m.read).length}
                        </span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="chat" className="gap-1" data-testid="tab-agent-chat">
                      <Send className="h-3 w-3" />
                      Chat
                    </TabsTrigger>
                  </TabsList>

                  {/* Overview Tab */}
                  <TabsContent value="overview" className="space-y-5 mt-4">
                    {/* Model info */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Cpu className="h-4 w-4" />
                      <span>{modelInfo?.name || effectiveModel}</span>
                      {!profileAgent.model && <span className="text-xs opacity-60">(default)</span>}
                    </div>

                    {/* Autonomy Level */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Shield className="h-4 w-4" />
                      <span>
                        {{ manual: "Manual", supervised: "Supervised", autonomous: "Autonomous", full_auto: "Full Auto", low_auto: "Supervised", medium_auto: "Autonomous" }[(profileAgent as any).autonomyLevel || "manual"] || "Manual"}
                      </span>
                      <span className="text-xs opacity-60">autonomy</span>
                    </div>

                    {/* Capabilities */}
                    {agentCaps && agentCaps.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5"><Zap className="h-3 w-3" /> Capabilities</p>
                        <div className="flex flex-wrap gap-1.5">
                          {agentCaps.map((cap, i) => (
                            <Badge key={i} variant="outline" className={`text-xs ${LEVEL_COLORS[cap.level] || ""}`}>
                              {cap.name} · {cap.level}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Task Stats */}
                    {profileStats && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-muted/50 rounded-lg p-3 text-center">
                          <p className="text-2xl font-bold">{profileStats.totalTasks}</p>
                          <p className="text-xs text-muted-foreground">Total Tasks</p>
                        </div>
                        <div className="bg-green-500/10 rounded-lg p-3 text-center">
                          <p className="text-2xl font-bold text-green-500">{profileStats.completedTasks}</p>
                          <p className="text-xs text-muted-foreground">Completed</p>
                        </div>
                        <div className="bg-yellow-500/10 rounded-lg p-3 text-center">
                          <p className="text-2xl font-bold text-yellow-500">{profileStats.pendingTasks}</p>
                          <p className="text-xs text-muted-foreground">Pending</p>
                        </div>
                        <div className="bg-red-500/10 rounded-lg p-3 text-center">
                          <p className="text-2xl font-bold text-red-500">{profileStats.rejectedTasks}</p>
                          <p className="text-xs text-muted-foreground">Rejected</p>
                        </div>
                      </div>
                    )}

                    {/* AI Cost */}
                    {profileStats && (
                      <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{formatCurrency(profileStats.totalCost)}</p>
                          <p className="text-xs text-muted-foreground">Total AI compute cost</p>
                        </div>
                      </div>
                    )}

                    {/* Recent Activity */}
                    {profileStats && profileStats.recentTasks.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          Recent Activity
                        </p>
                        <div className="space-y-1.5">
                          {profileStats.recentTasks.map(t => (
                            <div key={t.id} className="flex items-center gap-2 text-sm bg-muted/30 rounded-md px-2.5 py-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                              <span className="truncate flex-1">{t.title}</span>
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                {new Date(t.completedAt).toLocaleDateString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Skills */}
                    {profileAgent.skills && profileAgent.skills.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Skills</p>
                        <div className="flex flex-wrap gap-1.5">
                          {profileAgent.skills.map((skill, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{skill}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Instructions */}
                    {profileAgent.instructions && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Instructions</p>
                        <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 max-h-32 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                          {profileAgent.instructions.length > 400
                            ? profileAgent.instructions.slice(0, 400) + "..."
                            : profileAgent.instructions}
                        </p>
                      </div>
                    )}

                    {/* Reports */}
                    {(() => {
                      const reports = agents.filter(a => a.parentId === profileAgent.id);
                      if (reports.length === 0) return null;
                      return (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Direct Reports ({reports.length})</p>
                          <div className="space-y-1">
                            {reports.map(r => (
                              <div key={r.id} className="flex items-center gap-2 text-sm bg-muted/30 rounded-md px-2.5 py-1.5 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setProfileAgent(r)}>
                                <span>{r.avatar}</span>
                                <span className="truncate">{r.name}</span>
                                <span className="text-xs text-muted-foreground ml-auto">{r.role}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Quick Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 flex-1"
                        onClick={() => { setProfileAgent(undefined); setEditAgent(profileAgent); setShowForm(true); }}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        Edit Agent
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 flex-1"
                        onClick={() => { setProfileAgent(undefined); navigate("/tasks"); }}
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                        Assign Task
                      </Button>
                    </div>
                  </TabsContent>

                  {/* Memory Tab */}
                  <TabsContent value="memory" className="space-y-3 mt-4">
                    {profileMemories.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Brain className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No memories yet.</p>
                        <p className="text-xs">Memories are created automatically as this agent completes tasks.</p>
                      </div>
                    ) : (
                      profileMemories.map(mem => (
                        <div key={mem.id} className="bg-muted/30 rounded-lg p-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-[10px]">{mem.type}</Badge>
                            <div className="flex items-center gap-0.5">
                              {Array.from({ length: mem.importance }, (_, i) => (
                                <Star key={i} className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" />
                              ))}
                            </div>
                          </div>
                          <p className="text-sm">{mem.content}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(mem.createdAt).toLocaleDateString()}
                            {mem.source && ` · from ${mem.source}`}
                          </p>
                        </div>
                      ))
                    )}
                  </TabsContent>

                  {/* Messages Tab */}
                  <TabsContent value="messages" className="space-y-3 mt-4">
                    {profileMessages.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No messages yet.</p>
                        <p className="text-xs">Messages appear when agents communicate about tasks.</p>
                      </div>
                    ) : (
                      profileMessages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(msg => {
                        const isIncoming = msg.toAgentId === profileAgent.id;
                        const otherAgent = agents.find(a => a.id === (isIncoming ? msg.fromAgentId : msg.toAgentId));
                        return (
                          <div key={msg.id} className={`rounded-lg p-3 space-y-1 ${isIncoming ? "bg-blue-500/10 border border-blue-500/20" : "bg-muted/30"} ${!msg.read && isIncoming ? "ring-1 ring-blue-500/40" : ""}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 text-xs">
                                <span>{isIncoming ? "From" : "To"}</span>
                                <span className="font-medium">{otherAgent?.avatar} {otherAgent?.name || "Unknown"}</span>
                              </div>
                              <Badge variant="outline" className="text-[10px]">{msg.type}</Badge>
                            </div>
                            <p className="text-sm">{msg.content}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(msg.createdAt).toLocaleString()}
                              {!msg.read && isIncoming && <span className="ml-2 text-blue-400 font-medium">Unread</span>}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </TabsContent>

                  {/* Chat Tab */}
                  <TabsContent value="chat" className="mt-4 flex flex-col" style={{ height: "calc(100vh - 340px)" }}>
                    <ScrollArea className="flex-1 pr-3 mb-3">
                      {chatHistory.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">No chat messages yet.</p>
                          <p className="text-xs">Send a message to start a conversation with this agent.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {chatHistory.map((msg: any) => {
                            const isOwner = msg.type === "owner_chat" && (msg.fromAgentId === null || msg.fromAgentId === 0);
                            return (
                              <div
                                key={msg.id}
                                className={`max-w-[85%] rounded-lg p-3 ${
                                  isOwner
                                    ? "ml-auto bg-primary/20 border border-primary/30"
                                    : "mr-auto bg-muted/40 border border-border"
                                }`}
                                data-testid={`chat-msg-${msg.id}`}
                              >
                                <p className="text-sm">{msg.content}</p>
                                <p className="text-[10px] text-muted-foreground mt-1">
                                  {isOwner ? "You" : profileAgent.name} · {new Date(msg.createdAt).toLocaleTimeString()}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </ScrollArea>
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Input
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        placeholder={`Message ${profileAgent.name}...`}
                        className="flex-1"
                        data-testid="input-agent-chat"
                        onKeyDown={e => {
                          if (e.key === "Enter" && !e.shiftKey && chatInput.trim()) {
                            e.preventDefault();
                            chatMutation.mutate(chatInput.trim());
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        disabled={!chatInput.trim() || chatMutation.isPending}
                        onClick={() => chatInput.trim() && chatMutation.mutate(chatInput.trim())}
                        data-testid="button-send-chat"
                      >
                        {chatMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}
